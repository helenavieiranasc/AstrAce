// Quiz "Que cientista você seria?": uma pergunta por vez; o servidor soma os pontos e devolve a cientista.

import { api, el, esc, mensagemDeErro, postJson } from "./comum.js";

interface Pergunta {
  texto: string;
  opcoes: string[];
}

interface Resultado {
  area: string;
  area_rotulo: string;
  cientista: string;
  sobre: string;
  perfil: string;
}

const CORES = ["rosa", "amarelo", "verde", "azul"];

const telaInicio = el("tela-inicio");
const telaPergunta = el<HTMLFormElement>("tela-pergunta");
const telaResultado = el("tela-resultado");
const botaoComecar = el<HTMLButtonElement>("comecar");
const botaoProxima = el<HTMLButtonElement>("proxima");
const botaoVoltar = el<HTMLButtonElement>("voltar");
const opcoes = el("opcoes");

let perguntas: Pergunta[] = [];
let respostas: (number | undefined)[] = [];
let atual = 0;
let resultado: Resultado | null = null;

function mostrar(tela: HTMLElement): void {
  for (const t of [telaInicio, telaPergunta, telaResultado]) t.hidden = t !== tela;
  window.scrollTo({ top: 0 });
}

// ---------- Perguntas ----------

function renderPergunta(): void {
  const p = perguntas[atual];
  const total = perguntas.length;
  el("progresso-texto").textContent = `Pergunta ${atual + 1} de ${total}`;
  el("progresso-barra").style.width = `${((atual + 1) / total) * 100}%`;
  el("pergunta-texto").textContent = p.texto;
  opcoes.innerHTML = p.opcoes
    .map(
      (texto, i) => `
      <label class="quiz-opcao quiz-opcao--${CORES[i % CORES.length]}">
        <input type="radio" name="resposta" value="${i}" ${respostas[atual] === i ? "checked" : ""}>
        <span>${esc(texto)}</span>
      </label>`,
    )
    .join("");
  botaoProxima.disabled = respostas[atual] === undefined;
  botaoProxima.textContent = atual === total - 1 ? "Ver meu resultado" : "Próxima";
  botaoVoltar.textContent = atual === 0 ? "Voltar ao início" : "Voltar";
}

function irPara(indice: number): void {
  atual = indice;
  renderPergunta();
  mostrar(telaPergunta);
  el("pergunta-texto").focus();
}

async function terminar(): Promise<void> {
  const aviso = el("aviso-pergunta");
  aviso.hidden = true;
  botaoProxima.disabled = true;
  botaoProxima.textContent = "Calculando…";
  try {
    const r = await postJson<Resultado>("/api/quiz/resultado", { respostas });
    guardarMeu(r.area);
    mostrarResultado(r, false);
  } catch (erro) {
    botaoProxima.disabled = false;
    botaoProxima.textContent = "Ver meu resultado";
    aviso.textContent = `Não deu para ver o resultado. ${mensagemDeErro(erro)}`;
    aviso.hidden = false;
  }
}

// ---------- Resultado ----------

// Lembra o resultado de quem fez o quiz neste navegador, para recarregar a página não virar "alguém fez".
const CHAVE_MEU = "astrace-quiz-meu";

function guardarMeu(area: string): void {
  try {
    sessionStorage.setItem(CHAVE_MEU, area);
  } catch {
    // Sem armazenamento (aba anônima, por exemplo): só perde esse detalhe.
  }
}

function eMeu(area: string): boolean {
  try {
    return sessionStorage.getItem(CHAVE_MEU) === area;
  } catch {
    return false;
  }
}

function linkDoResultado(area: string): string {
  return `${location.origin}/quiz?resultado=${encodeURIComponent(area)}`;
}

