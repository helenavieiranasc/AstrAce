// Painel da equipe (Pessoa 5): visão geral, eventos, vagas, notícias, denúncias e destaques da semana.
import {
  ErroApi,
  EXTENSOES_IMAGEM,
  api,
  el,
  enviarArquivo,
  esc,
  icone,
  mensagemDeErro,
  postJson,
  preencherSelect,
  urlSegura,
  type ArquivoEnviado,
  type Cartao,
  type Opcao,
  type PaginaProjetos,
} from "./comum.js";

// ---------- Tipos da API ----------

type Aba = "geral" | "eventos" | "vagas" | "noticias" | "moderacao" | "destaques";
type ListaComFiltro = "eventos" | "vagas" | "noticias";

interface OpcaoComIcone extends Opcao {
  icone: string;
}

interface OpcoesPainel {
  eventos: { tipos: Opcao[]; modalidades: Opcao[]; publicos: Opcao[] };
  vagas: { tipos: OpcaoComIcone[]; modalidades: Opcao[] };
  noticias: { categorias: OpcaoComIcone[] };
  areas: Opcao[];
  estados: Opcao[];
  limite_destaques: number;
}

interface Pendencia {
  aba: Aba;
  texto: string;
  link?: string;
  filtro?: string;
}

interface Resumo {
  numeros: Array<{ rotulo: string; valor: number }>;
  pendencias: Pendencia[];
}

interface Lista<T> {
  itens: T[];
  contagens: Record<string, number>;
}

interface EventoAdmin {
  id: number;
  titulo: string;
  tipo: string;
  tipo_rotulo: string;
  organizacao: string | null;
  descricao: string;
  inicio: string;
  fim: string | null;
  dia: number;
  mes: string;
  data_rotulo: string;
  modalidade: string;
  modalidade_rotulo: string;
  local: string | null;
  cidade: string | null;
  uf: string | null;
  gratuito: boolean;
  publico_alvo: string;
  area: string | null;
  imagem_url: string | null;
  link_bruto: string;
  oculto: boolean;
  passado: boolean;
  vale_carimbo: boolean;
  link_checkin: string | null;
}

interface Selo {
  valor: string;
  rotulo: string;
}

interface VagaAdmin {
  id: number;
  titulo: string;
  organizacao: string;
  descricao: string;
  tipo: string;
  tipo_rotulo: string;
  icone: string;
  area: string;
  modalidade: string;
  cidade: string | null;
  prazo: string | null;
  prazo_rotulo: string;
  prazo_aberto: boolean;
  selos: Selo[];
  link_original: string;
  data_coleta: string | null;
  oculta: boolean;
  dias_desde_coleta: number | null;
  reconferir: boolean;
  marcadas: Record<string, boolean>;
  fonte_afirmacao: string;
  imagem_url: string | null;
}

interface NoticiaAdmin {
  id: number;
  titulo: string;
  cientista: string;
  instituicao: string | null;
  resumo: string;
  area: string;
  categoria: string;
  categoria_rotulo: string;
  icone: string;
  fonte_nome: string;
  link_fonte: string;
  imagem_url: string | null;
  data_publicacao: string | null;
  data_publicacao_rotulo: string;
  cientista_brasileira: boolean;
  cientista_negra: boolean;
  destaque: boolean;
  oculta: boolean;
}

interface CasoDenuncia extends Cartao {
  oculto: boolean;
  resumo: string;
  link_externo: string | null;
  arquivos: ArquivoEnviado[];
  total_denuncias: number;
  motivos: Array<{ rotulo: string; total: number }>;
  comentarios: Array<{ motivo: string; texto: string; quando: string }>;
}

interface Vitrine {
  semana: string;
  limite: number;
  itens: Cartao[];
}

// ---------- Elementos ----------

const ABAS: Aba[] = ["geral", "eventos", "vagas", "noticias", "moderacao", "destaques"];
const avisoEl = el("aviso");

const listaEventos = el<HTMLUListElement>("lista-eventos");
const listaVagas = el<HTMLUListElement>("lista-vagas");
const listaNoticias = el<HTMLUListElement>("lista-noticias");
const listaDenuncias = el<HTMLUListElement>("lista-denuncias");
const listaDestaques = el<HTMLUListElement>("lista-destaques");
const listaCandidatos = el<HTMLUListElement>("lista-candidatos");

const dialogoEvento = el<HTMLDialogElement>("dialogo-evento");
const formEvento = el<HTMLFormElement>("form-evento");
const errosEvento = el("erros-evento");
const dialogoVaga = el<HTMLDialogElement>("dialogo-vaga");
const formVaga = el<HTMLFormElement>("form-vaga");
const errosVaga = el("erros-vaga");
const dialogoNoticia = el<HTMLDialogElement>("dialogo-noticia");
const formNoticia = el<HTMLFormElement>("form-noticia");
const errosNoticia = el("erros-noticia");
const dialogoQr = el<HTMLDialogElement>("dialogo-qr");
const dialogoFoto = el<HTMLDialogElement>("dialogo-foto");

let opcoes: OpcoesPainel;
const filtros: Record<ListaComFiltro, string> = { eventos: "proximos", vagas: "no_site", noticias: "no_site" };
let eventos = new Map<number, EventoAdmin>();
let vagas = new Map<number, VagaAdmin>();
let noticias = new Map<number, NoticiaAdmin>();
let eventoEditando: number | null = null;
let vagaEditando: number | null = null;
let noticiaEditando: number | null = null;
let eventoNoQr: EventoAdmin | null = null;
let vitrineCheia = false;

// ---------- Utilidades ----------

let temporizadorAviso = 0;

function avisar(texto: string): void {
  avisoEl.textContent = texto;
  avisoEl.hidden = false;
  window.clearTimeout(temporizadorAviso);
  temporizadorAviso = window.setTimeout(() => (avisoEl.hidden = true), 4000);
}

function putJson<T>(url: string, dados: unknown): Promise<T> {
  return api<T>(url, { method: "PUT", body: JSON.stringify(dados) });
}

function rotacao(id: number, escala = 1): string {
  const x = Math.sin(id * 91.17) * 43758.5453;
  return (((x - Math.floor(x)) * 2 - 1) * escala).toFixed(2);
}

function etiqueta(tipo: string, texto: string): string {
  return `<li class="etiqueta-admin etiqueta-admin--${tipo}">${esc(texto)}</li>`;
}

function htmlEstado(titulo: string, texto: string, cor = "amarelo"): string {
  return `<li class="registros__vazio postit postit--${cor}"><strong>${esc(titulo)}</strong><span>${esc(texto)}</span></li>`;
}

function htmlErroLista(erro: unknown): string {
  return htmlEstado("Não deu para carregar", mensagemDeErro(erro), "rosa");
}

