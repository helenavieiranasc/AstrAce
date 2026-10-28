from datetime import datetime

from ..extensoes import db


class Moderacao(db.Model):
    """Decisão da equipe sobre um projeto denunciado. Fica como histórico.

    projeto_id não é chave estrangeira de propósito: a autora pode excluir o projeto,
    e o registro da decisão continua existindo.
    """

    __tablename__ = "moderacoes"

    id = db.Column(db.Integer, primary_key=True)
    projeto_id = db.Column(db.Integer, nullable=False, index=True)
    titulo = db.Column(db.String(160), nullable=False)  # título na hora da decisão
    decisao = db.Column(db.String(20), nullable=False)  # "restaurado" ou "fora_do_mural"
    denuncias = db.Column(db.Integer, nullable=False, default=0)
    admin_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"))
    criada_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