/** compartilhado = veio de um link de outra pessoa: o convite é para fazer o próprio quiz. */
function mostrarResultado(r: Resultado, compartilhado: boolean): void {
  resultado = r;
  el("resultado-chamada").textContent = compartilhado ? "Alguém fez o quiz e seria…" : "Você seria…";
  el("resultado-nome").textContent = r.cientista;
  el("resultado-area").textContent = r.area_rotulo;
  el("resultado-perfil").textContent = compartilhado ? "" : r.perfil;
  el("resultado-perfil").hidden = compartilhado;
  el("resultado-sobre").textContent = r.sobre;

  const area = encodeURIComponent(r.area);
  el<HTMLAnchorElement>("link-projetos").href = `/mural?area=${area}`;
  el<HTMLAnchorElement>("link-eventos").href = `/eventos?area=${area}`;
  el<HTMLAnchorElement>("link-vagas").href = `/vagas?area=${area}`;

  el("refazer").textContent = compartilhado ? "Fazer o meu quiz" : "Refazer o quiz";
  el("refazer").className = compartilhado ? "botao botao--primario" : "botao botao--texto";
  el("story").hidden = compartilhado;
  el("copiar").hidden = compartilhado;
  el("aviso-resultado").hidden = true;

  if (!compartilhado) history.replaceState(null, "", `/quiz?resultado=${area}`);
  mostrar(telaResultado);
  el("resultado-nome").focus();
}

function avisar(texto: string): void {
  const aviso = el("aviso-resultado");
  aviso.textContent = texto;
  aviso.hidden = false;
}

async function copiarLink(): Promise<void> {
  if (!resultado) return;
  const link = linkDoResultado(resultado.area);
  try {
    await navigator.clipboard.writeText(link);
    avisar("Link copiado! É só colar onde quiser.");
  } catch {
    avisar(`Copie o link: ${link}`);
  }
}

// ---------- Imagem para o story (1080x1920) ----------

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolver, falhar) => {
    const imagem = new Image();
    imagem.onload = () => resolver(imagem);
    imagem.onerror = () => falhar(new Error(`Não carregou ${src}`));
    imagem.src = src;
  });
}

/** Quebra o texto em linhas que cabem na largura. */
function linhas(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const saida: string[] = [];
  let linha = "";
  for (const palavra of texto.split(" ")) {
    const teste = linha ? `${linha} ${palavra}` : palavra;
    if (ctx.measureText(teste).width > largura && linha) {
      saida.push(linha);
      linha = palavra;
    } else {
      linha = teste;
    }
  }
  if (linha) saida.push(linha);
  return saida;
}

