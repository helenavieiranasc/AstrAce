"""Carta para o futuro: primeiro acesso, estados, prazo, sigilo da mensagem e autorização."""
from datetime import datetime, timedelta

import pytest

from app import create_app
from app.carta import servico
from app.carta.models import ABERTA, ADIADA, EM_CRIACAO, ENVIADA, CartaFuturo
from app.config import Config
from app.extensoes import db
from app.usuarias.models import ContaUsuaria, Usuaria

MENSAGEM = "Oi, eu do futuro. Espero que você tenha encontrado o seu telescópio."
COMPLETA = {"nome": "Ana", "area": "fisica", "mensagem": MENSAGEM, "objetivos": "Ver Saturno de perto.", "anos": 3}
HOJE = datetime(2026, 10, 28, 15, 30)


@pytest.fixture
def app(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    return create_app(ConfigTeste)


@pytest.fixture
def relogio(monkeypatch):
    """O relógio do servidor, que o teste move à vontade."""
    tempo = {"agora": HOJE}
    monkeypatch.setattr(servico, "agora", lambda: tempo["agora"])
    return tempo


def criar_usuaria(app, email, nome="Ana"):
    with app.app_context():
        u = Usuaria(nome=nome, email=email, cidade="Recife", area_interesse="fisica")
        db.session.add(u)
        db.session.flush()
        db.session.add(ContaUsuaria(usuaria_id=u.id, estado="PE", cadastro_concluido_em=datetime.utcnow()))
        db.session.commit()
        return u.id


def logar_como(cliente, usuaria_id):
    with cliente.session_transaction() as sessao:
        sessao["usuaria_id"] = usuaria_id


@pytest.fixture
def ana(app, relogio):
    uid = criar_usuaria(app, "ana@teste.local")
    cliente = app.test_client()
    logar_como(cliente, uid)
    return cliente, uid


def no_banco(app, uid):
    with app.app_context():
        c = db.session.get(CartaFuturo, uid)
        return None if c is None else (c.estado, c.mensagem, c.anos, c.revela_em)


def enviar(cliente, **extra):
    return cliente.post("/api/carta/enviar", json={**COMPLETA, "confirmar": True, **extra})


# ---------- Primeiro acesso ----------


def test_primeiro_acesso_leva_ao_convite(ana):
    cliente, _ = ana
    resposta = cliente.get("/")
    assert resposta.headers["Location"].endswith("/carta/convite")
    pagina = cliente.get("/carta/convite").get_data(as_text=True)
    assert "Não quero criar agora" in pagina


def test_nao_quero_agora_nao_volta_sozinho(app, ana):
    cliente, uid = ana
    assert cliente.post("/carta/adiar").headers["Location"].endswith("/")
    assert no_banco(app, uid)[0] == ADIADA
    assert cliente.get("/").status_code == 200
    assert cliente.get("/").status_code == 200


def test_pular_nao_impede_de_criar_depois(app, ana):
    cliente, uid = ana
    cliente.post("/carta/adiar")
    assert cliente.put("/api/carta", json={"nome": "Ana"}).status_code == 200
    assert no_banco(app, uid)[0] == EM_CRIACAO


def test_paginas_pedem_login(app):
    cliente = app.test_client()
    for caminho in ("/carta/convite", "/carta/escrever", "/carta/abrir"):
        assert cliente.get(caminho).headers["Location"].endswith("/")


# ---------- Rascunho ----------


def test_rascunho_fica_salvo_entre_sessoes(app, ana):
    cliente, uid = ana
    r = cliente.put("/api/carta", json={"nome": "Ana", "mensagem": "Ainda escrevendo", "anos": 5})
    assert r.get_json()["situacao"] == "em_criacao"
    outra = app.test_client()
    logar_como(outra, uid)
    dados = outra.get("/api/carta").get_json()
    assert dados["carta"]["mensagem"] == "Ainda escrevendo" and dados["carta"]["anos"] == 5


@pytest.mark.parametrize("dados", [
    {"area": "inventada"}, {"anos": 4}, {"anos": "3"}, {"anos": True}, {"mensagem": "x" * 2501}, {"objetivos": "x" * 601},
])
def test_rascunho_recusa_valores_invalidos(app, ana, dados):
    cliente, uid = ana
    assert cliente.put("/api/carta", json=dados).status_code == 422
    assert no_banco(app, uid) is None


# ---------- Envio ----------


def test_envio_exige_confirmacao_explicita(app, ana):
    cliente, uid = ana
    assert cliente.post("/api/carta/enviar", json=COMPLETA).status_code == 422
    assert cliente.post("/api/carta/enviar", json={**COMPLETA, "confirmar": "sim"}).status_code == 422
    assert no_banco(app, uid) is None


def test_envio_incompleto_mostra_o_que_falta(app, ana):
    cliente, uid = ana
    r = cliente.post("/api/carta/enviar", json={"nome": "Ana", "confirmar": True})
    assert r.status_code == 422
    assert {"area", "mensagem", "anos"} <= set(r.get_json()["erros"])
    r = cliente.post("/api/carta/enviar", json={**COMPLETA, "mensagem": "curta", "confirmar": True})
    assert "mensagem" in r.get_json()["erros"]
    assert no_banco(app, uid) is None


def test_envio_calcula_a_data_no_servidor(app, ana, relogio):
    cliente, uid = ana
    # O navegador tenta impor a própria data: o servidor ignora.
    r = enviar(cliente, revela_em="2020-01-01T00:00:00", enviada_em="2020-01-01T00:00:00")
    assert r.status_code == 200
    corpo = r.get_json()
    assert corpo["situacao"] == "aguardando"
    assert corpo["carta"]["revela_em"] == datetime(2029, 10, 28, 15, 30).isoformat()
    assert corpo["carta"]["enviada_em"] == HOJE.isoformat()
    assert no_banco(app, uid)[0] == ENVIADA


def test_prazo_em_29_de_fevereiro():
    assert servico.somar_anos(datetime(2024, 2, 29, 10), 1) == datetime(2025, 2, 28, 10)
    assert servico.somar_anos(datetime(2024, 2, 29, 10), 4) == datetime(2028, 2, 29, 10)


def test_nao_envia_duas_vezes(app, ana, relogio):
    cliente, uid = ana
    primeira = enviar(cliente).get_json()["carta"]["revela_em"]
    relogio["agora"] = HOJE + timedelta(days=1)
    segunda = enviar(cliente, anos=10, mensagem="Outra mensagem bem maior que a primeira, para o teste.")
    assert segunda.status_code == 409
    assert no_banco(app, uid)[1] == MENSAGEM  # nada foi trocado
    assert no_banco(app, uid)[3].isoformat() == primeira


def test_depois_de_enviada_nao_se_edita(app, ana):
    cliente, uid = ana
    enviar(cliente)
    assert cliente.put("/api/carta", json={"mensagem": "Mudei de ideia sobre tudo isto aqui."}).status_code == 409
    assert no_banco(app, uid)[1] == MENSAGEM


# ---------- Sigilo até a data ----------


def test_mensagem_nao_aparece_enquanto_aguarda(app, ana):
    cliente, _ = ana
    resposta = enviar(cliente)
    for texto in (resposta.get_data(as_text=True), cliente.get("/api/carta").get_data(as_text=True)):
        assert MENSAGEM not in texto and "Saturno" not in texto
    # E nenhuma página renderizada no servidor carrega o conteúdo.
    for caminho in ("/perfil", "/carta/abrir", "/carta/escrever"):
        assert MENSAGEM not in cliente.get(caminho).get_data(as_text=True)


def test_nao_abre_antes_da_data(app, ana, relogio):
    cliente, uid = ana
    enviar(cliente)
    relogio["agora"] = datetime(2029, 10, 28, 15, 29)  # um minuto antes
    r = cliente.post("/api/carta/abrir")
    assert r.status_code == 403
    assert MENSAGEM not in r.get_data(as_text=True)
    assert no_banco(app, uid)[0] == ENVIADA
    assert cliente.get("/api/carta").get_json()["situacao"] == "aguardando"


def test_abre_quando_a_data_chega_e_continua_legivel(app, ana, relogio):
    cliente, uid = ana
    enviar(cliente)
    relogio["agora"] = datetime(2029, 10, 28, 15, 30)  # no instante exato
    assert cliente.get("/api/carta").get_json()["situacao"] == "disponivel"
    assert MENSAGEM not in cliente.get("/api/carta").get_data(as_text=True)  # disponível ainda não revela
    r = cliente.post("/api/carta/abrir")
    assert r.status_code == 200
    assert r.get_json()["carta"]["mensagem"] == MENSAGEM
    assert no_banco(app, uid)[0] == ABERTA
    assert cliente.get("/api/carta").get_json()["carta"]["mensagem"] == MENSAGEM
    assert cliente.post("/api/carta/abrir").status_code == 200  # reler é permitido


def test_abrir_sem_carta_enviada(app, ana):
    cliente, _ = ana
    assert cliente.post("/api/carta/abrir").status_code == 404
    cliente.put("/api/carta", json={"nome": "Ana", "mensagem": MENSAGEM})
    assert cliente.post("/api/carta/abrir").status_code == 404


# ---------- Autorização e persistência ----------


def test_sem_login_nao_le_nem_grava(app):
    cliente = app.test_client()
    assert cliente.get("/api/carta").status_code == 401
    assert cliente.put("/api/carta", json=COMPLETA).status_code == 401
    assert cliente.post("/api/carta/enviar", json={**COMPLETA, "confirmar": True}).status_code == 401
    assert cliente.post("/api/carta/abrir").status_code == 401


def test_uma_pessoa_nunca_ve_nem_abre_a_carta_de_outra(app, relogio):
    ana_id = criar_usuaria(app, "ana@teste.local", nome="Ana")
    bia_id = criar_usuaria(app, "bia@teste.local", nome="Bia")
    ana_cli, bia_cli = app.test_client(), app.test_client()
    logar_como(ana_cli, ana_id)
    logar_como(bia_cli, bia_id)
    enviar(ana_cli)
    relogio["agora"] = datetime(2040, 1, 1)  # muito depois: a carta de Ana está disponível
    ana_cli.post("/api/carta/abrir")

    assert bia_cli.get("/api/carta").get_json()["carta"] is None
    assert bia_cli.post("/api/carta/abrir").status_code == 404
    assert MENSAGEM not in bia_cli.get("/api/carta").get_data(as_text=True)
    assert bia_cli.get(f"/api/carta/{ana_id}").status_code == 404


def test_carta_enviada_sobrevive_a_logout_e_novo_login(app, ana):
    cliente, uid = ana
    enviar(cliente)
    nova = app.test_client()
    logar_como(nova, uid)
    dados = nova.get("/api/carta").get_json()
    assert dados["situacao"] == "aguardando"
    assert dados["carta"]["anos"] == 3


def test_falha_de_validacao_nao_confirma_nada(app, ana):
    cliente, uid = ana
    r = enviar(cliente, anos=7)
    assert r.status_code == 422
    assert no_banco(app, uid) is None


def test_perfil_tem_o_bloco_da_carta(ana):
    cliente, _ = ana
    pagina = cliente.get("/perfil").get_data(as_text=True)
    assert 'id="carta-perfil"' in pagina and "carta.js" in pagina
