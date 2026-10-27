from datetime import date, datetime

from ..extensoes import db


class Noticia(db.Model):
    __tablename__ = "noticias"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(180), nullable=False)
    cientista = db.Column(db.String(140), nullable=False, index=True)
    instituicao = db.Column(db.String(160), index=True)
    resumo = db.Column(db.Text, nullable=False)
    area = db.Column(db.String(40), nullable=False, index=True)
    categoria = db.Column(db.String(40), nullable=False, index=True)
    fonte_nome = db.Column(db.String(120), nullable=False)
    link_fonte = db.Column(db.String(500), nullable=False)
    imagem_url = db.Column(db.String(500))
    data_publicacao = db.Column(db.Date, nullable=False, default=date.today, index=True)

    cientista_brasileira = db.Column(db.Boolean, nullable=False, default=True, index=True)
    cientista_negra = db.Column(db.Boolean, nullable=False, default=False, index=True)
    destaque = db.Column(db.Boolean, nullable=False, default=False, index=True)
    oculta = db.Column(db.Boolean, nullable=False, default=False, index=True)
    criada_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
