"""Mapa de Inspiração: o globo com os projetos do astrAce (pins rosas) e mulheres que marcaram a ciência (pins verdes)."""
from flask import Blueprint

bp = Blueprint("mapa", __name__)

from . import routes  # noqa: E402,F401
