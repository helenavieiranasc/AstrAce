"""Regras do mural: consulta com filtros, validação e formato do JSON."""
from datetime import date
from urllib.parse import urlparse

from flask import current_app
from sqlalchemy import and_, or_

from .. import catalogos
from ..uploads.models import Arquivo
from ..usuarias.models import IdentidadeUsuaria, Usuaria
from .models import Projeto, semana_atual
from .tipos import TIPOS_POR_VALOR

FILTROS = ("tipo", "area", "instituicao", "cidade", "nivel", "identidade")


def consultar(filtros, pagina=1, por_pagina=12):
    q = Projeto.query.filter(Projeto.oculto.is_(False))

    for campo in ("tipo", "area", "instituicao", "cidade", "nivel"):
        if filtros.get(campo):
            q = q.filter(getattr(Projeto, campo) == filtros[campo])

    if filtros.get("identidade"):
        # Só conta quem marcou aquela identidade como pública.
        q = q.filter(
            Projeto.autora.has(
                Usuaria.identidades.any(
                    and_(
                        IdentidadeUsuaria.identidade == filtros["identidade"],
                        IdentidadeUsuaria.publica.is_(True),
                    )
                )
            )
        )

    texto = (filtros.get("q") or "").strip()
    if texto:
        like = f"%{texto}%"
        q = q.filter(or_(Projeto.titulo.ilike(like), Projeto.resumo.ilike(like)))

    total = q.count()
    itens = (
        q.order_by(Projeto.criado_em.desc(), Projeto.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )
    return itens, total


def destaques_da_semana(limite=5):
    return (
        Projeto.query.filter(
            Projeto.oculto.is_(False),
            Projeto.destaque.is_(True),
            Projeto.destaque_semana == semana_atual(),
        )
        .order_by(Projeto.criado_em.desc())
        .limit(limite)
        .all()
    )


def valores_distintos(coluna):
    linhas = (
        Projeto.query.with_entities(coluna)
        .filter(Projeto.oculto.is_(False), coluna.isnot(None), coluna != "")
        .distinct()
        .order_by(coluna)
        .all()
    )
    return [linha[0] for linha in linhas]


# ---------- JSON ----------

def cartao(p):
    tipo = TIPOS_POR_VALOR.get(p.tipo, {})
    resumo = p.resumo or ""
    return {
        "id": p.id,
        "titulo": p.titulo,
        "tipo": p.tipo,
        "tipo_rotulo": tipo.get("rotulo", p.tipo),
        "icone": tipo.get("icone", "prototipo"),
        "area": p.area,
        "area_rotulo": catalogos.rotulo(catalogos.AREAS, p.area),
        "autora": p.autora.nome_publico if p.autora else "Anônima",
        "ano": p.ano,
        "imagem_url": p.imagem_url,
        "resumo_curto": resumo if len(resumo) <= 150 else resumo[:147].rsplit(" ", 1)[0] + "…",
        "destaque": bool(p.destaque and p.destaque_semana == semana_atual()),
        "materiais": len(p.materiais) + len(p.fotos),
    }


def detalhe(p):
    dados = cartao(p)
    tipo = TIPOS_POR_VALOR.get(p.tipo, {"campos": []})
    extras = []
    for campo in tipo["campos"]:
        valor = (p.detalhes or {}).get(campo["nome"])
        if not valor:
            continue
        rotulo_valor = valor
        for opcao in campo.get("opcoes", []):
            if opcao["valor"] == valor:
                rotulo_valor = opcao["rotulo"]
        extras.append({"rotulo": campo["rotulo"], "valor": rotulo_valor, "e_link": campo["tipo"] == "url"})
    dados.update(
        {
            "resumo": p.resumo,
            "link_externo": p.link_externo,
            "instituicao": p.instituicao,
            "cidade": p.cidade,
            "nivel_rotulo": catalogos.rotulo(catalogos.NIVEIS, p.nivel) if p.nivel else None,
            "detalhes": extras,
            "arquivos": [a.para_json() for a in p.materiais],
            # A foto de capa vem primeiro na galeria.
            "fotos": [a.para_json() for a in sorted(p.fotos, key=lambda a: a.url != p.imagem_url)],
        }
    )
    return dados


# ---------- Validação do cadastro ----------

def _url_valida(valor):
    if valor.startswith("/uploads/"):  # imagens enviadas pelo POST /uploads
        return True
    partes = urlparse(valor)
    return partes.scheme in ("http", "https") and bool(partes.netloc)


def _texto(dados, nome, limite):
    valor = dados.get(nome)
    if valor is None:
        return ""
    return str(valor).strip()[:limite]


def _arquivos_da_autora(ids, autora, finalidade):
    """Arquivos enviados pela autora que ainda não estão em nenhum projeto."""
    if not ids or not autora:
        return []
    return Arquivo.query.filter(
        Arquivo.id.in_(ids),
        Arquivo.usuaria_id == autora.id,
        Arquivo.projeto_id.is_(None),
        Arquivo.finalidade == finalidade,
    ).all()


def _lista_enviada(dados, chave, finalidade, limite, autora, erros):
    """Confere a lista de ids em dados[chave] e devolve os arquivos, na ordem enviada."""
    ids = dados.get(chave) or []
    nome = "fotos" if chave == "fotos" else "arquivos"
    if not isinstance(ids, list) or not all(isinstance(i, int) for i in ids):
        erros[chave] = f"Lista de {nome} inválida. Envie de novo."
        return []
    if len(ids) > limite:
        erros[chave] = f"Envie no máximo {limite} {nome}."
        return []
    encontrados = {a.id: a for a in _arquivos_da_autora(ids, autora, finalidade)}
    if len(encontrados) != len(set(ids)):
        erros[chave] = f"Não encontramos um dos {nome}. Remova e envie de novo."
        return []
    return [encontrados[i] for i in dict.fromkeys(ids)]


def validar(dados, autora):
    """Devolve (campos_limpos, erros, arquivos). erros é {campo: mensagem}."""
    erros = {}
    limpo = {}

    tipo = TIPOS_POR_VALOR.get(dados.get("tipo"))
    if not tipo:
        erros["tipo"] = "Escolha o tipo do projeto."
    limpo["tipo"] = dados.get("tipo")

    limpo["titulo"] = _texto(dados, "titulo", 160)
    if len(limpo["titulo"]) < 4:
        erros["titulo"] = "Escreva um título com pelo menos 4 letras."

    limpo["resumo"] = _texto(dados, "resumo", 3000)
    if len(limpo["resumo"]) < 30:
        erros["resumo"] = "Conte um pouco mais: o resumo precisa de pelo menos 30 caracteres."

    limpo["area"] = dados.get("area")
    if limpo["area"] not in catalogos.valores(catalogos.AREAS):
        erros["area"] = "Escolha a área do projeto."

    try:
        limpo["ano"] = int(dados.get("ano"))
        if not 1950 <= limpo["ano"] <= date.today().year + 1:
            raise ValueError
    except (TypeError, ValueError):
        erros["ano"] = "Informe o ano com 4 dígitos, como 2025."

    limpo["nivel"] = dados.get("nivel") or (autora.nivel if autora else None)
    if limpo["nivel"] and limpo["nivel"] not in catalogos.valores(catalogos.NIVEIS):
        erros["nivel"] = "Escolha um nível da lista."

    limpo["instituicao"] = _texto(dados, "instituicao", 160) or (autora.instituicao if autora else None)
    limpo["cidade"] = _texto(dados, "cidade", 120) or (autora.cidade if autora else None)

    for nome in ("link_externo", "imagem_url"):
        limpo[nome] = _texto(dados, nome, 500) or None
        if limpo[nome] and not _url_valida(limpo[nome]):
            erros[nome] = "Cole um link completo, começando com https://."

    detalhes = {}
    extras = dados.get("detalhes") or {}
    for campo in (tipo or {}).get("campos", []):
        valor = str(extras.get(campo["nome"]) or "").strip()[:300]
        chave = f"detalhes.{campo['nome']}"
        if not valor:
            if campo["obrigatorio"]:
                erros[chave] = f"Preencha o campo {campo['rotulo']}."
            continue
        if campo["tipo"] == "selecao" and valor not in {o["valor"] for o in campo.get("opcoes", [])}:
            erros[chave] = "Escolha uma opção da lista."
        elif campo["tipo"] == "url" and not _url_valida(valor):
            erros[chave] = "Cole um link completo, começando com https://."
        detalhes[campo["nome"]] = valor
    limpo["detalhes"] = detalhes

    # Arquivos e fotos já enviados pelo POST /api/uploads.
    arquivos = _lista_enviada(
        dados, "arquivos", "material", current_app.config["LIMITE_ARQUIVOS_POR_PROJETO"], autora, erros
    )
    fotos = _lista_enviada(dados, "fotos", "foto", current_app.config["LIMITE_FOTOS_POR_PROJETO"], autora, erros)
    if fotos and not limpo["imagem_url"]:
        limpo["imagem_url"] = fotos[0].url  # a primeira foto vira a capa no mural

    if tipo and "arquivos" not in erros and "fotos" not in erros:
        material = tipo["material"]
        tem_arquivo = bool(arquivos) or (material["fotos_contam"] and bool(fotos))
        tem_link = bool(limpo["link_externo"])
        if material["exige"] == "arquivo" and not tem_arquivo:
            erros["arquivos"] = material["erro"]
        elif material["exige"] == "link" and not tem_link:
            erros.setdefault("link_externo", material["erro"])
        elif material["exige"] == "um_dos_dois" and not (tem_arquivo or tem_link):
            erros["arquivos"] = material["erro"]

    # Capa enviada à parte (finalidade "capa"): precisa ser da autora.
    if limpo["imagem_url"] and limpo["imagem_url"].startswith("/uploads/") and not fotos:
        nome = limpo["imagem_url"].removeprefix("/uploads/")
        capa = Arquivo.query.filter_by(nome_salvo=nome, finalidade="capa").first()
        if not capa or capa.usuaria_id != (autora.id if autora else None) or capa.projeto_id:
            erros["imagem_url"] = "Não encontramos a imagem de capa. Envie de novo."
        else:
            arquivos.append(capa)

    return limpo, erros, arquivos + fotos
