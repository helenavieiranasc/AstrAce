from flask import abort, jsonify, render_template, request

from .. import catalogos
from ..auth import usuaria_atual
from ..extensoes import db
from . import bp, servico
from .models import Noticia


def _erro(mensagem, status, **extra):
    return jsonify({"erro": mensagem, **extra}), status


def _noticia_visivel(noticia_id):
    noticia = db.session.get(Noticia, noticia_id)
    if not noticia or noticia.oculta:
        abort(404)
    return noticia


# ---------- Páginas ----------

@bp.get("/noticias")
def pagina_noticias():
    return render_template("noticias.html")


# ---------- API ----------

@bp.get("/api/noticias/opcoes")
def api_opcoes():
    return jsonify(
        {
            "categorias": servico.CATEGORIAS_NOTICIA,
            "areas": catalogos.AREAS,
            "ordenacoes": servico.ORDENACOES,
        }
    )


@bp.get("/api/noticias")
def api_listar():
    filtros = {campo: request.args.get(campo, "").strip() for campo in (*servico.FILTROS, "q")}
    pagina = max(request.args.get("pagina", 1, type=int), 1)
    por_pagina = min(max(request.args.get("por_pagina", 12, type=int), 1), 48)

    itens, total = servico.consultar(filtros, pagina, por_pagina)
    return jsonify(
        {
            "itens": [servico.cartao(n) for n in itens],
            "total": total,
            "pagina": pagina,
            "tem_mais": pagina * por_pagina < total,
        }
    )


@bp.get("/api/noticias/destaques")
def api_destaques():
    return jsonify([servico.cartao(n) for n in servico.destaques()])


@bp.get("/api/noticias/<int:noticia_id>")
def api_detalhe(noticia_id):
    return jsonify(servico.detalhe(_noticia_visivel(noticia_id)))


@bp.post("/api/noticias")
def api_criar():
    usuaria = usuaria_atual()
    if not usuaria or not usuaria.e_admin:
        return _erro("Só administradoras podem publicar notícias.", 403)

    dados = request.get_json(silent=True) or {}
    limpo, erros = servico.validar(dados)
    if erros:
        return _erro("Confira os campos marcados.", 422, erros=erros)

    noticia = Noticia(**limpo)
    db.session.add(noticia)
    db.session.commit()
    return jsonify(servico.detalhe(noticia)), 201


@bp.route("/api/noticias/<int:noticia_id>", methods=["PUT", "PATCH"])
def api_editar(noticia_id):
    usuaria = usuaria_atual()
    if not usuaria or not usuaria.e_admin:
        return _erro("Só administradoras podem editar notícias.", 403)

    noticia = db.session.get(Noticia, noticia_id)
    if not noticia:
        abort(404)

    dados = request.get_json(silent=True) or {}
    limpo, erros = servico.validar(dados)
    if erros:
        return _erro("Confira os campos marcados.", 422, erros=erros)

    for chave, valor in limpo.items():
        setattr(noticia, chave, valor)
    db.session.commit()
    return jsonify(servico.detalhe(noticia))


@bp.post("/api/noticias/<int:noticia_id>/ocultar")
def api_ocultar(noticia_id):
    usuaria = usuaria_atual()
    if not usuaria or not usuaria.e_admin:
        return _erro("Só administradoras podem ocultar notícias.", 403)

    noticia = db.session.get(Noticia, noticia_id)
    if not noticia:
        abort(404)

    corpo = request.get_json(silent=True) or {}
    if "oculta" in corpo:
        noticia.oculta = bool(corpo["oculta"])
    else:
        noticia.oculta = not noticia.oculta
    db.session.commit()
    return jsonify({"id": noticia.id, "oculta": noticia.oculta})
