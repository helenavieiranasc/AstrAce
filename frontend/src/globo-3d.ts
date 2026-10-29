// Globinho 3D da página inicial, que leva ao Mapa de Inspiração: a Terra em papel, girando devagar, com
// alguns pins rosa. A textura sai do mesmo desenho de países do mapa (/mapa/mundi.svg). Mesmo Three.js do
// CDN do avião; só carrega quando há WebGL.

const URL_THREE = "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js";

// Sem os tipos do pacote (não há bundler nem dependência de three no projeto).
type Three = any;

// A faixa de latitude do desenho (sem a Antártida). Tem que bater com app/templates/mapa_mundi.svg.
const LAT_NORTE = 84;
const LAT_SUL = -58;
const LARGURA_SVG = 1000;
const ALTURA_SVG = 394;

const OCEANO = "#ffc4dc";
const TERRA = "#fffaf3";
const CONTORNO = "#e7a8c4";
const COR_PIN = 0xb8135c;

// Algumas cidades para os pins [latitude, longitude]: só enfeite, espalhadas pelos continentes.
const PINS: Array<[number, number]> = [
  [-23.55, -46.63], // São Paulo
  [-8.05, -34.88], // Recife
  [-12.97, -38.5], // Salvador
  [6.52, 3.38], // Lagos
  [48.85, 2.35], // Paris
  [28.61, 77.21], // Délhi
  [35.68, 139.69], // Tóquio
  [-33.87, 151.21], // Sydney
  [40.71, -74.0], // Nova York
  [-26.2, 28.04], // Joanesburgo
];

/** A textura da Terra: oceano rosa, países creme e uma grade fina de meridianos e paralelos. */
async function desenharTextura(): Promise<HTMLCanvasElement> {
  const largura = 1536;
  const altura = 768;
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d")!;
  ctx.fillStyle = OCEANO;
  ctx.fillRect(0, 0, largura, altura);

  // Grade de 30 em 30 graus.
  ctx.strokeStyle = "rgba(184, 19, 92, 0.16)";
  ctx.lineWidth = 2;
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * largura;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, altura);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * altura;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(largura, y);
    ctx.stroke();
  }

  try {
    const resposta = await fetch("/mapa/mundi.svg");
    if (resposta.ok) {
      const texto = await resposta.text();
      // O desenho cobre só LAT_NORTE..LAT_SUL: estica esse trecho para o lugar certo da textura.
      ctx.save();
      ctx.translate(0, ((90 - LAT_NORTE) / 180) * altura);
      ctx.scale(largura / LARGURA_SVG, (((LAT_NORTE - LAT_SUL) / 180) * altura) / ALTURA_SVG);
      ctx.fillStyle = TERRA;
      ctx.strokeStyle = CONTORNO;
      ctx.lineWidth = 1.1;
      ctx.lineJoin = "round";
      for (const trecho of texto.matchAll(/\sd="([^"]+)"/g)) {
        const caminho = new Path2D(trecho[1]);
        ctx.fill(caminho);
        ctx.stroke(caminho);
      }
      ctx.restore();
    }
  } catch {
    // sem o desenho dos países, fica o globo rosa com a grade: ainda é um globo
  }
  return tela;
}

/** Posição de uma latitude e longitude na esfera de raio 1, do jeito que a SphereGeometry do three desenha. */
function naEsfera(T: Three, lat: number, lon: number, raio: number): Three {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new T.Vector3(raio * Math.cos(la) * Math.cos(lo), raio * Math.sin(la), -raio * Math.cos(la) * Math.sin(lo));
}

export async function montarGlobo(palco: HTMLElement): Promise<boolean> {
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
  const camera = new T.PerspectiveCamera(28, 1, 0.1, 20);
  camera.position.set(0, 0, 4.4);

  cena.add(new T.HemisphereLight(0xfff6fb, 0xc49a6c, 1.7));
  const luz = new T.DirectionalLight(0xfff1e6, 1.8);
  luz.position.set(-2.5, 2.5, 4);
  cena.add(luz);

  const textura = new T.CanvasTexture(await desenharTextura());
  textura.colorSpace = T.SRGBColorSpace;
  textura.anisotropy = 4;

  const inclinacao = new T.Group(); // o eixo da Terra, um pouco torto
  inclinacao.rotation.z = 0.32;
  inclinacao.rotation.x = 0.18;
  cena.add(inclinacao);

  const globo = new T.Group();
  inclinacao.add(globo);
  globo.add(new T.Mesh(new T.SphereGeometry(1, 64, 48), new T.MeshStandardMaterial({ map: textura, roughness: 0.9 })));

  const materialPin = new T.MeshBasicMaterial({ color: COR_PIN });
  const geometriaPin = new T.SphereGeometry(0.035, 12, 10);
  const geometriaHaste = new T.CylinderGeometry(0.006, 0.006, 0.07, 6);
  for (const [lat, lon] of PINS) {
    const ponta = naEsfera(T, lat, lon, 1.075);
    const cabeca = new T.Mesh(geometriaPin, materialPin);
    cabeca.position.copy(ponta);
    const haste = new T.Mesh(geometriaHaste, materialPin);
    haste.position.copy(naEsfera(T, lat, lon, 1.035));
    haste.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), ponta.clone().normalize());
    globo.add(haste, cabeca);
  }

  // Começa com o Brasil virado para quem olha: em (x, z) a longitude λ fica no ângulo λ, então gira -90° - λ.
  const inicioY = ((-90 + 46) * Math.PI) / 180;
  globo.rotation.y = inicioY;

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

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    renderer.render(cena, camera);
    palco.classList.add("inicio-globo--3d");
    return true;
  }

  let visivel = true;
  let quadro = 0;
  let anterior = performance.now();
  let velocidade = 0.35; // radianos por segundo
  let alvoVelocidade = 0.35;
  // Com o mouse (ou o dedo) em cima, o globo gira mais rápido: convida a clicar.
  const pai = palco.closest("a") ?? palco;
  pai.addEventListener("pointerenter", () => (alvoVelocidade = 1.4));
  pai.addEventListener("pointerleave", () => (alvoVelocidade = 0.35));

  const desenhar = (agora: number): void => {
    quadro = 0;
    const dt = Math.min((agora - anterior) / 1000, 0.1);
    anterior = agora;
    velocidade += (alvoVelocidade - velocidade) * Math.min(dt * 4, 1);
    globo.rotation.y -= velocidade * dt; // gira para o leste
    renderer.render(cena, camera);
    if (visivel && !document.hidden) quadro = requestAnimationFrame(desenhar);
  };
  const retomar = (): void => {
    if (!quadro && visivel && !document.hidden) {
      anterior = performance.now();
      quadro = requestAnimationFrame(desenhar);
    }
  };
  new IntersectionObserver(([registro]) => {
    visivel = registro.isIntersecting;
    retomar();
  }).observe(palco);
  document.addEventListener("visibilitychange", retomar);

  quadro = requestAnimationFrame(desenhar);
  palco.classList.add("inicio-globo--3d");
  return true;
}
