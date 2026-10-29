"""Regras do mural: consulta com filtros, validação e formato do JSON."""
from datetime import date, datetime, timedelta
from urllib.parse import urlparse

from flask import current_app
from sqlalchemy import and_, func, or_

from .. import catalogos, municipios
from ..extensoes import db
from ..uploads.models import Arquivo
from ..usuarias.models import IdentidadeUsuaria, Usuaria
from . import mapa
from .models import Bilhete, Estrela, Projeto, semana_atual
from .tipos import FRASES_BILHETE, FRASES_POR_VALOR, TIPOS_POR_VALOR

FILTROS = ("tipo", "area", "instituicao", "cidade", "nivel", "identidade")
ORDENS = ("recentes", "estrelas")
DIAS_EM_ALTA = 7  # sem destaques escolhidos, a faixa mostra os mais estrelados desse período


def consultar(filtros, pagina=1, por_pagina=12, ordem="recentes"):
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
    ordenacao = [Projeto.criado_em.desc(), Projeto.id.desc()]
    if ordem == "estrelas":
        ordenacao.insert(0, Projeto.total_estrelas.desc())
    itens = (
        q.order_by(*ordenacao)
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )
    return itens, total


def destaques_da_semana(limite=5):
    """Os escolhidos pela admin nesta semana. Sem nenhum escolhido, os que estão em alta."""
    escolhidos = (
        Projeto.query.filter(
            Projeto.oculto.is_(False),
            Projeto.destaque.is_(True),
            Projeto.destaque_semana == semana_atual(),
        )
        .order_by(Projeto.criado_em.desc())
        .limit(limite)
        .all()
    )
    return escolhidos or em_alta(limite)


def em_alta(limite=5):
    """Projetos que mais ganharam estrelas nos últimos DIAS_EM_ALTA dias (só quem ganhou alguma)."""
    desde = datetime.utcnow() - timedelta(days=DIAS_EM_ALTA)
    estrelas_recentes = func.count(Estrela.id)
    return (
        Projeto.query.join(Estrela, Estrela.projeto_id == Projeto.id)
        .filter(Projeto.oculto.is_(False), Estrela.criada_em >= desde)
        .group_by(Projeto.id)
        .order_by(estrelas_recentes.desc(), Projeto.criado_em.desc(), Projeto.id.desc())
        .limit(limite)
        .all()
    )


def parecidos(projeto, limite=3):
    """Até `limite` projetos da mesma área; se faltar, completa com os do mesmo tipo."""
    base = Projeto.query.filter(Projeto.oculto.is_(False), Projeto.id != projeto.id)
    ordem = (Projeto.total_estrelas.desc(), Projeto.criado_em.desc(), Projeto.id.desc())
    itens = base.filter(Projeto.area == projeto.area).order_by(*ordem).limit(limite).all()
    if len(itens) < limite:
        itens += (
            base.filter(Projeto.tipo == projeto.tipo, Projeto.area != projeto.area)
            .order_by(*ordem)
            .limit(limite - len(itens))
            .all()
        )
    return itens


def projetos_no_mapa():
    """Projetos visíveis agrupados por cidade, com a posição de cada cidade no desenho do mapa."""
    projetos = (
        Projeto.query.filter(Projeto.oculto.is_(False))
        .order_by(Projeto.total_estrelas.desc(), Projeto.criado_em.desc(), Projeto.id.desc())
        .all()
    )
    cidades, sem_local = {}, 0
    for p in projetos:
        local = mapa.localizar(p.cidade, p.uf)
        if not local:
            sem_local += 1
            continue
        nome, uf, x, y = local
        lat, lon = mapa.coordenadas(p.cidade, p.uf)
        grupo = cidades.setdefault(
            (nome, uf), {"cidade": nome, "uf": uf, "x": x, "y": y, "lat": lat, "lon": lon, "total": 0, "projetos": []}
        )
        grupo["total"] += 1
        grupo["projetos"].append(cartao(p))
    return {
        "cidades": sorted(cidades.values(), key=lambda c: (-c["total"], c["cidade"])),
        "total": len(projetos),
        "sem_local": sem_local,
    }


def valores_distintos(coluna):
    linhas = (
        Projeto.query.with_entities(coluna)
        .filter(Projeto.oculto.is_(False), coluna.isnot(None), coluna != "")
        .distinct()
        .order_by(coluna)
        .all()
    )
    return [linha[0] for linha in linhas]


