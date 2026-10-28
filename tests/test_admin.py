"""Testes do painel de administração (Pessoa 5)."""
import sqlite3
from datetime import date, timedelta

import pytest
from sqlalchemy import inspect

from app import create_app
from app.config import Config
from app.eventos.models import Evento
from app.extensoes import db
from app.mural.models import Denuncia, Projeto
from app.noticias.models import Noticia
from app.usuarias.models import Usuaria
from app.vagas.models import Vaga


@pytest.fixture
def app(tmp_path):
    class ConfigTeste(Config):
        TESTING = True
        LOGIN_DEV = True  # sem login, age como a primeira usuária do seed (a "Equipe AstrAce", admin)
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'teste_admin.db').as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    app = create_app(ConfigTeste)
    with app.app_context():
        for comando in ("seed-mural", "seed-eventos", "seed-vagas", "seed-noticias"):
            resultado = app.test_cli_runner().invoke(args=[comando])
            assert resultado.exit_code == 0, resultado.output
    return app


@pytest.fixture
def cliente(app):
    return app.test_client()


def _entrar_como(app, cliente, email):
    with app.app_context():
        uid = Usuaria.query.filter_by(email=email).one().id
    with cliente.session_transaction() as sessao:
        sessao["usuaria_id"] = uid


def _evento_valido(**mudancas):
    inicio = date.today() + timedelta(days=5)
    dados = {
        "titulo": "Oficina de foguetes de garrafa PET",
        "descricao": "Montamos e lançamos foguetes de água no pátio, com medição de altura e ângulo.",
        "tipo": "oficina",
        "organizacao": "Clube de Física",
        "inicio": f"{inicio.isoformat()}T14:00",
        "fim": f"{inicio.isoformat()}T17:00",
        "modalidade": "presencial",
        "local": "Escola Estadual Central, Rua das Flores, 100",
        "cidade": "Recife",
        "uf": "PE",
        "link": "https://exemplo.org/foguetes",
        "gratuito": True,
        "publico_alvo": "ensino_medio",
        "area": "fisica",
        "vale_carimbo": True,
    }
    dados.update(mudancas)
    return dados


# ---------- Acesso ----------


def test_admin_abre_o_painel_e_ve_o_link_no_menu(cliente):
    resposta = cliente.get("/admin")
    assert resposta.status_code == 200
    assert 'href="/admin"' in cliente.get("/mural").get_data(as_text=True)


def test_usuaria_comum_nao_entra(app, cliente):
    _entrar_como(app, cliente, "bia@exemplo.com")
    assert cliente.get("/admin").status_code == 302
    assert cliente.get("/api/admin/eventos").status_code == 403
    assert cliente.post("/api/admin/eventos", json=_evento_valido()).status_code == 403
    assert 'href="/admin"' not in cliente.get("/mural").get_data(as_text=True)


def test_atalho_login_dev_nao_vale_com_o_site_no_ar(app, cliente):
    app.testing = False  # nem debug, nem teste: como no servidor
    assert cliente.get("/api/admin/resumo").status_code == 403


def test_gravar_exige_json(cliente):
    resposta = cliente.post("/api/admin/eventos", data={"titulo": "Formulário de outro site"})
    assert resposta.status_code == 415


def test_comando_tornar_admin(app):
    runner = app.test_cli_runner()
    resultado = runner.invoke(args=["tornar-admin", "BIA@exemplo.com"])
    assert resultado.exit_code == 0, resultado.output
    with app.app_context():
        assert Usuaria.query.filter_by(email="bia@exemplo.com").one().e_admin

    assert runner.invoke(args=["tornar-admin", "bia@exemplo.com", "--remover"]).exit_code == 0
    with app.app_context():
        assert not Usuaria.query.filter_by(email="bia@exemplo.com").one().e_admin

    assert runner.invoke(args=["tornar-admin", "ninguem@exemplo.com"]).exit_code != 0


# ---------- Eventos ----------


