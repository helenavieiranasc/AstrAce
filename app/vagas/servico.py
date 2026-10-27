"""Regras de vagas: catálogos, consulta com filtros, ordenação, validação e formato JSON."""
from datetime import date, datetime
from urllib.parse import urlparse

from sqlalchemy import case, or_

from .. import catalogos
from .models import Vaga

TIPOS_VAGA = [
    {"valor": "ic", "rotulo": "Iniciação científica", "icone": "ic"},
    {"valor": "bolsa", "rotulo": "Bolsa ou auxílio", "icone": "monografia"},
    {"valor": "estagio", "rotulo": "Estágio", "icone": "software"},
    {"valor": "emprego", "rotulo": "Emprego", "icone": "prototipo"},
    {"valor": "programa", "rotulo": "Programa ou formação", "icone": "extensao"},
]

TIPOS_POR_VALOR = {t["valor"]: t for t in TIPOS_VAGA}

MODALIDADES_VAGA = [
    {"valor": "presencial", "rotulo": "Presencial"},
    {"valor": "remoto", "rotulo": "Remoto"},
    {"valor": "hibrido", "rotulo": "Híbrido"},
]

ORDENACOES = [
    {"valor": "prazo", "rotulo": "Prazo mais próximo"},
    {"valor": "recentes", "rotulo": "Mais recentes"},
]

FILTROS = (
    "tipo",
    "area",
    "modalidade",
    "cidade",
    "prazo_aberto",
    "afirmativa_mulheres",
    "afirmativa_trans",
    "ordem",
)


def _ativo(valor):
    if isinstance(valor, bool):
        return valor
    return str(valor or "").strip().lower() in ("1", "true", "sim", "on")


def _formatar_data(d):
    if not d:
        return None
    return d.strftime("%d/%m/%Y")


def consultar(filtros, pagina=1, por_pagina=12, hoje=None):
    hoje = hoje or date.today()
    q = Vaga.query.filter(Vaga.oculta.is_(False))

    for campo in ("tipo", "area", "modalidade", "cidade"):
        valor = (filtros.get(campo) or "").strip()
        if valor:
            q = q.filter(getattr(Vaga, campo) == valor)

    if _ativo(filtros.get("prazo_aberto")):
        q = q.filter(or_(Vaga.prazo.is_(None), Vaga.prazo >= hoje))

    if _ativo(filtros.get("afirmativa_mulheres")):
        q = q.filter(
            Vaga.afirmativa_mulheres.is_(True),
            Vaga.fonte_afirmacao.isnot(None),
            Vaga.fonte_afirmacao != "",
        )

    if _ativo(filtros.get("afirmativa_trans")):
        q = q.filter(
            Vaga.afirmativa_trans.is_(True),
            Vaga.fonte_afirmacao.isnot(None),
            Vaga.fonte_afirmacao != "",
        )

    texto = (filtros.get("q") or "").strip()
    if texto:
        like = f"%{texto}%"
        q = q.filter(
            or_(
                Vaga.titulo.ilike(like),
                Vaga.organizacao.ilike(like),
                Vaga.descricao.ilike(like),
                Vaga.cidade.ilike(like),
            )
        )

    ordem = (filtros.get("ordem") or "prazo").strip()
    if ordem == "recentes":
        q = q.order_by(Vaga.criada_em.desc(), Vaga.id.desc())
    else:
        # 0 = prazo futuro/hoje (mais próximo primeiro), 1 = fluxo contínuo, 2 = prazo encerrado
        prioridade_prazo = case(
            (Vaga.prazo >= hoje, 0),
            (Vaga.prazo.is_(None), 1),
            else_=2,
        )
        q = q.order_by(prioridade_prazo.asc(), Vaga.prazo.asc(), Vaga.criada_em.desc(), Vaga.id.desc())

    total = q.count()
    itens = q.offset((pagina - 1) * por_pagina).limit(por_pagina).all()
    return itens, total


def valores_distintos(coluna):
    linhas = (
        Vaga.query.with_entities(coluna)
        .filter(Vaga.oculta.is_(False), coluna.isnot(None), coluna != "")
        .distinct()
        .order_by(coluna)
        .all()
    )
    return [linha[0] for linha in linhas]


# ---------- JSON ----------

