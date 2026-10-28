"""Como citar um projeto do mural.

Referência segundo a ABNT NBR 6023:2025 e citação no texto segundo a ABNT NBR 10520:2023.
A referência é montada com os dados do projeto e aponta para a página dele na AstrAce
(ou para o link do software). Se o trabalho foi publicado em revista, anais ou repositório,
o certo é citar a publicação original: o painel avisa isso.
"""
import html
from datetime import date

from .tipos import TIPOS_POR_VALOR

MESES = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."]

# Ficam junto do prenome: "Maria da Silva" -> "SILVA, Maria da".
# Entram no sobrenome: "João Santos Júnior" -> "SANTOS JÚNIOR, João".
SUFIXOS = {"filho", "filha", "junior", "júnior", "jr.", "neto", "neta", "sobrinho", "sobrinha"}


def autor_abnt(nome):
    """Último sobrenome em maiúsculas, vírgula, prenomes como estão."""
    partes = (nome or "").split()
    if not partes:
        return "AUTORIA DESCONHECIDA"
    if len(partes) == 1:
        return partes[0].upper()
    if partes[-1].lower() in SUFIXOS and len(partes) > 2:
        sobrenome, prenomes = partes[-2:], partes[:-2]
    else:
        sobrenome, prenomes = partes[-1:], partes[:-1]
    return f"{' '.join(sobrenome).upper()}, {' '.join(prenomes)}"


def sobrenome_citacao(nome):
    """Sobrenome para a citação no texto: na NBR 10520:2023, só a inicial maiúscula ("Santos")."""
    sobrenome = autor_abnt(nome).split(",")[0]
    return " ".join(p.capitalize() if p.isupper() else p for p in sobrenome.split())


def data_acesso(dia):
    return f"{dia.day} {MESES[dia.month - 1]} {dia.year}"


def _titulo(titulo):
    """(título principal, subtítulo ou None). Só o título principal vai em negrito."""
    if ": " in titulo:
        principal, sub = titulo.split(": ", 1)
        return principal, sub
    return titulo.rstrip("."), None


def _nota(projeto):
    """Tipo do trabalho, com o detalhe que ajuda a identificar (curso, evento, disciplina)."""
    d = projeto.detalhes or {}
    tipo = projeto.tipo
    if tipo == "monografia":
        return "Trabalho de Conclusão de Curso" + (f" ({d['curso']})" if d.get("curso") else "")
    if tipo == "ic":
        return "Relatório de Iniciação Científica"
    if tipo == "aula":
        return "Trabalho de disciplina" + (f" ({d['disciplina']})" if d.get("disciplina") else "")
    if tipo == "congresso":
        return f"Trabalho apresentado em {d['evento']}" if d.get("evento") else "Trabalho apresentado em evento"
    if tipo == "extensao":
        return "Projeto de extensão"
    if tipo == "social":
        return "Projeto social" + (f" ({d['organizacao']})" if d.get("organizacao") else "")
    if tipo == "prototipo":
        return "Protótipo"
    return TIPOS_POR_VALOR.get(tipo, {}).get("rotulo", "Projeto")


def gerar(projeto, url_projeto, hoje=None):
    """Referência (em HTML com o título em negrito e em texto puro) e as duas citações no texto."""
    hoje = hoje or date.today()
    nome = projeto.autora.nome_publico if projeto.autora else ""
    autor = autor_abnt(nome)
    principal, sub = _titulo(projeto.titulo.strip())
    ano = projeto.ano

    if projeto.tipo == "software":
        # Software: aponta para o próprio programa (GitHub ou site), quando existe.
        meio = f"{ano}. Software"
        url = projeto.link_externo or url_projeto
    else:
        lugar = ", ".join(str(p) for p in (projeto.cidade, ano) if p)
        vinculo = f" – {projeto.instituicao}" if projeto.instituicao else ""
        meio = f"{_nota(projeto)}{vinculo}" + (f", {lugar}" if lugar else "")
        # Só no TCC o ano aparece duas vezes, como a norma pede para trabalhos acadêmicos:
        # depois do título (ano de depósito) e no fim (ano da defesa).
        if projeto.tipo == "monografia":
            meio = f"{ano}. {meio}"
        url = url_projeto

    final = f". {meio}. Disponível em: {url}. Acesso em: {data_acesso(hoje)}."
    titulo_texto = principal + (f": {sub}" if sub else "")
    titulo_html = f"<strong>{html.escape(principal)}</strong>" + (f": {html.escape(sub)}" if sub else "")

    sobrenome = sobrenome_citacao(nome)
    return {
        "referencia_texto": f"{autor}. {titulo_texto}{final}",
        "referencia_html": f"{html.escape(autor)}. {titulo_html}{html.escape(final)}",
        "citacao_parentetica": f"({sobrenome}, {ano})",
        "citacao_narrativa": f"{sobrenome} ({ano})",
    }
