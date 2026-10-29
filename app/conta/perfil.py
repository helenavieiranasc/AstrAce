"""Página do perfil e gerenciamento das próprias publicações (projetos do mural).

As publicações são os projetos do mural: aqui só se lista, edita e exclui o que é
da usuária logada. A criação continua em /mural/novo.
"""
from flask import jsonify, redirect, render_template, request, url_for

from .. import catalogos
from ..extensoes import db
from ..mural import servico
from ..mural.models import Projeto, semana_atual
from . import bp
from .routes import _cadastro_completo, _erro, _formacoes, _usuaria_logada

# Editar e excluir seguem as regras de mural/servico.py (as mesmas do mural, onde a admin também pode).


@bp.get("/perfil")
def pagina_perfil():
    usuaria = _usuaria_logada()
    if not usuaria:
        return redirect(url_for("conta.landing"))
    if not _cadastro_completo(usuaria):
        return redirect(url_for("conta.pagina_cadastro"))

    from ..passaporte import certificados  # import aqui: o passaporte também importa a conta

    conta = usuaria.conta
    publicas = {i.identidade for i in usuaria.identidades if i.publica}
    return render_template(
        "perfil.html",
        usuaria=usuaria,
        foto_url=conta.foto_exibida,
        nivel=catalogos.rotulo(catalogos.NIVEIS, usuaria.nivel) if usuaria.nivel else None,
        area=catalogos.rotulo(catalogos.AREAS, usuaria.area_interesse) if usuaria.area_interesse else None,
        formacoes=_formacoes(usuaria),
        escola=usuaria.instituicao if usuaria.nivel == "ensino_medio" else None,
        local=", ".join(p for p in (usuaria.cidade, conta.estado) if p),
        identidades=[i["rotulo"] for i in catalogos.IDENTIDADES if i["valor"] in publicas],
        certificados=certificados.do_passaporte(usuaria),
        salvo=request.args.get("salvo") == "1",
    )


# ---------- API das próprias publicações ----------


def _da_usuaria(projeto_id):
    """(usuaria, projeto, resposta_de_erro). A dona é conferida aqui, no servidor."""
    usuaria = _usuaria_logada()
    if not usuaria:
        return None, None, _erro("Entre com sua conta Google para mexer nas suas publicações.", 401)
    projeto = db.session.get(Projeto, projeto_id)
    if not projeto:
        return usuaria, None, _erro("Não encontramos essa publicação. Ela pode ter sido excluída.", 404)
    if projeto.usuaria_id != usuaria.id:
        return usuaria, None, _erro("Você só pode mudar as suas próprias publicações.", 403)
    return usuaria, projeto, None


def _estado(projeto):
    if projeto.oculto:
        return {"valor": "oculto", "rotulo": "Fora do mural",
                "ajuda": "Recebeu denúncias e saiu do mural até a equipe revisar."}
    if projeto.destaque and projeto.destaque_semana == semana_atual():
        return {"valor": "destaque", "rotulo": "Destaque da semana", "ajuda": None}
    return {"valor": "publicado", "rotulo": "No mural", "ajuda": None}


def _item(projeto):
    dados = servico.cartao(projeto)
    dados.update({
        "criado_em": projeto.criado_em.isoformat(),
        "fotos": len(projeto.fotos),
        "arquivos": len(projeto.materiais),
        "estado": _estado(projeto),
        "url": f"/mural?projeto={projeto.id}",
    })
    return dados


@bp.get("/api/minhas-publicacoes")
def api_minhas_publicacoes():
    usuaria = _usuaria_logada()
    if not usuaria:
        return _erro("Entre com sua conta Google para ver suas publicações.", 401)
    projetos = Projeto.query.filter_by(usuaria_id=usuaria.id).order_by(Projeto.criado_em.desc()).all()
    return jsonify({"itens": [_item(p) for p in projetos]})


@bp.get("/api/minhas-publicacoes/<int:projeto_id>")
def api_publicacao_para_editar(projeto_id):
    _, projeto, erro = _da_usuaria(projeto_id)
    if erro:
        return erro
    return jsonify(servico.para_editar(projeto))


@bp.patch("/api/minhas-publicacoes/<int:projeto_id>")
def api_editar_publicacao(projeto_id):
    _, projeto, erro = _da_usuaria(projeto_id)
    if erro:
        return erro
    erros = servico.editar(projeto, request.get_json(silent=True) or {})
    if erros:
        return _erro("Confira os campos marcados.", 422, erros=erros)
    return jsonify({"item": _item(projeto)})


@bp.delete("/api/minhas-publicacoes/<int:projeto_id>")
def api_excluir_publicacao(projeto_id):
    _, projeto, erro = _da_usuaria(projeto_id)
    if erro:
        return erro
    servico.excluir(projeto)
    return jsonify({"excluido": projeto_id})
