import {
  api,
  el,
  esc,
  CORES_CAPA,
  formatarTamanho,
  htmlFoto,
  icone,
  mensagemDeErro,
  nomeDoFormato,
  postJson,
  preencherSelect,
  urlSegura,
  type Cartao,
  type Detalhe,
  type FraseBilhete,
  type OpcoesMural,
  type PaginaProjetos,
} from "./comum.js";

const POR_PAGINA = 12;
const CAMPOS_FILTRO = ["q", "tipo", "area", "nivel", "instituicao", "cidade", "identidade"] as const;
type Filtros = Record<(typeof CAMPOS_FILTRO)[number], string>;

const PINS = ["--pin-magenta", "--pin-violeta", "--pin-verde", "--pin-ambar", "--pin-azul"];
// Nomes curtos para as etiquetas de área caberem numa linha (o nome completo fica no title e no aria-label).
const AREAS_CURTAS: Record<string, string> = {
  computacao: "Computação",
  engenharias: "Engenharias",
  matematica: "Matemática",
  fisica: "Física",
  quimica: "Química",
  biologicas: "Biologia",
  saude: "Saúde",
  ambiental: "Meio ambiente",
  humanas: "Humanas",
  educacao: "Educação",
};

const form = el<HTMLFormElement>("filtros");
const grade = el<HTMLUListElement>("grade");
const estado = el("estado");
const contagem = el("contagem");
const botaoMais = el<HTMLButtonElement>("carregar-mais");
const destaques = el("destaques");
const destaquesLista = el<HTMLUListElement>("destaques-lista");
const dialogo = el<HTMLDialogElement>("detalhe");
const conteudoDetalhe = el("detalhe-conteudo");
const aviso = el("aviso");
const botaoLimpar = el<HTMLButtonElement>("filtros-limpar");
const listaAreas = el("areas-lista");
const selectOrdem = el<HTMLSelectElement>("ordem");

let opcoes: OpcoesMural | null = null;
let pagina = 1;
let pedidoAtual = 0;
let focoAntesDoDetalhe: HTMLElement | null = null;
let temporizadorBusca: number | undefined;
let temporizadorAviso: number | undefined;

// ---------- Filtros ----------

function lerFiltros(): Filtros {
  const dados = new FormData(form);
  return Object.fromEntries(
    CAMPOS_FILTRO.map((campo) => [campo, String(dados.get(campo) ?? "").trim()]),
  ) as Filtros;
}

function temFiltro(filtros: Filtros): boolean {
  return CAMPOS_FILTRO.some((campo) => filtros[campo] !== "");
}

function ordemAtual(): string {
  return selectOrdem.value === "estrelas" ? "estrelas" : "recentes";
}

function sincronizarUrl(filtros: Filtros): void {
  const params = new URLSearchParams();
  for (const campo of CAMPOS_FILTRO) {
    if (filtros[campo]) params.set(campo, filtros[campo]);
  }
  if (ordemAtual() !== "recentes") params.set("ordem", ordemAtual());
  const busca = params.toString();
  history.replaceState(null, "", busca ? `?${busca}` : location.pathname);
}

function aplicarFiltrosDaUrl(): void {
  const params = new URLSearchParams(location.search);
  for (const campo of CAMPOS_FILTRO) {
    const valor = params.get(campo);
    // Para as áreas (rádio), namedItem devolve a lista de opções; definir .value marca a certa.
    const controle = form.elements.namedItem(campo) as HTMLInputElement | HTMLSelectElement | RadioNodeList | null;
    if (valor && controle) controle.value = valor;
  }
  if (params.get("ordem") === "estrelas") selectOrdem.value = "estrelas";
}

function preencherFiltros(o: OpcoesMural): void {
  const select = (nome: string) => form.elements.namedItem(nome) as HTMLSelectElement;
  preencherSelect(select("tipo"), o.tipos);
  preencherSelect(select("nivel"), o.niveis);
  preencherSelect(select("instituicao"), o.instituicoes);
  preencherSelect(select("cidade"), o.cidades);
  preencherSelect(select("identidade"), o.identidades);

  listaAreas.insertAdjacentHTML(
    "beforeend",
    o.areas
      .map(
        (a) => `
        <label class="area-etiqueta" style="--cor-area: ${CORES_CAPA[a.valor] ?? "var(--rosa-claro)"}"
          title="${esc(a.rotulo)}">
          <input type="radio" name="area" value="${esc(a.valor)}" aria-label="${esc(a.rotulo)}">
          <span>${esc(AREAS_CURTAS[a.valor] ?? a.rotulo)}</span>
        </label>`,
      )
      .join(""),
  );
}

