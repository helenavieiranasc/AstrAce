import {
  api,
  el,
  esc,
  icone,
  mensagemDeErro,
  preencherSelect,
  urlSegura,
  type Opcao,
} from "./comum.js";

interface SeloVaga {
  valor: "mulheres" | "negras" | "trans";
  rotulo: string;
}

interface TipoVagaOpcao extends Opcao {
  icone: string;
}

interface OpcoesVagas {
  tipos: TipoVagaOpcao[];
  areas: Opcao[];
  modalidades: Opcao[];
  cidades: string[];
  ordenacoes: Opcao[];
}

interface CartaoVaga {
  id: number;
  titulo: string;
  organizacao: string;
  tipo: string;
  tipo_rotulo: string;
  icone: string;
  area: string;
  area_rotulo: string;
  modalidade: string;
  modalidade_rotulo: string;
  cidade: string | null;
  prazo: string | null;
  prazo_rotulo: string;
  prazo_aberto: boolean;
  dias_restantes: number | null;
  afirmativa_mulheres: boolean;
  afirmativa_negras: boolean;
  afirmativa_trans: boolean;
  selos: SeloVaga[];
  descricao_curta: string;
  data_coleta: string | null;
  data_coleta_rotulo: string;
  imagem_url: string | null; // logo da instituição, enviado pelo painel da equipe
}

interface DetalheVaga extends CartaoVaga {
  descricao: string;
  link_original: string;
  fonte_afirmacao: string | null;
}

interface PaginaVagas {
  itens: CartaoVaga[];
  total: number;
  pagina: number;
  tem_mais: boolean;
}

const POR_PAGINA = 12;
const CAMPOS_FILTRO = [
  "q",
  "tipo",
  "area",
  "modalidade",
  "cidade",
  "prazo_aberto",
  "afirmativa_mulheres",
  "afirmativa_negras",
  "afirmativa_trans",
  "ordem",
] as const;

type Filtros = Record<(typeof CAMPOS_FILTRO)[number], string>;

const PINS = ["--pin-magenta", "--pin-violeta", "--pin-verde", "--pin-ambar", "--pin-azul"];

const form = el<HTMLFormElement>("filtros");
const grade = el<HTMLUListElement>("grade");
const estado = el("estado");
const contagem = el("contagem");
const botaoMais = el<HTMLButtonElement>("carregar-mais");
const dialogo = el<HTMLDialogElement>("detalhe");
const conteudoDetalhe = el("detalhe-conteudo");
const aviso = el("aviso");
const botaoAlternar = el<HTMLButtonElement>("filtros-alternar");
const botaoLimpar = el<HTMLButtonElement>("filtros-limpar");

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
  return CAMPOS_FILTRO.some((campo) => {
    if (campo === "ordem") return filtros.ordem !== "" && filtros.ordem !== "prazo";
    return filtros[campo] !== "";
  });
}

function sincronizarUrl(filtros: Filtros): void {
  const params = new URLSearchParams();
  for (const campo of CAMPOS_FILTRO) {
    if (campo === "ordem" && filtros.ordem === "prazo") continue;
    if (filtros[campo]) params.set(campo, filtros[campo]);
  }
  const busca = params.toString();
  history.replaceState(null, "", busca ? `?${busca}` : location.pathname);
}

function aplicarFiltrosDaUrl(): void {
  const params = new URLSearchParams(location.search);
  let algumExtra = false;
  for (const campo of CAMPOS_FILTRO) {
    const valor = params.get(campo);
    const controle = form.elements.namedItem(campo) as HTMLInputElement | HTMLSelectElement | null;
    if (valor && controle) {
      if (controle instanceof HTMLInputElement && controle.type === "checkbox") {
        controle.checked = valor === "1" || valor === "true" || valor === "on";
      } else {
        controle.value = valor;
      }
      if (campo !== "q" && campo !== "ordem") algumExtra = true;
    }
  }
  if (algumExtra) alternarFiltros(true);
}

function preencherFiltros(o: OpcoesVagas): void {
  const select = (nome: string) => form.elements.namedItem(nome) as HTMLSelectElement;
  preencherSelect(select("tipo"), o.tipos);
  preencherSelect(select("area"), o.areas);
  preencherSelect(select("modalidade"), o.modalidades);
  preencherSelect(select("cidade"), o.cidades);
}

function alternarFiltros(abrir?: boolean): void {
  const aberto = abrir ?? botaoAlternar.getAttribute("aria-expanded") !== "true";
  botaoAlternar.setAttribute("aria-expanded", String(aberto));
  form.classList.toggle("filtros--aberto", aberto);
}

function aoMudarFiltros(): void {
  const filtros = lerFiltros();
  botaoLimpar.hidden = !temFiltro(filtros);
  sincronizarUrl(filtros);
  void carregar(true);
}

// ---------- Cartões ----------

