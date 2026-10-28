from collections import Counter, defaultdict
from datetime import date, timedelta

from flask import Response, abort, jsonify, render_template, request
from sqlalchemy import func, or_

from .. import catalogos
from ..eventos import catalogo as catalogo_eventos
from ..eventos import servico as servico_eventos
from ..eventos.models import Evento
from ..extensoes import db
from ..mural import servico as servico_mural
from ..mural.models import Denuncia, Projeto, semana_atual
from ..mural.tipos import MOTIVOS_DENUNCIA
from ..servicos import qr
from ..usuarias.models import Usuaria
from ..vagas import servico as servico_vagas
from ..vagas.models import Vaga
from . import bp, eventos
from .acesso import admin_atual, api_admin, pagina_admin
from .models import Moderacao

LIMITE_DESTAQUES = 5  # por semana; a vitrine do mural mostra no máximo isso
DIAS_PARA_RECONFERIR = 30  # vaga conferida há mais tempo que isso ganha o aviso "reconferir"
LIMITE_LISTA = 200


def _erro(mensagem, status, **extra):
    return jsonify({"erro": mensagem, **extra}), status


def _corpo():
    return request.get_json(silent=True) or {}


def _busca(colunas):
    texto = request.args.get("q", "").strip()
    if not texto:
        return None
    like = f"%{texto}%"
    return or_(*(coluna.ilike(like) for coluna in colunas))


@bp.app_context_processor
def _menu_admin():
    """Mostra o link do painel no menu lateral só para quem é admin."""
    return {"menu_admin": admin_atual() is not None}


# ---------- Páginas ----------


@bp.get("/admin")
@pagina_admin
def pagina_painel():
    return render_template("admin.html")


@bp.get("/admin/eventos/<int:evento_id>/cartaz")
@pagina_admin
def pagina_cartaz(evento_id):
    """Cartaz A4 de check-in para imprimir e colar na entrada do evento."""
    evento = db.get_or_404(Evento, evento_id)
    if not evento.token_qr:
        abort(404)
    link = eventos.link_checkin(evento)
    return render_template("admin_cartaz.html", evento=servico_eventos.cartao(evento), link=link, qr_svg=qr.svg(link))


@bp.get("/admin/eventos/<int:evento_id>/qr.<formato>")
@pagina_admin
def baixar_qr(evento_id, formato):
    if formato not in ("png", "svg"):
        abort(404)
    evento = db.get_or_404(Evento, evento_id)
    if not evento.token_qr:
        abort(404)
    resposta = Response(
        qr.arquivo(eventos.link_checkin(evento), formato),
        mimetype="image/png" if formato == "png" else "image/svg+xml",
    )
    if request.args.get("baixar"):
        resposta.headers["Content-Disposition"] = f'attachment; filename="qr-evento-{evento.id}.{formato}"'
    resposta.headers["Cache-Control"] = "no-store"  # o QR muda quando a equipe gera um novo
    return resposta


# ---------- Visão geral ----------


@bp.get("/api/admin/opcoes")
@api_admin
def api_opcoes():
    return jsonify(
        {
            "eventos": {
                "tipos": catalogo_eventos.TIPOS_EVENTO,
                "modalidades": catalogo_eventos.MODALIDADES,
                "publicos": catalogo_eventos.PUBLICOS,
            },
            "vagas": {
                "tipos": servico_vagas.TIPOS_VAGA,
                "modalidades": servico_vagas.MODALIDADES_VAGA,
            },
            "areas": catalogos.AREAS,
            "estados": catalogos.ESTADOS,
            "limite_destaques": LIMITE_DESTAQUES,
        }
    )


def _vagas_para_reconferir(hoje):
    return Vaga.query.filter(
        Vaga.oculta.is_(False), Vaga.data_coleta < hoje - timedelta(days=DIAS_PARA_RECONFERIR)
    ).count()