function aoMudarFiltros(): void {
  const filtros = lerFiltros();
  botaoLimpar.hidden = !temFiltro(filtros);
  sincronizarUrl(filtros);
  void carregar(true);
}

// ---------- Cartões ----------

/** Rotação estável por projeto, entre -2.2 e 2.2 graus. */
function rotacao(id: number, escala = 1): string {
  const x = Math.sin(id * 12.9898) * 43758.5453;
  return (((x - Math.floor(x)) * 4.4 - 2.2) * escala).toFixed(2);
}

function htmlCartao(c: Cartao, variante: "grade" | "polaroid"): string {
  const pin = PINS[c.id % PINS.length];
  const foto = htmlFoto(c);

  // Na grade, o cartão fica preso com pin; nos destaques, com fita adesiva.
  const destaque = variante === "polaroid";
  const enfeite = destaque ? "" : `<span class="pin" style="--cor-pin: var(${pin})" aria-hidden="true"></span>`;
  const selo = c.novo ? '<span class="selo-novo">Novo!</span>' : "";

  return `
    <li>
      <article class="cartao${destaque ? " cartao--destaque" : ""}"
        style="--rot: ${rotacao(c.id, destaque ? 1.3 : 1)}deg; --rot-fita: ${rotacao(c.id + 7, 2)}deg">
        ${enfeite}
        <div class="cartao__foto">${foto}${selo}</div>
        <p class="cartao__tipo">${icone(c.icone)}${esc(c.tipo_rotulo)}</p>
        <h3 class="cartao__titulo">
          <a class="cartao__link" href="/mural?projeto=${c.id}" data-id="${c.id}">${esc(c.titulo)}</a>
        </h3>
        <p class="cartao__area">${esc(c.area_rotulo)}</p>
        <div class="cartao__rodape">
          <p class="cartao__autora">${esc(c.autora)}, ${esc(c.ano)}</p>
          ${htmlClipe(c.materiais)}
          ${htmlBotaoEstrela(c.id, c.estrelas, c.estrelado, c.titulo)}
        </div>
      </article>
    </li>`;
}

// ---------- Estrelas ----------

function textoEstrelas(n: number): string {
  return n === 1 ? "1 estrela" : `${n} estrelas`;
}

function rotuloEstrela(estrelas: number, estrelado: boolean, titulo: string): string {
  const acao = estrelado ? "Tirar sua estrela de" : "Dar estrela para";
  return `${acao} ${titulo} (${textoEstrelas(estrelas)})`;
}

/** Botão pequeno do cartão. Fica por cima do link do cartão, então clicar nele não abre o detalhe. */
function htmlBotaoEstrela(id: number, estrelas: number, estrelado: boolean, titulo: string): string {
  return `
    <button class="estrela-botao" type="button" data-estrela="${id}" data-titulo="${esc(titulo)}"
      aria-pressed="${estrelado}" aria-label="${esc(rotuloEstrela(estrelas, estrelado, titulo))}">
      ${icone("estrela")}<span class="estrela-botao__total">${estrelas}</span>
    </button>`;
}

/** Atualiza todos os botões desse projeto na página (grade, destaques e detalhe). */
function atualizarEstrelas(id: number, estrelas: number, estrelado: boolean): void {
  document.querySelectorAll<HTMLButtonElement>(`[data-estrela="${id}"]`).forEach((botao) => {
    botao.setAttribute("aria-pressed", String(estrelado));
    const titulo = botao.dataset.titulo ?? "";
    if (botao.classList.contains("estrela-grande")) {
      botao.querySelector(".estrela-grande__acao")!.textContent = estrelado ? "Estrela dada" : "Dar estrela";
      botao.querySelector(".estrela-grande__total")!.textContent = textoEstrelas(estrelas);
    } else {
      botao.querySelector(".estrela-botao__total")!.textContent = String(estrelas);
      botao.setAttribute("aria-label", rotuloEstrela(estrelas, estrelado, titulo));
    }
  });
}

async function alternarEstrela(botao: HTMLButtonElement): Promise<void> {
  const id = Number(botao.dataset.estrela);
  if (botao.dataset.ocupado) return;
  botao.dataset.ocupado = "1";
  try {
    const r = await postJson<{ estrelas: number; estrelado: boolean }>(`/api/projetos/${id}/estrela`, {});
    atualizarEstrelas(id, r.estrelas, r.estrelado);
    if (r.estrelado) {
      botao.classList.remove("estrela--pulo");
      void botao.offsetWidth; // reinicia a animação
      botao.classList.add("estrela--pulo");
    }
  } catch (erro) {
    avisar(mensagemDeErro(erro));
  } finally {
    delete botao.dataset.ocupado;
  }
}