def test_criar_evento_com_carimbo_gera_qr_e_aparece_na_agenda(cliente):
    resposta = cliente.post("/api/admin/eventos", json=_evento_valido())
    assert resposta.status_code == 201, resposta.get_json()
    evento = resposta.get_json()
    assert evento["vale_carimbo"] is True
    assert "/checkin/" in evento["link_checkin"]

    publico = cliente.get(f"/api/eventos/{evento['id']}").get_json()
    assert publico["tem_carimbo"] is True
    assert "token_qr" not in publico and "link_checkin" not in publico  # o token não vaza na API pública

    png = cliente.get(f"/admin/eventos/{evento['id']}/qr.png?baixar=1")
    assert png.mimetype == "image/png"
    assert png.data.startswith(b"\x89PNG")
    assert "attachment" in png.headers["Content-Disposition"]
    assert cliente.get(f"/admin/eventos/{evento['id']}/qr.svg").mimetype == "image/svg+xml"

    cartaz = cliente.get(f"/admin/eventos/{evento['id']}/cartaz").get_data(as_text=True)
    assert "Oficina de foguetes de garrafa PET" in cartaz
    assert "<svg" in cartaz


def test_evento_invalido_devolve_os_erros_por_campo(cliente):
    resposta = cliente.post("/api/admin/eventos", json={"modalidade": "presencial"})
    assert resposta.status_code == 422
    erros = resposta.get_json()["erros"]
    for campo in ("titulo", "descricao", "tipo", "inicio", "link", "local", "cidade", "uf"):
        assert campo in erros, campo

    fim_antes = _evento_valido(fim=_evento_valido()["inicio"].replace("T14:00", "T13:00"))
    assert "fim" in cliente.post("/api/admin/eventos", json=fim_antes).get_json()["erros"]


def test_evento_online_nao_guarda_endereco(cliente):
    dados = _evento_valido(modalidade="online", local="", cidade="Recife", uf="")
    evento = cliente.post("/api/admin/eventos", json=dados).get_json()
    assert evento["modalidade"] == "online"
    assert evento["cidade"] is None and evento["local"] is None


def test_editar_mantem_o_qr_e_desmarcar_carimbo_apaga(app, cliente):
    evento = cliente.post("/api/admin/eventos", json=_evento_valido()).get_json()
    link = evento["link_checkin"]

    editado = cliente.put(f"/api/admin/eventos/{evento['id']}", json=_evento_valido(titulo="Novo título do evento"))
    assert editado.status_code == 200
    assert editado.get_json()["link_checkin"] == link  # cartaz impresso continua valendo

    novo = cliente.post(f"/api/admin/eventos/{evento['id']}/qr/novo", json={}).get_json()
    assert novo["link_checkin"] != link

    sem = cliente.put(f"/api/admin/eventos/{evento['id']}", json=_evento_valido(vale_carimbo=False)).get_json()
    assert sem["vale_carimbo"] is False
    with app.app_context():
        assert db.session.get(Evento, evento["id"]).token_qr is None
    assert cliente.get(f"/admin/eventos/{evento['id']}/qr.png").status_code == 404


def test_ocultar_evento_tira_da_agenda_publica(cliente):
    evento = cliente.post("/api/admin/eventos", json=_evento_valido()).get_json()

    assert cliente.post(f"/api/admin/eventos/{evento['id']}/ocultar", json={}).status_code == 422
    assert cliente.post(f"/api/admin/eventos/{evento['id']}/ocultar", json={"oculto": True}).status_code == 200
    assert cliente.get(f"/api/eventos/{evento['id']}").status_code == 404

    ocultos = cliente.get("/api/admin/eventos?estado=ocultos").get_json()
    assert evento["id"] in [e["id"] for e in ocultos["itens"]]
    assert ocultos["contagens"]["ocultos"] >= 1

    cliente.post(f"/api/admin/eventos/{evento['id']}/ocultar", json={"oculto": False})
    assert cliente.get(f"/api/eventos/{evento['id']}").status_code == 200


def test_busca_na_lista_de_eventos(cliente):
    cliente.post("/api/admin/eventos", json=_evento_valido())
    achados = cliente.get("/api/admin/eventos?q=foguetes").get_json()["itens"]
    assert [e["titulo"] for e in achados] == ["Oficina de foguetes de garrafa PET"]


# ---------- Vagas ----------


