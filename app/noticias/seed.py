"""Curadoria de descobertas e avanços científicos feitos por mulheres: flask --app run seed-noticias"""
from datetime import date, datetime, timedelta
from pathlib import Path

import click
from sqlalchemy import inspect, text

from ..extensoes import db
from .models import Noticia

PASTA_IMG_NOTICIAS = Path(__file__).resolve().parent.parent / "static" / "img" / "noticias"

ILUSTRACOES_SVG = {
    "polilaminina.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#24132e"/>
      <stop offset="55%" stop-color="#4e1a47"/>
      <stop offset="100%" stop-color="#b8135c"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffe873" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#ffe873" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <g stroke="#fbd3e3" stroke-opacity="0.3" stroke-width="1.5" fill="none">
    <path d="M40 290 C160 220, 240 250, 320 180 C400 110, 490 140, 600 70"/>
    <path d="M70 80 C180 140, 250 120, 320 180 C390 240, 470 220, 580 300"/>
    <path d="M120 330 C210 260, 260 210, 320 180 C380 150, 430 100, 520 30"/>
  </g>
  <g stroke="#ffc4dc" stroke-width="3.2" stroke-linecap="round" fill="none">
    <path d="M90 250 Q210 190 320 180 T550 110"/>
    <path d="M130 115 Q230 165 320 180 T510 255"/>
    <path d="M210 295 Q275 225 320 180 T445 65"/>
  </g>
  <circle cx="320" cy="180" r="56" fill="url(#glow)"/>
  <circle cx="320" cy="180" r="18" fill="#ffe873" stroke="#fff" stroke-width="4"/>
  <circle cx="195" cy="212" r="11" fill="#cdefb0" stroke="#fff" stroke-width="2.5"/>
  <circle cx="445" cy="145" r="12" fill="#cdefb0" stroke="#fff" stroke-width="2.5"/>
  <circle cx="235" cy="155" r="9" fill="#ffc4dc"/>
  <circle cx="415" cy="215" r="10" fill="#ffc4dc"/>
  <circle cx="120" cy="240" r="7" fill="#ffe873"/>
  <circle cx="520" cy="120" r="8" fill="#ffe873"/>
  <rect x="24" y="24" width="210" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">NEUROCIÊNCIA · UFRJ</text>
</svg>""",
    "genoma-sars.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f3433"/>
      <stop offset="55%" stop-color="#176862"/>
      <stop offset="100%" stop-color="#17907f"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <g opacity="0.22" stroke="#cdefb0" stroke-width="2">
    <line x1="60" y1="290" x2="60" y2="210"/><line x1="90" y1="290" x2="90" y2="160"/>
    <line x1="120" y1="290" x2="120" y2="230"/><line x1="150" y1="290" x2="150" y2="140"/>
    <line x1="490" y1="290" x2="490" y2="170"/><line x1="520" y1="290" x2="520" y2="130"/>
    <line x1="550" y1="290" x2="550" y2="210"/><line x1="580" y1="290" x2="580" y2="150"/>
  </g>
  <g fill="none" stroke-width="5" stroke-linecap="round">
    <path d="M90 130 C165 60, 240 260, 320 160 C400 60, 475 260, 550 130" stroke="#ffe873"/>
    <path d="M90 210 C165 280, 240 80, 320 180 C400 280, 475 80, 550 210" stroke="#ffc4dc"/>
  </g>
  <g stroke="#fffdf7" stroke-width="3" stroke-opacity="0.8">
    <line x1="135" y1="115" x2="135" y2="225"/><line x1="185" y1="135" x2="185" y2="205"/>
    <line x1="265" y1="195" x2="265" y2="145"/><line x1="320" y1="160" x2="320" y2="180"/>
    <line x1="375" y1="140" x2="375" y2="200"/><line x1="455" y1="215" x2="455" y2="125"/>
    <line x1="505" y1="195" x2="505" y2="145"/>
  </g>
  <rect x="24" y="24" width="248" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">SEQUENCIAMENTO 48H · USP</text>
</svg>""",
    "bolhas-azuis.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <radialGradient id="space" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1d2951"/>
      <stop offset="60%" stop-color="#111633"/>
      <stop offset="100%" stop-color="#070917"/>
    </radialGradient>
    <radialGradient id="blob" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7ec8ff"/>
      <stop offset="55%" stop-color="#2e6bd6" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#2e6bd6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#space)"/>
  <g fill="#fff">
    <circle cx="80" cy="90" r="1.5"/><circle cx="140" cy="280" r="2"/><circle cx="540" cy="70" r="1.8"/>
    <circle cx="590" cy="240" r="1.4"/><circle cx="480" cy="300" r="2.2"/><circle cx="210" cy="60" r="1.5"/>
    <circle cx="65" cy="210" r="1.2"/><circle cx="410" cy="55" r="1.6"/>
  </g>
  <g transform="translate(275 185) rotate(-18)" fill="none" stroke-linecap="round">
    <path d="M0 0 C35 -10, 75 20, 60 65 C42 115, -45 110, -95 75 C-150 35, -155 -45, -105 -95" stroke="#fbd3e3" stroke-width="5" opacity="0.75"/>
    <path d="M0 0 C-35 10, -75 -20, -60 -65 C-42 -115, 45 -110, 95 -75 C150 -35, 155 45, 105 95" stroke="#ffe873" stroke-width="4" opacity="0.65"/>
  </g>
  <circle cx="275" cy="185" r="22" fill="#fffdf7"/>
  <circle cx="475" cy="135" r="46" fill="url(#blob)"/>
  <circle cx="465" cy="128" r="5" fill="#fff"/><circle cx="488" cy="142" r="4" fill="#d6eeff"/><circle cx="472" cy="150" r="3" fill="#fff"/>
  <circle cx="525" cy="175" r="32" fill="url(#blob)"/>
  <circle cx="525" cy="175" r="4" fill="#fff"/>
  <rect x="24" y="24" width="220" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">ASTROFÍSICA · NASA</text>
</svg>""",
    "catalisadores.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3f2618"/>
      <stop offset="55%" stop-color="#8c4319"/>
      <stop offset="100%" stop-color="#efa20f"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <g stroke="#fffdf7" stroke-opacity="0.35" stroke-width="2" fill="none">
    <polygon points="220,120 265,95 310,120 310,170 265,195 220,170"/>
    <polygon points="310,120 355,95 400,120 400,170 355,195 310,170"/>
    <polygon points="265,195 310,170 355,195 355,245 310,270 265,245"/>
    <polygon points="355,195 400,170 445,195 445,245 400,270 355,245"/>
  </g>
  <g fill="#ffe873" stroke="#2a1c15" stroke-width="2.5">
    <circle cx="265" cy="95" r="10"/><circle cx="355" cy="95" r="10"/>
    <circle cx="220" cy="170" r="10"/><circle cx="310" cy="170" r="13" fill="#cdefb0"/>
    <circle cx="400" cy="170" r="13" fill="#cdefb0"/><circle cx="265" cy="245" r="10"/>
    <circle cx="355" cy="245" r="13" fill="#ffc4dc"/><circle cx="445" cy="245" r="10"/>
  </g>
  <rect x="24" y="24" width="235" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">CATÁLISE E AR LIMPO · ITA</text>
</svg>""",
    "fixacao-nitrogenio.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e4d2b"/>
      <stop offset="55%" stop-color="#2c6b38"/>
      <stop offset="100%" stop-color="#3f2618"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <line x1="0" y1="190" x2="640" y2="190" stroke="#cdefb0" stroke-opacity="0.4" stroke-width="3" stroke-dasharray="8 6"/>
  <path d="M320 190 L320 95" stroke="#cdefb0" stroke-width="7" stroke-linecap="round"/>
  <path d="M320 135 C270 125, 250 85, 295 75 C320 70, 320 115, 320 135 Z" fill="#cdefb0"/>
  <path d="M320 120 C370 110, 390 70, 345 60 C320 55, 320 100, 320 120 Z" fill="#8fd66c"/>
  <g stroke="#ffe873" stroke-width="3.5" fill="none" stroke-linecap="round">
    <path d="M320 190 C305 235, 260 270, 210 315"/>
    <path d="M320 190 C335 240, 385 275, 435 315"/>
    <path d="M320 190 C320 245, 310 290, 325 335"/>
  </g>
  <g fill="#ffc4dc" stroke="#fffdf7" stroke-width="2">
    <circle cx="275" cy="255" r="11"/><circle cx="240" cy="290" r="9"/>
    <circle cx="365" cy="258" r="12"/><circle cx="320" cy="275" r="10"/><circle cx="402" cy="292" r="8"/>
  </g>
  <rect x="24" y="24" width="245" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">BIOINSUMOS · EMBRAPA</text>
</svg>""",
    "infravermelho.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a1025"/>
      <stop offset="50%" stop-color="#7e3fb4"/>
      <stop offset="100%" stop-color="#d81b60"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <circle cx="320" cy="190" r="105" fill="#1b0c1e" stroke="#ffe873" stroke-width="4"/>
  <g stroke="#ffe873" stroke-opacity="0.35" stroke-width="1.5">
    <line x1="215" y1="150" x2="425" y2="150"/><line x1="215" y1="190" x2="425" y2="190"/><line x1="215" y1="230" x2="425" y2="230"/>
    <line x1="280" y1="85" x2="280" y2="295"/><line x1="320" y1="85" x2="320" y2="295"/><line x1="360" y1="85" x2="360" y2="295"/>
  </g>
  <path d="M70 190 Q115 130, 160 190 T250 190 T340 190 T430 190 T520 190 T610 190" fill="none" stroke="#ffc4dc" stroke-width="4.5"/>
  <rect x="24" y="24" width="265" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">FÍSICA APLICADA · SÔNIA GUIMARÃES</text>
</svg>""",
    "anomalias-agua.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d2b45"/>
      <stop offset="55%" stop-color="#205c8a"/>
      <stop offset="100%" stop-color="#2e6bd6"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect x="90" y="120" width="460" height="130" rx="24" fill="none" stroke="#c9dcf5" stroke-width="3" stroke-dasharray="10 6"/>
  <g fill="#fffdf7">
    <circle cx="180" cy="185" r="18" fill="#7ec8ff"/><circle cx="163" cy="168" r="8"/><circle cx="163" cy="202" r="8"/>
    <circle cx="320" cy="185" r="18" fill="#7ec8ff"/><circle cx="303" cy="168" r="8"/><circle cx="303" cy="202" r="8"/>
    <circle cx="460" cy="185" r="18" fill="#7ec8ff"/><circle cx="443" cy="168" r="8"/><circle cx="443" cy="202" r="8"/>
  </g>
  <path d="M215 185 L275 185 M355 185 L415 185" stroke="#ffe873" stroke-width="4" stroke-linecap="round"/>
  <rect x="24" y="24" width="235" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">NANOTUBOS E ÁGUA · UFRGS</text>
</svg>""",
    "zika-microcefalia.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#47122b"/>
      <stop offset="60%" stop-color="#8c0d45"/>
      <stop offset="100%" stop-color="#d81b60"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <circle cx="320" cy="190" r="88" fill="none" stroke="#fbd3e3" stroke-width="3" opacity="0.45"/>
  <polygon points="320,120 380,155 380,225 320,260 260,225 260,155" fill="#ffc4dc" fill-opacity="0.2" stroke="#ffe873" stroke-width="3.5"/>
  <circle cx="320" cy="190" r="26" fill="#ffe873"/>
  <rect x="24" y="24" width="245" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">EPIDEMIOLOGIA · FIOCRUZ</text>
</svg>""",
    "gender-shades.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22183b"/>
      <stop offset="55%" stop-color="#5a2d82"/>
      <stop offset="100%" stop-color="#b8135c"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect x="210" y="85" width="220" height="200" rx="18" fill="none" stroke="#ffe873" stroke-width="3.5" stroke-dasharray="16 8"/>
  <circle cx="285" cy="155" r="10" fill="#cdefb0"/><circle cx="355" cy="155" r="10" fill="#cdefb0"/>
  <path d="M285 215 Q320 240 355 215" fill="none" stroke="#ffc4dc" stroke-width="4" stroke-linecap="round"/>
  <rect x="24" y="24" width="245" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">JUSTIÇA ALGORÍTMICA · IA</text>
</svg>""",
    "descolonizacao-stem.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b1d11"/>
      <stop offset="55%" stop-color="#7e3fb4"/>
      <stop offset="100%" stop-color="#efa20f"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <polygon points="320,90 420,265 220,265" fill="none" stroke="#fffdf7" stroke-width="4"/>
  <line x1="120" y1="210" x2="265" y2="185" stroke="#fffdf7" stroke-width="4"/>
  <line x1="365" y1="170" x2="520" y2="135" stroke="#ffe873" stroke-width="4"/>
  <line x1="375" y1="190" x2="520" y2="185" stroke="#ffc4dc" stroke-width="4"/>
  <line x1="385" y1="210" x2="520" y2="235" stroke="#cdefb0" stroke-width="4"/>
  <rect x="24" y="24" width="250" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">CIÊNCIA E EDUCAÇÃO · UFBA</text>
</svg>""",
    "geometria-impa.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#261447"/>
      <stop offset="55%" stop-color="#54297a"/>
      <stop offset="100%" stop-color="#2e6bd6"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <g fill="none" stroke="#ffc4dc" stroke-width="2.5">
    <ellipse cx="320" cy="185" rx="170" ry="75"/>
    <ellipse cx="320" cy="185" rx="170" ry="75" transform="rotate(35 320 185)" stroke="#ffe873"/>
    <ellipse cx="320" cy="185" rx="170" ry="75" transform="rotate(-35 320 185)" stroke="#cdefb0"/>
  </g>
  <rect x="24" y="24" width="245" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">GEOMETRIA ALGÉBRICA · IMPA</text>
</svg>""",
    "biossensores-3d.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#103738"/>
      <stop offset="55%" stop-color="#17907f"/>
      <stop offset="100%" stop-color="#2e6bd6"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect x="190" y="95" width="260" height="175" rx="16" fill="#182b33" stroke="#cdefb0" stroke-width="3.5"/>
  <g stroke="#ffe873" stroke-width="3" fill="none">
    <path d="M230 145 H290 V215 H350 V145 H410"/>
    <circle cx="320" cy="180" r="28" fill="#7ec8ff" fill-opacity="0.35" stroke="#fffdf7"/>
  </g>
  <rect x="24" y="24" width="255" height="34" rx="17" fill="#fffdf7" fill-opacity="0.92"/>
  <text x="42" y="46" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a1c15">BIOSSENSORES 3D · UNICAMP</text>
</svg>""",
}