def estrelados_por(usuaria, projetos):
    """Ids, entre esses projetos, que a usuária já estrelou."""
    if not usuaria or not projetos:
        return set()
    ids = [p.id for p in projetos]
    linhas = Estrela.query.with_entities(Estrela.projeto_id).filter(
        Estrela.usuaria_id == usuaria.id, Estrela.projeto_id.in_(ids)
    )
    return {linha[0] for linha in linhas}


def alternar_estrela(projeto, usuaria):
    """Dá a estrela se ainda não deu; tira se já deu. Devolve se ficou estrelado."""
    existente = Estrela.query.filter_by(projeto_id=projeto.id, usuaria_id=usuaria.id).first()
    if existente:
        db.session.delete(existente)
    else:
        db.session.add(Estrela(projeto_id=projeto.id, usuaria_id=usuaria.id))
    db.session.commit()
    db.session.refresh(projeto)
    return existente is None


def bilhetes(projeto, usuaria):
    """Todas as frases, com quantas vezes o projeto recebeu cada uma e se a usuária já deixou."""
    contagem = dict(
        db.session.query(Bilhete.frase, func.count(Bilhete.id))
        .filter(Bilhete.projeto_id == projeto.id)
        .group_by(Bilhete.frase)
        .all()
    )
    meus = set()
    if usuaria:
        linhas = Bilhete.query.with_entities(Bilhete.frase).filter_by(projeto_id=projeto.id, usuaria_id=usuaria.id)
        meus = {linha[0] for linha in linhas}
    return [
        {**f, "total": contagem.get(f["valor"], 0), "meu": f["valor"] in meus}
        for f in FRASES_BILHETE
    ]


def alternar_bilhete(projeto, usuaria, frase):
    """Deixa o bilhete se ainda não deixou; tira se já deixou. A frase precisa existir no catálogo."""
    if frase not in FRASES_POR_VALOR:
        raise ValueError(frase)
    existente = Bilhete.query.filter_by(projeto_id=projeto.id, usuaria_id=usuaria.id, frase=frase).first()
    if existente:
        db.session.delete(existente)
    else:
        db.session.add(Bilhete(projeto_id=projeto.id, usuaria_id=usuaria.id, frase=frase))
    db.session.commit()
    db.session.refresh(projeto)


# ---------- JSON ----------

def cartao(p, estrelados=frozenset()):
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
        "estrelas": p.total_estrelas or 0,
        "estrelado": p.id in estrelados,
        "novo": p.novo,
    }


def detalhe(p, estrelados=frozenset()):
    dados = cartao(p, estrelados)
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


def local_do_perfil(autora):
    """(cidade, uf) do perfil, se for um município de verdade; senão (cidade como está, None)."""
    if not autora or not autora.cidade:
        return None, None
    uf = autora.conta.estado if getattr(autora, "conta", None) else None
    achado = municipios.buscar(autora.cidade, uf) if uf else municipios.buscar_sem_uf(autora.cidade)
    return (achado[0], achado[1]) if achado else (autora.cidade, None)


def _local(dados, autora, erros):
    """Devolve (cidade, uf).

    Com estado (formulário novo): a cidade precisa existir nele e fica com o nome oficial.
    Sem estado (quem ainda manda só o texto, como a edição pelo perfil): aceita o texto e
    completa o estado quando o nome existe em um único estado do Brasil.
    Os dois vazios: usa o local do perfil da autora."""
    cidade = _texto(dados, "cidade", 120)
    uf = _texto(dados, "uf", 2).upper()

    if uf:
        if uf not in municipios.ufs():
            erros["uf"] = "Escolha o estado da lista."
            return cidade or None, None
        if not cidade:
            erros["cidade"] = "Escolha a cidade."
            return None, uf
        achado = municipios.buscar(cidade, uf)
        if not achado:
            erros["cidade"] = "Escolha uma cidade da lista."
            return cidade, uf
        return achado[0], achado[1]

    if not cidade:
        return local_do_perfil(autora)
    achado = municipios.buscar_sem_uf(cidade)
    return (achado[0], achado[1]) if achado else (cidade, None)


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
    limpo["cidade"], limpo["uf"] = _local(dados, autora, erros)

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


# ---------- Editar e excluir ----------

