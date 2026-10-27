"""Fluxo OAuth 2.0 do Google (authorization code), só com a biblioteca padrão.

O perfil vem do endpoint userinfo, chamado direto no Google com o access token,
então não é preciso validar a assinatura do id_token.
"""
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import current_app, url_for

URL_AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth"
URL_TOKEN = "https://oauth2.googleapis.com/token"
URL_PERFIL = "https://openidconnect.googleapis.com/v1/userinfo"
TEMPO_LIMITE = 10


class ErroGoogle(Exception):
    """Falha ao falar com o Google. A mensagem vai para o log, não para a usuária."""


def configurado():
    cfg = current_app.config
    return bool(cfg.get("GOOGLE_CLIENT_ID") and cfg.get("GOOGLE_CLIENT_SECRET"))


def endereco_retorno():
    return current_app.config.get("GOOGLE_REDIRECT_URI") or url_for("conta.google_retorno", _external=True)


def url_de_login(estado):
    parametros = {
        "client_id": current_app.config["GOOGLE_CLIENT_ID"],
        "redirect_uri": endereco_retorno(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": estado,
        "prompt": "select_account",
    }
    return f"{URL_AUTORIZACAO}?{urlencode(parametros)}"


def _ler_json(requisicao):
    try:
        with urlopen(requisicao, timeout=TEMPO_LIMITE) as resposta:
            return json.loads(resposta.read().decode("utf-8"))
    except HTTPError as erro:
        corpo = erro.read().decode("utf-8", "replace")[:300]
        raise ErroGoogle(f"{requisicao.full_url} respondeu {erro.code}: {corpo}") from erro
    except (URLError, TimeoutError, ValueError) as erro:
        raise ErroGoogle(f"{requisicao.full_url} falhou: {erro}") from erro


def trocar_codigo(codigo):
    """Troca o código de autorização pelo access token."""
    dados = urlencode({
        "code": codigo,
        "client_id": current_app.config["GOOGLE_CLIENT_ID"],
        "client_secret": current_app.config["GOOGLE_CLIENT_SECRET"],
        "redirect_uri": endereco_retorno(),
        "grant_type": "authorization_code",
    }).encode()
    resposta = _ler_json(Request(URL_TOKEN, data=dados, method="POST"))
    token = resposta.get("access_token")
    if not token:
        raise ErroGoogle("O Google não devolveu access_token.")
    return token


def buscar_perfil(token):
    """Devolve {sub, email, email_verified, name, given_name, picture}."""
    requisicao = Request(URL_PERFIL, headers={"Authorization": f"Bearer {token}"})
    perfil = _ler_json(requisicao)
    if not perfil.get("sub") or not perfil.get("email"):
        raise ErroGoogle("O perfil do Google veio sem sub ou e-mail.")
    return perfil
