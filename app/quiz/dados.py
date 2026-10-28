"""Conteúdo do quiz "Que cientista você seria?".

Cada resposta dá pontos para áreas (as mesmas de catalogos.AREAS): 2 para a área principal
e 1 para a vizinha. A área com mais pontos define a cientista do resultado.
Para mudar uma pergunta ou cientista, é só editar aqui: a página se monta a partir disto.
"""
from .. import catalogos

PERGUNTAS = [
    {
        "texto": "Num sábado livre, você prefere…",
        "opcoes": [
            {"texto": "Montar ou consertar alguma coisa", "pontos": {"engenharias": 2, "fisica": 1}},
            {"texto": "Fazer uma trilha ou cuidar de plantas", "pontos": {"ambiental": 2, "biologicas": 1}},
            {"texto": "Conversar e entender o jeito das pessoas", "pontos": {"humanas": 2, "educacao": 1}},
            {"texto": "Resolver um quebra-cabeça ou desafio de lógica", "pontos": {"matematica": 2, "computacao": 1}},
        ],
    },
    {
        "texto": "Na escola, a aula que passa voando é…",
        "opcoes": [
            {"texto": "Matemática", "pontos": {"matematica": 2, "engenharias": 1}},
            {"texto": "Biologia", "pontos": {"biologicas": 2, "saude": 1}},
            {"texto": "História, sociologia ou redação", "pontos": {"humanas": 2, "educacao": 1}},
            {"texto": "Química ou física, de preferência no laboratório", "pontos": {"quimica": 2, "fisica": 1}},
        ],
    },
    {
        "texto": "Que pergunta te deixa mais curiosa?",
        "opcoes": [
            {"texto": "Do que são feitas as estrelas?", "pontos": {"fisica": 2, "quimica": 1}},
            {"texto": "Como uma vacina protege o corpo?", "pontos": {"saude": 2, "biologicas": 1}},
            {"texto": "Como um app sabe do que eu gosto?", "pontos": {"computacao": 2, "matematica": 1}},
            {"texto": "Por que algumas pessoas têm menos oportunidades?", "pontos": {"educacao": 2, "humanas": 1}},
        ],
    },
    {
        "texto": "Num trabalho em grupo, você é quem…",
        "opcoes": [
            {"texto": "Explica a matéria para quem ficou com dúvida", "pontos": {"educacao": 2, "humanas": 1}},
            {"texto": "Faz as contas e os gráficos", "pontos": {"matematica": 2, "fisica": 1}},
            {"texto": "Testa as ideias na prática até funcionar", "pontos": {"engenharias": 2, "quimica": 1}},
            {"texto": "Organiza tudo no computador e cria a apresentação", "pontos": {"computacao": 2, "engenharias": 1}},
        ],
    },
    {
        "texto": "Que problema do mundo você queria resolver?",
        "opcoes": [
            {"texto": "Mudanças climáticas e poluição", "pontos": {"ambiental": 2, "quimica": 1}},
            {"texto": "Doenças que ainda não têm cura", "pontos": {"saude": 2, "biologicas": 1}},
            {"texto": "Crianças sem acesso a uma boa escola", "pontos": {"educacao": 2, "humanas": 1}},
            {"texto": "Animais ameaçados de extinção", "pontos": {"biologicas": 2, "ambiental": 1}},
        ],
    },
    {
        "texto": "Seu lugar de trabalho dos sonhos é…",
        "opcoes": [
            {"texto": "Um laboratório cheio de tubos de ensaio", "pontos": {"quimica": 2, "saude": 1}},
            {"texto": "Um observatório olhando o céu", "pontos": {"fisica": 2, "matematica": 1}},
            {"texto": "Uma empresa de tecnologia criando apps", "pontos": {"computacao": 2, "engenharias": 1}},
            {"texto": "Uma floresta, um rio ou o campo", "pontos": {"ambiental": 2, "biologicas": 1}},
        ],
    },
]

