// Aba do Passaporte: carrega o passaporte 3D, liga os botões e avisa o servidor
// quando o carimbo de boas-vindas já foi visto (para não repetir a animação).
import { el, postJson } from "./comum.js";
import type { Dados } from "./passaporte-paginas.js";

const dados = JSON.parse(el("passaporte-dados").textContent ?? "{}") as Dados;
const palco = el("passaporte-palco");
const controles = el("passaporte-controles");
const anterior = el<HTMLButtonElement>("passaporte-anterior");
const proxima = el<HTMLButtonElement>("passaporte-proxima");
const anteriorTexto = el("passaporte-anterior-texto");
const proximaTexto = el("passaporte-proxima-texto");
const onde = el("passaporte-onde");
const texto = el("passaporte-texto");
const dica = el("passaporte-dica");
const cortica = palco.parentElement!;
const botaoTela = el<HTMLButtonElement>("passaporte-tela-cheia");
const botaoTelaTexto = el("passaporte-tela-cheia-texto");

const boasVindas = dados.carimbos.find((c) => c.codigo === "boas-vindas");
const ONDE = ["Passaporte fechado", "Identidade e carimbos", "Eventos", "Anotações"];
// No celular, uma página por vez: [esquerda, direita] de cada abertura.
const ONDE_PAGINA = [["", ""], ["Identidade", "Carimbos"], ["Eventos", "Eventos"], ["Anotações", "Boa jornada"]];

function semTresD(): void {
  // Sem WebGL: a versão em texto vira a principal.
  palco.hidden = true;
  texto.classList.add("passaporte-texto--visivel");
  dica.textContent = "Seu passaporte, página por página.";
  if (boasVindas && !boasVindas.visto) void marcarVisto();
}

async function marcarVisto(): Promise<void> {
  if (!boasVindas) return;
  try {
    await postJson(`/api/passaporte/carimbos/${encodeURIComponent(boasVindas.codigo)}/visto`, {});
    boasVindas.visto = true;
  } catch {
    // Se falhar, a animação volta na próxima visita; a impressão já está no papel.
  }
}

// ---------- Tela cheia ----------
// Só quando a pessoa pede, pelo botão. Usa a tela cheia do navegador quando existe
// (precisa ser pedida no clique); onde não existe, como no iPhone, a camada fixa faz o papel.

function emTelaCheia(): boolean {
  return cortica.classList.contains("passaporte-cortica--tela-cheia");
}

function marcarBotaoTela(ligada: boolean): void {
  botaoTela.setAttribute("aria-pressed", String(ligada));
  botaoTelaTexto.textContent = ligada ? "Sair da tela cheia" : "Tela cheia";
}

function entrarTelaCheia(): void {
  if (emTelaCheia()) return;
  cortica.classList.add("passaporte-cortica--tela-cheia");
  document.documentElement.classList.add("passaporte-sem-rolagem");
  marcarBotaoTela(true);
  cortica.requestFullscreen?.({ navigationUI: "hide" }).catch(() => undefined);
}

function sairTelaCheia(): void {
  if (!emTelaCheia()) return;
  cortica.classList.remove("passaporte-cortica--tela-cheia");
  document.documentElement.classList.remove("passaporte-sem-rolagem");
  marcarBotaoTela(false);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
}

botaoTela.addEventListener("click", () => (emTelaCheia() ? sairTelaCheia() : entrarTelaCheia()));
// Esc (ou o gesto do sistema) tira o navegador da tela cheia: a camada sai junto.
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) sairTelaCheia();
});
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") sairTelaCheia();
});

async function iniciar(): Promise<void> {
  let modulo: typeof import("./passaporte-3d.js");
  try {
    modulo = await import("./passaporte-3d.js");
  } catch {
    semTresD();
    return;
  }
  const controle = await modulo.montarPassaporte(palco, {
    dados,
    carimboNovo: Boolean(boasVindas && !boasVindas.visto),
    aoMudar: atualizar,
    aoCarimbar: () => {
      onde.textContent = "Carimbo de boas-vindas recebido!";
      void marcarVisto();
    },
  }).catch(() => null);
  el("passaporte-carregando").remove();
  if (!controle) {
    semTresD();
    return;
  }

  function atualizar(viradas: number): void {
    const lado = controle!.lado;
    const naUltima = viradas >= controle!.total && lado !== "esq";
    anterior.disabled = viradas === 0;
    proxima.disabled = naUltima;
    anteriorTexto.textContent = viradas === 1 && lado !== "dir" ? "Fechar passaporte" : "Página anterior";
    proximaTexto.textContent = viradas === 0 ? "Abrir passaporte" : "Próxima página";
    onde.textContent = lado ? ONDE_PAGINA[viradas][lado === "esq" ? 0 : 1] : (ONDE[viradas] ?? "");
    cortica.classList.toggle("passaporte-cortica--aberto", viradas > 0);
  }

  controles.hidden = false;
  botaoTela.hidden = false;
  atualizar(0);
  // O teclado usa os botões; o 3D é só para o mouse e o toque (e fica escondido do leitor de tela).
  anterior.addEventListener("click", () => controle.anterior());
  proxima.addEventListener("click", () => controle.proxima());
}

void iniciar();
