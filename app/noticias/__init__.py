from flask import Blueprint
from sqlalchemy import inspect, text

bp = Blueprint("noticias", __name__)

from . import routes  # noqa: E402, F401


def completar_colunas(db):
    """Acrescenta em noticias colunas novas (ex.: imagem_url) em bancos já existentes."""
    from .models import Noticia

    inspetor = inspect(db.engine)
    tabela = Noticia.__table__
    if not inspetor.has_table(tabela.name):
        return
    existentes = {c["name"] for c in inspetor.get_columns(tabela.name)}
    faltando = [c for c in tabela.columns if c.name not in existentes and c.nullable]
    if not faltando:
        return
    with db.engine.begin() as conexao:
        for coluna in faltando:
            tipo = coluna.type.compile(dialect=db.engine.dialect)
            conexao.execute(text(f"ALTER TABLE {tabela.name} ADD COLUMN {coluna.name} {tipo}"))
