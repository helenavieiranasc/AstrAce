// Mascote 3D da landing: a estrela da logo (static/img/logo-estrela-original.png) andando com o notebook.
// Peças: corpo de estrela de pontas irregulares, rosto (olhos fechados, sorriso, risquinhos nas bochechas),
// um braço digitando, a outra mão segurando a tampa, notebook com coração, pernas em passo e três tracinhos.
// O Three.js vem do CDN com versão fixa e só carrega quando há WebGL.

const URL_THREE = "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js";

// Sem os tipos do pacote (não há bundler nem dependência de three no projeto).
type Three = any;
type Ponto = [number, number, number];

const COR_CORPO = 0xff7eb3;
const COR_MEMBROS = 0xf2619d; // um tom abaixo do corpo, para o braço aparecer sobre a estrela
const COR_TRACO = 0x8c0d45;
const COR_NOTEBOOK = 0xfff8f0;
const COR_CORACAO = 0xd81b60;
const COR_TRACINHOS = 0xe0447f;

/** Estrela de cinco pontas desenhada à mão: cada ponta com ângulo e tamanho próprios, cantos arredondados. */
function formaDaEstrela(T: Three): Three {
  // [ângulo em graus, raio] das pontas, no sentido anti-horário a partir da direita.
  const pontas: Array<[number, number]> = [
    [22, 0.92],
    [97, 1.05],
    [165, 1.12],
    [236, 1.0],
    [302, 0.86],
  ];
  const pontos: Array<{ x: number; y: number; ponta: boolean }> = [];
  pontas.forEach(([angulo, raio], i) => {
    const a = (angulo * Math.PI) / 180;
    pontos.push({ x: Math.cos(a) * raio, y: Math.sin(a) * raio, ponta: true });
    const proximo = pontas[(i + 1) % 5][0] + (i === 4 ? 360 : 0);
    const meio = (((angulo + proximo) / 2) * Math.PI) / 180;
    pontos.push({ x: Math.cos(meio) * 0.5, y: Math.sin(meio) * 0.5, ponta: false });
  });

  const forma = new T.Shape();
  pontos.forEach((canto, i) => {
    const anterior = pontos[(i + pontos.length - 1) % pontos.length];
    const proximo = pontos[(i + 1) % pontos.length];
    const t = canto.ponta ? 0.2 : 0.12;
    const entrada = [canto.x + (anterior.x - canto.x) * t, canto.y + (anterior.y - canto.y) * t];
    const saida = [canto.x + (proximo.x - canto.x) * t, canto.y + (proximo.y - canto.y) * t];
    if (i === 0) forma.moveTo(entrada[0], entrada[1]);
    else forma.lineTo(entrada[0], entrada[1]);
    forma.quadraticCurveTo(canto.x, canto.y, saida[0], saida[1]);
  });
  forma.closePath();
  return forma;
}

function retanguloArredondado(T: Three, largura: number, altura: number, raio: number): Three {
  const x = -largura / 2;
  const y = -altura / 2;
  const forma = new T.Shape();
  forma.moveTo(x + raio, y);
  forma.lineTo(x + largura - raio, y);
  forma.quadraticCurveTo(x + largura, y, x + largura, y + raio);
  forma.lineTo(x + largura, y + altura - raio);
  forma.quadraticCurveTo(x + largura, y + altura, x + largura - raio, y + altura);
  forma.lineTo(x + raio, y + altura);
  forma.quadraticCurveTo(x, y + altura, x, y + altura - raio);
  forma.lineTo(x, y + raio);
  forma.quadraticCurveTo(x, y, x + raio, y);
  return forma;
}