def test_lista_de_vagas_mostra_as_ocultas_e_reconferir(app, cliente):
    vaga_id = cliente.get("/api/admin/vagas").get_json()["itens"][0]["id"]
    cliente.post(f"/api/vagas/{vaga_id}/ocultar", json={"oculta": True})

    ocultas = cliente.get("/api/admin/vagas?estado=ocultas").get_json()["itens"]
    assert vaga_id in [v["id"] for v in ocultas]
    assert cliente.get(f"/api/admin/vagas/{vaga_id}").status_code == 200  # a pública daria 404

    with app.app_context():
        db.session.get(Vaga, vaga_id).data_coleta = date.today() - timedelta(days=60)
        db.session.commit()
    assert cliente.get(f"/api/admin/vagas/{vaga_id}").get_json()["reconferir"] is True
    conferida = cliente.post(f"/api/admin/vagas/{vaga_id}/conferir", json={}).get_json()
    assert conferida["reconferir"] is False
    assert conferida["data_coleta"] == date.today().isoformat()


def _vaga_valida(**mudancas):
    dados = {
        "titulo": "Bolsa de iniciação científica em IA",
        "organizacao": "Instituto Teste",
        "descricao": "Bolsa de 12 meses para estudantes de graduação em computação.",
        "tipo": "ic",
        "area": "computacao",
        "modalidade": "remoto",
        "link_original": "https://exemplo.org/edital",
    }
    dados.update(mudancas)
    return dados


def test_foto_da_vaga_aparece_no_site_e_pode_sair(cliente):
    criada = cliente.post("/api/vagas", json=_vaga_valida(imagem_url="/uploads/logo.webp"))
    assert criada.status_code == 201
    vaga_id = criada.get_json()["id"]
    assert cliente.get(f"/api/vagas/{vaga_id}").get_json()["imagem_url"] == "/uploads/logo.webp"
    cartao = next(v for v in cliente.get("/api/vagas?por_pagina=48").get_json()["itens"] if v["id"] == vaga_id)
    assert cartao["imagem_url"] == "/uploads/logo.webp"

    sem_foto = cliente.put(f"/api/vagas/{vaga_id}", json=_vaga_valida(imagem_url=""))
    assert sem_foto.get_json()["imagem_url"] is None


def test_foto_da_vaga_so_aceita_envio_ou_link(cliente):
    resposta = cliente.post("/api/vagas", json=_vaga_valida(imagem_url="javascript:alert(1)"))
    assert resposta.status_code == 422
    assert "imagem_url" in resposta.get_json()["erros"]


