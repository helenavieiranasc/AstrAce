// Páginas do passaporte desenhadas em canvas (viram texturas no 3D).
// Papel rosado com guilhoché, como os fundos de segurança de um passaporte de verdade.
export const LARGURA = 1000;
export const ALTURA = 1408; // mesma proporção da folha (1,25 x 1,76)
const TINTA = "#2a1c15";
const TINTA_SUAVE = "#66524a";
const MAGENTA = "#b8135c";
const MAGENTA_ESCURO = "#8c0d45";
const MAO = '"Caveat", "Segoe Print", cursive';
const TEXTO = '"Atkinson Hyperlegible", system-ui, sans-serif';
function tela() {
    const canvas = document.createElement("canvas");
    canvas.width = LARGURA;
    canvas.height = ALTURA;
    return [canvas, canvas.getContext("2d")];
}
/** Gerador de números com semente fixa, para o papel sair igual em todo acesso. */
function aleatorio(semente) {
    let s = semente;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}
/** Papel: fundo rosado, fibras, guilhoché fino e número da página. */
function papel(ctx, numero, semente) {
    const fundo = ctx.createLinearGradient(0, 0, LARGURA, ALTURA);
    fundo.addColorStop(0, "#fff7fa");
    fundo.addColorStop(1, "#fdeef4");
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    const sorte = aleatorio(semente);
    ctx.fillStyle = "rgba(140, 13, 69, 0.035)";
    for (let i = 0; i < 2600; i++)
        ctx.fillRect(sorte() * LARGURA, sorte() * ALTURA, 1 + sorte() * 2, 1);
    // Guilhoché: ondas que se cruzam, bem claras.
    ctx.lineWidth = 1.2;
    for (let linha = 0; linha < 26; linha++) {
        ctx.strokeStyle = linha % 2 ? "rgba(216, 27, 96, 0.07)" : "rgba(126, 63, 180, 0.05)";
        ctx.beginPath();
        for (let x = 0; x <= LARGURA; x += 8) {
            const y = 120 + linha * 48 + Math.sin(x / 70 + linha * 0.7) * 22 + Math.sin(x / 23 + linha) * 6;
            if (x === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    // Margem impressa.
    ctx.strokeStyle = "rgba(184, 19, 92, 0.25)";
    ctx.lineWidth = 3;
    ctx.strokeRect(46, 46, LARGURA - 92, ALTURA - 92);
    if (numero !== null) {
        ctx.fillStyle = TINTA_SUAVE;
        ctx.font = `700 30px ${TEXTO}`;
        ctx.textAlign = "center";
        ctx.fillText(String(numero), LARGURA / 2, ALTURA - 72);
        ctx.textAlign = "left";
    }
}
function titulo(ctx, texto, y = 170) {
    ctx.fillStyle = MAGENTA_ESCURO;
    ctx.font = `700 104px ${MAO}`;
    ctx.textAlign = "center";
    ctx.fillText(texto, LARGURA / 2, y);
    ctx.textAlign = "left";
}
function cortarTexto(ctx, texto, largura) {
    if (ctx.measureText(texto).width <= largura)
        return texto;
    let cortado = texto;
    while (cortado.length > 1 && ctx.measureText(`${cortado}…`).width > largura)
        cortado = cortado.slice(0, -1);
    return `${cortado}…`;
}
function linhasDeTexto(ctx, texto, x, y, largura, altura) {
    let linha = "";
    for (const palavra of texto.split(" ")) {
        const tentativa = linha ? `${linha} ${palavra}` : palavra;
        if (ctx.measureText(tentativa).width > largura && linha) {
            ctx.fillText(linha, x, y);
            linha = palavra;
            y += altura;
        }
        else
            linha = tentativa;
    }
    if (linha)
        ctx.fillText(linha, x, y);
}
/** Desenha a logo só como silhueta de uma cor (para tinta e para o hot-stamping da capa). */
function silhueta(imagem, cor, largura) {
    const altura = (imagem.height / imagem.width) * largura;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(largura);
    canvas.height = Math.ceil(altura);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imagem, 0, 0, largura, altura);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = cor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
}
// ---------- Capa ----------
/** Arte da capa em branco sobre transparente: a cor vem do material metalizado no 3D. */
export function capa(logo) {
    const [canvas, ctx] = tela();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `700 46px ${TEXTO}`;
    ctx.letterSpacing = "18px";
    ctx.fillText("PASSAPORTE", LARGURA / 2 + 9, 260);
    ctx.letterSpacing = "0px";
    ctx.drawImage(silhueta(logo, "#fff", 470), LARGURA / 2 - 235, 400);
    ctx.font = `700 150px ${TEXTO}`;
    ctx.fillText("AstrAce", LARGURA / 2, 1130);
    ctx.font = `400 38px ${TEXTO}`;
    ctx.fillText("ciência feita por meninas e mulheres", LARGURA / 2, 1210);
    // Moldura dupla de filete.
    ctx.lineWidth = 4;
    ctx.strokeRect(90, 90, LARGURA - 180, ALTURA - 180);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(108, 108, LARGURA - 216, ALTURA - 216);
    return canvas;
}
// ---------- Página de identidade (verso da capa) ----------
export function identidade(dados, foto) {
    const [canvas, ctx] = tela();
    papel(ctx, null, 11);
    ctx.fillStyle = MAGENTA;
    ctx.font = `700 34px ${TEXTO}`;
    ctx.letterSpacing = "8px";
    ctx.fillText("ASTRACE · PASSAPORTE", 96, 150);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = `400 30px ${TEXTO}`;
    ctx.fillText(`nº ${dados.numero}`, 96, 196);
    // Foto 3x4 (ou a inicial).
    const fx = 96, fy = 250, fw = 300, fh = 390;
    ctx.fillStyle = "#fbd3e3";
    ctx.fillRect(fx, fy, fw, fh);
    if (foto) {
        const escala = Math.max(fw / foto.width, fh / foto.height);
        const w = foto.width * escala, h = foto.height * escala;
        ctx.save();
        ctx.beginPath();
        ctx.rect(fx, fy, fw, fh);
        ctx.clip();
        ctx.drawImage(foto, fx + (fw - w) / 2, fy + (fh - h) / 2, w, h);
        ctx.restore();
    }
    else {
        ctx.fillStyle = MAGENTA_ESCURO;
        ctx.font = `700 230px ${MAO}`;
        ctx.textAlign = "center";
        ctx.fillText((dados.nome[0] ?? "?").toLocaleUpperCase("pt-BR"), fx + fw / 2, fy + fh / 2 + 80);
        ctx.textAlign = "left";
    }
    ctx.strokeStyle = "rgba(42, 28, 21, 0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(fx, fy, fw, fh);
    // Campos.
    const campos = [
        ["Nome", dados.nome],
        ["Fase dos estudos", dados.nivel],
        ["Área", dados.area],
        ["Membro desde", dados.membro_desde],
    ];
    let y = 290;
    const cx = 440, largura = LARGURA - cx - 96;
    for (const [rotulo, valor] of campos) {
        if (!valor)
            continue;
        ctx.fillStyle = TINTA_SUAVE;
        ctx.font = `700 26px ${TEXTO}`;
        ctx.fillText(rotulo.toUpperCase(), cx, y);
        ctx.fillStyle = TINTA;
        ctx.font = `700 46px ${TEXTO}`;
        ctx.fillText(cortarTexto(ctx, valor, largura), cx, y + 54);
        y += 116;
    }
    y = 740;
    for (const [rotulo, valor] of [["Instituição", dados.instituicao], ["Cidade", dados.local]]) {
        if (!valor)
            continue;
        ctx.fillStyle = TINTA_SUAVE;
        ctx.font = `700 26px ${TEXTO}`;
        ctx.fillText(rotulo.toUpperCase(), 96, y);
        ctx.fillStyle = TINTA;
        ctx.font = `700 44px ${TEXTO}`;
        ctx.fillText(cortarTexto(ctx, valor, LARGURA - 192), 96, y + 52);
        y += 116;
    }
    // Assinatura à mão.
    ctx.fillStyle = MAGENTA_ESCURO;
    ctx.font = `700 76px ${MAO}`;
    ctx.fillText(cortarTexto(ctx, dados.nome, 520), 96, 1080);
    ctx.strokeStyle = "rgba(42, 28, 21, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(96, 1100);
    ctx.lineTo(620, 1100);
    ctx.stroke();
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = `400 24px ${TEXTO}`;
    ctx.fillText("assinatura", 96, 1132);
    // Linhas de leitura de máquina (MRZ), como num passaporte de verdade.
    const nomeMrz = dados.nome_completo
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase()
        .replace(/[^A-Z]+/g, "<");
    const mrz1 = `P<AST${nomeMrz}`.padEnd(40, "<").slice(0, 40);
    const mrz2 = `${dados.numero}<<CIENCIA<DELAS`.padEnd(40, "<").slice(0, 40);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillRect(56, 1196, LARGURA - 112, 140);
    ctx.fillStyle = TINTA;
    ctx.font = `400 36px ui-monospace, "Cascadia Mono", Consolas, monospace`;
    ctx.fillText(mrz1, 80, 1252);
    ctx.fillText(mrz2, 80, 1310);
    return canvas;
}
// ---------- Páginas de carimbos ----------
function lugarVazio(ctx, x, y, raio, texto) {
    ctx.save();
    ctx.setLineDash([10, 12]);
    ctx.strokeStyle = "rgba(184, 19, 92, 0.32)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(102, 82, 74, 0.7)";
    ctx.font = `700 40px ${MAO}`;
    ctx.textAlign = "center";
    ctx.fillText(texto, x, y + 12);
    ctx.textAlign = "left";
}
/** Onde o carimbo de boas-vindas cai: centro em (u, v) da folha, de 0 a 1. */
export const LUGAR_BOAS_VINDAS = { u: 0.5, v: 0.47 };
/** Os dois lugares embaixo do carimbo de boas-vindas: recebem os dois primeiros carimbos de evento. */
export const LUGARES_NA_BOAS_VINDAS = 2;
export function paginaBoasVindas(numero, carimbos = [], logo = null) {
    const [canvas, ctx] = tela();
    papel(ctx, numero, 23);
    titulo(ctx, "Carimbos");
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = `400 34px ${TEXTO}`;
    ctx.textAlign = "center";
    ctx.fillText("Cada carimbo é um pedaço da sua jornada.", LARGURA / 2, 240);
    ctx.textAlign = "left";
    for (let i = 0; i < LUGARES_NA_BOAS_VINDAS; i++) {
        const x = LARGURA * (0.27 + i * 0.46);
        const y = ALTURA * 0.83;
        if (carimbos[i])
            imprimirCarimboDeEvento(ctx, carimbos[i], logo, x, y);
        else
            lugarVazio(ctx, x, y, 120, "em breve");
    }
    return canvas;
}
/** Quantos carimbos de evento cabem numa página. */
export const CARIMBOS_POR_PAGINA = 4;
/** Página com até 4 carimbos de eventos (check-in pelo QR); os lugares que sobram ficam tracejados. */
export function paginaEventos(numero, semente, cabecalho, carimbos = [], logo = null) {
    const [canvas, ctx] = tela();
    papel(ctx, numero, semente);
    if (cabecalho) {
        titulo(ctx, cabecalho);
        ctx.fillStyle = TINTA_SUAVE;
        ctx.font = `400 34px ${TEXTO}`;
        const chamada = carimbos.length
            ? "Cada evento de que você participou deixa a sua marca aqui."
            : "Os carimbos dos eventos de que você participar vão aparecer aqui.";
        linhasDeTexto(ctx, chamada, 110, 250, LARGURA - 220, 46);
    }
    const topo = cabecalho ? 470 : 300;
    for (let i = 0; i < CARIMBOS_POR_PAGINA; i++) {
        const x = LARGURA * (0.29 + (i % 2) * 0.42);
        const y = topo + Math.floor(i / 2) * 360;
        const carimbo = carimbos[i];
        if (carimbo)
            imprimirCarimboDeEvento(ctx, carimbo, logo, x, y);
        else
            lugarVazio(ctx, x, y, 130, "próximo carimbo");
    }
    return canvas;
}
export function paginaAnotacoes(numero) {
    const [canvas, ctx] = tela();
    papel(ctx, numero, 41);
    titulo(ctx, "Anotações");
    ctx.strokeStyle = "rgba(184, 19, 92, 0.22)";
    ctx.lineWidth = 2;
    for (let y = 330; y < ALTURA - 160; y += 76) {
        ctx.beginPath();
        ctx.moveTo(100, y);
        ctx.lineTo(LARGURA - 100, y);
        ctx.stroke();
    }
    ctx.fillStyle = MAGENTA_ESCURO;
    ctx.font = `700 60px ${MAO}`;
    ctx.fillText("minha jornada na ciência", 110, 395);
    ctx.fillText("começa aqui.", 110, 471);
    return canvas;
}
export function contracapa(logo) {
    const [canvas, ctx] = tela();
    papel(ctx, null, 57);
    ctx.globalAlpha = 0.12;
    ctx.drawImage(silhueta(logo, MAGENTA, 640), LARGURA / 2 - 320, 300);
    ctx.globalAlpha = 1;
    ctx.fillStyle = MAGENTA_ESCURO;
    ctx.font = `700 110px ${MAO}`;
    ctx.textAlign = "center";
    ctx.fillText("Boa jornada!", LARGURA / 2, 1060);
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = `400 32px ${TEXTO}`;
    ctx.fillText("Este passaporte é pessoal e intransferível.", LARGURA / 2, 1140);
    ctx.textAlign = "left";
    return canvas;
}
// ---------- Impressão do carimbo (tinta no papel) ----------
/**
 * Carimbo de boas-vindas com a estrela da logo, como tinta: cor que falha em alguns
 * pontos, borda mais carregada e uma leve inclinação. Desenha direto no canvas da página.
 */
export function imprimirCarimbo(pagina, logo, data) {
    const lado = 400;
    const marca = document.createElement("canvas");
    marca.width = marca.height = lado;
    const m = marca.getContext("2d");
    m.fillStyle = MAGENTA;
    m.strokeStyle = MAGENTA;
    m.textAlign = "center";
    // Borda dupla arredondada.
    const borda = (inset, largura) => {
        m.lineWidth = largura;
        m.beginPath();
        m.roundRect(inset, inset, lado - inset * 2, lado - inset * 2, 34);
        m.stroke();
    };
    borda(10, 9);
    borda(28, 3);
    m.font = `700 34px ${TEXTO}`;
    m.letterSpacing = "6px";
    m.fillText("BEM-VINDA", lado / 2 + 3, 82);
    m.letterSpacing = "0px";
    m.drawImage(silhueta(logo, MAGENTA, 190), lado / 2 - 95, 100);
    m.font = `700 56px ${TEXTO}`;
    m.fillText("AstrAce", lado / 2, 336);
    m.font = `700 22px ${TEXTO}`;
    m.fillText(data.split("-").reverse().join("/"), lado / 2, 368);
    falhasDeTinta(m, lado, 97);
    const ctx = pagina.getContext("2d");
    const x = LUGAR_BOAS_VINDAS.u * LARGURA, y = LUGAR_BOAS_VINDAS.v * ALTURA;
    const tamanho = LARGURA * 0.4; // do tamanho da borracha do carimbo 3D
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.12);
    ctx.globalAlpha = 0.86;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(marca, -tamanho / 2, -tamanho / 2, tamanho, tamanho);
    ctx.restore();
}
/** Falhas de tinta: muitos pontinhos tirados e alguns riscos claros. */
function falhasDeTinta(m, lado, semente) {
    const sorte = aleatorio(semente);
    m.save();
    m.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 1800; i++) {
        m.globalAlpha = 0.25 + sorte() * 0.75;
        m.beginPath();
        m.arc(sorte() * lado, sorte() * lado, 0.6 + sorte() * 2.2, 0, Math.PI * 2);
        m.fill();
    }
    m.globalAlpha = 0.35;
    for (let i = 0; i < 6; i++) {
        const y = sorte() * lado;
        m.fillRect(0, y, lado, 1 + sorte() * 3);
    }
    m.restore();
}
// Cada evento ganha uma cor de tinta, como carimbos de países diferentes.
const TINTAS_DE_EVENTO = [MAGENTA, "#7e3fb4", "#17907f", "#2e6bd6", "#b5530b"];
/** Número fixo a partir do texto: o mesmo carimbo sai sempre com a mesma cor, inclinação e falhas. */
function hashDe(texto) {
    let h = 7;
    for (const ch of texto)
        h = (h * 31 + ch.charCodeAt(0)) % 2147483647;
    return h || 1;
}
/** Texto curvado num círculo: em cima, lido da esquerda para a direita; embaixo, também. */
function textoEmArco(m, texto, centro, raio, emCima, espaco = 4) {
    const letras = [...texto];
    const larguras = letras.map((ch) => m.measureText(ch).width + espaco);
    const angTotal = larguras.reduce((a, b) => a + b, 0) / raio;
    let ang = emCima ? -Math.PI / 2 - angTotal / 2 : Math.PI / 2 + angTotal / 2;
    m.textAlign = "center";
    m.textBaseline = "middle";
    letras.forEach((ch, i) => {
        const passo = larguras[i] / raio;
        const meio = emCima ? ang + passo / 2 : ang - passo / 2;
        m.save();
        m.translate(centro + raio * Math.cos(meio), centro + raio * Math.sin(meio));
        m.rotate(emCima ? meio + Math.PI / 2 : meio - Math.PI / 2);
        m.fillText(ch, 0, 0);
        m.restore();
        ang = emCima ? ang + passo : ang - passo;
    });
    m.textBaseline = "alphabetic";
}
/** Quebra o título em até 3 linhas que caibam na largura; a última ganha reticências se precisar. */
function linhasDoTitulo(m, texto, largura, maximo) {
    const linhas = [];
    let linha = "";
    const palavras = texto.split(/\s+/).filter(Boolean);
    for (let i = 0; i < palavras.length; i++) {
        const tentativa = linha ? `${linha} ${palavras[i]}` : palavras[i];
        if (m.measureText(tentativa).width <= largura || !linha) {
            linha = tentativa;
            continue;
        }
        linhas.push(linha);
        linha = palavras[i];
        if (linhas.length === maximo - 1) {
            linha = palavras.slice(i).join(" ");
            break;
        }
    }
    if (linha)
        linhas.push(linha);
    return linhas.map((l) => cortarTexto(m, l, largura));
}
/** Carimbo redondo de um evento, com o nome do evento e a data, impresso na página em (x, y). */
function imprimirCarimboDeEvento(ctx, carimbo, logo, x, y) {
    const lado = 400, centro = lado / 2;
    const h = hashDe(carimbo.codigo);
    const cor = TINTAS_DE_EVENTO[h % TINTAS_DE_EVENTO.length];
    const marca = document.createElement("canvas");
    marca.width = marca.height = lado;
    const m = marca.getContext("2d");
    m.fillStyle = cor;
    m.strokeStyle = cor;
    for (const [raio, largura] of [[186, 10], [166, 3], [118, 3]]) {
        m.lineWidth = largura;
        m.beginPath();
        m.arc(centro, centro, raio, 0, Math.PI * 2);
        m.stroke();
    }
    m.font = `700 26px ${TEXTO}`;
    textoEmArco(m, "EVENTO · ASTRACE", centro, 142, true, 5);
    m.font = `700 26px ${TEXTO}`;
    textoEmArco(m, carimbo.concedido_em.split("-").reverse().join("/"), centro, 142, false, 4);
    // Estrelinhas entre os dois textos curvos.
    m.font = `700 22px ${TEXTO}`;
    m.textAlign = "center";
    m.textBaseline = "middle";
    m.fillText("✦", centro - 142, centro);
    m.fillText("✦", centro + 142, centro);
    m.textBaseline = "alphabetic";
    if (logo)
        m.drawImage(silhueta(logo, cor, 62), centro - 31, 92);
    m.font = `700 46px ${MAO}`;
    m.textAlign = "center";
    const linhas = linhasDoTitulo(m, carimbo.titulo, 200, 3);
    const alturaLinha = 42;
    let ly = 224 - ((linhas.length - 1) * alturaLinha) / 2;
    for (const linha of linhas) {
        m.fillText(linha, centro, ly);
        ly += alturaLinha;
    }
    falhasDeTinta(m, lado, h);
    const tamanho = 300;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((h % 17) - 8) / 60); // cada carimbo cai com uma inclinação diferente
    ctx.globalAlpha = 0.86;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(marca, -tamanho / 2, -tamanho / 2, tamanho, tamanho);
    ctx.restore();
}