@bp.get("/api/admin/resumo")
@api_admin
def api_resumo():
    """Números de verdade do banco e o que a equipe precisa resolver."""
    hoje = date.today()
    agora = servico_eventos.agora()
    proximos = servico_eventos._visiveis()

    vagas_abertas = Vaga.query.filter(Vaga.oculta.is_(False), or_(Vaga.prazo.is_(None), Vaga.prazo >= hoje)).count()
    vagas_encerradas = Vaga.query.filter(Vaga.oculta.is_(False), Vaga.prazo < hoje).count()
    vagas_reconferir = _vagas_para_reconferir(hoje)
    fila = _fila_denuncias()
    destaques = len(_destaques())
    carimbo_semana = (
        proximos.filter(Evento.token_qr.isnot(None), Evento.inicio <= servico_eventos.fim_da_semana(agora))
        .order_by(Evento.inicio)
        .all()
    )

    pendencias = []
    if fila:
        pendencias.append({"aba": "moderacao", "texto": _plural(len(fila), "projeto denunciado espera", "projetos denunciados esperam") + " revisão."})
    for evento in carimbo_semana:
        pendencias.append(
            {
                "aba": "eventos",
                "texto": f"Imprima o cartaz de check-in de “{evento.titulo}” ({servico_eventos.rotulo_data(evento.inicio, evento.fim)}).",
                "link": f"/admin/eventos/{evento.id}/cartaz",
            }
        )
    if vagas_encerradas:
        pendencias.append({"aba": "vagas", "filtro": "encerradas", "texto": _plural(vagas_encerradas, "vaga com prazo encerrado continua", "vagas com prazo encerrado continuam") + " no site."})
    if vagas_reconferir:
        pendencias.append({"aba": "vagas", "texto": _plural(vagas_reconferir, "vaga foi conferida", "vagas foram conferidas") + f" há mais de {DIAS_PARA_RECONFERIR} dias."})
    if destaques < LIMITE_DESTAQUES:
        pendencias.append({"aba": "destaques", "texto": f"A vitrine desta semana tem {destaques} de {LIMITE_DESTAQUES} destaques."})

    return jsonify(
        {
            "numeros": [
                {"rotulo": "usuárias cadastradas", "valor": Usuaria.query.count()},
                {"rotulo": "projetos no mural", "valor": Projeto.query.filter(Projeto.oculto.is_(False)).count()},
                {"rotulo": "eventos na agenda", "valor": proximos.count()},
                {"rotulo": "eventos que dão carimbo", "valor": proximos.filter(Evento.token_qr.isnot(None)).count()},
                {"rotulo": "vagas abertas", "valor": vagas_abertas},
            ],
            "pendencias": pendencias,
        }
    )


def _plural(n, singular, plural):
    return f"{n} {singular if n == 1 else plural}"


# ---------- Eventos ----------


def _evento(evento_id):
    evento = db.session.get(Evento, evento_id)
    if not evento:
        abort(404)
    return evento


@bp.get("/api/admin/eventos")
@api_admin
def api_eventos():
    agora = servico_eventos.agora()
    termino = func.coalesce(Evento.fim, Evento.inicio)
    estados = {
        "proximos": (Evento.query.filter(Evento.oculto.is_(False), termino >= agora), Evento.inicio.asc()),
        "passados": (Evento.query.filter(Evento.oculto.is_(False), termino < agora), Evento.inicio.desc()),
        "ocultos": (Evento.query.filter(Evento.oculto.is_(True)), Evento.inicio.desc()),
    }
    busca = _busca((Evento.titulo, Evento.organizacao, Evento.cidade))
    if busca is not None:
        estados = {chave: (q.filter(busca), ordem) for chave, (q, ordem) in estados.items()}

    estado = request.args.get("estado", "proximos")
    if estado not in estados:
        estado = "proximos"
    consulta, ordem = estados[estado]
    return jsonify(
        {
            "itens": [eventos.ficha(e) for e in consulta.order_by(ordem, Evento.id).limit(LIMITE_LISTA)],
            "contagens": {chave: q.count() for chave, (q, _) in estados.items()},
        }
    )


@bp.get("/api/admin/eventos/<int:evento_id>")
@api_admin
def api_evento(evento_id):
    return jsonify(eventos.ficha(_evento(evento_id)))


@bp.post("/api/admin/eventos")
@api_admin
def api_criar_evento():
    limpo, erros, vale_carimbo = eventos.validar(_corpo())
    if erros:
        return _erro("Confira os campos marcados.", 422, erros=erros)
    evento = Evento(**limpo)
    eventos.definir_carimbo(evento, vale_carimbo)
    db.session.add(evento)
    db.session.commit()
    return jsonify(eventos.ficha(evento)), 201


