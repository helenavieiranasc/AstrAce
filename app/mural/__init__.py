from flask import Blueprint
from sqlalchemy import inspect, text

bp = Blueprint("mural", __name__)

from . import routes  # noqa: E402,F401


def completar_colunas(db):
    """Acrescenta em projetos as colunas novas (ex.: uf) que o db.create_all() não cria
    numa tabela que já existe. Só adiciona colunas que aceitam vazio; nunca apaga nada."""
    from .models import Projeto

    tabela = Projeto.__table__
    existentes = {c["name"] for c in inspect(db.engine).get_columns(tabela.name)}
    faltando = [c for c in tabela.columns if c.name not in existentes and c.nullable]
    if not faltando:
        return
    with db.engine.begin() as conexao:
        for coluna in faltando:
            tipo = coluna.type.compile(dialect=db.engine.dialect)
            conexao.execute(text(f"ALTER TABLE {tabela.name} ADD COLUMN {coluna.name} {tipo}"))
