from flask import abort, jsonify, render_template, request

from .. import catalogos
from ..auth import usuaria_atual
from ..extensoes import db
from . import bp, servico
from .models import Vaga


def _erro(mensagem, status, **extra):
    return jsonify({"erro": mensagem, **extra}), status


def _vaga_visivel(vaga_id):
    vaga = db.session.get(Vaga, vaga_id)
    if not vaga or vaga.oculta:
        abort(404)
    return vaga


# ---------- Páginas ----------

@bp.get("/vagas")
def pagina_vagas():
    return render_template("vagas.html")


# ---------- API ----------

@bp.get("/api/vagas/opcoes")
def api_opcoes():
    return jsonify(
        {
            "tipos": servico.TIPOS_VAGA,
            "areas": catalogos.AREAS,
            "modalidades": servico.MODALIDADES_VAGA,
            "cidades": servico.valores_distintos(Vaga.cidade),
            "ordenacoes": servico.ORDENACOES,
        }
    )


@bp.get("/api/vagas")
def api_listar():
    filtros = {campo: request.args.get(campo, "").strip() for campo in (*servico.FILTROS, "q")}
    pagina = max(request.args.get("pagina", 1, type=int), 1)
    por_pagina = min(max(request.args.get("por_pagina", 12, type=int), 1), 48)

    itens, total = servico.consultar(filtros, pagina, por_pagina)
    return jsonify(
        {
            "itens": [servico.cartao(v) for v in itens],
            "total": total,
            "pagina": pagina,
            "tem_mais": pagina * por_pagina < total,
        }
    )


@bp.get("/api/vagas/<int:vaga_id>")
def api_detalhe(vaga_id):
    return jsonify(servico.detalhe(_vaga_visivel(vaga_id)))


@bp.post("/api/vagas")
def api_criar():
    """Para o painel de admin (Pessoa 5): cadastra uma nova vaga."""
    usuaria = usuaria_atual()
    if not usuaria or not usuaria.e_admin:
        return _erro("Só administradoras podem cadastrar vagas.", 403)

    dados = request.get_json(silent=True) or {}
    limpo, erros = servico.validar(dados)
    if erros:
        return _erro("Confira os campos marcados.", 422, erros=erros)

    vaga = Vaga(**limpo)
    db.session.add(vaga)
    db.session.commit()
    return jsonify(servico.detalhe(vaga)), 201


@bp.route("/api/vagas/<int:vaga_id>", methods=["PUT", "PATCH"])
def api_editar(vaga_id):
    """Para o painel de admin (Pessoa 5): edita uma vaga existente."""
    usuaria = usuaria_atual()
    if not usuaria or not usuaria.e_admin:
        return _erro("Só administradoras podem editar vagas.", 403)

    vaga = db.session.get(Vaga, vaga_id)
    if not vaga:
        abort(404)

    dados = request.get_json(silent=True) or {}
    limpo, erros = servico.validar(dados)
    if erros:
        return _erro("Confira os campos marcados.", 422, erros=erros)

    for chave, valor in limpo.items():
        setattr(vaga, chave, valor)
    db.session.commit()
    return jsonify(servico.detalhe(vaga))


@bp.post("/api/vagas/<int:vaga_id>/ocultar")
def api_ocultar(vaga_id):
    """Para o painel de admin (Pessoa 5): {"oculta": true} oculta ou reexibe a vaga."""
    usuaria = usuaria_atual()
    if not usuaria or not usuaria.e_admin:
        return _erro("Só administradoras podem ocultar vagas.", 403)

    vaga = db.session.get(Vaga, vaga_id)
    if not vaga:
        abort(404)

    corpo = request.get_json(silent=True) or {}
    if "oculta" in corpo:
        vaga.oculta = bool(corpo["oculta"])
    elif "oculto" in corpo:
        vaga.oculta = bool(corpo["oculto"])
    else:
        vaga.oculta = not vaga.oculta
    db.session.commit()
    return jsonify({"id": vaga.id, "oculta": vaga.oculta})
