"""Testes da frente de Vagas afirmativas e Descobertas/Notícias (Pessoa 4)."""
from datetime import date, timedelta

import pytest

from app import create_app
from app.config import Config
from app.extensoes import db
from app.vagas.models import Vaga


@pytest.fixture
def app(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste_vagas.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    app = create_app(ConfigTeste)
    with app.app_context():
        r_mural = app.test_cli_runner().invoke(args=["seed-mural"])
        assert r_mural.exit_code == 0, r_mural.output
        r_vagas = app.test_cli_runner().invoke(args=["seed-vagas"])
        assert r_vagas.exit_code == 0, r_vagas.output
        r_noticias = app.test_cli_runner().invoke(args=["seed-noticias"])
        assert r_noticias.exit_code == 0, r_noticias.output
    return app


@pytest.fixture
def cliente(app):
    return app.test_client()


def test_pagina_vagas_abre_com_aviso_oficial(cliente):
    resposta = cliente.get("/vagas")
    assert resposta.status_code == 200
    html = resposta.get_data(as_text=True)
    assert "Confira sempre o edital oficial. Prazos e regras podem mudar." in html
    assert "Afirmativa para mulheres negras" in html


def test_api_opcoes_e_curadoria_entre_15_e_20_vagas(cliente):
    opcoes = cliente.get("/api/vagas/opcoes")
    assert opcoes.status_code == 200
    dados_opcoes = opcoes.get_json()
    assert {t["valor"] for t in dados_opcoes["tipos"]} == {"ic", "bolsa", "estagio", "emprego", "programa"}
    assert dados_opcoes["cidades"]

    lista = cliente.get("/api/vagas?por_pagina=30")
    assert lista.status_code == 200
    dados = lista.get_json()
    assert 15 <= dados["total"] <= 20
    assert len(dados["itens"]) == dados["total"]


def test_selos_so_aparecem_quando_ha_fonte_afirmacao(app, cliente):
    with app.app_context():
        sem_fonte = Vaga(
            titulo="Vaga sem fonte comprovada",
            organizacao="Org Teste",
            descricao="Descrição da vaga de teste com mais de vinte caracteres.",
            tipo="bolsa",
            area="computacao",
            modalidade="remoto",
            link_original="https://exemplo.org/edital",
            afirmativa_mulheres=True,
            afirmativa_negras=True,
            afirmativa_trans=True,
            fonte_afirmacao=None,
        )
        db.session.add(sem_fonte)
        db.session.commit()
        vaga_id = sem_fonte.id

    detalhe = cliente.get(f"/api/vagas/{vaga_id}").get_json()
    assert detalhe["afirmativa_mulheres"] is False
    assert detalhe["afirmativa_negras"] is False
    assert detalhe["afirmativa_trans"] is False
    assert detalhe["selos"] == []


def test_filtros_e_ordenacao_de_vagas(cliente):
    # Filtro por tipo
    ic = cliente.get("/api/vagas?tipo=ic").get_json()
    assert ic["itens"]
    assert all(v["tipo"] == "ic" for v in ic["itens"])

    # Filtro afirmativa para mulheres negras
    negras = cliente.get("/api/vagas?afirmativa_negras=1").get_json()
    assert negras["itens"]
    assert all(v["afirmativa_negras"] is True for v in negras["itens"])
    assert any(s["valor"] == "negras" for s in negras["itens"][0]["selos"])

    # Filtro afirmativa para mulheres trans
    trans = cliente.get("/api/vagas?afirmativa_trans=1").get_json()
    assert trans["itens"]
    assert all(v["afirmativa_trans"] is True for v in trans["itens"])

    # Filtro prazo aberto
    abertas = cliente.get("/api/vagas?prazo_aberto=1&por_pagina=30").get_json()
    assert abertas["itens"]
    assert all(v["prazo_aberto"] is True for v in abertas["itens"])

    # Busca por texto
    busca = cliente.get("/api/vagas?q=PretaLab").get_json()
    assert busca["total"] == 1
    assert "PretaLab" in busca["itens"][0]["titulo"]

    # Detalhe traz link obrigatório, data de coleta e fonte_afirmacao
    vaga_id = busca["itens"][0]["id"]
    detalhe = cliente.get(f"/api/vagas/{vaga_id}").get_json()
    assert detalhe["link_original"].startswith("https://")
    assert detalhe["fonte_afirmacao"]
    assert detalhe["data_coleta_rotulo"]


def test_validacao_exige_fonte_afirmacao_quando_afirmativa(cliente):
    # Admin (primeira usuária via LOGIN_DEV=1) tenta criar vaga afirmativa para mulheres negras sem fonte_afirmacao
    resposta = cliente.post(
        "/api/vagas",
        json={
            "titulo": "Bolsa de Pesquisa em IA",
            "organizacao": "Instituto Teste",
            "descricao": "Bolsa de iniciação científica em inteligência artificial aplicada.",
            "tipo": "ic",
            "area": "computacao",
            "modalidade": "remoto",
            "prazo": (date.today() + timedelta(days=10)).isoformat(),
            "link_original": "https://exemplo.org/vaga",
            "afirmativa_negras": True,
            "fonte_afirmacao": "",
        },
    )
    assert resposta.status_code == 422
    assert "fonte_afirmacao" in resposta.get_json()["erros"]


def test_pagina_e_api_de_noticias(cliente):
    assert cliente.get("/noticias").status_code == 200
    assert cliente.get("/api/noticias/opcoes").status_code == 200

    destaques = cliente.get("/api/noticias/destaques").get_json()
    assert len(destaques) == 3

    lista = cliente.get("/api/noticias?cientista_negra=1").get_json()
    assert lista["itens"]
    assert all(n["cientista_negra"] is True for n in lista["itens"])

    detalhe = cliente.get(f"/api/noticias/{lista['itens'][0]['id']}").get_json()
    assert detalhe["link_fonte"].startswith("https://")
    assert detalhe["imagem_url"].startswith("/static/img/noticias/")
    assert detalhe["cientista"]


def test_auto_seed_quando_banco_nao_rodou_seed_cli(tmp_path):
    """Mesmo sem rodar seed-noticias ou seed-vagas no terminal, as páginas já trazem os dados."""

    class ConfigLimpo(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'sem_seed.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    app_limpo = create_app(ConfigLimpo)
    cliente_limpo = app_limpo.test_client()

    noticias = cliente_limpo.get("/api/noticias").get_json()
    assert noticias["total"] == 12
    assert len(cliente_limpo.get("/api/noticias/destaques").get_json()) == 3

    vagas = cliente_limpo.get("/api/vagas?por_pagina=30").get_json()
    assert vagas["total"] == 20