// ---------- Bilhetes de incentivo ----------

function htmlTotalBilhete(total: number): string {
  return `${total}<span class="visualmente-oculto"> ${total === 1 ? "pessoa deixou" : "pessoas deixaram"}</span>`;
}

function htmlBilhetes(p: Detalhe): string {
  const lista = p.bilhetes ?? [];
  if (lista.length === 0) return "";
  const recebidos = lista.reduce((soma, b) => soma + b.total, 0);
  const ajuda = p.minha
    ? recebidos
      ? "Os bilhetes que seu projeto recebeu."
      : "Seu projeto ainda não recebeu bilhetes."
    : `Cole um bilhete para incentivar ${esc(p.autora)}. Pode escolher mais de um, e clicar de novo tira.`;

  const itens = lista
    .map((b, i) => {
      const classes = `bilhete bilhete--${esc(b.cor)}${b.total || b.meu ? "" : " bilhete--vazio"}`;
      const estilo = `--rot: ${rotacao(p.id + i * 3, 1.2)}deg`;
      const conteudo = `<span class="bilhete__frase">${esc(b.rotulo)}</span>
        <span class="bilhete__total">${htmlTotalBilhete(b.total)}</span>`;
      // A autora só vê os bilhetes; quem visita clica para colar ou tirar.
      return p.minha
        ? `<li><span class="${classes}" style="${estilo}">${conteudo}</span></li>`
        : `<li><button type="button" class="${classes}" style="${estilo}" data-bilhete="${esc(b.valor)}"
             data-projeto="${p.id}" aria-pressed="${b.meu}">${conteudo}</button></li>`;
    })
    .join("");

  return `
    <section class="bilhetes" aria-labelledby="bilhetes-titulo">
      <h3 id="bilhetes-titulo">Bilhetes de incentivo</h3>
      <p class="bilhetes__ajuda">${ajuda}</p>
      <ul class="bilhetes__lista">${itens}</ul>
    </section>`;
}

async function alternarBilhete(botao: HTMLButtonElement): Promise<void> {
  if (botao.dataset.ocupado) return;
  botao.dataset.ocupado = "1";
  const id = Number(botao.dataset.projeto);
  try {
    const r = await postJson<{ bilhetes: FraseBilhete[] }>(`/api/projetos/${id}/bilhetes`, {
      frase: botao.dataset.bilhete,
    });
    // Atualiza só os post-its (sem redesenhar a seção), para o foco continuar no botão.
    for (const b of r.bilhetes) {
      const alvo = conteudoDetalhe.querySelector<HTMLButtonElement>(`[data-bilhete="${b.valor}"]`);
      if (!alvo) continue;
      alvo.setAttribute("aria-pressed", String(b.meu));
      alvo.classList.toggle("bilhete--vazio", !b.total && !b.meu);
      alvo.querySelector(".bilhete__total")!.innerHTML = htmlTotalBilhete(b.total);
    }
    if (botao.getAttribute("aria-pressed") === "true") {
      botao.classList.remove("bilhete--colando");
      void botao.offsetWidth; // reinicia a animação
      botao.classList.add("bilhete--colando");
    }
  } catch (erro) {
    avisar(mensagemDeErro(erro));
  } finally {
    delete botao.dataset.ocupado;
  }
}

function htmlClipe(quantidade: number): string {
  if (!quantidade) return "";
  const texto = quantidade === 1 ? "1 arquivo" : `${quantidade} arquivos`;
  return `<span class="cartao__anexos" title="${texto}">${icone("clipe")}<span>${quantidade}</span>
    <span class="visualmente-oculto">${quantidade === 1 ? "arquivo anexado" : "arquivos anexados"}</span></span>`;
}

function htmlMateriais(p: Detalhe): string {
  if (p.arquivos.length === 0) return "";
  const itens = p.arquivos
    .map((a) => {
      const url = urlSegura(a.url);
      if (!url) return "";
      return `
        <li>
          <a class="material" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
            ${icone(a.tipo === "imagem" ? "imagem" : "arquivo")}
            <span class="material__texto">
              <span class="material__nome">${esc(a.nome)}</span>
              <span class="material__info">${esc(nomeDoFormato(a.tipo))}, ${esc(formatarTamanho(a.tamanho))}</span>
            </span>
            ${icone("baixar")}
          </a>
        </li>`;
    })
    .join("");
  return `<h3 class="detalhe__subtitulo">Materiais</h3><ul class="materiais">${itens}</ul>`;
}

