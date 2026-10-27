"""Curadoria de descobertas e avanços científicos feitos por mulheres: flask --app run seed-noticias"""
from datetime import date, datetime, timedelta

import click

from ..extensoes import db
from .models import Noticia


def _noticias_curadas(hoje=None):
    hoje = hoje or date.today()

    return [
        {
            "titulo": "Polilaminina: proteína desenvolvida na UFRJ regenera lesões na medula espinhal",
            "cientista": "Dra. Tatiana Coelho de Sampaio",
            "instituicao": "Universidade Federal do Rio de Janeiro (UFRJ)",
            "area": "biologicas",
            "categoria": "descoberta",
            "fonte_nome": "UFRJ / FAPERJ",
            "link_fonte": "https://ufrj.br/",
            "data_publicacao": hoje - timedelta(days=3),
            "cientista_brasileira": True,
            "cientista_negra": False,
            "destaque": True,
            "resumo": (
                "Após mais de duas décadas de pesquisa no Instituto de Ciências Biomédicas da UFRJ, a equipe liderada "
                "pela bióloga Tatiana Sampaio desenvolveu a polilaminina, um composto derivado da placenta humana capaz "
                "de reconectar neurônios e devolver movimentos após lesões medulares graves em testes clínicos."
            ),
        },
        {
            "titulo": "Sequenciamento do genoma do SARS-CoV-2 no Brasil em tempo recorde de 48 horas",
            "cientista": "Dra. Jaqueline Goes de Jesus",
            "instituicao": "Instituto de Medicina Tropical da USP / Fiocruz",
            "area": "saude",
            "categoria": "descoberta",
            "fonte_nome": "Revista FAPESP",
            "link_fonte": "https://revistapesquisa.fapesp.br/",
            "data_publicacao": hoje - timedelta(days=6),
            "cientista_brasileira": True,
            "cientista_negra": True,
            "destaque": True,
            "resumo": (
                "A biomédica baiana Jaqueline Goes de Jesus co-liderou a equipe que sequenciou os primeiros genomas do "
                "novo coronavírus na América Latina apenas 48 horas após a confirmação do primeiro caso no país, "
                "enquanto a média mundial era de 15 dias, diferenciando a cepa e guiando a vigilância genômica."
            ),
        },
        {
            "titulo": "Descoberta das 'bolhas azuis' onde nascem estrelas fora de galáxias e da maior espiral do universo",
            "cientista": "Dra. Duília de Mello",
            "instituicao": "NASA Goddard Space Flight Center / Catholic University of America",
            "area": "fisica",
            "categoria": "descoberta",
            "fonte_nome": "NASA / Sociedade Astronômica Brasileira",
            "link_fonte": "https://www.nasa.gov/",
            "data_publicacao": hoje - timedelta(days=9),
            "cientista_brasileira": True,
            "cientista_negra": False,
            "destaque": True,
            "resumo": (
                "Utilizando dados do telescópio espacial Hubble e do satélite GALEX, a astrofísica brasileira Duília de "
                "Mello identificou berçários estelares órfãos ('blue blobs') no espaço intergaláctico e participou da "
                "descoberta de NGC 6872 como a maior galáxia espiral conhecida."
            ),
        },
        {
            "titulo": "Catalisadores inovadores reduzem emissões de poluentes atmosféricos na indústria",
            "cientista": "Dra. Viviane dos Santos Barbosa",
            "instituicao": "Instituto Tecnológico de Aeronáutica (ITA) / TU Delft",
            "area": "quimica",
            "categoria": "inovacao",
            "fonte_nome": "Academia Brasileira de Ciências",
            "link_fonte": "https://www.abc.org.br/",
            "data_publicacao": hoje - timedelta(days=12),
            "cientista_brasileira": True,
            "cientista_negra": True,
            "destaque": False,
            "resumo": (
                "A pesquisadora baiana Viviane dos Santos Barbosa desenvolveu materiais catalíticos para conversão de "
                "gases tóxicos como óxidos de nitrogênio e monóxido de carbono, sendo premiada em simpósios "
                "internacionais de nanotecnologia e aerossóis."
            ),
        },
        {
            "titulo": "Fixação biológica de nitrogênio economiza bilhões na agricultura sustentável brasileira",
            "cientista": "Dra. Mariangela Hungria",
            "instituicao": "Embrapa Soja / Academia Brasileira de Ciências",
            "area": "ambiental",
            "categoria": "inovacao",
            "fonte_nome": "Embrapa / World Food Prize Foundation",
            "link_fonte": "https://www.embrapa.br/",
            "data_publicacao": hoje - timedelta(days=15),
            "cientista_brasileira": True,
            "cientista_negra": False,
            "destaque": False,
            "resumo": (
                "As pesquisas da microbiologista Mariangela Hungria com bactérias fixadoras de nitrogênio (rizóbios) "
                "permitem que lavouras de soja, feijão e milho dispensem fertilizantes químicos nitrogenados, "
                "reduzindo drasticamente a emissão de gases de efeito estufa e a poluição de rios."
            ),
        },
        {
            "titulo": "Pioneirismo em sensores de infravermelho e abertura de caminhos para mulheres negras na Física",
            "cientista": "Dra. Sônia Guimarães",
            "instituicao": "Instituto Tecnológico de Aeronáutica (ITA)",
            "area": "fisica",
            "categoria": "pioneirismo",
            "fonte_nome": "Sociedade Brasileira de Física (SBF)",
            "link_fonte": "https://www.sbfisica.org.br/",
            "data_publicacao": hoje - timedelta(days=18),
            "cientista_brasileira": True,
            "cientista_negra": True,
            "destaque": False,
            "resumo": (
                "Primeira mulher negra doutora em Física no Brasil e primeira professora negra do ITA, Sônia Guimarães "
                "desenvolveu pesquisas fundamentais em materiais semicondutores e sensores de radiação infravermelha, "
                "recebendo a Medalha Santos-Dumont de Honra ao Mérito."
            ),
        },
        {
            "titulo": "Anomalias da água abrem caminho para dessalinização mais eficiente com nanotubos",
            "cientista": "Dra. Márcia Cristina Bernardes Barbosa",
            "instituicao": "Universidade Federal do Rio Grande do Sul (UFRGS)",
            "area": "fisica",
            "categoria": "premio",
            "fonte_nome": "UNESCO / L'Oréal Para Mulheres na Ciência",
            "link_fonte": "https://www.ufrgs.br/",
            "data_publicacao": hoje - timedelta(days=21),
            "cientista_brasileira": True,
            "cientista_negra": False,
            "destaque": False,
            "resumo": (
                "Laureada internacional do prêmio L'Oréal-UNESCO, a física Márcia Barbosa modelou como a difusão "
                "anômala das moléculas de água em estruturas nanoscópicas pode acelerar a filtragem de sal e a "
                "obtenção de água potável em regiões áridas."
            ),
        },
        {
            "titulo": "Comprovação científica da relação entre o vírus Zika e a síndrome congênita da microcefalia",
            "cientista": "Dra. Celina Maria Turchi Martelli e Dra. Adriana Melo",
            "instituicao": "Fiocruz Pernambuco / Instituto de Pesquisa Professor Joaquim Amorim Neto",
            "area": "saude",
            "categoria": "descoberta",
            "fonte_nome": "Fiocruz / Nature Ten",
            "link_fonte": "https://portal.fiocruz.br/",
            "data_publicacao": hoje - timedelta(days=25),
            "cientista_brasileira": True,
            "cientista_negra": False,
            "destaque": False,
            "resumo": (
                "Liderando o grupo de emergência epidemiológica no Nordeste, a médica e epidemiologista Celina Turchi "
                "e a pesquisadora Adriana Melo comprovaram o vínculo entre a infecção pelo Zika na gestação e a "
                "microcefalia, guiando políticas públicas de saúde materna no mundo inteiro."
            ),
        },
        {
            "titulo": "Auditoria algorítmica expõe viés racial em sistemas de reconhecimento facial",
            "cientista": "Dra. Joy Buolamwini e Dra. Timnit Gebru",
            "instituicao": "Algorithmic Justice League / DAIR Institute",
            "area": "computacao",
            "categoria": "descoberta",
            "fonte_nome": "MIT Media Lab / Proceedings of FAT*",
            "link_fonte": "https://www.ajl.org/",
            "data_publicacao": hoje - timedelta(days=29),
            "cientista_brasileira": False,
            "cientista_negra": True,
            "destaque": False,
            "resumo": (
                "O estudo seminal 'Gender Shades' demonstrou que sistemas comerciais de visão computacional tinham "
                "taxas de erro de até 34,7% para rostos de mulheres negras contra menos de 1% para homens brancos, "
                "transformando a ética e a regulação de Inteligência Artificial globalmente."
            ),
        },
        {
            "titulo": "Mapeamento da participação de mulheres negras e descolonização do ensino de Ciências Exatas",
            "cientista": "Dra. Katemari Diogo da Rosa",
            "instituicao": "Universidade Federal da Bahia (UFBA)",
            "area": "educacao",
            "categoria": "pioneirismo",
            "fonte_nome": "UFBA / American Physical Society",
            "link_fonte": "https://www.ufba.br/",
            "data_publicacao": hoje - timedelta(days=33),
            "cientista_brasileira": True,
            "cientista_negra": True,
            "destaque": False,
            "resumo": (
                "Pesquisadora em ensino de Física e estudos feministas da ciência, Katemari Rosa coordena projetos que "
                "resgatam contribuições históricas de cientistas negras e constroem redes de permanência para "
                "estudantes negras e LGBTQIA+ nas áreas de STEM."
            ),
        },
        {
            "titulo": "Novas soluções para equações diferenciais dispersivas rendem reconhecimento internacional na Matemática",
            "cientista": "Dra. Carolina Araujo",
            "instituicao": "Instituto de Matemática Pura e Aplicada (IMPA)",
            "area": "matematica",
            "categoria": "premio",
            "fonte_nome": "IMPA / ICTP Ramanujan Prize",
            "link_fonte": "https://impa.br/",
            "data_publicacao": hoje - timedelta(days=37),
            "cientista_brasileira": True,
            "cientista_negra": False,
            "destaque": False,
            "resumo": (
                "Primeira matemática brasileira a vencer o Prêmio Ramanujan, Carolina Araujo avança na geometria "
                "algébrica birracional e lidera a rede de mulheres matemáticas na América Latina para ampliar a "
                "presença feminina em pós-graduações de Matemática."
            ),
        },
        {
            "titulo": "Biossensores eletroquímicos de baixo custo detectam contaminantes na água e doenças tropicais",
            "cientista": "Dra. Lauro Tatsuo Kubota e Dra. Cristiane Kalinke",
            "instituicao": "Unicamp / UFPR",
            "area": "quimica",
            "categoria": "inovacao",
            "fonte_nome": "Sociedade Brasileira de Química (SBQ)",
            "link_fonte": "https://www.sbq.org.br/",
            "data_publicacao": hoje - timedelta(days=41),
            "cientista_brasileira": True,
            "cientista_negra": False,
            "destaque": False,
            "resumo": (
                "Pesquisadoras brasileiras em química analítica desenvolveram eletrodos impressos em 3D a partir de "
                "materiais recicláveis capazes de detectar pesticidas em rios e biomarcadores de dengue em minutos."
            ),
        },
    ]


def popular_noticias(limpar=False):
    db.create_all()
    if limpar:
        Noticia.query.delete()
        db.session.commit()

    agora = datetime.utcnow()
    criadas = 0
    for i, dados in enumerate(_noticias_curadas()):
        if Noticia.query.filter_by(titulo=dados["titulo"]).first():
            continue
        noticia = Noticia(
            **dados,
            criada_em=agora - timedelta(hours=5 * i),
        )
        db.session.add(noticia)
        criadas += 1
    db.session.commit()
    return criadas


@click.command("seed-noticias")
@click.option("--limpar", is_flag=True, help="Apaga as notícias existentes antes de inserir.")
def seed_noticias(limpar):
    """Cria curadoria de 12 descobertas e notícias científicas protagonizadas por mulheres."""
    criadas = popular_noticias(limpar=limpar)
    click.echo(f"{criadas} notícias criadas. Abra http://127.0.0.1:5000/noticias")
