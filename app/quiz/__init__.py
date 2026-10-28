"""Quiz "Que cientista você seria?": perguntas rápidas que terminam numa área e numa cientista."""
from flask import Blueprint

bp = Blueprint("quiz", __name__)

from . import routes  # noqa: E402,F401
