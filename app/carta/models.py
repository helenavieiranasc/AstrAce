from datetime import datetime

from ..extensoes import db

# Estados guardados. Sem linha na tabela, a carta está "não iniciada".
# "Aguardando a data" e "disponível para reabertura" não são guardados: saem da data de revelação (ver situacao).
ADIADA = "adiada"  # pulou o convite no primeiro acesso
EM_CRIACAO = "em_criacao"  # escrevendo; o rascunho fica salvo
ENVIADA = "enviada"  # confirmada e selada; a mensagem fica escondida até revela_em
ABERTA = "aberta"  # a data chegou e a pessoa abriu a carta


class CartaFuturo(db.Model):
    """A carta que a pessoa escreve para a sua versão cientista do futuro (no máximo uma por usuária)."""

    __tablename__ = "cartas_futuro"

    usuaria_id = db.Column(db.Integer, db.ForeignKey("usuarias.id"), primary_key=True)
    estado = db.Column(db.String(20), nullable=False)
    nome_exibicao = db.Column(db.String(60))
    area = db.Column(db.String(40))
    mensagem = db.Column(db.Text)
    objetivos = db.Column(db.Text)
    anos = db.Column(db.Integer)
    enviada_em = db.Column(db.DateTime)
    revela_em = db.Column(db.DateTime, index=True)
    aberta_em = db.Column(db.DateTime)
    atualizada_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def situacao(self, agora):
        """O que a interface mostra: adiada, em_criacao, aguardando, disponivel ou aberta."""
        if self.estado == ENVIADA:
            return "disponivel" if agora >= self.revela_em else "aguardando"
        return self.estado

    def rascunho_json(self):
        return {
            "nome": self.nome_exibicao or "",
            "area": self.area or "",
            "mensagem": self.mensagem or "",
            "objetivos": self.objetivos or "",
            "anos": self.anos,
        }

    def selada_json(self):
        """O que aparece enquanto a carta está selada: nunca a mensagem nem os objetivos."""
        return {
            "nome": self.nome_exibicao or "",
            "area": self.area or "",
            "anos": self.anos,
            "enviada_em": self.enviada_em.isoformat() if self.enviada_em else None,
            "revela_em": self.revela_em.isoformat() if self.revela_em else None,
        }

    def completa_json(self):
        return {**self.selada_json(), "mensagem": self.mensagem or "", "objetivos": self.objetivos or ""}
