"""Modelo mínimo de usuária, com os campos que o mural usa.

Dono: Pessoa 2 (cadastro de perfil). Pode adicionar campos à vontade
(senha, google_id, carta para o futuro...), só não renomeie os que já existem.
"""
from datetime import datetime

from ..extensoes import db


class Usuaria(db.Model):
    __tablename__ = "usuarias"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    apelido = db.Column(db.String(60))
    email = db.Column(db.String(160), unique=True, nullable=False)
    instituicao = db.Column(db.String(160))
    curso = db.Column(db.String(120))
    cidade = db.Column(db.String(120))
    nivel = db.Column(db.String(40))
    area_interesse = db.Column(db.String(40))
    bio = db.Column(db.Text)
    papel = db.Column(db.String(20), nullable=False, default="usuaria")  # "usuaria" ou "admin"
    criada_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    identidades = db.relationship(
        "IdentidadeUsuaria", back_populates="usuaria", cascade="all, delete-orphan"
    )

    @property
    def nome_publico(self):
        return self.apelido or self.nome

    @property
    def e_admin(self):
        return self.papel == "admin"


class IdentidadeUsuaria(db.Model):
    __tablename__ = "identidades_usuaria"
    __table_args__ = (db.UniqueConstraint("usuaria_id", "identidade"),)

    id = db.Column(db.Integer, primary_key=True)
    usuaria_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"), nullable=False)
    identidade = db.Column(db.String(40), nullable=False)  # valores de catalogos.IDENTIDADES
    publica = db.Column(db.Boolean, nullable=False, default=False)

    usuaria = db.relationship("Usuaria", back_populates="identidades")
