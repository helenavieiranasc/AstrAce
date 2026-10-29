"""Quem é admin: o atalho LOGIN_DEV fora do debug e a lista ADMIN_EMAILS do .env."""
from urllib.parse import parse_qs, urlparse

import pytest

from app import create_app
from app.config import Config
from app.conta import google
from app.extensoes import db
from app.usuarias.models import Usuaria


def _app(tmp_path, **config):
    class ConfigTeste(Config):
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste_acesso.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")
        GOOGLE_CLIENT_ID = "id-de-teste"
        GOOGLE_CLIENT_SECRET = "segredo-de-teste"

    for chave, valor in config.items():
        setattr(ConfigTeste, chave, valor)
    return create_app(ConfigTeste)


def _entrar(app, monkeypatch, email):
    perfil = {"sub": f"sub-{email}", "email": email, "email_verified": True, "name": "Pessoa da Equipe"}
    monkeypatch.setattr(google, "trocar_codigo", lambda codigo: "token")
    monkeypatch.setattr(google, "buscar_perfil", lambda token: perfil)
    cliente = app.test_client()
    estado = parse_qs(urlparse(cliente.get("/entrar/google").headers["Location"]).query)["state"][0]
    cliente.get(f"/entrar/google/retorno?code=abc&state={estado}")
    return cliente


@pytest.mark.parametrize(
    "metodo, rota",
    [
        ("post", "/api/vagas"),
        ("put", "/api/vagas/1"),
        ("post", "/api/vagas/1/ocultar"),
        ("post", "/api/noticias"),
        ("put", "/api/noticias/1"),
        ("post", "/api/noticias/1/ocultar"),
        ("post", "/api/projetos/1/destaque"),
        ("get", "/api/admin/vagas"),
    ],
)
def test_site_no_ar_ignora_login_dev(tmp_path, metodo, rota):
    """Fora do debug, LOGIN_DEV=1 não transforma um visitante na primeira usuária (que é admin)."""
    app = _app(tmp_path, LOGIN_DEV=True, DEBUG=False, TESTING=False)
    with app.app_context():
        db.session.add(Usuaria(nome="Equipe", email="equipe@exemplo.com", papel="admin"))
        db.session.commit()
    resposta = getattr(app.test_client(), metodo)(rota, json={})
    assert resposta.status_code == 403


def test_login_dev_continua_valendo_em_debug(tmp_path):
    app = _app(tmp_path, LOGIN_DEV=True, DEBUG=True)
    with app.app_context():
        db.session.add(Usuaria(nome="Equipe", email="equipe@exemplo.com", papel="admin"))
        db.session.commit()
    assert app.test_client().get("/api/admin/vagas").status_code == 200


def test_email_da_lista_entra_como_admin(tmp_path, monkeypatch):
    app = _app(tmp_path, TESTING=True, LOGIN_DEV=False, ADMIN_EMAILS=frozenset({"equipe@gmail.com"}))
    equipe = _entrar(app, monkeypatch, "Equipe@Gmail.com")
    assert equipe.get("/api/admin/vagas").status_code == 200
    with app.app_context():
        usuaria = Usuaria.query.filter_by(email="equipe@gmail.com").one()
        assert usuaria.e_admin and usuaria.papel == "usuaria"  # o acesso vem da lista, não do banco


def test_email_fora_da_lista_nao_e_admin(tmp_path, monkeypatch):
    app = _app(tmp_path, TESTING=True, LOGIN_DEV=False, ADMIN_EMAILS=frozenset({"equipe@gmail.com"}))
    visitante = _entrar(app, monkeypatch, "outra@gmail.com")
    assert visitante.get("/api/admin/vagas").status_code == 403
    assert visitante.get("/admin").status_code == 302


def test_remover_avisa_quando_o_email_esta_na_lista(tmp_path, monkeypatch):
    app = _app(tmp_path, TESTING=True, LOGIN_DEV=False, ADMIN_EMAILS=frozenset({"equipe@gmail.com"}))
    _entrar(app, monkeypatch, "equipe@gmail.com")
    resultado = app.test_cli_runner().invoke(args=["tornar-admin", "equipe@gmail.com", "--remover"])
    assert "ADMIN_EMAILS" in resultado.output
    with app.app_context():
        assert Usuaria.query.filter_by(email="equipe@gmail.com").one().e_admin


def test_menu_lateral_so_para_quem_entrou(tmp_path):
    """Sem login o cabeçalho tem só a marca: nem o botão nem a barra lateral existem na página."""
    app = _app(tmp_path)
    from app.extensoes import db
    from app.usuarias.models import ContaUsuaria, Usuaria
    from datetime import datetime

    anonimo = app.test_client().get("/").get_data(as_text=True)
    assert 'id="abrir-menu"' not in anonimo and 'id="menu-lateral"' not in anonimo
    assert "menu-lateral.js" not in anonimo and "/mural/novo" not in anonimo

    with app.app_context():
        u = Usuaria(nome="Ana", email="ana@menu.local")
        db.session.add(u)
        db.session.flush()
        db.session.add(ContaUsuaria(usuaria_id=u.id, cadastro_concluido_em=datetime.utcnow()))
        db.session.commit()
        uid = u.id
    logada = app.test_client()
    with logada.session_transaction() as sessao:
        sessao["usuaria_id"] = uid
    pagina = logada.get("/mural").get_data(as_text=True)
    assert 'id="abrir-menu"' in pagina and 'id="menu-lateral"' in pagina and "menu-lateral.js" in pagina


def test_widget_de_acessibilidade_vai_em_todas_as_paginas(tmp_path):
    """O widget (CSS no cabeçalho, JS no fim) é servido pelo próprio site, sem CDN."""
    app = _app(tmp_path)
    cliente = app.test_client()
    pagina = cliente.get("/").get_data(as_text=True)
    assert "acessibilidade/a11y.css" in pagina and "acessibilidade/a11y.js" in pagina
    assert cliente.get("/static/acessibilidade/a11y.js").status_code == 200
    assert cliente.get("/static/acessibilidade/a11y.css").status_code == 200
