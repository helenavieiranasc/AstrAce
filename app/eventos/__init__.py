"""Canto de eventos (Pessoa 3): agenda regional, filtros e detalhe do evento."""
from flask import Blueprint

bp = Blueprint("eventos", __name__)

from . import routes  # noqa: E402,F401
