"""Tipos de projeto, os campos extras de cada formulário e o material que cada um exige.

O formulário de cadastro é montado a partir daqui, então para ajustar
um formulário basta mexer no tipo.

Campo: nome, rotulo, tipo ("texto" | "selecao" | "url"), obrigatorio, opcoes, ajuda.

Material: todo projeto precisa mostrar algo concreto.
  exige: "arquivo"     -> pelo menos um arquivo enviado
         "link"        -> link obrigatório (ex.: GitHub)
         "um_dos_dois" -> arquivo ou link
"""


def _campo(nome, rotulo, tipo="texto", obrigatorio=False, opcoes=None, ajuda=None):
    campo = {"nome": nome, "rotulo": rotulo, "tipo": tipo, "obrigatorio": obrigatorio}
    if opcoes:
        campo["opcoes"] = [{"valor": v, "rotulo": r} for v, r in opcoes]
    if ajuda:
        campo["ajuda"] = ajuda
    return campo


def _material(exige, rotulo_arquivo, rotulo_link, erro, ajuda_link=None, fotos_contam=False):
    """fotos_contam: as fotos da galeria valem como arquivo (ex.: extensão, protótipo)."""
    return {
        "exige": exige,
        "rotulo_arquivo": rotulo_arquivo,
        "rotulo_link": rotulo_link,
        "ajuda_link": ajuda_link,
        "erro": erro,
        "fotos_contam": fotos_contam,
    }


