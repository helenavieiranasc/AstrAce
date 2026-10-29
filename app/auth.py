"""Ponto único para saber quem está logada.

A Pessoa 2 (login com Google) só precisa gravar session["usuaria_id"] no login.
"""
from flask import current_app, session

from .extensoes import db
from .usuarias.models import Usuaria


def login_dev_ativo():
    """O atalho LOGIN_DEV (agir como a primeira usuária do banco) só vale em modo debug e nos testes.

    Com o site no ar, ele daria a conta da primeira usuária, que costuma ser admin, para qualquer visitante.
    """
    return bool(current_app.config.get("LOGIN_DEV") and (current_app.debug or current_app.testing))


def usuaria_atual():
    uid = session.get("usuaria_id")
    if uid:
        return db.session.get(Usuaria, uid)
    if login_dev_ativo():
        return Usuaria.query.order_by(Usuaria.id).first()
    return None
