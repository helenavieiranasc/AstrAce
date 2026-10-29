// Papéis da carta para o futuro, desenhados em canvas (viram texturas no 3D), no estilo do passaporte: papel com
// fibras e guilhoché, filetes finos e a estrela da marca. Aqui estão a carta, as duas faces do envelope, o selo
// postal, o carimbo do correio e o selo de cera.

export const CARTA_L = 1536;
export const CARTA_A = 2037; // proporção 2,6 × 3,45 (a carta aberta)
export const ENV_L = 1800;
export const ENV_A = 1200; // proporção 3 × 2 (o envelope)

const MAO = '"Caveat", "Segoe Print", cursive';
const TEXTO = '"Atkinson Hyperlegible", system-ui, sans-serif';
const TINTA = "#2a1c15";
const TINTA_SUAVE = "#66524a";
const MAGENTA = "#b8135c";
const MAGENTA_ESCURO = "#8c0d45";

export interface DadosPapel {
  nome: string;
  area: string; // já com o rótulo ("Física e astronomia")
  mensagem: string;
  objetivos: string;
  anos: number | null;
  enviada: string | null; // ISO
  revela: string | null; // ISO
  /** Escreve a mensagem na própria textura (para dobrar e selar). Enquanto a pessoa escreve, o texto é HTML por cima. */
  textoNoPapel: boolean;
}

export interface Logos {
  creme: HTMLImageElement;
  magenta: HTMLImageElement;
}

/** O servidor manda a hora em UTC, sem fuso na ponta: lê como UTC para a conta bater com a dele. */
export function lerData(iso: string): Date {
  return new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
}

export function dataPorExtenso(iso: string | null): string {
  if (!iso) return "";
  return lerData(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

// ---------- Utilidades ----------

function tela(l: number, a: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = l;
  canvas.height = a;
  return [canvas, canvas.getContext("2d")!];
}

function aleatorio(semente: number): () => number {
  let s = semente;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function silhueta(imagem: HTMLImageElement, cor: string, largura: number): HTMLCanvasElement {
  const altura = (imagem.height / imagem.width) * largura;
  const [c, ctx] = tela(Math.ceil(largura), Math.ceil(altura));
  ctx.drawImage(imagem, 0, 0, largura, altura);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let linha = "";
    for (const palavra of paragrafo.split(" ")) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra;
      if (ctx.measureText(tentativa).width > largura && linha) {
        linhas.push(linha);
        linha = palavra;
      } else linha = tentativa;
    }
    linhas.push(linha);
  }
  return linhas;
}

function ajustar(
  ctx: CanvasRenderingContext2D, texto: string, maximo: number, minimo: number, largura: number, altura: number,
): { tamanho: number; linhas: string[] } {
  for (let tamanho = maximo; tamanho > minimo; tamanho -= 2) {
    ctx.font = `700 ${tamanho}px ${MAO}`;
    const linhas = quebrar(ctx, texto, largura);
    if (linhas.length * tamanho * 1.12 <= altura) return { tamanho, linhas };
  }
  ctx.font = `700 ${minimo}px ${MAO}`;
  return { tamanho: minimo, linhas: quebrar(ctx, texto, largura) };
}

/** Papel: gradiente suave, fibras e guilhoché bem claro. */
function papel(ctx: CanvasRenderingContext2D, l: number, a: number, claro: string, escuro: string, semente: number): void {
  const fundo = ctx.createLinearGradient(0, 0, l, a);
  fundo.addColorStop(0, claro);
  fundo.addColorStop(1, escuro);
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, l, a);
  const sorte = aleatorio(semente);
  ctx.fillStyle = "rgba(140, 13, 69, 0.04)";
  for (let i = 0; i < (l * a) / 900; i++) ctx.fillRect(sorte() * l, sorte() * a, 1 + sorte() * 2.4, 1);
}