function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`;
}

/** Depois de recarregar a lista, devolve o foco para a linha que a pessoa estava mexendo. */
function focarRegistro(lista: HTMLElement, id: number | null): void {
  if (id === null) return;
  lista.querySelector<HTMLElement>(`[data-id="${id}"] button`)?.focus();
}

function debounce(acao: () => void, espera = 250): () => void {
  let temporizador = 0;
  return () => {
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(acao, espera);
  };
}

// ---------- Erros nos formulários ----------

/** Onde o erro de um campo aparece. Campos escondidos (imagem_url) apontam para o que a pessoa vê. */
function alvoDoErro(form: HTMLFormElement, nome: string): HTMLElement | null {
  return form.querySelector<HTMLElement>(`[data-erro-para="${nome}"]`) ?? form.querySelector<HTMLElement>(`[name="${nome}"]`);
}

function desmarcarCampo(campo: HTMLElement): void {
  campo.removeAttribute("aria-invalid");
  const original = campo.dataset.descricao ?? "";
  if (original) campo.setAttribute("aria-describedby", original);
  else campo.removeAttribute("aria-describedby");
}

/** Tira o erro de um campo só (ex.: a foto, quando a pessoa escolhe outra). */
function limparErroDe(form: HTMLFormElement, nome: string): void {
  const p = form.querySelector(`[data-erro-de="${nome}"]`);
  if (!p) return;
  p.closest(".campo--erro")?.classList.remove("campo--erro");
  p.remove();
  const alvo = alvoDoErro(form, nome);
  if (alvo) desmarcarCampo(alvo);
}

function limparErros(form: HTMLFormElement, resumo: HTMLElement): void {
  resumo.hidden = true;
  resumo.innerHTML = "";
  form.querySelectorAll("[data-erro-de]").forEach((p) => p.remove());
  form.querySelectorAll(".campo--erro").forEach((c) => c.classList.remove("campo--erro"));
  form.querySelectorAll<HTMLElement>("[aria-invalid]").forEach(desmarcarCampo);
}

function marcarErro(form: HTMLFormElement, nome: string, mensagem: string): HTMLElement | null {
  const alvo = alvoDoErro(form, nome);
  if (!alvo) return null;
  const caixa = alvo.closest(".campo") ?? alvo.parentElement;
  if (!caixa) return null;
  caixa.classList.add("campo--erro");

  const p = document.createElement("p");
  p.className = "campo__erro";
  p.id = `${form.id}-${nome}-erro`;
  p.dataset.erroDe = nome;
  p.textContent = mensagem;
  caixa.append(p);

  if (alvo.dataset.descricao === undefined) alvo.dataset.descricao = alvo.getAttribute("aria-describedby") ?? "";
  alvo.setAttribute("aria-describedby", [alvo.dataset.descricao, p.id].filter(Boolean).join(" "));
  alvo.setAttribute("aria-invalid", "true");
  return alvo;
}

function mostrarErros(form: HTMLFormElement, resumo: HTMLElement, erros: Record<string, string>): void {
  limparErros(form, resumo);
  // O JSON chega em ordem alfabética; o resumo segue a ordem dos campos na tela.
  const marcados = Object.entries(erros)
    .map(([nome, mensagem]) => ({ alvo: marcarErro(form, nome, mensagem), mensagem }))
    .sort((a, b) => {
      if (!a.alvo || !b.alvo) return a.alvo ? -1 : b.alvo ? 1 : 0;
      return a.alvo.compareDocumentPosition(b.alvo) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  const itens = marcados.map(({ alvo, mensagem }) =>
    alvo?.id ? `<li><a href="#${alvo.id}">${esc(mensagem)}</a></li>` : `<li>${esc(mensagem)}</li>`,
  );
  const n = itens.length;
  resumo.innerHTML = `<p>Confira ${n === 1 ? "o campo marcado" : `os ${n} campos marcados`}:</p><ul>${itens.join("")}</ul>`;
  resumo.hidden = false;
  resumo.focus();
}

function mostrarErroGeral(form: HTMLFormElement, resumo: HTMLElement, erro: unknown): void {
  limparErros(form, resumo);
  resumo.innerHTML = `<p>${esc(mensagemDeErro(erro))}</p>`;
  resumo.hidden = false;
  resumo.focus();
}

// Os links do resumo levam o foco direto para o campo (dentro do <dialog>).
for (const resumo of [errosEvento, errosVaga, errosNoticia]) {
  resumo.addEventListener("click", (evento) => {
    const link = (evento.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='#']");
    if (!link) return;
    evento.preventDefault();
    document.getElementById(link.hash.slice(1))?.focus();
  });
}

function campo<T extends HTMLElement = HTMLInputElement>(form: HTMLFormElement, nome: string): T {
  return form.elements.namedItem(nome) as unknown as T;
}

function texto(dados: FormData, nome: string): string {
  return String(dados.get(nome) ?? "").trim();
}

// ---------- Diálogos ----------

const formsSujos = new WeakSet<HTMLFormElement>();

for (const dialogo of [dialogoEvento, dialogoVaga, dialogoNoticia, dialogoQr, dialogoFoto]) {
  dialogo.querySelectorAll("[data-fechar]").forEach((botao) => botao.addEventListener("click", () => fecharDialogo(dialogo)));
  // Esc: em formulário com mudanças, pergunta antes de jogar fora.
  dialogo.addEventListener("cancel", (evento) => {
    evento.preventDefault();
    fecharDialogo(dialogo);
  });
}
dialogoQr.addEventListener("click", (evento) => {
  if (evento.target === dialogoQr) dialogoQr.close();
});
for (const form of [formEvento, formVaga, formNoticia]) {
  form.addEventListener("input", () => formsSujos.add(form));
}

function fecharDialogo(dialogo: HTMLDialogElement): void {
  const form = dialogo.querySelector("form");
  if (form && formsSujos.has(form) && !window.confirm("Fechar sem salvar? O que você mudou vai se perder.")) return;
  if (form) formsSujos.delete(form);
  dialogo.close();
}

// ---------- Fotos: escolher ou arrastar, recortar, enviar, trocar e remover ----------

interface Recorte {
  proporcao: number; // largura ÷ altura do espaço onde a imagem aparece no site
  largura: number; // largura máxima do arquivo enviado, em pixels
  logo: boolean; // logo pode encolher dentro do quadro; a sobra fica transparente
}

// Eventos e notícias mostram a foto larga, cortada em 16:9; a vaga mostra o logo quadrado.
const RECORTE_FOTO: Recorte = { proporcao: 16 / 9, largura: 1600, logo: false };
const RECORTE_LOGO: Recorte = { proporcao: 1, largura: 800, logo: true };
// A imagem é reduzida no navegador antes do envio, então dá para escolher a foto grande do celular.
const MAIOR_ORIGINAL_MB = 40;

/** Como urlSegura, mas aceita também as ilustrações das notícias de exemplo (/static/...). */
function urlImagem(url: string | null | undefined): string | null {
  if (url?.startsWith("/static/")) return url;
  return urlSegura(url);
}

const recortador = el("foto-recortador");
const imagemRecorte = el<HTMLImageElement>("foto-recorte-imagem");
const zoomRecorte = el<HTMLInputElement>("foto-zoom");

const recorteAtual = {
  recorte: RECORTE_FOTO,
  zoom: 1, // 1 = a imagem cobre o quadro inteiro
  x: 0, // ponto da imagem (em pixels dela) que fica no centro do quadro
  y: 0,
  responder: null as ((imagem: Blob | null) => void) | null,
};

function escalaRecorte(): { escala: number; largura: number; altura: number } {
  const { width: largura, height: altura } = recortador.getBoundingClientRect();
  const cobrir = Math.max(largura / imagemRecorte.naturalWidth, altura / imagemRecorte.naturalHeight);
  return { escala: cobrir * recorteAtual.zoom, largura, altura };
}

function desenharRecorte(): void {
  const { escala, largura, altura } = escalaRecorte();
  // O centro só anda até a borda da imagem encostar na borda do quadro.
  const limitar = (centro: number, lado: number, tamanho: number) => {
    const a = lado / (2 * escala);
    const b = tamanho - a;
    return Math.min(Math.max(centro, Math.min(a, b)), Math.max(a, b));
  };
  recorteAtual.x = limitar(recorteAtual.x, largura, imagemRecorte.naturalWidth);
  recorteAtual.y = limitar(recorteAtual.y, altura, imagemRecorte.naturalHeight);
  const esquerda = largura / 2 - recorteAtual.x * escala;
  const topo = altura / 2 - recorteAtual.y * escala;
  imagemRecorte.style.transform = `translate(${esquerda}px, ${topo}px) scale(${escala})`;
}

function moverRecorte(dx: number, dy: number): void {
  const { escala } = escalaRecorte();
  recorteAtual.x -= dx / escala;
  recorteAtual.y -= dy / escala;
  desenharRecorte();
}

function aproximarRecorte(zoom: number): void {
  recorteAtual.zoom = Math.min(Math.max(zoom, Number(zoomRecorte.min)), Number(zoomRecorte.max));
  zoomRecorte.value = String(recorteAtual.zoom);
  desenharRecorte();
}

/** Abre o recorte por cima do formulário. Devolve a imagem recortada, ou null se a pessoa desistir. */
async function recortarImagem(endereco: string, recorte: Recorte): Promise<Blob | null> {
  recorteAtual.recorte = recorte;
  recortador.style.setProperty("--proporcao", String(recorte.proporcao));
  recortador.classList.toggle("recortador--logo", recorte.logo);
  el("foto-titulo").textContent = recorte.logo ? "Ajustar o logo" : "Ajustar a foto";
  el("foto-dica").textContent = recorte.logo
    ? "O logo começa inteiro no quadro. Se ele for comprido, aproxime até o símbolo preencher o espaço; a sobra fica transparente."
    : "Arraste a imagem para escolher a parte que aparece no site. O quadro tem o formato do cartão.";
  imagemRecorte.src = endereco;
  await imagemRecorte.decode(); // falha se o navegador não souber abrir o arquivo

  const { naturalWidth: largura, naturalHeight: altura } = imagemRecorte;
  if (!largura || !altura) throw new Error("Imagem sem tamanho");
  imagemRecorte.style.width = `${largura}px`;
  imagemRecorte.style.height = `${altura}px`;
  // O logo começa inteiro dentro do quadro; a foto começa cobrindo o quadro.
  const menor = recorte.logo
    ? Math.min(largura, recorte.proporcao * altura) / Math.max(largura, recorte.proporcao * altura)
    : 1;
  zoomRecorte.min = String(menor);
  recorteAtual.x = largura / 2;
  recorteAtual.y = altura / 2;

  dialogoFoto.showModal();
  aproximarRecorte(menor);
  recortador.focus();
  return new Promise((responder) => (recorteAtual.responder = responder));
}

function exportarRecorte(): Promise<Blob | null> {
  const { recorte, x, y } = recorteAtual;
  const { escala, largura } = escalaRecorte();
  const visivel = largura / escala; // largura do recorte em pixels da imagem original
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(Math.min(recorte.largura, visivel))); // nunca aumenta a imagem
  tela.height = Math.max(1, Math.round(tela.width / recorte.proporcao));
  const k = tela.width / visivel;
  const contexto = tela.getContext("2d")!;
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(
    imagemRecorte,
    tela.width / 2 - x * k,
    tela.height / 2 - y * k,
    imagemRecorte.naturalWidth * k,
    imagemRecorte.naturalHeight * k,
  );
  // WebP é leve e guarda transparência; o navegador que não gera WebP entrega PNG.
  return new Promise((responder) => tela.toBlob(responder, "image/webp", 0.86));
}

let arraste: { id: number; x: number; y: number } | null = null;

recortador.addEventListener("pointerdown", (evento) => {
  arraste = { id: evento.pointerId, x: evento.clientX, y: evento.clientY };
  recortador.setPointerCapture(evento.pointerId);
  recortador.classList.add("recortador--arrastando");
});
recortador.addEventListener("pointermove", (evento) => {
  if (!arraste || evento.pointerId !== arraste.id) return;
  moverRecorte(evento.clientX - arraste.x, evento.clientY - arraste.y);
  arraste.x = evento.clientX;
  arraste.y = evento.clientY;
});
for (const tipo of ["pointerup", "pointercancel"] as const) {
  recortador.addEventListener(tipo, (evento) => {
    if (arraste?.id !== evento.pointerId) return;
    arraste = null;
    recortador.classList.remove("recortador--arrastando");
  });
}
recortador.addEventListener(
  "wheel",
  (evento) => {
    evento.preventDefault();
    aproximarRecorte(recorteAtual.zoom * (evento.deltaY < 0 ? 1.08 : 1 / 1.08));
  },
  { passive: false },
);
recortador.addEventListener("keydown", (evento) => {
  const passo = evento.shiftKey ? 40 : 10;
  const setas: Record<string, [number, number]> = {
    ArrowLeft: [-passo, 0],
    ArrowRight: [passo, 0],
    ArrowUp: [0, -passo],
    ArrowDown: [0, passo],
  };
  if (evento.key in setas) moverRecorte(...setas[evento.key]);
  else if (evento.key === "+" || evento.key === "=") aproximarRecorte(recorteAtual.zoom + 0.1);
  else if (evento.key === "-" || evento.key === "_") aproximarRecorte(recorteAtual.zoom - 0.1);
  else return;
  evento.preventDefault();
});
zoomRecorte.addEventListener("input", () => aproximarRecorte(Number(zoomRecorte.value)));
window.addEventListener("resize", () => {
  if (dialogoFoto.open) desenharRecorte();
});

el("foto-usar").addEventListener("click", async () => {
  const imagem = await exportarRecorte();
  const responder = recorteAtual.responder;
  recorteAtual.responder = null;
  dialogoFoto.close();
  responder?.(imagem);
});
dialogoFoto.addEventListener("close", () => {
  recorteAtual.responder?.(null); // fechou no X, no Cancelar ou no Esc
  recorteAtual.responder = null;
  imagemRecorte.removeAttribute("src");
});

interface CampoFoto {
  /** Mostra a imagem que o registro já tem (ou nenhuma) ao abrir o formulário. */
  iniciar(url: string | null): void;
  /** Espera um envio em andamento terminar; o formulário só salva depois. */
  pronto(): Promise<void>;
}

function ligarCampoFoto(form: HTMLFormElement, prefixo: string, recorte: Recorte): CampoFoto {
  const oculto = campo(form, "imagem_url");
  const quadro = el(`${prefixo}-foto-quadro`);
  const previa = el<HTMLImageElement>(`${prefixo}-foto-previa`);
  const entrada = el<HTMLInputElement>(`${prefixo}-foto-arquivo`);
  const ajustar = el<HTMLButtonElement>(`${prefixo}-foto-ajustar`);
  const remover = el<HTMLButtonElement>(`${prefixo}-foto-remover`);
  const enviando = el(`${prefixo}-foto-enviando`);
  let original: string | null = null; // a imagem escolhida, inteira, para dar para recortar de novo
  let envio: Promise<void> = Promise.resolve();

  function mostrar(url: string | null): void {
    const segura = urlImagem(url);
    oculto.value = segura ?? "";
    previa.hidden = !segura;
    if (segura) previa.src = segura;
    else previa.removeAttribute("src");
    el(`${prefixo}-foto-vazio`).hidden = Boolean(segura);
    el(`${prefixo}-foto-escolher`).textContent = segura ? "Trocar imagem" : "Escolher imagem";
    // Imagem de outro site não pode ser recortada (o navegador bloqueia a leitura).
    ajustar.hidden = !segura || !(original || segura.startsWith("/"));
    remover.hidden = !segura;
  }

  function avisarMudanca(): void {
    // Atualiza a prévia e marca o formulário como alterado.
    form.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function recortarEEnviar(endereco: string): Promise<void> {
    limparErroDe(form, "imagem_url");
    let imagem: Blob | null;
    try {
      imagem = await recortarImagem(endereco, recorte);
    } catch {
      marcarErro(form, "imagem_url", "Não deu para abrir essa imagem. Tente outro arquivo (jpg, png ou webp).");
      return;
    }
    if (!imagem) return;
    enviando.hidden = false;
    entrada.disabled = ajustar.disabled = remover.disabled = true;
    try {
      const extensao = imagem.type === "image/webp" ? "webp" : imagem.type === "image/jpeg" ? "jpg" : "png";
      const enviado = await enviarArquivo(new File([imagem], `imagem.${extensao}`, { type: imagem.type }), "capa");
      mostrar(enviado.url);
      avisarMudanca();
    } catch (erro) {
      marcarErro(form, "imagem_url", mensagemDeErro(erro));
    } finally {
      enviando.hidden = true;
      entrada.disabled = ajustar.disabled = remover.disabled = false;
    }
  }

  function escolher(arquivo: File): void {
    limparErroDe(form, "imagem_url");
    const nome = arquivo.name.toLowerCase();
    if (!arquivo.type.startsWith("image/") && !EXTENSOES_IMAGEM.some((ext) => nome.endsWith(ext))) {
      marcarErro(form, "imagem_url", "Escolha uma imagem (jpg, png ou webp).");
      return;
    }
    if (arquivo.size > MAIOR_ORIGINAL_MB * 1024 * 1024) {
      marcarErro(form, "imagem_url", `A imagem passa de ${MAIOR_ORIGINAL_MB} MB. Escolha uma menor.`);
      return;
    }
    if (original) URL.revokeObjectURL(original);
    original = URL.createObjectURL(arquivo);
    envio = recortarEEnviar(original);
  }

  entrada.addEventListener("change", () => {
    const arquivo = entrada.files?.[0];
    entrada.value = "";
    if (arquivo) escolher(arquivo);
  });
  quadro.addEventListener("click", () => {
    if (!entrada.disabled) entrada.click();
  });
  quadro.addEventListener("dragover", (evento) => {
    evento.preventDefault();
    quadro.classList.add("foto-campo__quadro--soltar");
  });
  quadro.addEventListener("dragleave", () => quadro.classList.remove("foto-campo__quadro--soltar"));
  quadro.addEventListener("drop", (evento) => {
    evento.preventDefault();
    quadro.classList.remove("foto-campo__quadro--soltar");
    const arquivo = evento.dataTransfer?.files[0];
    if (arquivo && !entrada.disabled) escolher(arquivo);
  });
  ajustar.addEventListener("click", () => {
    const atual = original ?? oculto.value;
    if (atual) envio = recortarEEnviar(atual);
  });
  remover.addEventListener("click", () => {
    mostrar(null);
    avisarMudanca();
    entrada.focus();
  });

  return {
    iniciar(url) {
      if (original) URL.revokeObjectURL(original);
      original = null;
      limparErroDe(form, "imagem_url");
      mostrar(url);
    },
    pronto: () => envio,
  };
}

/** Atalho "Trocar foto" das listas: com o formulário aberto, vai ao campo da imagem e abre o seletor de arquivo. */
function irParaFoto(prefixo: string): void {
  const entrada = el<HTMLInputElement>(`${prefixo}-foto-arquivo`);
  el(`${prefixo}-foto-quadro`).scrollIntoView({ block: "center" });
  entrada.focus();
  entrada.click();
}

function botaoFoto(tem: boolean, descricao: string, logo = false): string {
  const nome = logo ? "logo" : "foto";
  return `<button class="botao-mini" type="button" data-acao="foto" aria-describedby="${descricao}">${tem ? "Trocar" : "Pôr"} ${nome}</button>`;
}

const fotoEvento = ligarCampoFoto(formEvento, "ev", RECORTE_FOTO);
const fotoVaga = ligarCampoFoto(formVaga, "vg", RECORTE_LOGO);
const fotoNoticia = ligarCampoFoto(formNoticia, "nt", RECORTE_FOTO);

// ---------- Abas ----------

function abaValida(valor: string): valor is Aba {
  return (ABAS as string[]).includes(valor);
}

function abrirAba(aba: Aba, focar = false): void {
  for (const nome of ABAS) {
    const ativa = nome === aba;
    const botao = el<HTMLButtonElement>(`aba-${nome}`);
    botao.setAttribute("aria-selected", String(ativa));
    botao.tabIndex = ativa ? 0 : -1;
    el(`painel-${nome}`).hidden = !ativa;
  }
  if (focar) el(`aba-${aba}`).focus();
  // No celular as abas rolam de lado: traz a aba aberta para a vista.
  el(`aba-${aba}`).scrollIntoView({ block: "nearest", inline: "nearest" });
  history.replaceState(null, "", `#${aba}`);
  void carregarAba(aba);
}