# Campos que a edição aceita. Tipo, arquivos, fotos e capa continuam como estão.
CAMPOS_EDITAVEIS = (
    "titulo", "resumo", "area", "ano", "nivel", "instituicao", "cidade", "uf", "link_externo", "detalhes",
)


def pode_gerenciar(usuaria, projeto):
    """Editar e excluir: só a autora do projeto ou uma administradora."""
    return bool(usuaria and projeto and (usuaria.id == projeto.usuaria_id or usuaria.e_admin))


def para_editar(projeto):
    """O que o formulário de edição precisa: valores atuais, campos do tipo e opções."""
    tipo = TIPOS_POR_VALOR.get(projeto.tipo, {"campos": [], "rotulo": projeto.tipo})
    cidade, uf = projeto.cidade or "", projeto.uf or ""
    if cidade and not uf:
        # Projetos antigos guardaram só o nome da cidade: completa o estado quando o nome é único no Brasil.
        achado = municipios.buscar_sem_uf(cidade)
        if achado:
            cidade, uf = achado[0], achado[1]
    return {
        "projeto": {
            "id": projeto.id,
            "tipo": projeto.tipo,
            "tipo_rotulo": tipo["rotulo"],
            "titulo": projeto.titulo,
            "resumo": projeto.resumo,
            "area": projeto.area,
            "ano": projeto.ano,
            "nivel": projeto.nivel or "",
            "instituicao": projeto.instituicao or "",
            "cidade": cidade,
            "uf": uf,
            "link_externo": projeto.link_externo or "",
            "detalhes": projeto.detalhes or {},
            "arquivos": len(projeto.materiais),
            "fotos": len(projeto.fotos),
            "autora": projeto.autora.nome_publico if projeto.autora else "Anônima",
        },
        "campos_extras": tipo["campos"],
        "material": tipo.get("material"),
        "opcoes": {"areas": catalogos.AREAS, "niveis": catalogos.NIVEIS, "estados": catalogos.ESTADOS},
    }


def editar(projeto, enviados):
    """Aplica a edição e salva. Devolve os erros ({} quando deu certo).

    A validação é a mesma do cadastro. Os valores que faltam (nível, instituição, local) vêm do
    perfil da autora do projeto, e não de quem está editando (a admin pode editar o projeto de outra pessoa).
    """
    dados = {campo: enviados.get(campo) for campo in CAMPOS_EDITAVEIS}
    dados.update({"tipo": projeto.tipo, "imagem_url": None, "arquivos": [], "fotos": []})
    limpo, erros, _ = validar(dados, projeto.autora)

    # O material exigido pelo tipo conta os arquivos que o projeto já tem.
    for campo in ("arquivos", "fotos", "imagem_url"):
        erros.pop(campo, None)
    material = TIPOS_POR_VALOR[projeto.tipo]["material"]
    tem_arquivo = bool(projeto.materiais) or (material["fotos_contam"] and bool(projeto.fotos))
    tem_link = bool(limpo.get("link_externo"))
    if material["exige"] == "link" and not tem_link:
        erros.setdefault("link_externo", material["erro"])
    elif material["exige"] == "um_dos_dois" and not (tem_arquivo or tem_link):
        erros.setdefault("link_externo", "Este projeto não tem arquivo: deixe um link para mostrar o trabalho.")
    if erros:
        return erros

    for campo in CAMPOS_EDITAVEIS:
        setattr(projeto, campo, limpo[campo])
    db.session.commit()
    return {}


def excluir(projeto):
    """Apaga o projeto com estrelas, bilhetes, denúncias e arquivos (no banco e na pasta)."""
    from ..uploads.routes import pasta_uploads  # import aqui: uploads não precisa conhecer o mural

    nomes = [a.nome_salvo for a in projeto.arquivos]
    # Estrela não tem relação no modelo (o ON DELETE CASCADE não vale no SQLite sem foreign_keys).
    Estrela.query.filter_by(projeto_id=projeto.id).delete()
    db.session.delete(projeto)  # bilhetes, denúncias e registros de arquivos vão juntos (cascade)
    db.session.commit()

    pasta = pasta_uploads()
    for nome in nomes:
        try:
            (pasta / nome).unlink(missing_ok=True)
        except OSError as falha:
            current_app.logger.warning("Não deu para apagar o arquivo %s: %s", nome, falha)
