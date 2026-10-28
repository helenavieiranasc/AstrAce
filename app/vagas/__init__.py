from flask import Blueprint
from sqlalchemy import inspect, text

bp = Blueprint("vagas", __name__)

from . import routes  # noqa: E402, F401


def completar_colunas(db):
    """Acrescenta em vagas colunas novas (ex.: afirmativa_negras) em bancos já existentes."""
    from .models import Vaga

    inspetor = inspect(db.engine)
    tabela = Vaga.__table__
    if not inspetor.has_table(tabela.name):
        return
    existentes = {c["name"] for c in inspetor.get_columns(tabela.name)}
    if "afirmativa_negras" not in existentes:
        with db.engine.begin() as conexao:
            conexao.execute(
                text("ALTER TABLE vagas ADD COLUMN afirmativa_negras BOOLEAN NOT NULL DEFAULT 0")
            )
