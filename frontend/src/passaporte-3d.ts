// Passaporte 3D: capa de couro rosa com arte metalizada, folhas que viram de verdade em torno da
// lombada (com curvatura do papel) e um carimbo de borracha que desce, imprime e sobe.
// Three.js do CDN com versão fixa (o mesmo da landing), carregado só quando há WebGL.
import * as Paginas from "./passaporte-paginas.js";

const URL_THREE = "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js";

// Sem os tipos do pacote (não há bundler nem dependência de three no projeto).
type Three = any;

// Medidas em unidades da cena. Folha 88 x 125 mm, como um passaporte.
const FOLHA_L = 1.25;
const FOLHA_A = 1.76;
const CAPA_L = 1.3;
const CAPA_A = 1.82;
const CAPA_E = 0.024; // espessura da capa
const FOLHA_E = 0.006; // distância entre folhas na pilha
const BLOCO_E = 0.03; // as outras páginas, que não viram

const COR_COURO = 0x9c1250;
const COR_METAL = 0xffd3e4;

export interface Controle {
  /** Folhas viradas: 0 = fechado, 1 = capa aberta, ..., N = última página. */
  readonly viradas: number;
  readonly total: number;
  /** No celular, a página em foco ("esq" ou "dir"); no desktop, null (as duas aparecem). */
  readonly lado: "esq" | "dir" | null;
  proxima(): void;
  anterior(): void;
}

interface Opcoes {
  dados: Paginas.Dados;
  carimboNovo: boolean; // a animação do carimbo de boas-vindas ainda não passou
  aoMudar(viradas: number): void;
  aoCarimbar(): void;
  /** Chamado no próprio clique que começa a abrir a capa (dá para pedir tela cheia aqui). */
  aoAbrir?(): void;
}

// ---------- Movimento ----------

const suave = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const saida = (t: number): number => 1 - Math.pow(1 - t, 3);
const entrada = (t: number): number => t * t;
const misturar = (a: number, b: number, t: number): number => a + (b - a) * t;

interface Tween {
  duracao: number;
  passo(t: number): void;
  fim?(): void;
  inicio: number;
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = falha;
    img.src = url;
  });
}

// ---------- Peças ----------

function retangulo(T: Three, l: number, a: number, r: number): Three {
  const s = new T.Shape();
  s.moveTo(0, -a / 2);
  s.lineTo(l - r, -a / 2);
  s.quadraticCurveTo(l, -a / 2, l, -a / 2 + r);
  s.lineTo(l, a / 2 - r);
  s.quadraticCurveTo(l, a / 2, l - r, a / 2);
  s.lineTo(0, a / 2);
  s.closePath();
  return s;
}

/** Textura de granulado de couro, usada como relevo (bumpMap). */
function granuladoCouro(T: Three): Three {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  let s = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = 120 + (s % 90);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(3, 4);
  return tex;
}

function texturaDe(T: Three, canvas: HTMLCanvasElement, anisotropia: number, espelhada = false): Three {
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = anisotropia;
  if (espelhada) {
    // O verso da folha é visto "por trás": espelha para o texto ficar certo.
    tex.wrapS = T.RepeatWrapping;
    tex.repeat.x = -1;
    tex.offset.x = 1;
  }
  return tex;
}

