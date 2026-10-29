"""Certificados de participação: quem fez check-in num evento recebe um, depois que o evento termina.

O check-in pelo QR (servico.carimbar_evento) é a prova de presença; aqui só emitimos e verificamos.
"""
import re
import secrets
from urllib.parse import urlencode

from sqlalchemy.exc import IntegrityError

from ..eventos.models import Evento
from ..eventos.servico import agora
from ..extensoes import db
from ..servicos import qr
from . import servico
from .models import Certificado

# Sem 0/O, 1/I/L e 5/S: o código também é digitado à mão em /verificar.
ALFABETO = "2346789ABCDEFGHJKMNPQRTUVWXYZ"
LETRAS_DO_CODIGO = 10  # 29^10 ≈ 4 * 10^14: ninguém acha o certificado de outra pessoa chutando

MESES_LONGOS = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


# ---------- Código ----------


def novo_codigo():
    letras = "".join(secrets.choice(ALFABETO) for _ in range(LETRAS_DO_CODIGO))
    return f"{letras[:5]}-{letras[5:]}"


def normalizar_codigo(texto):
    """Aceita o código como a pessoa digitou ("7kq3m xp9td", "7KQ3MXP9TD") e devolve "7KQ3M-XP9TD"."""
    letras = re.sub(r"[^0-9A-Z]", "", str(texto or "").upper())
    if len(letras) != LETRAS_DO_CODIGO:
        return None
    return f"{letras[:5]}-{letras[5:]}"


def por_codigo(codigo):
    codigo = normalizar_codigo(codigo)
    return Certificado.query.filter_by(codigo=codigo).first() if codigo else None


# ---------- Emissão ----------


def certificado_do_evento(usuaria, evento):
    return Certificado.query.filter_by(usuaria_id=usuaria.id, evento_id=evento.id).first()


def situacao(usuaria, evento, momento=None):
    """'sem_checkin', 'aguardando' (o evento ainda não terminou), 'pronto' (pode emitir) ou 'emitido'."""
    if certificado_do_evento(usuaria, evento):
        return "emitido"
    if not servico.carimbo_do_evento(usuaria, evento):
        return "sem_checkin"
    if (momento or agora()) < evento.termino:
        return "aguardando"
    return "pronto"


def nome_sugerido(usuaria):
    """O nome do último certificado (a pessoa já corrigiu uma vez) ou o nome completo do cadastro."""
    ultimo = (
        Certificado.query.filter_by(usuaria_id=usuaria.id).order_by(Certificado.emitido_em.desc()).first()
    )
    return ultimo.nome if ultimo else usuaria.nome


def validar_nome(texto):
    """Devolve (nome, erro). Nome do jeito que vai sair no papel: nome social é bem-vindo."""
    nome = re.sub(r"\s+", " ", str(texto or "")).strip()
    if len(nome) < 3 or not re.search(r"[^\W\d_]{2}", nome):
        return nome, "Escreva seu nome como ele deve aparecer no certificado."
    if len(nome) > 120:
        return nome[:120], "O nome pode ter até 120 letras."
    return nome, None


def _lugar(evento):
    if evento.modalidade == "online" or not evento.cidade:
        return None
    return f"{evento.cidade} ({evento.uf})" if evento.uf else evento.cidade


def emitir(usuaria, evento, nome):
    """Cria o certificado (só chame com situacao() == 'pronto'). Pode chamar de novo: devolve o que já existe."""
    existente = certificado_do_evento(usuaria, evento)
    if existente:
        return existente
    for _ in range(5):  # colisão de código é quase impossível, mas custa pouco tentar de novo
        certificado = Certificado(
            codigo=novo_codigo(),
            usuaria_id=usuaria.id,
            evento_id=evento.id,
            nome=nome,
            evento_titulo=evento.titulo,
            organizacao=evento.organizacao,
            inicio=evento.inicio,
            fim=evento.fim,
            lugar=_lugar(evento),
            carga_horaria_min=evento.carga_horaria_min,
            emitido_em=agora(),
        )
        db.session.add(certificado)
        try:
            db.session.commit()
            return certificado
        except IntegrityError:
            db.session.rollback()
            existente = certificado_do_evento(usuaria, evento)
            if existente:  # dois cliques ao mesmo tempo: o outro já gravou
                return existente
    raise RuntimeError("Não foi possível gerar um código de certificado.")