function rotacao(id: number, escala = 1): string {
  const x = Math.sin(id * 12.9898) * 43758.5453;
  return (((x - Math.floor(x)) * 3.2 - 1.6) * escala).toFixed(2);
}

function htmlSelos(selos: SeloVaga[]): string {
  if (selos.length === 0) return "";
  const itens = selos
    .map((s) => `<li class="selo selo--${esc(s.valor)}">${esc(s.rotulo)}</li>`)
    .join("");
  return `<ul class="selos" aria-label="Recortes afirmativos declarados no edital">${itens}</ul>`;
}

function htmlPrazo(v: CartaoVaga): string {
  const classes = ["cartao__prazo"];
  if (!v.prazo_aberto) {
    classes.push("cartao__prazo--encerrado");
  } else if (v.dias_restantes !== null && v.dias_restantes <= 10) {
    classes.push("cartao__prazo--urgente");
  }
  return `<span class="${classes.join(" ")}">${esc(v.prazo_rotulo)}</span>`;
}

/** Nome da instituição, com o logo ao lado quando a equipe enviou um. */
function htmlOrganizacao(v: CartaoVaga, bloco: "cartao" | "detalhe"): string {
  const logo = urlSegura(v.imagem_url);
  if (!logo) return `<p class="${bloco}__organizacao">${esc(v.organizacao)}</p>`;
  return `
    <p class="${bloco}__organizacao ${bloco}__organizacao--logo">
      <img class="${bloco}__logo" src="${esc(logo)}" alt="" loading="lazy">${esc(v.organizacao)}
    </p>`;
}

function htmlCartao(v: CartaoVaga): string {
  const pin = PINS[v.id % PINS.length];
  const local = v.cidade ? `${v.cidade}` : "Nacional / Online";

  return `
    <li>
      <article class="cartao cartao--ficha cartao--vaga"
        style="--rot: ${rotacao(v.id)}deg; --cor-ficha: var(${pin})">
        <span class="pin" style="--cor-pin: var(${pin})" aria-hidden="true"></span>
        <div>
          <div class="cartao__cabecalho-vaga">
            <p class="cartao__tipo">${icone(v.icone)}${esc(v.tipo_rotulo)}</p>
            ${htmlPrazo(v)}
          </div>
          <h3 class="cartao__titulo">
            <a class="cartao__link" href="/vagas?vaga=${v.id}" data-id="${v.id}">${esc(v.titulo)}</a>
          </h3>
          ${htmlOrganizacao(v, "cartao")}
          <p class="cartao__area">${esc(v.area_rotulo)}</p>
          ${htmlSelos(v.selos)}
          <p class="cartao__resumo">${esc(v.descricao_curta)}</p>
        </div>
        <div class="cartao__meta-vaga">
          <span class="cartao__badge-modalidade">${esc(v.modalidade_rotulo)}</span>
          <span>${esc(local)}</span>
        </div>
      </article>
    </li>`;
}

function htmlEsqueletos(quantidade: number): string {
  return Array.from({ length: quantidade }, () => '<li><div class="esqueleto"></div></li>').join("");
}

function htmlVazio(comFiltro: boolean): string {
  if (comFiltro) {
    return `
      <div class="postit postit--amarelo estado">
        <span class="pin" aria-hidden="true"></span>
        <h3>Nenhuma vaga com esses filtros</h3>
        <p>Experimente desmarcar algum recorte ou buscar outro termo.</p>
        <button class="botao botao--secundario" type="button" data-acao="limpar">Limpar filtros</button>
      </div>`;
  }
  return `
    <div class="postit postit--amarelo estado">
      <span class="pin" aria-hidden="true"></span>
      <h3>Ainda não há vagas cadastradas</h3>
      <p>Em breve novas oportunidades de IC, bolsas e tecnologia estarão disponíveis aqui.</p>
    </div>`;
}

