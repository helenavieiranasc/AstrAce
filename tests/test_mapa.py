"""Mapa de Inspiração: cidades reconhecidas, pins rosas (dados reais) e páginas."""
from datetime import datetime
import pytest

from app import create_app
from app.config import Config
from app.extensoes import db
from app.mural.mapa import coordenadas, localizar
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
    return app.test_client()


@pytest.mark.parametrize("escrita", ["São Paulo", "sao paulo", "  SÃO   PAULO ", "São Paulo - SP", "São Paulo/SP", "São Paulo (SP)"])
def test_reconhece_jeitos_de_escrever_a_cidade(escrita):
    nome, uf, x, y = localizar(escrita)
    assert (nome, uf) == ("São Paulo", "SP")
    assert 0 <= x <= 100 and 0 <= y <= 100


def test_hifen_do_nome_nao_e_confundido_com_estado():
    assert localizar("Ji-Paraná")[1] == "RO"


def test_com_estado_acha_cidades_de_nome_repetido():
    assert localizar("Bom Jesus") is None  # existe em mais de um estado
    assert localizar("Bom Jesus", "PI")[:2] == ("Bom Jesus", "PI")
    # Estado que não bate com a cidade (texto editado à mão): vale o nome, se ele for único.
    assert localizar("Recife", "SP")[:2] == ("Recife", "PE")


@pytest.mark.parametrize("escrita", ["", None, "eeeee", "Cidade Inventada"])
def test_cidade_desconhecida_fica_fora(escrita):
    assert localizar(escrita) is None


def test_posicoes_respeitam_o_desenho():
    # Norte fica acima do sul, oeste à esquerda do leste.
    _, _, x_manaus, y_manaus = localizar("Manaus")
    _, _, x_recife, y_recife = localizar("Recife")
    _, _, _, y_porto_alegre = localizar("Porto Alegre")
    assert x_manaus < x_recife
    assert y_manaus < y_porto_alegre and y_recife < y_porto_alegre


def test_api_agrupa_por_cidade(app, cliente):
    mapa = cliente.get("/api/mural/mapa").get_json()
    with app.app_context():
        visiveis = Projeto.query.filter_by(oculto=False).all()
        sem_local = sum(1 for p in visiveis if localizar(p.cidade, p.uf) is None)

    assert mapa["total"] == len(visiveis)
    assert mapa["sem_local"] == sem_local
    assert sum(c["total"] for c in mapa["cidades"]) == len(visiveis) - sem_local
    for cidade in mapa["cidades"]:
        assert cidade["total"] == len(cidade["projetos"])
    totais = [c["total"] for c in mapa["cidades"]]
    assert totais == sorted(totais, reverse=True)


def test_grafias_diferentes_viram_um_pin(app, cliente):
    with app.app_context():
        projetos = Projeto.query.filter_by(cidade="Recife").all()
        projetos[0].cidade = "recife - PE"
        db.session.commit()
        total = len(projetos)
    recife = [c for c in cliente.get("/api/mural/mapa").get_json()["cidades"] if c["cidade"] == "Recife"]
    assert len(recife) == 1 and recife[0]["total"] == total


def test_projeto_oculto_sai_do_mapa(app, cliente):
    antes = cliente.get("/api/mural/mapa").get_json()["total"]
    with app.app_context():
        Projeto.query.first().oculto = True
        db.session.commit()
    assert cliente.get("/api/mural/mapa").get_json()["total"] == antes - 1


def test_pins_rosas_ganharam_latitude_e_longitude_sem_perder_o_resto(cliente):
    cidades = cliente.get("/api/mural/mapa").get_json()["cidades"]
    assert cidades
    for c in cidades:
        assert -34 < c["lat"] < 6 and -75 < c["lon"] < -32  # dentro do Brasil
        assert {"cidade", "uf", "x", "y", "total", "projetos"} <= c.keys()  # o que já existia continua


def test_coordenadas_so_de_cidade_conhecida():
    lat, lon = coordenadas("Manaus", "AM")
    assert lat < 0 and lon < -55
    assert coordenadas("Cidade Inventada") is None


def test_mapa_de_inspiracao_e_aba_propria(cliente):
    pagina = cliente.get("/mapa")
    assert pagina.status_code == 200
    html = pagina.get_data(as_text=True)
    assert "Mapa de Inspiração" in html and "js/mapa-inspiracao.js" in html
    # O mural não carrega mais o convite do mapa antigo.
    mural = cliente.get("/mural").get_data(as_text=True)
    assert "vitrine-mapa" not in mural and 'href="/mural/mapa"' not in mural


def test_endereco_antigo_redireciona_mantendo_a_cidade(cliente):
    r = cliente.get("/mural/mapa?cidade=Recife-PE")
    assert r.status_code == 301
    assert r.headers["Location"].endswith("/mapa?cidade=Recife-PE")


def test_menu_e_pagina_inicial_levam_ao_mapa(app, cliente):
    from app.carta.models import ADIADA, CartaFuturo
    from app.usuarias.models import ContaUsuaria, Usuaria

    # O menu lateral só existe para quem entrou: entra por sessão, com o cadastro pronto e a carta já decidida.
    with app.app_context():
        u = Usuaria(nome="Ana", email="ana@menu-mapa.local")
        db.session.add(u)
        db.session.flush()
        db.session.add(ContaUsuaria(usuaria_id=u.id, cadastro_concluido_em=datetime.utcnow()))
        db.session.add(CartaFuturo(usuaria_id=u.id, estado=ADIADA))
        db.session.commit()
        uid = u.id
    with cliente.session_transaction() as sessao:
        sessao["usuaria_id"] = uid
    assert 'href="/mapa"' in cliente.get("/eventos").get_data(as_text=True)  # menu lateral
    assert 'href="/mapa"' in cliente.get("/").get_data(as_text=True)  # post-it "Inspire-se"


def test_nomes_so_de_quem_ja_tem_projeto_visivel(app, cliente):
    from app.extensoes import db
    from app.mural.models import Projeto
    from app.usuarias.models import ContaUsuaria, Usuaria

    with app.app_context():
        com = Usuaria(nome="Com Projeto", email="com@teste.local", cidade="Recife")
        sem = Usuaria(nome="Sem Projeto", email="sem@teste.local", cidade="Recife")
        db.session.add_all([com, sem])
        db.session.flush()
        for u in (com, sem):
            db.session.add(ContaUsuaria(usuaria_id=u.id, estado="PE", cadastro_concluido_em=datetime.utcnow()))
        projeto = Projeto.query.first()
        projeto_da_com = Projeto(
            usuaria_id=com.id, tipo=projeto.tipo, area=projeto.area, titulo="Teste", resumo="Resumo", ano=2026, cidade="Recife", uf="PE",
        )
        db.session.add(projeto_da_com)
        db.session.commit()
    dados = cliente.get("/api/mapa/mulheres-astrace").get_json()
    recife = [c for c in dados["cidades"] if c["cidade"] == "Recife"][0]
    assert recife["total"] >= 2  # a contagem inclui todas as cadastradas
    assert "Com Projeto" in recife["nomes"]
    assert "Sem Projeto" not in recife["nomes"]  # quem não publicou não tem nome exposto
    assert set(recife) == {"cidade", "uf", "x", "y", "lat", "lon", "total", "nomes"}
