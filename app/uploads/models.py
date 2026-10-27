from datetime import datetime

from ..extensoes import db


class Arquivo(db.Model):
    """Arquivo enviado. Fica solto (projeto_id vazio) até o projeto ser publicado."""

    __tablename__ = "arquivos"

    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey("projetos.id"), index=True)
    usuaria_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"), index=True)
    finalidade = db.Column(db.String(20), nullable=False, default="material")  # "material", "foto" ou "capa"
    nome_original = db.Column(db.String(200), nullable=False)
    nome_salvo = db.Column(db.String(80), nullable=False, unique=True)
    tipo = db.Column(db.String(20), nullable=False)  # pdf, imagem, documento, apresentacao
    tamanho = db.Column(db.Integer, nullable=False)
    criado_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    projeto = db.relationship("Projeto", back_populates="arquivos")

    @property
    def url(self):
        return f"/uploads/{self.nome_salvo}"

    def para_json(self):
        return {
            "id": self.id,
            "nome": self.nome_original,
            "url": self.url,
            "tipo": self.tipo,
            "tamanho": self.tamanho,
        }
