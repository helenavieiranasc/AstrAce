"""Regras de notícias e descobertas científicas: consulta, filtros, validação e formato JSON."""
from datetime import date, datetime
from urllib.parse import urlparse

from sqlalchemy import or_

from .. import catalogos
from .models import Noticia
from .seed import popular_noticias

CATEGORIAS_NOTICIA = [
    {"valor": "descoberta", "rotulo": "Descoberta científica", "icone": "ic"},
    {"valor": "inovacao", "rotulo": "Inovação e tecnologia", "icone": "prototipo"},
    {"valor": "premio", "rotulo": "Prêmio e reconhecimento", "icone": "congresso"},
    {"valor": "pioneirismo", "rotulo": "Trajetória e pioneirismo", "icone": "monografia"},
]

CATEGORIAS_POR_VALOR = {c["valor"]: c for c in CATEGORIAS_NOTICIA}

ORDENACOES = [
    {"valor": "recentes", "rotulo": "Mais recentes"},
    {"valor": "antigas", "rotulo": "Mais antigas"},
]

FILTROS = (
    "area",
    "categoria",
    "cientista_brasileira",
    "cientista_negra",
    "ordem",
)


def _garantir_noticias():
    """Garante que o banco tenha a curadoria inicial mesmo se ninguém rodou seed-noticias."""
    if Noticia.query.count() == 0 or Noticia.query.filter(Noticia.imagem_url.is_(None)).first():
        popular_noticias(limpar=False)


def _ativo(valor):
    if isinstance(valor, bool):
        return valor
    return str(valor or "").strip().lower() in ("1", "true", "sim", "on")


def _formatar_data(d):
    if not d:
        return ""
    return d.strftime("%d/%m/%Y")


def consultar(filtros, pagina=1, por_pagina=12):
    _garantir_noticias()
    q = Noticia.query.filter(Noticia.oculta.is_(False))

    for campo in ("area", "categoria"):
        valor = (filtros.get(campo) or "").strip()
        if valor:
            q = q.filter(getattr(Noticia, campo) == valor)

    if _ativo(filtros.get("cientista_brasileira")):
        q = q.filter(Noticia.cientista_brasileira.is_(True))

    if _ativo(filtros.get("cientista_negra")):
        q = q.filter(Noticia.cientista_negra.is_(True))

    texto = (filtros.get("q") or "").strip()
    if texto:
        like = f"%{texto}%"
        q = q.filter(
            or_(
                Noticia.titulo.ilike(like),
                Noticia.cientista.ilike(like),
                Noticia.instituicao.ilike(like),
                Noticia.resumo.ilike(like),
                Noticia.fonte_nome.ilike(like),
            )
        )

    ordem = (filtros.get("ordem") or "recentes").strip()
    if ordem == "antigas":
        q = q.order_by(Noticia.data_publicacao.asc(), Noticia.id.asc())
    else:
        q = q.order_by(Noticia.data_publicacao.desc(), Noticia.id.desc())

    total = q.count()
    itens = q.offset((pagina - 1) * por_pagina).limit(por_pagina).all()
    return itens, total


def destaques(limite=3):
    _garantir_noticias()
    return (
        Noticia.query.filter(
            Noticia.oculta.is_(False),
            Noticia.destaque.is_(True),
        )
        .order_by(Noticia.data_publicacao.desc(), Noticia.id.desc())
        .limit(limite)
        .all()
    )


def cartao(n):
    cat = CATEGORIAS_POR_VALOR.get(n.categoria, {})
    resumo = n.resumo or ""
    selos = []
    if n.cientista_brasileira:
        selos.append({"valor": "brasileira", "rotulo": "Cientista brasileira"})
    if n.cientista_negra:
        selos.append({"valor": "negras", "rotulo": "Mulher negra na ciência"})

    return {
        "id": n.id,
        "titulo": n.titulo,
        "cientista": n.cientista,
        "instituicao": n.instituicao,
        "area": n.area,
        "area_rotulo": catalogos.rotulo(catalogos.AREAS, n.area),
        "categoria": n.categoria,
        "categoria_rotulo": cat.get("rotulo", n.categoria),
        "icone": cat.get("icone", "ic"),
        "fonte_nome": n.fonte_nome,
        "imagem_url": n.imagem_url,
        "data_publicacao": n.data_publicacao.isoformat() if n.data_publicacao else None,
        "data_publicacao_rotulo": _formatar_data(n.data_publicacao),
        "cientista_brasileira": bool(n.cientista_brasileira),
        "cientista_negra": bool(n.cientista_negra),
        "destaque": bool(n.destaque),
        "selos": selos,
        "resumo_curto": resumo if len(resumo) <= 170 else resumo[:167].rsplit(" ", 1)[0] + "…",
    }


def detalhe(n):
    dados = cartao(n)
    dados.update(
        {
            "resumo": n.resumo,
            "link_fonte": n.link_fonte,
        }
    )
    return dados


def _url_valida(valor):
    if not valor:
        return False
    if valor.startswith(("/uploads/", "/static/")):
        return True
    partes = urlparse(valor)
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
    erros = {}
    limpo = {}

    limpo["titulo"] = _texto(dados, "titulo", 180)
    if len(limpo["titulo"]) < 6:
        erros["titulo"] = "Escreva uma manchete com pelo menos 6 caracteres."

    limpo["cientista"] = _texto(dados, "cientista", 140)
    if len(limpo["cientista"]) < 3:
        erros["cientista"] = "Informe o nome da cientista ou equipe protagonista."

    limpo["instituicao"] = _texto(dados, "instituicao", 160) or None

    limpo["resumo"] = _texto(dados, "resumo", 3000)
    if len(limpo["resumo"]) < 20:
        erros["resumo"] = "Escreva um resumo da descoberta com pelo menos 20 caracteres."

    limpo["area"] = dados.get("area")
    if limpo["area"] not in catalogos.valores(catalogos.AREAS):
        erros["area"] = "Escolha a área científica."

    limpo["categoria"] = dados.get("categoria")
    if limpo["categoria"] not in CATEGORIAS_POR_VALOR:
        erros["categoria"] = "Escolha a categoria da notícia."

    limpo["fonte_nome"] = _texto(dados, "fonte_nome", 120)
    if len(limpo["fonte_nome"]) < 2:
        erros["fonte_nome"] = "Informe o nome do veículo ou instituição fonte."

    limpo["link_fonte"] = _texto(dados, "link_fonte", 500)
    if not limpo["link_fonte"] or not _url_valida(limpo["link_fonte"]):
        erros["link_fonte"] = "Cole o link completo da matéria ou artigo original (https://...)."

    limpo["imagem_url"] = _texto(dados, "imagem_url", 500) or None
    if limpo["imagem_url"] and not _url_valida(limpo["imagem_url"]):
        erros["imagem_url"] = "Cole um link válido de imagem (https://... ou /uploads/...)."

    try:
        limpo["data_publicacao"] = _converter_data(dados.get("data_publicacao")) or date.today()
    except ValueError:
        erros["data_publicacao"] = "Informe uma data de publicação válida."
        limpo["data_publicacao"] = date.today()

    limpo["cientista_brasileira"] = _ativo(dados.get("cientista_brasileira", True))
    limpo["cientista_negra"] = _ativo(dados.get("cientista_negra", False))
    limpo["destaque"] = _ativo(dados.get("destaque", False))

    return limpo, erros
