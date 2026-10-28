"""Dados de exemplo para a demo: flask --app run seed-mural

Pessoas e projetos fictícios.
"""
import textwrap
from datetime import datetime, timedelta
from uuid import uuid4

import click

from .. import municipios
from ..extensoes import db
from ..uploads.models import Arquivo
from ..uploads.routes import pasta_uploads
from ..usuarias.models import IdentidadeUsuaria, Usuaria
from .models import Bilhete, Denuncia, Estrela, Projeto, semana_atual
from .tipos import FRASES_BILHETE

NOME_DO_PDF = {
    "monografia": "monografia.pdf",
    "congresso": "poster.pdf",
    "ic": "relatorio-ic.pdf",
    "extensao": "relatorio-extensao.pdf",
    "social": "relatorio.pdf",
    "aula": "trabalho.pdf",
    "prototipo": "esquema-prototipo.pdf",
}


def _pdf_simples(titulo, linhas):
    """Gera um PDF de uma página só com texto (sem bibliotecas extras)."""

    def escapar(texto):
        return texto.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    comandos = [f"BT /F1 18 Tf 60 750 Td ({escapar(titulo)}) Tj ET"]
    y = 715
    for linha in linhas:
        comandos.append(f"BT /F1 12 Tf 60 {y} Td ({escapar(linha)}) Tj ET")
        y -= 18
    conteudo = "\n".join(comandos).encode("cp1252", "replace")

    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(conteudo) + conteudo + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    saida = bytearray(b"%PDF-1.4\n")
    posicoes = []
    for numero, objeto in enumerate(objetos, 1):
        posicoes.append(len(saida))
        saida += b"%d 0 obj\n" % numero + objeto + b"\nendobj\n"
    inicio_xref = len(saida)
    saida += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objetos) + 1)
    for posicao in posicoes:
        saida += b"%010d 00000 n \n" % posicao
    saida += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objetos) + 1, inicio_xref)
    return bytes(saida)


def _pdf_de_exemplo(autora, tipo, titulo, resumo):
    linhas = [f"{autora.nome} - {autora.instituicao}", ""] + textwrap.wrap(resumo, 80)
    linhas += ["", "Documento de exemplo gerado para a demonstração do AstrAce."]
    conteudo = _pdf_simples(titulo, linhas)
    nome_salvo = f"{uuid4().hex}.pdf"
    (pasta_uploads() / nome_salvo).write_bytes(conteudo)
    return Arquivo(
        usuaria_id=autora.id, finalidade="material", nome_original=NOME_DO_PDF.get(tipo, "projeto.pdf"),
        nome_salvo=nome_salvo, tipo="pdf", tamanho=len(conteudo),
    )

USUARIAS = [
    # nome, apelido, email, instituicao, cidade, nivel, identidades públicas, papel
    ("Equipe AstrAce", None, "equipe@astrace.dev", "AstrAce", "São Paulo", "formada", [], "admin"),
    ("Ana Beatriz Santos", "Bia Santos", "bia@exemplo.com", "UFPE", "Recife", "graduacao", ["mulher_negra"], "usuaria"),
    ("Luana Ferreira", None, "luana@exemplo.com", "IFBA", "Salvador", "tecnico", ["mulher_negra", "lgbtqia"], "usuaria"),
    ("Marina Okamoto", None, "marina@exemplo.com", "USP", "São Paulo", "pos", [], "usuaria"),
    ("Valentina Rocha", "Val", "val@exemplo.com", "UFMG", "Belo Horizonte", "graduacao", ["mulher_trans"], "usuaria"),
    ("Yara Potiguara", None, "yara@exemplo.com", "UFRN", "Natal", "graduacao", ["mulher_indigena"], "usuaria"),
    ("Júlia Andrade", "Ju", "ju@exemplo.com", "Escola Estadual Maria Quitéria", "Feira de Santana", "ensino_medio", [], "usuaria"),
    ("Carolina Mendes", None, "carol@exemplo.com", "Unicamp", "Campinas", "pos", ["mulher_pcd"], "usuaria"),
    ("Rafaela Nunes", "Rafa", "rafa@exemplo.com", "UFAM", "Manaus", "graduacao", ["mulher_negra"], "usuaria"),
]

