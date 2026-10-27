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


ESTADOS = [
    {"valor": "AC", "rotulo": "Acre"},
    {"valor": "AL", "rotulo": "Alagoas"},
    {"valor": "AP", "rotulo": "Amapá"},
    {"valor": "AM", "rotulo": "Amazonas"},
    {"valor": "BA", "rotulo": "Bahia"},
    {"valor": "CE", "rotulo": "Ceará"},
    {"valor": "DF", "rotulo": "Distrito Federal"},
    {"valor": "ES", "rotulo": "Espírito Santo"},
    {"valor": "GO", "rotulo": "Goiás"},
    {"valor": "MA", "rotulo": "Maranhão"},
    {"valor": "MT", "rotulo": "Mato Grosso"},
    {"valor": "MS", "rotulo": "Mato Grosso do Sul"},
    {"valor": "MG", "rotulo": "Minas Gerais"},
    {"valor": "PA", "rotulo": "Pará"},
    {"valor": "PB", "rotulo": "Paraíba"},
    {"valor": "PR", "rotulo": "Paraná"},
    {"valor": "PE", "rotulo": "Pernambuco"},
    {"valor": "PI", "rotulo": "Piauí"},
    {"valor": "RJ", "rotulo": "Rio de Janeiro"},
    {"valor": "RN", "rotulo": "Rio Grande do Norte"},
    {"valor": "RS", "rotulo": "Rio Grande do Sul"},
    {"valor": "RO", "rotulo": "Rondônia"},
    {"valor": "RR", "rotulo": "Roraima"},
    {"valor": "SC", "rotulo": "Santa Catarina"},
    {"valor": "SP", "rotulo": "São Paulo"},
    {"valor": "SE", "rotulo": "Sergipe"},
    {"valor": "TO", "rotulo": "Tocantins"},
]


def valores(catalogo):
    return {item["valor"] for item in catalogo}


def rotulo(catalogo, valor):
    for item in catalogo:
        if item["valor"] == valor:
            return item["rotulo"]
    return valor
