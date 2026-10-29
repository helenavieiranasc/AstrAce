"""Quem pode usar o painel."""
from functools import wraps

from flask import jsonify, redirect, request, url_for

from ..auth import usuaria_atual


def admin_atual():
    """A administradora que está usando o site, ou None (o atalho LOGIN_DEV segue a regra de auth.py)."""
    usuaria = usuaria_atual()
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
