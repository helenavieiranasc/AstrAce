"""Cadastro de eventos pelo painel: validação, token do QR e o formato JSON do admin."""
import secrets
from datetime import datetime
from urllib.parse import urlparse

from .. import catalogos
from ..eventos import catalogo, servico
from ..servicos import qr


def _texto(dados, nome, limite):
    valor = dados.get(nome)
    return "" if valor is None else str(valor).strip()[:limite]


def _ativo(valor):
    if isinstance(valor, bool):
        return valor
    return str(valor or "").strip().lower() in ("1", "true", "sim", "on")


def _url_valida(valor):
    partes = urlparse(valor or "")
    return partes.scheme in ("http", "https") and bool(partes.netloc)


def _data_hora(valor):
    """Aceita o formato do <input type="datetime-local"> (2026-11-02T14:00). Horário de Brasília, sem fuso."""
    texto = str(valor or "").strip()
    if not texto:
        return None
    data = datetime.fromisoformat(texto)  # ValueError se vier errado
    return data.replace(tzinfo=None, second=0, microsecond=0)


def validar(dados):
    """Devolve (campos_limpos, erros, vale_carimbo). Mesmo formato de vagas/servico.validar."""
    erros, limpo = {}, {}

    limpo["titulo"] = _texto(dados, "titulo", 160)
    if len(limpo["titulo"]) < 4:
        erros["titulo"] = "Escreva o nome do evento (pelo menos 4 letras)."

    limpo["descricao"] = _texto(dados, "descricao", 3000)
    if len(limpo["descricao"]) < 20:
        erros["descricao"] = "Conte em pelo menos 20 caracteres o que vai acontecer no evento."

    limpo["tipo"] = _texto(dados, "tipo", 30)
    if limpo["tipo"] not in catalogos.valores(catalogo.TIPOS_EVENTO):
        erros["tipo"] = "Escolha o tipo de evento."

    limpo["organizacao"] = _texto(dados, "organizacao", 160) or None

    try:
        limpo["inicio"] = _data_hora(dados.get("inicio"))
        if not limpo["inicio"]:
            erros["inicio"] = "Informe o dia e a hora em que o evento começa."
    except ValueError:
        limpo["inicio"] = None
        erros["inicio"] = "Use uma data e hora válidas, como 02/11/2026 14:00."

    try:
        limpo["fim"] = _data_hora(dados.get("fim"))
    except ValueError:
        limpo["fim"] = None
        erros["fim"] = "Use uma data e hora válidas, como 02/11/2026 17:00."
    if limpo["inicio"] and limpo["fim"] and limpo["fim"] <= limpo["inicio"]:
        erros["fim"] = "O fim precisa ser depois do início."

    limpo["modalidade"] = _texto(dados, "modalidade", 20)
    if limpo["modalidade"] not in catalogos.valores(catalogo.MODALIDADES):
        erros["modalidade"] = "Escolha se é presencial, online ou híbrido."

    if limpo["modalidade"] == "online":
        # Online não tem endereço: assim o evento não aparece no filtro de cidade.
        limpo["local"] = limpo["cidade"] = limpo["uf"] = None
    else:
        limpo["local"] = _texto(dados, "local", 200) or None
        limpo["cidade"] = _texto(dados, "cidade", 120) or None
        limpo["uf"] = _texto(dados, "uf", 2).upper() or None
        if not limpo["local"]:
            erros["local"] = "Informe o lugar e o endereço, para quem vai chegar lá."
        if not limpo["cidade"]:
            erros["cidade"] = "Informe a cidade do evento."
        if limpo["uf"] not in catalogos.valores(catalogos.ESTADOS):
            erros["uf"] = "Escolha o estado."

    limpo["link"] = _texto(dados, "link", 500)
    if not _url_valida(limpo["link"]):
        erros["link"] = "Cole o link da inscrição ou da página oficial, começando com https://."

    limpo["gratuito"] = _ativo(dados.get("gratuito", True))

    limpo["publico_alvo"] = _texto(dados, "publico_alvo", 30) or "todas"
    if limpo["publico_alvo"] not in catalogos.valores(catalogo.PUBLICOS):
        erros["publico_alvo"] = "Escolha para quem é o evento."

    limpo["area"] = _texto(dados, "area", 40) or None
    if limpo["area"] and limpo["area"] not in catalogos.valores(catalogos.AREAS):
        erros["area"] = "Escolha uma área da lista (ou deixe em branco se forem várias)."

    limpo["imagem_url"] = _texto(dados, "imagem_url", 500) or None
    if limpo["imagem_url"] and not (limpo["imagem_url"].startswith("/uploads/") or _url_valida(limpo["imagem_url"])):
        erros["imagem_url"] = "Envie a imagem de novo."

    return limpo, erros, _ativo(dados.get("vale_carimbo"))


def novo_token():
    return secrets.token_urlsafe(16)


def definir_carimbo(evento, vale_carimbo):
    """Marcar cria o token (e o QR); desmarcar apaga. Editar o evento não muda um QR já impresso."""
    if vale_carimbo and not evento.token_qr:
        evento.token_qr = novo_token()
    elif not vale_carimbo:
        evento.token_qr = None


def link_checkin(evento):
    return qr.endereco_publico(f"/checkin/{evento.token_qr}") if evento.token_qr else None


def ficha(evento):
    """O detalhe público do evento, mais o que só a equipe vê."""
    dados = servico.detalhe(evento)
    dados.update(
        {
            "oculto": evento.oculto,
            "passado": evento.termino < servico.agora(),
            "vale_carimbo": evento.tem_carimbo,
            "link_checkin": link_checkin(evento),
            "link_bruto": evento.link,
        }
    )
    return dados