def cartao(v, hoje=None):
    hoje = hoje or date.today()
    tipo = TIPOS_POR_VALOR.get(v.tipo, {})
    descricao = v.descricao or ""
    tem_fonte = bool((v.fonte_afirmacao or "").strip())
    afirmativa_mulheres = bool(v.afirmativa_mulheres and tem_fonte)
    afirmativa_trans = bool(v.afirmativa_trans and tem_fonte)

    selos = []
    if afirmativa_mulheres:
        selos.append({"valor": "mulheres", "rotulo": "Afirmativa para mulheres"})
    if afirmativa_trans:
        selos.append({"valor": "trans", "rotulo": "Afirmativa para mulheres trans"})

    if v.prazo is None:
        prazo_aberto = True
        prazo_rotulo = "Fluxo contínuo"
        dias_restantes = None
    else:
        dias_restantes = (v.prazo - hoje).days
        prazo_aberto = dias_restantes >= 0
        data_br = _formatar_data(v.prazo)
        prazo_rotulo = f"Até {data_br}" if prazo_aberto else f"Encerrada em {data_br}"

    return {
        "id": v.id,
        "titulo": v.titulo,
        "organizacao": v.organizacao,
        "tipo": v.tipo,
        "tipo_rotulo": tipo.get("rotulo", v.tipo),
        "icone": tipo.get("icone", "prototipo"),
        "area": v.area,
        "area_rotulo": catalogos.rotulo(catalogos.AREAS, v.area),
        "modalidade": v.modalidade,
        "modalidade_rotulo": catalogos.rotulo(MODALIDADES_VAGA, v.modalidade),
        "cidade": v.cidade,
        "prazo": v.prazo.isoformat() if v.prazo else None,
        "prazo_rotulo": prazo_rotulo,
        "prazo_aberto": prazo_aberto,
        "dias_restantes": dias_restantes,
        "afirmativa_mulheres": afirmativa_mulheres,
        "afirmativa_trans": afirmativa_trans,
        "selos": selos,
        "descricao_curta": descricao if len(descricao) <= 150 else descricao[:147].rsplit(" ", 1)[0] + "…",
        "data_coleta": v.data_coleta.isoformat() if v.data_coleta else None,
        "data_coleta_rotulo": _formatar_data(v.data_coleta) or _formatar_data(hoje),
    }


def detalhe(v, hoje=None):
    dados = cartao(v, hoje=hoje)
    tem_fonte = bool((v.fonte_afirmacao or "").strip())
    dados.update(
        {
            "descricao": v.descricao,
            "link_original": v.link_original,
            "fonte_afirmacao": v.fonte_afirmacao.strip() if tem_fonte else None,
        }
    )
    return dados


# ---------- Validação (usada também no painel admin da Pessoa 5) ----------

def _url_valida(valor):
    partes = urlparse(valor or "")
    return partes.scheme in ("http", "https") and bool(partes.netloc)


def _texto(dados, nome, limite):
    valor = dados.get(nome)
    if valor is None:
        return ""
    return str(valor).strip()[:limite]


def _converter_data(valor):
    if not valor:
        return None
    if isinstance(valor, date) and not isinstance(valor, datetime):
        return valor
    texto = str(valor).strip()
    if not texto:
        return None
    for formato in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            continue
    raise ValueError("Data inválida")


def validar(dados):
    """Valida dados de criação/edição de vaga. Devolve (campos_limpos, erros)."""
    erros = {}
    limpo = {}

    limpo["titulo"] = _texto(dados, "titulo", 160)
    if len(limpo["titulo"]) < 4:
        erros["titulo"] = "Escreva um título com pelo menos 4 letras."

    limpo["organizacao"] = _texto(dados, "organizacao", 160)
    if len(limpo["organizacao"]) < 2:
        erros["organizacao"] = "Informe a instituição ou empresa que oferece a vaga."

    limpo["descricao"] = _texto(dados, "descricao", 3000)
    if len(limpo["descricao"]) < 20:
        erros["descricao"] = "Escreva uma descrição curta com pelo menos 20 caracteres."

    limpo["tipo"] = dados.get("tipo")
    if limpo["tipo"] not in TIPOS_POR_VALOR:
        erros["tipo"] = "Escolha o tipo da vaga."

    limpo["area"] = dados.get("area")
    if limpo["area"] not in catalogos.valores(catalogos.AREAS):
        erros["area"] = "Escolha a área da vaga."

    limpo["modalidade"] = dados.get("modalidade")
    if limpo["modalidade"] not in catalogos.valores(MODALIDADES_VAGA):
        erros["modalidade"] = "Escolha a modalidade (presencial, remoto ou híbrido)."

    limpo["cidade"] = _texto(dados, "cidade", 120) or None

    try:
        limpo["prazo"] = _converter_data(dados.get("prazo"))
    except ValueError:
        erros["prazo"] = "Informe uma data válida para o prazo (ex.: 2026-11-30)."
        limpo["prazo"] = None

    limpo["link_original"] = _texto(dados, "link_original", 500) or _texto(dados, "link", 500)
    if not limpo["link_original"] or not _url_valida(limpo["link_original"]):
        erros["link_original"] = "Cole o link oficial do edital ou da vaga, começando com https://."

    limpo["afirmativa_mulheres"] = _ativo(dados.get("afirmativa_mulheres"))
    limpo["afirmativa_trans"] = _ativo(dados.get("afirmativa_trans"))
    limpo["fonte_afirmacao"] = _texto(dados, "fonte_afirmacao", 1000) or None

    if (limpo["afirmativa_mulheres"] or limpo["afirmativa_trans"]) and not limpo["fonte_afirmacao"]:
        erros["fonte_afirmacao"] = (
            "Para marcar um selo afirmativo, informe o trecho do edital ou link que comprova a reserva/foco da vaga."
        )

    try:
        limpo["data_coleta"] = _converter_data(dados.get("data_coleta")) or date.today()
    except ValueError:
        limpo["data_coleta"] = date.today()

    return limpo, erros
