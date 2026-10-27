"""Landing, login com Google e cadastro do perfil (AstrAce).

O Google em si é trocado por respostas falsas só aqui no teste: o resto do
caminho (estado, sessão, criação da usuária, perfil) roda como em produção.
"""
from io import BytesIO
from urllib.parse import parse_qs, urlparse

import pytest

from app import create_app
from app.config import Config
from app.conta import google
from app.extensoes import db
from app.usuarias.models import ContaUsuaria, Usuaria

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.fixture
def app(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste_conta.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")
        GOOGLE_CLIENT_ID = "id-de-teste"
        GOOGLE_CLIENT_SECRET = "segredo-de-teste"

    return create_app(ConfigTeste)


@pytest.fixture
def cliente(app):
    return app.test_client()


@pytest.fixture
def google_falso(monkeypatch):
    perfil = {
        "sub": "1234567890",
        "email": "ana@example.com",
        "email_verified": True,
        "name": "Ana Souza",
        "picture": "https://lh3.googleusercontent.com/foto-da-ana",
    }
    monkeypatch.setattr(google, "trocar_codigo", lambda codigo: "token")
    monkeypatch.setattr(google, "buscar_perfil", lambda token: perfil)
    return perfil


def entrar(cliente):
    """Faz a ida ao Google e a volta, como o navegador faria."""
    ida = cliente.get("/entrar/google")
    estado = parse_qs(urlparse(ida.headers["Location"]).query)["state"][0]
    return cliente.get(f"/entrar/google/retorno?code=abc&state={estado}")


PERFIL_VALIDO = {
    "apelido": "Ana",
    "data_nascimento": "2004-05-20",
    "nivel": "graduacao",
    "area_interesse": "computacao",
    "formacoes": [
        {"curso": "Ciência da Computação", "instituicao": "UFPE"},
        {"curso": "Matemática", "instituicao": "UFRPE"},
    ],
    "estado": "PE",
    "cidade": "Recife",
    "identidades": [{"valor": "mulher_negra", "publica": True}, {"valor": "lgbtqia", "publica": False}],
}


def test_sem_credenciais_o_botao_avisa(app, cliente):
    app.config["GOOGLE_CLIENT_ID"] = ""
    resposta = cliente.get("/entrar/google")
    assert resposta.headers["Location"].endswith("/?erro=nao_configurado")
    assert "ainda não está disponível" in cliente.get("/?erro=nao_configurado").get_data(as_text=True)


def test_ida_ao_google_leva_client_id_e_estado(cliente):
    resposta = cliente.get("/entrar/google")
    url = urlparse(resposta.headers["Location"])
    assert url.netloc == "accounts.google.com"
    query = parse_qs(url.query)
    assert query["client_id"] == ["id-de-teste"]
    assert query["redirect_uri"][0].endswith("/entrar/google/retorno")
    with cliente.session_transaction() as sessao:
        assert sessao["oauth_estado"] == query["state"][0]


def test_retorno_com_estado_errado_e_recusado(cliente, google_falso):
    cliente.get("/entrar/google")
    resposta = cliente.get("/entrar/google/retorno?code=abc&state=outro")
    assert resposta.headers["Location"].endswith("/?erro=estado")


def test_cancelar_no_google_volta_com_aviso(cliente):
    cliente.get("/entrar/google")
    resposta = cliente.get("/entrar/google/retorno?error=access_denied")
    assert resposta.headers["Location"].endswith("/?erro=cancelado")


def test_falha_do_google_volta_com_aviso(cliente, monkeypatch):
    def falhar(codigo):
        raise google.ErroGoogle("fora do ar")

    monkeypatch.setattr(google, "trocar_codigo", falhar)
    assert entrar(cliente).headers["Location"].endswith("/?erro=google")


def test_primeiro_acesso_vai_para_o_cadastro_e_depois_para_o_mural(app, cliente, google_falso):
    resposta = entrar(cliente)
    assert resposta.headers["Location"].endswith("/cadastro")
    assert cliente.get("/").headers["Location"].endswith("/cadastro")
    assert "Seu perfil" in cliente.get("/cadastro").get_data(as_text=True)

    perfil =cliente.get("/api/perfil").get_json()["perfil"]
    assert perfil["nome"] == "Ana Souza"
    assert perfil["foto_url"] == google_falso["picture"]
    assert perfil["cadastro_completo"] is False

    salvo = cliente.post("/api/perfil", json=PERFIL_VALIDO)
    assert salvo.status_code == 200
    assert salvo.get_json()["proximo"] == "/mural"
    assert cliente.get("/").headers["Location"].endswith("/mural")

    with app.app_context():
        ana = Usuaria.query.filter_by(email="ana@example.com").one()
        assert ana.nome_publico == "Ana"
        assert ana.nivel == "graduacao"
        assert ana.cidade == "Recife"
        assert ana.conta.estado == "PE"
        assert ana.conta.data_nascimento.isoformat() == "2004-05-20"
        # A primeira graduação também vale para o mural (instituição e curso do perfil).
        assert (ana.curso, ana.instituicao) == ("Ciência da Computação", "UFPE")
        assert len(ana.conta.formacoes) == 2
        assert {(i.identidade, i.publica) for i in ana.identidades} == {("mulher_negra", True), ("lgbtqia", False)}
        assert ana.conta.cadastro_completo


def test_quem_ja_tem_perfil_vai_direto_para_o_mural(app, cliente, google_falso):
    entrar(cliente)
    cliente.post("/api/perfil", json=PERFIL_VALIDO)
    cliente.post("/sair")
    assert cliente.get("/").status_code == 200  # saiu: volta a ver a landing

    resposta = entrar(cliente)
    assert resposta.headers["Location"].endswith("/mural")
    with app.app_context():
        assert Usuaria.query.filter_by(email="ana@example.com").count() == 1
        assert ContaUsuaria.query.count() == 1


def test_perfil_invalido_devolve_erros_por_campo(cliente, google_falso):
    entrar(cliente)
    resposta = cliente.post(
        "/api/perfil",
        json={"apelido": "A", "nivel": "x", "area_interesse": "x", "data_nascimento": "2004-02-31", "estado": "XX"},
    )
    assert resposta.status_code == 422
    assert set(resposta.get_json()["erros"]) == {"apelido", "nivel", "area_interesse", "data_nascimento", "estado"}


def test_ensino_medio_guarda_so_a_escola(app, cliente, google_falso):
    entrar(cliente)
    resposta = cliente.post(
        "/api/perfil",
        json={**PERFIL_VALIDO, "nivel": "ensino_medio", "instituicao": "EREM Ginásio Pernambucano"},
    )
    perfil = resposta.get_json()["perfil"]
    assert perfil["instituicao"] == "EREM Ginásio Pernambucano"
    assert perfil["formacoes"] == []
    with app.app_context():
        ana = Usuaria.query.filter_by(email="ana@example.com").one()
        assert ana.curso is None


def test_opcoes_trazem_estados_e_cidades_que_existem(app, cliente, google_falso):
    with app.app_context():
        app.test_cli_runner().invoke(args=["seed-mural"])
    entrar(cliente)
    opcoes = cliente.get("/api/perfil").get_json()["opcoes"]
    assert len(opcoes["estados"]) == 27
    assert "Recife" in opcoes["cidades_existentes"]


def test_banco_antigo_ganha_as_colunas_novas(tmp_path):
    """Quem já tinha contas_usuaria sem data_nascimento/estado/formacoes não precisa apagar o banco."""
    import sqlite3

    caminho = tmp_path / "antigo.db"
    with sqlite3.connect(caminho) as conexao:
        conexao.execute(
            "CREATE TABLE contas_usuaria (usuaria_id INTEGER PRIMARY KEY, google_sub VARCHAR(64), "
            "foto_url VARCHAR(500), cadastro_concluido_em DATETIME, ultimo_acesso_em DATETIME)"
        )

    class ConfigAntiga(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{caminho.as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    create_app(ConfigAntiga)
    with sqlite3.connect(caminho) as conexao:
        colunas = {linha[1] for linha in conexao.execute("PRAGMA table_info(contas_usuaria)")}
    assert {"data_nascimento", "estado", "formacoes"} <= colunas


def test_foto_enviada_vira_foto_do_perfil(cliente, google_falso):
    entrar(cliente)
    envio = cliente.post(
        "/api/uploads",
        data={"arquivo": (BytesIO(PNG), "eu.png"), "finalidade": "foto"},
        content_type="multipart/form-data",
    )
    assert envio.status_code == 201
    foto = envio.get_json()

    salvo = cliente.post("/api/perfil", json={**PERFIL_VALIDO, "foto_id": foto["id"]})
    assert salvo.get_json()["perfil"]["foto_url"] == foto["url"]

    removida = cliente.post("/api/perfil", json={**PERFIL_VALIDO, "remover_foto": True})
    assert removida.get_json()["perfil"]["foto_url"] is None


def test_foto_de_outra_pessoa_e_recusada(app, cliente, google_falso):
    entrar(cliente)
    with app.app_context():
        from app.uploads.models import Arquivo

        outra = Usuaria(nome="Outra", email="outra@example.com")
        db.session.add(outra)
        db.session.flush()
        arquivo = Arquivo(usuaria_id=outra.id, finalidade="foto", nome_original="x.png",
                          nome_salvo="x.png", tipo="imagem", tamanho=10)
        db.session.add(arquivo)
        db.session.commit()
        arquivo_id = arquivo.id

    resposta = cliente.post("/api/perfil", json={**PERFIL_VALIDO, "foto_id": arquivo_id})
    assert resposta.status_code == 422
    assert "foto" in resposta.get_json()["erros"]


def test_cadastro_e_perfil_exigem_login(cliente):
    assert cliente.get("/cadastro").headers["Location"].endswith("/")
    assert cliente.get("/api/perfil").status_code == 401
    assert cliente.post("/api/perfil", json=PERFIL_VALIDO).status_code == 401


def test_conta_google_entra_na_usuaria_que_ja_tinha_o_email(app, cliente, google_falso):
    with app.app_context():
        db.session.add(Usuaria(nome="Ana do seed", email="Ana@Example.com"))
        db.session.commit()
    entrar(cliente)
    with app.app_context():
        assert Usuaria.query.count() == 1
        assert Usuaria.query.one().conta.google_sub == "1234567890"


def test_data_de_nascimento_fora_do_intervalo_e_recusada(cliente, google_falso):
    entrar(cliente)
    for data in ("2099-01-01", "1900-01-01"):
        resposta = cliente.post("/api/perfil", json={**PERFIL_VALIDO, "data_nascimento": data})
        assert resposta.status_code == 422
        assert "data_nascimento" in resposta.get_json()["erros"]


def test_data_de_nascimento_recente_e_aceita(cliente, google_falso):
    entrar(cliente)
    resposta = cliente.post("/api/perfil", json={**PERFIL_VALIDO, "data_nascimento": "2020-01-15"})
    assert resposta.status_code == 200
    assert resposta.get_json()["perfil"]["data_nascimento"] == "2020-01-15"
