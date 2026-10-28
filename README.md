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
flask --app run seed-eventos    # cria eventos de exemplo (datas a partir de hoje)
flask --app run run --debug     # abre em http://127.0.0.1:5000
```

Sem `DATABASE_URL`, o banco é um SQLite em `instance/`. Para MySQL, copie `.env.example` para `.env` e preencha.
`flask --app run seed-mural --limpar` apaga tudo e recria os exemplos. O mesmo vale para `seed-eventos --limpar`.

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
  usuarias/models.py Usuaria, ContaUsuaria (login Google e cadastro) e IdentidadeUsuaria
  conta/             landing page (/), login com Google e cadastro do perfil (AstrAce)
  mural/             Pessoa 1: mural, cadastro de projetos, denúncias
  eventos/           Pessoa 3: agenda de eventos, filtros e detalhe
  templates/         base.html (cabeçalho e menu) + páginas
  static/css/        base.css (cores, fontes, botões) + CSS de cada página
frontend/src/        TypeScript
```

Para uma página nova: estenda `base.html`, use as variáveis de cor de `base.css`
(`--magenta`, `--papel`, `--tinta`, `--postit-*`, `--pin-*`) e as classes `.botao`, `.botao--primario`.

## Mural (Pessoa 1)

Páginas: `/mural`, `/mural/novo` e `/mural/mapa` (mapa "Onde elas brilham").

| Rota | O que faz |
| --- | --- |
| `GET /api/mural/opcoes` | Tipos de projeto (com os campos extras), áreas, níveis, identidades, estados, instituições, cidades, motivos de denúncia e `local_perfil` (`{uf, cidade}` do perfil, para o formulário já vir preenchido) |
| `GET /api/cidades?uf=PE` | Municípios do estado, em ordem alfabética (da base guardada no projeto, sem chamar API externa) |
| `GET /api/mural/mapa` | Projetos visíveis agrupados por cidade: `{cidades: [{cidade, uf, x, y, total, projetos}], total, sem_local}`. `x` e `y` são a posição (em %) no desenho `static/img/mapa-brasil.svg` |
| `GET /api/projetos` | Lista com filtros `q`, `tipo`, `area`, `nivel`, `instituicao`, `cidade`, `identidade`, mais `pagina`, `por_pagina` e `ordem` (`recentes` ou `estrelas`) |
| `GET /api/projetos/destaques` | Até 5 projetos com `destaque = 1` e `destaque_semana` igual à semana atual (ex.: `2026-W44`). Sem nenhum escolhido, os que mais ganharam estrelas nos últimos 7 dias (o mural mostra "Em alta na semana") |
| `GET /api/projetos/<id>` | Detalhe, com `parecidos` (até 3 cartões da mesma área, completando com os do mesmo tipo), `bilhetes` (cada frase com `total` e `meu`), `minha` (se quem vê é a autora) e `citacao` (referência ABNT e citações no texto) |
| `POST /api/projetos/<id>/bilhetes` | `{"frase": "inspirador"}` cola ou tira esse bilhete da usuária logada. Só frases de `FRASES_BILHETE` (`tipos.py`); a autora não cola no próprio projeto (`403`). Devolve `{bilhetes, total}` |
| `POST /api/projetos/<id>/estrela` | Dá ou tira a estrela da usuária logada. Devolve `{estrelas, estrelado}` |
| `POST /api/projetos` | Cria um projeto (JSON, com `uf` e `cidade`, `arquivos: [ids]` e `fotos: [ids]`). Erros voltam como `422 {"erros": {"campo": "mensagem"}}` |
| `POST /api/uploads` | Envia um arquivo (form-data: `arquivo` e `finalidade` = `material`, `foto` ou `capa`). Devolve `{id, url, nome, tipo, tamanho}` |
| `GET /uploads/<nome>` | Abre ou baixa um arquivo enviado |
| `POST /api/projetos/<id>/denuncias` | `{"motivo": "...", "comentario": "..."}`. Com 3 denúncias, o projeto sai do mural |
| `POST /api/projetos/<id>/destaque` | Só admin. `{"destaque": true}` coloca o projeto nos destaques da semana |