function placa(T: Three, largura: number, altura: number, espessura: number, material: Three): Three {
  const geometria = new T.ExtrudeGeometry(retanguloArredondado(T, largura, altura, 0.06), {
    depth: espessura,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geometria.translate(0, 0, -espessura / 2);
  const malha = new T.Mesh(geometria, material);
  malha.castShadow = true;
  return malha;
}

function coracao(T: Three, tamanho: number, material: Three): Three {
  const s = tamanho;
  const forma = new T.Shape();
  forma.moveTo(0, -0.9 * s);
  forma.bezierCurveTo(-0.2 * s, -0.6 * s, -1 * s, -0.2 * s, -0.9 * s, 0.25 * s);
  forma.bezierCurveTo(-0.8 * s, 0.75 * s, -0.15 * s, 0.8 * s, 0, 0.35 * s);
  forma.bezierCurveTo(0.15 * s, 0.8 * s, 0.8 * s, 0.75 * s, 0.9 * s, 0.25 * s);
  forma.bezierCurveTo(1 * s, -0.2 * s, 0.2 * s, -0.6 * s, 0, -0.9 * s);
  const geometria = new T.ExtrudeGeometry(forma, {
    depth: 0.01,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 12,
  });
  return new T.Mesh(geometria, material);
}

function tubo(T: Three, pontos: Ponto[], raio: number, material: Three): Three {
  const curva = new T.CatmullRomCurve3(pontos.map((p) => new T.Vector3(...p)));
  const malha = new T.Mesh(new T.TubeGeometry(curva, 32, raio, 10, false), material);
  malha.castShadow = true;
  // Pontas arredondadas, para o tubo não acabar cortado.
  for (const p of [pontos[0], pontos[pontos.length - 1]]) {
    const tampa = new T.Mesh(new T.SphereGeometry(raio, 12, 8), material);
    tampa.position.set(...p);
    malha.add(tampa);
  }
  return malha;
}

function arco(T: Three, cx: number, cy: number, z: number, raio: number, de: number, ate: number, material: Three): Three {
  const pontos: Ponto[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = de + ((ate - de) * i) / 12;
    pontos.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio, z]);
  }
  return tubo(T, pontos, 0.02, material);
}

/** Mão: uma bolinha com três dedinhos. */
function mao(T: Three, material: Three, viradaPara: number): Three {
  const grupo = new T.Group();
  const palma = new T.Mesh(new T.SphereGeometry(0.1, 16, 12), material);
  palma.scale.set(1, 0.85, 0.8);
  palma.castShadow = true;
  grupo.add(palma);
  for (let i = 0; i < 3; i++) {
    const dedo = new T.Mesh(new T.CapsuleGeometry(0.028, 0.05, 4, 8), material);
    const a = viradaPara + (i - 1) * 0.45;
    dedo.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.02);
    dedo.rotation.z = a - Math.PI / 2;
    grupo.add(dedo);
  }
  return grupo;
}

