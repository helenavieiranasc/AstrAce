from flask import jsonify, render_template, request

from . import bp, dados


@bp.get("/quiz")
def pagina_quiz():
    return render_template("quiz.html")


@bp.get("/api/quiz")
def api_quiz():
    """Perguntas (sem os pontos, para o resultado não ficar óbvio) e o total de áreas."""
    perguntas = [
        {"texto": p["texto"], "opcoes": [o["texto"] for o in p["opcoes"]]} for p in dados.PERGUNTAS
    ]
    return jsonify({"perguntas": perguntas})


@bp.post("/api/quiz/resultado")
def api_resultado():
    """{"respostas": [0, 2, 1, 3, 0, 1]}: índice da opção escolhida em cada pergunta."""
    respostas = (request.get_json(silent=True) or {}).get("respostas")
    try:
        area = dados.calcular(respostas if isinstance(respostas, list) else [])
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 422
    return jsonify(dados.resultado(area))


@bp.get("/api/quiz/resultado/<area>")
def api_resultado_da_area(area):
    """Para o link compartilhado (/quiz?resultado=fisica) mostrar o resultado direto."""
    encontrado = dados.resultado(area)
    if not encontrado:
        return jsonify({"erro": "Esse resultado não existe. Que tal fazer o quiz?"}), 404
    return jsonify(encontrado)