@bp.put("/api/admin/eventos/<int:evento_id>")
@api_admin
def api_editar_evento(evento_id):
    evento = _evento(evento_id)
    limpo, erros, vale_carimbo = eventos.validar(_corpo())
    if erros:
        return _erro("Confira os campos marcados.", 422, erros=erros)
    for campo, valor in limpo.items():
        setattr(evento, campo, valor)
    eventos.definir_carimbo(evento, vale_carimbo)
    db.session.commit()
    return jsonify(eventos.ficha(evento))


@bp.post("/api/admin/eventos/<int:evento_id>/ocultar")
@api_admin
def api_ocultar_evento(evento_id):
    """{"oculto": true} tira da agenda; false mostra de novo. Nunca alterna sozinho."""
    corpo = _corpo()
    if not isinstance(corpo.get("oculto"), bool):
        return _erro('Diga se o evento fica oculto: {"oculto": true} ou {"oculto": false}.', 422)
    evento = _evento(evento_id)
    evento.oculto = corpo["oculto"]
    db.session.commit()
    return jsonify(eventos.ficha(evento))


@bp.post("/api/admin/eventos/<int:evento_id>/qr/novo")
@api_admin
def api_novo_qr(evento_id):
    """Troca o token: o QR antigo (e os cartazes impressos com ele) param de funcionar."""
    evento = _evento(evento_id)
    if not evento.token_qr:
        return _erro("Este evento não dá carimbo. Marque “Vale carimbo” na edição para criar o QR.", 422)
    evento.token_qr = eventos.novo_token()
    db.session.commit()
    return jsonify(eventos.ficha(evento))


# ---------- Vagas (gravar e ocultar ficam em /api/vagas, da Pessoa 4) ----------


def _ficha_vaga(vaga, hoje):
    dados = servico_vagas.detalhe(vaga, hoje=hoje)
    dados.update(
        {
            "oculta": vaga.oculta,
            "dias_desde_coleta": (hoje - vaga.data_coleta).days if vaga.data_coleta else None,
            "reconferir": bool(vaga.data_coleta and (hoje - vaga.data_coleta).days > DIAS_PARA_RECONFERIR),
            # O que foi marcado no cadastro (o cartão só mostra o selo quando há fonte).
            "marcadas": {
                "afirmativa_mulheres": vaga.afirmativa_mulheres,
                "afirmativa_negras": vaga.afirmativa_negras,
                "afirmativa_trans": vaga.afirmativa_trans,
            },
            "fonte_afirmacao": vaga.fonte_afirmacao or "",
        }
    )
    return dados


@bp.get("/api/admin/vagas")
@api_admin
def api_vagas():
    hoje = date.today()
    estados = {
        "no_site": Vaga.query.filter(Vaga.oculta.is_(False)),
        "encerradas": Vaga.query.filter(Vaga.oculta.is_(False), Vaga.prazo < hoje),
        "ocultas": Vaga.query.filter(Vaga.oculta.is_(True)),
    }
    busca = _busca((Vaga.titulo, Vaga.organizacao, Vaga.cidade))
    if busca is not None:
        estados = {chave: q.filter(busca) for chave, q in estados.items()}

    estado = request.args.get("estado", "no_site")
    consulta = estados.get(estado, estados["no_site"])
    itens = consulta.order_by(Vaga.criada_em.desc(), Vaga.id.desc()).limit(LIMITE_LISTA)
    return jsonify(
        {
            "itens": [_ficha_vaga(v, hoje) for v in itens],
            "contagens": {chave: q.count() for chave, q in estados.items()},
        }
    )


@bp.get("/api/admin/vagas/<int:vaga_id>")
@api_admin
def api_vaga(vaga_id):
    return jsonify(_ficha_vaga(db.get_or_404(Vaga, vaga_id), date.today()))


@bp.post("/api/admin/vagas/<int:vaga_id>/conferir")
@api_admin
def api_conferir_vaga(vaga_id):
    """A equipe abriu o edital de novo e está tudo igual: atualiza a data da conferência."""
    vaga = db.get_or_404(Vaga, vaga_id)
    vaga.data_coleta = date.today()
    db.session.commit()
    return jsonify(_ficha_vaga(vaga, date.today()))


# ---------- Moderação de denúncias ----------

ROTULOS_MOTIVO = {m["valor"]: m["rotulo"] for m in MOTIVOS_DENUNCIA}


