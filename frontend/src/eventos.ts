// Canto de eventos (Pessoa 3): "Acontece esta semana", agenda com filtros e detalhe do evento.
import { api, el, esc, icone, mensagemDeErro, preencherSelect, urlSegura, type Opcao } from "./comum.js";

interface EventoCartao {
  id: number;
  titulo: string;
  tipo: string;
  tipo_rotulo: string;
  organizacao: string | null;
  inicio: string;
  fim: string | null;
  dia: number;
  mes: string;
  dia_semana: string;
  data_rotulo: string;
  quando: string | null;
  modalidade: "presencial" | "online" | "hibrido";
  modalidade_rotulo: string;
  local: string | null;
  cidade: string | null;
  uf: string | null;
  gratuito: boolean;
  publico_alvo: string;
  publico_rotulo: string;
  area: string | null;
  area_rotulo: string | null;
  imagem_url: string | null;
  tem_carimbo: boolean;
}

interface EventoDetalhe extends EventoCartao {
  descricao: string;
  link: string | null;
  link_mapa: string | null;
  link_agenda: string;
}

interface OpcoesEventos {
  modalidades: Opcao[];
  publicos: Opcao[];
  tipos: Opcao[];
  areas: Opcao[];
  cidades: string[];
}

interface PaginaEventos {
  itens: EventoCartao[];
  total: number;
  pagina: number;
  tem_mais: boolean;
}

const POR_PAGINA = 12;
const CAMPOS_FILTRO = ["q", "periodo", "gratuito", "cidade", "modalidade", "publico", "area", "tipo"] as const;
type Filtros = Record<(typeof CAMPOS_FILTRO)[number], string>;

const PINS = ["--pin-magenta", "--pin-violeta", "--pin-verde", "--pin-ambar", "--pin-azul"];
const CORES_CARTAZ = ["var(--postit-rosa)", "var(--postit-amarelo)", "var(--postit-verde)", "#c9dcf5", "#dccff5"];
const NOMES_MES: Record<string, string> = {
  jan: "janeiro",
  fev: "fevereiro",
  mar: "março",
  abr: "abril",
  mai: "maio",
  jun: "junho",
  jul: "julho",
  ago: "agosto",
  set: "setembro",
  out: "outubro",
  nov: "novembro",
  dez: "dezembro",
};

// Ícones de traço, 24x24, no mesmo estilo dos ícones do mural.
const ICONES_EVENTO: Record<string, string> = {
  oficina: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3.5 17.5a1.8 1.8 0 0 0 2.5 2.5l5.7-5.7a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.3-.4-.4-2.3z"/>',
  palestra: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  hackathon: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M2 20h20"/><path d="m10 8-2 2 2 2M14 8l2 2-2 2"/>',
  feira: '<path d="M3 9.5 5 4h14l2 5.5"/><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12.5V20h14v-7.5M10 20v-4.5h4V20"/>',
  congresso: '<rect x="3" y="3.5" width="18" height="12" rx="1"/><path d="M12 15.5V20M8 21l4-1 4 1"/><path d="m7 12 3-3 2.5 2L17 7"/>',
  curso: '<path d="M3 5.5c3-1.3 6-1.3 9 .5 3-1.8 6-1.8 9-.5v13c-3-1.3-6-1.3-9 .5-3-1.8-6-1.8-9-.5z"/><path d="M12 6v13"/>',
  visita: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/><path d="M8 9a3 3 0 0 1 3-2"/>',
  relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  local: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
  online: '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8.5 20h7M12 16.5V20"/><path d="M9 10.5a4 4 0 0 1 6 0M10.6 12.4a1.8 1.8 0 0 1 2.8 0"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M12 13v4M10 15h4"/>',
  mapa: '<path d="m3 6.5 5.5-2.5 7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z"/><path d="M8.5 4v13.5M15.5 6.5V20"/>',
  carimbo: '<path d="M9 3.5h6l-1 6h-4z"/><path d="M5 13.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2H5z"/><path d="M4 19h16"/>',
};

function iconeEvento(nome: string): string {
  const desenho = ICONES_EVENTO[nome];
  return desenho ? `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true">${desenho}</svg>` : icone(nome);
}

