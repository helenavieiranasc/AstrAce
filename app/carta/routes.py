from flask import jsonify, redirect, render_template, request, url_for

from ..catalogos import AREAS
from ..conta.routes import _usuaria_logada
from ..extensoes import db
from . import bp, servico
from .models import ABERTA, ADIADA, EM_CRIACAO, ENVIADA, CartaFuturo


def _erro(mensagem, status, **extra):
    return jsonify({"erro": mensagem, **extra}), status


def _carta_da(usuaria):
    return db.session.get(CartaFuturo, usuaria.id)


def _corpo(usuaria, carta):
    """A resposta da API. A mensagem só sai quando a carta é rascunho (da própria pessoa) ou já foi aberta."""
    agora = servico.agora()
    situacao = carta.situacao(agora) if carta else None
    if carta is None or carta.estado in (ADIADA, EM_CRIACAO):
        dados = carta.rascunho_json() if carta else None
    elif carta.estado == ABERTA:
        dados = carta.completa_json()
    else:  # enviada: selada, sem o conteúdo
        dados = carta.selada_json()
    return {
        "situacao": situacao,
        "carta": dados,
        "sugestoes": {"nome": usuaria.nome_publico, "area": usuaria.area_interesse or ""},
        "areas": AREAS,
        "anos_validos": list(servico.ANOS_VALIDOS),
        "agora": agora.isoformat(),
    }


# ---------- Páginas ----------


def _pagina(modelo):
    usuaria = _usuaria_logada()
    if not usuaria:
        return redirect(url_for("conta.landing"))
    return render_template(modelo, nome=usuaria.nome_publico)


@bp.get("/carta/convite")
def pagina_convite():
    return _pagina("carta_convite.html")


@bp.get("/carta/escrever")
def pagina_escrever():
    return _pagina("carta_escrever.html")


@bp.get("/carta/abrir")
def pagina_abrir():
    return _pagina("carta_abrir.html")


@bp.post("/carta/adiar")
def adiar():
    """"Não quero criar agora": grava a decisão para o convite não voltar sozinho. Nunca bloqueia a entrada."""
    usuaria = _usuaria_logada()
    if not usuaria:
        return redirect(url_for("conta.landing"))
    if _carta_da(usuaria) is None:
        db.session.add(CartaFuturo(usuaria_id=usuaria.id, estado=ADIADA))
        db.session.commit()
    return redirect(url_for("conta.landing"))


# ---------- API (sempre da usuária logada; nenhuma rota recebe id de outra pessoa) ----------


@bp.get("/api/carta")
def api_carta():
    usuaria = _usuaria_logada()
    if not usuaria:
        return _erro("Entre com sua conta para ver sua carta.", 401)
    return jsonify(_corpo(usuaria, _carta_da(usuaria)))


@bp.put("/api/carta")
def api_salvar_rascunho():
    """Guarda o que a pessoa já escreveu, sem enviar. Só enquanto a carta não foi selada."""
    usuaria = _usuaria_logada()
    if not usuaria:
        return _erro("Entre com sua conta para salvar sua carta.", 401)
    carta = _carta_da(usuaria)
    if carta and carta.estado in (ENVIADA, ABERTA):
        return _erro("Sua carta já foi enviada para o futuro e não pode mais ser alterada.", 409)
    limpos, erros = servico.validar(request.get_json(silent=True) or {}, enviar=False)
    if erros:
        return _erro("Revise os campos destacados.", 422, erros=erros)
    if carta is None:
        carta = CartaFuturo(usuaria_id=usuaria.id)
        db.session.add(carta)
    _gravar(carta, limpos)
    carta.estado = EM_CRIACAO
    db.session.commit()
    return jsonify(_corpo(usuaria, carta))


@bp.post("/api/carta/enviar")
def api_enviar():
    """Sela a carta. Exige confirmação explícita e só acontece uma vez; a resposta só vem depois de gravar."""
    usuaria = _usuaria_logada()
    if not usuaria:
        return _erro("Entre com sua conta para enviar sua carta.", 401)
    dados = request.get_json(silent=True) or {}
    carta = _carta_da(usuaria)
    if carta and carta.estado in (ENVIADA, ABERTA):
        return _erro("Sua carta já foi enviada para o futuro.", 409, **_corpo(usuaria, carta))
    if dados.get("confirmar") is not True:
        return _erro("Confirme o envio para selar a carta.", 422)
    limpos, erros = servico.validar(dados, enviar=True)
    if erros:
        return _erro("Falta preencher alguns campos para enviar.", 422, erros=erros)
    if carta is None:
        carta = CartaFuturo(usuaria_id=usuaria.id)
        db.session.add(carta)
    _gravar(carta, limpos)
    agora = servico.agora()
    carta.estado = ENVIADA
    carta.enviada_em = agora
    carta.revela_em = servico.somar_anos(agora, limpos["anos"])  # a data vem do servidor, nunca do navegador
    db.session.commit()
    return jsonify(_corpo(usuaria, carta))


@bp.post("/api/carta/abrir")
def api_abrir():
    """Revela a mensagem, mas só depois da data de revelação (conferida aqui, não no navegador)."""
    usuaria = _usuaria_logada()
    if not usuaria:
        return _erro("Entre com sua conta para abrir sua carta.", 401)
    carta = _carta_da(usuaria)
    if carta is None or carta.estado not in (ENVIADA, ABERTA):
        return _erro("Você ainda não enviou uma carta para o futuro.", 404)
    agora = servico.agora()
    if carta.estado == ENVIADA:
        if agora < carta.revela_em:
            return _erro("Ainda não chegou a hora de abrir esta carta.", 403,
                         revela_em=carta.revela_em.isoformat(), situacao="aguardando")
        carta.estado = ABERTA
        carta.aberta_em = agora
        db.session.commit()
    return jsonify(_corpo(usuaria, carta))


def _gravar(carta, limpos):
    carta.nome_exibicao = limpos["nome"]
    carta.area = limpos["area"]
    carta.mensagem = limpos["mensagem"]
    carta.objetivos = limpos["objetivos"]
    carta.anos = limpos["anos"]
