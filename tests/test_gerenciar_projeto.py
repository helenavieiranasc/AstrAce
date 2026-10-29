"""Editar e excluir projeto pelo mural: só a autora e a admin. Outra usuária comum não consegue."""
import pytest

from app import create_app
from app.config import Config
from app.extensoes import db
from app.mural.models import Bilhete, Estrela, Projeto
from app.usuarias.models import Usuaria


@pytest.fixture
def app(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        LOGIN_DEV = False  # aqui só vale quem entrou de verdade
        ADMIN_EMAILS = frozenset({"chefe@example.com"})
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    app = create_app(ConfigTeste)
    with app.app_context():
        resultado = app.test_cli_runner().invoke(args=["seed-mural"])
        assert resultado.exit_code == 0, resultado.output
        db.session.add_all([
            Usuaria(nome="Outra", email="outra@example.com"),
            Usuaria(nome="Admin pelo banco", email="admin@example.com", papel="admin"),
            Usuaria(nome="Admin pelo env", email="chefe@example.com"),
        ])
        db.session.commit()
    return app


@pytest.fixture
def pid(app):
    with app.app_context():
        return Projeto.query.filter_by(oculto=False).order_by(Projeto.id).first().id


def _cliente(app, email=None, usuaria_id=None):
    cliente = app.test_client()
    with app.app_context():
        if email:
            usuaria_id = Usuaria.query.filter_by(email=email).one().id
    if usuaria_id:
        with cliente.session_transaction() as sessao:
            sessao["usuaria_id"] = usuaria_id
    return cliente


def _autora(app, pid):
    with app.app_context():
        return _cliente(app, usuaria_id=db.session.get(Projeto, pid).usuaria_id)


def _edicao(cliente, pid, **mudancas):
    dados = cliente.get(f"/api/projetos/{pid}/edicao").get_json()["projeto"]
    return cliente.patch(f"/api/projetos/{pid}", json={**dados, **mudancas})


# ---------- Quem vê os botões ----------

def test_detalhe_diz_quem_pode_gerenciar(app, pid):
    assert _autora(app, pid).get(f"/api/projetos/{pid}").get_json()["pode_gerenciar"] is True
    assert _cliente(app, "admin@example.com").get(f"/api/projetos/{pid}").get_json()["pode_gerenciar"] is True
    assert _cliente(app, "chefe@example.com").get(f"/api/projetos/{pid}").get_json()["pode_gerenciar"] is True
    assert _cliente(app, "outra@example.com").get(f"/api/projetos/{pid}").get_json()["pode_gerenciar"] is False
    assert _cliente(app).get(f"/api/projetos/{pid}").get_json()["pode_gerenciar"] is False


def test_pagina_de_editar_so_para_quem_pode(app, pid):
    assert _autora(app, pid).get(f"/mural/projetos/{pid}/editar").status_code == 200
    assert _cliente(app, "admin@example.com").get(f"/mural/projetos/{pid}/editar").status_code == 200
    outra = _cliente(app, "outra@example.com").get(f"/mural/projetos/{pid}/editar")
    assert outra.status_code == 302 and f"projeto={pid}" in outra.headers["Location"]
    assert _cliente(app).get("/mural/projetos/99999/editar").status_code == 404


# ---------- Editar ----------

def test_autora_edita(app, pid):
    resposta = _edicao(_autora(app, pid), pid, titulo="Título novo da autora")
    assert resposta.status_code == 200
    assert resposta.get_json()["titulo"] == "Título novo da autora"


def test_admin_edita_projeto_de_outra_pessoa(app, pid):
    for email in ("admin@example.com", "chefe@example.com"):
        resposta = _edicao(_cliente(app, email), pid, titulo=f"Editado por {email}")
        assert resposta.status_code == 200, resposta.get_json()
    with app.app_context():
        projeto = db.session.get(Projeto, pid)
        assert projeto.titulo == "Editado por chefe@example.com"
        assert projeto.autora.email not in ("admin@example.com", "chefe@example.com")  # a autora continua a mesma


def test_outra_usuaria_nao_edita(app, pid):
    outra = _cliente(app, "outra@example.com")
    assert outra.get(f"/api/projetos/{pid}/edicao").status_code == 403
    assert outra.patch(f"/api/projetos/{pid}", json={"titulo": "Invasão"}).status_code == 403
    with app.app_context():
        assert db.session.get(Projeto, pid).titulo != "Invasão"


def test_sem_login_nao_edita(app, pid):
    assert _cliente(app).patch(f"/api/projetos/{pid}", json={"titulo": "Invasão"}).status_code == 401


def test_edicao_valida_os_campos(app, pid):
    resposta = _edicao(_autora(app, pid), pid, titulo="", uf="PE", cidade="Cidade Inventada")
    assert resposta.status_code == 422
    erros = resposta.get_json()["erros"]
    assert "titulo" in erros and "cidade" in erros


def test_edicao_troca_estado_e_cidade(app, pid):
    resposta = _edicao(_autora(app, pid), pid, uf="AM", cidade="Manaus")
    assert resposta.status_code == 200
    with app.app_context():
        projeto = db.session.get(Projeto, pid)
        assert (projeto.cidade, projeto.uf) == ("Manaus", "AM")


# ---------- Excluir ----------

def test_outra_usuaria_nao_exclui(app, pid):
    assert _cliente(app, "outra@example.com").delete(f"/api/projetos/{pid}").status_code == 403
    assert _cliente(app).delete(f"/api/projetos/{pid}").status_code == 401
    with app.app_context():
        assert db.session.get(Projeto, pid) is not None


def test_autora_exclui_com_estrelas_e_bilhetes(app, pid):
    _cliente(app, "outra@example.com").post(f"/api/projetos/{pid}/estrela")
    _cliente(app, "outra@example.com").post(f"/api/projetos/{pid}/bilhetes", json={"frase": "parabens"})

    assert _autora(app, pid).delete(f"/api/projetos/{pid}").status_code == 200
    with app.app_context():
        assert db.session.get(Projeto, pid) is None
        assert Estrela.query.filter_by(projeto_id=pid).count() == 0
        assert Bilhete.query.filter_by(projeto_id=pid).count() == 0


def test_admin_exclui_projeto_de_outra_pessoa(app, pid):
    assert _cliente(app, "chefe@example.com").delete(f"/api/projetos/{pid}").status_code == 200
    assert _cliente(app).get(f"/api/projetos/{pid}").status_code == 404


def test_projeto_oculto_some_para_outra_mas_nao_para_a_admin(app, pid):
    with app.app_context():
        db.session.get(Projeto, pid).oculto = True
        db.session.commit()
    assert _cliente(app, "outra@example.com").delete(f"/api/projetos/{pid}").status_code == 404
    assert _cliente(app, "admin@example.com").delete(f"/api/projetos/{pid}").status_code == 200
