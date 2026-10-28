from datetime import datetime

from flask import jsonify, redirect, render_template, url_for

from .. import catalogos
from ..conta.routes import _cadastro_completo, _erro, _formacoes, _usuaria_logada
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
