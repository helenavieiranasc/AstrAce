// Onde elas brilham: um pin por cidade com projetos; clicar mostra os projetos dela.

import { api, el, esc, htmlFoto, mensagemDeErro, type CidadeNoMapa, type Mapa } from "./comum.js";

const area = el("mapa-area");
const resumo = el("mapa-resumo");
const caixaCidades = el("mapa-cidades");
const lista = el<HTMLOListElement>("mapa-lista");
const semLocal = el("mapa-sem-local");
const secaoProjetos = el("mapa-projetos");
const tituloProjetos = el("mapa-projetos-titulo");
const listaProjetos = el<HTMLUListElement>("mapa-projetos-lista");

let cidades: CidadeNoMapa[] = [];

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function chave(c: CidadeNoMapa): string {
  return `${c.cidade}-${c.uf}`;
}

function rotacao(id: number): string {
  const x = Math.sin(id * 12.9898) * 43758.5453;
  return ((x - Math.floor(x)) * 3.2 - 1.6).toFixed(2);
}

const INCLINACOES = [-28, 28, -52, 52];

/**
 * Cidades muito perto (ex.: São Paulo e Campinas) teriam os pins um em cima do outro.
 * Os vizinhos ficam espetados tortos, para lados opostos: a ponta continua na cidade.
 */
function inclinacoes(lista: CidadeNoMapa[]): Map<string, number> {
  const resultado = new Map<string, number>();
  lista.forEach((c, i) => {
    const vizinhas = lista.slice(0, i).filter((o) => Math.hypot(o.x - c.x, o.y - c.y) < 4.5);
    if (vizinhas.length === 0) return;
    // A primeira do grupo também inclina, para o lado contrário.
    const primeira = chave(vizinhas[0]);
    if (!resultado.has(primeira)) resultado.set(primeira, INCLINACOES[0]);
    resultado.set(chave(c), INCLINACOES[Math.min(vizinhas.length, INCLINACOES.length - 1)]);
  });
  return resultado;
}

/** Pin maior para cidade com mais projetos (até um limite, para não cobrir o mapa). */
function htmlPin(c: CidadeNoMapa, inclinacao = 0): string {
  const tamanho = 30 + Math.min(c.total - 1, 8) * 3;
  const rotulo = `${c.cidade}, ${c.uf}: ${plural(c.total, "projeto", "projetos")}`;
  // Cidades no litoral leste: o nome aparece à esquerda do pin, para não sair do mapa.
  const lado = c.x > 82 ? " mapa-pin--nome-esq" : "";
  return `
    <button class="mapa-pin${lado}" type="button" data-cidade="${esc(chave(c))}" aria-pressed="false"
      aria-label="${esc(rotulo)}"
      style="left: ${c.x}%; top: ${c.y}%; --tamanho: ${tamanho}px; --inclinacao: ${inclinacao}deg">
      <span class="mapa-pin__cabeca" aria-hidden="true">${c.total}</span>
      <span class="mapa-pin__nome" aria-hidden="true">${esc(c.cidade)}</span>
    </button>`;
}

function htmlItemCidade(c: CidadeNoMapa): string {
  return `
    <li>
      <button class="mapa-cidade" type="button" data-cidade="${esc(chave(c))}" aria-pressed="false">
        <span class="mapa-cidade__nome">${esc(c.cidade)} <span class="mapa-cidade__uf">${esc(c.uf)}</span></span>
        <span class="mapa-cidade__total">${plural(c.total, "projeto", "projetos")}</span>
      </button>
    </li>`;
}

function htmlProjeto(c: CidadeNoMapa["projetos"][number]): string {
  return `
    <li>
      <a class="mini" href="/mural?projeto=${c.id}" style="--rot: ${rotacao(c.id)}deg">
        <span class="mini__foto">${htmlFoto(c)}</span>
        <span class="mini__tipo">${esc(c.tipo_rotulo)}</span>
        <span class="mini__titulo">${esc(c.titulo)}</span>
        <span class="mini__area">${esc(c.autora)} · ${esc(c.area_rotulo)}</span>
      </a>
    </li>`;
}

function escolher(id: string, rolar: boolean): void {
  const cidade = cidades.find((c) => chave(c) === id);
  if (!cidade) return;

  document.querySelectorAll<HTMLButtonElement>("[data-cidade]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.cidade === id));
  });

  tituloProjetos.textContent = `${cidade.cidade}, ${cidade.uf}: ${plural(cidade.total, "projeto", "projetos")}`;
  listaProjetos.innerHTML = cidade.projetos.map(htmlProjeto).join("");
  secaoProjetos.hidden = false;

  const url = new URL(location.href);
  url.searchParams.set("cidade", id);
  history.replaceState(null, "", url);

  if (rolar) {
    const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    secaoProjetos.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
    tituloProjetos.focus({ preventScroll: true });
  }
}

async function iniciar(): Promise<void> {
  let mapa: Mapa;
  try {
    mapa = await api<Mapa>("/api/mural/mapa");
  } catch (erro) {
    resumo.textContent = `Não deu para carregar o mapa: ${mensagemDeErro(erro)}`;
    return;
  }

  cidades = mapa.cidades;
  if (cidades.length === 0) {
    resumo.textContent = "Ainda não tem projeto com cidade no mapa. Publique o seu e seja a primeira!";
    return;
  }

  const noMapa = mapa.total - mapa.sem_local;
  resumo.textContent =
    `${plural(noMapa, "projeto", "projetos")} em ${plural(cidades.length, "cidade", "cidades")}. ` +
    "Clique num pin ou numa cidade para ver o que elas estão fazendo.";

  // Pins de cima para baixo: os mais ao sul ficam por cima quando se encostam.
  const ordenadas = [...cidades].sort((a, b) => a.y - b.y);
  const tortos = inclinacoes(ordenadas);
  area.insertAdjacentHTML("beforeend", ordenadas.map((c) => htmlPin(c, tortos.get(chave(c)))).join(""));
  lista.innerHTML = cidades.map(htmlItemCidade).join("");
  caixaCidades.hidden = false;

  if (mapa.sem_local) {
    semLocal.textContent = `E mais ${plural(mapa.sem_local, "projeto", "projetos")} de cidades que o mapa ainda não conhece.`;
    semLocal.hidden = false;
  }

  document.addEventListener("click", (e) => {
    const botao = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-cidade]");
    if (botao) escolher(botao.dataset.cidade!, true);
  });

  const pedida = new URLSearchParams(location.search).get("cidade");
  if (pedida) escolher(pedida, false);
}

void iniciar();
