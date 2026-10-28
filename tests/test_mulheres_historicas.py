"""Mulheres da história no Mapa de Inspiração: o arquivo de dados e a API."""
import pytest

from app import create_app
from app.config import Config
from app.mapa import historicas


@pytest.fixture
def cliente(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    return create_app(ConfigTeste).test_client()


def test_arquivo_de_dados_e_valido():
    assert historicas.validar(historicas.carregar()) == []


def test_tem_variedade_de_regioes_e_areas():
    mulheres = historicas.carregar()
    assert len(mulheres) >= 20
    assert len({m["local"]["pais"] for m in mulheres}) >= 10
    assert len({m["area"] for m in mulheres}) >= 8
    assert {"Katherine Johnson", "Grace Hopper", "Hedy Lamarr", "Ada Lovelace"} <= {m["nome"] for m in mulheres}


def test_todas_tem_foto_com_origem_e_licenca():
    for m in historicas.carregar():
        assert m["foto"]["url"].startswith("https://commons.wikimedia.org/wiki/Special:FilePath/")
        assert m["foto"]["licenca"] and m["foto"]["autor"] and m["foto"]["fonte"].startswith("https://")


def test_validacao_pega_dado_inventado_ou_incompleto():
    boa = historicas.carregar()[0]
    assert historicas.validar([{**boa, "local": {**boa["local"], "lat": 123}}])  # coordenada impossível
    assert historicas.validar([boa, boa])  # id repetido
    assert historicas.validar([{k: v for k, v in boa.items() if k != "foto"}])  # sem foto
    assert historicas.validar([{**boa, "fontes": ["http://sem-https.example"]}])


def test_api_entrega_as_mesmas_mulheres(cliente):
    r = cliente.get("/api/mapa/historicas")
    assert r.status_code == 200
    assert [m["id"] for m in r.get_json()["mulheres"]] == [m["id"] for m in historicas.carregar()]