def test_banco_antigo_ganha_a_coluna_de_imagem(tmp_path):
    caminho = tmp_path / "antigo.db"
    with sqlite3.connect(caminho) as conexao:
        conexao.execute("CREATE TABLE vagas (id INTEGER PRIMARY KEY, titulo VARCHAR(160) NOT NULL)")
        conexao.execute("INSERT INTO vagas (titulo) VALUES ('Vaga de antes da foto')")

    class ConfigAntiga(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{caminho.as_posix()}"
        PASTA_UPLOADS = str(tmp_path / "uploads")

    app = create_app(ConfigAntiga)
    with app.app_context():
        colunas = {c["name"] for c in inspect(db.engine).get_columns("vagas")}
    assert "imagem_url" in colunas
    with sqlite3.connect(caminho) as conexao:
        assert conexao.execute("SELECT titulo, imagem_url FROM vagas").fetchall() == [("Vaga de antes da foto", None)]


# ---------- Notícias ----------


def test_lista_de_noticias_mostra_as_ocultas_e_busca(cliente):
    itens = cliente.get("/api/admin/noticias").get_json()["itens"]
    alvo = itens[0]
    cliente.post(f"/api/noticias/{alvo['id']}/ocultar", json={"oculta": True})

    dados = cliente.get("/api/admin/noticias?estado=ocultas").get_json()
    assert [n["id"] for n in dados["itens"]] == [alvo["id"]]
    assert dados["contagens"] == {"no_site": len(itens) - 1, "ocultas": 1}
    assert cliente.get(f"/api/admin/noticias/{alvo['id']}").get_json()["oculta"] is True

    palavra = alvo["cientista"].split()[0]
    achadas = cliente.get(f"/api/admin/noticias?estado=ocultas&q={palavra}").get_json()["itens"]
    assert alvo["id"] in [n["id"] for n in achadas]


def test_trocar_e_remover_a_foto_da_noticia(app, cliente):
    ficha = cliente.get("/api/admin/noticias").get_json()["itens"][0]
    campos = ("titulo", "cientista", "instituicao", "resumo", "area", "categoria", "fonte_nome", "link_fonte",
              "data_publicacao", "cientista_brasileira", "cientista_negra", "destaque")
    dados = {campo: ficha[campo] for campo in campos}

    trocada = cliente.put(f"/api/noticias/{ficha['id']}", json={**dados, "imagem_url": "/uploads/nova.jpg"})
    assert trocada.status_code == 200
    assert trocada.get_json()["imagem_url"] == "/uploads/nova.jpg"
    assert trocada.get_json()["titulo"] == ficha["titulo"]  # o resto não muda

    cliente.put(f"/api/noticias/{ficha['id']}", json={**dados, "imagem_url": ""})
    with app.app_context():
        assert db.session.get(Noticia, ficha["id"]).imagem_url is None


def test_opcoes_do_painel_trazem_as_categorias_de_noticia(cliente):
    opcoes = cliente.get("/api/admin/opcoes").get_json()
    assert {c["valor"] for c in opcoes["noticias"]["categorias"]} >= {"descoberta", "premio"}


# ---------- Moderação ----------


def _denunciar_tres_vezes(app):
    with app.app_context():
        projeto = Projeto.query.filter_by(oculto=False).first()
        for usuaria in Usuaria.query.limit(3):
            db.session.add(Denuncia(projeto_id=projeto.id, usuaria_id=usuaria.id, motivo="spam", comentario="Parece propaganda"))
        projeto.oculto = True
        db.session.commit()
        return projeto.id


def test_restaurar_projeto_denunciado(app, cliente):
    projeto_id = _denunciar_tres_vezes(app)
    fila = cliente.get("/api/admin/denuncias").get_json()
    item = next(p for p in fila if p["id"] == projeto_id)
    assert item["oculto"] is True and item["total_denuncias"] == 3
    assert item["motivos"][0]["total"] == 3

    resposta = cliente.post(f"/api/admin/projetos/{projeto_id}/moderar", json={"decisao": "restaurar"})
    assert resposta.status_code == 200
    assert cliente.get(f"/api/projetos/{projeto_id}").status_code == 200
    assert projeto_id not in [p["id"] for p in cliente.get("/api/admin/denuncias").get_json()]
    with app.app_context():
        assert Denuncia.query.filter_by(projeto_id=projeto_id).count() == 0


def test_manter_projeto_fora_do_mural(app, cliente):
    projeto_id = _denunciar_tres_vezes(app)
    cliente.post(f"/api/admin/projetos/{projeto_id}/moderar", json={"decisao": "fora_do_mural"})
    assert cliente.get(f"/api/projetos/{projeto_id}").status_code == 404
    assert projeto_id not in [p["id"] for p in cliente.get("/api/admin/denuncias").get_json()]


# ---------- Destaques ----------


def test_vitrine_da_semana_tem_no_maximo_cinco(cliente):
    atuais = {p["id"] for p in cliente.get("/api/admin/destaques").get_json()["itens"]}
    candidatos = [p["id"] for p in cliente.get("/api/projetos?por_pagina=20").get_json()["itens"] if p["id"] not in atuais]

    for projeto_id in candidatos[: 5 - len(atuais)]:
        assert cliente.post(f"/api/admin/destaques/{projeto_id}", json={"destaque": True}).status_code == 200
    extra = candidatos[5 - len(atuais)]
    assert cliente.post(f"/api/admin/destaques/{extra}", json={"destaque": True}).status_code == 409

    tirar = candidatos[0]
    assert cliente.post(f"/api/admin/destaques/{tirar}", json={"destaque": False}).status_code == 200
    assert cliente.post(f"/api/admin/destaques/{extra}", json={"destaque": True}).status_code == 200
    assert len(cliente.get("/api/admin/destaques").get_json()["itens"]) == 5


# ---------- Visão geral ----------


def test_resumo_com_numeros_e_pendencias(app, cliente):
    _denunciar_tres_vezes(app)
    resumo = cliente.get("/api/admin/resumo").get_json()
    assert {n["rotulo"] for n in resumo["numeros"]} >= {"usuárias cadastradas", "projetos no mural", "vagas abertas"}
    assert any(p["aba"] == "moderacao" for p in resumo["pendencias"])