const form = el<HTMLFormElement>("filtros");
const agenda = el<HTMLUListElement>("agenda");
const estado = el("estado");
const contagem = el("contagem");
const botaoMais = el<HTMLButtonElement>("carregar-mais");
const semanaLista = el<HTMLUListElement>("semana-lista");
const dialogo = el<HTMLDialogElement>("detalhe");
const conteudoDetalhe = el("detalhe-conteudo");
const botaoAlternar = el<HTMLButtonElement>("filtros-alternar");
const botaoLimpar = el<HTMLButtonElement>("filtros-limpar");
const ESTRELA = "/static/img/estrela-eventos.png";

let pagina = 1;
let pedidoAtual = 0;
let ultimoMes = "";
let focoAntesDoDetalhe: HTMLElement | null = null;
let temporizadorBusca: number | undefined;

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

function sincronizarUrl(filtros: Filtros): void {
  const params = new URLSearchParams();
  for (const campo of CAMPOS_FILTRO) {
    if (filtros[campo]) params.set(campo, filtros[campo]);
  }
  const busca = params.toString();
  history.replaceState(null, "", busca ? `?${busca}` : location.pathname);
}

function aplicarFiltrosDaUrl(): void {
  const params = new URLSearchParams(location.search);
  let algumSelect = false;
  for (const campo of CAMPOS_FILTRO) {
    const valor = params.get(campo);
    const controle = form.elements.namedItem(campo) as HTMLInputElement | HTMLSelectElement | null;
    if (!valor || !controle) continue;
    if (controle instanceof HTMLInputElement && controle.type === "checkbox") {
      controle.checked = controle.value === valor;
    } else {
      controle.value = valor;
      if (controle instanceof HTMLSelectElement) algumSelect = true;
    }
  }
  if (algumSelect) alternarFiltros(true);
}

