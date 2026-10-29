"""Página do perfil e gerenciamento das próprias publicações (projetos do mural).

As publicações são os projetos do mural: aqui só se lista, edita e exclui o que é
da usuária logada. A criação continua em /mural/novo.
"""
from flask import current_app, jsonify, redirect, render_template, request, url_for

from .. import catalogos
from ..extensoes import db
from ..mural import servico
from ..mural.models import Estrela, Projeto, semana_atual
from ..mural.tipos import TIPOS_POR_VALOR
from ..uploads.routes import pasta_uploads
from . import bp
from .routes import _cadastro_completo, _erro, _formacoes, _usuaria_logada

# Campos que a edição aceita. Tipo, arquivos, fotos e capa não mudam por aqui.
CAMPOS_EDITAVEIS = ("titulo", "resumo", "area", "ano", "nivel", "instituicao", "cidade", "uf", "link_externo", "detalhes")


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
    tipo = TIPOS_POR_VALOR.get(projeto.tipo, {"campos": [], "rotulo": projeto.tipo})
    return jsonify({
        "projeto": {
            "id": projeto.id,
            "tipo": projeto.tipo,
            "tipo_rotulo": tipo["rotulo"],
            "titulo": projeto.titulo,
            "resumo": projeto.resumo,
            "area": projeto.area,
            "ano": projeto.ano,
            "nivel": projeto.nivel or "",
            "instituicao": projeto.instituicao or "",
            "cidade": projeto.cidade or "",
            "link_externo": projeto.link_externo or "",
            "detalhes": projeto.detalhes or {},
            "arquivos": len(projeto.materiais),
            "fotos": len(projeto.fotos),
        },
        "campos_extras": tipo["campos"],
        "material": tipo.get("material"),
        "opcoes": {"areas": catalogos.AREAS, "niveis": catalogos.NIVEIS},
    })


@bp.patch("/api/minhas-publicacoes/<int:projeto_id>")
def api_editar_publicacao(projeto_id):
    usuaria, projeto, erro = _da_usuaria(projeto_id)
    if erro:
        return erro

    enviados = request.get_json(silent=True) or {}
    dados = {campo: enviados.get(campo) for campo in CAMPOS_EDITAVEIS}
    # A validação é a mesma do cadastro do mural; tipo, arquivos e capa ficam como estão.
    dados.update({"tipo": projeto.tipo, "imagem_url": None, "arquivos": [], "fotos": []})
    limpo, erros, _ = servico.validar(dados, usuaria)

    # O material exigido pelo tipo conta os arquivos que o projeto já tem.
    for campo in ("arquivos", "fotos", "imagem_url"):
        erros.pop(campo, None)
    material = TIPOS_POR_VALOR[projeto.tipo]["material"]
    tem_arquivo = bool(projeto.materiais) or (material["fotos_contam"] and bool(projeto.fotos))
    tem_link = bool(limpo.get("link_externo"))
    if material["exige"] == "link" and not tem_link:
        erros.setdefault("link_externo", material["erro"])
    elif material["exige"] == "um_dos_dois" and not (tem_arquivo or tem_link):
        erros.setdefault("link_externo", "Esta publicação não tem arquivo: deixe um link para mostrar o trabalho.")

    if erros:
        return _erro("Confira os campos marcados.", 422, erros=erros)

    for campo in CAMPOS_EDITAVEIS:
        setattr(projeto, campo, limpo[campo])
    db.session.commit()
    return jsonify({"item": _item(projeto)})


@bp.delete("/api/minhas-publicacoes/<int:projeto_id>")
def api_excluir_publicacao(projeto_id):
    _, projeto, erro = _da_usuaria(projeto_id)
    if erro:
        return erro

    nomes = [a.nome_salvo for a in projeto.arquivos]
    # Estrela não tem relação no modelo (o ON DELETE CASCADE não vale no SQLite sem foreign_keys).
    Estrela.query.filter_by(projeto_id=projeto.id).delete()
    db.session.delete(projeto)  # denúncias e registros de arquivos vão juntos (cascade)
    db.session.commit()

    pasta = pasta_uploads()
    for nome in nomes:
        try:
            (pasta / nome).unlink(missing_ok=True)
        except OSError as falha:
            current_app.logger.warning("Não deu para apagar o arquivo %s: %s", nome, falha)
    return jsonify({"excluido": projeto_id})