/** Uma folha: plano dobrável (muitos segmentos) com frente e verso. Começa na lombada (x = 0). */
function folha(T: Three, frente: Three, verso: Three, segmentosY = 1): Three {
  const geometria = new T.PlaneGeometry(FOLHA_L, FOLHA_A, 28, segmentosY);
  geometria.translate(FOLHA_L / 2, 0, 0);
  const original = Float32Array.from(geometria.attributes.position.array);
  const papel = { roughness: 0.92, metalness: 0 };
  const malhaFrente = new T.Mesh(geometria, new T.MeshStandardMaterial({ ...papel, map: frente, side: T.FrontSide }));
  const malhaVerso = new T.Mesh(geometria, new T.MeshStandardMaterial({ ...papel, map: verso, side: T.BackSide }));
  for (const m of [malhaFrente, malhaVerso]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  const grupo = new T.Group();
  grupo.add(malhaFrente, malhaVerso);
  grupo.userData = { geometria, original };
  return grupo;
}

/** Curva o papel durante a virada: a borda solta fica para trás, como uma folha de verdade. */
function curvar(grupo: Three, p: number, sentido: number, afundar: { u: number; v: number; forca: number } | null): void {
  const { geometria, original } = grupo.userData;
  const pos = geometria.attributes.position;
  const curva = Math.sin(p * Math.PI) * 0.22 * sentido;
  for (let i = 0; i < pos.count; i++) {
    const x = original[i * 3];
    const y = original[i * 3 + 1];
    const u = x / FOLHA_L;
    let z = -curva * u * u;
    if (afundar) {
      const dx = u - afundar.u, dy = (0.5 - y / FOLHA_A) - afundar.v; // v conta de cima para baixo
      z -= afundar.forca * Math.exp(-(dx * dx + dy * dy) / 0.012);
    }
    pos.setXYZ(i, x * (1 - Math.abs(curva) * 0.06 * u), y, z);
  }
  pos.needsUpdate = true;
  geometria.computeVertexNormals();
}

function criarCarimbo(T: Three): Three {
  const grupo = new T.Group();
  const lado = 0.5;
  // Borracha (a parte que toca o papel).
  const borracha = new T.Mesh(
    new T.BoxGeometry(lado, lado, 0.035),
    new T.MeshStandardMaterial({ color: 0x5a0a2c, roughness: 0.8 }),
  );
  borracha.position.z = 0.0175;
  // Base de madeira laqueada rosa, com cantos chanfrados.
  const base = new T.Mesh(
    new T.ExtrudeGeometry(retanguloCentrado(T, lado + 0.04, lado + 0.04, 0.05), {
      depth: 0.08, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3,
    }),
    new T.MeshPhysicalMaterial({ color: 0xff7eb3, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  );
  base.position.z = 0.05;
  // Pescoço e pegador.
  const madeira = new T.MeshPhysicalMaterial({ color: 0xc98a5b, roughness: 0.55, clearcoat: 0.4 });
  const pescoco = new T.Mesh(new T.CylinderGeometry(0.055, 0.075, 0.2, 24), madeira);
  pescoco.rotation.x = Math.PI / 2;
  pescoco.position.z = 0.25;
  const pegador = new T.Mesh(new T.SphereGeometry(0.13, 32, 20), madeira);
  pegador.scale.set(1, 1, 0.85);
  pegador.position.z = 0.43;
  for (const m of [borracha, base, pescoco, pegador]) {
    m.castShadow = true;
    grupo.add(m);
  }
  grupo.visible = false;
  return grupo;
}

function retanguloCentrado(T: Three, l: number, a: number, r: number): Three {
  const s = new T.Shape();
  const x = -l / 2, y = -a / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + l - r, y);
  s.quadraticCurveTo(x + l, y, x + l, y + r);
  s.lineTo(x + l, y + a - r);
  s.quadraticCurveTo(x + l, y + a, x + l - r, y + a);
  s.lineTo(x + r, y + a);
  s.quadraticCurveTo(x, y + a, x, y + a - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ---------- Montagem ----------

export async function montarPassaporte(palco: HTMLElement, opcoes: Opcoes): Promise<Controle | null> {
  let T: Three;
  try {
    T = await import(URL_THREE);
  } catch {
    return null;
  }
  let renderer: Three;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }

  // Fontes e imagens precisam estar prontas antes de desenhar as páginas.
  await Promise.all([
    document.fonts.load('700 100px "Caveat"'),
    document.fonts.load('400 30px "Atkinson Hyperlegible"'),
    document.fonts.load('700 30px "Atkinson Hyperlegible"'),
  ]).catch(() => undefined);
  const [logoCreme, logoMagenta, foto] = await Promise.all([
    carregarImagem("/static/img/logo-estrela-creme.png"),
    carregarImagem("/static/img/logo-estrela-magenta.png"),
    opcoes.dados.foto_url ? carregarImagem(opcoes.dados.foto_url).catch(() => null) : Promise.resolve(null),
  ]);

  const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const anis = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const cena = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 50);

  cena.add(new T.HemisphereLight(0xfff6fb, 0xc49a6c, 1.25));
  const luz = new T.DirectionalLight(0xfff1e6, 2.4);
  luz.position.set(-2.2, 2.6, 5);
  luz.castShadow = true;
  luz.shadow.mapSize.set(2048, 2048);
  for (const [lado, v] of [["left", -3.5], ["right", 3.5], ["top", 3.5], ["bottom", -3.5]] as const) luz.shadow.camera[lado] = v;
  luz.shadow.radius = 6;
  luz.shadow.bias = -0.0006;
  luz.shadow.normalBias = 0.01;
  cena.add(luz);
  const preenchimento = new T.DirectionalLight(0xffc4dc, 0.6);
  preenchimento.position.set(3, -1, 3);
  cena.add(preenchimento);

  // O quadro de cortiça do site fica atrás (no CSS); aqui só recebemos a sombra nele.
  const chao = new T.Mesh(new T.PlaneGeometry(14, 14), new T.ShadowMaterial({ color: 0x3f2618, opacity: 0.32 }));
  chao.position.z = -0.002;
  chao.receiveShadow = true;
  cena.add(chao);

  const livro = new T.Group();
  cena.add(livro);

  // ----- Texturas das páginas -----
  const canvasBoasVindas = Paginas.paginaBoasVindas(1);
  const carimbo = opcoes.dados.carimbos.find((c) => c.codigo === "boas-vindas");
  if (carimbo && !opcoes.carimboNovo) Paginas.imprimirCarimbo(canvasBoasVindas, logoMagenta, carimbo.concedido_em);
  const texBoasVindas = texturaDe(T, canvasBoasVindas, anis);

  // ----- Contracapa (fixa) -----
  const couro = new T.MeshPhysicalMaterial({
    color: COR_COURO, roughness: 0.62, sheen: 0.5, sheenColor: new T.Color(0xff9cc6), bumpMap: granuladoCouro(T), bumpScale: 0.6,
  });
  const geoCapa = new T.ExtrudeGeometry(retangulo(T, CAPA_L, CAPA_A, 0.07), {
    depth: CAPA_E, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 6,
  });
  geoCapa.translate(0, 0, -CAPA_E / 2);
  const contracapa = new T.Mesh(geoCapa, couro);
  contracapa.position.z = CAPA_E / 2;
  contracapa.castShadow = contracapa.receiveShadow = true;
  livro.add(contracapa);
  const fundoFinal = new T.Mesh(
    new T.PlaneGeometry(FOLHA_L, FOLHA_A),
    new T.MeshStandardMaterial({ map: texturaDe(T, Paginas.contracapa(logoMagenta), anis), roughness: 0.92 }),
  );
  fundoFinal.position.set(FOLHA_L / 2 + 0.02, 0, CAPA_E + 0.0015);
  fundoFinal.receiveShadow = true;
  livro.add(fundoFinal);

  // Bloco das outras páginas (as que não viram), com a borda de papel visível.
  const bordaPapel = new T.MeshStandardMaterial({ color: 0xfdeef4, roughness: 0.95 });
  const blocoDireito = new T.Mesh(new T.BoxGeometry(FOLHA_L - 0.01, FOLHA_A - 0.01, BLOCO_E), bordaPapel);
  blocoDireito.position.set(FOLHA_L / 2 + 0.02, 0, CAPA_E + BLOCO_E / 2 + 0.002);
  blocoDireito.castShadow = blocoDireito.receiveShadow = true;
  livro.add(blocoDireito);
  fundoFinal.position.z = CAPA_E + BLOCO_E + 0.003;

  // Lombada.
  const lombada = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, CAPA_A, 16, 1, false, Math.PI, Math.PI), couro);
  lombada.position.set(0, 0, CAPA_E + BLOCO_E / 2);
  lombada.scale.set(1, 1, 1.4);
  livro.add(lombada);

  // ----- Peças que viram: capa e duas folhas -----
  const base = CAPA_E + BLOCO_E + 0.006;
  interface Viravel { grupo: Three; pivo: Three; p: number; zDireita: number; zEsquerda: number; folha: boolean }
  const viraveis: Viravel[] = [];

  // Capa da frente: couro + arte metalizada por fora + página de identidade por dentro.
  const capaGrupo = new T.Group();
  const capaMalha = new T.Mesh(geoCapa, couro);
  capaMalha.castShadow = capaMalha.receiveShadow = true;
  const arte = new T.Mesh(
    new T.PlaneGeometry(CAPA_L * 0.94, CAPA_A * 0.94),
    new T.MeshPhysicalMaterial({
      map: texturaDe(T, Paginas.capa(logoCreme), anis), transparent: true, color: COR_METAL,
      metalness: 0.75, roughness: 0.28, clearcoat: 0.4, depthWrite: false,
    }),
  );
  arte.position.set(CAPA_L / 2, 0, CAPA_E / 2 + 0.006); // acima do bisel da capa
  const dentro = new T.Mesh(
    new T.PlaneGeometry(FOLHA_L, FOLHA_A),
    new T.MeshStandardMaterial({ map: texturaDe(T, Paginas.identidade(opcoes.dados, foto), anis, true), roughness: 0.92, side: T.BackSide }),
  );
  dentro.position.set(FOLHA_L / 2 + 0.02, 0, -CAPA_E / 2 - 0.006);
  dentro.receiveShadow = true;
  capaGrupo.add(capaMalha, arte, dentro);

  const folha1 = folha(T, texBoasVindas, texturaDe(T, Paginas.paginaEventos(2, 31, "Eventos"), anis, true), 24);
  const folha2 = folha(
    T, texturaDe(T, Paginas.paginaEventos(3, 37, null), anis), texturaDe(T, Paginas.paginaAnotacoes(4), anis, true),
  );

  const pecas = [
    { grupo: capaGrupo, folha: false },
    { grupo: folha1, folha: true },
    { grupo: folha2, folha: true },
  ];
  pecas.forEach((peca, k) => {
    const pivo = new T.Group();
    pivo.add(peca.grupo);
    if (peca.folha) peca.grupo.position.x = 0.02;
    livro.add(pivo);
    const n = pecas.length;
    viraveis.push({
      grupo: peca.grupo, pivo, p: 0, folha: peca.folha,
      // Na direita, a capa fica por cima; na esquerda, quem virou primeiro fica por baixo
      // (a capa deita no quadro e as folhas viradas deitam sobre ela).
      zDireita: base + (n - 1 - k) * FOLHA_E + (peca.folha ? 0 : CAPA_E / 2 + 0.002),
      // (a página de dentro da capa fica em CAPA_E + 0,008: as folhas deitam um pouco acima dela)
      zEsquerda: peca.folha ? CAPA_E + 0.012 + k * FOLHA_E : CAPA_E / 2 + 0.002,
    });
  });

  const carimboObjeto = criarCarimbo(T);
  livro.add(carimboObjeto);

  // ----- Aplicar estado -----
  let afundamento: { u: number; v: number; forca: number } | null = null;
  let sentidoAtual = 1;

  const aplicar = (k: number): void => {
    const v = viraveis[k];
    v.pivo.rotation.y = -Math.PI * v.p;
    v.pivo.position.z = misturar(v.zDireita, v.zEsquerda, v.p) + Math.sin(v.p * Math.PI) * 0.05;
    if (v.folha) curvar(v.grupo, v.p, sentidoAtual, k === 1 ? afundamento : null);
  };
  viraveis.forEach((_, k) => aplicar(k));

  // ----- Câmera: enquadra o passaporte fechado ou aberto -----
  const enquadre = { x: CAPA_L / 2, largura: CAPA_L };
  const posicionarCamera = (): void => {
    const aspecto = camera.aspect;
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspecto);
    // Folga mínima: o passaporte ocupa quase o palco todo, sem cortar as bordas.
    const distLargura = (enquadre.largura * 0.525) / Math.tan(hfov / 2);
    const distAltura = (CAPA_A * 0.55) / Math.tan(vfov / 2); // a perspectiva aumenta a borda de baixo
    const d = Math.max(distLargura, distAltura);
    // Um pouco de baixo, como quem olha um passaporte sobre a mesa.
    camera.position.set(enquadre.x, -d * 0.17, d * 0.985);
    camera.lookAt(enquadre.x, 0.04, 0);
  };

  // Tela estreita (celular em pé): aberto, mostra uma página de cada vez, para dar para ler.
  let foco = false;
  let lado: "esq" | "dir" = "esq";
  let viradas = 0; // folhas viradas
  let ocupado = false; // algo está se mexendo: novos cliques esperam
  const enquadreAberto = (): { x: number; largura: number } =>
    foco ? { x: lado === "esq" ? -FOLHA_L / 2 : FOLHA_L / 2 + 0.04, largura: CAPA_L * 1.06 } : { x: 0, largura: CAPA_L * 2 };

  palco.appendChild(renderer.domElement);
  const ajustar = (): void => {
    const { width, height } = palco.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    foco = camera.aspect < 0.85;
    if (viradas > 0 && !ocupado) Object.assign(enquadre, enquadreAberto());
    posicionarCamera();
    desenhar();
  };

  // ----- Laço de animação (só roda enquanto algo se mexe) -----
  const tweens: Tween[] = [];
  let quadro = 0;
  const desenhar = (): void => renderer.render(cena, camera);
  const loop = (agora: number): void => {
    quadro = 0;
    for (const tw of [...tweens]) {
      const t = Math.min(1, (agora - tw.inicio) / tw.duracao);
      tw.passo(t);
      if (t >= 1) {
        tweens.splice(tweens.indexOf(tw), 1);
        tw.fim?.();
      }
    }
    desenhar();
    if (tweens.length) quadro = requestAnimationFrame(loop);
  };
  const animar = (duracao: number, passo: (t: number) => void, fim?: () => void): void => {
    if (semMovimento) {
      passo(1);
      fim?.();
      desenhar();
      return;
    }
    tweens.push({ duracao, passo, fim, inicio: performance.now() });
    if (!quadro) quadro = requestAnimationFrame(loop);
  };

  new ResizeObserver(ajustar).observe(palco);
  ajustar();

  // ----- Virar -----

  const virar = (k: number, para: number, pronto?: () => void): void => {
    const v = viraveis[k];
    const de = v.p;
    sentidoAtual = para > de ? 1 : -1;
    ocupado = true;
    const abrindoCapa = k === 0;
    const enquadreDe = { ...enquadre };
    if (foco) lado = para > de ? "esq" : "dir"; // depois de virar, a leitura recomeça pela página certa
    const enquadreAte = para > 0 || k > 0 ? enquadreAberto() : { x: CAPA_L / 2, largura: CAPA_L };
    const moverCamera = abrindoCapa || foco;
    animar(abrindoCapa ? 1100 : 850, (t) => {
      const e = suave(t);
      v.p = misturar(de, para, e);
      if (moverCamera) {
        enquadre.x = misturar(enquadreDe.x, enquadreAte.x, e);
        enquadre.largura = misturar(enquadreDe.largura, enquadreAte.largura, e);
        posicionarCamera();
      }
      aplicar(k);
    }, () => {
      ocupado = false;
      opcoes.aoMudar(viradas);
      pronto?.();
    });
  };

  /** Só no modo de uma página por vez: desliza a câmera para a outra página. */
  const irPara = (novo: "esq" | "dir", pronto?: () => void): void => {
    lado = novo;
    ocupado = true;
    const de = { ...enquadre };
    const ate = enquadreAberto();
    animar(550, (t) => {
      const e = suave(t);
      enquadre.x = misturar(de.x, ate.x, e);
      enquadre.largura = misturar(de.largura, ate.largura, e);
      posicionarCamera();
    }, () => {
      ocupado = false;
      opcoes.aoMudar(viradas);
      pronto?.();
    });
  };

  // ----- Carimbo de boas-vindas -----
  let precisaCarimbar = opcoes.carimboNovo && Boolean(carimbo);
  const carimbar = (): void => {
    precisaCarimbar = false;
    if (!carimbo) return;
    if (semMovimento) {
      Paginas.imprimirCarimbo(canvasBoasVindas, logoMagenta, carimbo.concedido_em);
      texBoasVindas.needsUpdate = true;
      desenhar();
      opcoes.aoCarimbar();
      return;
    }
    ocupado = true;
    const alvoX = 0.02 + Paginas.LUGAR_BOAS_VINDAS.u * FOLHA_L;
    const alvoY = (0.5 - Paginas.LUGAR_BOAS_VINDAS.v) * FOLHA_A;
    const papelZ = viraveis[1].zDireita;
    const s = carimboObjeto;
    s.visible = true;
    const fora = { x: alvoX + 1.4, y: alvoY + 1.1, z: papelZ + 1.3 };
    const sobre = { x: alvoX, y: alvoY, z: papelZ + 0.55 };
    s.position.set(fora.x, fora.y, fora.z);
    s.rotation.set(0.5, -0.4, 0.5);

    // 1) chega e se posiciona sobre a página
    animar(800, (t) => {
      const e = saida(t);
      s.position.set(misturar(fora.x, sobre.x, e), misturar(fora.y, sobre.y, e), misturar(fora.z, sobre.z, e));
      // Mesma inclinação da impressão (no canvas o y cresce para baixo, por isso o sinal muda).
      s.rotation.set(misturar(0.5, 0, e), misturar(-0.4, 0, e), misturar(0.5, 0.12, e));
    }, () => {
      // 2) desce até o papel
      animar(260, (t) => {
        s.position.z = misturar(sobre.z, papelZ + 0.002, entrada(t));
      }, () => {
        // 3) contato: tinta no papel, borracha amassa, o papel cede e o livro sente o impacto
        Paginas.imprimirCarimbo(canvasBoasVindas, logoMagenta, carimbo.concedido_em);
        texBoasVindas.needsUpdate = true;
        animar(380, (t) => {
          const impacto = Math.sin(t * Math.PI);
          s.scale.set(1 + impacto * 0.03, 1 + impacto * 0.03, 1 - impacto * 0.1);
          afundamento = { ...Paginas.LUGAR_BOAS_VINDAS, forca: impacto * 0.012 };
          livro.position.z = -impacto * 0.008;
          aplicar(1);
        }, () => {
          afundamento = null;
          livro.position.z = 0;
          s.scale.set(1, 1, 1);
          aplicar(1);
          // 4) sobe e vai embora, deixando a impressão
          animar(700, (t) => {
            const e = saida(t);
            s.position.set(misturar(alvoX, fora.x, entrada(t)), misturar(alvoY, fora.y, entrada(t)), misturar(papelZ, fora.z, e));
            s.rotation.z = misturar(0.12, 0.4, e);
          }, () => {
            s.visible = false;
            ocupado = false;
            opcoes.aoCarimbar();
          });
        });
      });
    });
  };

  const controle: Controle = {
    get viradas() { return viradas; },
    total: viraveis.length,
    get lado() { return foco && viradas > 0 ? lado : null; },
    proxima() {
      if (ocupado) return;
      if (foco && viradas > 0 && lado === "esq") return irPara("dir");
      if (viradas >= viraveis.length) return;
      const k = viradas;
      if (k === 0) opcoes.aoAbrir?.();
      viradas += 1;
      virar(k, 1, () => {
        if (k === 0 && precisaCarimbar) {
          if (foco) irPara("dir", carimbar); // no celular, primeiro mostra a página que vai receber o carimbo
          else carimbar();
        }
      });
    },
    anterior() {
      if (ocupado || viradas <= 0) return;
      if (foco && lado === "dir") return irPara("esq");
      viradas -= 1;
      virar(viradas, 0);
    },
  };

  // ----- Toque e clique: capa abre; metade direita avança; metade esquerda volta -----
  const raio = new T.Raycaster();
  const ponto = new T.Vector2();
  let inicioToque: { x: number; y: number; t: number } | null = null;
  const tela = renderer.domElement;
  tela.style.touchAction = "pan-y";
  tela.addEventListener("pointerdown", (e: PointerEvent) => {
    inicioToque = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  tela.addEventListener("pointerup", (e: PointerEvent) => {
    if (!inicioToque) return;
    const dx = e.clientX - inicioToque.x;
    const dy = e.clientY - inicioToque.y;
    inicioToque = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) controle.proxima();
      else controle.anterior();
      return;
    }
    const caixa = tela.getBoundingClientRect();
    ponto.set(((e.clientX - caixa.left) / caixa.width) * 2 - 1, -((e.clientY - caixa.top) / caixa.height) * 2 + 1);
    raio.setFromCamera(ponto, camera);
    const acerto = raio.intersectObject(livro, true)[0];
    if (!acerto) return;
    if (viradas === 0) controle.proxima();
    else if (foco && acerto.point.x >= 0 && lado === "esq") irPara("dir"); // toque na outra página: vai até ela
    else if (foco && acerto.point.x < 0 && lado === "dir") irPara("esq");
    else if (acerto.point.x >= 0) controle.proxima();
    else controle.anterior();
  });
  tela.addEventListener("pointermove", (e: PointerEvent) => {
    const caixa = tela.getBoundingClientRect();
    ponto.set(((e.clientX - caixa.left) / caixa.width) * 2 - 1, -((e.clientY - caixa.top) / caixa.height) * 2 + 1);
    raio.setFromCamera(ponto, camera);
    tela.style.cursor = raio.intersectObject(livro, true).length ? "pointer" : "default";
  });

  palco.classList.add("passaporte-palco--3d");
  return controle;
}