def do_passaporte(usuaria):
    """Um item por evento em que ela fez check-in, do mais recente para o mais antigo."""
    ids = []
    for carimbo in servico.carimbos_de(usuaria):
        if carimbo.codigo.startswith("evento-") and carimbo.codigo[7:].isdigit():
            ids.append(int(carimbo.codigo[7:]))
    if not ids:
        return []
    eventos = Evento.query.filter(Evento.id.in_(ids)).order_by(Evento.inicio.desc()).all()
    emitidos = {
        c.evento_id: c
        for c in Certificado.query.filter(Certificado.usuaria_id == usuaria.id, Certificado.evento_id.in_(ids))
    }
    itens = []
    for evento in eventos:
        certificado = emitidos.get(evento.id)
        itens.append(
            {
                "evento_id": evento.id,
                "titulo": certificado.evento_titulo if certificado else evento.titulo,
                "data": data_por_extenso(evento.inicio, evento.fim),
                "codigo": certificado.codigo if certificado else None,
                "situacao": "emitido" if certificado else situacao(usuaria, evento),
                "liberado_em": evento.termino,
            }
        )
    return itens


# ---------- Textos do certificado ----------


def data_por_extenso(inicio, fim=None):
    """"31 de outubro de 2026", "18 a 20 de setembro de 2026" ou "30 de setembro a 2 de outubro de 2026"."""
    def dia_mes(d):
        return f"{d.day}º" if d.day == 1 else str(d.day), MESES_LONGOS[d.month - 1]

    di, mi = dia_mes(inicio)
    if not fim or fim.date() == inicio.date():
        return f"{di} de {mi} de {inicio.year}"
    df, mf = dia_mes(fim)
    if inicio.year != fim.year:
        return f"{di} de {mi} de {inicio.year} a {df} de {mf} de {fim.year}"
    if inicio.month != fim.month:
        return f"{di} de {mi} a {df} de {mf} de {fim.year}"
    return f"{di} a {df} de {mf} de {fim.year}"


def carga_por_extenso(minutos):
    """90 -> "1h30", 540 -> "9 horas", 60 -> "1 hora", 30 -> "30 minutos"."""
    if not minutos:
        return None
    horas, resto = divmod(int(minutos), 60)
    if not horas:
        return f"{resto} minutos"
    if resto:
        return f"{horas}h{resto:02d}"
    return "1 hora" if horas == 1 else f"{horas} horas"


def link_verificacao(certificado):
    return qr.endereco_publico(f"/verificar/{certificado.codigo}")


def link_linkedin(certificado):
    """Botão "Adicionar ao LinkedIn": abre o formulário de licenças e certificados já preenchido."""
    return "https://www.linkedin.com/profile/add?" + urlencode(
        {
            "startTask": "CERTIFICATION_NAME",
            "name": f"Participação: {certificado.evento_titulo}",
            "organizationName": "AstrAce",
            "issueYear": certificado.emitido_em.year,
            "issueMonth": certificado.emitido_em.month,
            "certUrl": link_verificacao(certificado),
            "certId": certificado.codigo,
        }
    )


def dados(certificado):
    """O que o certificado e a página de verificação mostram."""
    return {
        "codigo": certificado.codigo,
        "nome": certificado.nome,
        "evento": certificado.evento_titulo,
        "organizacao": certificado.organizacao,
        "data": data_por_extenso(certificado.inicio, certificado.fim),
        # "em 31 de outubro de 2026" ou "de 18 a 20 de setembro de 2026", para a frase do certificado
        "periodo": ("em " if not certificado.fim or certificado.fim.date() == certificado.inicio.date() else "de ")
        + data_por_extenso(certificado.inicio, certificado.fim),
        "lugar": certificado.lugar,
        "carga": carga_por_extenso(certificado.carga_horaria_min),
        "emitido_em": data_por_extenso(certificado.emitido_em),
        "link_verificacao": link_verificacao(certificado),
        "site_verificacao": re.sub(r"^https?://", "", qr.endereco_publico("/verificar")),  # para digitar à mão
    }
