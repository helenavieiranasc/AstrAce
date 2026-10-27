"""Perfil: página, foto no cabeçalho e gerenciamento das próprias publicações.

O Google é trocado por respostas falsas só aqui no teste; o resto roda como em produção.
"""
from io import BytesIO
from urllib.parse import parse_qs, urlparse

import pytest

from app import create_app
from app.config import Config
from app.conta import google
from app.extensoes import db
from app.mural.models import Denuncia, Estrela, Projeto
from app.uploads.models import Arquivo
from app.usuarias.models import Usuaria

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64

PERFIL = {"apelido": "Ana", "nivel": "graduacao", "area_interesse": "computacao", "estado": "PE", "cidade": "Recife"}


@pytest.fixture
def app(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste_perfil.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")
        GOOGLE_CLIENT_ID = "id-de-teste"
        GOOGLE_CLIENT_SECRET = "segredo-de-teste"

    return create_app(ConfigTeste)


@pytest.fixture
def entrar(app, monkeypatch):
    """Devolve uma função que abre um navegador novo, entra com uma conta Google falsa e termina o cadastro."""
    perfis = {}
    monkeypatch.setattr(google, "trocar_codigo", lambda codigo: codigo)
    monkeypatch.setattr(google, "buscar_perfil", lambda token: perfis[token])

    def _entrar(sub, email, nome):
        perfis[sub] = {"sub": sub, "email": email, "email_verified": True, "name": nome,
                       "picture": f"https://lh3.googleusercontent.com/{sub}"}
        cliente = app.test_client()
        ida = cliente.get("/entrar/google")
        estado = parse_qs(urlparse(ida.headers["Location"]).query)["state"][0]
        cliente.get(f"/entrar/google/retorno?code={sub}&state={estado}")
        assert cliente.post("/api/perfil", json={**PERFIL, "apelido": nome.split()[0]}).status_code == 200
        return cliente

    return _entrar


@pytest.fixture
def ana(entrar):
    return entrar("sub-ana", "ana@example.com", "Ana Souza")


@pytest.fixture
def bia(entrar, ana):
    return entrar("sub-bia", "bia@example.com", "Bia Lima")


def criar_projeto(app, email, titulo="Sensor de qualidade do ar"):
    with app.app_context():
        dona = Usuaria.query.filter_by(email=email).one()
        projeto = Projeto(usuaria_id=dona.id, tipo="software", titulo=titulo, area="computacao", ano=2025,
                          resumo="Um sensor barato para medir a qualidade do ar nas escolas públicas.",
                          link_externo="https://github.com/ana/sensor",
                          detalhes={"plataforma": "web", "tecnologias": "Python, Arduino"})
        db.session.add(projeto)
        db.session.commit()
        return projeto.id


def enviar_foto(cliente):
    resposta = cliente.post("/api/uploads", data={"arquivo": (BytesIO(PNG), "eu.png"), "finalidade": "foto"},
                            content_type="multipart/form-data")
    assert resposta.status_code == 201
    return resposta.get_json()


# ---------- Página e cabeçalho ----------


def test_perfil_exige_login(app):
    cliente = app.test_client()
    assert cliente.get("/perfil").headers["Location"].endswith("/")
    assert cliente.get("/perfil/editar").headers["Location"].endswith("/")
    assert cliente.get("/api/minhas-publicacoes").status_code == 401


def test_cabecalho_mostra_a_foto_e_o_menu_so_com_login(app, ana):
    pagina = ana.get("/mural").get_data(as_text=True)
    assert 'id="conta-topo"' in pagina
    assert "https://lh3.googleusercontent.com/sub-ana" in pagina
    assert "Meu perfil" in pagina
    assert 'id="conta-topo"' not in app.test_client().get("/mural").get_data(as_text=True)


def test_pagina_do_perfil_mostra_os_dados(ana):
    ana.post("/api/perfil", json={**PERFIL, "bio": "Gosto de sensores e de ensinar programação."})
    pagina = ana.get("/perfil").get_data(as_text=True)
    for trecho in ("Ana", "Graduação", "Recife, PE", "Gosto de sensores", "Editar perfil"):
        assert trecho in pagina
    assert "Editar perfil" in ana.get("/perfil/editar").get_data(as_text=True)


def test_foto_nova_aparece_no_cabecalho_e_sobrevive_ao_recarregar(ana):
    foto = enviar_foto(ana)
    ana.post("/api/perfil", json={**PERFIL, "foto_id": foto["id"]})
    assert foto["url"] in ana.get("/perfil").get_data(as_text=True)
    assert foto["url"] in ana.get("/vagas").get_data(as_text=True)  # o cabeçalho de outra página


def test_biografia_longa_demais_e_recusada(ana):
    resposta = ana.post("/api/perfil", json={**PERFIL, "bio": "a" * 501})
    assert resposta.status_code == 422
    assert "bio" in resposta.get_json()["erros"]


def test_cadastro_sem_bio_nao_apaga_a_bio(app, ana):
    ana.post("/api/perfil", json={**PERFIL, "bio": "Minha bio"})
    ana.post("/api/perfil", json=PERFIL)  # o formulário do cadastro inicial não manda bio
    with app.app_context():
        assert Usuaria.query.filter_by(email="ana@example.com").one().bio == "Minha bio"


# ---------- Minhas publicações ----------


def test_lista_so_as_publicacoes_da_usuaria(app, ana, bia):
    criar_projeto(app, "ana@example.com", "Projeto da Ana")
    criar_projeto(app, "bia@example.com", "Projeto da Bia")
    titulos = [p["titulo"] for p in ana.get("/api/minhas-publicacoes").get_json()["itens"]]
    assert titulos == ["Projeto da Ana"]


def test_lista_vazia(ana):
    assert ana.get("/api/minhas-publicacoes").get_json()["itens"] == []


def test_publicacao_oculta_aparece_com_o_estado(app, ana):
    pid = criar_projeto(app, "ana@example.com")
    with app.app_context():
        db.session.get(Projeto, pid).oculto = True
        db.session.commit()
    item = ana.get("/api/minhas-publicacoes").get_json()["itens"][0]
    assert item["estado"]["valor"] == "oculto"


def test_editar_a_propria_publicacao(app, ana):
    pid = criar_projeto(app, "ana@example.com")
    dados = ana.get(f"/api/minhas-publicacoes/{pid}").get_json()["projeto"]
    resposta = ana.patch(f"/api/minhas-publicacoes/{pid}", json={**dados, "titulo": "Sensor de ar 2.0"})
    assert resposta.status_code == 200
    assert resposta.get_json()["item"]["titulo"] == "Sensor de ar 2.0"
    with app.app_context():
        projeto = db.session.get(Projeto, pid)
        assert projeto.titulo == "Sensor de ar 2.0"
        assert projeto.tipo == "software"  # o tipo não muda pela edição


def test_editar_valida_os_campos(app, ana):
    pid = criar_projeto(app, "ana@example.com")
    resposta = ana.patch(f"/api/minhas-publicacoes/{pid}",
                         json={"titulo": "Oi", "resumo": "curto", "area": "x", "ano": "dois mil", "link_externo": ""})
    assert resposta.status_code == 422
    # Software exige link: sem ele, a edição é recusada.
    assert {"titulo", "resumo", "area", "ano", "link_externo"} <= set(resposta.get_json()["erros"])


def test_excluir_a_propria_publicacao_apaga_tudo(app, ana, bia, tmp_path):
    pid = criar_projeto(app, "ana@example.com")
    with app.app_context():
        bia_id = Usuaria.query.filter_by(email="bia@example.com").one().id
        ana_id = Usuaria.query.filter_by(email="ana@example.com").one().id
        (tmp_path / "uploads").mkdir(exist_ok=True)
        (tmp_path / "uploads" / "relatorio.pdf").write_bytes(b"%PDF")
        db.session.add_all([
            Estrela(projeto_id=pid, usuaria_id=bia_id),
            Denuncia(projeto_id=pid, usuaria_id=bia_id, motivo="spam"),
            Arquivo(projeto_id=pid, usuaria_id=ana_id, finalidade="material", nome_original="r.pdf",
                    nome_salvo="relatorio.pdf", tipo="pdf", tamanho=4),
        ])
        db.session.commit()

    assert ana.delete(f"/api/minhas-publicacoes/{pid}").status_code == 200
    with app.app_context():
        assert db.session.get(Projeto, pid) is None
        assert Estrela.query.filter_by(projeto_id=pid).count() == 0
        assert Denuncia.query.filter_by(projeto_id=pid).count() == 0
        assert Arquivo.query.filter_by(nome_salvo="relatorio.pdf").count() == 0
    assert not (tmp_path / "uploads" / "relatorio.pdf").exists()


# ---------- Ninguém mexe no que é de outra pessoa ----------


def test_outra_usuaria_nao_edita_nem_exclui(app, ana, bia):
    pid = criar_projeto(app, "ana@example.com")
    assert bia.get(f"/api/minhas-publicacoes/{pid}").status_code == 403
    assert bia.patch(f"/api/minhas-publicacoes/{pid}", json={"titulo": "Roubado"}).status_code == 403
    assert bia.delete(f"/api/minhas-publicacoes/{pid}").status_code == 403
    with app.app_context():
        projeto = db.session.get(Projeto, pid)
        assert projeto is not None and projeto.titulo == "Sensor de qualidade do ar"


def test_sem_login_nao_edita_nem_exclui(app):
    cliente = app.test_client()
    assert cliente.patch("/api/minhas-publicacoes/1", json={}).status_code == 401
    assert cliente.delete("/api/minhas-publicacoes/1").status_code == 401


def test_perfil_so_muda_o_da_propria_conta(app, ana, bia):
    # Mesmo mandando dados de outra pessoa, o POST /api/perfil só mexe em quem está logada.
    bia.post("/api/perfil", json={**PERFIL, "apelido": "Bia", "usuaria_id": 1, "email": "ana@example.com"})
    with app.app_context():
        assert Usuaria.query.filter_by(email="ana@example.com").one().apelido == "Ana"
        assert Usuaria.query.filter_by(email="bia@example.com").one().apelido == "Bia"


def test_nao_usa_foto_de_outra_pessoa(ana, bia):
    foto = enviar_foto(ana)
    resposta = bia.post("/api/perfil", json={**PERFIL, "foto_id": foto["id"]})
    assert resposta.status_code == 422
