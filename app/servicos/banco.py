"""Ajustes no banco que o db.create_all() não faz."""
from sqlalchemy import inspect, text


def acrescentar_colunas(db, *modelos):
    """Acrescenta nas tabelas que já existem as colunas novas dos modelos (o create_all só
    cria tabelas inteiras). Só adiciona colunas que aceitam vazio; nunca apaga nada."""
    inspetor = inspect(db.engine)
    with db.engine.begin() as conexao:
        for modelo in modelos:
            tabela = modelo.__table__
            if not inspetor.has_table(tabela.name):
                continue
            existentes = {c["name"] for c in inspetor.get_columns(tabela.name)}
            for coluna in tabela.columns:
                if coluna.name in existentes or not coluna.nullable:
                    continue
                tipo = coluna.type.compile(dialect=db.engine.dialect)
                conexao.execute(text(f"ALTER TABLE {tabela.name} ADD COLUMN {coluna.name} {tipo}"))
