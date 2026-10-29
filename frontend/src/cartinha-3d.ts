// Cartinha 3D da página inicial: um envelope de papel que balança devagar. Com o mouse (ou o foco) em cima,
// a aba abre e a folha sobe, como na carta do perfil. Mesmo Three.js do CDN do avião; só carrega com WebGL.

const URL_THREE = "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js";

// Sem os tipos do pacote (não há bundler nem dependência de three no projeto).
type Three = any;

const LARGURA = 1.9;
const ALTURA = 1.3;
const COR_CORPO = 0xffd9e8;
const COR_LADOS = 0xf6bdd4;
const COR_BAIXO = 0xffc9de;
const COR_ABA = 0xe7a0be;
const COR_LACRE = 0x8c0d45;
const COR_BORDA = 0x8c0d45;

function triangulo(T: Three, pontos: Array<[number, number]>, cor: number): Three {
  const forma = new T.Shape();
  forma.moveTo(pontos[0][0], pontos[0][1]);
  forma.lineTo(pontos[1][0], pontos[1][1]);
  forma.lineTo(pontos[2][0], pontos[2][1]);
  forma.closePath();
  const geometria = new T.ShapeGeometry(forma);
  const malha = new T.Mesh(geometria, new T.MeshStandardMaterial({ color: cor, roughness: 0.85, side: T.DoubleSide }));
  malha.add(
    new T.LineSegments(
      new T.EdgesGeometry(geometria),
      new T.LineBasicMaterial({ color: COR_BORDA, transparent: true, opacity: 0.4 }),
    ),
  );
  return malha;
}

/** A folha de dentro: papel branco pautado, que sobe quando a aba abre. */
function criarFolha(T: Three): Three {
  const tela = document.createElement("canvas");
  tela.width = 128;
  tela.height = 96;
  const ctx = tela.getContext("2d")!;
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = "rgba(184, 19, 92, 0.35)";
  ctx.lineWidth = 2;
  for (let y = 20; y < 92; y += 12) {
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(118, y);
    ctx.stroke();
  }
  const textura = new T.CanvasTexture(tela);
  textura.colorSpace = T.SRGBColorSpace;
  return new T.Mesh(
    new T.PlaneGeometry(LARGURA * 0.86, ALTURA * 0.86),
    new T.MeshStandardMaterial({ map: textura, roughness: 0.9, side: T.DoubleSide }),
  );
}

function criarEnvelope(T: Three): { grupo: Three; aba: Three; folha: Three; lacre: Three } {
  const grupo = new T.Group();
  const w = LARGURA / 2;
  const h = ALTURA / 2;

  // Corpo: uma placa fina, a "parte de trás" do envelope.
  const corpo = new T.Mesh(
    new T.BoxGeometry(LARGURA, ALTURA, 0.04),
    new T.MeshStandardMaterial({ color: COR_CORPO, roughness: 0.85 }),
  );
  grupo.add(corpo);

  // A folha fica entre o corpo e os bolsos da frente.
  const folha = criarFolha(T);
  folha.position.set(0, -0.02, 0.022);
  grupo.add(folha);

  // Frente: três triângulos formando o "V" do bolso.
  const esquerda = triangulo(T, [[-w, h], [-w, -h], [0, -0.02]], COR_LADOS);
  const direita = triangulo(T, [[w, h], [w, -h], [0, -0.02]], COR_LADOS);
  const baixo = triangulo(T, [[-w, -h], [w, -h], [0, -0.02]], COR_BAIXO);
  for (const t of [esquerda, direita, baixo]) {
    t.position.z = 0.03;
    grupo.add(t);
  }

  // Aba de cima: gira em volta da borda de cima.
  const aba = new T.Group();
  aba.position.set(0, h, 0.034);
  const abaMalha = triangulo(T, [[-w, 0], [w, 0], [0, -h * 1.1]], COR_ABA);
  aba.add(abaMalha);
  grupo.add(aba);

  // Lacre de cera: preso à ponta da aba, então abre junto com ela.
  const lacre = new T.Mesh(
    new T.CylinderGeometry(0.16, 0.16, 0.035, 28),
    new T.MeshStandardMaterial({ color: COR_LACRE, roughness: 0.5 }),
  );
  lacre.rotation.x = Math.PI / 2;
  lacre.position.set(0, -h * 1.0, 0.025);
  aba.add(lacre);

  return { grupo, aba, folha, lacre };
}

