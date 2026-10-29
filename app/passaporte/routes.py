from datetime import datetime

from flask import abort, jsonify, redirect, render_template, request, session, url_for

from .. import catalogos
from ..conta.routes import (
    CHECKIN_PENDENTE,
    _cadastro_completo,
    _erro,
    _formacoes,
    _usuaria_logada,
    guardar_checkin_pendente,
)
from ..eventos.models import Evento
from ..extensoes import db
from ..servicos import qr
from . import bp, certificados, servico
from .models import Carimbo

MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


def _dados_do_passaporte(usuaria):
    conta = usuaria.conta
    formacao = next((f for f in _formacoes(usuaria) if f.get("instituicao") or f.get("curso")), None)
    criada = usuaria.criada_em
    return {
        "nome": usuaria.nome_publico,
        "nome_completo": usuaria.nome,
        "membro_desde": f"{MESES[criada.month - 1]} {criada.year}",
        "nivel": catalogos.rotulo(catalogos.NIVEIS, usuaria.nivel) if usuaria.nivel else "",
        "area": catalogos.rotulo(catalogos.AREAS, usuaria.area_interesse) if usuaria.area_interesse else "",
        "instituicao": (formacao or {}).get("instituicao") or usuaria.instituicao or "",
        "local": ", ".join(p for p in (usuaria.cidade, conta.estado if conta else None) if p),
        "numero": f"AST{usuaria.id:06d}",
        # Só a foto enviada pela usuária (mesmo domínio): a do Google não pode ser desenhada na textura 3D.
        "foto_url": conta.foto_url if conta and conta.tem_foto_propria else None,
        "carimbos": [c.para_json() for c in servico.carimbos_de(usuaria)],
    }


@bp.get("/passaporte")
def pagina_passaporte():
    usuaria = _usuaria_logada()
    if not usuaria:
        return redirect(url_for("conta.landing"))
    if not _cadastro_completo(usuaria):
        return redirect(url_for("conta.pagina_cadastro"))
    # Quem já tinha conta antes do passaporte ganha o carimbo de boas-vindas aqui.
    servico.conceder_boas_vindas(usuaria)
    return render_template(
        "passaporte.html",
        passaporte=_dados_do_passaporte(usuaria),
        certificados=certificados.do_passaporte(usuaria),
    )


@bp.get("/checkin/<token>")
def pagina_checkin(token):
    """Destino do QR impresso no evento (gerado no painel de admin): confere e dá o carimbo."""
    evento = servico.evento_do_token(token)
    if not evento:
        return render_template("checkin.html", estado="invalido"), 404

    usuaria = _usuaria_logada()
    if not usuaria or not _cadastro_completo(usuaria):
        guardar_checkin_pendente(token)
        if usuaria:
            return redirect(url_for("conta.pagina_cadastro"))
        return render_template("checkin.html", estado="entrar", evento=evento)

    session.pop(CHECKIN_PENDENTE, None)
    if servico.carimbo_do_evento(usuaria, evento):
        estado = "repetido"
    else:
        estado = servico.janela_do_checkin(evento)
        if estado == "aberto":
            servico.carimbar_evento(usuaria, evento)
            estado = "carimbado"
    certificado = certificados.situacao(usuaria, evento) if estado in ("carimbado", "repetido") else None
    return render_template("checkin.html", estado=estado, evento=evento, certificado=certificado)


@bp.post("/api/passaporte/carimbos/<codigo>/visto")
def api_carimbo_visto(codigo):
    """Marca que a animação desse carimbo já passou, para não repetir em nenhum dispositivo."""
    usuaria = _usuaria_logada()
    if not usuaria:
        return _erro("Entre com sua conta Google para usar o passaporte.", 401)
    carimbo = Carimbo.query.filter_by(usuaria_id=usuaria.id, codigo=codigo).first()
    if not carimbo:
        return _erro("Esse carimbo não está no seu passaporte.", 404)
    if not carimbo.visto_em:
        carimbo.visto_em = datetime.utcnow()
        db.session.commit()
    return jsonify(carimbo.para_json())


