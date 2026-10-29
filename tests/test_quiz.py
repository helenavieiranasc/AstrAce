"""Quiz "Que cientista você seria?": perguntas, cálculo do resultado e link compartilhado."""
import itertools

import pytest

from app import create_app
from app.catalogos import AREAS, valores
from app.config import Config
from app.quiz.dados import PERGUNTAS, RESULTADOS, calcular


@pytest.fixture
def cliente(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    return create_app(ConfigTeste).test_client()


def test_pagina_abre(cliente):
    assert cliente.get("/quiz").status_code == 200


def test_api_manda_perguntas_sem_os_pontos(cliente):
    dados = cliente.get("/api/quiz").get_json()
    assert len(dados["perguntas"]) == len(PERGUNTAS)
    for pergunta in dados["perguntas"]:
        assert pergunta["texto"]
        assert all(isinstance(o, str) for o in pergunta["opcoes"])  # só o texto, sem pontos


def test_toda_area_tem_cientista():
    assert set(RESULTADOS) == set(valores(AREAS))


def test_toda_area_pode_sair_como_resultado():
    combinacoes = itertools.product(*(range(len(p["opcoes"])) for p in PERGUNTAS))
    saidas = {calcular(list(r)) for r in combinacoes}
    assert saidas == set(valores(AREAS))


def test_resultado_pelo_servidor(cliente):
    r = cliente.post("/api/quiz/resultado", json={"respostas": [1, 1, 1, 0, 3, 3]})
    assert r.status_code == 200
    dados = r.get_json()
    assert dados["area"] == "biologicas"
    assert dados["cientista"] == RESULTADOS["biologicas"]["cientista"]
    assert dados["area_rotulo"] and dados["sobre"] and dados["perfil"]


@pytest.mark.parametrize(
    "respostas",
    [None, [], [0, 0, 0], [0, 0, 0, 0, 0, 9], [0, 0, 0, 0, 0, -1], ["a", 0, 0, 0, 0, 0], [True, 0, 0, 0, 0, 0]],
)
def test_respostas_invalidas(cliente, respostas):
    assert cliente.post("/api/quiz/resultado", json={"respostas": respostas}).status_code == 422


def test_link_compartilhado(cliente):
    assert cliente.get("/api/quiz/resultado/fisica").get_json()["cientista"] == RESULTADOS["fisica"]["cientista"]
    assert cliente.get("/api/quiz/resultado/inventada").status_code == 404


def test_quiz_no_menu_e_na_pagina_inicial(cliente):
    from datetime import datetime

    from app.extensoes import db
    from app.usuarias.models import ContaUsuaria, Usuaria

    with cliente.application.app_context():
        usuaria = Usuaria(nome="Ana", email="ana@exemplo.com")
        db.session.add(usuaria)
        db.session.flush()
        db.session.add(ContaUsuaria(usuaria_id=usuaria.id, cadastro_concluido_em=datetime.now()))
        from app.carta.models import ADIADA, CartaFuturo
        db.session.add(CartaFuturo(usuaria_id=usuaria.id, estado=ADIADA))
        db.session.commit()
        uid = usuaria.id
    with cliente.session_transaction() as sessao:
        sessao["usuaria_id"] = uid

    inicio = cliente.get("/").get_data(as_text=True)
    assert "inicio-quiz" in inicio and 'href="/quiz"' in inicio  # papel na página inicial
    assert 'href="/quiz"' in cliente.get("/eventos").get_data(as_text=True)  # item do menu lateral
    assert "convite-quiz" not in cliente.get("/mural").get_data(as_text=True)  # saiu do mural