/** Foto grande + miniaturas. Sem fotos na galeria, mostra só a capa (se houver). */
function htmlGaleria(p: Detalhe, capa: string | null): string {
  const urls = p.fotos.map((f) => urlSegura(f.url)).filter((u): u is string => Boolean(u));
  if (urls.length === 0) {
    return capa ? `<figure class="detalhe__foto"><img src="${esc(capa)}" alt=""></figure>` : "";
  }
  const total = urls.length;
  const miniaturas =
    total > 1
      ? `<div class="galeria__miniaturas">
          ${urls
            .map(
              (u, i) => `
            <button class="galeria__miniatura" type="button" data-foto="${esc(u)}" data-indice="${i + 1}"
              aria-label="Ver foto ${i + 1} de ${total}"${i === 0 ? ' aria-current="true"' : ""}>
              <img src="${esc(u)}" alt="">
            </button>`,
            )
            .join("")}
        </div>`
      : "";
  return `
    <figure class="galeria">
      <div class="detalhe__foto galeria__principal">
        <img src="${esc(urls[0])}" alt="Foto 1 de ${total} do projeto ${esc(p.titulo)}" id="galeria-imagem">
      </div>
      ${miniaturas}
    </figure>`;
}

const HTML_CONVITE = `
  <li>
    <a class="postit postit--amarelo grade__convite" href="/mural/novo">
      <span class="pin" style="--cor-pin: var(--pin-magenta)" aria-hidden="true"></span>
      <strong>Fez um projeto?</strong>
      <span class="grade__convite-texto">Do TCC ao trabalho da feira de ciências, ele tem lugar aqui.</span>
      <span>Publicar o meu</span>
    </a>
  </li>`;

function htmlEsqueletos(quantidade: number): string {
  return Array.from({ length: quantidade }, () => '<li><div class="esqueleto"></div></li>').join("");
}

function htmlVazio(comFiltro: boolean): string {
  if (comFiltro) {
    return `
      <div class="postit postit--amarelo estado">
        <span class="pin" aria-hidden="true"></span>
        <img class="estado__mascote" src="/static/img/logo-estrela-magenta-240.png" alt="" width="240" height="244">
        <h3>Nenhum projeto com esses filtros</h3>
        <p>Tente tirar um filtro ou buscar outra palavra.</p>
        <button class="botao botao--secundario" type="button" data-acao="limpar">Limpar filtros</button>
      </div>`;
  }
  return `
    <div class="postit postit--amarelo estado">
      <span class="pin" aria-hidden="true"></span>
      <img class="estado__mascote" src="/static/img/logo-estrela-magenta-240.png" alt="" width="240" height="244">
      <h3>O mural ainda está vazio</h3>
      <p>Publique o primeiro projeto e abra caminho para as próximas.</p>
      <a class="botao botao--primario" href="/mural/novo">Publicar projeto</a>
    </div>`;
}

function htmlErro(mensagem: string): string {
  return `
    <div class="postit postit--rosa estado" role="alert">
      <span class="pin" style="--cor-pin: var(--pin-violeta)" aria-hidden="true"></span>
      <h3>Não deu para carregar os projetos</h3>
      <p>${esc(mensagem)}</p>
      <button class="botao botao--secundario" type="button" data-acao="tentar">Tentar de novo</button>
    </div>`;
}

// ---------- Carregamento ----------

async function carregar(reiniciar: boolean): Promise<void> {
  const pedido = ++pedidoAtual;
  const filtros = lerFiltros();

  if (reiniciar) {
    pagina = 1;
    grade.innerHTML = htmlEsqueletos(6);
    grade.setAttribute("aria-busy", "true");
    estado.innerHTML = "";
    botaoMais.hidden = true;
  } else {
    pagina += 1;
    botaoMais.disabled = true;
    botaoMais.textContent = "Carregando…";
  }

  const params = new URLSearchParams({ pagina: String(pagina), por_pagina: String(POR_PAGINA), ordem: ordemAtual() });
  for (const campo of CAMPOS_FILTRO) {
    if (filtros[campo]) params.set(campo, filtros[campo]);
  }

  try {
    const dados = await api<PaginaProjetos>(`/api/projetos?${params}`);
    if (pedido !== pedidoAtual) return;

    const cartoes = dados.itens.map((c) => htmlCartao(c, "grade"));
    if (reiniciar && !temFiltro(filtros) && cartoes.length >= 5) cartoes.splice(4, 0, HTML_CONVITE);

    if (reiniciar) {
      grade.innerHTML = cartoes.join("");
    } else {
      const primeiroNovo = grade.children.length;
      grade.insertAdjacentHTML("beforeend", cartoes.join(""));
      grade.children[primeiroNovo]?.querySelector<HTMLAnchorElement>(".cartao__link")?.focus();
    }

    const sufixo = temFiltro(filtros) ? " encontrados" : "";
    contagem.textContent =
      dados.total === 1 ? `1 projeto${sufixo ? " encontrado" : ""}` : `${dados.total} projetos${sufixo}`;
    botaoMais.hidden = !dados.tem_mais;
    if (dados.total === 0) estado.innerHTML = htmlVazio(temFiltro(filtros));
  } catch (erro) {
    if (pedido !== pedidoAtual) return;
    if (reiniciar) {
      grade.innerHTML = "";
      contagem.textContent = "";
      estado.innerHTML = htmlErro(mensagemDeErro(erro));
    } else {
      pagina -= 1;
      avisar(mensagemDeErro(erro));
    }
  } finally {
    if (pedido === pedidoAtual) {
      grade.removeAttribute("aria-busy");
      botaoMais.disabled = false;
      botaoMais.textContent = "Carregar mais projetos";
    }
  }
}