function carregarAba(aba: Aba): Promise<void> {
  switch (aba) {
    case "geral":
      return carregarResumo();
    case "eventos":
      return carregarEventos();
    case "vagas":
      return carregarVagas();
    case "noticias":
      return carregarNoticias();
    case "moderacao":
      return carregarDenuncias();
    case "destaques":
      return carregarDestaques();
  }
}

function ligarAbas(): void {
  const lista = document.querySelector<HTMLElement>(".fichario__abas")!;
  lista.addEventListener("click", (evento) => {
    const botao = (evento.target as HTMLElement).closest<HTMLButtonElement>("[data-aba]");
    if (botao && abaValida(botao.dataset.aba ?? "")) abrirAba(botao.dataset.aba as Aba);
  });
  // Setas, Home e End andam entre as abas (padrão de abas do WAI-ARIA).
  lista.addEventListener("keydown", (evento) => {
    const atual = ABAS.findIndex((a) => el(`aba-${a}`).getAttribute("aria-selected") === "true");
    const destinos: Record<string, number> = {
      ArrowRight: (atual + 1) % ABAS.length,
      ArrowLeft: (atual - 1 + ABAS.length) % ABAS.length,
      Home: 0,
      End: ABAS.length - 1,
    };
    if (!(evento.key in destinos)) return;
    evento.preventDefault();
    abrirAba(ABAS[destinos[evento.key]], true);
  });
}

function marcarSegmento(lista: ListaComFiltro, estado: string): void {
  filtros[lista] = estado;
  document.querySelectorAll<HTMLButtonElement>(`.segmentos[data-lista="${lista}"] button`).forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.estado === estado));
  });
}

function mostrarContagens(lista: ListaComFiltro, contagens: Record<string, number>): void {
  document.querySelectorAll<HTMLElement>(`.segmentos[data-lista="${lista}"] [data-contagem]`).forEach((span) => {
    const n = contagens[span.dataset.contagem ?? ""];
    span.textContent = n === undefined ? "" : `(${n})`;
  });
}

// ---------- Visão geral ----------

async function carregarResumo(): Promise<void> {
  const numeros = el<HTMLUListElement>("numeros");
  const pendencias = el<HTMLUListElement>("pendencias");
  try {
    const resumo = await api<Resumo>("/api/admin/resumo");
    numeros.innerHTML = resumo.numeros
      .map(
        (n, i) => `
        <li class="numero" style="--rot: ${rotacao(i + 3, 1.6)}deg">
          <strong>${esc(n.valor)}</strong><span>${esc(n.rotulo)}</span>
        </li>`,
      )
      .join("");
    pendencias.innerHTML = resumo.pendencias.length
      ? resumo.pendencias.map(htmlPendencia).join("")
      : '<li class="pendencias__tudo-certo">Nada pendente. Bom trabalho, equipe!</li>';
  } catch (erro) {
    numeros.innerHTML = htmlErroLista(erro);
  } finally {
    numeros.removeAttribute("aria-busy");
  }
}

function htmlPendencia(p: Pendencia): string {
  if (p.link) {
    return `<li><a class="pendencia" href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.texto)}</a></li>`;
  }
  return `<li><button class="pendencia" type="button" data-ir="${esc(p.aba)}" data-filtro="${esc(p.filtro ?? "")}">${esc(p.texto)}</button></li>`;
}

