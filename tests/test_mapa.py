"""Onde elas brilham: cidades reconhecidas, agrupamento e página."""
import pytest

from app import create_app
from app.config import Config
from app.extensoes import db
from app.mural.mapa import localizar
from app.mural.models import Projeto


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


@pytest.mark.parametrize("escrita", ["São Paulo", "sao paulo", "  SÃO   PAULO ", "São Paulo - SP", "São Paulo/SP", "São Paulo (SP)"])
def test_reconhece_jeitos_de_escrever_a_cidade(escrita):
    nome, uf, x, y = localizar(escrita)
    assert (nome, uf) == ("São Paulo", "SP")
    assert 0 <= x <= 100 and 0 <= y <= 100


def test_hifen_do_nome_nao_e_confundido_com_estado():
    assert localizar("Ji-Paraná")[1] == "RO"


def test_com_estado_acha_cidades_de_nome_repetido():
    assert localizar("Bom Jesus") is None  # existe em mais de um estado
    assert localizar("Bom Jesus", "PI")[:2] == ("Bom Jesus", "PI")
    # Estado que não bate com a cidade (texto editado à mão): vale o nome, se ele for único.
    assert localizar("Recife", "SP")[:2] == ("Recife", "PE")


@pytest.mark.parametrize("escrita", ["", None, "eeeee", "Cidade Inventada"])
def test_cidade_desconhecida_fica_fora(escrita):
    assert localizar(escrita) is None


def test_posicoes_respeitam_o_desenho():
    # Norte fica acima do sul, oeste à esquerda do leste.
    _, _, x_manaus, y_manaus = localizar("Manaus")
    _, _, x_recife, y_recife = localizar("Recife")
    _, _, _, y_porto_alegre = localizar("Porto Alegre")
    assert x_manaus < x_recife
    assert y_manaus < y_porto_alegre and y_recife < y_porto_alegre


def test_api_agrupa_por_cidade(app, cliente):
    mapa = cliente.get("/api/mural/mapa").get_json()
    with app.app_context():
        visiveis = Projeto.query.filter_by(oculto=False).all()
        sem_local = sum(1 for p in visiveis if localizar(p.cidade, p.uf) is None)

    assert mapa["total"] == len(visiveis)
    assert mapa["sem_local"] == sem_local
    assert sum(c["total"] for c in mapa["cidades"]) == len(visiveis) - sem_local
    for cidade in mapa["cidades"]:
        assert cidade["total"] == len(cidade["projetos"])
    totais = [c["total"] for c in mapa["cidades"]]
    assert totais == sorted(totais, reverse=True)


def test_grafias_diferentes_viram_um_pin(app, cliente):
    with app.app_context():
        projetos = Projeto.query.filter_by(cidade="Recife").all()
        projetos[0].cidade = "recife - PE"
        db.session.commit()
        total = len(projetos)
    recife = [c for c in cliente.get("/api/mural/mapa").get_json()["cidades"] if c["cidade"] == "Recife"]
    assert len(recife) == 1 and recife[0]["total"] == total


def test_projeto_oculto_sai_do_mapa(app, cliente):
    antes = cliente.get("/api/mural/mapa").get_json()["total"]
    with app.app_context():
        Projeto.query.first().oculto = True
        db.session.commit()
    assert cliente.get("/api/mural/mapa").get_json()["total"] == antes - 1


def test_pagina_do_mapa_e_link_no_mural(cliente):
    assert cliente.get("/mural/mapa").status_code == 200
    assert 'href="/mural/mapa"' in cliente.get("/mural").get_data(as_text=True)
    assert cliente.get("/static/img/mapa-brasil.svg").status_code == 200
