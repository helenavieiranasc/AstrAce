# Ciência Delas

Plataforma que dá visibilidade, pertencimento e caminho de carreira a mulheres e meninas na ciência.
Flask + SQLAlchemy (SQLite para testar, MySQL em produção), HTML, CSS e TypeScript.

## Rodar na sua máquina

Precisa de Python 3.11+ e Node.js.

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
npm install

flask --app run seed-mural      # cria usuárias e projetos de exemplo
flask --app run run --debug     # abre em http://127.0.0.1:5000
```

Sem `DATABASE_URL`, o banco é um SQLite em `instance/`. Para MySQL, copie `.env.example` para `.env` e preencha.
`flask --app run seed-mural --limpar` apaga tudo e recria os exemplos.

**Testes:** `pip install -r requirements-dev.txt` e depois `pytest`. O CI (GitHub Actions) roda os testes e confere
se os `.js` compilados estão em dia em todo PR.

**TypeScript:** o código fica em `frontend/src/` e compila para `app/static/js/`.
Rode `npm run watch` enquanto mexe no front. Os `.js` compilados vão para o git, então quem só mexe no backend não precisa do Node.

## Estrutura

```
app/
  __init__.py        create_app: cada frente registra o próprio blueprint aqui
  auth.py            usuaria_atual(): quem está logada
  catalogos.py       áreas, níveis e identidades (use nos seus filtros e formulários)
  usuarias/models.py Usuaria e IdentidadeUsuaria (modelo mínimo)
  mural/             Pessoa 1: mural, cadastro de projetos, denúncias
  templates/         base.html (cabeçalho e menu) + páginas
  static/css/        base.css (cores, fontes, botões) + CSS de cada página
frontend/src/        TypeScript
```

Para uma página nova: estenda `base.html`, use as variáveis de cor de `base.css`
(`--magenta`, `--papel`, `--tinta`, `--postit-*`, `--pin-*`) e as classes `.botao`, `.botao--primario`.

## Mural (Pessoa 1)

Páginas: `/mural` e `/mural/novo`.

| Rota | O que faz |
| --- | --- |
| `GET /api/mural/opcoes` | Tipos de projeto (com os campos extras), áreas, níveis, identidades, instituições, cidades e motivos de denúncia |
| `GET /api/projetos` | Lista com filtros `q`, `tipo`, `area`, `nivel`, `instituicao`, `cidade`, `identidade`, mais `pagina` e `por_pagina` |
| `GET /api/projetos/destaques` | Até 5 projetos com `destaque = 1` e `destaque_semana` igual à semana atual (ex.: `2026-W44`) |
| `GET /api/projetos/<id>` | Detalhe |
| `POST /api/projetos` | Cria um projeto (JSON, com `arquivos: [ids]` e `fotos: [ids]`). Erros voltam como `422 {"erros": {"campo": "mensagem"}}` |
| `POST /api/uploads` | Envia um arquivo (form-data: `arquivo` e `finalidade` = `material`, `foto` ou `capa`). Devolve `{id, url, nome, tipo, tamanho}` |
| `GET /uploads/<nome>` | Abre ou baixa um arquivo enviado |
| `POST /api/projetos/<id>/denuncias` | `{"motivo": "...", "comentario": "..."}`. Com 3 denúncias, o projeto sai do mural |
| `POST /api/projetos/<id>/destaque` | Só admin. `{"destaque": true}` coloca o projeto nos destaques da semana |

O filtro por identidade só considera quem marcou aquela identidade como pública (`publica = 1`).

**Todo projeto precisa de material.** Cada tipo diz o que exige em `material` (`app/mural/tipos.py`):

| Tipo | Exige |
| --- | --- |
| IC, extensão | Arquivo (relatório, resumo, pôster, fotos) |
| Software, app ou site | Link do GitHub ou do site |
| Monografia, congresso, social, aula, protótipo | Arquivo **ou** link |

Arquivos aceitos: PDF, jpg, png, webp, docx e pptx, até 10 MB cada e no máximo 5 por projeto.
Além disso, cada projeto pode ter até 5 fotos (opcional). A primeira vira a capa no mural, e o detalhe mostra uma galeria.
Em extensão, social e protótipo, as fotos também contam como material (`fotos_contam` em `tipos.py`).
O servidor confere os primeiros bytes de cada arquivo, então um `.exe` renomeado para `.pdf` é recusado.
Os arquivos ficam em `instance/uploads/`, fora do git.

## Pontos de encaixe com as outras frentes

- **Pessoa 2 (login e perfil):** no login, grave `session["usuaria_id"] = usuaria.id`; o mural já usa isso pelo `usuaria_atual()`.
  Pode adicionar campos em `Usuaria` à vontade, só não renomeie os que existem.
  Enquanto o login não fica pronto, `LOGIN_DEV=1` faz o site agir como a primeira usuária do banco. Desligue (`LOGIN_DEV=0`) quando o login funcionar.
- **Pessoa 3 (tipos B e eventos):** os campos extras de `software`, `social`, `aula` e `prototipo` entram na lista `campos` desses tipos em
  `app/mural/tipos.py`, e o material exigido pode ser ajustado em `material`. O formulário e a validação se montam sozinhos a partir dali.
  O cartaz de eventos fica no topo do mural (`.cartaz-eventos` em `templates/mural.html`) e aponta para `/eventos`.
  O upload de imagens já existe (`POST /api/uploads`, em `app/uploads/`); pode usar para eventos também.
- **Pessoa 5 (admin):** use `POST /api/projetos/<id>/destaque` para escolher os destaques da semana.
