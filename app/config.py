import os
from pathlib import Path

PASTA_INSTANCE = Path(__file__).resolve().parent.parent / "instance"


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-troque-isto")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{(PASTA_INSTANCE / 'cienciadelas.db').as_posix()}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

    # Enquanto o login (Pessoa 2) não fica pronto, usa a primeira usuária do banco.
    LOGIN_DEV = os.environ.get("LOGIN_DEV", "1") == "1"

    # Com essa quantidade de denúncias, o projeto sai do mural até a equipe revisar.
    LIMITE_DENUNCIAS = 3

    # Arquivos enviados (materiais e capas dos projetos).
    PASTA_UPLOADS = os.environ.get("PASTA_UPLOADS", str(PASTA_INSTANCE / "uploads"))
    LIMITE_UPLOAD_MB = 10
    LIMITE_ARQUIVOS_POR_PROJETO = 5
    LIMITE_FOTOS_POR_PROJETO = 5
    MAX_CONTENT_LENGTH = (LIMITE_UPLOAD_MB + 1) * 1024 * 1024