function criarMascote(T: Three): Three {
  const mascote = new T.Group();
  mascote.name = "mascote";

  const corpoMat = new T.MeshPhysicalMaterial({
    color: COR_CORPO,
    roughness: 0.42,
    clearcoat: 0.5,
    clearcoatRoughness: 0.35,
    sheen: 0.6,
    sheenColor: new T.Color(0xffd6e8),
  });
  const membroMat = new T.MeshPhysicalMaterial({ color: COR_MEMBROS, roughness: 0.45, clearcoat: 0.35 });
  const tracoMat = new T.MeshStandardMaterial({ color: COR_TRACO, roughness: 0.6 });

  // ----- Corpo -----
  const profundidade = 0.12;
  const chanfro = 0.22;
  const geometriaCorpo = new T.ExtrudeGeometry(formaDaEstrela(T), {
    depth: profundidade,
    bevelEnabled: true,
    bevelThickness: chanfro,
    bevelSize: 0.18,
    bevelSegments: 10,
    curveSegments: 24,
  });
  geometriaCorpo.translate(0, 0, -profundidade / 2);
  const corpo = new T.Mesh(geometriaCorpo, corpoMat);
  corpo.name = "corpo";
  corpo.castShadow = true;
  mascote.add(corpo);

  // ----- Rosto (na face da frente, um pouco à direita: a estrela anda para a direita) -----
  const frente = profundidade / 2 + chanfro + 0.01;
  const rosto = new T.Group();
  rosto.name = "rosto";
  rosto.add(arco(T, -0.1, 0.24, frente, 0.075, Math.PI * 0.12, Math.PI * 0.88, tracoMat));
  rosto.add(arco(T, 0.27, 0.28, frente, 0.075, Math.PI * 0.12, Math.PI * 0.88, tracoMat));
  rosto.add(arco(T, 0.09, 0.15, frente, 0.1, Math.PI * 1.15, Math.PI * 1.85, tracoMat));
  // Risquinhos das bochechas, dois de cada lado.
  for (const [x, y] of [[-0.34, 0.1], [-0.27, 0.11], [0.45, 0.2], [0.52, 0.22]]) {
    const risco = new T.Mesh(new T.CapsuleGeometry(0.014, 0.05, 4, 6), tracoMat);
    risco.position.set(x, y, frente);
    risco.rotation.z = -0.35;
    rosto.add(risco);
  }
  mascote.add(rosto);

  // ----- Notebook, na frente da parte de baixo, à direita -----
  const notebook = new T.Group();
  notebook.name = "notebook";
  const notebookMat = new T.MeshStandardMaterial({ color: COR_NOTEBOOK, roughness: 0.5 });
  const base = placa(T, 0.9, 0.55, 0.04, notebookMat);
  base.rotation.x = -Math.PI / 2; // deitada
  base.name = "base";
  notebook.add(base);
  const tampa = new T.Group();
  tampa.name = "tampa";
  tampa.position.set(0, 0, 0.275); // dobradiça na borda da frente
  tampa.rotation.x = -0.22; // aberta, inclinada para longe de quem digita
  const tela = placa(T, 0.9, 0.68, 0.035, notebookMat);
  tela.position.y = 0.34;
  tampa.add(tela);
  const coracaoMat = new T.MeshStandardMaterial({ color: COR_CORACAO, roughness: 0.4 });
  const simbolo = coracao(T, 0.1, coracaoMat);
  simbolo.position.set(0.02, 0.38, 0.03);
  tampa.add(simbolo);
  notebook.add(tampa);
  notebook.position.set(0.66, -0.5, 0.5);
  notebook.rotation.set(0.18, -0.42, -0.22);
  mascote.add(notebook);

  // Mão que segura a tampa pelo lado direito. Fica atrás da tampa (do lado da tela), para não cobrir a frente do notebook.
  const maoTampa = mao(T, membroMat, 0);
  maoTampa.position.set(0.34, 0.24, -0.09);
  tampa.add(maoTampa);

  mascote.updateMatrixWorld(true);
  const ondeEsta = (objeto: Three): Ponto => {
    const v = objeto.getWorldPosition(new T.Vector3());
    return [v.x, v.y, v.z];
  };

  // ----- Braços -----
  // Braço da esquerda cruza a barriga e digita no teclado.
  const teclado: Ponto = ondeEsta(base).map((v, i) => v + [-0.12, 0.06, -0.05][i]) as Ponto;
  mascote.add(tubo(T, [[-0.62, -0.18, 0.18], [-0.42, -0.4, 0.34], [-0.12, -0.46, 0.44], teclado], 0.065, membroMat));
  const maoTeclado = mao(T, membroMat, -Math.PI / 2);
  maoTeclado.position.set(...teclado);
  mascote.add(maoTeclado);
  // Braço da direita sai do corpo e vai até a mão na tampa (quase todo escondido atrás dela).
  const naTampa = ondeEsta(maoTampa);
  mascote.add(tubo(T, [[0.62, 0.02, 0.12], [0.85, -0.1, 0.3], naTampa], 0.06, membroMat));

  // ----- Pernas em passo e pés -----
  const pernas: Array<{ pontos: Ponto[]; pe: Ponto; giro: number }> = [
    { pontos: [[-0.3, -0.55, 0], [-0.42, -0.95, 0.05], [-0.66, -1.3, 0.08]], pe: [-0.76, -1.38, 0.1], giro: 0.35 },
    { pontos: [[0.12, -0.55, 0], [0.3, -0.95, 0.1], [0.5, -1.34, 0.14]], pe: [0.62, -1.42, 0.16], giro: -0.15 },
  ];
  for (const perna of pernas) {
    mascote.add(tubo(T, perna.pontos, 0.095, membroMat));
    const pe = new T.Mesh(new T.SphereGeometry(1, 20, 14), membroMat);
    pe.scale.set(0.25, 0.14, 0.17);
    pe.position.set(...perna.pe);
    pe.rotation.z = perna.giro;
    pe.castShadow = true;
    mascote.add(pe);
  }

  // ----- Tracinhos de animação, no alto à direita -----
  const tracinhoMat = new T.MeshStandardMaterial({ color: COR_TRACINHOS, roughness: 0.5 });
  for (const [x, y, giro] of [[1.0, 0.98, -0.5], [1.2, 0.74, -0.9], [1.28, 0.47, -1.45]]) {
    const tracinho = new T.Mesh(new T.CapsuleGeometry(0.035, 0.14, 4, 8), tracinhoMat);
    tracinho.position.set(x, y, 0.05);
    tracinho.rotation.z = giro;
    tracinho.castShadow = true;
    mascote.add(tracinho);
  }

  // Centraliza a figura inteira (dos tracinhos aos pés) no grupo de fora, que é o que se move.
  const caixa = new T.Box3().setFromObject(mascote);
  const centro = caixa.getCenter(new T.Vector3());
  mascote.position.sub(centro);
  const grupo = new T.Group();
  grupo.add(mascote);
  return grupo;
}