def _fila_denuncias():
    """Projetos com denúncias que chegaram depois da última decisão da equipe sobre eles."""
    por_projeto = defaultdict(list)
    for denuncia in Denuncia.query.order_by(Denuncia.criada_em.desc()):
        por_projeto[denuncia.projeto_id].append(denuncia)

    decididos = dict(
        db.session.query(Moderacao.projeto_id, func.max(Moderacao.criada_em)).group_by(Moderacao.projeto_id).all()
    )
    fila = []
    for projeto_id, denuncias in por_projeto.items():
        decisao = decididos.get(projeto_id)
        if decisao is None or denuncias[0].criada_em > decisao:
            fila.append((denuncias[0].projeto, denuncias))
    # Os que já saíram do mural primeiro, depois os mais denunciados.
    fila.sort(key=lambda item: (not item[0].oculto, -len(item[1])))
    return fila


def _item_moderacao(projeto, denuncias):
    dados = servico_mural.cartao(projeto)
    motivos = Counter(d.motivo for d in denuncias)
    dados.update(
        {
            "oculto": projeto.oculto,
            "resumo": projeto.resumo,
            "link_externo": projeto.link_externo,
            "arquivos": [a.para_json() for a in projeto.arquivos],
            "total_denuncias": len(denuncias),
            "motivos": [{"rotulo": ROTULOS_MOTIVO.get(m, m), "total": n} for m, n in motivos.most_common()],
            "comentarios": [
                {"motivo": ROTULOS_MOTIVO.get(d.motivo, d.motivo), "texto": d.comentario, "quando": d.criada_em.strftime("%d/%m/%Y")}
                for d in denuncias
                if d.comentario
            ],
        }
    )
    return dados


@bp.get("/api/admin/denuncias")
@api_admin
def api_denuncias():
    return jsonify([_item_moderacao(p, lista) for p, lista in _fila_denuncias()])


@bp.post("/api/admin/projetos/<int:projeto_id>/moderar")
@api_admin
def api_moderar(projeto_id):
    """{"decisao": "restaurar"} volta ao mural e zera as denúncias;
    {"decisao": "fora_do_mural"} confirma que o projeto fica fora."""
    decisao = _corpo().get("decisao")
    if decisao not in ("restaurar", "fora_do_mural"):
        return _erro("Escolha entre voltar ao mural ou manter fora.", 422)
    projeto = db.get_or_404(Projeto, projeto_id)

    registro = Moderacao(
        projeto_id=projeto.id,
        titulo=projeto.titulo,
        decisao="restaurado" if decisao == "restaurar" else "fora_do_mural",
        denuncias=len(projeto.denuncias),
        admin_id=admin_atual().id,
    )
    if decisao == "restaurar":
        projeto.oculto = False
        # Sem isso, a próxima denúncia somaria às antigas e tiraria o projeto do mural de novo.
        projeto.denuncias.clear()
    else:
        projeto.oculto = True
    db.session.add(registro)
    db.session.commit()
    return jsonify({"id": projeto.id, "oculto": projeto.oculto})


# ---------- Destaques da semana ----------


def _destaques():
    return (
        Projeto.query.filter(
            Projeto.oculto.is_(False), Projeto.destaque.is_(True), Projeto.destaque_semana == semana_atual()
        )
        .order_by(Projeto.criado_em.desc())
        .all()
    )


@bp.get("/api/admin/destaques")
@api_admin
def api_destaques():
    return jsonify(
        {
            "semana": semana_atual(),
            "limite": LIMITE_DESTAQUES,
            "itens": [servico_mural.cartao(p) for p in _destaques()],
        }
    )


@bp.post("/api/admin/destaques/<int:projeto_id>")
@api_admin
def api_destacar(projeto_id):
    """{"destaque": true} põe na vitrine desta semana (no máximo 5); false tira."""
    destacar = _corpo().get("destaque")
    if not isinstance(destacar, bool):
        return _erro('Diga se o projeto entra na vitrine: {"destaque": true} ou {"destaque": false}.', 422)
    projeto = db.session.get(Projeto, projeto_id)
    if not projeto or projeto.oculto:
        abort(404)

    atuais = _destaques()
    if destacar and projeto not in atuais and len(atuais) >= LIMITE_DESTAQUES:
        return _erro(f"A vitrine desta semana já tem {LIMITE_DESTAQUES} projetos. Tire um antes de pôr outro.", 409)
    projeto.destaque = destacar
    projeto.destaque_semana = semana_atual() if destacar else None
    db.session.commit()
    return jsonify(servico_mural.cartao(projeto))
