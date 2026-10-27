from pathlib import Path
from uuid import uuid4

from flask import current_app, jsonify, request, send_from_directory

from ..auth import usuaria_atual
from ..extensoes import db
from . import bp
from .models import Arquivo

# extensão: (tipo, assinatura dos primeiros bytes)
FORMATOS = {
    "pdf": ("pdf", b"%PDF"),
    "jpg": ("imagem", b"\xff\xd8\xff"),
    "jpeg": ("imagem", b"\xff\xd8\xff"),
    "png": ("imagem", b"\x89PNG\r\n\x1a\n"),
    "webp": ("imagem", b"RIFF"),
    "docx": ("documento", b"PK\x03\x04"),
    "pptx": ("apresentacao", b"PK\x03\x04"),
}
FINALIDADES = ("material", "foto", "capa")


def _erro(mensagem, status):
    return jsonify({"erro": mensagem}), status


def pasta_uploads():
    pasta = Path(current_app.config["PASTA_UPLOADS"])
    pasta.mkdir(parents=True, exist_ok=True)
    return pasta


def _conteudo_confere(extensao, conteudo):
    _, assinatura = FORMATOS[extensao]
    if not conteudo.startswith(assinatura):
        return False
    if extensao == "webp":
        return conteudo[8:12] == b"WEBP"
    return True


@bp.app_errorhandler(413)
def _grande_demais(_erro_413):
    limite = current_app.config["LIMITE_UPLOAD_MB"]
    return _erro(f"O arquivo passa de {limite} MB. Diminua o tamanho e envie de novo.", 413)


@bp.post("/api/uploads")
def api_enviar():
    usuaria = usuaria_atual()
    if not usuaria:
        return _erro("Entre na sua conta para enviar arquivos.", 401)

    arquivo = request.files.get("arquivo")
    if not arquivo or not arquivo.filename:
        return _erro("Escolha um arquivo para enviar.", 422)

    finalidade = request.form.get("finalidade", "material")
    if finalidade not in FINALIDADES:
        return _erro("Finalidade do arquivo inválida.", 422)

    nome_original = Path(arquivo.filename).name[:200]
    extensao = nome_original.rsplit(".", 1)[-1].lower() if "." in nome_original else ""
    formato = FORMATOS.get(extensao)
    if finalidade in ("foto", "capa") and (not formato or formato[0] != "imagem"):
        return _erro("As fotos precisam ser imagens jpg, png ou webp.", 422)
    if not formato:
        return _erro("Formato não aceito. Envie PDF, imagem (jpg, png, webp), Word (.docx) ou PowerPoint (.pptx).", 422)

    limite = current_app.config["LIMITE_UPLOAD_MB"] * 1024 * 1024
    conteudo = arquivo.read(limite + 1)
    if len(conteudo) > limite:
        return _grande_demais(None)
    if not conteudo:
        return _erro("O arquivo está vazio.", 422)
    if not _conteudo_confere(extensao, conteudo):
        return _erro("O arquivo parece corrompido ou não é do formato que o nome diz.", 422)

    nome_salvo = f"{uuid4().hex}.{'jpg' if extensao == 'jpeg' else extensao}"
    (pasta_uploads() / nome_salvo).write_bytes(conteudo)

    registro = Arquivo(
        usuaria_id=usuaria.id,
        finalidade=finalidade,
        nome_original=nome_original,
        nome_salvo=nome_salvo,
        tipo=formato[0],
        tamanho=len(conteudo),
    )
    db.session.add(registro)
    db.session.commit()
    return jsonify(registro.para_json()), 201


@bp.get("/uploads/<nome>")
def baixar(nome):
    registro = Arquivo.query.filter_by(nome_salvo=nome).first_or_404()
    resposta = send_from_directory(
        pasta_uploads(),
        registro.nome_salvo,
        download_name=registro.nome_original,
        # PDF e imagem abrem no navegador; Word e PowerPoint baixam.
        as_attachment=registro.tipo in ("documento", "apresentacao"),
    )
    resposta.headers["X-Content-Type-Options"] = "nosniff"
    return resposta
