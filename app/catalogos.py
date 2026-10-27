"""Listas de opções compartilhadas por todas as frentes (filtros, cadastros, perfil)."""

AREAS = [
    {"valor": "computacao", "rotulo": "Computação e tecnologia"},
    {"valor": "engenharias", "rotulo": "Engenharias"},
    {"valor": "matematica", "rotulo": "Matemática e estatística"},
    {"valor": "fisica", "rotulo": "Física e astronomia"},
    {"valor": "quimica", "rotulo": "Química"},
    {"valor": "biologicas", "rotulo": "Ciências biológicas"},
    {"valor": "saude", "rotulo": "Saúde"},
    {"valor": "ambiental", "rotulo": "Meio ambiente"},
    {"valor": "humanas", "rotulo": "Ciências humanas e sociais"},
    {"valor": "educacao", "rotulo": "Educação e divulgação científica"},
]

NIVEIS = [
    {"valor": "ensino_medio", "rotulo": "Ensino médio"},
    {"valor": "tecnico", "rotulo": "Ensino técnico"},
    {"valor": "graduacao", "rotulo": "Graduação"},
    {"valor": "pos", "rotulo": "Pós-graduação"},
    {"valor": "formada", "rotulo": "Já formada"},
]

# Identidades autodeclaradas. Só entram nos filtros quando a usuária marca publica = 1.
IDENTIDADES = [
    {"valor": "mulher_negra", "rotulo": "Mulheres negras"},
    {"valor": "mulher_trans", "rotulo": "Mulheres trans"},
    {"valor": "mulher_indigena", "rotulo": "Mulheres indígenas"},
    {"valor": "mulher_pcd", "rotulo": "Mulheres com deficiência"},
    {"valor": "lgbtqia", "rotulo": "LGBTQIA+"},
]


def valores(catalogo):
    return {item["valor"] for item in catalogo}


def rotulo(catalogo, valor):
    for item in catalogo:
        if item["valor"] == valor:
            return item["rotulo"]
    return valor
