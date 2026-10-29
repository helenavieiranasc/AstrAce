from datetime import datetime

from ..extensoes import db


class Carimbo(db.Model):
    """Um carimbo no passaporte de uma usuária. Cada código vale uma vez por usuária.

    visto_em fica vazio até a usuária ver a animação do carimbo pela primeira vez;
    depois disso o carimbo aparece já impresso, em qualquer dispositivo.
    Os carimbos de eventos (check-in por QR, Pessoa 2) podem usar codigo="evento-<id>".
    """

    __tablename__ = "carimbos"
    __table_args__ = (db.UniqueConstraint("usuaria_id", "codigo"),)

    id = db.Column(db.Integer, primary_key=True)
    usuaria_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"), nullable=False, index=True)
    codigo = db.Column(db.String(40), nullable=False)
    titulo = db.Column(db.String(120), nullable=False)
    concedido_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    visto_em = db.Column(db.DateTime)

    def para_json(self):
        return {
            "codigo": self.codigo,
            "titulo": self.titulo,
            "concedido_em": self.concedido_em.date().isoformat(),
            "visto": self.visto_em is not None,
        }


class Certificado(db.Model):
    """Certificado de participação num evento, para quem fez check-in pelo QR.

    Guarda uma cópia do nome e dos dados do evento no dia da emissão: editar o evento
    ou o perfil depois não muda um certificado já impresso nem a verificação pública.
    codigo é o que aparece no papel e no QR de /verificar/<codigo>.
    """

    __tablename__ = "certificados"
    __table_args__ = (db.UniqueConstraint("usuaria_id", "evento_id"),)

    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(11), nullable=False, unique=True)  # ex.: 7KQ3M-XP9TD
    usuaria_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"), nullable=False, index=True)
    evento_id = db.Column(db.Integer, db.ForeignKey("eventos.id"), nullable=False)
    nome = db.Column(db.String(120), nullable=False)
    evento_titulo = db.Column(db.String(160), nullable=False)
    organizacao = db.Column(db.String(160))
    inicio = db.Column(db.DateTime, nullable=False)
    fim = db.Column(db.DateTime)
    lugar = db.Column(db.String(200))  # "Recife (PE)"; vazio quando foi online
    carga_horaria_min = db.Column(db.Integer)
    emitido_em = db.Column(db.DateTime, nullable=False)
