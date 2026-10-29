from datetime import datetime

from flask import jsonify, redirect, render_template, session, url_for

from .. import catalogos
from ..conta.routes import (
    CHECKIN_PENDENTE,
    _cadastro_completo,
    _erro,
    _formacoes,
    _usuaria_logada,
    guardar_checkin_pendente,
)
from ..extensoes import db
from . import bp, servico
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
    return render_template("passaporte.html", passaporte=_dados_do_passaporte(usuaria))


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
    return render_template("checkin.html", estado=estado, evento=evento)


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