PROJETOS = [
    # email da autora, tipo, título, área, ano, resumo, detalhes, destaque
    (
        "bia@exemplo.com", "ic",
        "Bactérias do mangue que comem plástico",
        "biologicas", 2025,
        "Isolamos bactérias do sedimento do manguezal do Rio Capibaribe e testamos quais conseguem "
        "degradar filmes de polietileno. Duas linhagens reduziram a massa do plástico em 9% em 60 dias.",
        {"orientador": "Profa. Dra. Helena Cavalcanti", "modalidade_bolsa": "bolsista", "agencia": "CNPq",
         "laboratorio": "Laboratório de Microbiologia Ambiental"},
        True,
    ),
    (
        "luana@exemplo.com", "congresso",
        "Sensor de baixo custo para qualidade do ar em escolas",
        "engenharias", 2025,
        "Montamos um medidor de CO2 e material particulado com Arduino que custa menos de R$ 120 e "
        "mostra no painel da sala quando é hora de abrir as janelas. Testado em 6 salas do campus.",
        {"evento": "Febrace 2025", "formato": "banner", "premiacao": "2º lugar em Engenharia"},
        True,
    ),
    (
        "marina@exemplo.com", "monografia",
        "Modelos de linguagem e o viés de gênero em currículos",
        "computacao", 2024,
        "Analisei como três modelos de linguagem pontuam currículos idênticos trocando apenas o nome da "
        "candidata. Os resultados mostram diferenças de até 14% e propomos um teste de auditoria simples.",
        {"orientador": "Prof. Dr. Ricardo Lima", "curso": "Mestrado em Ciência da Computação"},
        True,
    ),
    (
        "val@exemplo.com", "extensao",
        "Clube de astronomia para meninas da periferia",
        "fisica", 2025,
        "Todo sábado levamos telescópios e oficinas de foguetes de garrafa PET para escolas da região "
        "do Barreiro. Já são 3 turmas e 4 alunas que decidiram prestar vestibular para Física.",
        {"comunidade": "Alunas de escolas públicas do Barreiro, BH", "pessoas_alcancadas": "180",
         "coordenacao": "Profa. Dra. Sônia Prado"},
        True,
    ),
    (
        "yara@exemplo.com", "ic",
        "Plantas medicinais potiguaras e atividade antifúngica",
        "quimica", 2024,
        "Junto com sabedoras da aldeia Sagi-Trabanda, catalogamos 12 plantas usadas no tratamento de "
        "micoses e testamos extratos em laboratório. Três apresentaram atividade contra Candida.",
        {"orientador": "Prof. Dr. Antônio Bezerra", "modalidade_bolsa": "voluntaria"},
        False,
    ),
    (
        "ju@exemplo.com", "congresso",
        "Por que o pão mofa mais rápido no verão?",
        "biologicas", 2025,
        "Experimento feito na escola comparando o crescimento de fungos em pães guardados em "
        "temperaturas diferentes. Apresentado na feira de ciências municipal.",
        {"evento": "Feira de Ciências de Feira de Santana", "formato": "poster"},
        False,
    ),
    (
        "carol@exemplo.com", "monografia",
        "Leitores de tela e gráficos científicos acessíveis",
        "computacao", 2025,
        "Investiguei como pesquisadoras cegas leem gráficos em artigos e criei um guia para gerar "
        "descrições alternativas a partir dos dados, com uma biblioteca em Python.",
        {"orientador": "Profa. Dra. Lúcia Tavares", "curso": "Doutorado em Computação",
         "link": "https://repositorio.unicamp.br/"},
        False,
    ),
    (
        "rafa@exemplo.com", "extensao",
        "Matemática na feira: frações com vendedoras de açaí",
        "matematica", 2024,
        "Oficinas de matemática financeira com trabalhadoras da feira da Manaus Moderna, usando os "
        "preços e medidas do dia a dia para ensinar porcentagem, frações e controle de caixa.",
        {"comunidade": "Feirantes da Manaus Moderna", "pessoas_alcancadas": "45"},
        False,
    ),
    (
        "bia@exemplo.com", "software",
        "App que avisa quando o ônibus está lotado",
        "computacao", 2025,
        "Aplicativo colaborativo em que passageiras informam a lotação do ônibus em tempo real. "
        "Inclui botão para relatar assédio e mapa das paradas mais seguras à noite.",
        {}, False,
    ),
    (
        "luana@exemplo.com", "prototipo",
        "Bengala com sensor de obstáculos acima da cintura",
        "engenharias", 2024,
        "Protótipo de bengala com sensor ultrassônico que vibra quando há galhos, orelhões ou placas "
        "na altura da cabeça, que a bengala comum não detecta.",
        {}, False,
    ),
    (
        "marina@exemplo.com", "aula",
        "Visualizando a desigualdade salarial na ciência brasileira",
        "humanas", 2024,
        "Trabalho para a disciplina de Visualização de Dados usando a base do CNPq para comparar bolsas "
        "de produtividade por gênero e região entre 2010 e 2023.",
        {}, False,
    ),
    (
        "yara@exemplo.com", "social",
        "Biblioteca itinerante de ciência em línguas indígenas",
        "educacao", 2025,
        "Coletivo que traduz livros infantis de ciência para o tupi e leva os exemplares para escolas "
        "indígenas do Rio Grande do Norte.",
        {}, False,
    ),
    (
        "val@exemplo.com", "ic",
        "Detectando exoplanetas com dados abertos do TESS",
        "fisica", 2025,
        "Usei curvas de luz públicas do satélite TESS para treinar um classificador que separa trânsitos "
        "planetários de falsos positivos causados por estrelas binárias.",
        {"orientador": "Prof. Dr. Marcos Vieira", "modalidade_bolsa": "bolsista", "agencia": "FAPEMIG"},
        False,
    ),
    (
        "rafa@exemplo.com", "monografia",
        "Mercúrio nos peixes do Rio Negro e a saúde de ribeirinhas",
        "saude", 2025,
        "Medimos mercúrio em quatro espécies de peixe consumidas por comunidades ribeirinhas e cruzamos "
        "com dados de consumo semanal para estimar o risco para gestantes.",
        {"orientador": "Profa. Dra. Iracema Lopes", "curso": "Ciências Biológicas"},
        False,
    ),
    (
        "carol@exemplo.com", "congresso",
        "Reconhecimento de Libras com visão computacional leve",
        "computacao", 2024,
        "Modelo que roda no celular e reconhece 40 sinais de Libras com 91% de acerto, pensado para "
        "atendimento em postos de saúde.",
        {"evento": "Brazilian Conference on Intelligent Systems", "formato": "oral",
         "link": "https://sol.sbc.org.br/"},
        False,
    ),
    (
        "ju@exemplo.com", "aula",
        "Horta vertical com garrafas e irrigação por gotejamento",
        "ambiental", 2025,
        "Projeto da turma do 2º ano para a disciplina de Biologia: horta vertical no muro da escola com "
        "garrafas PET e um sistema de gotejamento feito com equipo de soro.",
        {}, False,
    ),
]


