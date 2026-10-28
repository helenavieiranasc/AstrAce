"""Destaques automáticos e projetos parecidos."""
from datetime import datetime, timedelta

import pytest

from app import create_app
from app.config import Config
from app.extensoes import db
from app.mural.models import Estrela, Projeto


@pytest.fixture
def app(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    app = create_app(ConfigTeste)
    with app.app_context():
        resultado = app.test_cli_runner().invoke(args=["seed-mural"])
    assert resultado.exit_code == 0, resultado.output
    return app


@pytest.fixture
def cliente(app):
    return app.test_client()


def _tirar_destaques_escolhidos(app):
    with app.app_context():
        Projeto.query.update({"destaque": False, "destaque_semana": None})
        db.session.commit()


# ---------- Destaques automáticos ----------

def test_destaques_escolhidos_tem_prioridade(cliente):
    lista = cliente.get("/api/projetos/destaques").get_json()
    assert lista and all(c["destaque"] for c in lista)


def test_sem_escolhidos_mostra_os_mais_estrelados_da_semana(app, cliente):
    _tirar_destaques_escolhidos(app)
    lista = cliente.get("/api/projetos/destaques").get_json()

    assert 0 < len(lista) <= 5
    assert not any(c["destaque"] for c in lista)
    assert all(c["estrelas"] > 0 for c in lista)  # projeto sem estrela não entra
    estrelas = [c["estrelas"] for c in lista]
    assert estrelas == sorted(estrelas, reverse=True)


def test_estrelas_antigas_nao_contam(app, cliente):
    _tirar_destaques_escolhidos(app)
    with app.app_context():
        Estrela.query.update({"criada_em": datetime.utcnow() - timedelta(days=8)})
        db.session.commit()
    assert cliente.get("/api/projetos/destaques").get_json() == []


def test_projeto_oculto_nao_fica_em_alta(app, cliente):
    _tirar_destaques_escolhidos(app)
    primeiro = cliente.get("/api/projetos/destaques").get_json()[0]["id"]
    with app.app_context():
        db.session.get(Projeto, primeiro).oculto = True
        db.session.commit()
    ids = [c["id"] for c in cliente.get("/api/projetos/destaques").get_json()]
    assert primeiro not in ids


# ---------- Parecidos ----------

def test_parecidos_no_detalhe(app, cliente):
    with app.app_context():
        projeto = Projeto.query.first()
        pid, area, tipo = projeto.id, projeto.area, projeto.tipo
        mesma_area = Projeto.query.filter(Projeto.area == area, Projeto.id != pid, Projeto.oculto.is_(False)).count()

    parecidos = cliente.get(f"/api/projetos/{pid}").get_json()["parecidos"]
    assert 0 < len(parecidos) <= 3
    assert pid not in [c["id"] for c in parecidos]
    # Primeiro os da mesma área; o resto, se houver, é do mesmo tipo.
    for i, c in enumerate(parecidos):
        if i < mesma_area:
            assert c["area"] == area
        else:
            assert c["tipo"] == tipo


def test_parecidos_nao_mostram_oculto(app, cliente):
    with app.app_context():
        projeto = Projeto.query.first()
        pid = projeto.id
    primeiro = cliente.get(f"/api/projetos/{pid}").get_json()["parecidos"][0]["id"]
    with app.app_context():
        db.session.get(Projeto, primeiro).oculto = True
        db.session.commit()
    ids = [c["id"] for c in cliente.get(f"/api/projetos/{pid}").get_json()["parecidos"]]
    assert primeiro not in ids