el("pendencias").addEventListener("click", (evento) => {
  const botao = (evento.target as HTMLElement).closest<HTMLButtonElement>("[data-ir]");
  const aba = botao?.dataset.ir ?? "";
  if (!botao || !abaValida(aba)) return;
  if (aba === "vagas") marcarSegmento("vagas", botao.dataset.filtro || "no_site");
  abrirAba(aba, true);
});

// ---------- Eventos: lista ----------

function lugarEvento(e: Pick<EventoAdmin, "modalidade" | "cidade" | "uf">): string {
  if (e.modalidade === "online") return "Online";
  const cidade = [e.cidade, e.uf].filter(Boolean).join(" - ");
  return e.modalidade === "hibrido" ? `${cidade || "Presencial"} e online` : cidade || "Local a definir";
}

function htmlRegistroEvento(e: EventoAdmin): string {
  const etiquetas: string[] = [];
  if (e.oculto) etiquetas.push(etiqueta("oculto", "Oculto"));
  else if (e.passado) etiquetas.push(etiqueta("passado", "Já aconteceu"));
  if (e.vale_carimbo) etiquetas.push(etiqueta("carimbo", "Vale carimbo"));
  if (e.gratuito) etiquetas.push(etiqueta("neutra", "Gratuito"));
  const descricao = `reg-evento-${e.id}`;
  const foto = urlImagem(e.imagem_url);

  return `
    <li class="registro${e.oculto ? " registro--apagado" : ""}" data-id="${e.id}">
      <div class="registro__lado" aria-hidden="true">
        <div class="registro__data"><span>${esc(e.dia)}</span>${esc(e.mes)}</div>
        ${foto ? `<img class="registro__foto" src="${esc(foto)}" alt="" loading="lazy">` : ""}
      </div>
      <div class="registro__corpo">
        <h3 class="registro__titulo" id="${descricao}">${esc(e.titulo)}</h3>
        <p class="registro__meta">${esc([e.tipo_rotulo, e.data_rotulo, lugarEvento(e)].join(" · "))}</p>
        ${etiquetas.length ? `<ul class="etiquetas-admin">${etiquetas.join("")}</ul>` : ""}
      </div>
      <div class="registro__acoes">
        <button class="botao-mini" type="button" data-acao="editar" aria-describedby="${descricao}">Editar</button>
        ${botaoFoto(Boolean(foto), descricao)}
        ${e.vale_carimbo ? `<button class="botao-mini botao-mini--magenta" type="button" data-acao="qr" aria-describedby="${descricao}">QR e cartaz</button>` : ""}
        <button class="botao-mini" type="button" data-acao="duplicar" aria-describedby="${descricao}">Duplicar</button>
        <button class="botao-mini" type="button" data-acao="${e.oculto ? "mostrar" : "ocultar"}" aria-describedby="${descricao}">
          ${e.oculto ? "Mostrar na agenda" : "Ocultar"}
        </button>
      </div>
    </li>`;
}

async function carregarEventos(focarId: number | null = null): Promise<void> {
  listaEventos.setAttribute("aria-busy", "true");
  const parametros = new URLSearchParams({ estado: filtros.eventos, q: el<HTMLInputElement>("busca-eventos").value.trim() });
  try {
    const dados = await api<Lista<EventoAdmin>>(`/api/admin/eventos?${parametros}`);
    eventos = new Map(dados.itens.map((e) => [e.id, e]));
    mostrarContagens("eventos", dados.contagens);
    listaEventos.innerHTML = dados.itens.length
      ? dados.itens.map(htmlRegistroEvento).join("")
      : htmlEstado("Nenhum evento aqui", filtros.eventos === "proximos" ? "Cadastre o primeiro em “Novo evento”." : "Troque o filtro ou a busca.");
    focarRegistro(listaEventos, focarId);
  } catch (erro) {
    listaEventos.innerHTML = htmlErroLista(erro);
  } finally {
    listaEventos.removeAttribute("aria-busy");
  }
}

listaEventos.addEventListener("click", async (evento) => {
  const botao = (evento.target as HTMLElement).closest<HTMLButtonElement>("[data-acao]");
  const id = Number(botao?.closest<HTMLElement>("[data-id]")?.dataset.id);
  const item = eventos.get(id);
  if (!botao || !item) return;

  switch (botao.dataset.acao) {
    case "editar":
      return abrirFormEvento(item);
    case "foto":
      abrirFormEvento(item);
      return irParaFoto("ev");
    case "duplicar":
      return abrirFormEvento(item, true);
    case "qr":
      return abrirQr(item);
    case "ocultar":
    case "mostrar": {
      const ocultar = botao.dataset.acao === "ocultar";
      botao.disabled = true;
      try {
        await postJson(`/api/admin/eventos/${id}/ocultar`, { oculto: ocultar });
        avisar(ocultar ? `“${item.titulo}” saiu da agenda.` : `“${item.titulo}” voltou para a agenda.`);
        await carregarEventos();
      } catch (erro) {
        avisar(mensagemDeErro(erro));
        botao.disabled = false;
      }
    }
  }
});

// ---------- Eventos: formulário ----------

function abrirFormEvento(evento?: EventoAdmin, duplicar = false): void {
  formEvento.reset();
  limparErros(formEvento, errosEvento);
  eventoEditando = evento && !duplicar ? evento.id : null;
  el("titulo-form-evento").textContent = eventoEditando ? "Editar evento" : duplicar ? "Duplicar evento" : "Novo evento";

  if (evento) {
    campo(formEvento, "titulo").value = evento.titulo;
    campo<HTMLSelectElement>(formEvento, "tipo").value = evento.tipo;
    campo(formEvento, "organizacao").value = evento.organizacao ?? "";
    campo<HTMLTextAreaElement>(formEvento, "descricao").value = evento.descricao;
    // Na cópia, as datas ficam em branco: quase sempre é outro dia.
    campo(formEvento, "inicio").value = duplicar ? "" : evento.inicio;
    campo(formEvento, "fim").value = duplicar ? "" : evento.fim ?? "";
    campo<RadioNodeList & HTMLElement>(formEvento, "modalidade").value = evento.modalidade;
    campo(formEvento, "local").value = evento.local ?? "";
    campo<HTMLSelectElement>(formEvento, "uf").value = evento.uf ?? "";
    campo(formEvento, "cidade").value = evento.cidade ?? "";
    campo(formEvento, "link").value = evento.link_bruto;
    campo<HTMLSelectElement>(formEvento, "publico_alvo").value = evento.publico_alvo;
    campo<HTMLSelectElement>(formEvento, "area").value = evento.area ?? "";
    campo(formEvento, "gratuito").checked = evento.gratuito;
    campo(formEvento, "vale_carimbo").checked = evento.vale_carimbo;
  } else {
    campo<RadioNodeList & HTMLElement>(formEvento, "modalidade").value = "presencial";
    campo<HTMLSelectElement>(formEvento, "publico_alvo").value = "todas";
  }
  fotoEvento.iniciar(evento?.imagem_url ?? null);

  atualizarModalidade();
  void carregarCidades(campo<HTMLSelectElement>(formEvento, "uf").value);
  atualizarPreviaEvento();
  formsSujos.delete(formEvento);
  dialogoEvento.showModal();
  campo(formEvento, "titulo").focus();
}

function dadosEvento(): Record<string, unknown> {
  const dados = new FormData(formEvento);
  return {
    titulo: texto(dados, "titulo"),
    tipo: texto(dados, "tipo"),
    organizacao: texto(dados, "organizacao"),
    descricao: texto(dados, "descricao"),
    inicio: texto(dados, "inicio"),
    fim: texto(dados, "fim"),
    modalidade: texto(dados, "modalidade"),
    local: texto(dados, "local"),
    uf: texto(dados, "uf"),
    cidade: texto(dados, "cidade"),
    link: texto(dados, "link"),
    publico_alvo: texto(dados, "publico_alvo"),
    area: texto(dados, "area"),
    imagem_url: texto(dados, "imagem_url"),
    gratuito: dados.has("gratuito"),
    vale_carimbo: dados.has("vale_carimbo"),
  };
}

function atualizarModalidade(): void {
  const online = campo<RadioNodeList & HTMLElement>(formEvento, "modalidade").value === "online";
  el("ev-endereco").hidden = online;
}

formEvento.addEventListener("change", (evento) => {
  const alvo = evento.target as HTMLInputElement;
  if (alvo.name === "modalidade") atualizarModalidade();
  if (alvo.name === "uf") void carregarCidades(alvo.value);
});
formEvento.addEventListener("input", atualizarPreviaEvento);
formEvento.addEventListener("change", atualizarPreviaEvento);

formEvento.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = formEvento.querySelector<HTMLButtonElement>("button[type=submit]")!;
  botao.disabled = true;
  try {
    await fotoEvento.pronto();
    const dados = dadosEvento();
    const salvo = eventoEditando
      ? await putJson<EventoAdmin>(`/api/admin/eventos/${eventoEditando}`, dados)
      : await postJson<EventoAdmin>("/api/admin/eventos", dados);
    const novo = eventoEditando === null;
    formsSujos.delete(formEvento);
    dialogoEvento.close();
    avisar(novo ? `“${salvo.titulo}” entrou na agenda.` : "Evento atualizado.");
    // Evento novo da semana fica em "Próximos"; mostra a lista onde ele está.
    if (novo) marcarSegmento("eventos", salvo.passado ? "passados" : "proximos");
    await carregarEventos(salvo.id);
    if (novo && salvo.vale_carimbo) abrirQr(salvo);
  } catch (erro) {
    if (erro instanceof ErroApi && Object.keys(erro.erros).length) mostrarErros(formEvento, errosEvento, erro.erros);
    else mostrarErroGeral(formEvento, errosEvento, erro);
  } finally {
    botao.disabled = false;
  }
});

// Cidades do IBGE como sugestão (o campo continua aceitando texto livre).

const municipiosPorUf = new Map<string, string[]>();