**Estado e cidade:** no formulário, a autora escolhe o estado e a cidade numa lista com os 5.570 municípios
(`app/dados/municipios.json`, da base [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros), licença MIT,
com os códigos do IBGE). O servidor confere se a cidade existe naquele estado e guarda o nome oficial em `cidade` e a sigla em `uf`.
Quem manda só `cidade`, sem `uf` (como a edição pelo perfil), continua funcionando: o estado é completado quando o nome existe em um só estado.
`app/municipios.py` serve para qualquer frente: `buscar("Recife", "PE")`, `nomes_da_uf("PE")`.
A coluna `uf` entra sozinha em bancos antigos ao subir o app (`mural.completar_colunas`).

**Citar:** o botão "Citar" do detalhe mostra a referência segundo a ABNT NBR 6023:2025 e a citação no texto segundo
a NBR 10520:2023 (sobrenome só com a inicial maiúscula). A referência é montada em `app/mural/citacao.py` com os dados
do projeto (nome público da autora, título, tipo, curso, evento, instituição, cidade e ano) e aponta para a página do
projeto, ou para o link, no caso de software. O painel avisa para citar a publicação original quando ela existir.

**Mapa:** as coordenadas vêm da mesma base de municípios, então qualquer cidade aparece. Projetos antigos sem `uf` entram quando o nome
é único no Brasil; os outros ficam em `sem_local`. O desenho dos estados vem da malha do IBGE e fica no projeto, então o mapa funciona sem internet.

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

## Quiz "Que cientista você seria?"

Página: `/quiz`, com um papel na página inicial e um item no menu lateral. São 6 perguntas; cada resposta dá pontos para áreas e a área
com mais pontos define uma cientista brasileira de referência. O resultado leva para projetos, eventos e vagas
da área (`?area=` em `/mural`, `/eventos` e `/vagas`) e gera uma imagem para o story (1080x1920, desenhada no navegador).

| Rota | O que faz |
| --- | --- |
| `GET /api/quiz` | Perguntas e opções (sem os pontos) |
| `POST /api/quiz/resultado` | `{"respostas": [0, 2, 1, 3, 0, 1]}` (índice da opção em cada pergunta). Devolve `{area, area_rotulo, cientista, sobre, perfil}` |
| `GET /api/quiz/resultado/<area>` | O resultado de uma área, para o link compartilhado (`/quiz?resultado=fisica`) |

Perguntas, pontos e cientistas ficam em `app/quiz/dados.py`. Um teste confere que toda área pode sair como resultado.

## Eventos (Pessoa 3)

Página: `/eventos`. O cartaz no topo do mural mostra a data e o nome do próximo evento (`cartaz-eventos.js`).

| Rota | O que faz |
| --- | --- |
| `GET /api/eventos/opcoes` | Modalidades, públicos, tipos de evento, áreas e cidades com eventos |
| `GET /api/eventos` | Próximos eventos (inclui os que estão acontecendo), em ordem de data. Filtros `q`, `cidade`, `modalidade`, `publico`, `area`, `tipo`, `gratuito=1` e `periodo` (`30dias` ou `semana`), mais `pagina` e `por_pagina` |
| `GET /api/eventos/semana` | "Acontece esta semana": de agora até domingo |
| `GET /api/eventos/proximo` | O próximo evento, ou `null` se a agenda estiver vazia |
| `GET /api/eventos/<id>` | Detalhe, com `link` da inscrição, `link_mapa`, `link_agenda` (Google Agenda) e `tem_carimbo` |

O filtro `publico` também traz os eventos abertos a todas.

A tabela `eventos` fica em `app/eventos/models.py` e as listas de opções em `app/eventos/catalogo.py`.
As datas são guardadas no horário de Brasília, sem fuso. `link` é obrigatório: as inscrições acontecem no site de quem organiza.
Quando `token_qr` está preenchido, o evento mostra o selo "vale carimbo" e o aviso do passaporte no detalhe.

Os cadastros de projetos da parte B (software, social, aula e protótipo) estão em `app/mural/tipos.py`.

## Landing, login com Google e perfil (AstrAce)

`/` é a landing page. Quem já entrou vai direto para `/mural` (perfil completo) ou `/cadastro` (perfil por terminar).
As outras páginas continuam abertas a todo mundo.

