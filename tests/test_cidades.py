"""Lista de municípios (/api/cidades) e estado + cidade no cadastro de projeto."""
import pytest

from app import create_app, municipios
from app.config import Config
from app.extensoes import db
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
    return app.test_client()  # LOGIN_DEV: Equipe AstrAce, de São Paulo


PROJETO = {
    "tipo": "software",
    "titulo": "App de monitoramento de rios",
    "resumo": "Um aplicativo que junta medições de qualidade da água feitas por escolas ribeirinhas.",
    "area": "ambiental",
    "ano": 2025,
    "link_externo": "https://github.com/exemplo/rios",
    "detalhes": {"plataforma": "mobile", "tecnologias": "Flutter"},
}


def _publicar(cliente, **extra):
    return cliente.post("/api/projetos", json={**PROJETO, **extra})


# ---------- Base de municípios ----------

def test_base_tem_todos_os_municipios():
    assert len(municipios.ufs()) == 27
    assert sum(len(municipios.nomes_da_uf(uf)) for uf in municipios.ufs()) > 5500


def test_busca_ignora_acento_e_maiuscula():
    assert municipios.buscar("sao paulo", "sp")[:2] == ("São Paulo", "SP")
    assert municipios.buscar("Recife", "SP") is None


# ---------- /api/cidades ----------

def test_api_cidades_do_estado(cliente):
    nomes = cliente.get("/api/cidades?uf=pe").get_json()
    assert "Recife" in nomes and "Caruaru" in nomes
    assert "São Paulo" not in nomes


def test_api_cidades_estado_invalido(cliente):
    assert cliente.get("/api/cidades?uf=XX").status_code == 422
    assert cliente.get("/api/cidades").status_code == 422


def test_opcoes_trazem_estados_e_local_do_perfil(cliente):
    opcoes = cliente.get("/api/mural/opcoes").get_json()
    assert len(opcoes["estados"]) == 27
    assert opcoes["local_perfil"] == {"uf": "SP", "cidade": "São Paulo"}


# ---------- Cadastro de projeto ----------

def test_cidade_da_lista_fica_com_nome_oficial(app, cliente):
    r = _publicar(cliente, uf="rn", cidade="  natal ")
    assert r.status_code == 201, r.get_json()
    with app.app_context():
        projeto = db.session.get(Projeto, r.get_json()["id"])
        assert (projeto.cidade, projeto.uf) == ("Natal", "RN")


def test_cidade_fora_do_estado_e_recusada(cliente):
    r = _publicar(cliente, uf="SP", cidade="Recife")
    assert r.status_code == 422
    assert "cidade" in r.get_json()["erros"]


def test_cidade_inventada_e_recusada(cliente):
    assert "cidade" in _publicar(cliente, uf="SP", cidade="eeeee").get_json()["erros"]


def test_estado_sem_cidade_pede_a_cidade(cliente):
    assert "cidade" in _publicar(cliente, uf="SP").get_json()["erros"]


def test_estado_invalido(cliente):
    assert "uf" in _publicar(cliente, uf="XX", cidade="Natal").get_json()["erros"]


def test_sem_local_usa_o_do_perfil(app, cliente):
    r = _publicar(cliente)
    assert r.status_code == 201
    with app.app_context():
        projeto = db.session.get(Projeto, r.get_json()["id"])
        assert (projeto.cidade, projeto.uf) == ("São Paulo", "SP")


def test_texto_antigo_sem_estado_continua_aceito(app, cliente):
    # Quem ainda manda só o texto (ex.: a edição pelo perfil) não quebra.
    r = _publicar(cliente, cidade="Campinas")
    assert r.status_code == 201
    with app.app_context():
        assert db.session.get(Projeto, r.get_json()["id"]).uf == "SP"  # nome único: ganha o estado


def test_projeto_novo_aparece_no_mapa(cliente):
    _publicar(cliente, uf="PI", cidade="Bom Jesus")
    cidades = cliente.get("/api/mural/mapa").get_json()["cidades"]
    assert any(c["cidade"] == "Bom Jesus" and c["uf"] == "PI" for c in cidades)


def test_coluna_uf_entra_em_banco_antigo(tmp_path):
    """Banco criado antes da coluna uf: o app acrescenta a coluna ao subir, sem apagar nada."""
    import sqlite3

    caminho = tmp_path / "antigo.db"

    class ConfigAntiga(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{caminho.as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    create_app(ConfigAntiga)
    conexao = sqlite3.connect(caminho)
    conexao.execute("ALTER TABLE projetos DROP COLUMN uf")
    conexao.commit()
    conexao.close()

    create_app(ConfigAntiga)
    colunas = [linha[1] for linha in sqlite3.connect(caminho).execute("PRAGMA table_info(projetos)")]
    assert "uf" in colunas
