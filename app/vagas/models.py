from datetime import date, datetime

from ..extensoes import db


class Vaga(db.Model):
    __tablename__ = "vagas"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    organizacao = db.Column(db.String(160), nullable=False, index=True)
    descricao = db.Column(db.Text, nullable=False)
    tipo = db.Column(db.String(30), nullable=False, index=True)
    area = db.Column(db.String(40), nullable=False, index=True)
    modalidade = db.Column(db.String(30), nullable=False, index=True)
    cidade = db.Column(db.String(120), index=True)
    prazo = db.Column(db.Date, index=True)
    link_original = db.Column(db.String(500), nullable=False)
    imagem_url = db.Column(db.String(500))  # logo ou foto da instituição (/uploads/...), enviada pelo painel

    afirmativa_mulheres = db.Column(db.Boolean, nullable=False, default=False, index=True)
    afirmativa_negras = db.Column(db.Boolean, nullable=False, default=False, index=True)
    afirmativa_trans = db.Column(db.Boolean, nullable=False, default=False, index=True)
    fonte_afirmacao = db.Column(db.Text)

    data_coleta = db.Column(db.Date, nullable=False, default=date.today)
    oculta = db.Column(db.Boolean, nullable=False, default=False, index=True)
    criada_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    @property
    def oculto(self):
        return self.oculta

    @oculto.setter
    def oculto(self, valor):
        self.oculta = bool(valor)