function guilhoche(ctx: CanvasRenderingContext2D, l: number, a: number, cor: string, alfa: number, passo: number): void {
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = cor;
  ctx.globalAlpha = alfa;
  for (let linha = 0; linha * passo < a + passo * 2; linha++) {
    ctx.beginPath();
    for (let x = 0; x <= l; x += 10) {
      const y = linha * passo + Math.sin(x / 90 + linha * 0.7) * passo * 0.5 + Math.sin(x / 27 + linha) * 7;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---------- A carta ----------

export function cartaFrente(d: DadosPapel, logos: Logos): HTMLCanvasElement {
  const [c, ctx] = tela(CARTA_L, CARTA_A);
  papel(ctx, CARTA_L, CARTA_A, "#fffbf4", "#fdf1ea", 31);
  guilhoche(ctx, CARTA_L, CARTA_A, MAGENTA, 0.05, 78);

  const margem = 150;
  // Cabeçalho: estrela, título e para quem é.
  ctx.drawImage(silhueta(logos.magenta, MAGENTA, 118), margem, 118);
  ctx.fillStyle = MAGENTA_ESCURO;
  ctx.font = `700 36px ${TEXTO}`;
  ctx.letterSpacing = "9px";
  ctx.fillText("CARTA PARA O FUTURO", margem + 156, 168);
  ctx.letterSpacing = "0px";
  ctx.strokeStyle = "rgba(184, 19, 92, 0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(margem, 262);
  ctx.lineTo(CARTA_L - margem, 262);
  ctx.stroke();

  ctx.fillStyle = TINTA;
  ctx.font = `700 78px ${MAO}`;
  ctx.fillText("Para: eu, cientista", margem, 360);
  ctx.fillStyle = TINTA_SUAVE;
  ctx.font = `400 34px ${TEXTO}`;
  const quando = d.revela ? `para abrir em ${dataPorExtenso(d.revela)}` : d.anos ? `para abrir daqui a ${d.anos} ${d.anos === 1 ? "ano" : "anos"}` : "escolha em quantos anos abrir";
  ctx.fillText(quando, margem, 412);

  // Corpo: a mensagem fica na textura só quando a carta vai ser dobrada ou lida de longe.
  if (d.textoNoPapel) {
    ctx.fillStyle = TINTA;
    const corpo = ajustar(ctx, d.mensagem || "…", 84, 34, CARTA_L - margem * 2, d.objetivos ? 1050 : 1250);
    corpo.linhas.forEach((linha, i) => ctx.fillText(linha, margem, 500 + corpo.tamanho * 0.9 + i * corpo.tamanho * 1.12));
    if (d.objetivos) {
      ctx.fillStyle = MAGENTA_ESCURO;
      const ps = ajustar(ctx, `P.S. ${d.objetivos}`, 60, 30, CARTA_L - margem * 2, 330);
      ps.linhas.forEach((linha, i) => ctx.fillText(linha, margem, 1620 + ps.tamanho * 0.9 + i * ps.tamanho * 1.12));
    }
    ctx.fillStyle = TINTA;
    ctx.font = `700 70px ${MAO}`;
    ctx.textAlign = "right";
    ctx.fillText(d.nome || "", CARTA_L - margem, CARTA_A - 190);
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = `400 32px ${TEXTO}`;
    ctx.fillText(d.area || "", CARTA_L - margem, CARTA_A - 140);
    ctx.textAlign = "left";
  } else {
    // Escrevendo: linhas finas onde a pessoa vai escrever (o texto é um campo HTML por cima).
    ctx.strokeStyle = "rgba(140, 13, 69, 0.34)";
    ctx.lineWidth = 2;
    for (let y = 540; y < 1560; y += 82) {
      ctx.beginPath();
      ctx.moveTo(margem, y);
      ctx.lineTo(CARTA_L - margem, y);
      ctx.stroke();
    }
  }
  return c;
}

export function cartaVerso(logos: Logos): HTMLCanvasElement {
  const [c, ctx] = tela(CARTA_L, CARTA_A);
  papel(ctx, CARTA_L, CARTA_A, "#fff8f0", "#f9e8de", 47);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(silhueta(logos.magenta, "#d9b6c4", 220), CARTA_L / 2 - 110, CARTA_A / 2 - 120);
  ctx.globalAlpha = 1;
  return c;
}

// ---------- Envelope: o lado da aba ----------

/** Costas do envelope: papel rosa com as abas laterais e a de baixo marcadas, como num envelope de verdade. */
export function envelopeCostas(): HTMLCanvasElement {
  const [c, ctx] = tela(ENV_L, ENV_A);
  papel(ctx, ENV_L, ENV_A, "#f9d6e4", "#f2bfd4", 5);
  const cx = ENV_L / 2, cy = ENV_A * 0.42;
  // As três abas dobradas: sombras bem suaves e filetes.
  const triangulo = (pontos: Array<[number, number]>, cor: string): void => {
    ctx.fillStyle = cor;
    ctx.beginPath();
    pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  triangulo([[0, 0], [cx, cy], [0, ENV_A]], "rgba(184, 19, 92, 0.07)");
  triangulo([[ENV_L, 0], [cx, cy], [ENV_L, ENV_A]], "rgba(184, 19, 92, 0.07)");
  triangulo([[0, ENV_A], [cx, cy], [ENV_L, ENV_A]], "rgba(255, 255, 255, 0.13)");
  ctx.strokeStyle = "rgba(140, 13, 69, 0.28)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(cx, cy);
  ctx.lineTo(ENV_L, 0);
  ctx.moveTo(0, ENV_A);
  ctx.lineTo(cx, cy);
  ctx.lineTo(ENV_L, ENV_A);
  ctx.stroke();
  return c;
}

/** Fora da aba: um rosa mais profundo que o do corpo, com sombreado até a ponta e filete nas bordas inclinadas. */
export function abaFora(): HTMLCanvasElement {
  const [c, ctx] = tela(ENV_L, 760);
  papel(ctx, ENV_L, 760, "#f3b1cc", "#e68db3", 9);
  const sombra = ctx.createLinearGradient(0, 0, 0, 760);
  sombra.addColorStop(0, "rgba(255, 255, 255, 0.18)");
  sombra.addColorStop(1, "rgba(140, 13, 69, 0.22)");
  ctx.fillStyle = sombra;
  ctx.fillRect(0, 0, ENV_L, 760);
  // O triângulo da aba ocupa o canto de cima até o ponto de baixo, no meio: o filete segue essas duas bordas.
  ctx.strokeStyle = "rgba(110, 8, 55, 0.55)";
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(ENV_L / 2, 760);
  ctx.lineTo(ENV_L, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 220, 236, 0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(14, 8);
  ctx.lineTo(ENV_L / 2, 730);
  ctx.lineTo(ENV_L - 14, 8);
  ctx.stroke();
  return c;
}

/** Dentro da aba: forro de segurança, como nos envelopes de cartas importantes. */
export function abaDentro(): HTMLCanvasElement {
  const [c, ctx] = tela(ENV_L, 760);
  const fundo = ctx.createLinearGradient(0, 0, ENV_L, 760);
  fundo.addColorStop(0, MAGENTA);
  fundo.addColorStop(1, MAGENTA_ESCURO);
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, ENV_L, 760);
  guilhoche(ctx, ENV_L, 760, "#ffd3e4", 0.22, 34);
  return c;
}

// ---------- Envelope: o lado do endereço ----------

export function envelopeFrente(d: DadosPapel, logos: Logos): HTMLCanvasElement {
  const [c, ctx] = tela(ENV_L, ENV_A);
  papel(ctx, ENV_L, ENV_A, "#fffaf2", "#f9ece2", 13);
  guilhoche(ctx, ENV_L, ENV_A, MAGENTA, 0.035, 60);
  // Filete duplo nas bordas, como correspondência aérea.
  ctx.strokeStyle = "rgba(184, 19, 92, 0.4)";
  ctx.lineWidth = 6;
  for (let x = 0; x < ENV_L; x += 64) {
    ctx.fillStyle = x % 128 ? "rgba(46, 107, 214, 0.55)" : "rgba(216, 27, 96, 0.55)";
    ctx.save();
    ctx.translate(x, 0);
    ctx.transform(1, 0, -0.5, 1, 0, 0);
    ctx.fillRect(0, 0, 34, 20);
    ctx.fillRect(0, ENV_A - 20, 34, 20);
    ctx.restore();
  }

  // Endereço, em letra de mão.
  ctx.fillStyle = TINTA_SUAVE;
  ctx.font = `700 34px ${TEXTO}`;
  ctx.letterSpacing = "6px";
  ctx.fillText("PARA", 190, 520);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = TINTA;
  const nome = d.nome ? `${d.nome}, cientista` : "Eu, cientista";
  ctx.font = `700 150px ${MAO}`;
  let tamanho = 150;
  while (ctx.measureText(nome).width > 900 && tamanho > 70) {
    tamanho -= 6;
    ctx.font = `700 ${tamanho}px ${MAO}`;
  }
  ctx.fillText(nome, 190, 650);
  ctx.font = `700 74px ${MAO}`;
  ctx.fillStyle = MAGENTA_ESCURO;
  const destino = d.revela ? `Chega em ${dataPorExtenso(d.revela)}` : d.anos ? `Daqui a ${d.anos} ${d.anos === 1 ? "ano" : "anos"}` : "";
  ctx.fillText(destino, 190, 770);
  ctx.strokeStyle = "rgba(102, 82, 74, 0.35)";
  ctx.lineWidth = 3;
  for (const y of [690, 810]) {
    ctx.beginPath();
    ctx.moveTo(190, y);
    ctx.lineTo(1080, y);
    ctx.stroke();
  }
  ctx.fillStyle = TINTA_SUAVE;
  ctx.font = `400 32px ${TEXTO}`;
  ctx.fillText(d.area ? `Futura cientista em ${d.area.toLowerCase()}` : "Futura cientista", 190, 880);

  // Selo postal no canto, com a estrela da marca.
  const sx = ENV_L - 470, sy = 120, sl = 300, sa = 380;
  ctx.fillStyle = "#fff";
  ctx.fillRect(sx, sy, sl, sa);
  const interno = ctx.createLinearGradient(sx, sy, sx + sl, sy + sa);
  interno.addColorStop(0, MAGENTA);
  interno.addColorStop(1, MAGENTA_ESCURO);
  ctx.fillStyle = interno;
  ctx.fillRect(sx + 20, sy + 20, sl - 40, sa - 40);
  ctx.drawImage(silhueta(logos.creme, "#fff2e8", 170), sx + sl / 2 - 85, sy + 70);
  ctx.fillStyle = "#fff2e8";
  ctx.textAlign = "center";
  ctx.font = `700 30px ${TEXTO}`;
  ctx.letterSpacing = "6px";
  ctx.fillText("CIÊNCIA", sx + sl / 2 + 3, sy + 300);
  ctx.letterSpacing = "0px";
  ctx.font = `400 22px ${TEXTO}`;
  ctx.fillText("AstrAce", sx + sl / 2, sy + 336);
  ctx.textAlign = "left";
  // Picote: recorta bolinhas na borda do selo (devolve o papel por baixo).
  ctx.fillStyle = "#fffaf2";
  for (let i = 0; i <= 12; i++) {
    for (const [x, y] of [[sx + (i * sl) / 12, sy], [sx + (i * sl) / 12, sy + sa]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i <= 15; i++) {
    for (const [x, y] of [[sx, sy + (i * sa) / 15], [sx + sl, sy + (i * sa) / 15]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = TINTA_SUAVE;
  ctx.font = `700 26px ${TEXTO}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("CORREIO DO FUTURO · ASTRACE", 190, ENV_A - 110);
  ctx.letterSpacing = "0px";
  return c;
}

/** Carimbo do correio: anel com texto, data no meio e as ondas que cancelam o selo. Tinta sobre transparente. */
export function carimboPostal(data: string): HTMLCanvasElement {
  const [c, ctx] = tela(900, 480);
  const cx = 640, cy = 240, r = 170;
  ctx.strokeStyle = "rgba(60, 18, 52, 0.82)";
  ctx.fillStyle = "rgba(60, 18, 52, 0.82)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 24, 0, Math.PI * 2);
  ctx.stroke();
  // Texto em arco no anel de cima e de baixo.
  const arco = (texto: string, de: number, ate: number, raio: number, baixo: boolean): void => {
    ctx.font = `700 34px ${TEXTO}`;
    const passo = (ate - de) / (texto.length - 1 || 1);
    for (let i = 0; i < texto.length; i++) {
      const ang = de + i * passo;
      ctx.save();
      ctx.translate(cx + Math.cos(ang) * raio, cy + Math.sin(ang) * raio);
      ctx.rotate(ang + (baixo ? -Math.PI / 2 : Math.PI / 2));
      ctx.textAlign = "center";
      ctx.fillText(texto[i], 0, 0);
      ctx.restore();
    }
  };
  arco("ASTRACE · CORREIO", Math.PI * 1.1, Math.PI * 1.9, r - 52, false);
  arco("DO FUTURO", Math.PI * 0.82, Math.PI * 0.18, r - 40, true);
  ctx.textAlign = "center";
  ctx.font = `700 46px ${TEXTO}`;
  ctx.fillText(data, cx, cy + 14);
  ctx.textAlign = "left";
  // Ondas de cancelamento, saindo do carimbo para a esquerda.
  ctx.lineWidth = 8;
  for (let linha = 0; linha < 5; linha++) {
    const y = 130 + linha * 55;
    ctx.beginPath();
    for (let x = 30; x <= 460; x += 8) {
      const yy = y + Math.sin(x / 26 + linha) * 12;
      if (x === 30) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  return c;
}

// ---------- Selo de cera ----------

/** Cor e relevo do selo: a estrela da marca em baixo-relevo, com um anel em volta. */
export function seloDeCera(logos: Logos): { cor: HTMLCanvasElement; relevo: HTMLCanvasElement } {
  const t = 512;
  const [cor, ctx] = tela(t, t);
  const disco = ctx.createRadialGradient(t * 0.4, t * 0.35, 20, t / 2, t / 2, t * 0.5);
  disco.addColorStop(0, "#e23d7b");
  disco.addColorStop(0.7, "#b8135c");
  disco.addColorStop(1, "#7a0b3c");
  ctx.fillStyle = disco;
  ctx.fillRect(0, 0, t, t);
  ctx.strokeStyle = "rgba(255, 210, 228, 0.55)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(t / 2, t / 2, t * 0.38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.drawImage(silhueta(logos.creme, "rgba(255, 226, 238, 0.85)", t * 0.46), t * 0.27, t * 0.26);

  const [relevo, r] = tela(t, t);
  r.fillStyle = "#808080";
  r.fillRect(0, 0, t, t);
  r.strokeStyle = "#fff";
  r.lineWidth = 14;
  r.beginPath();
  r.arc(t / 2, t / 2, t * 0.38, 0, Math.PI * 2);
  r.stroke();
  r.drawImage(silhueta(logos.creme, "#ffffff", t * 0.46), t * 0.27, t * 0.26);
  return { cor, relevo };
}
