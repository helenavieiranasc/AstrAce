from sqlalchemy.exc import IntegrityError

from ..extensoes import db
from .models import Carimbo

BOAS_VINDAS = {"codigo": "boas-vindas", "titulo": "Bem-vinda ao AstrAce"}


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