function htmlErro(mensagem: string): string {
  return `
    <div class="postit postit--rosa estado" role="alert">
      <span class="pin" style="--cor-pin: var(--pin-violeta)" aria-hidden="true"></span>
      <h3>Não deu para carregar as vagas</h3>
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

  const params = new URLSearchParams({ pagina: String(pagina), por_pagina: String(POR_PAGINA) });
  for (const campo of CAMPOS_FILTRO) {
    if (filtros[campo]) params.set(campo, filtros[campo]);
  }

  try {
    const dados = await api<PaginaVagas>(`/api/vagas?${params}`);
    if (pedido !== pedidoAtual) return;

    const cartoes = dados.itens.map((v) => htmlCartao(v));
    if (reiniciar) {
      grade.innerHTML = cartoes.join("");
    } else {
      const primeiroNovo = grade.children.length;
      grade.insertAdjacentHTML("beforeend", cartoes.join(""));
      grade.children[primeiroNovo]?.querySelector<HTMLAnchorElement>(".cartao__link")?.focus();
    }

    const sufixo = temFiltro(filtros) ? " encontradas" : "";
    contagem.textContent =
      dados.total === 1 ? `1 vaga${sufixo ? " encontrada" : ""}` : `${dados.total} vagas${sufixo}`;
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
      botaoMais.textContent = "Carregar mais vagas";
    }
  }
}

// ---------- Detalhe ----------

function itemFicha(rotulo: string, valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  return `<div><dt>${esc(rotulo)}</dt><dd>${esc(valor)}</dd></div>`;
}

function htmlDetalhe(v: DetalheVaga): string {
  const link = urlSegura(v.link_original);
  const blocoAfirmativo = v.fonte_afirmacao
    ? `
      <div class="detalhe__fonte-afirmacao">
        <strong>Trecho/comprovação do recorte afirmativo no edital:</strong>
        <p>${esc(v.fonte_afirmacao)}</p>
      </div>`
    : "";

  return `
    <p class="cartao__tipo">${icone(v.icone)}${esc(v.tipo_rotulo)}</p>
    <h2 id="detalhe-titulo">${esc(v.titulo)}</h2>
    ${htmlOrganizacao(v, "detalhe")}
    ${htmlSelos(v.selos)}
    <p class="detalhe__resumo">${esc(v.descricao)}</p>
    ${blocoAfirmativo}
    <dl class="ficha-dados">
      ${itemFicha("Área", v.area_rotulo)}
      ${itemFicha("Modalidade", v.modalidade_rotulo)}
      ${itemFicha("Cidade", v.cidade ?? "Nacional / Online")}
      ${itemFicha("Prazo", v.prazo_rotulo)}
      ${itemFicha("Informação conferida em", v.data_coleta_rotulo)}
    </dl>
    <p class="detalhe__coleta">Informação conferida em <strong>${esc(v.data_coleta_rotulo)}</strong>.</p>
    <div class="detalhe__acoes">
      ${
        link
          ? `<a class="botao botao--primario botao--grande" href="${esc(link)}" target="_blank" rel="noopener noreferrer">
               Ver edital/vaga original ${icone("externo")}
             </a>`
          : ""
      }
    </div>
    <p class="detalhe__aviso-fixo">
      Confira sempre o edital oficial. Prazos e regras podem mudar.
    </p>`;
}

async function abrirDetalhe(id: number, origem?: HTMLElement): Promise<void> {
  focoAntesDoDetalhe = origem ?? (document.activeElement as HTMLElement | null);
  conteudoDetalhe.innerHTML = '<p class="carregando" id="detalhe-titulo">Carregando vaga…</p>';
  if (!dialogo.open) dialogo.showModal();

  try {
    const vaga = await api<DetalheVaga>(`/api/vagas/${id}`);
    conteudoDetalhe.innerHTML = htmlDetalhe(vaga);
  } catch (erro) {
    conteudoDetalhe.innerHTML = `
      <h2 id="detalhe-titulo">Vaga indisponível</h2>
      <p>${esc(mensagemDeErro(erro))}</p>`;
  }
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
    const alvo = e.target as HTMLElement;
    if (alvo.tagName === "SELECT" || (alvo instanceof HTMLInputElement && alvo.type === "checkbox")) {
      aoMudarFiltros();
    }
  });
  form.addEventListener("input", (e) => {
    if ((e.target as HTMLInputElement).name !== "q") return;
    window.clearTimeout(temporizadorBusca);
    temporizadorBusca = window.setTimeout(aoMudarFiltros, 300);
  });
  form.addEventListener("reset", () => {
    window.setTimeout(aoMudarFiltros, 0);
  });
  botaoAlternar.addEventListener("click", () => alternarFiltros());

  grade.addEventListener("click", abrirAoClicar);
  botaoMais.addEventListener("click", () => void carregar(false));

  estado.addEventListener("click", (e) => {
    const acao = (e.target as HTMLElement).closest<HTMLElement>("[data-acao]")?.dataset.acao;
    if (acao === "limpar") form.reset();
    if (acao === "tentar") void carregar(true);
  });

  el("detalhe-fechar").addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("click", (e) => {
    if (e.target === dialogo) dialogo.close();
  });
  dialogo.addEventListener("close", () => focoAntesDoDetalhe?.focus());
}

async function iniciar(): Promise<void> {
  ligarEventos();

  try {
    const opcoes = await api<OpcoesVagas>("/api/vagas/opcoes");
    preencherFiltros(opcoes);
  } catch {
    // Sem as opções, os selects ficam com o valor padrão e a busca continua funcionando.
  }

  const params = new URLSearchParams(location.search);
  aplicarFiltrosDaUrl();
  const filtros = lerFiltros();
  botaoLimpar.hidden = !temFiltro(filtros);
  sincronizarUrl(filtros);

  await carregar(true);

  const vagaId = Number(params.get("vaga"));
  if (vagaId) {
    void abrirDetalhe(vagaId);
  }
}

void iniciar();