def _bilhetes_de_exemplo(projeto, i, todas):
    """Alguns bilhetes variados, se o projeto ainda não tem nenhum. A primeira usuária
    (a do LOGIN_DEV) fica de fora para poder testar deixando os seus."""
    if Bilhete.query.filter_by(projeto_id=projeto.id).first():
        return
    outras = [u for u in todas[1:] if u.id != projeto.usuaria_id]
    for j, fa in enumerate(outras[: (i * 3 + 2) % 6]):
        frase = FRASES_BILHETE[(i + j // 2) % len(FRASES_BILHETE)]["valor"]  # em pares: totais variados
        db.session.add(Bilhete(projeto_id=projeto.id, usuaria_id=fa.id, frase=frase))


@click.command("seed-mural")
@click.option("--limpar", is_flag=True, help="Apaga projetos e usuárias antes de inserir.")
def seed_mural(limpar):
    """Cria usuárias e projetos de exemplo para o mural."""
    if limpar:
        pasta = pasta_uploads()
        for arquivo in Arquivo.query.all():
            (pasta / arquivo.nome_salvo).unlink(missing_ok=True)
        Arquivo.query.delete()
        Estrela.query.delete()
        Bilhete.query.delete()
        Denuncia.query.delete()
        Projeto.query.delete()
        IdentidadeUsuaria.query.delete()
        Usuaria.query.delete()
        db.session.commit()

    por_email = {}
    for nome, apelido, email, inst, cidade, nivel, identidades, papel in USUARIAS:
        usuaria = Usuaria.query.filter_by(email=email).first()
        if not usuaria:
            usuaria = Usuaria(
                nome=nome, apelido=apelido, email=email, instituicao=inst,
                cidade=cidade, nivel=nivel, papel=papel,
            )
            usuaria.identidades = [IdentidadeUsuaria(identidade=i, publica=True) for i in identidades]
            db.session.add(usuaria)
        por_email[email] = usuaria
    db.session.flush()

    agora = datetime.utcnow()
    criados = 0
    todas = list(por_email.values())
    for i, (email, tipo, titulo, area, ano, resumo, detalhes, destaque) in enumerate(PROJETOS):
        existente = Projeto.query.filter_by(titulo=titulo).first()
        if existente:
            _bilhetes_de_exemplo(existente, i, todas)  # bancos de antes dos bilhetes também ganham alguns
            continue
        autora = por_email[email]
        detalhes = dict(detalhes)
        link = detalhes.pop("link", None) or ("https://github.com/" if tipo == "software" else None)
        local = municipios.buscar_sem_uf(autora.cidade)
        projeto = Projeto(
            usuaria_id=autora.id, tipo=tipo, titulo=titulo, resumo=resumo, area=area, ano=ano,
            instituicao=autora.instituicao, cidade=autora.cidade, uf=local[1] if local else None,
            nivel=autora.nivel,
            link_externo=link, detalhes=detalhes, destaque=destaque,
            destaque_semana=semana_atual() if destaque else None,
            # Um dia e meio entre cada projeto: só os mais recentes ganham a etiqueta "Novo!".
            criado_em=agora - timedelta(hours=36 * i),
        )
        # Todo projeto mostra algo concreto: software tem link, os outros ganham um PDF.
        if tipo != "software":
            projeto.arquivos = [_pdf_de_exemplo(autora, tipo, titulo, resumo)]
        db.session.add(projeto)
        db.session.flush()
        # Algumas estrelas de outras usuárias, em quantidades variadas, para a demo.
        quantidade = (i * 5 + 3) % len(todas)
        for fa in [u for u in todas if u.id != autora.id][:quantidade]:
            db.session.add(Estrela(projeto_id=projeto.id, usuaria_id=fa.id))
        _bilhetes_de_exemplo(projeto, i, todas)
        criados += 1
    db.session.commit()
    click.echo(f"{criados} projetos criados. Abra http://127.0.0.1:5000/mural")
