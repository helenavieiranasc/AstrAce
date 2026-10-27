"""Regras do canto de eventos: consulta com filtros, semana atual e formato do JSON."""
from datetime import datetime, time, timedelta
from urllib.parse import quote_plus, urlencode, urlparse

from sqlalchemy import func, or_

from .. import catalogos
from . import catalogo
from .models import Evento

FILTROS = ("q", "cidade", "modalidade", "publico", "area", "tipo", "gratuito", "periodo")

MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
DIAS_LONGOS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def agora():
    return datetime.now().replace(second=0, microsecond=0)


def _termino():
    return func.coalesce(Evento.fim, Evento.inicio)


def _visiveis():
    """Eventos publicados que ainda não terminaram (os que estão acontecendo também contam)."""
    return Evento.query.filter(Evento.oculto.is_(False), _termino() >= agora())


def fim_da_semana(referencia=None):
    """Domingo desta semana, 23h59."""
    hoje = (referencia or agora()).date()
    domingo = hoje + timedelta(days=6 - hoje.weekday())
    return datetime.combine(domingo, time(23, 59, 59))


def consultar(filtros, pagina=1, por_pagina=12):
    q = _visiveis()

    for campo, coluna in (
        ("cidade", Evento.cidade),
        ("modalidade", Evento.modalidade),
        ("area", Evento.area),
        ("tipo", Evento.tipo),
    ):
        if filtros.get(campo):
            q = q.filter(coluna == filtros[campo])

    if filtros.get("publico"):
        # "Aberto a todas" também serve para quem filtrou um público específico.
        q = q.filter(Evento.publico_alvo.in_({filtros["publico"], "todas"}))

    if filtros.get("gratuito") in ("1", "true", "sim"):
        q = q.filter(Evento.gratuito.is_(True))

    periodo = filtros.get("periodo")
    if periodo == "semana":
        q = q.filter(Evento.inicio <= fim_da_semana())
    elif periodo == "30dias":
        q = q.filter(Evento.inicio <= agora() + timedelta(days=30))

    texto = (filtros.get("q") or "").strip()
    if texto:
        like = f"%{texto}%"
        q = q.filter(
            or_(Evento.titulo.ilike(like), Evento.descricao.ilike(like), Evento.organizacao.ilike(like))
        )

    total = q.count()
    itens = q.order_by(Evento.inicio, Evento.id).offset((pagina - 1) * por_pagina).limit(por_pagina).all()
    return itens, total


def da_semana(limite=6):
    """Destaque "Acontece esta semana": de agora até domingo."""
    return _visiveis().filter(Evento.inicio <= fim_da_semana()).order_by(Evento.inicio).limit(limite).all()


def proximo():
    """O próximo evento (ou o que está acontecendo agora), para o cartaz do mural."""
    return _visiveis().order_by(Evento.inicio).first()


def cidades():
    linhas = (
        _visiveis()
        .with_entities(Evento.cidade)
        .filter(Evento.cidade.isnot(None), Evento.cidade != "")
        .distinct()
        .order_by(Evento.cidade)
        .all()
    )
    return [linha[0] for linha in linhas]


# ---------- Datas em português ----------


def _hora(dt):
    return f"{dt.hour}h" if dt.minute == 0 else f"{dt.hour}h{dt.minute:02d}"


def rotulo_data(inicio, fim=None):
    """Ex.: "sáb, 31 out · 14h às 17h" ou "31 out a 2 nov"."""
    dia = f"{DIAS[inicio.weekday()]}, {inicio.day} {MESES[inicio.month - 1]}"
    if not fim or fim.date() == inicio.date():
        horario = _hora(inicio) + (f" às {_hora(fim)}" if fim and fim != inicio else "")
        return f"{dia} · {horario}"
    mes_fim = MESES[fim.month - 1]
    if fim.month == inicio.month:
        return f"{inicio.day} a {fim.day} {mes_fim}"
    return f"{inicio.day} {MESES[inicio.month - 1]} a {fim.day} {mes_fim}"


def quando(evento, referencia=None):
    """Texto curto relativo: "Acontecendo agora", "Hoje", "Amanhã", "Sábado" ou None."""
    ref = referencia or agora()
    if evento.inicio <= ref <= evento.termino:
        return "Acontecendo agora"
    dias = (evento.inicio.date() - ref.date()).days
    if dias == 0:
        return "Hoje"
    if dias == 1:
        return "Amanhã"
    if 1 < dias < 7 and evento.inicio <= fim_da_semana(ref):
        return DIAS_LONGOS[evento.inicio.weekday()].capitalize()
    return None


# ---------- Links ----------


def _url_segura(url):
    if not url:
        return None
    if url.startswith("/uploads/"):
        return url
    partes = urlparse(url)
    return url if partes.scheme in ("http", "https") and partes.netloc else None


def link_mapa(evento):
    if evento.modalidade == "online" or not (evento.local or evento.cidade):
        return None
    endereco = ", ".join(p for p in (evento.local, evento.cidade, evento.uf) if p)
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(endereco)}"


def link_agenda(evento):
    """Abre o Google Agenda com o evento preenchido."""
    formato = "%Y%m%dT%H%M%S"
    fim = evento.fim or evento.inicio + timedelta(hours=2)
    parametros = {
        "action": "TEMPLATE",
        "text": evento.titulo,
        "dates": f"{evento.inicio.strftime(formato)}/{fim.strftime(formato)}",
        "ctz": "America/Sao_Paulo",
        "details": f"{evento.descricao[:600]}\n\nInscrição: {evento.link}",
        "location": evento.local or ("Online" if evento.modalidade == "online" else evento.cidade or ""),
    }
    return "https://calendar.google.com/calendar/render?" + urlencode(parametros)


# ---------- JSON ----------


def cartao(e):
    return {
        "id": e.id,
        "titulo": e.titulo,
        "tipo": e.tipo,
        "tipo_rotulo": catalogos.rotulo(catalogo.TIPOS_EVENTO, e.tipo),
        "organizacao": e.organizacao,
        "inicio": e.inicio.isoformat(timespec="minutes"),
        "fim": e.fim.isoformat(timespec="minutes") if e.fim else None,
        "dia": e.inicio.day,
        "mes": MESES[e.inicio.month - 1],
        "dia_semana": DIAS[e.inicio.weekday()],
        "data_rotulo": rotulo_data(e.inicio, e.fim),
        "quando": quando(e),
        "modalidade": e.modalidade,
        "modalidade_rotulo": catalogos.rotulo(catalogo.MODALIDADES, e.modalidade),
        "local": e.local,
        "cidade": e.cidade,
        "uf": e.uf,
        "gratuito": e.gratuito,
        "publico_alvo": e.publico_alvo,
        "publico_rotulo": catalogos.rotulo(catalogo.PUBLICOS, e.publico_alvo),
        "area": e.area,
        "area_rotulo": catalogos.rotulo(catalogos.AREAS, e.area) if e.area else None,
        "imagem_url": _url_segura(e.imagem_url),
        "tem_carimbo": e.tem_carimbo,
    }


def detalhe(e):
    dados = cartao(e)
    dados.update(
        {
            "descricao": e.descricao,
            "link": _url_segura(e.link),
            "link_mapa": link_mapa(e),
            "link_agenda": link_agenda(e),
        }
    )
    return dados