export async function montarEstrela(palco: HTMLElement): Promise<boolean> {
  let T: Three;
  try {
    T = await import(URL_THREE);
  } catch {
    return false; // sem internet ou CDN fora do ar: fica a estrela desenhada
  }

  let renderer: Three;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return false; // sem WebGL
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const cena = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 5.9);

  cena.add(new T.HemisphereLight(0xfff6fb, 0xc49a6c, 1.4));
  const luz = new T.DirectionalLight(0xfff1e6, 2.6);
  luz.position.set(-2.4, 3.2, 4);
  luz.castShadow = true;
  luz.shadow.mapSize.set(1024, 1024);
  luz.shadow.camera.left = -4;
  luz.shadow.camera.right = 4;
  luz.shadow.camera.top = 4;
  luz.shadow.camera.bottom = -4;
  luz.shadow.camera.far = 20;
  luz.shadow.radius = 6;
  luz.shadow.bias = -0.0008;
  cena.add(luz);
  const contraluz = new T.DirectionalLight(0xffc4dc, 1.3);
  contraluz.position.set(2.6, -1.2, -2);
  cena.add(contraluz);

  // Plano invisível que só recebe a sombra, como se a mascote flutuasse sobre a cortiça.
  const fundo = new T.Mesh(new T.PlaneGeometry(12, 12), new T.ShadowMaterial({ color: 0x3f2618, opacity: 0.3 }));
  fundo.position.z = -0.75;
  fundo.receiveShadow = true;
  cena.add(fundo);

  const estrela = criarMascote(T);
  cena.add(estrela);

  palco.appendChild(renderer.domElement);

  const ajustar = (): void => {
    const { width, height } = palco.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  ajustar();
  new ResizeObserver(ajustar).observe(palco);

  const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const inclinacaoBase = -0.06;
  if (semMovimento) {
    estrela.rotation.set(0.04, -0.18, inclinacaoBase);
    renderer.render(cena, camera);
    palco.classList.add("palco-estrela--3d");
    return true;
  }

  // O ponteiro vira a mascote de leve, na direção de quem olha.
  const alvo = { x: 0, y: 0 };
  window.addEventListener(
    "pointermove",
    (evento) => {
      alvo.x = (evento.clientX / window.innerWidth - 0.5) * 2;
      alvo.y = (evento.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true },
  );
  const atual = { x: 0, y: 0 };

  let visivel = true;
  let quadro = 0;
  const inicio = performance.now();
  const saidaExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

  const desenhar = (agora: number): void => {
    quadro = 0;
    const t = (agora - inicio) / 1000;
    const entrada = saidaExpo(Math.min(t / 1.4, 1));

    atual.x += (alvo.x - atual.x) * 0.05;
    atual.y += (alvo.y - atual.y) * 0.05;

    estrela.scale.setScalar(0.86 + 0.14 * entrada);
    estrela.rotation.y = (1 - entrada) * -0.8 + Math.sin(t * 0.55) * 0.22 + atual.x * 0.28;
    estrela.rotation.x = Math.sin(t * 0.7) * 0.04 + atual.y * 0.16;
    estrela.rotation.z = inclinacaoBase + Math.sin(t * 1.6) * 0.03; // balanço do passo
    estrela.position.y = Math.abs(Math.sin(t * 1.6)) * 0.06;

    renderer.render(cena, camera);
    if (visivel && !document.hidden) quadro = requestAnimationFrame(desenhar);
  };

  const retomar = (): void => {
    if (!quadro && visivel && !document.hidden) quadro = requestAnimationFrame(desenhar);
  };
  new IntersectionObserver(([registro]) => {
    visivel = registro.isIntersecting;
    retomar();
  }).observe(palco);
  document.addEventListener("visibilitychange", retomar);

  quadro = requestAnimationFrame(desenhar);
  palco.classList.add("palco-estrela--3d");
  return true;
}
