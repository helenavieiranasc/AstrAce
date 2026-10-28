"""Citar projeto: referência ABNT NBR 6023:2025 e citação no texto ABNT NBR 10520:2023."""
from datetime import date
from types import SimpleNamespace

import pytest

from app import create_app
from app.config import Config
from app.mural.citacao import autor_abnt, data_acesso, gerar, sobrenome_citacao


@pytest.mark.parametrize(
    "nome, esperado",
    [
        ("Ana Beatriz Santos", "SANTOS, Ana Beatriz"),
        ("Maria da Silva", "SILVA, Maria da"),  # partícula fica com o prenome
        ("João Santos Júnior", "SANTOS JÚNIOR, João"),  # Júnior, Filho, Neto vão junto do sobrenome
        ("Carla Gonçalves", "GONÇALVES, Carla"),
        ("Val", "VAL"),
        ("", "AUTORIA DESCONHECIDA"),
    ],
)
def test_nome_da_autora(nome, esperado):
    assert autor_abnt(nome) == esperado


def test_sobrenome_na_citacao_so_com_inicial_maiuscula():
    assert sobrenome_citacao("Ana Beatriz Santos") == "Santos"
    assert sobrenome_citacao("João Santos Júnior") == "Santos Júnior"


def test_mes_abreviado_da_norma():
    assert data_acesso(date(2026, 5, 3)) == "3 maio 2026"
    assert data_acesso(date(2026, 10, 28)) == "28 out. 2026"


def _projeto(**extra):
    base = dict(
        autora=SimpleNamespace(nome_publico="Ana Beatriz Santos"),
        titulo="Bactérias do mangue: degradação de plástico",
        ano=2025,
        tipo="monografia",
        detalhes={"curso": "Ciências Biológicas"},
        instituicao="UFPE",
        cidade="Recife",
        link_externo=None,
    )
    base.update(extra)
    return SimpleNamespace(**base)


def test_referencia_de_tcc():
    c = gerar(_projeto(), "https://astrace.dev/mural?projeto=7", hoje=date(2026, 10, 28))
    assert c["referencia_texto"] == (
        "SANTOS, Ana Beatriz. Bactérias do mangue: degradação de plástico. 2025. "
        "Trabalho de Conclusão de Curso (Ciências Biológicas) – UFPE, Recife, 2025. "
        "Disponível em: https://astrace.dev/mural?projeto=7. Acesso em: 28 out. 2026."
    )
    # Só o título principal em negrito; o subtítulo, depois dos dois-pontos, não.
    assert "<strong>Bactérias do mangue</strong>: degradação de plástico" in c["referencia_html"]
    assert c["citacao_parentetica"] == "(Santos, 2025)"
    assert c["citacao_narrativa"] == "Santos (2025)"


def test_software_aponta_para_o_link_do_projeto():
    c = gerar(
        _projeto(tipo="software", titulo="App Rios", link_externo="https://github.com/ana/rios"),
        "https://astrace.dev/mural?projeto=7",
        hoje=date(2026, 10, 28),
    )
    assert "2025. Software. Disponível em: https://github.com/ana/rios." in c["referencia_texto"]


def test_campos_vazios_nao_deixam_virgula_sobrando():
    c = gerar(_projeto(tipo="extensao", detalhes={}, instituicao=None, cidade=None), "https://x", date(2026, 1, 2))
    assert ". Projeto de extensão, 2025. Disponível em" in c["referencia_texto"]
    assert ", ," not in c["referencia_texto"] and " – ," not in c["referencia_texto"]


def test_ano_duas_vezes_so_no_tcc():
    tcc = gerar(_projeto(), "https://x", date(2026, 1, 2))["referencia_texto"]
    disciplina = gerar(_projeto(tipo="aula", detalhes={}), "https://x", date(2026, 1, 2))["referencia_texto"]
    assert tcc.count("2025") == 2  # ano de depósito e ano da defesa
    assert disciplina.count("2025") == 1
    assert "plástico. Trabalho de disciplina – UFPE, Recife, 2025." in disciplina


def test_titulo_com_html_e_escapado():
    c = gerar(_projeto(titulo="<b>Teste</b> & cia"), "https://x", date(2026, 1, 2))
    assert "<b>" not in c["referencia_html"] and "&lt;b&gt;" in c["referencia_html"]


def test_detalhe_do_projeto_traz_a_citacao(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    app = create_app(ConfigTeste)
    with app.app_context():
        app.test_cli_runner().invoke(args=["seed-mural"])
    citacao = app.test_client().get("/api/projetos/1").get_json()["citacao"]
    assert citacao["referencia_texto"].endswith(".")
    assert "Disponível em: http://localhost/mural?projeto=1" in citacao["referencia_texto"]
    assert citacao["citacao_parentetica"].startswith("(")