async function carregarCidades(uf: string): Promise<void> {
  const lista = el<HTMLDataListElement>("ev-cidades");
  if (!uf) {
    lista.innerHTML = "";
    return;
  }
  try {
    let nomes = municipiosPorUf.get(uf);
    if (!nomes) {
      const resposta = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!resposta.ok) throw new Error(`IBGE respondeu ${resposta.status}`);
      nomes = ((await resposta.json()) as Array<{ nome: string }>).map((m) => m.nome);
      municipiosPorUf.set(uf, nomes);
    }
    lista.innerHTML = nomes.map((n) => `<option value="${esc(n)}"></option>`).join("");
  } catch {
    lista.innerHTML = ""; // sem sugestões, mas dá para escrever a cidade
  }
}

// ---------- Eventos: prévia do ingresso na agenda ----------

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// Mesmos desenhos do canto de eventos (eventos.ts).
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
};

function iconeEvento(nome: string): string {
  const desenho = ICONES_EVENTO[nome];
  return desenho ? `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true">${desenho}</svg>` : icone(nome);
}

function hora(d: Date): string {
  return d.getMinutes() === 0 ? `${d.getHours()}h` : `${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Igual a rotulo_data em eventos/servico.py: "sáb, 31 out · 14h às 17h" ou "31 out a 2 nov". */
function rotuloData(inicio: Date, fim: Date | null): string {
  const dia = `${DIAS[inicio.getDay()]}, ${inicio.getDate()} ${MESES[inicio.getMonth()]}`;
  if (!fim || fim.toDateString() === inicio.toDateString()) {
    return `${dia} · ${hora(inicio)}${fim && fim.getTime() !== inicio.getTime() ? ` às ${hora(fim)}` : ""}`;
  }
  if (fim.getMonth() === inicio.getMonth()) return `${inicio.getDate()} a ${fim.getDate()} ${MESES[fim.getMonth()]}`;
  return `${inicio.getDate()} ${MESES[inicio.getMonth()]} a ${fim.getDate()} ${MESES[fim.getMonth()]}`;
}

function dataValida(valor: unknown): Date | null {
  if (!valor) return null;
  const data = new Date(String(valor)); // "2026-11-02T14:00" é lido no horário local
  return Number.isNaN(data.getTime()) ? null : data;
}

function atualizarPreviaEvento(): void {
  const d = dadosEvento() as Record<string, string> & { gratuito: boolean; vale_carimbo: boolean };
  const inicio = dataValida(d.inicio);
  const fim = dataValida(d.fim);
  const rotulo = (lista: Opcao[], valor: string) => lista.find((o) => o.valor === valor)?.rotulo ?? "";

  const selos: string[] = [];
  if (d.gratuito) selos.push('<li class="selo selo--gratuito">Gratuito</li>');
  if (d.modalidade && d.modalidade !== "presencial") {
    selos.push(`<li class="selo selo--${esc(d.modalidade)}">${esc(rotulo(opcoes.eventos.modalidades, d.modalidade))}</li>`);
  }
  if (d.publico_alvo && d.publico_alvo !== "todas") {
    selos.push(`<li class="selo selo--publico">${esc(rotulo(opcoes.eventos.publicos, d.publico_alvo))}</li>`);
  }

  el("previa-evento").innerHTML = `
    <li class="ingresso-item" style="--rot: -0.6deg">
      <span class="pin" style="--cor-pin: var(--pin-magenta)" aria-hidden="true"></span>
      <article class="ingresso">
        <div class="ingresso__canhoto" aria-hidden="true">
          <span class="ingresso__semana">${inicio ? DIAS[inicio.getDay()] : "dia"}</span>
          <span class="ingresso__dia">${inicio ? inicio.getDate() : "?"}</span>
          <span class="ingresso__mes">${inicio ? MESES[inicio.getMonth()] : "mês"}</span>
        </div>
        <div class="ingresso__corpo">
          <p class="cartao__tipo">${iconeEvento(d.tipo || "oficina")}${esc(rotulo(opcoes.eventos.tipos, d.tipo) || "Tipo de evento")}</p>
          <h3 class="ingresso__titulo">${esc(d.titulo || "Nome do evento")}</h3>
          ${d.organizacao ? `<p class="ingresso__org">${esc(d.organizacao)}</p>` : ""}
          <p class="ingresso__info">${iconeEvento("relogio")}<span>${inicio ? esc(rotuloData(inicio, fim)) : "Data e hora"}</span></p>
          <p class="ingresso__info">${iconeEvento(d.modalidade === "online" ? "online" : "local")}<span>${esc(lugarEvento({ modalidade: d.modalidade, cidade: d.cidade, uf: d.uf }))}</span></p>
          ${selos.length ? `<ul class="selos">${selos.join("")}</ul>` : ""}
        </div>
        ${d.vale_carimbo ? '<span class="carimbo-selo"><span>vale</span><strong>carimbo</strong></span>' : ""}
      </article>
    </li>
    ${htmlPreviaFoto(d.imagem_url, "A foto abre a página do evento:")}`;
}

/** A agenda não mostra foto no ingresso; a prévia mostra como ela fica no alto da página do evento. */
function htmlPreviaFoto(url: string, rotulo: string): string {
  const foto = urlImagem(url);
  if (!foto) return "";
  return `
    <li class="previa__extra">
      <p class="previa__nota">${esc(rotulo)}</p>
      <figure class="detalhe__foto"><img src="${esc(foto)}" alt=""></figure>
    </li>`;
}

// ---------- QR do evento ----------

function abrirQr(e: EventoAdmin): void {
  eventoNoQr = e;
  el("qr-evento").textContent = `${e.titulo} · ${e.data_rotulo}`;
  el<HTMLImageElement>("qr-imagem").src = `/admin/eventos/${e.id}/qr.svg?v=${Date.now()}`;
  el("qr-link").textContent = e.link_checkin ?? "";
  el<HTMLAnchorElement>("qr-cartaz").href = `/admin/eventos/${e.id}/cartaz`;
  el<HTMLAnchorElement>("qr-png").href = `/admin/eventos/${e.id}/qr.png?baixar=1`;
  el<HTMLAnchorElement>("qr-svg").href = `/admin/eventos/${e.id}/qr.svg?baixar=1`;
  if (!dialogoQr.open) dialogoQr.showModal();
}

el("qr-copiar").addEventListener("click", async () => {
  if (!eventoNoQr?.link_checkin) return;
  try {
    await navigator.clipboard.writeText(eventoNoQr.link_checkin);
    avisar("Link de check-in copiado.");
  } catch {
    avisar("Não deu para copiar. Selecione o link e copie à mão.");
  }
});

el("qr-novo").addEventListener("click", async () => {
  if (!eventoNoQr) return;
  if (!window.confirm("Gerar um QR novo? O QR atual e os cartazes já impressos vão parar de funcionar.")) return;
  try {
    const atualizado = await postJson<EventoAdmin>(`/api/admin/eventos/${eventoNoQr.id}/qr/novo`, {});
    abrirQr(atualizado);
    avisar("QR novo gerado. Imprima o cartaz de novo.");
    await carregarEventos();
  } catch (erro) {
    avisar(mensagemDeErro(erro));
  }
});

// ---------- Vagas: lista ----------

function htmlRegistroVaga(v: VagaAdmin): string {
  const etiquetas: string[] = [];
  if (v.oculta) etiquetas.push(etiqueta("oculto", "Oculta"));
  if (!v.prazo_aberto) etiquetas.push(etiqueta("passado", "Prazo encerrado"));
  for (const selo of v.selos) etiquetas.push(etiqueta(`selo-${selo.valor}`, selo.rotulo));
  const marcouSemFonte = Object.values(v.marcadas).some(Boolean) && !v.fonte_afirmacao;
  if (marcouSemFonte) etiquetas.push(etiqueta("alerta", "Afirmativa sem fonte: selo escondido"));
  if (v.reconferir) etiquetas.push(etiqueta("alerta", `Conferida há ${v.dias_desde_coleta} dias`));
  const descricao = `reg-vaga-${v.id}`;
  const logo = urlImagem(v.imagem_url);

  return `
    <li class="registro${v.oculta ? " registro--apagado" : ""}" data-id="${v.id}">
      ${logo ? `<img class="registro__logo" src="${esc(logo)}" alt="" loading="lazy">` : `<div class="registro__icone" aria-hidden="true">${icone(v.icone)}</div>`}
      <div class="registro__corpo">
        <h3 class="registro__titulo" id="${descricao}">${esc(v.titulo)}</h3>
        <p class="registro__meta">${esc([v.organizacao, v.tipo_rotulo, v.cidade || "Nacional / online", v.prazo_rotulo].join(" · "))}</p>
        ${etiquetas.length ? `<ul class="etiquetas-admin">${etiquetas.join("")}</ul>` : ""}
      </div>
      <div class="registro__acoes">
        <button class="botao-mini" type="button" data-acao="editar" aria-describedby="${descricao}">Editar</button>
        ${botaoFoto(Boolean(logo), descricao, true)}
        ${v.reconferir ? `<button class="botao-mini botao-mini--magenta" type="button" data-acao="conferir" aria-describedby="${descricao}">Conferi hoje</button>` : ""}
        <a class="botao-mini" href="${esc(urlSegura(v.link_original) ?? "#")}" target="_blank" rel="noopener" aria-describedby="${descricao}">Abrir edital</a>
        <button class="botao-mini" type="button" data-acao="${v.oculta ? "mostrar" : "ocultar"}" aria-describedby="${descricao}">
          ${v.oculta ? "Mostrar no site" : "Ocultar"}
        </button>
      </div>
    </li>`;
}

async function carregarVagas(focarId: number | null = null): Promise<void> {
  listaVagas.setAttribute("aria-busy", "true");
  const parametros = new URLSearchParams({ estado: filtros.vagas, q: el<HTMLInputElement>("busca-vagas").value.trim() });
  try {
    const dados = await api<Lista<VagaAdmin>>(`/api/admin/vagas?${parametros}`);
    vagas = new Map(dados.itens.map((v) => [v.id, v]));
    mostrarContagens("vagas", dados.contagens);
    listaVagas.innerHTML = dados.itens.length
      ? dados.itens.map(htmlRegistroVaga).join("")
      : htmlEstado("Nenhuma vaga aqui", filtros.vagas === "encerradas" ? "Nenhuma vaga vencida no site." : "Troque o filtro ou a busca.");
    focarRegistro(listaVagas, focarId);
  } catch (erro) {
    listaVagas.innerHTML = htmlErroLista(erro);
  } finally {
    listaVagas.removeAttribute("aria-busy");
  }
}

listaVagas.addEventListener("click", async (evento) => {
  const botao = (evento.target as HTMLElement).closest<HTMLButtonElement>("button[data-acao]");
  const id = Number(botao?.closest<HTMLElement>("[data-id]")?.dataset.id);
  const item = vagas.get(id);
  if (!botao || !item) return;
  if (botao.dataset.acao === "editar") return abrirFormVaga(item);
  if (botao.dataset.acao === "foto") {
    abrirFormVaga(item);
    return irParaFoto("vg");
  }

  botao.disabled = true;
  try {
    if (botao.dataset.acao === "conferir") {
      await postJson(`/api/admin/vagas/${id}/conferir`, {});
      avisar("Data da conferência atualizada para hoje.");
    } else {
      const ocultar = botao.dataset.acao === "ocultar";
      await postJson(`/api/vagas/${id}/ocultar`, { oculta: ocultar });
      avisar(ocultar ? `“${item.titulo}” saiu do site.` : `“${item.titulo}” voltou para o site.`);
    }
    await carregarVagas(id);
  } catch (erro) {
    avisar(mensagemDeErro(erro));
    botao.disabled = false;
  }
});

// ---------- Vagas: formulário (grava pelas rotas /api/vagas da Pessoa 4) ----------

const AFIRMATIVAS = ["afirmativa_mulheres", "afirmativa_negras", "afirmativa_trans"] as const;
const SELOS: Record<(typeof AFIRMATIVAS)[number], Selo> = {
  afirmativa_mulheres: { valor: "mulheres", rotulo: "Afirmativa para mulheres" },
  afirmativa_negras: { valor: "negras", rotulo: "Afirmativa para mulheres negras" },
  afirmativa_trans: { valor: "trans", rotulo: "Afirmativa para mulheres trans" },
};

function hojeIso(): string {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function abrirFormVaga(vaga?: VagaAdmin): void {
  formVaga.reset();
  limparErros(formVaga, errosVaga);
  vagaEditando = vaga?.id ?? null;
  el("titulo-form-vaga").textContent = vaga ? "Editar vaga" : "Nova vaga";

  campo(formVaga, "data_coleta").value = vaga?.data_coleta ?? hojeIso();
  if (vaga) {
    campo(formVaga, "titulo").value = vaga.titulo;
    campo(formVaga, "organizacao").value = vaga.organizacao;
    campo<HTMLSelectElement>(formVaga, "tipo").value = vaga.tipo;
    campo<HTMLSelectElement>(formVaga, "area").value = vaga.area;
    campo<HTMLTextAreaElement>(formVaga, "descricao").value = vaga.descricao;
    campo<HTMLSelectElement>(formVaga, "modalidade").value = vaga.modalidade;
    campo(formVaga, "cidade").value = vaga.cidade ?? "";
    campo(formVaga, "prazo").value = vaga.prazo ?? "";
    campo(formVaga, "link_original").value = vaga.link_original;
    for (const nome of AFIRMATIVAS) campo(formVaga, nome).checked = Boolean(vaga.marcadas[nome]);
    campo<HTMLTextAreaElement>(formVaga, "fonte_afirmacao").value = vaga.fonte_afirmacao;
  }
  fotoVaga.iniciar(vaga?.imagem_url ?? null);

  atualizarFonte();
  atualizarPreviaVaga();
  formsSujos.delete(formVaga);
  dialogoVaga.showModal();
  campo(formVaga, "titulo").focus();
}

function dadosVaga(): Record<string, unknown> {
  const dados = new FormData(formVaga);
  const corpo: Record<string, unknown> = {};
  for (const nome of ["titulo", "organizacao", "tipo", "area", "descricao", "modalidade", "cidade", "prazo", "link_original", "data_coleta", "fonte_afirmacao", "imagem_url"]) {
    corpo[nome] = texto(dados, nome);
  }
  for (const nome of AFIRMATIVAS) corpo[nome] = dados.has(nome);
  return corpo;
}

/** O campo da fonte só aparece (e só é obrigatório) com alguma caixa afirmativa marcada. */
function atualizarFonte(): void {
  const marcada = AFIRMATIVAS.some((nome) => campo(formVaga, nome).checked);
  el("vg-fonte-campo").hidden = !marcada;
  campo<HTMLTextAreaElement>(formVaga, "fonte_afirmacao").required = marcada;
}

function atualizarPreviaVaga(): void {
  const d = dadosVaga() as Record<string, string> & Record<(typeof AFIRMATIVAS)[number], boolean>;
  const tipo = opcoes.vagas.tipos.find((t) => t.valor === d.tipo);
  const area = opcoes.areas.find((a) => a.valor === d.area)?.rotulo ?? "Área";
  const modalidade = opcoes.vagas.modalidades.find((m) => m.valor === d.modalidade)?.rotulo ?? "Modalidade";
  const temFonte = d.fonte_afirmacao.length > 0;
  const marcadas = AFIRMATIVAS.filter((nome) => d[nome]);
  // Mesma regra do servidor: selo só com a fonte preenchida.
  const selos = temFonte ? marcadas.map((nome) => SELOS[nome]) : [];

  let prazo = "Fluxo contínuo";
  let classePrazo = "cartao__prazo";
  if (d.prazo) {
    const [ano, mes, dia] = d.prazo.split("-");
    const aberto = d.prazo >= hojeIso();
    prazo = `${aberto ? "Até" : "Encerrada em"} ${dia}/${mes}/${ano}`;
    if (!aberto) classePrazo += " cartao__prazo--encerrado";
  }
  const descricao = d.descricao.length <= 150 ? d.descricao : `${d.descricao.slice(0, 147).replace(/\s+\S*$/, "")}…`;
  const logo = urlImagem(d.imagem_url);

  el("previa-vaga").innerHTML = `
    <li>
      <article class="cartao cartao--ficha cartao--vaga" style="--rot: 0.8deg; --cor-ficha: var(--pin-violeta)">
        <span class="pin" style="--cor-pin: var(--pin-violeta)" aria-hidden="true"></span>
        <div>
          <div class="cartao__cabecalho-vaga">
            <p class="cartao__tipo">${icone(tipo?.icone ?? "prototipo")}${esc(tipo?.rotulo ?? "Tipo")}</p>
            <span class="${classePrazo}">${esc(prazo)}</span>
          </div>
          <h3 class="cartao__titulo">${esc(d.titulo || "Título da vaga")}</h3>
          <p class="cartao__organizacao${logo ? " cartao__organizacao--logo" : ""}">
            ${logo ? `<img class="cartao__logo" src="${esc(logo)}" alt="">` : ""}${esc(d.organizacao || "Instituição ou empresa")}
          </p>
          <p class="cartao__area">${esc(area)}</p>
          ${selos.length ? `<ul class="selos">${selos.map((s) => `<li class="selo selo--${s.valor}">${esc(s.rotulo)}</li>`).join("")}</ul>` : ""}
          <p class="cartao__resumo">${esc(descricao || "A descrição curta aparece aqui.")}</p>
        </div>
        <div class="cartao__meta-vaga">
          <span class="cartao__badge-modalidade">${esc(modalidade)}</span>
          <span>${esc(d.cidade || "Nacional / Online")}</span>
        </div>
      </article>
    </li>
    ${marcadas.length && !temFonte ? '<li class="previa__aviso">O selo afirmativo só aparece depois que você preencher o trecho do edital.</li>' : ""}`;
}

formVaga.addEventListener("change", (evento) => {
  if ((evento.target as HTMLInputElement).name.startsWith("afirmativa_")) atualizarFonte();
  atualizarPreviaVaga();
});
formVaga.addEventListener("input", atualizarPreviaVaga);

formVaga.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = formVaga.querySelector<HTMLButtonElement>("button[type=submit]")!;
  botao.disabled = true;
  try {
    await fotoVaga.pronto();
    const dados = dadosVaga();
    const salva = vagaEditando
      ? await putJson<VagaAdmin>(`/api/vagas/${vagaEditando}`, dados)
      : await postJson<VagaAdmin>("/api/vagas", dados);
    const nova = vagaEditando === null;
    formsSujos.delete(formVaga);
    dialogoVaga.close();
    avisar(nova ? `“${salva.titulo}” entrou em Vagas.` : "Vaga atualizada.");
    if (nova) marcarSegmento("vagas", "no_site");
    await carregarVagas(salva.id);
  } catch (erro) {
    if (erro instanceof ErroApi && Object.keys(erro.erros).length) mostrarErros(formVaga, errosVaga, erro.erros);
    else mostrarErroGeral(formVaga, errosVaga, erro);
  } finally {
    botao.disabled = false;
  }
});

// ---------- Notícias: lista ----------

function htmlRegistroNoticia(n: NoticiaAdmin): string {
  const foto = urlImagem(n.imagem_url);
  const etiquetas: string[] = [];
  if (n.oculta) etiquetas.push(etiqueta("oculto", "Oculta"));
  if (n.destaque) etiquetas.push(etiqueta("carimbo", "Destaque"));
  if (n.cientista_brasileira) etiquetas.push(etiqueta("neutra", "Cientista brasileira"));
  if (n.cientista_negra) etiquetas.push(etiqueta("selo-negras", "Mulher negra na ciência"));
  if (!foto) etiquetas.push(etiqueta("alerta", "Sem foto"));
  const descricao = `reg-noticia-${n.id}`;

  return `
    <li class="registro${n.oculta ? " registro--apagado" : ""}" data-id="${n.id}">
      ${foto ? `<img class="registro__foto" src="${esc(foto)}" alt="" loading="lazy">` : `<div class="registro__icone" aria-hidden="true">${icone(n.icone)}</div>`}
      <div class="registro__corpo">
        <h3 class="registro__titulo" id="${descricao}">${esc(n.titulo)}</h3>
        <p class="registro__meta">${esc([n.cientista, n.categoria_rotulo, n.data_publicacao_rotulo, n.fonte_nome].filter(Boolean).join(" · "))}</p>
        <ul class="etiquetas-admin">${etiquetas.join("")}</ul>
      </div>
      <div class="registro__acoes">
        <button class="botao-mini" type="button" data-acao="editar" aria-describedby="${descricao}">Editar</button>
        ${botaoFoto(Boolean(foto), descricao)}
        <a class="botao-mini" href="${esc(urlSegura(n.link_fonte) ?? "#")}" target="_blank" rel="noopener" aria-describedby="${descricao}">Abrir fonte</a>
        <button class="botao-mini" type="button" data-acao="${n.oculta ? "mostrar" : "ocultar"}" aria-describedby="${descricao}">
          ${n.oculta ? "Mostrar no site" : "Ocultar"}
        </button>
      </div>
    </li>`;
}

async function carregarNoticias(focarId: number | null = null): Promise<void> {
  listaNoticias.setAttribute("aria-busy", "true");
  const parametros = new URLSearchParams({ estado: filtros.noticias, q: el<HTMLInputElement>("busca-noticias").value.trim() });
  try {
    const dados = await api<Lista<NoticiaAdmin>>(`/api/admin/noticias?${parametros}`);
    noticias = new Map(dados.itens.map((n) => [n.id, n]));
    mostrarContagens("noticias", dados.contagens);
    listaNoticias.innerHTML = dados.itens.length
      ? dados.itens.map(htmlRegistroNoticia).join("")
      : htmlEstado("Nenhuma notícia aqui", filtros.noticias === "no_site" ? "Publique a primeira em “Nova notícia”." : "Troque o filtro ou a busca.");
    focarRegistro(listaNoticias, focarId);
  } catch (erro) {
    listaNoticias.innerHTML = htmlErroLista(erro);
  } finally {
    listaNoticias.removeAttribute("aria-busy");
  }
}

listaNoticias.addEventListener("click", async (evento) => {
  const botao = (evento.target as HTMLElement).closest<HTMLButtonElement>("button[data-acao]");
  const id = Number(botao?.closest<HTMLElement>("[data-id]")?.dataset.id);
  const item = noticias.get(id);
  if (!botao || !item) return;
  if (botao.dataset.acao === "editar") return abrirFormNoticia(item);
  if (botao.dataset.acao === "foto") {
    abrirFormNoticia(item);
    return irParaFoto("nt");
  }

  const ocultar = botao.dataset.acao === "ocultar";
  botao.disabled = true;
  try {
    await postJson(`/api/noticias/${id}/ocultar`, { oculta: ocultar });
    avisar(ocultar ? `“${item.titulo}” saiu do site.` : `“${item.titulo}” voltou para o site.`);
    await carregarNoticias(id);
  } catch (erro) {
    avisar(mensagemDeErro(erro));
    botao.disabled = false;
  }
});

// ---------- Notícias: formulário (grava pelas rotas /api/noticias) ----------

function abrirFormNoticia(noticia?: NoticiaAdmin): void {
  formNoticia.reset();
  limparErros(formNoticia, errosNoticia);
  noticiaEditando = noticia?.id ?? null;
  el("titulo-form-noticia").textContent = noticia ? "Editar notícia" : "Nova notícia";

  campo(formNoticia, "data_publicacao").value = noticia?.data_publicacao ?? hojeIso();
  if (noticia) {
    campo(formNoticia, "titulo").value = noticia.titulo;
    campo(formNoticia, "cientista").value = noticia.cientista;
    campo(formNoticia, "instituicao").value = noticia.instituicao ?? "";
    campo<HTMLTextAreaElement>(formNoticia, "resumo").value = noticia.resumo;
    campo<HTMLSelectElement>(formNoticia, "categoria").value = noticia.categoria;
    campo<HTMLSelectElement>(formNoticia, "area").value = noticia.area;
    campo(formNoticia, "fonte_nome").value = noticia.fonte_nome;
    campo(formNoticia, "link_fonte").value = noticia.link_fonte;
    campo(formNoticia, "cientista_brasileira").checked = noticia.cientista_brasileira;
    campo(formNoticia, "cientista_negra").checked = noticia.cientista_negra;
    campo(formNoticia, "destaque").checked = noticia.destaque;
  }
  fotoNoticia.iniciar(noticia?.imagem_url ?? null);

  atualizarPreviaNoticia();
  formsSujos.delete(formNoticia);
  dialogoNoticia.showModal();
  campo(formNoticia, "titulo").focus();
}

function dadosNoticia(): Record<string, unknown> {
  const dados = new FormData(formNoticia);
  const corpo: Record<string, unknown> = {};
  for (const nome of ["titulo", "cientista", "instituicao", "resumo", "categoria", "area", "data_publicacao", "fonte_nome", "link_fonte", "imagem_url"]) {
    corpo[nome] = texto(dados, nome);
  }
  for (const nome of ["cientista_brasileira", "cientista_negra", "destaque"]) corpo[nome] = dados.has(nome);
  return corpo;
}

function atualizarPreviaNoticia(): void {
  const d = dadosNoticia() as Record<string, string> & Record<"cientista_brasileira" | "cientista_negra", boolean>;
  const categoria = opcoes.noticias.categorias.find((c) => c.valor === d.categoria);
  const area = opcoes.areas.find((a) => a.valor === d.area)?.rotulo ?? "Área";
  const [ano, mes, dia] = d.data_publicacao.split("-");
  const foto = urlImagem(d.imagem_url);
  // Mesmo corte do servidor (noticias/servico.py): 170 letras no cartão.
  const resumo = d.resumo.length <= 170 ? d.resumo : `${d.resumo.slice(0, 167).replace(/\s+\S*$/, "")}…`;
  const selos: string[] = [];
  if (d.cientista_brasileira) selos.push('<li class="selo selo--brasileira">Cientista brasileira</li>');
  if (d.cientista_negra) selos.push('<li class="selo selo--negras">Mulher negra na ciência</li>');

  el("previa-noticia").innerHTML = `
    <li>
      <article class="cartao cartao--recorte" style="--rot: -0.7deg; --rot-fita: 1.2deg; --cor-ficha: var(--pin-azul)">
        <span class="pin" style="--cor-pin: var(--pin-azul)" aria-hidden="true"></span>
        <div>
          ${foto ? `<div class="recorte__foto"><img src="${esc(foto)}" alt=""></div>` : ""}
          <div class="recorte__topo">
            <span class="recorte__categoria">${icone(categoria?.icone ?? "ic")}${esc(categoria?.rotulo ?? "Categoria")}</span>
            <span>${dia ? esc(`${dia}/${mes}/${ano}`) : "Data"}</span>
          </div>
          <h3 class="cartao__titulo">${esc(d.titulo || "Manchete da notícia")}</h3>
          <p class="recorte__protagonista">${esc(d.cientista || "Cientista ou equipe")}</p>
          ${d.instituicao ? `<p class="recorte__instituicao">${esc(d.instituicao)}</p>` : ""}
          ${selos.length ? `<ul class="selos">${selos.join("")}</ul>` : ""}
          <p class="cartao__resumo">${esc(resumo || "O começo do resumo aparece aqui.")}</p>
        </div>
        <div class="recorte__rodape">
          <span class="recorte__area">${esc(area)}</span>
          <span>Fonte: ${esc(d.fonte_nome || "veículo")}</span>
        </div>
      </article>
    </li>
    ${foto ? "" : '<li class="previa__aviso">Sem foto, o recorte aparece só com o texto.</li>'}`;
}

formNoticia.addEventListener("input", atualizarPreviaNoticia);
formNoticia.addEventListener("change", atualizarPreviaNoticia);

formNoticia.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = formNoticia.querySelector<HTMLButtonElement>("button[type=submit]")!;
  botao.disabled = true;
  try {
    await fotoNoticia.pronto();
    const dados = dadosNoticia();
    const salva = noticiaEditando
      ? await putJson<NoticiaAdmin>(`/api/noticias/${noticiaEditando}`, dados)
      : await postJson<NoticiaAdmin>("/api/noticias", dados);
    const nova = noticiaEditando === null;
    formsSujos.delete(formNoticia);
    dialogoNoticia.close();
    avisar(nova ? `“${salva.titulo}” entrou em Notícias.` : "Notícia atualizada.");
    if (nova) marcarSegmento("noticias", "no_site");
    await carregarNoticias(salva.id);
  } catch (erro) {
    if (erro instanceof ErroApi && Object.keys(erro.erros).length) mostrarErros(formNoticia, errosNoticia, erro.erros);
    else mostrarErroGeral(formNoticia, errosNoticia, erro);
  } finally {
    botao.disabled = false;
  }
});

// ---------- Denúncias ----------

function atualizarContagemDenuncias(total: number): void {
  const marcador = el("contagem-denuncias");
  marcador.hidden = total === 0;
  marcador.textContent = String(total);
  marcador.setAttribute("aria-label", plural(total, "pendente", "pendentes"));
}

function htmlCaso(c: CasoDenuncia): string {
  const arquivos = c.arquivos
    .map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener">${icone("arquivo")}${esc(a.nome)}</a></li>`)
    .join("");
  const link = urlSegura(c.link_externo);
  const comentarios = c.comentarios
    .map((m) => `<li><blockquote>“${esc(m.texto)}”</blockquote><span>${esc(m.motivo)} · ${esc(m.quando)}</span></li>`)
    .join("");
  const titulo = `caso-${c.id}`;

  return `
    <li class="caso${c.oculto ? " caso--fora" : ""}" data-id="${c.id}">
      <div class="caso__topo">
        <ul class="etiquetas-admin">
          ${c.oculto ? etiqueta("oculto", "Fora do mural") : etiqueta("neutra", "Ainda no mural")}
          ${etiqueta("alerta", plural(c.total_denuncias, "denúncia", "denúncias"))}
        </ul>
      </div>
      <h3 class="caso__titulo" id="${titulo}">${esc(c.titulo)}</h3>
      <p class="registro__meta">${esc([c.tipo_rotulo, c.area_rotulo, `por ${c.autora}`, String(c.ano)].join(" · "))}</p>
      <details class="caso__resumo">
        <summary>Ler o resumo e ver o material</summary>
        <p>${esc(c.resumo)}</p>
        ${arquivos || link ? `<ul class="caso__material">${arquivos}${link ? `<li><a href="${esc(link)}" target="_blank" rel="noopener">${icone("externo")}Link do projeto</a></li>` : ""}</ul>` : ""}
      </details>
      <div class="caso__motivos">
        <p class="rotulo">Motivos</p>
        <ul class="etiquetas-admin">${c.motivos.map((m) => etiqueta("motivo", `${m.rotulo} (${m.total})`)).join("")}</ul>
      </div>
      ${comentarios ? `<div class="caso__comentarios"><p class="rotulo">O que escreveram</p><ul>${comentarios}</ul></div>` : ""}
      <div class="caso__acoes">
        <button class="botao botao--primario" type="button" data-decisao="restaurar" aria-describedby="${titulo}">
          Está tudo certo${c.oculto ? ": voltar ao mural" : ""}
        </button>
        <button class="botao botao--secundario" type="button" data-decisao="fora_do_mural" aria-describedby="${titulo}">
          ${c.oculto ? "Manter fora do mural" : "Tirar do mural"}
        </button>
      </div>
    </li>`;
}