# Uma cientista brasileira de referência por área.
RESULTADOS = {
    "computacao": {
        "cientista": "Nina da Hora",
        "sobre": "Cientista da computação, pesquisa ética em inteligência artificial e fala sobre como deixar os "
                 "algoritmos mais justos, sem discriminar pessoas.",
        "perfil": "Você gosta de entender como as coisas funcionam por dentro e quer que a tecnologia sirva a todo mundo.",
    },
    "engenharias": {
        "cientista": "Enedina Alves Marques",
        "sobre": "Formada em 1945, foi a primeira mulher negra engenheira do Brasil. Trabalhou em grandes obras "
                 "de usinas hidrelétricas no Paraná.",
        "perfil": "Você põe a mão na massa, testa, erra, ajusta e só sossega quando a ideia sai do papel.",
    },
    "matematica": {
        "cientista": "Elza Furtado Gomide",
        "sobre": "Primeira mulher a fazer doutorado em matemática na USP, em 1950. Ajudou a formar gerações de "
                 "matemáticas e matemáticos no Brasil.",
        "perfil": "Você enxerga padrões onde ninguém vê e adora um desafio que parece impossível.",
    },
    "fisica": {
        "cientista": "Sonia Guimarães",
        "sobre": "Primeira mulher negra brasileira doutora em física. Professora do ITA, pesquisa materiais "
                 "semicondutores e luta por mais meninas negras na ciência.",
        "perfil": "Você quer saber como o universo funciona, das partículas às estrelas, e sempre pergunta \"por quê?\".",
    },
    "quimica": {
        "cientista": "Vanderlan Bolzani",
        "sobre": "Química da Unesp, estuda substâncias das plantas brasileiras que podem virar remédios e já foi "
                 "reconhecida com prêmios internacionais.",
        "perfil": "Você é curiosa sobre do que as coisas são feitas e adora ver uma mistura mudar de cor.",
    },
    "biologicas": {
        "cientista": "Bertha Lutz",
        "sobre": "Bióloga do Museu Nacional, estudou sapos e pererecas do Brasil. Também foi uma das líderes da "
                 "luta pelo voto das mulheres no país.",
        "perfil": "Você se encanta com a vida em todas as formas, do microscópio até a floresta.",
    },
    "saude": {
        "cientista": "Jaqueline Goes de Jesus",
        "sobre": "Biomédica baiana, fez parte da equipe que sequenciou o genoma do coronavírus no Brasil em "
                 "apenas 48 horas, em 2020.",
        "perfil": "Você quer cuidar das pessoas e descobrir respostas que salvam vidas.",
    },
    "ambiental": {
        "cientista": "Johanna Döbereiner",
        "sobre": "Agrônoma da Embrapa, descobriu como bactérias ajudam plantas como a soja a tirar nitrogênio "
                 "do ar. Isso economiza adubo e protege o meio ambiente.",
        "perfil": "Você pensa no planeta inteiro e procura jeitos de a gente viver melhor com a natureza.",
    },
    "humanas": {
        "cientista": "Lélia Gonzalez",
        "sobre": "Antropóloga, filósofa e professora. Pensou o Brasil a partir das mulheres negras e ajudou a "
                 "fundar o Movimento Negro Unificado.",
        "perfil": "Você quer entender as pessoas, a história e a sociedade, e não aceita injustiça calada.",
    },
    "educacao": {
        "cientista": "Antonieta de Barros",
        "sobre": "Professora em Santa Catarina e primeira mulher negra eleita deputada no Brasil, em 1934. O Dia "
                 "do Professor nasceu de uma lei proposta por ela.",
        "perfil": "Você adora explicar, compartilhar o que sabe e ver os outros aprendendo com você.",
    },
}

AREAS = catalogos.valores(catalogos.AREAS)

# Confere o conteúdo ao subir o app: um erro de digitação aqui quebraria o resultado.
assert set(RESULTADOS) == set(AREAS), "Cada área de catalogos.AREAS precisa de uma cientista"
for _pergunta in PERGUNTAS:
    for _opcao in _pergunta["opcoes"]:
        assert set(_opcao["pontos"]) <= set(AREAS), _opcao


def resultado(area):
    """A cientista da área, com o nome da área, ou None se a área não existe."""
    if area not in RESULTADOS:
        return None
    return {"area": area, "area_rotulo": catalogos.rotulo(catalogos.AREAS, area), **RESULTADOS[area]}


def calcular(respostas):
    """respostas = índice da opção escolhida em cada pergunta. Devolve a área vencedora.

    Empate: ganha a área que foi a principal (2 pontos) mais vezes; depois, a que pontuou
    por último, porque as últimas respostas costumam ser as mais pensadas."""
    if len(respostas) != len(PERGUNTAS):
        raise ValueError("Responda todas as perguntas.")
    pontos = {area: 0 for area in AREAS}
    principal = {area: 0 for area in AREAS}
    ultima = {area: -1 for area in AREAS}
    for i, (pergunta, escolha) in enumerate(zip(PERGUNTAS, respostas)):
        if not isinstance(escolha, int) or isinstance(escolha, bool) or not 0 <= escolha < len(pergunta["opcoes"]):
            raise ValueError("Resposta inválida.")
        for area, valor in pergunta["opcoes"][escolha]["pontos"].items():
            pontos[area] += valor
            ultima[area] = i
            if valor == 2:
                principal[area] += 1
    return max(AREAS, key=lambda a: (pontos[a], principal[a], ultima[a]))
