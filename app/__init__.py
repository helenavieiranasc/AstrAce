from flask import Flask, redirect, url_for

from .config import PASTA_INSTANCE, Config
from .extensoes import db


def create_app(config=Config):
    app = Flask(__name__)
    app.config.from_object(config)
    PASTA_INSTANCE.mkdir(exist_ok=True)

    db.init_app(app)

    # Cada frente registra o próprio blueprint aqui.
    from .usuarias import models as _usuarias  # noqa: F401  (registra as tabelas)
    from .uploads import models as _uploads  # noqa: F401
    from .eventos import models as _eventos  # noqa: F401
    from .vagas import models as _vagas  # noqa: F401
    from .mural import bp as mural_bp
    from .mural.seed import seed_mural
    from .uploads import bp as uploads_bp
    from .eventos import bp as eventos_bp
    from .eventos.seed import seed_eventos
    from .vagas import bp as vagas_bp
    from .vagas.seed import seed_vagas

    app.register_blueprint(mural_bp)
    app.register_blueprint(uploads_bp)
    app.register_blueprint(eventos_bp)
    app.register_blueprint(vagas_bp)
    app.cli.add_command(seed_mural)
    app.cli.add_command(seed_eventos)
    app.cli.add_command(seed_vagas)

    @app.get("/")
    def inicio():
        return redirect(url_for("mural.pagina_mural"))

    with app.app_context():
        db.create_all()

    return app
