"""Passaporte: página, carimbo de boas-vindas concedido uma vez e animação que não se repete."""
import json
import re
from urllib.parse import parse_qs, urlparse

import pytest

from app import create_app
from app.config import Config
from app.conta import google
from app.extensoes import db
from app.passaporte.models import Carimbo
from app.usuarias.models import ContaUsuaria, Usuaria

PERFIL = {"apelido": "Ana", "nivel": "graduacao", "area_interesse": "fisica", "estado": "PE", "cidade": "Recife"}


@pytest.fixture
def app(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste_passaporte.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")
        GOOGLE_CLIENT_ID = "id-de-teste"
        GOOGLE_CLIENT_SECRET = "segredo-de-teste"

    return create_app(ConfigTeste)


@pytest.fixture
def entrar(app, monkeypatch):
    """Entra com uma conta Google falsa (mesma conta a cada chamada) e devolve o navegador."""
    perfil = {"sub": "sub-ana", "email": "ana@example.com", "email_verified": True, "name": "Ana Souza"}
    monkeypatch.setattr(google, "trocar_codigo", lambda codigo: "token")
    monkeypatch.setattr(google, "buscar_perfil", lambda token: perfil)

    def _entrar(completar=True):
        cliente = app.test_client()
        ida = cliente.get("/entrar/google")
        estado = parse_qs(urlparse(ida.headers["Location"]).query)["state"][0]
        cliente.get(f"/entrar/google/retorno?code=abc&state={estado}")
        if completar:
            assert cliente.post("/api/perfil", json=PERFIL).status_code == 200
        return cliente

    return _entrar


def dados_da_pagina(cliente):
    pagina = cliente.get("/passaporte").get_data(as_text=True)
    bruto = re.search(r'<script type="application/json" id="passaporte-dados">(.*?)</script>', pagina, re.S).group(1)
    return json.loads(bruto)


def test_passaporte_exige_login_e_cadastro(app, entrar):
    assert app.test_client().get("/passaporte").headers["Location"].endswith("/")
    incompleta = entrar(completar=False)
    assert incompleta.get("/passaporte").headers["Location"].endswith("/cadastro")


def test_primeiro_login_da_o_carimbo_de_boas_vindas(app, entrar):
    entrar()
    with app.app_context():
        carimbos = Carimbo.query.all()
        assert [(c.codigo, c.visto_em) for c in carimbos] == [("boas-vindas", None)]


def test_carimbo_e_dado_uma_vez_so(app, entrar):
    entrar()
    entrar()
    cliente = entrar()
    dados_da_pagina(cliente)
    with app.app_context():
        assert Carimbo.query.filter_by(codigo="boas-vindas").count() == 1


def test_animacao_passa_uma_vez_e_fica_salva(entrar):
    cliente = entrar()
    dados = dados_da_pagina(cliente)
    assert dados["nome"] == "Ana"
    assert dados["carimbos"][0]["visto"] is False  # a página vai tocar a animação

    resposta = cliente.post("/api/passaporte/carimbos/boas-vindas/visto")
    assert resposta.status_code == 200 and resposta.get_json()["visto"] is True
    assert cliente.post("/api/passaporte/carimbos/boas-vindas/visto").status_code == 200  # repetir não muda nada

    # Em outro "dispositivo" (outro login), o carimbo já vem impresso e a animação não volta.
    outro = entrar()
    assert dados_da_pagina(outro)["carimbos"][0]["visto"] is True


def test_quem_ja_tinha_conta_ganha_o_carimbo_ao_abrir(app, entrar):
    cliente = entrar()
    with app.app_context():
        Carimbo.query.delete()  # como uma conta de antes do passaporte
        db.session.commit()
    assert dados_da_pagina(cliente)["carimbos"][0]["codigo"] == "boas-vindas"


def test_marcar_visto_exige_login_e_carimbo_existente(app, entrar):
    assert app.test_client().post("/api/passaporte/carimbos/boas-vindas/visto").status_code == 401
    cliente = entrar()
    assert cliente.post("/api/passaporte/carimbos/nao-existe/visto").status_code == 404


def test_visto_de_uma_usuaria_nao_afeta_outra(app, entrar):
    cliente = entrar()
    with app.app_context():
        bia = Usuaria(nome="Bia", email="bia@example.com")
        db.session.add(bia)
        db.session.flush()
        db.session.add(ContaUsuaria(usuaria_id=bia.id))
        db.session.add(Carimbo(usuaria_id=bia.id, codigo="boas-vindas", titulo="Bem-vinda ao AstrAce"))
        db.session.commit()
        bia_id = bia.id
    cliente.post("/api/passaporte/carimbos/boas-vindas/visto")
    with app.app_context():
        assert Carimbo.query.filter_by(usuaria_id=bia_id).one().visto_em is None
