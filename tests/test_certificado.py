"""Certificados: quem fez check-in recebe, depois do fim do evento, um certificado com código verificável."""
import re
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest

from app import create_app
from app.config import Config
from app.conta import google
from app.eventos.models import Evento
from app.extensoes import db
from app.passaporte import certificados
from app.passaporte.models import Certificado

PERFIL = {"apelido": "Ana", "nivel": "graduacao", "area_interesse": "fisica", "estado": "PE", "cidade": "Recife"}


@pytest.fixture
def app(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste_certificado.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")
        GOOGLE_CLIENT_ID = "id-de-teste"
        GOOGLE_CLIENT_SECRET = "segredo-de-teste"

    return create_app(ConfigTeste)


@pytest.fixture
def entrar(app, monkeypatch):
    """Entra com uma conta Google falsa e devolve o navegador, já com o cadastro completo."""
    def _entrar(sub="sub-ana", nome="Ana Souza"):
        perfil = {"sub": sub, "email": f"{sub}@example.com", "email_verified": True, "name": nome}
        monkeypatch.setattr(google, "trocar_codigo", lambda codigo: "token")
        monkeypatch.setattr(google, "buscar_perfil", lambda token: perfil)
        cliente = app.test_client()
        ida = cliente.get("/entrar/google")
        estado = parse_qs(urlparse(ida.headers["Location"]).query)["state"][0]
        cliente.get(f"/entrar/google/retorno?code=abc&state={estado}")
        assert cliente.post("/api/perfil", json=PERFIL).status_code == 200
        return cliente

    return _entrar


def agora():
    return datetime.now().replace(second=0, microsecond=0)


@pytest.fixture
def criar_evento(app):
    """Por padrão, um evento que acabou há 1 hora: o check-in ainda vale e o certificado já sai."""
    def _criar(inicio=None, fim=None, **extra):
        inicio = inicio or agora() - timedelta(hours=4)
        fim = fim or agora() - timedelta(hours=1)
        with app.app_context():
            evento = Evento(
                titulo="Oficina de robótica",
                descricao="Mão na massa com Arduino.",
                organizacao="Clube Elas na Robótica",
                inicio=inicio,
                fim=fim,
                cidade="Recife",
                uf="PE",
                link="https://example.com/oficina",
                **{"token_qr": "token-do-qr", "carga_horaria_min": 180, **extra},
            )
            db.session.add(evento)
            db.session.commit()
            return evento.id

    return _criar


def emitir(cliente, evento_id, nome="Ana Clara Souza"):
    return cliente.post(f"/api/certificados/evento/{evento_id}", json={"nome": nome})


def test_fluxo_completo_do_checkin_a_verificacao(app, entrar, criar_evento):
    evento_id = criar_evento()
    cliente = entrar()
    checkin = cliente.get("/checkin/token-do-qr").get_data(as_text=True)
    assert "Carimbo recebido!" in checkin
    assert f"/certificados/evento/{evento_id}" in checkin  # o evento já acabou: o botão vai direto

    passaporte = cliente.get("/passaporte").get_data(as_text=True)
    assert "Meus certificados" in passaporte and "Emitir certificado" in passaporte

    confirmar = cliente.get(f"/certificados/evento/{evento_id}").get_data(as_text=True)
    assert 'value="Ana Souza"' in confirmar  # nome do Google, para conferir

    resposta = emitir(cliente, evento_id)
    assert resposta.status_code == 201
    url = resposta.get_json()["url"]
    codigo = url.rsplit("/", 1)[1]
    assert re.fullmatch(r"[0-9A-Z]{5}-[0-9A-Z]{5}", codigo)

    pagina = cliente.get(url).get_data(as_text=True)
    for trecho in ("Ana Clara Souza", "Oficina de robótica", "Clube Elas na Robótica", "Recife (PE)", "3 horas", codigo, "<svg"):
        assert trecho in pagina, trecho
    assert "linkedin.com/profile/add" in pagina

    # Emitir de novo devolve o mesmo, e a página de emitir passa a levar direto ao certificado.
    assert emitir(cliente, evento_id, nome="Outro Nome").get_json()["url"] == url
    assert cliente.get(f"/certificados/evento/{evento_id}").headers["Location"].endswith(url)
    assert "Ver certificado" in cliente.get("/passaporte").get_data(as_text=True)

    # Qualquer pessoa confere, sem login.
    verificacao = app.test_client().get(f"/verificar/{codigo}")
    assert verificacao.status_code == 200
    texto = verificacao.get_data(as_text=True)
    assert "Certificado verdadeiro" in texto and "Ana Clara Souza" in texto
    assert "example.com" not in texto  # nada de e-mail


def test_antes_do_fim_do_evento_ainda_nao_emite(app, entrar, criar_evento):
    evento_id = criar_evento(agora() - timedelta(hours=1), agora() + timedelta(hours=2))
    cliente = entrar()
    checkin = cliente.get("/checkin/token-do-qr").get_data(as_text=True)
    assert "Quando o evento terminar" in checkin

    assert "Quase lá!" in cliente.get(f"/certificados/evento/{evento_id}").get_data(as_text=True)
    assert "Fica pronto em" in cliente.get("/passaporte").get_data(as_text=True)
    assert emitir(cliente, evento_id).status_code == 409
    with app.app_context():
        assert Certificado.query.count() == 0


def test_sem_checkin_nao_tem_certificado(app, entrar, criar_evento):
    evento_id = criar_evento()
    cliente = entrar()
    assert cliente.get(f"/certificados/evento/{evento_id}").status_code == 404
    assert emitir(cliente, evento_id).status_code == 403
    assert "Meus certificados" in cliente.get("/passaporte").get_data(as_text=True)


def test_nome_vazio_ou_sem_letras_e_recusado(entrar, criar_evento):
    evento_id = criar_evento()
    cliente = entrar()
    cliente.get("/checkin/token-do-qr")
    for nome in ("", "  ", "12345"):
        resposta = emitir(cliente, evento_id, nome=nome)
        assert resposta.status_code == 422
        assert "nome" in resposta.get_json()["erros"]


def test_emitir_exige_login_e_json(app, entrar, criar_evento):
    evento_id = criar_evento()
    assert emitir(app.test_client(), evento_id).status_code == 401
    cliente = entrar()
    cliente.get("/checkin/token-do-qr")
    resposta = cliente.post(f"/api/certificados/evento/{evento_id}", data={"nome": "Ana Souza"})
    assert resposta.status_code == 415


def test_so_a_dona_ve_a_pagina_do_certificado(app, entrar, criar_evento):
    evento_id = criar_evento()
    ana = entrar()
    ana.get("/checkin/token-do-qr")
    url = emitir(ana, evento_id).get_json()["url"]
    codigo = url.rsplit("/", 1)[1]

    for outra in (app.test_client(), entrar(sub="sub-bia", nome="Bia Lima")):
        resposta = outra.get(url)
        assert resposta.status_code == 302
        assert resposta.headers["Location"].endswith(f"/verificar/{codigo}")


def test_certificado_guarda_os_dados_do_dia_da_emissao(app, entrar, criar_evento):
    evento_id = criar_evento()
    cliente = entrar()
    cliente.get("/checkin/token-do-qr")
    codigo = emitir(cliente, evento_id).get_json()["url"].rsplit("/", 1)[1]

    with app.app_context():
        evento = db.session.get(Evento, evento_id)
        evento.titulo = "Título trocado depois"
        evento.carga_horaria_min = None
        db.session.commit()

    texto = app.test_client().get(f"/verificar/{codigo}").get_data(as_text=True)
    assert "Oficina de robótica" in texto and "3 horas" in texto
    assert "Título trocado depois" not in texto


def test_evento_online_e_sem_carga_horaria(entrar, criar_evento):
    # Começo e fim no mesmo dia, seja qual for a hora do teste (o CI roda em UTC, até de madrugada).
    fim = agora() - timedelta(hours=1)
    inicio = max(fim - timedelta(hours=3), fim.replace(hour=0, minute=0))
    evento_id = criar_evento(inicio, fim, modalidade="online", carga_horaria_min=None)
    cliente = entrar()
    cliente.get("/checkin/token-do-qr")
    pagina = cliente.get(emitir(cliente, evento_id).get_json()["url"]).get_data(as_text=True)
    assert "realizado on-line em" in pagina
    assert "carga horária" not in pagina


def test_evento_de_varios_dias_diz_de_um_dia_a_outro(entrar, criar_evento):
    evento_id = criar_evento(agora() - timedelta(days=2), agora() - timedelta(hours=1))
    cliente = entrar()
    cliente.get("/checkin/token-do-qr")
    pagina = cliente.get(emitir(cliente, evento_id).get_json()["url"]).get_data(as_text=True)
    assert "realizado de " in pagina


def test_verificar_aceita_o_codigo_digitado_de_qualquer_jeito(app, entrar, criar_evento):
    evento_id = criar_evento()
    cliente = entrar()
    cliente.get("/checkin/token-do-qr")
    codigo = emitir(cliente, evento_id).get_json()["url"].rsplit("/", 1)[1]

    publico = app.test_client()
    assert "Verificar certificado" in publico.get("/verificar").get_data(as_text=True)
    digitado = codigo.lower().replace("-", " ")
    assert publico.get(f"/verificar?codigo={digitado}").headers["Location"].endswith(f"/verificar/{codigo}")
    assert publico.get(f"/verificar/{codigo.replace('-', '').lower()}").status_code == 200

    assert publico.get("/verificar?codigo=abc").status_code == 400
    nao_existe = publico.get("/verificar/ZZZZZ-ZZZZZ")
    assert nao_existe.status_code == 404
    assert "Certificado não encontrado" in nao_existe.get_data(as_text=True)


def test_nome_sugerido_e_o_do_ultimo_certificado(app, entrar, criar_evento):
    primeiro = criar_evento()
    cliente = entrar()
    cliente.get("/checkin/token-do-qr")
    emitir(cliente, primeiro, nome="Ana Clara Souza")

    with app.app_context():
        segundo = Evento(
            titulo="Palestra de astronomia",
            descricao="Conversa sobre exoplanetas.",
            inicio=agora() - timedelta(hours=3),
            fim=agora() - timedelta(hours=2),
            link="https://example.com/palestra",
            token_qr="outro-qr",
        )
        db.session.add(segundo)
        db.session.commit()
        segundo_id = segundo.id
    cliente.get("/checkin/outro-qr")
    assert 'value="Ana Clara Souza"' in cliente.get(f"/certificados/evento/{segundo_id}").get_data(as_text=True)


@pytest.mark.parametrize(
    "inicio, fim, esperado",
    [
        (datetime(2026, 10, 31, 14), datetime(2026, 10, 31, 17), "31 de outubro de 2026"),
        (datetime(2026, 10, 1, 14), None, "1º de outubro de 2026"),
        (datetime(2026, 9, 18, 9), datetime(2026, 9, 20, 18), "18 a 20 de setembro de 2026"),
        (datetime(2026, 9, 30, 9), datetime(2026, 10, 2, 18), "30 de setembro a 2 de outubro de 2026"),
        (datetime(2026, 12, 30, 9), datetime(2027, 1, 2, 18), "30 de dezembro de 2026 a 2 de janeiro de 2027"),
    ],
)
def test_data_por_extenso(inicio, fim, esperado):
    assert certificados.data_por_extenso(inicio, fim) == esperado


@pytest.mark.parametrize(
    "minutos, esperado",
    [(None, None), (30, "30 minutos"), (60, "1 hora"), (90, "1h30"), (540, "9 horas")],
)
def test_carga_por_extenso(minutos, esperado):
    assert certificados.carga_por_extenso(minutos) == esperado


def test_codigo_novo_e_normalizado():
    codigo = certificados.novo_codigo()
    assert certificados.normalizar_codigo(codigo) == codigo
    assert certificados.normalizar_codigo(" 7kq3m xp9td ") == "7KQ3M-XP9TD"
    assert certificados.normalizar_codigo("curto") is None