TIPOS = [
    # ----- Parte A: Pessoa 1 (mural) -----
    {
        "valor": "monografia",
        "rotulo": "Monografia ou TCC",
        "icone": "monografia",
        "descricao": "Trabalho de conclusão de curso, monografia ou dissertação.",
        "campos": [
            _campo("orientador", "Orientador(a)", obrigatorio=True),
            _campo("curso", "Curso"),
        ],
        "material": _material(
            "um_dos_dois",
            "PDF do trabalho",
            "Link no repositório da instituição",
            "Envie o PDF do trabalho ou cole o link do repositório da instituição.",
        ),
    },
    {
        "valor": "congresso",
        "rotulo": "Pôster ou apresentação em congresso",
        "icone": "congresso",
        "descricao": "Trabalho apresentado em congresso, simpósio, feira ou jornada.",
        "campos": [
            _campo(
                "evento",
                "Nome do evento",
                obrigatorio=True,
                ajuda="Ex.: SBPC Jovem, Febrace, Semana Acadêmica.",
            ),
            _campo(
                "formato",
                "Formato",
                tipo="selecao",
                obrigatorio=True,
                opcoes=[("poster", "Pôster"), ("oral", "Apresentação oral"), ("banner", "Banner em feira")],
            ),
            _campo("premiacao", "Premiação ou menção", ajuda="Deixe em branco se não houver."),
        ],
        "material": _material(
            "um_dos_dois",
            "Pôster, banner ou slides",
            "Link nos anais ou DOI",
            "Envie o pôster ou os slides, ou cole o link do trabalho nos anais.",
        ),
    },
    {
        "valor": "ic",
        "rotulo": "Iniciação científica",
        "icone": "ic",
        "descricao": "Pesquisa de IC, IC júnior ou PIBIC-EM.",
        "campos": [
            _campo("orientador", "Orientador(a)", obrigatorio=True),
            _campo(
                "modalidade_bolsa",
                "Bolsa",
                tipo="selecao",
                opcoes=[("bolsista", "Bolsista"), ("voluntaria", "Voluntária")],
            ),
            _campo("agencia", "Agência de fomento", ajuda="Ex.: CNPq, FAPESP, FAPEMIG ou a própria instituição."),
            _campo("laboratorio", "Laboratório ou grupo de pesquisa"),
        ],
        "material": _material(
            "arquivo",
            "Relatório, resumo ou pôster da IC",
            "Link do resumo publicado",
            "Envie o relatório, o resumo ou o pôster da IC.",
            ajuda_link="Ex.: anais do congresso de iniciação científica da sua instituição.",
        ),
    },
    {
        "valor": "extensao",
        "rotulo": "Projeto de extensão",
        "icone": "extensao",
        "descricao": "Projeto que leva a universidade ou a escola para a comunidade.",
        "campos": [
            _campo(
                "comunidade",
                "Comunidade ou público atendido",
                obrigatorio=True,
                ajuda="Ex.: alunas de escolas públicas de Recife.",
            ),
            _campo("pessoas_alcancadas", "Quantas pessoas o projeto alcançou", ajuda="Um número aproximado já ajuda."),
            _campo("coordenacao", "Coordenação"),
        ],
        "material": _material(
            "arquivo",
            "Relatório ou material produzido",
            "Site ou rede social do projeto",
            "Envie pelo menos um arquivo ou foto: relatório, fotos das atividades ou material produzido.",
            fotos_contam=True,
        ),
    },
    # ----- Parte B: Pessoa 3 (canto de eventos + cadastros) -----
    {
        "valor": "software",
        "rotulo": "Software, app ou site",
        "icone": "software",
        "descricao": "Aplicativo, site, jogo, biblioteca ou ferramenta.",
        "campos": [
            _campo(
                "plataforma",
                "Plataforma",
                tipo="selecao",
                obrigatorio=True,
                opcoes=[
                    ("web", "Site ou sistema web"),
                    ("mobile", "App para celular"),
                    ("desktop", "Programa para computador"),
                    ("jogo", "Jogo"),
                    ("biblioteca", "Biblioteca, API ou ferramenta"),
                    ("outro", "Outra"),
                ],
            ),
            _campo(
                "tecnologias",
                "Tecnologias usadas",
                obrigatorio=True,
                ajuda="Ex.: Python, Flask, MySQL, TypeScript.",
            ),
            _campo(
                "situacao",
                "Situação",
                tipo="selecao",
                opcoes=[
                    ("desenvolvimento", "Em desenvolvimento"),
                    ("publicado", "Publicado e em uso"),
                    ("concluido", "Concluído"),
                ],
            ),
            _campo(
                "demo",
                "Link para testar",
                tipo="url",
                ajuda="Site publicado, loja de apps ou vídeo de demonstração. Opcional.",
            ),
        ],
        "material": _material(
            "link",
            "Capturas de tela ou documentação",
            "Link do repositório (GitHub) ou do site",
            "Cole o link do repositório no GitHub ou do site publicado.",
        ),
    },
    {
        "valor": "social",
        "rotulo": "Projeto social ou voluntário",
        "icone": "social",
        "descricao": "Ação social, voluntariado ou coletivo.",
        "campos": [
            _campo(
                "publico",
                "Público atendido",
                obrigatorio=True,
                ajuda="Ex.: meninas de 10 a 14 anos da zona leste de São Paulo.",
            ),
            _campo("organizacao", "Coletivo, ONG ou organização", ajuda="Deixe em branco se foi uma iniciativa sua."),
            _campo(
                "papel",
                "Seu papel",
                tipo="selecao",
                opcoes=[
                    ("idealizadora", "Idealizadora"),
                    ("coordenacao", "Coordenação"),
                    ("voluntaria", "Voluntária"),
                ],
            ),
            _campo("pessoas_alcancadas", "Quantas pessoas o projeto alcançou", ajuda="Um número aproximado já ajuda."),
            _campo("periodo", "Período", ajuda="Ex.: março a junho de 2025, ou desde 2023."),
        ],
        "material": _material(
            "um_dos_dois",
            "Relatório ou material produzido",
            "Site ou rede social do projeto",
            "Envie fotos ou um relatório, ou cole o link do site ou rede social do projeto.",
            fotos_contam=True,
        ),
    },
    {
        "valor": "aula",
        "rotulo": "Trabalho de disciplina",
        "icone": "aula",
        "descricao": "Trabalho feito em aula para alguma matéria.",
        "campos": [
            _campo("disciplina", "Disciplina", obrigatorio=True, ajuda="Ex.: Banco de Dados, Química Orgânica."),
            _campo("professor", "Professor(a)"),
            _campo("curso", "Curso"),
            _campo(
                "formato",
                "Feito",
                tipo="selecao",
                opcoes=[("individual", "Individualmente"), ("grupo", "Em grupo")],
            ),
        ],
        "material": _material(
            "um_dos_dois",
            "Trabalho entregue",
            "Link do trabalho",
            "Envie o trabalho entregue ou cole o link dele.",
        ),
    },
    {
        "valor": "prototipo",
        "rotulo": "Protótipo ou invenção",
        "icone": "prototipo",
        "descricao": "Protótipo, maquete, invenção ou hardware.",
        "campos": [
            _campo(
                "problema",
                "Que problema resolve",
                obrigatorio=True,
                ajuda="Uma frase basta. Ex.: avisa quando a horta precisa de água.",
            ),
            _campo(
                "estagio",
                "Estágio",
                tipo="selecao",
                opcoes=[
                    ("ideia", "Ideia ou esboço"),
                    ("prototipo", "Protótipo funcionando"),
                    ("testado", "Testado com pessoas"),
                    ("registro", "Com pedido de patente ou registro"),
                ],
            ),
            _campo("materiais", "Materiais e tecnologias", ajuda="Ex.: Arduino, sensores, impressão 3D, papelão."),
            _campo("feira", "Feira ou competição", ajuda="Onde foi apresentado, se foi. Ex.: Febrace, Mostratec."),
        ],
        "material": _material(
            "um_dos_dois",
            "Esquemas ou documentação",
            "Vídeo ou repositório do protótipo",
            "Envie fotos ou esquemas do protótipo, ou cole o link de um vídeo ou repositório.",
            fotos_contam=True,
        ),
    },
]

TIPOS_POR_VALOR = {t["valor"]: t for t in TIPOS}

MOTIVOS_DENUNCIA = [
    {"valor": "ofensivo", "rotulo": "Conteúdo ofensivo ou discriminatório"},
    {"valor": "falso", "rotulo": "Informação falsa"},
    {"valor": "plagio", "rotulo": "Plágio ou projeto de outra pessoa"},
    {"valor": "dados_pessoais", "rotulo": "Expõe dados pessoais"},
    {"valor": "spam", "rotulo": "Propaganda ou spam"},
    {"valor": "outro", "rotulo": "Outro motivo"},
]
