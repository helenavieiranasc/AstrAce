"""Regras da carta para o futuro: prazos, validação e relógio. Nada aqui fala com o HTTP."""
import calendar
from datetime import datetime

from ..catalogos import AREAS

ANOS_VALIDOS = (1, 2, 3, 5, 10)
LIMITES = {"nome": 60, "mensagem": 2500, "objetivos": 600}
MENSAGEM_MINIMA = 20  # uma carta de verdade tem mais que "oi"
AREAS_VALIDAS = {a["valor"] for a in AREAS}


def agora():
    """Hora do servidor (UTC). É a única fonte do relógio: os testes trocam esta função."""
    return datetime.utcnow()


def somar_anos(data, anos):
    """A mesma data daqui a `anos` anos. Em 29/02 de ano bissexto, cai em 28/02 se o destino não for bissexto."""
    ano = data.year + anos
    dia = min(data.day, calendar.monthrange(ano, data.month)[1])
    return data.replace(year=ano, day=dia)


def _texto(dados, campo):
    valor = dados.get(campo, "")
    return valor.strip() if isinstance(valor, str) else ""


def validar(dados, enviar):
    """Devolve (campos limpos, erros). Para enviar, a mensagem, o nome, a área e o prazo são obrigatórios."""
    limpos, erros = {}, {}
    for campo, limite in LIMITES.items():
        texto = _texto(dados, campo)
        if len(texto) > limite:
            erros[campo] = f"Use no máximo {limite} caracteres."
        limpos[campo] = texto

    area = _texto(dados, "area")
    if area and area not in AREAS_VALIDAS:
        erros["area"] = "Escolha uma área da lista."
    limpos["area"] = area

    anos = dados.get("anos")
    if anos in (None, ""):
        anos = None
    elif isinstance(anos, bool) or not isinstance(anos, int) or anos not in ANOS_VALIDOS:
        erros["anos"] = "Escolha um dos prazos da lista."
        anos = None
    limpos["anos"] = anos

    if enviar:
        for campo, texto in (("nome", "Escreva o seu nome."), ("area", "Escolha a sua área."),
                             ("mensagem", "Escreva a sua mensagem."), ("anos", "Escolha em quantos anos quer abrir a carta.")):
            if not limpos.get(campo):
                erros.setdefault(campo, texto)
        if limpos["mensagem"] and len(limpos["mensagem"]) < MENSAGEM_MINIMA:
            erros["mensagem"] = f"Escreva um pouco mais: pelo menos {MENSAGEM_MINIMA} caracteres."
    return limpos, erros
