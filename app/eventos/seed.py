"""Eventos de exemplo para testar a agenda: flask --app run seed-eventos

As datas são calculadas a partir de hoje, então sempre há eventos "esta semana".
Organizações e links são fictícios. Os eventos reais entram pelo painel de admin.
"""
import secrets
from datetime import datetime, time, timedelta

import click

from ..extensoes import db
from .models import Evento

# (dias a partir de hoje, hora início, duração em horas, dias de duração extra)
EXEMPLOS = [
    {
        "quando": (0, 19, 2, 0),
        "titulo": "Roda de conversa: mulheres que programam",
        "tipo": "palestra",
        "organizacao": "Coletivo Elas no Código",
        "descricao": "Quatro desenvolvedoras contam como entraram na área, o que aprenderam no primeiro emprego "
        "e respondem perguntas. Transmissão ao vivo com intérprete de Libras.",
        "modalidade": "online",
        "cidade": None,
        "uf": None,
        "local": None,
        "gratuito": True,
        "publico_alvo": "todas",
        "area": "computacao",
        "carimbo": True,
    },
    {
        "quando": (2, 14, 3, 0),
        "titulo": "Oficina de robótica com sucata",
        "tipo": "oficina",
        "organizacao": "Clube de Ciências Vale do Paraíba",
        "descricao": "Monte um pequeno robô usando motores reaproveitados, pilhas e papelão. "
        "Não precisa saber nada antes: todo o material é fornecido.",
        "modalidade": "presencial",
        "cidade": "Jacareí",
        "uf": "SP",
        "local": "Biblioteca Municipal, Rua Exemplo, 100 - Centro",
        "gratuito": True,
        "publico_alvo": "ensino_medio",
        "area": "engenharias",
        "carimbo": True,
    },
    {
        "quando": (3, 9, 8, 1),
        "titulo": "Hackathon Meninas e Dados",
        "tipo": "hackathon",
        "organizacao": "Rede Ciência Delas",
        "descricao": "Dois dias criando soluções com dados abertos da sua cidade. Equipes de 3 a 5 pessoas, "
        "mentoras durante todo o evento e premiação para os três primeiros lugares.",
        "modalidade": "hibrido",
        "cidade": "São José dos Campos",
        "uf": "SP",
        "local": "Parque Tecnológico, Av. Exemplo, 500",
        "gratuito": True,
        "publico_alvo": "graduacao",
        "area": "computacao",
        "carimbo": True,
    },
    {
        "quando": (5, 20, 2, 0),
        "titulo": "Noite de observação do céu",
        "tipo": "visita",
        "organizacao": "Clube de Astronomia Céu Aberto",
        "descricao": "Observação de planetas e da Lua com telescópios. Em caso de chuva, a atividade vira uma "
        "sessão de planetário dentro do prédio.",
        "modalidade": "presencial",
        "cidade": "São José dos Campos",
        "uf": "SP",
        "local": "Observatório Municipal",
        "gratuito": True,
        "publico_alvo": "todas",
        "area": "fisica",
        "carimbo": False,
    },
    {
        "quando": (9, 18, 3, 0),
        "titulo": "Minicurso de Python para análise de dados",
        "tipo": "curso",
        "organizacao": "Coletivo Elas no Código",
        "descricao": "Três encontros online para aprender pandas e gráficos a partir de planilhas reais. "
        "Certificado de 9 horas para quem participar dos três dias.",
        "modalidade": "online",
        "cidade": None,
        "uf": None,
        "local": None,
        "gratuito": False,
        "publico_alvo": "todas",
        "area": "computacao",
        "carimbo": False,
    },
    {
        "quando": (12, 8, 9, 2),
        "titulo": "Mostra de iniciação científica júnior",
        "tipo": "feira",
        "organizacao": "Diretoria Regional de Ensino",
        "descricao": "Estudantes de escolas públicas apresentam pôsteres e protótipos. Inscrições de trabalhos "
        "abertas até uma semana antes; visitação livre.",
        "modalidade": "presencial",
        "cidade": "Campinas",
        "uf": "SP",
        "local": "Centro de Convenções, Rua Exemplo, 900",
        "gratuito": True,
        "publico_alvo": "ensino_medio",
        "area": None,
        "carimbo": True,
    },
    {
        "quando": (16, 14, 4, 0),
        "titulo": "Laboratório aberto: química no dia a dia",
        "tipo": "visita",
        "organizacao": "Laboratório de Química Verde",
        "descricao": "Experimentos guiados sobre pH, sabão caseiro e tintas naturais, com conversa sobre "
        "carreiras em química. Vagas limitadas a 25 pessoas.",
        "modalidade": "presencial",
        "cidade": "São Paulo",
        "uf": "SP",
        "local": "Instituto de Química, Bloco B",
        "gratuito": True,
        "publico_alvo": "ensino_fundamental",
        "area": "quimica",
        "carimbo": False,
    },
    {
        "quando": (22, 9, 9, 2),
        "titulo": "Simpósio de mulheres na saúde e biotecnologia",
        "tipo": "congresso",
        "organizacao": "Associação de Pesquisadoras em Saúde",
        "descricao": "Palestras, sessões de pôster e mentorias de carreira para pesquisadoras em formação. "
        "Há bolsas de inscrição para estudantes de graduação.",
        "modalidade": "presencial",
        "cidade": "São Paulo",
        "uf": "SP",
        "local": "Centro de Eventos, Av. Exemplo, 1500",
        "gratuito": False,
        "publico_alvo": "pos",
        "area": "saude",
        "carimbo": True,
    },
    {
        "quando": (27, 19, 2, 0),
        "titulo": "Encontro de professoras de matemática",
        "tipo": "palestra",
        "organizacao": "Rede Ciência Delas",
        "descricao": "Troca de práticas para engajar meninas nas aulas de matemática, com materiais prontos "
        "para usar em sala.",
        "modalidade": "online",
        "cidade": None,
        "uf": None,
        "local": None,
        "gratuito": True,
        "publico_alvo": "professoras",
        "area": "matematica",
        "carimbo": False,
    },
    {
        "quando": (40, 9, 6, 0),
        "titulo": "Feira de ciências ambientais",
        "tipo": "feira",
        "organizacao": "Coletivo Verde Vale",
        "descricao": "Projetos sobre água, reciclagem e clima feitos por estudantes da região. "
        "Oficina de composteira para as visitantes.",
        "modalidade": "presencial",
        "cidade": "Jacareí",
        "uf": "SP",
        "local": "Parque da Cidade",
        "gratuito": True,
        "publico_alvo": "todas",
        "area": "ambiental",
        "carimbo": True,
    },
]


@click.command("seed-eventos")
@click.option("--limpar", is_flag=True, help="Apaga os eventos antes de criar os exemplos.")
def seed_eventos(limpar):
    """Cria eventos de exemplo com datas a partir de hoje."""
    if limpar:
        Evento.query.delete()
        db.session.commit()
    elif Evento.query.first():
        click.echo("Já existem eventos. Use --limpar para recriar os exemplos.")
        return

    hoje = datetime.now().date()
    for dados in EXEMPLOS:
        dados = dict(dados)
        dias, hora, duracao, dias_extras = dados.pop("quando")
        carimbo = dados.pop("carimbo")
        inicio = datetime.combine(hoje + timedelta(days=dias), time(hora))
        fim = inicio + timedelta(days=dias_extras, hours=duracao)
        db.session.add(
            Evento(
                **dados,
                inicio=inicio,
                fim=fim,
                link=f"https://example.com/eventos/{secrets.token_hex(3)}",
                token_qr=secrets.token_urlsafe(16) if carimbo else None,
            )
        )
    db.session.commit()
    click.echo(f"{len(EXEMPLOS)} eventos de exemplo criados.")
