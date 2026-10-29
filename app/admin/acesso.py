"""Quem pode usar o painel."""
from functools import wraps

from flask import current_app, jsonify, redirect, request, session, url_for

from ..extensoes import db
from ..usuarias.models import Usuaria


def admin_atual():
    """A administradora que está usando o site, ou None.

    O atalho LOGIN_DEV (agir como a primeira usuária do banco) só vale em modo debug e nos testes:
    com o site no ar, ele daria o painel para qualquer visitante.
    """
    uid = session.get("usuaria_id")
    usuaria = db.session.get(Usuaria, uid) if uid else None
    if usuaria is None and current_app.config.get("LOGIN_DEV") and (current_app.debug or current_app.testing):
        usuaria = Usuaria.query.order_by(Usuaria.id).first()
    return usuaria if usuaria and usuaria.e_admin else None


def api_admin(view):
    """Rotas da API do painel: 403 para quem não é admin.

    Quem grava precisa mandar JSON. Um formulário de outro site não consegue enviar JSON
    sem o navegador pedir licença antes, então ele não dispara ações aqui por engano.
    """

    @wraps(view)
    def protegida(*args, **kwargs):
        if not admin_atual():
            return jsonify({"erro": "Só administradoras podem fazer isso. Entre com a conta da equipe."}), 403
        if request.method != "GET" and not request.is_json:
            return jsonify({"erro": "Envie os dados em JSON."}), 415
        return view(*args, **kwargs)

    return protegida


def pagina_admin(view):
    """Páginas do painel: quem não é admin volta para o início."""

    @wraps(view)
    def protegida(*args, **kwargs):
        if not admin_atual():
            return redirect(url_for("conta.landing"))
        return view(*args, **kwargs)

    return protegida