async function desenharStory(r: Resultado): Promise<Blob> {
  await Promise.all([
    document.fonts.load('700 120px "Caveat"'),
    document.fonts.load('700 44px "Atkinson Hyperlegible"'),
    document.fonts.load('400 40px "Atkinson Hyperlegible"'),
  ]);
  const [estrela, logo] = await Promise.all([
    carregarImagem("/static/img/logo-estrela-original.png"),
    carregarImagem("/static/img/logo-astrace-fundo-magenta.png"),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d")!;

  // Fundo magenta com bolinhas.
  ctx.fillStyle = "#b8135c";
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  for (let y = 20; y < 1920; y += 48) {
    for (let x = (y / 48) % 2 ? 44 : 20; x < 1080; x += 48) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#fffdf7";
  ctx.font = '700 84px "Caveat", cursive';
  ctx.fillText("No quiz da AstrAce,", 540, 210);
  ctx.fillText("eu seria…", 540, 300);

  // Mede o texto antes, para a folha ter a altura do conteúdo.
  ctx.font = '700 118px "Caveat", cursive';
  const nome = linhas(ctx, r.cientista, 760);
  ctx.font = '400 40px "Atkinson Hyperlegible", sans-serif';
  const perfil = linhas(ctx, r.perfil, 720);
  const altura = 70 + 305 + 40 + nome.length * 110 + 80 + 50 + perfil.length * 56 + 60;
  const topo = -altura / 2;

  // Folha de papel inclinada, no meio do espaço entre o título e o rodapé.
  ctx.save();
  ctx.translate(540, 990);
  ctx.rotate((-2 * Math.PI) / 180);
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(-430, topo, 860, altura);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(246, 234, 200, 0.92)"; // fita
  ctx.fillRect(-110, topo - 32, 220, 64);

  let y = topo + 70;
  ctx.drawImage(estrela, -150, y, 300, 305);
  y += 305 + 40 + 90; // a linha de base do texto fica embaixo da letra

  ctx.fillStyle = "#8c0d45";
  ctx.font = '700 118px "Caveat", cursive';
  for (const l of nome) {
    ctx.fillText(l, 0, y);
    y += 110;
  }

  ctx.fillStyle = "#2a1c15";
  ctx.font = '700 44px "Atkinson Hyperlegible", sans-serif';
  ctx.fillText(r.area_rotulo, 0, y - 10);

  ctx.fillStyle = "#66524a";
  ctx.font = '400 40px "Atkinson Hyperlegible", sans-serif';
  y += 80;
  for (const l of perfil) {
    ctx.fillText(l, 0, y);
    y += 56;
  }
  ctx.restore();

  // Rodapé: convite e logo.
  ctx.fillStyle = "#fffdf7";
  ctx.font = '700 46px "Atkinson Hyperlegible", sans-serif';
  ctx.fillText("Descubra a sua cientista:", 540, 1640);
  ctx.font = '400 40px "Atkinson Hyperlegible", sans-serif';
  ctx.fillText(`${location.host}/quiz`, 540, 1700);
  const larguraLogo = 360;
  const alturaLogo = (logo.height / logo.width) * larguraLogo;
  ctx.drawImage(logo, 540 - larguraLogo / 2, 1750, larguraLogo, alturaLogo);

  return new Promise((resolver, falhar) =>
    canvas.toBlob((blob) => (blob ? resolver(blob) : falhar(new Error("Não deu para criar a imagem."))), "image/png"),
  );
}

async function gerarStory(): Promise<void> {
  if (!resultado) return;
  const botao = el<HTMLButtonElement>("story");
  botao.disabled = true;
  botao.textContent = "Preparando a imagem…";
  try {
    const blob = await desenharStory(resultado);
    const arquivo = new File([blob], "astrace-quiz.png", { type: "image/png" });
    // No celular, abre o compartilhar (dá para escolher o Instagram). No computador, baixa a imagem.
    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], text: `No quiz da AstrAce eu seria ${resultado.cientista}!` });
      } catch {
        // Fechou o compartilhar sem escolher: tudo bem.
      }
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "astrace-quiz.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      avisar("Imagem baixada! Poste no story e marque a AstrAce.");
    }
  } catch (erro) {
    avisar(mensagemDeErro(erro));
  } finally {
    botao.disabled = false;
    botao.textContent = "Imagem para o story";
  }
}

// ---------- Início ----------

function ligarEventos(): void {
  botaoComecar.addEventListener("click", () => {
    respostas = new Array(perguntas.length);
    history.replaceState(null, "", "/quiz");
    irPara(0);
  });

  opcoes.addEventListener("change", (e) => {
    respostas[atual] = Number((e.target as HTMLInputElement).value);
    botaoProxima.disabled = false;
  });

  telaPergunta.addEventListener("submit", (e) => {
    e.preventDefault();
    if (respostas[atual] === undefined) return;
    if (atual < perguntas.length - 1) irPara(atual + 1);
    else void terminar();
  });

  botaoVoltar.addEventListener("click", () => {
    if (atual === 0) {
      mostrar(telaInicio);
      botaoComecar.focus();
    } else {
      irPara(atual - 1);
    }
  });

  el("refazer").addEventListener("click", () => botaoComecar.click());
  el("copiar").addEventListener("click", () => void copiarLink());
  el("story").addEventListener("click", () => void gerarStory());
}

async function iniciar(): Promise<void> {
  ligarEventos();
  try {
    perguntas = (await api<{ perguntas: Pergunta[] }>("/api/quiz")).perguntas;
    botaoComecar.disabled = false;
  } catch (erro) {
    const aviso = el("aviso-inicio");
    aviso.textContent = `Não deu para carregar o quiz. ${mensagemDeErro(erro)}`;
    aviso.hidden = false;
    return;
  }

  // Link compartilhado (/quiz?resultado=fisica): mostra o resultado com o convite para fazer o seu.
  const area = new URLSearchParams(location.search).get("resultado");
  if (area) {
    try {
      mostrarResultado(await api<Resultado>(`/api/quiz/resultado/${encodeURIComponent(area)}`), !eMeu(area));
    } catch {
      history.replaceState(null, "", "/quiz");
    }
  }
}

void iniciar();
