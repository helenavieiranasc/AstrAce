"""Bilhetes de incentivo: frases prontas, um de cada por pessoa, e nunca no próprio projeto."""
import pytest

from app import create_app
from app.config import Config
from app.extensoes import db
from app.mural.models import Bilhete, Projeto
from app.mural.tipos import FRASES_BILHETE
from app.usuarias.models import ContaUsuaria, Usuaria


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
    return app.test_client()  # LOGIN_DEV: age como a primeira usuária (Equipe AstrAce, sem projetos)


@pytest.fixture
def pid(app):
    with app.app_context():
        return Projeto.query.order_by(Projeto.id).first().id


def _bilhete(cliente, pid, frase):
    return cliente.post(f"/api/projetos/{pid}/bilhetes", json={"frase": frase})


def test_detalhe_traz_todas_as_frases(cliente, pid):
    dados = cliente.get(f"/api/projetos/{pid}").get_json()
    assert [b["valor"] for b in dados["bilhetes"]] == [f["valor"] for f in FRASES_BILHETE]
    assert dados["minha"] is False


def test_colar_e_tirar_bilhete(cliente, pid):
    antes = sum(b["total"] for b in cliente.get(f"/api/projetos/{pid}").get_json()["bilhetes"])

    r = _bilhete(cliente, pid, "inspirador").get_json()
    inspirador = next(b for b in r["bilhetes"] if b["valor"] == "inspirador")
    assert inspirador["meu"] is True
    assert r["total"] == antes + 1

    r = _bilhete(cliente, pid, "inspirador").get_json()  # clicar de novo tira
    assert next(b for b in r["bilhetes"] if b["valor"] == "inspirador")["meu"] is False
    assert r["total"] == antes


def test_pode_colar_frases_diferentes(cliente, pid):
    _bilhete(cliente, pid, "inspirador")
    r = _bilhete(cliente, pid, "continue").get_json()
    assert {b["valor"] for b in r["bilhetes"] if b["meu"]} == {"inspirador", "continue"}


def test_total_soma_todas_as_frases(cliente, pid):
    r = _bilhete(cliente, pid, "ideia").get_json()
    assert r["total"] == sum(b["total"] for b in r["bilhetes"])


def test_frase_fora_da_lista_e_recusada(cliente, pid):
    assert _bilhete(cliente, pid, "texto livre qualquer").status_code == 422
    assert _bilhete(cliente, pid, None).status_code == 422


def test_autora_nao_cola_no_proprio_projeto(app, cliente, pid):
    with app.app_context():
        autora_id = db.session.get(Projeto, pid).usuaria_id
    with cliente.session_transaction() as sessao:
        sessao["usuaria_id"] = autora_id

    assert cliente.get(f"/api/projetos/{pid}").get_json()["minha"] is True
    assert _bilhete(cliente, pid, "inspirador").status_code == 403


def test_projeto_oculto_nao_recebe_bilhete(app, cliente, pid):
    with app.app_context():
        db.session.get(Projeto, pid).oculto = True
        db.session.commit()
    assert _bilhete(cliente, pid, "inspirador").status_code == 404


def test_excluir_projeto_pelo_perfil_leva_os_bilhetes(app, cliente, pid):
    _bilhete(cliente, pid, "parabens")
    with app.app_context():
        autora = db.session.get(Projeto, pid).autora
        # A exclusão do perfil exige login de verdade com o cadastro completo.
        from datetime import datetime
        autora.conta = autora.conta or ContaUsuaria(usuaria_id=autora.id)
        autora.conta.cadastro_concluido_em = datetime.utcnow()
        db.session.commit()
        autora_id = autora.id
    with cliente.session_transaction() as sessao:
        sessao["usuaria_id"] = autora_id

    assert cliente.delete(f"/api/minhas-publicacoes/{pid}").status_code == 200
    with app.app_context():
        assert Bilhete.query.filter_by(projeto_id=pid).count() == 0


def test_seed_limpar_apaga_bilhetes(app):
    with app.app_context():
        assert Bilhete.query.count() > 0
        resultado = app.test_cli_runner().invoke(args=["seed-mural", "--limpar"])
        assert resultado.exit_code == 0, resultado.output
        assert Usuaria.query.count() > 0  # recriou os exemplos
