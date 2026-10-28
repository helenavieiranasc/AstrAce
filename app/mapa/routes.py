from flask import jsonify, render_template

from ..mural import mapa as posicoes
from ..mural.models import Projeto
from ..usuarias.models import ContaUsuaria, Usuaria
from . import bp, historicas


@bp.get("/mapa")
def pagina_mapa():
    return render_template("mapa_inspiracao.html")


@bp.get("/api/mapa/historicas")
def api_historicas():
    """As mulheres da história, com a origem, a foto (e o crédito) e as fontes. Os projetos do astrAce
    continuam em /api/mural/mapa, agora com latitude e longitude de cada cidade."""
    return jsonify({"mulheres": historicas.carregar()})


@bp.get("/api/mapa/mulheres-astrace")
def api_mulheres_astrace():
    """Mulheres com cadastro concluído por cidade. Os nomes públicos (apelido ou nome, como no mural) aparecem
    só de quem já tem projeto visível, porque o mural já mostra esse nome; as outras entram só na contagem."""
    com_projeto = {
        uid for (uid,) in Projeto.query.filter(Projeto.oculto.is_(False)).with_entities(Projeto.usuaria_id).distinct()
    }
    linhas = (
        Usuaria.query.join(ContaUsuaria, ContaUsuaria.usuaria_id == Usuaria.id)
        .filter(ContaUsuaria.cadastro_concluido_em.isnot(None), Usuaria.cidade.isnot(None), Usuaria.cidade != "")
        .with_entities(Usuaria.id, Usuaria.cidade, Usuaria.apelido, Usuaria.nome, ContaUsuaria.estado)
        .all()
    )
    grupos, sem_local = {}, 0
    for uid, cidade, apelido, nome, estado in linhas:
        local = posicoes.localizar(cidade, estado)
        if not local:
            sem_local += 1
            continue
        grupo = grupos.setdefault((local[0], local[1]), {"total": 0, "nomes": []})
        grupo["total"] += 1
        if uid in com_projeto:
            grupo["nomes"].append(apelido or nome)
    cidades = []
    for (nome_cidade, uf), g in grupos.items():
        x, y = posicoes.localizar(nome_cidade, uf)[2:]
        lat, lon = posicoes.coordenadas(nome_cidade, uf)
        cidades.append({
            "cidade": nome_cidade, "uf": uf, "x": x, "y": y, "lat": lat, "lon": lon,
            "total": g["total"], "nomes": sorted(g["nomes"], key=str.casefold),
        })
    cidades.sort(key=lambda c: (-c["total"], c["cidade"]))
    return jsonify({"cidades": cidades, "total": len(linhas), "sem_local": sem_local})