async function carregarDestaques(): Promise<void> {
  try {
    const lista = await api<Cartao[]>("/api/projetos/destaques");
    if (lista.length === 0) return;
    // Nenhum escolhido pela equipe: o servidor mandou os mais estrelados da semana.
    const automatico = lista.every((c) => !c.destaque);
    el("destaques-titulo").textContent = automatico ? "Em alta na semana" : "Destaques da semana";
    el("destaques-nota").hidden = !automatico;
    destaquesLista.innerHTML = lista.map((c) => htmlCartao(c, "polaroid")).join("");
    destaques.hidden = false;
  } catch {
    // A faixa de destaques é opcional: sem ela, o mural continua funcionando.
  }
}

// ---------- Detalhe ----------

function itemFicha(rotulo: string, valor: string | number | null | undefined, link = false): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const url = link ? urlSegura(String(valor)) : null;
  const conteudo = url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir link</a>`
    : esc(valor);
  return `<div><dt>${esc(rotulo)}</dt><dd>${conteudo}</dd></div>`;
}

function htmlParecidos(lista: Cartao[] | undefined): string {
  if (!lista?.length) return "";
  const itens = lista
    .map(
      (c) => `
      <li>
        <a class="mini" href="/mural?projeto=${c.id}" data-parecido="${c.id}" style="--rot: ${rotacao(c.id, 0.8)}deg">
          <span class="mini__foto">${htmlFoto(c)}</span>
          <span class="mini__tipo">${esc(c.tipo_rotulo)}</span>
          <span class="mini__titulo">${esc(c.titulo)}</span>
          <span class="mini__area">${esc(c.area_rotulo)}</span>
        </a>
      </li>`,
    )
    .join("");
  return `
    <section class="parecidos" aria-labelledby="parecidos-titulo">
      <h3 id="parecidos-titulo">Projetos parecidos</h3>
      <ul class="parecidos__lista">${itens}</ul>
    </section>`;
}

// ---------- Citar (ABNT) ----------

function htmlCitacao(p: Detalhe): string {
  const c = p.citacao;
  if (!c) return "";
  return `
    <section class="citacao" id="citacao" aria-labelledby="citacao-titulo" hidden>
      <h3 id="citacao-titulo">Como citar este projeto</h3>

      <div class="citacao__bloco">
        <p class="citacao__rotulo">Referência <span>ABNT NBR 6023:2025</span></p>
        <p class="citacao__texto" id="citacao-referencia">${c.referencia_html}</p>
        <button class="botao botao--texto citacao__copiar" type="button" data-copiar="referencia">Copiar referência</button>
      </div>

      <div class="citacao__bloco">
        <p class="citacao__rotulo">Citação no texto <span>ABNT NBR 10520:2023</span></p>
        <ul class="citacao__curtas">
          <li><code>${esc(c.citacao_parentetica)}</code>
            <button class="botao botao--texto citacao__copiar" type="button" data-copiar="parentetica">Copiar</button></li>
          <li><code>${esc(c.citacao_narrativa)}</code>
            <button class="botao botao--texto citacao__copiar" type="button" data-copiar="narrativa">Copiar</button></li>
        </ul>
      </div>

      <p class="citacao__aviso">Gerada com os dados do projeto. Confira antes de usar e, se o trabalho foi publicado
        em revista, anais ou repositório, cite a publicação original.</p>
      <p class="citacao__resultado" id="citacao-resultado" role="status"></p>
    </section>`;
}

let citacaoAtual: Detalhe["citacao"];

/** Copia com o negrito do título (HTML) quando o navegador deixa; senão, só o texto. */
async function copiarCitacao(qual: string): Promise<void> {
  const c = citacaoAtual;
  if (!c) return;
  const resultado = el("citacao-resultado");
  const texto =
    qual === "referencia" ? c.referencia_texto : qual === "parentetica" ? c.citacao_parentetica : c.citacao_narrativa;
  try {
    if (qual === "referencia" && "ClipboardItem" in window) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([c.referencia_html], { type: "text/html" }),
          "text/plain": new Blob([texto], { type: "text/plain" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(texto);
    }
    resultado.textContent = qual === "referencia" ? "Referência copiada, com o título em negrito." : "Citação copiada.";
  } catch {
    // Sem permissão para a área de transferência: seleciona o texto para copiar com Ctrl+C.
    const alvo = qual === "referencia" ? el("citacao-referencia") : null;
    if (alvo) window.getSelection()?.selectAllChildren(alvo);
    resultado.textContent = "Não deu para copiar sozinho. Selecione o texto e use Ctrl+C.";
  }
}

function htmlDetalhe(p: Detalhe): string {
  const imagem = urlSegura(p.imagem_url);
  const link = urlSegura(p.link_externo);
  const motivos = (opcoes?.motivos_denuncia ?? [])
    .map((m) => `<option value="${esc(m.valor)}">${esc(m.rotulo)}</option>`)
    .join("");

  return `
    <p class="cartao__tipo">${icone(p.icone)}${esc(p.tipo_rotulo)}</p>
    <h2 id="detalhe-titulo">${esc(p.titulo)}</h2>
    <p class="detalhe__autora">por ${esc(p.autora)}</p>
    ${htmlGaleria(p, imagem)}
    <p class="detalhe__resumo">${esc(p.resumo)}</p>
    ${htmlMateriais(p)}
    <dl class="ficha-dados">
      ${itemFicha("Área", p.area_rotulo)}
      ${itemFicha("Ano", p.ano)}
      ${itemFicha("Nível", p.nivel_rotulo)}
      ${itemFicha("Instituição", p.instituicao)}
      ${itemFicha("Cidade", p.cidade)}
      ${p.detalhes.map((d) => itemFicha(d.rotulo, d.valor, d.e_link)).join("")}
    </dl>
    ${htmlBilhetes(p)}
    <div class="detalhe__acoes">
      <button class="estrela-grande" type="button" data-estrela="${p.id}" data-titulo="${esc(p.titulo)}"
        aria-pressed="${p.estrelado}">
        ${icone("estrela")}
        <span class="estrela-grande__acao">${p.estrelado ? "Estrela dada" : "Dar estrela"}</span>
        <span class="estrela-grande__total">${textoEstrelas(p.estrelas)}</span>
      </button>
      ${
        link
          ? `<a class="botao botao--primario" href="${esc(link)}" target="_blank" rel="noopener noreferrer">
               Abrir link do projeto ${icone("externo")}
             </a>`
          : ""
      }
      <button class="botao botao--secundario" type="button" id="compartilhar" data-id="${p.id}"
        data-titulo="${esc(p.titulo)}">
        ${icone("compartilhar")}<span id="compartilhar-texto">Compartilhar</span>
      </button>
      ${
        p.citacao
          ? `<button class="botao botao--secundario" type="button" id="citar" aria-expanded="false" aria-controls="citacao">
               ${icone("citar")}<span>Citar</span>
             </button>`
          : ""
      }
      <button class="denunciar" type="button" id="denunciar" aria-expanded="false" aria-controls="denuncia">
        Denunciar projeto
      </button>
    </div>
    ${htmlCitacao(p)}
    <form class="denuncia" id="denuncia" data-id="${p.id}" novalidate hidden>
      <h3>Denunciar projeto</h3>
      <p>A equipe revisa toda denúncia. Projetos com várias denúncias saem do mural até a revisão.</p>
      <label for="denuncia-motivo">Motivo</label>
      <select id="denuncia-motivo" name="motivo" required>
        <option value="">Escolha um motivo</option>
        ${motivos}
      </select>
      <label for="denuncia-comentario">Conte mais (opcional)</label>
      <textarea id="denuncia-comentario" name="comentario" rows="3" maxlength="1000"></textarea>
      <div class="denuncia__acoes">
        <button class="botao botao--secundario" type="submit">Enviar denúncia</button>
        <button class="botao botao--texto" type="button" data-acao="cancelar-denuncia">Cancelar</button>
      </div>
      <p class="denuncia__resultado" id="denuncia-resultado" role="status"></p>
    </form>
    ${htmlParecidos(p.parecidos)}`;
}

async function abrirDetalhe(id: number, origem?: HTMLElement, mensagem?: string, trocando = false): Promise<void> {
  // Ao ir para um projeto parecido, o foco continua voltando ao cartão de onde o primeiro foi aberto.
  if (!trocando) focoAntesDoDetalhe = origem ?? (document.activeElement as HTMLElement | null);
  conteudoDetalhe.innerHTML = '<p class="carregando" id="detalhe-titulo">Carregando projeto…</p>';
  if (!dialogo.open) dialogo.showModal();

  try {
    const projeto = await api<Detalhe>(`/api/projetos/${id}`);
    const aviso = mensagem ? `<p class="detalhe__aviso" role="status">${esc(mensagem)}</p>` : "";
    conteudoDetalhe.innerHTML = aviso + htmlDetalhe(projeto);
    citacaoAtual = projeto.citacao;
    if (trocando) {
      // Outro projeto na mesma janela: volta ao topo e leva o foco ao título.
      conteudoDetalhe.closest(".detalhe__folha")?.scrollTo({ top: 0 });
      const titulo = document.getElementById("detalhe-titulo");
      if (titulo) {
        titulo.tabIndex = -1;
        titulo.focus();
      }
    }
  } catch (erro) {
    conteudoDetalhe.innerHTML = `
      <h2 id="detalhe-titulo">Projeto indisponível</h2>
      <p>${esc(mensagemDeErro(erro))}</p>`;
  }
}

async function enviarDenuncia(formDenuncia: HTMLFormElement): Promise<void> {
  const resultado = el("denuncia-resultado");
  const dados = new FormData(formDenuncia);
  const motivo = String(dados.get("motivo") ?? "");
  if (!motivo) {
    resultado.textContent = "Escolha o motivo da denúncia.";
    el("denuncia-motivo").focus();
    return;
  }

  const botao = formDenuncia.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (botao) botao.disabled = true;
  try {
    const resposta = await postJson<{ mensagem: string }>(`/api/projetos/${formDenuncia.dataset.id}/denuncias`, {
      motivo,
      comentario: dados.get("comentario"),
    });
    formDenuncia.innerHTML = `<p class="denuncia__resultado" role="status">${esc(resposta.mensagem)}</p>`;
    document.getElementById("denunciar")?.remove();
  } catch (erro) {
    resultado.textContent = mensagemDeErro(erro);
    if (botao) botao.disabled = false;
  }
}

/** No celular abre o menu de compartilhar do sistema; no computador copia o link. */
async function compartilhar(botao: HTMLButtonElement): Promise<void> {
  const url = `${location.origin}/mural?projeto=${botao.dataset.id}`;
  const titulo = botao.dataset.titulo ?? "Projeto no AstrAce";
  const texto = el("compartilhar-texto");

  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title: titulo, text: `${titulo} no mural do AstrAce`, url });
    } catch {
      // A pessoa fechou o menu de compartilhar: nada a fazer.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    texto.textContent = "Link copiado!";
  } catch {
    texto.textContent = "Não deu para copiar";
    avisar(`Copie o link: ${url}`);
  }
  window.setTimeout(() => {
    if (document.body.contains(texto)) texto.textContent = "Compartilhar";
  }, 2500);
}

// ---------- Aviso ----------

function avisar(texto: string): void {
  aviso.textContent = texto;
  aviso.hidden = false;
  window.clearTimeout(temporizadorAviso);
  temporizadorAviso = window.setTimeout(() => {
    aviso.hidden = true;
  }, 4500);
}

// ---------- Eventos ----------

function abrirAoClicar(evento: MouseEvent): void {
  const estrela = (evento.target as HTMLElement).closest<HTMLButtonElement>("[data-estrela]");
  if (estrela) {
    void alternarEstrela(estrela);
    return;
  }
  const link = (evento.target as HTMLElement).closest<HTMLAnchorElement>(".cartao__link");
  if (!link) return;
  if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  evento.preventDefault();
  void abrirDetalhe(Number(link.dataset.id), link);
}

function ligarEventos(): void {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    window.clearTimeout(temporizadorBusca);
    aoMudarFiltros();
  });
  form.addEventListener("change", (e) => {
    const alvo = e.target as HTMLInputElement;
    if (alvo.tagName === "SELECT" || alvo.type === "radio") aoMudarFiltros();
  });
  form.addEventListener("input", (e) => {
    if ((e.target as HTMLInputElement).name !== "q") return;
    window.clearTimeout(temporizadorBusca);
    temporizadorBusca = window.setTimeout(aoMudarFiltros, 300);
  });
  form.addEventListener("reset", () => {
    // "Limpar filtros" limpa os filtros, mas mantém a ordenação escolhida.
    const ordem = selectOrdem.value;
    window.setTimeout(() => {
      selectOrdem.value = ordem;
      aoMudarFiltros();
    }, 0);
  });

  grade.addEventListener("click", abrirAoClicar);
  destaquesLista.addEventListener("click", abrirAoClicar);

  botaoMais.addEventListener("click", () => void carregar(false));

  estado.addEventListener("click", (e) => {
    const acao = (e.target as HTMLElement).closest<HTMLElement>("[data-acao]")?.dataset.acao;
    if (acao === "limpar") form.reset();
    if (acao === "tentar") void carregar(true);
  });

  el("detalhe-fechar").addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("click", (e) => {
    if (e.target === dialogo) dialogo.close(); // clique fora da folha
  });
  dialogo.addEventListener("close", () => focoAntesDoDetalhe?.focus());

  conteudoDetalhe.addEventListener("click", (e) => {
    const alvo = e.target as HTMLElement;

    const bilhete = alvo.closest<HTMLButtonElement>("[data-bilhete]");
    if (bilhete) {
      void alternarBilhete(bilhete);
      return;
    }

    const parecido = alvo.closest<HTMLAnchorElement>("[data-parecido]");
    if (parecido) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // nova aba: segue o link
      e.preventDefault();
      void abrirDetalhe(Number(parecido.dataset.parecido), undefined, undefined, true);
      return;
    }

    const estrela = alvo.closest<HTMLButtonElement>("[data-estrela]");
    if (estrela) {
      void alternarEstrela(estrela);
      return;
    }
    const botaoCitar = alvo.closest<HTMLButtonElement>("#citar");
    if (botaoCitar) {
      const painel = el("citacao");
      const abrir = painel.hidden;
      painel.hidden = !abrir;
      botaoCitar.setAttribute("aria-expanded", String(abrir));
      if (abrir) painel.scrollIntoView({ block: "nearest" });
      return;
    }
    const copiar = alvo.closest<HTMLButtonElement>("[data-copiar]");
    if (copiar) {
      void copiarCitacao(copiar.dataset.copiar!);
      return;
    }

    const botaoCompartilhar = alvo.closest<HTMLButtonElement>("#compartilhar");
    if (botaoCompartilhar) {
      void compartilhar(botaoCompartilhar);
      return;
    }

    const miniatura = alvo.closest<HTMLButtonElement>(".galeria__miniatura");
    if (miniatura) {
      const imagem = el<HTMLImageElement>("galeria-imagem");
      imagem.src = miniatura.dataset.foto!;
      imagem.alt = imagem.alt.replace(/^Foto \d+/, `Foto ${miniatura.dataset.indice}`);
      conteudoDetalhe.querySelectorAll(".galeria__miniatura").forEach((b) => b.removeAttribute("aria-current"));
      miniatura.setAttribute("aria-current", "true");
      return;
    }

    const formDenuncia = document.getElementById("denuncia") as HTMLFormElement | null;
    if (!formDenuncia) return;
    if (alvo.closest("#denunciar")) {
      const abrir = formDenuncia.hidden;
      formDenuncia.hidden = !abrir;
      el("denunciar").setAttribute("aria-expanded", String(abrir));
      if (abrir) el("denuncia-motivo").focus();
    }
    if (alvo.closest('[data-acao="cancelar-denuncia"]')) {
      formDenuncia.hidden = true;
      el("denunciar").setAttribute("aria-expanded", "false");
      el("denunciar").focus();
    }
  });
  conteudoDetalhe.addEventListener("submit", (e) => {
    e.preventDefault();
    void enviarDenuncia(e.target as HTMLFormElement);
  });
}

async function iniciar(): Promise<void> {
  ligarEventos();

  try {
    opcoes = await api<OpcoesMural>("/api/mural/opcoes");
    preencherFiltros(opcoes);
  } catch {
    // Sem as opções, os filtros ficam só com "Todos"; a busca por texto continua funcionando.
  }

  const params = new URLSearchParams(location.search);
  aplicarFiltrosDaUrl();
  const filtros = lerFiltros();
  botaoLimpar.hidden = !temFiltro(filtros);
  sincronizarUrl(filtros); // tira ?projeto= e ?publicado= da barra de endereço

  void carregarDestaques();
  await carregar(true);

  const publicado = Number(params.get("publicado"));
  const projeto = Number(params.get("projeto"));
  if (publicado) {
    void abrirDetalhe(publicado, undefined, "Projeto publicado no mural.");
  } else if (projeto) {
    void abrirDetalhe(projeto);
  }
}

void iniciar();
