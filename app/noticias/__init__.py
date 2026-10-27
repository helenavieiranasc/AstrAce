from flask import Blueprint

bp = Blueprint("noticias", __name__)

from . import routes  # noqa: E402, F401
