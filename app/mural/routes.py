from flask import abort, current_app, jsonify, render_template, request

from .. import catalogos
from ..auth import usuaria_atual
from ..extensoes import db
from . import bp, servico
from .models import Denuncia, Projeto, semana_atual
from .tipos import MOTIVOS_DENUNCIA, TIPOS


def _erro(mensagem, status, **extra):
    return jsonify({"erro": mensagem, **extra}), status


def _projeto_visivel(projeto_id):
    projeto = db.session.get(Projeto, projeto_id)
    if not projeto or projeto.oculto:
        abort(404)
    return projeto


@bp.app_errorhandler(404)
def _nao_encontrado(erro):
    if request.path.startswith("/api/"):
        return _erro("Não encontramos esse item. Ele pode ter sido removido.", 404)
    return erro


# ---------- Páginas ----------

@bp.get("/mural")
def pagina_mural():
    return render_template("mural.html")


@bp.get("/mural/novo")
def pagina_novo_projeto():
    return render_template("mural_novo.html")


# ---------- API ----------

@bp.get("/api/mural/opcoes")
def api_opcoes():
    return jsonify(
        {
            "tipos": TIPOS,
            "areas": catalogos.AREAS,
            "niveis": catalogos.NIVEIS,
            "identidades": catalogos.IDENTIDADES,
            "instituicoes": servico.valores_distintos(Projeto.instituicao),
            "cidades": servico.valores_distintos(Projeto.cidade),
            "motivos_denuncia": MOTIVOS_DENUNCIA,
        }
    )


@bp.get("/api/projetos")
def api_listar():
    filtros = {campo: request.args.get(campo, "").strip() for campo in (*servico.FILTROS, "q")}
    pagina = max(request.args.get("pagina", 1, type=int), 1)
    por_pagina = min(max(request.args.get("por_pagina", 12, type=int), 1), 48)
    ordem = request.args.get("ordem", "recentes")
    if ordem not in servico.ORDENS:
        ordem = "recentes"

    itens, total = servico.consultar(filtros, pagina, por_pagina, ordem)
    estrelados = servico.estrelados_por(usuaria_atual(), itens)
    return jsonify(
        {
            "itens": [servico.cartao(p, estrelados) for p in itens],
            "total": total,
            "pagina": pagina,
            "tem_mais": pagina * por_pagina < total,
        }
    )


@bp.get("/api/projetos/destaques")
def api_destaques():
    itens = servico.destaques_da_semana()
    estrelados = servico.estrelados_por(usuaria_atual(), itens)
    return jsonify([servico.cartao(p, estrelados) for p in itens])


@bp.get("/api/projetos/<int:projeto_id>")
def api_detalhe(projeto_id):
    projeto = _projeto_visivel(projeto_id)
    return jsonify(servico.detalhe(projeto, servico.estrelados_por(usuaria_atual(), [projeto])))


@bp.post("/api/projetos/<int:projeto_id>/estrela")
def api_estrela(projeto_id):
    """Dá ou tira a estrela da usuária logada nesse projeto."""
    usuaria = usuaria_atual()
    if not usuaria:
        return _erro("Entre na sua conta para dar estrelas.", 401)
    projeto = _projeto_visivel(projeto_id)
    estrelado = servico.alternar_estrela(projeto, usuaria)
    return jsonify({"estrelas": projeto.total_estrelas or 0, "estrelado": estrelado})


@bp.post("/api/projetos")
def api_criar():
    autora = usuaria_atual()
    if not autora:
        return _erro("Entre na sua conta para publicar um projeto.", 401)

    dados = request.get_json(silent=True) or {}
    limpo, erros, arquivos = servico.validar(dados, autora)
    if erros:
        return _erro("Confira os campos marcados.", 422, erros=erros)

    projeto = Projeto(usuaria_id=autora.id, **limpo)
    projeto.arquivos = arquivos
    db.session.add(projeto)
    db.session.commit()
    return jsonify(servico.detalhe(projeto)), 201


@bp.post("/api/projetos/<int:projeto_id>/denuncias")
def api_denunciar(projeto_id):
    projeto = _projeto_visivel(projeto_id)
    dados = request.get_json(silent=True) or {}

    motivo = dados.get("motivo")
    if motivo not in {m["valor"] for m in MOTIVOS_DENUNCIA}:
        return _erro("Escolha o motivo da denúncia.", 422)

    usuaria = usuaria_atual()
    if usuaria and Denuncia.query.filter_by(projeto_id=projeto.id, usuaria_id=usuaria.id).first():
        return jsonify({"mensagem": "Você já denunciou este projeto. A equipe vai revisar."})

    db.session.add(
        Denuncia(
            projeto_id=projeto.id,
            usuaria_id=usuaria.id if usuaria else None,
            motivo=motivo,
            comentario=str(dados.get("comentario") or "").strip()[:1000] or None,
        )
    )
    db.session.flush()
    if len(projeto.denuncias) >= current_app.config["LIMITE_DENUNCIAS"]:
        projeto.oculto = True
    db.session.commit()
    return jsonify({"mensagem": "Denúncia enviada. A equipe vai revisar este projeto."}), 201


@bp.post("/api/projetos/<int:projeto_id>/destaque")
def api_destacar(projeto_id):
    """Para o painel de admin (Pessoa 5): {"destaque": true} coloca na faixa desta semana."""
    usuaria = usuaria_atual()
    if not usuaria or not usuaria.e_admin:
        return _erro("Só administradoras podem destacar projetos.", 403)

    projeto = _projeto_visivel(projeto_id)
    destacar = bool((request.get_json(silent=True) or {}).get("destaque", True))
    projeto.destaque = destacar
    projeto.destaque_semana = semana_atual() if destacar else None
    db.session.commit()
    return jsonify(servico.cartao(projeto))