async function carregarDenuncias(): Promise<void> {
  listaDenuncias.setAttribute("aria-busy", "true");
  try {
    const casos = await api<CasoDenuncia[]>("/api/admin/denuncias");
    atualizarContagemDenuncias(casos.length);
    listaDenuncias.innerHTML = casos.length
      ? casos.map(htmlCaso).join("")
      : htmlEstado("Nenhuma denúncia para revisar", "Quando alguém denunciar um projeto, ele aparece aqui.", "verde");
  } catch (erro) {
    listaDenuncias.innerHTML = htmlErroLista(erro);
  } finally {
    listaDenuncias.removeAttribute("aria-busy");
  }
}

listaDenuncias.addEventListener("click", async (evento) => {
  const botao = (evento.target as HTMLElement).closest<HTMLButtonElement>("[data-decisao]");
  const id = botao?.closest<HTMLElement>("[data-id]")?.dataset.id;
  if (!botao || !id) return;
  botao.disabled = true;
  try {
    await postJson(`/api/admin/projetos/${id}/moderar`, { decisao: botao.dataset.decisao });
    avisar(botao.dataset.decisao === "restaurar" ? "Projeto de volta no mural." : "O projeto fica fora do mural.");
    await carregarDenuncias();
    (listaDenuncias.querySelector<HTMLElement>("button") ?? el("aba-moderacao")).focus();
  } catch (erro) {
    avisar(mensagemDeErro(erro));
    botao.disabled = false;
  }
});

