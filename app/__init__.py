from flask import Flask

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
    from .noticias import models as _noticias  # noqa: F401
    from .admin import models as _admin  # noqa: F401
    from .passaporte import models as _passaporte  # noqa: F401
    from .mural import bp as mural_bp, completar_colunas as completar_colunas_mural
    from .mural.seed import seed_mural
    from .uploads import bp as uploads_bp
    from .eventos import bp as eventos_bp
    from .eventos.seed import seed_eventos
    from .vagas import bp as vagas_bp, completar_colunas as completar_colunas_vagas
    from .vagas.seed import seed_vagas
    from .noticias import bp as noticias_bp, completar_colunas as completar_colunas_noticias
    from .noticias.seed import seed_noticias
    from .quiz import bp as quiz_bp
    from .passaporte import bp as passaporte_bp
    from .mapa import bp as mapa_bp
    from .conta import bp as conta_bp, completar_colunas
    from .admin import bp as admin_bp, tornar_admin

    app.register_blueprint(conta_bp)  # "/" é a landing page
    app.register_blueprint(mural_bp)
    app.register_blueprint(uploads_bp)
    app.register_blueprint(eventos_bp)
    app.register_blueprint(vagas_bp)
    app.register_blueprint(noticias_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(passaporte_bp)
    app.register_blueprint(mapa_bp)
    app.register_blueprint(admin_bp)
    app.cli.add_command(seed_mural)
    app.cli.add_command(seed_eventos)
    app.cli.add_command(seed_vagas)
    app.cli.add_command(seed_noticias)
    app.cli.add_command(tornar_admin)

    from .servicos.banco import acrescentar_colunas
    from .eventos.models import Evento
    from .noticias.models import Noticia
    from .vagas.models import Vaga

    with app.app_context():
        db.create_all()
        completar_colunas(db)
        completar_colunas_mural(db)
        completar_colunas_vagas(db)
        completar_colunas_noticias(db)
        acrescentar_colunas(db, Vaga, Noticia, Evento)  # imagem_url das vagas e notícias; carga horária dos eventos

    return app
