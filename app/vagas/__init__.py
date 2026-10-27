from flask import Blueprint

bp = Blueprint("vagas", __name__)

from . import routes  # noqa: E402, F401
