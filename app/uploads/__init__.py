"""Envio de arquivos, compartilhado entre as frentes (materiais e capas de projetos)."""
from flask import Blueprint

bp = Blueprint("uploads", __name__)

from . import routes  # noqa: E402,F401
