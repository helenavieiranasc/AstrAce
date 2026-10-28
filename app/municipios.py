"""Todos os municípios do Brasil, com estado e coordenadas, guardados em app/dados/municipios.json.

O arquivo vem da base kelvins/municipios-brasileiros (licença MIT), que usa os códigos do IBGE.
Fica no projeto para o site não depender de API externa: serve a lista do formulário
(/api/cidades), confere a cidade enviada e põe o projeto no mapa.

Qualquer frente pode usar: buscar("Recife", "PE"), nomes_da_uf("PE").
"""
import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

ARQUIVO = Path(__file__).resolve().parent / "dados" / "municipios.json"


def normalizar(texto):
    """'  São   Paulo ' -> 'sao paulo'. Sem acento, maiúscula ou espaço sobrando."""
    texto = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", texto).strip()


@lru_cache(maxsize=1)
def _base():
    """{uf: [(nome, codigo_ibge, lat, lon)]} e um índice {(uf, nome_normalizado): município}."""
    dados = json.loads(ARQUIVO.read_text(encoding="utf-8"))["municipios"]
    por_uf = {uf: [tuple(m) for m in lista] for uf, lista in dados.items()}
    indice = {(uf, normalizar(m[0])): (m[0], uf, m[2], m[3]) for uf, lista in por_uf.items() for m in lista}
    por_nome = {}
    for (uf, nome), municipio in indice.items():
        por_nome.setdefault(nome, []).append(municipio)
    return por_uf, indice, por_nome


def ufs():
    return set(_base()[0])


def nomes_da_uf(uf):
    """Nomes dos municípios do estado, em ordem alfabética. Lista vazia se a UF não existe."""
    return [m[0] for m in _base()[0].get((uf or "").upper(), [])]


def buscar(nome, uf):
    """(nome oficial, UF, latitude, longitude) ou None se a cidade não existe nesse estado."""
    return _base()[1].get(((uf or "").upper(), normalizar(nome)))


def buscar_sem_uf(nome):
    """Para textos antigos sem estado: só responde se o nome existe em um único estado.

    Aceita a sigla no fim ("Recife - PE", "Recife/PE", "Recife (PE)")."""
    texto = normalizar(nome)
    partes = re.split(r"\s*[-/,(]\s*", texto)
    if len(partes) > 1 and partes[-1].rstrip(")").upper() in ufs():
        return buscar(" ".join(partes[:-1]), partes[-1].rstrip(")"))
    achados = _base()[2].get(texto, [])
    return achados[0] if len(achados) == 1 else None
