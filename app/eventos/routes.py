from flask import abort, jsonify, render_template, request

from .. import catalogos
from ..extensoes import db
from . import bp, catalogo, servico
from .models import Evento


def _evento_visivel(evento_id):
    evento = db.session.get(Evento, evento_id)
    if not evento or evento.oculto:
        abort(404)
    return evento


# ---------- Páginas ----------


@bp.get("/eventos")
def pagina_eventos():
    return render_template("eventos.html")


# ---------- API ----------


@bp.get("/api/eventos/opcoes")
def api_opcoes():
    return jsonify(
        {
            "modalidades": catalogo.MODALIDADES,
            "publicos": catalogo.PUBLICOS,
            "tipos": catalogo.TIPOS_EVENTO,
            "areas": catalogos.AREAS,
            "cidades": servico.cidades(),
        }
    )


@bp.get("/api/eventos")
def api_listar():
    filtros = {campo: request.args.get(campo, "").strip() for campo in servico.FILTROS}
    pagina = max(request.args.get("pagina", 1, type=int), 1)
    por_pagina = min(max(request.args.get("por_pagina", 12, type=int), 1), 48)

    itens, total = servico.consultar(filtros, pagina, por_pagina)
    return jsonify(
        {
            "itens": [servico.cartao(e) for e in itens],
            "total": total,
            "pagina": pagina,
            "tem_mais": pagina * por_pagina < total,
        }
    )


@bp.get("/api/eventos/semana")
def api_semana():
    return jsonify([servico.cartao(e) for e in servico.da_semana()])


@bp.get("/api/eventos/proximo")
def api_proximo():
    """Para o cartaz do mural. Devolve null quando não há eventos na agenda."""
    evento = servico.proximo()
    return jsonify(servico.cartao(evento) if evento else None)


@bp.get("/api/eventos/<int:evento_id>")
def api_detalhe(evento_id):
    return jsonify(servico.detalhe(_evento_visivel(evento_id)))
