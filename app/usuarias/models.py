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


class ContaUsuaria(db.Model):
    """Login com Google e estado do cadastro inicial, um para um com Usuaria.

    Fica numa tabela própria porque db.create_all() não acrescenta colunas
    em tabelas que já existem: assim ninguém precisa apagar o banco.
    """

    __tablename__ = "contas_usuaria"

    usuaria_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"), primary_key=True)
    google_sub = db.Column(db.String(64), unique=True)  # id fixo da conta Google
    foto_url = db.Column(db.String(500))  # foto escolhida pela usuária (/uploads/...)
    foto_google_url = db.Column(db.String(500))  # foto da conta Google, atualizada a cada login
    data_nascimento = db.Column(db.Date)
    estado = db.Column(db.String(2))  # sigla, de catalogos.ESTADOS
    # [{"curso", "instituicao"}]; a primeira também fica em Usuaria.curso/instituicao.
    formacoes = db.Column(db.JSON)
    cadastro_concluido_em = db.Column(db.DateTime)
    ultimo_acesso_em = db.Column(db.DateTime)

    usuaria = db.relationship("Usuaria", backref=db.backref("conta", uselist=False))

    @property
    def cadastro_completo(self):
        return self.cadastro_concluido_em is not None

    @property
    def tem_foto_propria(self):
        return bool(self.foto_url and self.foto_url.startswith("/uploads/"))

    @property
    def foto_exibida(self):
        """A foto escolhida; se não houver, a do Google; se não houver, None (avatar padrão)."""
        if self.tem_foto_propria:
            return self.foto_url
        # Contas de antes de foto_google_url guardavam a foto do Google em foto_url.
        return self.foto_google_url or self.foto_url or None


class IdentidadeUsuaria(db.Model):
    __tablename__ = "identidades_usuaria"
    __table_args__ = (db.UniqueConstraint("usuaria_id", "identidade"),)

    id = db.Column(db.Integer, primary_key=True)
    usuaria_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"), nullable=False)
    identidade = db.Column(db.String(40), nullable=False)  # valores de catalogos.IDENTIDADES
    publica = db.Column(db.Boolean, nullable=False, default=False)

    usuaria = db.relationship("Usuaria", back_populates="identidades")