# ---------- Certificados ----------


def _evento_ou_404(evento_id):
    evento = db.session.get(Evento, evento_id)
    if not evento:
        abort(404)
    return evento


@bp.get("/certificados/evento/<int:evento_id>")
def pagina_emitir_certificado(evento_id):
    """Antes do primeiro certificado de um evento, a usuária confere o nome que vai sair no papel."""
    usuaria = _usuaria_logada()
    if not usuaria:
        return redirect(url_for("conta.landing"))
    if not _cadastro_completo(usuaria):
        return redirect(url_for("conta.pagina_cadastro"))
    evento = _evento_ou_404(evento_id)
    situacao = certificados.situacao(usuaria, evento)
    if situacao == "emitido":
        codigo = certificados.certificado_do_evento(usuaria, evento).codigo
        return redirect(url_for("passaporte.pagina_certificado", codigo=codigo))
    return render_template(
        "certificado_emitir.html",
        situacao=situacao,
        evento=evento,
        nome=certificados.nome_sugerido(usuaria),
        liberado_em=evento.termino,
    ), (404 if situacao == "sem_checkin" else 200)


@bp.post("/api/certificados/evento/<int:evento_id>")
def api_emitir_certificado(evento_id):
    """{"nome": "..."} -> emite o certificado e devolve {"url"} da página dele."""
    usuaria = _usuaria_logada()
    if not usuaria or not _cadastro_completo(usuaria):
        return _erro("Entre com sua conta Google para emitir o certificado.", 401)
    if not request.is_json:
        return _erro("Envie os dados em JSON.", 415)
    evento = db.session.get(Evento, evento_id)
    if not evento:
        return _erro("Esse evento não existe.", 404)

    situacao = certificados.situacao(usuaria, evento)
    if situacao == "sem_checkin":
        return _erro("O certificado é de quem fez check-in no evento pelo QR code.", 403)
    if situacao == "aguardando":
        return _erro("O certificado fica pronto quando o evento terminar.", 409)

    nome, erro = certificados.validar_nome((request.get_json(silent=True) or {}).get("nome"))
    if erro:
        return _erro(erro, 422, erros={"nome": erro})
    certificado = certificados.emitir(usuaria, evento, nome)
    return jsonify({"url": url_for("passaporte.pagina_certificado", codigo=certificado.codigo)}), 201


@bp.get("/certificados/<codigo>")
def pagina_certificado(codigo):
    """O certificado para imprimir. Só a dona vê esta página; para as outras pessoas, vale a verificação."""
    certificado = certificados.por_codigo(codigo)
    usuaria = _usuaria_logada()
    if not certificado or not usuaria or certificado.usuaria_id != usuaria.id:
        return redirect(url_for("passaporte.pagina_verificar", codigo=codigo))
    dados = certificados.dados(certificado)
    return render_template(
        "certificado.html",
        c=dados,
        qr_svg=qr.svg(dados["link_verificacao"]),
        link_linkedin=certificados.link_linkedin(certificado),
    )


@bp.get("/verificar")
def pagina_verificar_form():
    """Quem recebeu um certificado impresso digita o código aqui (ou escaneia o QR)."""
    digitado = request.args.get("codigo")
    if digitado is None:
        return render_template("verificar.html", estado="digitar")
    codigo = certificados.normalizar_codigo(digitado)
    if not codigo:
        return render_template("verificar.html", estado="digitar", digitado=digitado, erro=True), 400
    return redirect(url_for("passaporte.pagina_verificar", codigo=codigo))


@bp.get("/verificar/<codigo>")
def pagina_verificar(codigo):
    """Página pública: confirma que o certificado existe e mostra só o que está impresso nele."""
    certificado = certificados.por_codigo(codigo)
    if not certificado:
        return render_template("verificar.html", estado="nao_encontrado", digitado=codigo), 404
    return render_template("verificar.html", estado="valido", c=certificados.dados(certificado))