def _garantir_ilustracoes():
    PASTA_IMG_NOTICIAS.mkdir(parents=True, exist_ok=True)
    for nome, conteudo in ILUSTRACOES_SVG.items():
        caminho = PASTA_IMG_NOTICIAS / nome
        if not caminho.exists():
            caminho.write_text(conteudo, encoding="utf-8")


def _garantir_coluna_imagem_url():
    inspetor = inspect(db.engine)
    if not inspetor.has_table("noticias"):
        db.create_all()
        return
    colunas = {c["name"] for c in inspetor.get_columns("noticias")}
    if "imagem_url" not in colunas:
        db.session.execute(text("ALTER TABLE noticias ADD COLUMN imagem_url VARCHAR(500)"))
        db.session.commit()


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
            "imagem_url": "/static/img/noticias/polilaminina.svg",
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
            "imagem_url": "/static/img/noticias/genoma-sars.svg",
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
            "imagem_url": "/static/img/noticias/bolhas-azuis.svg",
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
            "imagem_url": "/static/img/noticias/catalisadores.svg",
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
            "imagem_url": "/static/img/noticias/fixacao-nitrogenio.svg",
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
            "imagem_url": "/static/img/noticias/infravermelho.svg",
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
            "imagem_url": "/static/img/noticias/anomalias-agua.svg",
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
            "imagem_url": "/static/img/noticias/zika-microcefalia.svg",
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
            "imagem_url": "/static/img/noticias/gender-shades.svg",
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
            "imagem_url": "/static/img/noticias/descolonizacao-stem.svg",
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
            "imagem_url": "/static/img/noticias/geometria-impa.svg",
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
            "cientista": "Dra. Cristiane Kalinke e equipe",
            "instituicao": "Unicamp / UFPR",
            "area": "quimica",
            "categoria": "inovacao",
            "fonte_nome": "Sociedade Brasileira de Química (SBQ)",
            "link_fonte": "https://www.sbq.org.br/",
            "imagem_url": "/static/img/noticias/biossensores-3d.svg",
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
    _garantir_ilustracoes()
    _garantir_coluna_imagem_url()
    if limpar:
        Noticia.query.delete()
        db.session.commit()

    agora = datetime.utcnow()
    criadas = 0
    for i, dados in enumerate(_noticias_curadas()):
        existente = Noticia.query.filter_by(titulo=dados["titulo"]).first()
        if existente:
            existente.imagem_url = dados["imagem_url"]
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