function preencherFiltros(o: OpcoesEventos): void {
  const select = (nome: string) => form.elements.namedItem(nome) as HTMLSelectElement;
  preencherSelect(select("cidade"), o.cidades);
  preencherSelect(select("modalidade"), o.modalidades);
  preencherSelect(
    select("publico"),
    o.publicos.filter((p) => p.valor !== "todas"),
  );
  preencherSelect(select("area"), o.areas);
  preencherSelect(select("tipo"), o.tipos);
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

// ---------- Peças ----------

/** Rotação estável por evento, entre -1.6 e 1.6 graus. */
function rotacao(id: number, escala = 1): string {
  const x = Math.sin(id * 78.233) * 43758.5453;
  return (((x - Math.floor(x)) * 3.2 - 1.6) * escala).toFixed(2);
}

function lugar(e: EventoCartao): string {
  if (e.modalidade === "online") return "Online";
  const cidade = [e.cidade, e.uf].filter(Boolean).join(" - ");
  return e.modalidade === "hibrido" ? `${cidade || "Presencial"} e online` : cidade || "Local a definir";
}

function htmlSelos(e: EventoCartao, completo = true): string {
  const selos: string[] = [];
  if (e.gratuito) selos.push('<li class="selo selo--gratuito">Gratuito</li>');
  if (e.modalidade !== "presencial") selos.push(`<li class="selo selo--${e.modalidade}">${esc(e.modalidade_rotulo)}</li>`);
  if (e.publico_alvo !== "todas") selos.push(`<li class="selo selo--publico">${esc(e.publico_rotulo)}</li>`);
  if (completo && e.area_rotulo) selos.push(`<li class="selo selo--area">${esc(e.area_rotulo)}</li>`);
  return selos.length ? `<ul class="selos" aria-label="Características">${selos.join("")}</ul>` : "";
}

function htmlCarimbo(e: EventoCartao): string {
  if (!e.tem_carimbo) return "";
  return `<span class="carimbo-selo" title="Neste evento você pode ganhar um carimbo no passaporte">
      <span>vale</span><strong>carimbo</strong>
    </span>`;
}

function htmlIngresso(e: EventoCartao): string {
  const pin = PINS[e.id % PINS.length];
  const quando = e.quando ? `<p class="ingresso__quando">${esc(e.quando)}</p>` : "";
  return `
    <li class="ingresso-item" style="--rot: ${rotacao(e.id)}deg">
      <span class="pin" style="--cor-pin: var(${pin})" aria-hidden="true"></span>
      <article class="ingresso">
        <div class="ingresso__canhoto" aria-hidden="true">
          <span class="ingresso__semana">${esc(e.dia_semana)}</span>
          <span class="ingresso__dia">${esc(e.dia)}</span>
          <span class="ingresso__mes">${esc(e.mes)}</span>
        </div>
        <div class="ingresso__corpo">
          ${quando}
          <p class="cartao__tipo">${iconeEvento(e.tipo)}${esc(e.tipo_rotulo)}</p>
          <h3 class="ingresso__titulo">
            <a class="ingresso__link" href="/eventos?evento=${e.id}" data-id="${e.id}">${esc(e.titulo)}</a>
          </h3>
          ${e.organizacao ? `<p class="ingresso__org">${esc(e.organizacao)}</p>` : ""}
          <p class="ingresso__info">${iconeEvento("relogio")}<span>${esc(e.data_rotulo)}</span></p>
          <p class="ingresso__info">${iconeEvento(e.modalidade === "online" ? "online" : "local")}<span>${esc(lugar(e))}</span></p>
          ${htmlSelos(e, false)}
          <span class="ingresso__mais" aria-hidden="true">Ver detalhes e inscrever-se</span>
        </div>
        ${htmlCarimbo(e)}
      </article>
    </li>`;
}

function htmlMes(e: EventoCartao): string {
  const nome = NOMES_MES[e.mes] ?? e.mes;
  return `<li class="agenda__mes" aria-hidden="true"><span>${esc(nome)}</span></li>`;
}

function htmlCartazSemana(e: EventoCartao, indice: number): string {
  return `
    <li>
      <article class="cartaz" style="--rot: ${rotacao(e.id, 1.6)}deg; --cor-cartaz: ${CORES_CARTAZ[indice % CORES_CARTAZ.length]}">
        <p class="cartaz__quando">${esc(e.quando ?? e.data_rotulo)}</p>
        <p class="cartaz__data"><span>${esc(e.dia)}</span> ${esc(e.mes)}</p>
        <h3 class="cartaz__titulo">
          <a class="ingresso__link" href="/eventos?evento=${e.id}" data-id="${e.id}">${esc(e.titulo)}</a>
        </h3>
        <p class="cartaz__info">${esc(e.data_rotulo.split(" · ")[1] ?? "")}${e.data_rotulo.includes(" · ") ? " · " : ""}${esc(lugar(e))}</p>
        ${htmlCarimbo(e)}
      </article>
    </li>`;
}

function htmlEsqueletos(quantidade: number): string {
  return Array.from({ length: quantidade }, () => '<li class="ingresso-item"><div class="esqueleto esqueleto--ingresso"></div></li>').join("");
}

function htmlVazio(comFiltro: boolean): string {
  const texto = comFiltro
    ? `<h3>Nenhum evento com esses filtros</h3>
       <p>Tente tirar um filtro, escolher outra cidade ou incluir os eventos online.</p>
       <button class="botao botao--secundario" type="button" data-acao="limpar">Limpar filtros</button>`
    : `<h3>A agenda está vazia por enquanto</h3>
       <p>Novos eventos entram aqui assim que a equipe cadastrar. Enquanto isso, publique um projeto no mural.</p>
       <a class="botao botao--primario" href="/mural/novo">Publicar projeto</a>`;
  return `
    <div class="postit postit--amarelo estado estado--eventos">
      <span class="pin" aria-hidden="true"></span>
      <img class="estado__estrela" src="${ESTRELA}" alt="" width="110" height="112">
      ${texto}
    </div>`;
}

function htmlErro(mensagem: string): string {
  return `
    <div class="postit postit--rosa estado" role="alert">
      <span class="pin" style="--cor-pin: var(--pin-violeta)" aria-hidden="true"></span>
      <h3>Não deu para carregar a agenda</h3>
      <p>${esc(mensagem)}</p>
      <button class="botao botao--secundario" type="button" data-acao="tentar">Tentar de novo</button>
    </div>`;
}

/** Ingressos com o nome do mês antes do primeiro evento de cada mês. */
function htmlAgenda(itens: EventoCartao[]): string {
  return itens
    .map((e) => {
      const chave = e.inicio.slice(0, 7);
      const cabecalho = chave !== ultimoMes ? htmlMes(e) : "";
      ultimoMes = chave;
      return cabecalho + htmlIngresso(e);
    })
    .join("");
}

// ---------- Carregamento ----------

async function carregar(reiniciar: boolean): Promise<void> {
  const pedido = ++pedidoAtual;
  const filtros = lerFiltros();

  if (reiniciar) {
    pagina = 1;
    agenda.innerHTML = htmlEsqueletos(4);
    agenda.setAttribute("aria-busy", "true");
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
    const dados = await api<PaginaEventos>(`/api/eventos?${params}`);
    if (pedido !== pedidoAtual) return;

    if (reiniciar) {
      ultimoMes = "";
      agenda.innerHTML = htmlAgenda(dados.itens);
    } else {
      const primeiroNovo = agenda.children.length;
      agenda.insertAdjacentHTML("beforeend", htmlAgenda(dados.itens));
      agenda.querySelectorAll<HTMLAnchorElement>(".ingresso__link")[primeiroNovo]?.focus();
    }

    const sufixo = temFiltro(filtros) ? (dados.total === 1 ? " encontrado" : " encontrados") : "";
    contagem.textContent = dados.total === 1 ? `1 evento${sufixo}` : `${dados.total} eventos${sufixo}`;
    botaoMais.hidden = !dados.tem_mais;
    if (dados.total === 0) {
      contagem.textContent = "";
      estado.innerHTML = htmlVazio(temFiltro(filtros));
    }
  } catch (erro) {
    if (pedido !== pedidoAtual) return;
    if (reiniciar) {
      agenda.innerHTML = "";
      contagem.textContent = "";
      estado.innerHTML = htmlErro(mensagemDeErro(erro));
    } else {
      pagina -= 1;
    }
  } finally {
    if (pedido === pedidoAtual) {
      agenda.removeAttribute("aria-busy");
      botaoMais.disabled = false;
      botaoMais.textContent = "Carregar mais eventos";
    }
  }
}

async function carregarSemana(): Promise<void> {
  try {
    const lista = await api<EventoCartao[]>("/api/eventos/semana");
    semanaLista.innerHTML = lista.length
      ? lista.map(htmlCartazSemana).join("")
      : `<li class="semana__vazia">
           <div class="postit postit--verde">
             <span class="pin" style="--cor-pin: var(--pin-azul)" aria-hidden="true"></span>
             <strong>Semana tranquila</strong>
             <span>Nenhum evento até domingo. Veja os próximos na agenda abaixo.</span>
           </div>
         </li>`;
  } catch {
    el("semana").hidden = true; // a faixa é opcional: sem ela, a agenda continua funcionando
  } finally {
    semanaLista.removeAttribute("aria-busy");
  }
}

// ---------- Detalhe ----------

function itemFicha(rotulo: string, valor: string | null | undefined): string {
  if (!valor) return "";
  return `<div><dt>${esc(rotulo)}</dt><dd>${esc(valor)}</dd></div>`;
}

function htmlDetalhe(e: EventoDetalhe): string {
  const link = urlSegura(e.link);
  const mapa = urlSegura(e.link_mapa);
  const agendaGoogle = urlSegura(e.link_agenda);
  const imagem = urlSegura(e.imagem_url);
  const onde = e.modalidade === "online" ? "Online (o link chega na inscrição)" : [e.local, lugar(e)].filter(Boolean).join(", ");

  const carimbo = e.tem_carimbo
    ? `<div class="aviso-carimbo">
         <span class="aviso-carimbo__selo" aria-hidden="true">${iconeEvento("carimbo")}</span>
         <p><strong>Neste evento você pode ganhar um carimbo no passaporte.</strong>
         Procure o QR code no local e escaneie com o celular. <a href="/passaporte">Ver meu passaporte</a></p>
       </div>`
    : "";

  return `
    <div class="detalhe-evento__topo">
      <div class="detalhe-evento__data" aria-hidden="true">
        <span class="ingresso__semana">${esc(e.dia_semana)}</span>
        <span class="ingresso__dia">${esc(e.dia)}</span>
        <span class="ingresso__mes">${esc(e.mes)}</span>
      </div>
      <div>
        <p class="cartao__tipo">${iconeEvento(e.tipo)}${esc(e.tipo_rotulo)}${e.quando ? ` · <span class="detalhe-evento__quando">${esc(e.quando)}</span>` : ""}</p>
        <h2 id="detalhe-titulo">${esc(e.titulo)}</h2>
        ${e.organizacao ? `<p class="detalhe__autora">por ${esc(e.organizacao)}</p>` : ""}
      </div>
    </div>
    ${imagem ? `<figure class="detalhe__foto"><img src="${esc(imagem)}" alt=""></figure>` : ""}
    ${carimbo}
    <p class="detalhe__resumo">${esc(e.descricao)}</p>
    ${htmlSelos(e)}
    <dl class="ficha-dados">
      ${itemFicha("Quando", e.data_rotulo)}
      ${itemFicha("Onde", onde)}
      ${itemFicha("Modalidade", e.modalidade_rotulo)}
      ${itemFicha("Para quem", e.publico_rotulo)}
      ${itemFicha("Área", e.area_rotulo ?? "Várias áreas")}
      ${itemFicha("Valor", e.gratuito ? "Gratuito" : "Pago (confira no site do evento)")}
    </dl>
    <div class="detalhe__acoes">
      ${
        link
          ? `<a class="botao botao--primario" href="${esc(link)}" target="_blank" rel="noopener noreferrer">
               Ver detalhes e inscrever-se ${icone("externo")}
             </a>`
          : ""
      }
      ${
        agendaGoogle
          ? `<a class="botao botao--secundario" href="${esc(agendaGoogle)}" target="_blank" rel="noopener noreferrer">
               ${iconeEvento("agenda")} Salvar na agenda
             </a>`
          : ""
      }
      ${
        mapa
          ? `<a class="botao botao--texto" href="${esc(mapa)}" target="_blank" rel="noopener noreferrer">
               ${iconeEvento("mapa")} Ver no mapa
             </a>`
          : ""
      }
    </div>
    <p class="detalhe-evento__nota">As inscrições são feitas no site de quem organiza. Confira lá datas e regras.</p>`;
}

async function abrirDetalhe(id: number, origem?: HTMLElement): Promise<void> {
  focoAntesDoDetalhe = origem ?? (document.activeElement as HTMLElement | null);
  conteudoDetalhe.innerHTML = '<p class="carregando" id="detalhe-titulo">Carregando evento…</p>';
  if (!dialogo.open) dialogo.showModal();

  try {
    const evento = await api<EventoDetalhe>(`/api/eventos/${id}`);
    conteudoDetalhe.innerHTML = htmlDetalhe(evento);
  } catch (erro) {
    conteudoDetalhe.innerHTML = `
      <h2 id="detalhe-titulo">Evento indisponível</h2>
      <p>${esc(mensagemDeErro(erro))}</p>`;
  }
}

// ---------- Eventos da página ----------

function abrirAoClicar(evento: MouseEvent): void {
  const link = (evento.target as HTMLElement).closest<HTMLAnchorElement>(".ingresso__link");
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
    if (alvo.tagName === "SELECT" || alvo.type === "checkbox") aoMudarFiltros();
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

  agenda.addEventListener("click", abrirAoClicar);
  semanaLista.addEventListener("click", abrirAoClicar);
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
}

async function iniciar(): Promise<void> {
  ligarEventos();
  void carregarSemana();

  try {
    preencherFiltros(await api<OpcoesEventos>("/api/eventos/opcoes"));
  } catch {
    // Sem as opções, os selects ficam só com "Todos"; busca e atalhos continuam funcionando.
  }

  const evento = Number(new URLSearchParams(location.search).get("evento"));
  aplicarFiltrosDaUrl();
  const filtros = lerFiltros();
  botaoLimpar.hidden = !temFiltro(filtros);
  sincronizarUrl(filtros); // tira ?evento= da barra de endereço

  await carregar(true);
  if (evento) void abrirDetalhe(evento);
}

void iniciar();
