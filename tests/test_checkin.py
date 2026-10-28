"""Check-in por QR: /checkin/<token> confere o evento, a hora e dá o carimbo no passaporte."""
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest

from app import create_app
from app.config import Config
from app.conta import google
from app.eventos.models import Evento
from app.extensoes import db
from app.passaporte.models import Carimbo

PERFIL = {"apelido": "Ana", "nivel": "graduacao", "area_interesse": "fisica", "estado": "PE", "cidade": "Recife"}


@pytest.fixture
def app(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste_checkin.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")
        GOOGLE_CLIENT_ID = "id-de-teste"
        GOOGLE_CLIENT_SECRET = "segredo-de-teste"

    return create_app(ConfigTeste)


@pytest.fixture
def logar(monkeypatch):
    """Faz o login com Google (conta falsa) no navegador que receber."""
    perfil = {"sub": "sub-ana", "email": "ana@example.com", "email_verified": True, "name": "Ana Souza"}
    monkeypatch.setattr(google, "trocar_codigo", lambda codigo: "token")
    monkeypatch.setattr(google, "buscar_perfil", lambda token: perfil)

    def _logar(cliente, completar=True):
        ida = cliente.get("/entrar/google")
        estado = parse_qs(urlparse(ida.headers["Location"]).query)["state"][0]
        retorno = cliente.get(f"/entrar/google/retorno?code=abc&state={estado}")
        if completar:
            assert cliente.post("/api/perfil", json=PERFIL).status_code == 200
        return retorno

    return _logar


@pytest.fixture
def criar_evento(app):
    def _criar(inicio, fim=None, token="token-do-qr", oculto=False):
        with app.app_context():
            evento = Evento(
                titulo="Oficina de robótica",
                descricao="Mão na massa com Arduino.",
                inicio=inicio,
                fim=fim,
                link="https://example.com/oficina",
                token_qr=token,
                oculto=oculto,
            )
            db.session.add(evento)
            db.session.commit()
            return evento.id

    return _criar


def carimbos(app):
    with app.app_context():
        return [(c.codigo, c.titulo) for c in Carimbo.query.filter(Carimbo.codigo.like("evento-%"))]


def agora():
    return datetime.now().replace(second=0, microsecond=0)


def test_token_que_nao_existe_mostra_aviso(app):
    resposta = app.test_client().get("/checkin/nao-existe")
    assert resposta.status_code == 404
    assert "QR code não encontrado" in resposta.get_data(as_text=True)


def test_evento_oculto_nao_carimba(app, logar, criar_evento):
    criar_evento(agora() - timedelta(hours=1), oculto=True)
    cliente = app.test_client()
    logar(cliente)
    assert cliente.get("/checkin/token-do-qr").status_code == 404
    assert carimbos(app) == []


def test_durante_o_evento_carimba_uma_vez(app, logar, criar_evento):
    evento_id = criar_evento(agora() - timedelta(hours=1), agora() + timedelta(hours=1))
    cliente = app.test_client()
    logar(cliente)

    primeira = cliente.get("/checkin/token-do-qr").get_data(as_text=True)
    assert "Carimbo recebido!" in primeira
    assert carimbos(app) == [(f"evento-{evento_id}", "Oficina de robótica")]

    segunda = cliente.get("/checkin/token-do-qr").get_data(as_text=True)
    assert "Você já tem este carimbo" in segunda
    assert len(carimbos(app)) == 1


def test_antes_do_evento_ainda_nao_abriu(app, logar, criar_evento):
    criar_evento(agora() + timedelta(hours=2))
    cliente = app.test_client()
    logar(cliente)
    assert "O check-in ainda não abriu" in cliente.get("/checkin/token-do-qr").get_data(as_text=True)
    assert carimbos(app) == []


@pytest.mark.parametrize(
    "horas_desde_o_fim, carimba",
    [(11, True), (13, False)],
)
def test_vale_ate_12_horas_depois_do_fim(app, logar, criar_evento, horas_desde_o_fim, carimba):
    fim = agora() - timedelta(hours=horas_desde_o_fim)
    criar_evento(fim - timedelta(hours=3), fim)
    cliente = app.test_client()
    logar(cliente)
    pagina = cliente.get("/checkin/token-do-qr").get_data(as_text=True)
    assert ("Carimbo recebido!" in pagina) is carimba
    assert ("O check-in deste evento fechou" in pagina) is not carimba
    assert len(carimbos(app)) == (1 if carimba else 0)


def test_sem_hora_de_fim_conta_a_partir_do_inicio(app, logar, criar_evento):
    criar_evento(agora() - timedelta(hours=13))
    cliente = app.test_client()
    logar(cliente)
    assert "O check-in deste evento fechou" in cliente.get("/checkin/token-do-qr").get_data(as_text=True)


def test_quem_escaneia_sem_conta_volta_ao_checkin_depois_do_cadastro(app, logar, criar_evento):
    criar_evento(agora() - timedelta(hours=1), agora() + timedelta(hours=1))
    cliente = app.test_client()

    pagina = cliente.get("/checkin/token-do-qr")
    assert pagina.status_code == 200
    assert "Entre para ganhar o carimbo" in pagina.get_data(as_text=True)
    assert carimbos(app) == []

    # Conta nova: o login leva ao cadastro, e o fim do cadastro volta para a página inicial.
    retorno = logar(cliente, completar=False)
    assert retorno.headers["Location"].endswith("/cadastro")
    assert cliente.post("/api/perfil", json=PERFIL).get_json()["proximo"] == "/"

    inicio = cliente.get("/")
    assert inicio.headers["Location"].endswith("/checkin/token-do-qr")
    assert "Carimbo recebido!" in cliente.get("/checkin/token-do-qr").get_data(as_text=True)
    assert len(carimbos(app)) == 1

    # O pedido pendente foi usado: a página inicial volta ao normal.
    assert cliente.get("/").status_code == 200


def test_cadastro_incompleto_vai_para_o_cadastro(app, logar, criar_evento):
    criar_evento(agora() - timedelta(hours=1))
    cliente = app.test_client()
    logar(cliente, completar=False)
    assert cliente.get("/checkin/token-do-qr").headers["Location"].endswith("/cadastro")
    assert carimbos(app) == []


def test_carimbo_do_evento_aparece_nos_dados_do_passaporte(app, logar, criar_evento):
    evento_id = criar_evento(agora() - timedelta(hours=1))
    cliente = app.test_client()
    logar(cliente)
    cliente.get("/checkin/token-do-qr")
    pagina = cliente.get("/passaporte").get_data(as_text=True)
    assert f'"codigo": "evento-{evento_id}"' in pagina or f'"codigo":"evento-{evento_id}"' in pagina
