// Aviãozinho de papel 3D ao lado do Passaporte: um dardo de papel com dobras marcadas,
// planando devagar. Mesmo Three.js do CDN da landing; só carrega quando há WebGL.
const URL_THREE = "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js";
const COR_PAPEL = 0xfffdf7;
const COR_QUILHA = 0xffe3ef;
const COR_DOBRA = 0x8c0d45;
/** Dardo de papel com o bico em +x: duas asas, a quilha embaixo e as dobras desenhadas. */
function criarAviao(T) {
    const bico = [1, 0, 0];
    const dorso = [-0.82, 0, 0]; // dobra do meio, onde as asas se juntam
    const asaEsq = [-0.9, 0.07, 0.58];
    const asaDir = [-0.9, 0.07, -0.58];
    const quilha = [-0.76, -0.24, 0];
    const triangulo = (pontos, cor) => {
        const geometria = new T.BufferGeometry();
        geometria.setAttribute("position", new T.Float32BufferAttribute(pontos.flat(), 3));
        geometria.computeVertexNormals();
        const malha = new T.Mesh(geometria, new T.MeshStandardMaterial({ color: cor, roughness: 0.85, side: T.DoubleSide, flatShading: true }));
        malha.castShadow = true;
        const bordas = new T.LineSegments(new T.EdgesGeometry(geometria), new T.LineBasicMaterial({ color: COR_DOBRA, transparent: true, opacity: 0.55 }));
        malha.add(bordas);
        return malha;
    };
    const aviao = new T.Group();
    aviao.name = "aviao";
    aviao.add(triangulo([bico, dorso, asaEsq], COR_PAPEL));
    aviao.add(triangulo([bico, asaDir, dorso], COR_PAPEL));
    aviao.add(triangulo([bico, quilha, dorso], COR_QUILHA));
    return aviao;
}
export async function montarAviao(palco) {
    let T;
    try {
        T = await import(URL_THREE);
    }
    catch {
        return false;
    }
    let renderer;
    try {
        renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    }
    catch {
        return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = T.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const cena = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1.4, 0.1, 30);
    camera.position.set(0, 0, 3.9);
    cena.add(new T.HemisphereLight(0xfff6fb, 0xc49a6c, 1.5));
    const luz = new T.DirectionalLight(0xfff1e6, 2.2);
    luz.position.set(-2, 3, 4);
    luz.castShadow = true;
    luz.shadow.mapSize.set(512, 512);
    for (const lado of ["left", "bottom"])
        luz.shadow.camera[lado] = -3;
    for (const lado of ["right", "top"])
        luz.shadow.camera[lado] = 3;
    luz.shadow.radius = 5;
    cena.add(luz);
    // Recebe só a sombra, como se o avião voasse um pouco acima do mural.
    const fundo = new T.Mesh(new T.PlaneGeometry(10, 10), new T.ShadowMaterial({ color: 0x3f2618, opacity: 0.16 }));
    fundo.position.z = -0.9;
    fundo.receiveShadow = true;
    cena.add(fundo);
    const aviao = criarAviao(T);
    const voo = new T.Group(); // o voo mexe neste grupo; o avião fica com a pose de "visto de cima"
    aviao.rotation.set(1.05, -0.2, 0.38); // as asas viradas para quem olha, o bico subindo para a direita
    voo.add(aviao);
    cena.add(voo);
    palco.appendChild(renderer.domElement);
    const ajustar = () => {
        const { width, height } = palco.getBoundingClientRect();
        if (!width || !height)
            return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };
    ajustar();
    new ResizeObserver(ajustar).observe(palco);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        renderer.render(cena, camera);
        palco.classList.add("inicio-aviao--3d");
        return true;
    }
    let visivel = true;
    let quadro = 0;
    const inicio = performance.now();
    const saidaExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const desenhar = (agora) => {
        quadro = 0;
        const t = (agora - inicio) / 1000;
        const chegada = saidaExpo(Math.min(t / 1.8, 1)); // entra voando pela esquerda, uma vez
        voo.position.x = (1 - chegada) * -3 + Math.sin(t * 0.5) * 0.28;
        voo.position.y = (1 - chegada) * -0.6 + Math.sin(t * 0.9) * 0.1;
        voo.rotation.z = Math.cos(t * 0.9) * 0.07; // sobe e desce o bico
        voo.rotation.x = Math.sin(t * 0.5) * 0.16; // inclina nas curvas
        renderer.render(cena, camera);
        if (visivel && !document.hidden)
            quadro = requestAnimationFrame(desenhar);
    };
    const retomar = () => {
        if (!quadro && visivel && !document.hidden)
            quadro = requestAnimationFrame(desenhar);
    };
    new IntersectionObserver(([registro]) => {
        visivel = registro.isIntersecting;
        retomar();
    }).observe(palco);
    document.addEventListener("visibilitychange", retomar);
    quadro = requestAnimationFrame(desenhar);
    palco.classList.add("inicio-aviao--3d");
    return true;
}
