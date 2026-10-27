from datetime import datetime

from ..extensoes import db


class Evento(db.Model):
    """Evento da agenda. Quem cadastra é o painel de admin (Pessoa 5).

    Datas ficam no horário de Brasília, sem fuso. token_qr preenchido quer dizer
    que o evento dá carimbo no passaporte (o check-in em /checkin/<token> é da Pessoa 2).
    """

    __tablename__ = "eventos"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(160), nullable=False)
    descricao = db.Column(db.Text, nullable=False)
    tipo = db.Column(db.String(30), nullable=False, default="oficina")  # catalogo.TIPOS_EVENTO
    organizacao = db.Column(db.String(160))
    inicio = db.Column(db.DateTime, nullable=False, index=True)
    fim = db.Column(db.DateTime)
    modalidade = db.Column(db.String(20), nullable=False, default="presencial", index=True)  # catalogo.MODALIDADES
    local = db.Column(db.String(200))  # nome do lugar e endereço; vazio quando é só online
    cidade = db.Column(db.String(120), index=True)
    uf = db.Column(db.String(2))
    link = db.Column(db.String(500), nullable=False)  # inscrição ou página oficial
    gratuito = db.Column(db.Boolean, nullable=False, default=True, index=True)
    publico_alvo = db.Column(db.String(30), nullable=False, default="todas", index=True)  # catalogo.PUBLICOS
    area = db.Column(db.String(40), index=True)  # catalogos.AREAS; vazio = várias áreas
    imagem_url = db.Column(db.String(500))
    token_qr = db.Column(db.String(64), unique=True)
    oculto = db.Column(db.Boolean, nullable=False, default=False)
    criado_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    @property
    def termino(self):
        return self.fim or self.inicio

    @property
    def tem_carimbo(self):
        return bool(self.token_qr)
