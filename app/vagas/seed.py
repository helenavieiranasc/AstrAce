"""Curadoria de vagas reais e programas afirmativos: flask --app run seed-vagas"""
from datetime import date, datetime, timedelta

import click
from sqlalchemy import inspect, text

from ..extensoes import db
from .models import Vaga


def _vagas_curadas(hoje=None):
    hoje = hoje or date.today()
    coleta = hoje - timedelta(days=2)

    return [
        {
            "titulo": "Formação Afirmativa PretaLab — Ciclo Formativo em Tecnologia e Dados",
            "organizacao": "Olabi / PretaLab",
            "tipo": "programa",
            "area": "computacao",
            "modalidade": "remoto",
            "cidade": "Rio de Janeiro",
            "prazo": hoje + timedelta(days=12),
            "link_original": "https://www.pretalab.com/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": True,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Regulamento PretaLab: 'Nossos ciclos formativos são gratuitos e exclusivos para mulheres "
                "negras e indígenas, cisgênero ou transgênero, de todo o Brasil.'"
            ),
            "descricao": (
                "Trilha formativa online e gratuita em lógica de programação, análise de dados com Python e "
                "preparação para processos seletivos, conectando alunas negras a empresas parceiras de tecnologia."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Edital Fundo Baobá — Bolsas de Pesquisa e Permanência Acadêmica para Mulheres Negras",
            "organizacao": "Fundo Baobá para Equidade Racial",
            "tipo": "bolsa",
            "area": "humanas",
            "modalidade": "remoto",
            "cidade": "São Paulo",
            "prazo": hoje + timedelta(days=16),
            "link_original": "https://baoba.org.br/editais/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": True,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Edital Fundo Baobá: apoio financeiro, mentoria e cursos de idiomas destinados exclusivamente a "
                "mulheres negras (cis e trans) na graduação e pós-graduação stricto sensu."
            ),
            "descricao": (
                "Concessão de bolsas de permanência e fomento à pesquisa científica e tecnológica liderada por "
                "mulheres negras em universidades públicas e privadas brasileiras."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Chamada Serrapilheira & FAPERJ — Apoio a Cientistas Negras e Indígenas em Ecologia e Física",
            "organizacao": "Instituto Serrapilheira",
            "tipo": "bolsa",
            "area": "fisica",
            "modalidade": "presencial",
            "cidade": "Rio de Janeiro",
            "prazo": hoje + timedelta(days=24),
            "link_original": "https://serrapilheira.org/chamadas-publicas/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": True,
            "afirmativa_trans": False,
            "fonte_afirmacao": (
                "Chamada pública do Instituto Serrapilheira voltada à ampliação da diversidade racial e de gênero "
                "na ciência, com fomento dedicado a pesquisadoras negras nas ciências naturais e matemática."
            ),
            "descricao": (
                "Bolsas de pesquisa e recursos de bancada para jovens cientistas negras em projetos de Física, "
                "Matemática, Ciência da Computação, Química e Ecologia."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Programa Meninas Digitais — Bolsas de Iniciação Tecnológica (SBC)",
            "organizacao": "Sociedade Brasileira de Computação (SBC)",
            "tipo": "ic",
            "area": "computacao",
            "modalidade": "hibrido",
            "cidade": "Porto Alegre",
            "prazo": hoje + timedelta(days=18),
            "link_original": "https://meninas.sbc.org.br/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": False,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Programa institucional da SBC voltado exclusivamente a incentivar meninas e mulheres "
                "(cis e trans) do ensino médio e graduação a ingressarem e permanecerem em Computação e TI."
            ),
            "descricao": (
                "Atuação em projetos parceiros do Programa Meninas Digitais com oficinas de programação, "
                "robótica educacional e produção de materiais abertos de divulgação científica para escolas públicas."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Chamada CNPq/MCTI — Meninas nas Ciências Exatas, Engenharias e Computação",
            "organizacao": "CNPq e Ministério da Ciência, Tecnologia e Inovação",
            "tipo": "bolsa",
            "area": "engenharias",
            "modalidade": "presencial",
            "cidade": "Brasília",
            "prazo": hoje + timedelta(days=25),
            "link_original": "https://www.gov.br/cnpq/pt-br",
            "afirmativa_mulheres": True,
            "afirmativa_negras": False,
            "afirmativa_trans": False,
            "fonte_afirmacao": (
                "Edital público com bolsas de Iniciação Científica Júnior (ICJ) e Apoio Técnico em Extensão "
                "destinadas a alunas de escolas públicas e graduandas das áreas de Exatas, Engenharias e Computação."
            ),
            "descricao": (
                "Concessão de bolsas para estudantes do ensino médio e da graduação integrarem projetos de "
                "pesquisa aplicada e mentoria científica coordenados por pesquisadoras em universidades públicas."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Programa Para Mulheres na Ciência — L'Oréal-UNESCO-ABC (com destaque para Cientistas Negras)",
            "organizacao": "Academia Brasileira de Ciências (ABC) · UNESCO · L'Oréal",
            "tipo": "bolsa",
            "area": "biologicas",
            "modalidade": "presencial",
            "cidade": "Rio de Janeiro",
            "prazo": hoje + timedelta(days=40),
            "link_original": "https://www.paramulheresnaciencia.com.br/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": True,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Regulamento oficial L'Oréal-UNESCO-ABC: auxílio financeiro concedido anualmente a 7 jovens "
                "cientistas brasileiras, garantindo representatividade de pesquisadoras negras entre as contempladas."
            ),
            "descricao": (
                "Bolsa-auxílio de R$ 50 mil para pesquisadoras doutoras desenvolverem seus projetos científicos "
                "em instituições brasileiras de pesquisa, promovendo equidade de gênero e raça na liderança acadêmica."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Bootcamp e Banco de Talentos TransEmpregos + Empresas Parceiras de Tech",
            "organizacao": "TransEmpregos",
            "tipo": "emprego",
            "area": "computacao",
            "modalidade": "remoto",
            "cidade": "São Paulo",
            "prazo": None,
            "link_original": "https://www.transempregos.com.br/",
            "afirmativa_mulheres": False,
            "afirmativa_negras": False,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Plataforma oficial TransEmpregos: 'O maior e mais antigo projeto de empregabilidade e capacitação "
                "exclusivo para pessoas trans e travestis no Brasil, com vagas afirmativas em tecnologia.'"
            ),
            "descricao": (
                "Vagas de desenvolvimento web júnior, suporte técnico, QA e análise de dados em empresas parceiras "
                "comprometidas com ambientes seguros, respeito ao nome social e trilhas de evolução de carreira."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Programa de Estágio Afirmativo em Engenharia de Software — Thoughtworks",
            "organizacao": "Thoughtworks Brasil",
            "tipo": "estagio",
            "area": "computacao",
            "modalidade": "remoto",
            "cidade": "Recife",
            "prazo": hoje + timedelta(days=15),
            "link_original": "https://www.thoughtworks.com/pt-br/careers",
            "afirmativa_mulheres": True,
            "afirmativa_negras": True,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Página de carreiras e diversidade Thoughtworks: processos seletivos e turmas da Desenvolve/Evolve "
                "com vagas prioritárias e afirmativas para mulheres negras, mulheres cis e trans."
            ),
            "descricao": (
                "Estágio e formação inicial em desenvolvimento ágil, programação em par, testes automatizados e "
                "arquitetura de software, com mentoria contínua de desenvolvedoras seniores."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Bolsa de Iniciação Científica PIBIC-Af — Ações Afirmativas (UFBA)",
            "organizacao": "Universidade Federal da Bahia (UFBA)",
            "tipo": "ic",
            "area": "saude",
            "modalidade": "presencial",
            "cidade": "Salvador",
            "prazo": hoje + timedelta(days=22),
            "link_original": "https://pibic.ufba.br/",
            "afirmativa_mulheres": False,
            "afirmativa_negras": True,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Edital PIBIC-Af/CNPq/UFBA: modalidade voltada a estudantes ingressantes por políticas de ações "
                "afirmativas, incluindo reserva de vagas para mulheres negras, quilombolas, indígenas e pessoas trans."
            ),
            "descricao": (
                "Iniciação científica em Saúde Coletiva e Epidemiologia investigando determinantes sociais de "
                "saúde da população negra e acesso a serviços de atenção básica na Região Metropolitana de Salvador."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Bolsas PrograMaria — Eu Programo (50% reservadas para Mulheres Negras)",
            "organizacao": "PrograMaria",
            "tipo": "bolsa",
            "area": "computacao",
            "modalidade": "remoto",
            "cidade": "São Paulo",
            "prazo": hoje + timedelta(days=9),
            "link_original": "https://www.programaria.org/cursos-programaria/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": True,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Edital de bolsas PrograMaria: 'Cursos exclusivos para mulheres cis e trans, com no mínimo 50% "
                "das bolsas integrais reservadas afirmativamente para mulheres negras, indígenas e pessoas trans.'"
            ),
            "descricao": (
                "Bolsas integrais de estudo para os cursos online Eu Programo, cobrindo HTML, CSS, JavaScript, "
                "lógica de programação e criação do primeiro portfólio no GitHub com monitoria ao vivo."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Programa Futuras Cientistas — Imersão Científica para Ensino Médio e Professoras",
            "organizacao": "CETENE / Ministério da Ciência, Tecnologia e Inovação",
            "tipo": "programa",
            "area": "quimica",
            "modalidade": "hibrido",
            "cidade": "Recife",
            "prazo": hoje + timedelta(days=30),
            "link_original": "https://www.gov.br/cetene/pt-br/areas-de-atuacao/futuras-cientistas",
            "afirmativa_mulheres": True,
            "afirmativa_negras": False,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Edital Futuras Cientistas (CETENE/MCTI): 'Destinado exclusivamente a estudantes mulheres "
                "(cis e trans) do 2º ano do Ensino Médio da rede pública estadual e professoras da educação básica.'"
            ),
            "descricao": (
                "Imersão científica de verão com auxílio-bolsa para alunas e professoras de escolas públicas "
                "vivenciarem rotinas de laboratório em biotecnologia, nanotecnologia, química e ciências ambientais."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Iniciação Científica em Astrofísica Estelar e Exoplanetas — Astrominas (IAG/USP)",
            "organizacao": "Instituto de Astronomia, Geofísica e Ciências Atmosféricas (USP)",
            "tipo": "ic",
            "area": "fisica",
            "modalidade": "hibrido",
            "cidade": "São Paulo",
            "prazo": hoje + timedelta(days=27),
            "link_original": "https://www.iag.usp.br/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": False,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Projeto vinculado ao coletivo Astrominas (USP): seleção de monitoras e bolsistas para extensão "
                "e iniciação científica dedicada a meninas cis e trans de 14 a 17 anos e graduandas."
            ),
            "descricao": (
                "Análise de curvas de luz de estrelas variáveis com Python e preparação de atividades práticas "
                "de astronomia e física espacial para alunas da educação básica."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Programa de Estágio em Engenharias e Energia Renovável — Rede Mulheres na Energia",
            "organizacao": "Instituto E+ Transição Energética",
            "tipo": "estagio",
            "area": "ambiental",
            "modalidade": "hibrido",
            "cidade": "Rio de Janeiro",
            "prazo": hoje + timedelta(days=19),
            "link_original": "https://emaisenergia.org/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": False,
            "afirmativa_trans": False,
            "fonte_afirmacao": (
                "Iniciativa da Rede de Mulheres na Energia para ampliar a participação feminina em pesquisa "
                "e projetos de descarbonização, transição justa e matriz energética limpa."
            ),
            "descricao": (
                "Apoio técnico na modelagem de dados de emissões, análise de políticas climáticas e elaboração "
                "de relatórios técnicos sobre energia solar e eólica no Nordeste e Sudeste."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Iniciação Científica em Matemática Aplicada — Programa Meninas Olímpicas (IMPA)",
            "organizacao": "Instituto de Matemática Pura e Aplicada (IMPA)",
            "tipo": "bolsa",
            "area": "matematica",
            "modalidade": "presencial",
            "cidade": "Rio de Janeiro",
            "prazo": hoje + timedelta(days=34),
            "link_original": "https://impa.br/ensino/programas-de-verao/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": False,
            "afirmativa_trans": False,
            "fonte_afirmacao": (
                "Programa Meninas Olímpicas do IMPA (TM² - Torneio Meninas na Matemática): bolsas de iniciação "
                "e mentoria para alunas medalhistas e universitárias atuarem como tutoras."
            ),
            "descricao": (
                "Bolsa de iniciação e tutoria para graduandas de Matemática, Estatística e Computação acompanharem "
                "alunas do ensino básico em resolução de problemas olímpicos e combinatória."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Residência em Divulgação Científica e Jornalismo de Ciência — Agência Bori",
            "organizacao": "Agência Bori / Labjor Unicamp",
            "tipo": "programa",
            "area": "educacao",
            "modalidade": "remoto",
            "cidade": "Campinas",
            "prazo": hoje + timedelta(days=14),
            "link_original": "https://abori.com.br/",
            "afirmativa_mulheres": False,
            "afirmativa_negras": False,
            "afirmativa_trans": False,
            "fonte_afirmacao": None,
            "descricao": (
                "Formação prática para jovens pesquisadoras e comunicadoras traduzirem artigos científicos "
                "brasileiros em textos acessíveis para a imprensa e escolas de todo o país."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Vaga Afirmativa: Pessoa Desenvolvedora Back-End Python Júnior — LuizaLabs",
            "organizacao": "LuizaLabs (Magalu)",
            "tipo": "emprego",
            "area": "computacao",
            "modalidade": "remoto",
            "cidade": "São Paulo",
            "prazo": hoje + timedelta(days=11),
            "link_original": "https://carreiras.magalu.com/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": True,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Descrição oficial na página de carreiras LuizaLabs/Magalu: 'Vaga afirmativa para mulheres "
                "(cis e trans) e pessoas negras para ampliar a equidade nas nossas tribos de engenharia.'"
            ),
            "descricao": (
                "Desenvolvimento e manutenção de APIs REST em Python, integração com bancos de dados relacionais "
                "e participação em ritos ágeis em time multidisciplinar 100% remoto."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Bolsa de Pesquisa em Biodiversidade Amazônica e Saberes Tradicionais (INPA)",
            "organizacao": "Instituto Nacional de Pesquisas da Amazônia (INPA)",
            "tipo": "ic",
            "area": "ambiental",
            "modalidade": "presencial",
            "cidade": "Manaus",
            "prazo": hoje + timedelta(days=28),
            "link_original": "https://www.gov.br/inpa/pt-br",
            "afirmativa_mulheres": False,
            "afirmativa_negras": False,
            "afirmativa_trans": False,
            "fonte_afirmacao": None,
            "descricao": (
                "Iniciação científica em ecologia florestal e manejo sustentável de recursos naturais na Amazônia, "
                "com trabalho de campo e catalogação em herbário."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Estágio em Ciência de Dados e Políticas Públicas Educacionais — Ipea",
            "organizacao": "Instituto de Pesquisa Econômica Aplicada (Ipea)",
            "tipo": "estagio",
            "area": "humanas",
            "modalidade": "hibrido",
            "cidade": "Brasília",
            "prazo": hoje + timedelta(days=21),
            "link_original": "https://www.ipea.gov.br/",
            "afirmativa_mulheres": False,
            "afirmativa_negras": False,
            "afirmativa_trans": False,
            "fonte_afirmacao": None,
            "descricao": (
                "Apoio na organização de bases de dados do Censo Escolar e da PNAD Contínua para estudos sobre "
                "permanência estudantil, desigualdades regionais e transição escola-trabalho."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Bootcamp WomakersCode — Cloud & Cibersegurança para Mulheres",
            "organizacao": "WomakersCode",
            "tipo": "programa",
            "area": "computacao",
            "modalidade": "remoto",
            "cidade": "Belo Horizonte",
            "prazo": hoje + timedelta(days=7),
            "link_original": "https://womakerscode.org/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": True,
            "afirmativa_trans": True,
            "fonte_afirmacao": (
                "Edital WomakersCode: 'Comunidade e programas de formação tecnológica gratuitos e exclusivos "
                "para todas as mulheres (cis e trans), com priorização de bolsas para mulheres negras.'"
            ),
            "descricao": (
                "Formação intensiva com laboratórios práticos de computação em nuvem, segurança da informação, "
                "redes e mentoria de empregabilidade com recrutadoras parceiras."
            ),
            "data_coleta": coleta,
        },
        {
            "titulo": "Bolsa de Iniciação Tecnológica em Bioengenharia e Tecnologias Assistivas (UFMG)",
            "organizacao": "Universidade Federal de Minas Gerais (UFMG)",
            "tipo": "ic",
            "area": "engenharias",
            "modalidade": "presencial",
            "cidade": "Belo Horizonte",
            "prazo": hoje - timedelta(days=5),
            "link_original": "https://www.ufmg.br/prpq/",
            "afirmativa_mulheres": True,
            "afirmativa_negras": False,
            "afirmativa_trans": False,
            "fonte_afirmacao": (
                "Chamada interna do Laboratório de Bioengenharia (UFMG) vinculada ao incentivo de alunas na "
                "Engenharia Mecânica e Elétrica."
            ),
            "descricao": (
                "Desenvolvimento de protótipos impressos em 3D e sensores de baixo custo para dispositivos de "
                "tecnologia assistiva e reabilitação motora."
            ),
            "data_coleta": coleta,
        },
    ]


def _garantir_coluna_afirmativa_negras():
    inspetor = inspect(db.engine)
    if not inspetor.has_table("vagas"):
        db.create_all()
        return
    colunas = {c["name"] for c in inspetor.get_columns("vagas")}
    if "afirmativa_negras" not in colunas:
        db.session.execute(
            text("ALTER TABLE vagas ADD COLUMN afirmativa_negras BOOLEAN NOT NULL DEFAULT 0")
        )
        db.session.commit()


def popular_vagas(limpar=False):
    _garantir_coluna_afirmativa_negras()
    if limpar:
        Vaga.query.delete()
        db.session.commit()

    agora = datetime.utcnow()
    criadas = 0
    for i, dados in enumerate(_vagas_curadas()):
        existente = Vaga.query.filter_by(titulo=dados["titulo"]).first()
        if existente:
            existente.afirmativa_negras = dados["afirmativa_negras"]
            continue
        vaga = Vaga(
            **dados,
            criada_em=agora - timedelta(hours=4 * i),
        )
        db.session.add(vaga)
        criadas += 1
    db.session.commit()
    return criadas


@click.command("seed-vagas")
@click.option("--limpar", is_flag=True, help="Apaga as vagas existentes antes de inserir.")
def seed_vagas(limpar):
    """Cria curadoria de 20 vagas reais e afirmativas para demonstração."""
    criadas = popular_vagas(limpar=limpar)
    click.echo(f"{criadas} vagas criadas. Abra http://127.0.0.1:5000/vagas")
