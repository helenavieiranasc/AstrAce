"""Aba do Passaporte: o passaporte 3D da usuária e os carimbos que ela coleciona."""
from flask import Blueprint

bp = Blueprint("passaporte", __name__)

from . import routes  # noqa: E402,F401
