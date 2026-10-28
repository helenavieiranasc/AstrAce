"""Onde elas brilham: onde ficam os projetos do mural.

As coordenadas vêm da base de municípios do projeto (app/municipios.py). Projetos com
estado (uf) são achados direto; os antigos, só com o texto da cidade, entram quando o
nome existe em um único estado. Os outros ficam em "sem_local".

O desenho (static/img/mapa-brasil.svg) vem da malha do IBGE e usa a mesma projeção
daqui: longitude corrigida pelo cosseno de 14°S, para o Brasil não sair achatado.
"""
import math

from .. import municipios

# Projeção do mapa-brasil.svg (gerado a partir da malha do IBGE, 1000 de largura).
MIN_LON = -73.9833
MAX_LAT = 5.2718
ESCALA = 26.304182
LARGURA = 1000
ALTURA = 1026
COS = math.cos(math.radians(14))


def posicao(lat, lon):
    """Posição no desenho, em porcentagem da largura e da altura (para posicionar os pins com CSS)."""
    x = (lon - MIN_LON) * COS * ESCALA
    y = (MAX_LAT - lat) * ESCALA
    return round(x / LARGURA * 100, 2), round(y / ALTURA * 100, 2)


def localizar(cidade, uf=None):
    """(nome, UF, x%, y%) da cidade, ou None se não dá para saber qual município é."""
    if not cidade:
        return None
    # Com estado, procura nele; se o texto foi editado à mão (ex.: "Recife - PE"), tenta pelo nome.
    achada = (uf and municipios.buscar(cidade, uf)) or municipios.buscar_sem_uf(cidade)
    if not achada:
        return None
    nome, sigla, lat, lon = achada
    return (nome, sigla, *posicao(lat, lon))
