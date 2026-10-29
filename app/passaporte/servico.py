from datetime import timedelta

from sqlalchemy.exc import IntegrityError

from ..eventos.models import Evento
from ..eventos.servico import agora
from ..extensoes import db
from .models import Carimbo

BOAS_VINDAS = {"codigo": "boas-vindas", "titulo": "Bem-vinda ao AstrAce"}

# O QR vale do começo do evento até 12h depois do fim: dá para quem chega no meio
# ou escaneia na saída, mas uma foto do QR não rende carimbo semanas depois.
CHECKIN_DEPOIS_DO_FIM = timedelta(hours=12)


def conceder(usuaria, codigo, titulo):
    """Dá o carimbo se a usuária ainda não tem. Pode chamar quantas vezes quiser."""
    existente = Carimbo.query.filter_by(usuaria_id=usuaria.id, codigo=codigo).first()
    if existente:
        return existente
    carimbo = Carimbo(usuaria_id=usuaria.id, codigo=codigo, titulo=titulo)
    db.session.add(carimbo)
    try:
        db.session.commit()
    except IntegrityError:  # dois acessos ao mesmo tempo: o outro já gravou
        db.session.rollback()
        return Carimbo.query.filter_by(usuaria_id=usuaria.id, codigo=codigo).one()
    return carimbo


def conceder_boas_vindas(usuaria):
    return conceder(usuaria, **BOAS_VINDAS)


def carimbos_de(usuaria):
    return Carimbo.query.filter_by(usuaria_id=usuaria.id).order_by(Carimbo.concedido_em, Carimbo.id).all()


# ---------- Check-in por QR nos eventos ----------


def codigo_do_evento(evento):
    return f"evento-{evento.id}"


def evento_do_token(token):
    """O evento daquele QR, ou None se o token não existe ou o evento foi ocultado."""
    evento = Evento.query.filter_by(token_qr=token).first() if token else None
    return evento if evento and not evento.oculto else None


def janela_do_checkin(evento, momento=None):
    """'cedo' (o evento ainda não começou), 'aberto' ou 'encerrado'."""
    momento = momento or agora()
    if momento < evento.inicio:
        return "cedo"
    if momento > evento.termino + CHECKIN_DEPOIS_DO_FIM:
        return "encerrado"
    return "aberto"


def carimbo_do_evento(usuaria, evento):
    return Carimbo.query.filter_by(usuaria_id=usuaria.id, codigo=codigo_do_evento(evento)).first()


def carimbar_evento(usuaria, evento):
    return conceder(usuaria, codigo_do_evento(evento), evento.titulo[:120])