// ---------- Destaques da semana ----------

function capa(p: Cartao): string {
  const url = urlSegura(p.imagem_url);
  return url
    ? `<img src="${esc(url)}" alt="" loading="lazy">`
    : `<span class="miniatura__icone">${icone(p.icone)}</span>`;
}

async function carregarDestaques(): Promise<void> {
  listaDestaques.setAttribute("aria-busy", "true");
  try {
    const vitrine = await api<Vitrine>("/api/admin/destaques");
    vitrineCheia = vitrine.itens.length >= vitrine.limite;
    el("contador-destaques").textContent = `${vitrine.itens.length} de ${vitrine.limite}`;
    const ocupados = vitrine.itens.map(
      (p, i) => `
      <li class="vitrine__item" data-id="${p.id}" style="--rot: ${rotacao(p.id, 1.4)}deg">
        <span class="pin" style="--cor-pin: var(${["--pin-magenta", "--pin-verde", "--pin-azul", "--pin-ambar", "--pin-violeta"][i % 5]})" aria-hidden="true"></span>
        <div class="miniatura">${capa(p)}</div>
        <strong id="vitrine-${p.id}">${esc(p.titulo)}</strong>
        <span>${esc(p.autora)} · ${esc(p.area_rotulo)}</span>
        <button class="botao-mini" type="button" data-destaque="false" aria-describedby="vitrine-${p.id}">Tirar da vitrine</button>
      </li>`,
    );
    const livres = Array.from(
      { length: Math.max(vitrine.limite - vitrine.itens.length, 0) },
      () => '<li class="vitrine__livre" aria-hidden="true">Espaço livre</li>',
    );
    listaDestaques.innerHTML = [...ocupados, ...livres].join("");
  } catch (erro) {
    listaDestaques.innerHTML = htmlErroLista(erro);
  } finally {
    listaDestaques.removeAttribute("aria-busy");
  }
  await carregarCandidatos();
}

