"""Mulheres que marcaram a história da ciência e da tecnologia, lidas de app/dados/mulheres_historicas.json.

O arquivo é a única fonte: para incluir alguém, acrescente um item com os mesmos campos. O local de
nascimento tem de estar documentado (a coordenada é da cidade, do bairro ou da vila de origem) e a foto
tem de ter licença que permita o uso, com autoria; `validar` confere isso e roda nos testes.
"""
import json
from functools import lru_cache
from pathlib import Path

ARQUIVO = Path(__file__).resolve().parent.parent / "dados" / "mulheres_historicas.json"
PRECISOES = {"cidade", "bairro", "vila"}
CAMPOS = ("id", "nome", "nascimento", "morte", "area", "local", "bio", "destaque", "foto", "fontes")


@lru_cache(maxsize=1)
def carregar():
    with ARQUIVO.open(encoding="utf-8") as f:
        return json.load(f)["mulheres"]


def validar(mulheres):
    """Lista de problemas encontrados (vazia quando está tudo certo)."""
    problemas, vistos = [], set()
    for m in mulheres:
        quem = m.get("id", "?")
        faltando = [c for c in CAMPOS if c not in m]
        if faltando:
            problemas.append(f"{quem}: faltam os campos {', '.join(faltando)}")
            continue
        if m["id"] in vistos:
            problemas.append(f"{quem}: id repetido")
        vistos.add(m["id"])
        local = m["local"]
        if not (-90 <= local.get("lat", 999) <= 90 and -180 <= local.get("lon", 999) <= 180):
            problemas.append(f"{quem}: coordenadas fora do intervalo")
        if local.get("precisao") not in PRECISOES:
            problemas.append(f"{quem}: precisão do local inválida")
        if not (local.get("cidade") and local.get("pais")):
            problemas.append(f"{quem}: faltam cidade e país")
        if m["morte"] is not None and m["morte"] < m["nascimento"]:
            problemas.append(f"{quem}: morte antes do nascimento")
        foto = m["foto"]
        if not foto.get("url", "").startswith("https://commons.wikimedia.org/wiki/Special:FilePath/"):
            problemas.append(f"{quem}: a foto precisa vir do Wikimedia Commons")
        if not (foto.get("licenca") and foto.get("autor") and foto.get("fonte", "").startswith("https://")):
            problemas.append(f"{quem}: foto sem licença, autoria ou página de origem")
        if not m["fontes"] or not all(f.startswith("https://") for f in m["fontes"]):
            problemas.append(f"{quem}: sem fonte da biografia")
        if len(m["bio"]) < 40 or len(m["destaque"]) < 20:
            problemas.append(f"{quem}: biografia ou destaque curtos demais")
    return problemas