export async function montarCartinha(palco: HTMLElement): Promise<boolean> {
  let T: Three;
  try {
    T = await import(URL_THREE);
  } catch {
    return false;
  }
  let renderer: Three;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = T.NeutralToneMapping;

  const cena = new T.Scene();
  const camera = new T.PerspectiveCamera(28, 1.45, 0.1, 20);
  camera.position.set(0, 0.1, 4.5);

  cena.add(new T.HemisphereLight(0xfff6fb, 0xc49a6c, 1.6));
  const luz = new T.DirectionalLight(0xfff1e6, 2);
  luz.position.set(-2, 3, 4);
  cena.add(luz);

  const { grupo, aba, folha } = criarEnvelope(T);
  grupo.rotation.x = -0.28; // visto um pouco de cima
  cena.add(grupo);

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

  // 0 = fechada, 1 = aberta.
  let abertura = 0;
  let alvoAbertura = 0;
  const aplicar = (): void => {
    aba.rotation.x = abertura * 2.7; // a aba vira para trás
    folha.position.y = -0.02 + abertura * 0.62; // a folha sobe e aparece para fora do envelope
  };

  const pai = palco.closest("a") ?? palco;
  const abrir = (): void => { alvoAbertura = 1; retomar(); };
  const fechar = (): void => { alvoAbertura = 0; retomar(); };
  pai.addEventListener("pointerenter", abrir);
  pai.addEventListener("pointerleave", fechar);
  pai.addEventListener("focusin", abrir);
  pai.addEventListener("focusout", fechar);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    grupo.rotation.y = -0.3;
    renderer.render(cena, camera);
    palco.classList.add("inicio-cartinha--3d");
    return true;
  }

  const chegou = palco.closest(".inicio-cartinha--chegou") !== null;
  let visivel = true;
  let quadro = 0;
  const inicio = performance.now();
  let anterior = inicio;

  const desenhar = (agora: number): void => {
    quadro = 0;
    const dt = Math.min((agora - anterior) / 1000, 0.1);
    anterior = agora;
    const t = (agora - inicio) / 1000;

    abertura += (alvoAbertura - abertura) * Math.min(dt * 7, 1);
    aplicar();

    // Balança devagar; com a carta chegada, o balanço é maior e a aba dá uma "espiada".
    const forca = chegou ? 0.5 : 0.28;
    grupo.rotation.y = Math.sin(t * 0.9) * forca - 0.12;
    grupo.rotation.z = Math.sin(t * 0.7) * (chegou ? 0.08 : 0.03);
    grupo.position.y = Math.sin(t * 1.3) * 0.05;
    if (chegou && alvoAbertura === 0) {
      abertura = Math.max(abertura, (Math.sin(t * 2.2) + 1) * 0.06);
      aplicar();
    }

    renderer.render(cena, camera);
    if (visivel && !document.hidden) quadro = requestAnimationFrame(desenhar);
  };
  function retomar(): void {
    if (!quadro && visivel && !document.hidden) {
      anterior = performance.now();
      quadro = requestAnimationFrame(desenhar);
    }
  }
  new IntersectionObserver(([registro]) => {
    visivel = registro.isIntersecting;
    retomar();
  }).observe(palco);
  document.addEventListener("visibilitychange", retomar);

  quadro = requestAnimationFrame(desenhar);
  palco.classList.add("inicio-cartinha--3d");
  return true;
}
