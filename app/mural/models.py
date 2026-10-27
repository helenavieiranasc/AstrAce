from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import column_property

from ..extensoes import db

DIAS_NOVO = 7  # projetos publicados há menos que isso ganham a etiqueta "Novo!"


def semana_atual(dia=None):
    """Semana no formato ISO, ex.: "2026-W44". Usada em destaque_semana."""
    ano, semana, _ = (dia or date.today()).isocalendar()
    return f"{ano}-W{semana:02d}"


class Projeto(db.Model):
    __tablename__ = "projetos"

    id = db.Column(db.Integer, primary_key=True)
    usuaria_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"), nullable=False, index=True)
    tipo = db.Column(db.String(30), nullable=False, index=True)
    titulo = db.Column(db.String(160), nullable=False)
    resumo = db.Column(db.Text, nullable=False)
    area = db.Column(db.String(40), nullable=False, index=True)
    ano = db.Column(db.Integer, nullable=False)
    instituicao = db.Column(db.String(160), index=True)
    cidade = db.Column(db.String(120), index=True)
    nivel = db.Column(db.String(40), index=True)
    link_externo = db.Column(db.String(500))
    imagem_url = db.Column(db.String(500))
    detalhes = db.Column(db.JSON, nullable=False, default=dict)  # campos extras do tipo

    destaque = db.Column(db.Boolean, nullable=False, default=False)
    destaque_semana = db.Column(db.String(8))
    oculto = db.Column(db.Boolean, nullable=False, default=False)
    criado_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    autora = db.relationship("Usuaria")
    denuncias = db.relationship("Denuncia", back_populates="projeto", cascade="all, delete-orphan")
    arquivos = db.relationship(
        "Arquivo", back_populates="projeto", cascade="all, delete-orphan", order_by="Arquivo.id"
    )

    @property
    def materiais(self):
        return [a for a in self.arquivos if a.finalidade == "material"]

    @property
    def fotos(self):
        return [a for a in self.arquivos if a.finalidade == "foto"]

    @property
    def novo(self):
        return self.criado_em >= datetime.utcnow() - timedelta(days=DIAS_NOVO)


class Denuncia(db.Model):
    __tablename__ = "denuncias"

    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey("projetos.id"), nullable=False, index=True)
    usuaria_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"))
    motivo = db.Column(db.String(30), nullable=False)
    comentario = db.Column(db.Text)
    criada_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    projeto = db.relationship("Projeto", back_populates="denuncias")


class Estrela(db.Model):
    """Uma usuária dá no máximo uma estrela por projeto."""

    __tablename__ = "estrelas"
    __table_args__ = (db.UniqueConstraint("projeto_id", "usuaria_id"),)

    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, db.ForeignKey("projetos.id", ondelete="CASCADE"), nullable=False, index=True)
    usuaria_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"), nullable=False, index=True)
    criada_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


# Total de estrelas calculado pelo banco junto com o projeto (serve para mostrar e para ordenar).
Projeto.total_estrelas = column_property(
    select(func.count(Estrela.id)).where(Estrela.projeto_id == Projeto.id).correlate_except(Estrela).scalar_subquery()
)
