"""Ponto único para saber quem está logada.

A Pessoa 2 (login com Google) só precisa gravar session["usuaria_id"] no login.
"""
from flask import current_app, session

from .extensoes import db
from .usuarias.models import Usuaria


def usuaria_atual():
    uid = session.get("usuaria_id")
    if uid:
        return db.session.get(Usuaria, uid)
    if current_app.config.get("LOGIN_DEV"):
        return Usuaria.query.order_by(Usuaria.id).first()
    return None
