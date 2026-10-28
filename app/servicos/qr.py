"""QR codes do site: check-in nos eventos e, depois, verificação de certificados.

Usado pelo painel de admin (Pessoa 5) e pelo passaporte (Pessoa 2).

    from app.servicos import qr
    qr.svg(qr.endereco_publico(f"/checkin/{token}"))
"""
import io

import segno
from flask import current_app, request

COR = "#2a1c15"  # --tinta do base.css


def endereco_publico(caminho):
    """Endereço completo que o celular vai abrir. Usa URL_PUBLICA quando o site está no ar."""
    base = current_app.config.get("URL_PUBLICA") or request.host_url
    return base.rstrip("/") + "/" + caminho.lstrip("/")


def _qr(conteudo):
    # Correção de erro alta (H): o código continua legível com a estrela da logo cobrindo o meio.
    return segno.make(conteudo, error="h", micro=False)


def svg(conteudo, escala=10):
    """<svg> para pôr direto no HTML. Sem largura fixa: ocupa o espaço que o CSS der."""
    return _qr(conteudo).svg_inline(scale=escala, dark=COR, border=2, omitsize=True)


def arquivo(conteudo, formato="png"):
    """Bytes do QR em PNG (para imprimir ou mandar no grupo) ou SVG (para gráficas)."""
    saida = io.BytesIO()
    if formato == "svg":
        _qr(conteudo).save(saida, kind="svg", scale=10, dark=COR, border=2)
    else:
        _qr(conteudo).save(saida, kind="png", scale=16, dark=COR, border=2)
    return saida.getvalue()
