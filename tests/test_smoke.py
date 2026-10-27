"""Teste básico: o app sobe, o seed roda e as rotas principais respondem."""
import pytest

from app import create_app
from app.config import Config


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


@pytest.mark.parametrize("rota", ["/mural", "/mural/novo"])
def test_paginas_abrem(cliente, rota):
    assert cliente.get(rota).status_code == 200


def test_inicio_abre_a_landing(cliente):
    resposta = cliente.get("/")
    assert resposta.status_code == 200
    assert "Entrar com Google" in resposta.get_data(as_text=True)


def test_api_lista_e_detalhe(cliente):
    assert cliente.get("/api/mural/opcoes").status_code == 200
    assert cliente.get("/api/projetos/destaques").status_code == 200

    lista = cliente.get("/api/projetos")
    assert lista.status_code == 200
    projetos = lista.get_json()["itens"]
    assert projetos

    detalhe = cliente.get(f"/api/projetos/{projetos[0]['id']}")
    assert detalhe.status_code == 200


def test_criar_projeto_sem_campos_devolve_erros(cliente):
    resposta = cliente.post("/api/projetos", json={})
    assert resposta.status_code == 422
    assert resposta.get_json()["erros"]