async function carregarCandidatos(): Promise<void> {
  listaCandidatos.setAttribute("aria-busy", "true");
  const parametros = new URLSearchParams({ q: el<HTMLInputElement>("busca-projetos").value.trim(), ordem: "estrelas", por_pagina: "12" });
  try {
    const pagina = await api<PaginaProjetos>(`/api/projetos?${parametros}`);
    listaCandidatos.innerHTML = pagina.itens.length
      ? pagina.itens
          .map((p) => {
            const descricao = `candidato-${p.id}`;
            const botao = p.destaque
              ? `<button class="botao-mini" type="button" data-destaque="false" aria-describedby="${descricao}">Tirar da vitrine</button>`
              : `<button class="botao-mini botao-mini--magenta" type="button" data-destaque="true" aria-describedby="${descricao}"${vitrineCheia ? " disabled" : ""}>Pôr na vitrine</button>`;
            return `
            <li class="registro" data-id="${p.id}">
              <div class="miniatura miniatura--pequena" aria-hidden="true">${capa(p)}</div>
              <div class="registro__corpo">
                <h3 class="registro__titulo" id="${descricao}">${esc(p.titulo)}</h3>
                <p class="registro__meta">${esc([p.tipo_rotulo, p.autora, p.area_rotulo, plural(p.estrelas, "estrela", "estrelas")].join(" · "))}</p>
                ${p.destaque ? `<ul class="etiquetas-admin">${etiqueta("carimbo", "Na vitrine")}</ul>` : ""}
              </div>
              <div class="registro__acoes">${botao}</div>
            </li>`;
          })
          .join("")
      : htmlEstado("Nenhum projeto encontrado", "Tente outra palavra.");
  } catch (erro) {
    listaCandidatos.innerHTML = htmlErroLista(erro);
  } finally {
    listaCandidatos.removeAttribute("aria-busy");
  }
}

async function alternarDestaque(evento: Event): Promise<void> {
  const botao = (evento.target as HTMLElement).closest<HTMLButtonElement>("[data-destaque]");
  const id = Number(botao?.closest<HTMLElement>("[data-id]")?.dataset.id);
  if (!botao || !id) return;
  const destacar = botao.dataset.destaque === "true";
  botao.disabled = true;
  try {
    await postJson(`/api/admin/destaques/${id}`, { destaque: destacar });
    avisar(destacar ? "Projeto na vitrine desta semana." : "Projeto saiu da vitrine.");
    await carregarDestaques();
    focarRegistro(listaCandidatos, id);
  } catch (erro) {
    avisar(mensagemDeErro(erro));
    botao.disabled = false;
  }
}

listaDestaques.addEventListener("click", alternarDestaque);
listaCandidatos.addEventListener("click", alternarDestaque);

// ---------- Início ----------

function ligarFiltros(): void {
  document.querySelectorAll<HTMLElement>(".segmentos").forEach((grupo) => {
    grupo.addEventListener("click", (evento) => {
      const botao = (evento.target as HTMLElement).closest<HTMLButtonElement>("[data-estado]");
      const lista = grupo.dataset.lista as ListaComFiltro;
      if (!botao) return;
      marcarSegmento(lista, botao.dataset.estado ?? "");
      void carregarAba(lista);
    });
  });
  el("busca-eventos").addEventListener("input", debounce(() => void carregarEventos()));
  el("busca-vagas").addEventListener("input", debounce(() => void carregarVagas()));
  el("busca-noticias").addEventListener("input", debounce(() => void carregarNoticias()));
  el("busca-projetos").addEventListener("input", debounce(() => void carregarCandidatos()));
  el("novo-evento").addEventListener("click", () => abrirFormEvento());
  el("nova-vaga").addEventListener("click", () => abrirFormVaga());
  el("nova-noticia").addEventListener("click", () => abrirFormNoticia());
}

function preencherFormularios(): void {
  preencherSelect(el<HTMLSelectElement>("ev-tipo"), opcoes.eventos.tipos);
  preencherSelect(el<HTMLSelectElement>("ev-publico"), opcoes.eventos.publicos);
  preencherSelect(el<HTMLSelectElement>("ev-area"), opcoes.areas);
  preencherSelect(el<HTMLSelectElement>("ev-uf"), opcoes.estados);
  el("ev-modalidades").innerHTML = opcoes.eventos.modalidades
    .map(
      (m) => `
      <label class="escolha">
        <input type="radio" id="ev-modalidade-${esc(m.valor)}" name="modalidade" value="${esc(m.valor)}" required>
        <span>${esc(m.rotulo)}</span>
      </label>`,
    )
    .join("");
  preencherSelect(el<HTMLSelectElement>("vg-tipo"), opcoes.vagas.tipos);
  preencherSelect(el<HTMLSelectElement>("vg-area"), opcoes.areas);
  preencherSelect(el<HTMLSelectElement>("vg-modalidade"), opcoes.vagas.modalidades);
  preencherSelect(el<HTMLSelectElement>("nt-categoria"), opcoes.noticias.categorias);
  preencherSelect(el<HTMLSelectElement>("nt-area"), opcoes.areas);
}

async function iniciar(): Promise<void> {
  try {
    opcoes = await api<OpcoesPainel>("/api/admin/opcoes");
  } catch (erro) {
    el("numeros").innerHTML = htmlErroLista(erro);
    return;
  }
  preencherFormularios();
  ligarAbas();
  ligarFiltros();

  const pedida = location.hash.slice(1);
  abrirAba(abaValida(pedida) ? pedida : "geral");
  // Links para /admin#vagas (e voltar no navegador) trocam de aba sem recarregar a página.
  window.addEventListener("hashchange", () => {
    const aba = location.hash.slice(1);
    if (abaValida(aba)) abrirAba(aba);
  });
  // O número de denúncias na aba aparece mesmo antes de abrir a aba.
  api<CasoDenuncia[]>("/api/admin/denuncias")
    .then((casos) => atualizarContagemDenuncias(casos.length))
    .catch(() => undefined);
}

void iniciar();
