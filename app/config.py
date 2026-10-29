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

    # O cookie da sessão não vai junto em POSTs vindos de outros sites.
    SESSION_COOKIE_SAMESITE = "Lax"

    # Endereço público do site (ex.: https://astrace.pythonanywhere.com), usado nos QR codes.
    # Vazio: usa o endereço por onde a página foi aberta (serve para testar no computador).
    URL_PUBLICA = os.environ.get("URL_PUBLICA", "")

    # Sem login, age como a primeira usuária do banco. Só vale em modo debug e nos testes (auth.login_dev_ativo).
    LOGIN_DEV = os.environ.get("LOGIN_DEV", "1") == "1"

    # E-mails da equipe, separados por vírgula: quem entra com um deles tem o painel, sem precisar do tornar-admin.
    ADMIN_EMAILS = frozenset(
        email.strip().lower() for email in os.environ.get("ADMIN_EMAILS", "").split(",") if email.strip()
    )

    # Login com Google (OAuth). Sem os dois, o botão avisa que o login não está disponível.
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    # Opcional: força o endereço de retorno (ex.: atrás de proxy com https).
    GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")

    # Com essa quantidade de denúncias, o projeto sai do mural até a equipe revisar.
    LIMITE_DENUNCIAS = 3

    # Arquivos enviados (materiais e capas dos projetos).
    PASTA_UPLOADS = os.environ.get("PASTA_UPLOADS", str(PASTA_INSTANCE / "uploads"))
    LIMITE_UPLOAD_MB = 10
    LIMITE_ARQUIVOS_POR_PROJETO = 5
    LIMITE_FOTOS_POR_PROJETO = 5
    MAX_CONTENT_LENGTH = (LIMITE_UPLOAD_MB + 1) * 1024 * 1024