**Para o login funcionar**, crie um cliente OAuth no Google e preencha o `.env`:

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um projeto e configure a
   tela de consentimento OAuth (tipo "Externo"; os escopos são só `openid`, `email` e `profile`).
2. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, escolha **Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, coloque o endereço de retorno de cada lugar onde o site roda, por exemplo
   `http://127.0.0.1:5000/entrar/google/retorno` e o do servidor de produção (com `https`).
   Abra o site pelo mesmo endereço cadastrado (`127.0.0.1` e `localhost` contam como diferentes).
4. Copie o ID e a chave secreta para o `.env` como `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
   Atrás de proxy, se o endereço de retorno sair errado, defina `GOOGLE_REDIRECT_URI` com ele completo.

Sem essas variáveis, o botão "Entrar com Google" volta para a landing com um aviso (e, em modo debug, uma dica do `.env`).
Não precisa instalar nada: o fluxo usa só a biblioteca padrão do Python (`app/conta/google.py`).

| Rota | O que faz |
| --- | --- |
| `GET /` | Landing. Com sessão, redireciona para `/mural` ou `/cadastro` |
| `GET /entrar/google` | Vai para o Google (com `state` contra CSRF) |
| `GET /entrar/google/retorno` | Volta do Google: acha a usuária pela conta Google ou pelo e-mail, ou cria uma nova |
| `GET /cadastro` | Formulário do perfil (precisa estar logada) |
| `GET /api/perfil` | Perfil da usuária logada e as opções de nível, área, identidade, estado e as cidades que já existem no site |
| `POST /api/perfil` | Salva `apelido`, `data_nascimento` (`AAAA-MM-DD`), `nivel`, `area_interesse`, `estado` (sigla), `cidade`, `formacoes: [{curso, instituicao}]` (ou `instituicao` sozinha no ensino médio), `identidades: [{valor, publica}]`, `foto_id` ou `remover_foto` |
| `POST /sair` | Encerra a sessão |

O cadastro está completo quando `usuaria.conta.cadastro_concluido_em` está preenchido. A foto vai pelo `POST /api/uploads`
(`finalidade=foto`) e fica em `conta.foto_url`; no primeiro login entra a foto do Google, que a pessoa pode trocar.
A cidade é escolhida na lista de municípios do IBGE do estado (carregada pelo navegador); se o IBGE não responder,
vira texto livre com as cidades do site como sugestão. A primeira graduação também fica em `usuaria.curso`/`instituicao`.
Colunas novas em `contas_usuaria` entram sozinhas no banco ao subir o app (`conta.completar_colunas`).
`ContaUsuaria` é uma tabela à parte porque o `db.create_all()` não acrescenta colunas em tabelas que já existem:
assim ninguém precisa apagar o banco.

A estrela 3D da landing (`frontend/src/estrela-3d.ts`) é a mascote da logo (`static/img/logo-estrela-original.png`)
modelada em Three.js, que vem do CDN só quando o navegador tem WebGL. Sem ele, aparece o desenho da logo.

## Página inicial

Com o cadastro completo, o `/` é a página inicial (`templates/inicio.html`): um mural com a logo e um papel
para cada área (Projetos `/mural`, Eventos `/eventos`, Vagas `/vagas`, Notícias `/noticias`). É para lá que o login
e o fim do cadastro levam, e a logo do cabeçalho já aponta para `/`. Sem login, o `/` continua sendo a landing.

Os papéis usam dados que já existem: a data do próximo evento (`/api/eventos/proximo`) e quantos projetos e vagas há.
O Passaporte ainda não tem página, então aparece como decoração, sem link, com um aviãozinho de papel 3D
(`frontend/src/aviao-3d.ts`, Three.js do CDN; sem WebGL fica um desenho). Quando `/passaporte` existir,
é só trocar a `div.inicio-passaporte` por um link.

## Passaporte

`/passaporte` (precisa de login e cadastro completo) mostra o passaporte 3D da usuária: capa de couro rosa com a
logo em metalizado, que abre na lombada; folhas que viram de verdade (com curvatura) clicando ou arrastando; e,
na primeira vez, um carimbo 3D que desce, imprime o carimbo de boas-vindas e sobe. No celular em pé, aberto,
mostra uma página de cada vez. Os botões "Página anterior / Próxima página" fazem o mesmo pelo teclado.
Sem WebGL (ou sem internet para o Three.js), aparece a versão em texto, que é também a que o leitor de tela lê.

| Arquivo | O que tem |
| --- | --- |
| `app/passaporte/` | Rota, modelo `Carimbo` (tabela `carimbos`) e `servico.conceder()` |
| `frontend/src/passaporte-3d.ts` | Cena Three.js: capa, folhas, carimbo e animações |
| `frontend/src/passaporte-paginas.ts` | As páginas desenhadas em canvas (identidade, carimbos, impressão da tinta) |

O carimbo de boas-vindas é concedido no login (e, para quem já tinha conta, ao abrir o passaporte). Cada
`codigo` vale uma vez por usuária. `visto_em` guarda que a animação já passou
(`POST /api/passaporte/carimbos/<codigo>/visto`), então ela não se repete nem em outro dispositivo.
Para os carimbos de eventos (check-in por QR), use `servico.conceder(usuaria, f"evento-{id}", titulo)`.

## Perfil

O cabeçalho tem o botão "Menu" (abre a barra lateral com os links e a ação da página, `{% block acao_topo %}`), a logo e,
com login, a foto da usuária no canto direito (`templates/_conta_topo.html`), com um menu
"Meu perfil / Sair". A foto exibida é a escolhida por ela; sem ela, a do Google; sem as duas, a inicial do nome.
Remover a foto escolhida volta para a do Google.

`/perfil` mostra os dados e as publicações dela (os projetos do mural). `/perfil/editar` é o mesmo formulário do
cadastro, com o campo "Sobre você" (`usuaria.bio`). Publicar continua em `/mural/novo`.

| Rota | O que faz |
| --- | --- |
| `GET /api/minhas-publicacoes` | Projetos da usuária logada, inclusive os que saíram do mural por denúncia (`estado`) |
| `GET /api/minhas-publicacoes/<id>` | Dados do projeto para editar, com os campos extras do tipo |
| `PATCH /api/minhas-publicacoes/<id>` | Edita título, resumo, área, ano, nível, instituição, cidade, link e campos extras. Usa a mesma validação do mural; tipo, arquivos e fotos não mudam |
| `DELETE /api/minhas-publicacoes/<id>` | Exclui o projeto, com estrelas, denúncias e arquivos (também do disco) |

Só a dona mexe no projeto: para outra pessoa as três últimas rotas respondem `403`, e sem login `401`.

## Pontos de encaixe com as outras frentes

- **Pessoa 2 (login e perfil):** o login com Google e o cadastro inicial já existem (seção acima) e gravam `session["usuaria_id"]`,
  que o mural usa pelo `usuaria_atual()`. Pode adicionar campos em `Usuaria` à vontade, só não renomeie os que existem.
  `LOGIN_DEV=1` ainda faz o site agir como a primeira usuária do banco quando ninguém entrou. Desligue (`LOGIN_DEV=0`)
  quando o login com Google estiver configurado.
- **Pessoa 3 (tipos B e eventos):** os campos extras de `software`, `social`, `aula` e `prototipo` entram na lista `campos` desses tipos em
  `app/mural/tipos.py`, e o material exigido pode ser ajustado em `material`. O formulário e a validação se montam sozinhos a partir dali.
  O cartaz de eventos fica no topo do mural (`.cartaz-eventos` em `templates/mural.html`) e aponta para `/eventos`.
  O upload de imagens já existe (`POST /api/uploads`, em `app/uploads/`); pode usar para eventos também.
- **Pessoa 5 (admin):** use `POST /api/projetos/<id>/destaque` para escolher os destaques da semana.
  Para os eventos, grave direto no modelo `Evento` (`app/eventos/models.py`) usando as listas de `app/eventos/catalogo.py`.
  Ao salvar um evento que dá carimbo, gere o `token_qr` (ex.: `secrets.token_urlsafe(16)`). Para ocultar, use `oculto = True`.
  A foto ou cartaz do evento vai em `imagem_url` (pode usar o `POST /api/uploads`).
- **Pessoa 2 (passaporte):** o check-in `/checkin/<token_qr>` encontra o evento com `Evento.query.filter_by(token_qr=token, oculto=False)`.
  Vale conferir se o evento está acontecendo (`inicio` e `termino`) antes de carimbar.
