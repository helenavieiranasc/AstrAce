// Cena 3D da carta para o futuro: um envelope rosa com aba articulada, a carta dobrada em três que sobe, se desdobra
// para a pessoa escrever e volta para dentro, o selo de cera que cai sobre a aba e o carimbo do correio.
// Mesma técnica do passaporte (Three.js do CDN, texturas em canvas, luz com sombra no quadro de cortiça).
import * as Papel from "./carta-papel.js";
const URL_THREE = "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js";
// Medidas em unidades da cena.
const EW = 3.0; // envelope
const EH = 1.65;
const FH = 1.02; // altura da aba
const LW = 2.6; // carta aberta
const LH = (Papel.CARTA_A / Papel.CARTA_L) * LW;
const TERCO = LH / 3;
const PI = Math.PI;
// ---------- Movimento ----------
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const saida = (t) => 1 - Math.pow(1 - t, 3);
const misturar = (a, b, t) => a + (b - a) * t;
function carregarImagem(url) {
    return new Promise((ok, falha) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = falha;
        img.src = url;
    });
}
/** Plano com UV de 0 a 1 sobre qualquer polígono, para a textura caber no recorte. */
function formaNormalizada(T, forma, largura, altura, y0) {
    const g = new T.ShapeGeometry(forma);
    const pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = (pos.getX(i) + largura / 2) / largura;
        uv[i * 2 + 1] = (pos.getY(i) - y0) / altura;
    }
    g.setAttribute("uv", new T.BufferAttribute(uv, 2));
    return g;
}
/** Folha fina com frente e verso: a textura de cada lado ocupa só uma faixa vertical (v0 a v1) do papel. */
function painelDaCarta(T, altura, frente, verso, v0, v1) {
    const g = new T.BoxGeometry(LW, altura, 0.004);
    const uv = g.attributes.uv;
    for (const face of [4, 5]) {
        for (let i = face * 4; i < face * 4 + 4; i++)
            uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
    }
    const borda = new T.MeshStandardMaterial({ color: 0xf6e6dc, roughness: 0.95 });
    // Um pouco de brilho próprio, vindo da própria textura: o papel fica creme, não pêssego, sob as luzes quentes.
    const mat = (map) => new T.MeshStandardMaterial({ map, roughness: 0.92, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.55 });
    const malha = new T.Mesh(g, [borda, borda, borda, borda, mat(frente), mat(verso)]);
    malha.castShadow = malha.receiveShadow = true;
    return malha;
}
export async function montarCena(palco, opcoes) {
    let T;
    try {
        T = await import(URL_THREE);
    }
    catch {
        return null;
    }
    let renderer;
    try {
        // preserveDrawingBuffer: a cena fica parada enquanto a pessoa escreve; sem isso o navegador pode limpar o canvas
        // quando algo sobe para uma camada acima da página (como a lista aberta de áreas).
        renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    }
    catch {
        return null;
    }
    await Promise.all([
        document.fonts.load('700 100px "Caveat"'),
        document.fonts.load('400 30px "Atkinson Hyperlegible"'),
        document.fonts.load('700 30px "Atkinson Hyperlegible"'),
    ]).catch(() => undefined);
    let logos;
    try {
        const [creme, magenta] = await Promise.all([
            carregarImagem("/static/img/logo-estrela-creme.png"),
            carregarImagem("/static/img/logo-estrela-magenta.png"),
        ]);
        logos = { creme, magenta };
    }
    catch {
        renderer.dispose();
        return null;
    }
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = T.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const anis = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const cena = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.1, 60);
    // Ambiente claro e rosado só para dar brilho ao verniz do selo e ao papel.
    const pmrem = new T.PMREMGenerator(renderer);
    const quarto = new T.Scene();
    quarto.add(new T.Mesh(new T.BoxGeometry(24, 24, 24), new T.MeshBasicMaterial({ color: 0xfff1e8, side: T.BackSide })));
    for (const [x, y, z, w, h, cor] of [[-6, 7, 8, 9, 4, 0xffffff], [8, 3, 6, 4, 8, 0xfff8f2], [0, -8, 4, 12, 3, 0xffd9c7]]) {
        const painel = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: cor, side: T.DoubleSide }));
        painel.position.set(x, y, z);
        painel.lookAt(0, 0, 0);
        quarto.add(painel);
    }
    cena.environment = pmrem.fromScene(quarto, 0.04).texture;
    cena.environmentIntensity = 0.7;
    pmrem.dispose();
    cena.add(new T.HemisphereLight(0xfffaf5, 0xc49a6c, 1.0));
    const luz = new T.DirectionalLight(0xfff1e6, 2.3);
    luz.position.set(-2.2, 3.2, 5.5);
    luz.castShadow = true;
    luz.shadow.mapSize.set(2048, 2048);
    for (const [lado, v] of [["left", -6], ["right", 6], ["top", 6], ["bottom", -6]])
        luz.shadow.camera[lado] = v;
    luz.shadow.radius = 6;
    luz.shadow.bias = -0.0005;
    luz.shadow.normalBias = 0.012;
    cena.add(luz);
    const recorte = new T.DirectionalLight(0xffc4dc, 0.6);
    recorte.position.set(3, -1, 3);
    cena.add(recorte);
    // O quadro de cortiça do site fica atrás (no CSS); aqui só recebe a sombra.
    const chao = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ color: 0x3f2618, opacity: 0.34 }));
    chao.position.z = -0.5;
    chao.receiveShadow = true;
    cena.add(chao);
    const texturaDe = (canvas) => {
        const t = new T.CanvasTexture(canvas);
        t.colorSpace = T.SRGBColorSpace;
        t.anisotropy = anis;
        return t;
    };
    const papel = (map, extra = {}) => new T.MeshStandardMaterial({ map, roughness: 0.9, ...extra });
    // ---------- Envelope ----------
    const envelope = new T.Group();
    cena.add(envelope);
    const lateral = new T.MeshStandardMaterial({ color: 0xf0bdd1, roughness: 0.92 });
    const lisoCreme = new T.MeshStandardMaterial({ color: 0xfaeee4, roughness: 0.92 });
    const matCostas = papel(texturaDe(Papel.envelopeCostas()));
    const matFrente = papel(texturaDe(Papel.envelopeFrente(opcoes.dados, logos)));
    const matInterior = papel(null, { color: 0xf3c5d8 });
    // BoxGeometry: +x, -x, +y, -y, +z, -z
    const costas = new T.Mesh(new T.BoxGeometry(EW, EH, 0.012), [lateral, lateral, lateral, lateral, matCostas, matInterior]);
    costas.position.z = 0.014;
    const frente = new T.Mesh(new T.BoxGeometry(EW, EH, 0.012), [lateral, lateral, lateral, lateral, lisoCreme, matFrente]);
    frente.position.z = -0.014;
    for (const m of [costas, frente])
        m.castShadow = m.receiveShadow = true;
    envelope.add(costas, frente);
    // Aba: pivô na borda de cima; por fora o rosa do envelope, por dentro o forro de segurança.
    const abaPivo = new T.Group();
    abaPivo.position.set(0, EH / 2, 0.0215);
    envelope.add(abaPivo);
    const formaAba = new T.Shape();
    formaAba.moveTo(-EW / 2, 0);
    formaAba.lineTo(EW / 2, 0);
    formaAba.lineTo(0, -FH);
    formaAba.closePath();
    const geoAba = formaNormalizada(T, formaAba, EW, FH, -FH);
    const abaFora = new T.Mesh(geoAba, papel(texturaDe(Papel.abaFora()), { side: T.FrontSide }));
    const abaDentro = new T.Mesh(geoAba, papel(texturaDe(Papel.abaDentro()), { side: T.BackSide }));
    for (const m of [abaFora, abaDentro])
        m.castShadow = m.receiveShadow = true;
    abaPivo.add(abaFora, abaDentro);
    // Selo de cera: uma gota irregular com a estrela da marca em relevo.
    const cera = Papel.seloDeCera(logos);
    const seloGrupo = new T.Group();
    {
        const forma = new T.Shape();
        const R = 0.27;
        for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * PI * 2;
            const r = R * (1 + 0.05 * Math.sin(a * 5 + 0.6) + 0.035 * Math.sin(a * 9 + 1.7));
            if (i === 0)
                forma.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else
                forma.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        const geo = new T.ExtrudeGeometry(forma, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.025, bevelSegments: 4, curveSegments: 24 });
        const corpo = new T.Mesh(geo, new T.MeshPhysicalMaterial({ color: 0xa30f4f, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
        const topo = new T.Mesh(new T.CircleGeometry(R * 0.93, 48), new T.MeshPhysicalMaterial({ map: texturaDe(cera.cor), bumpMap: new T.CanvasTexture(cera.relevo), bumpScale: 5, roughness: 0.3, clearcoat: 0.7 }));
        topo.position.z = 0.056;
        for (const m of [corpo, topo])
            m.castShadow = true;
        seloGrupo.add(corpo, topo);
    }
    seloGrupo.position.set(0, -FH + 0.32, 0.03);
    abaPivo.add(seloGrupo);
    // Carimbo do correio, no lado do endereço.
    const matCarimbo = new T.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 });
    const carimbo = new T.Mesh(new T.PlaneGeometry(1.65, 0.88), matCarimbo);
    carimbo.rotation.set(0, PI, 0.14);
    carimbo.position.set(-0.62, 0.3, -0.0215);
    envelope.add(carimbo);
    const dataCurta = (iso) => iso ? Papel.lerData(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "").toUpperCase() : "";
    // ---------- Carta (três terços: o do meio é fixo e os outros dobram nele) ----------
    const cartaGrupo = new T.Group();
    cena.add(cartaGrupo);
    let frenteCarta = texturaDe(Papel.cartaFrente(opcoes.dados, logos));
    const versoCarta = texturaDe(Papel.cartaVerso(logos));
    const meio = painelDaCarta(T, TERCO, frenteCarta, versoCarta, 1 / 3, 2 / 3);
    const pivoTopo = new T.Group();
    pivoTopo.position.y = TERCO / 2;
    const topo = painelDaCarta(T, TERCO, frenteCarta, versoCarta, 2 / 3, 1);
    topo.position.y = TERCO / 2;
    pivoTopo.add(topo);
    const pivoBase = new T.Group();
    pivoBase.position.y = -TERCO / 2;
    const base = painelDaCarta(T, TERCO, frenteCarta, versoCarta, 0, 1 / 3);
    base.position.y = -TERCO / 2;
    pivoBase.add(base);
    cartaGrupo.add(meio, pivoTopo, pivoBase);
    // ---------- Estado e pose ----------
    const E = { y: 0, z: 0, esc: 1, rx: -0.22, ry: 0, aba: 0 };
    // enlace: 1 = a carta acompanha o envelope (inclinação, giro e posição); 0 = solta, no espaço da cena
    const C = { y: -0.12, z: 0, esc: 1, dobra: 1, enlace: 1 };
    const enquadre = { largura: EW * 1.3, altura: EH * 1.5, y: 0 };
    const extra = { rx: 0, ry: 0 }; // giro dado pelo ponteiro
    let seloVisivel = false;
    let seloSolto = null;
    let fase = "fechado";
    let marcaD = 0; // opacidade do carimbo
    const aplicar = (agora) => {
        const sopro = semMovimento || fase === "aberta" || fase === "ocupado" ? 0 : Math.sin(agora / 1500);
        envelope.position.set(0, E.y + sopro * 0.02, E.z);
        envelope.scale.setScalar(E.esc);
        envelope.rotation.set(E.rx + extra.rx + sopro * 0.02, E.ry + extra.ry, 0);
        abaPivo.rotation.x = E.aba * PI * 0.93;
        seloGrupo.visible = seloVisivel;
        if (seloSolto) {
            seloGrupo.position.set(0, seloSolto.y, seloSolto.z);
            seloGrupo.scale.setScalar(seloSolto.esc);
            seloGrupo.rotation.z = seloSolto.rz;
        }
        matCarimbo.opacity = marcaD;
        carimbo.scale.setScalar(1 + (1 - marcaD) * 0.3);
        // A carta dentro do envelope se move no referencial dele; solta, no da cena. O enlace faz a passagem.
        const noEnvelope = new T.Vector3(0, C.y, C.z).applyEuler(envelope.rotation).multiplyScalar(E.esc).add(envelope.position);
        cartaGrupo.position.set(0, C.y, C.z).lerp(noEnvelope, C.enlace);
        cartaGrupo.rotation.set(envelope.rotation.x * C.enlace, envelope.rotation.y * C.enlace, 0);
        cartaGrupo.scale.setScalar(C.esc * (1 + (E.esc - 1) * C.enlace));
        pivoTopo.rotation.x = PI * C.dobra;
        pivoBase.rotation.x = -PI * C.dobra;
        pivoTopo.position.z = C.dobra * 0.012;
        pivoBase.position.z = C.dobra * 0.006;
        cartaGrupo.visible = true;
    };
    // ---------- Câmera ----------
    let reserva = 0;
    let tamanhoPalco = { largura: 1, altura: 1 };
    const posicionarCamera = () => {
        const vfov = (camera.fov * PI) / 180;
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
        const d = Math.max(enquadre.altura / (2 * Math.tan(vfov / 2)), enquadre.largura / (2 * Math.tan(hfov / 2)));
        camera.position.set(0, enquadre.y, d);
        camera.lookAt(0, enquadre.y, 0);
        if (reserva > 0)
            camera.setViewOffset(tamanhoPalco.largura, tamanhoPalco.altura, reserva / 2, 0, tamanhoPalco.largura, tamanhoPalco.altura);
        else
            camera.clearViewOffset();
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
    };
    const tweens = [];
    let quadro = 0;
    let visivel = true;
    const reposicionar = [];
    const avisar = () => reposicionar.forEach((f) => f());
    const desenhar = (agora) => {
        aplicar(agora);
        renderer.render(cena, camera);
    };
    const loop = (agora) => {
        quadro = 0;
        for (const tw of [...tweens]) {
            const t = Math.min(1, (agora - tw.inicio) / tw.duracao);
            tw.passo(t);
            if (t >= 1) {
                tweens.splice(tweens.indexOf(tw), 1);
                tw.fim?.();
            }
        }
        desenhar(agora);
        const respira = !semMovimento && (fase === "fechado" || fase === "selada");
        if ((tweens.length || respira || arrastando) && visivel && !document.hidden)
            quadro = requestAnimationFrame(loop);
    };
    const pedir = () => {
        if (!quadro)
            quadro = requestAnimationFrame(loop);
    };
    /** Anima durante `duracao` ms; devolve uma promessa que se resolve no fim. */
    const animar = (duracao, passo) => new Promise((ok) => {
        if (semMovimento) {
            passo(1);
            ok();
            pedir();
            return;
        }
        tweens.push({ duracao, passo, fim: ok, inicio: performance.now() });
        pedir();
    });
    const de = (obj, chaves) => Object.fromEntries(chaves.map((k) => [k, obj[k]]));
    const ajustar = () => {
        const { width, height } = palco.getBoundingClientRect();
        if (!width || !height)
            return;
        renderer.setSize(width, height, false);
        tamanhoPalco = { largura: width, altura: height };
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        posicionarCamera();
        pedir();
        avisar();
    };
    const tela = renderer.domElement;
    palco.appendChild(tela);
    tela.tabIndex = -1;
    tela.setAttribute("role", "img");
    tela.setAttribute("aria-label", "Envelope e carta para o futuro em 3D.");
    tela.style.touchAction = "pan-y";
    new ResizeObserver(ajustar).observe(palco);
    new IntersectionObserver(([e]) => {
        visivel = e.isIntersecting;
        if (visivel)
            pedir();
    }).observe(palco);
    document.addEventListener("visibilitychange", pedir);
    // ---------- Poses prontas ----------
    const enquadrarEnvelope = () => ({ largura: EW * 1.22, altura: EH * 1.55, y: 0 });
    const enquadrarCarta = () => ({ largura: LW * 1.12, altura: LH * 1.08, y: 0.1 });
    const poseEnvelope = (selado, lado) => {
        Object.assign(E, { y: 0, z: 0, esc: 1, rx: -0.22, ry: lado === "frente" ? PI : 0, aba: 0 });
        Object.assign(C, { y: -0.12, z: 0, esc: 1, dobra: 1, enlace: 1 });
        seloVisivel = selado;
        seloSolto = selado ? { y: -FH + 0.32, z: 0.03, esc: 1, rz: 0, opacidade: 1 } : null;
        marcaD = selado ? 1 : 0;
        Object.assign(enquadre, enquadrarEnvelope());
        fase = selado ? "selada" : "fechado";
    };
    // ---------- Dados e texturas ----------
    let dadosAtuais = opcoes.dados;
    let mensagemNoPapel = false;
    const repintarCarta = (d) => {
        const nova = texturaDe(Papel.cartaFrente({ ...d, textoNoPapel: mensagemNoPapel || d.textoNoPapel }, logos));
        for (const malha of [meio, topo, base]) {
            malha.material[4].map = nova;
            malha.material[4].emissiveMap = nova;
            malha.material[4].needsUpdate = true;
        }
        frenteCarta.dispose();
        frenteCarta = nova;
    };
    const repintarEnvelope = (d) => {
        const nova = texturaDe(Papel.envelopeFrente(d, logos));
        matFrente.map.dispose();
        matFrente.map = nova;
        matFrente.needsUpdate = true;
        const marca = texturaDe(Papel.carimboPostal(dataCurta(d.enviada)));
        matCarimbo.map?.dispose();
        matCarimbo.map = marca;
        matCarimbo.needsUpdate = true;
    };
    repintarEnvelope(dadosAtuais);
    // ---------- Ponteiro: arrastar gira o envelope; clique abre ----------
    let arrastando = false;
    let inicio = null;
    let moveu = 0;
    const raio = new T.Raycaster();
    const ponto = new T.Vector2();
    tela.addEventListener("pointerdown", (e) => {
        if (fase !== "fechado" && fase !== "selada")
            return;
        tela.setPointerCapture(e.pointerId);
        inicio = { x: e.clientX, y: e.clientY, ry: extra.ry };
        moveu = 0;
        arrastando = true;
    });
    tela.addEventListener("pointermove", (e) => {
        if (!arrastando || !inicio)
            return;
        const dx = e.clientX - inicio.x;
        moveu = Math.max(moveu, Math.abs(dx) + Math.abs(e.clientY - inicio.y));
        extra.ry = inicio.ry + dx * 0.008;
        pedir();
    });
    const soltar = (e) => {
        if (!arrastando)
            return;
        arrastando = false;
        inicio = null;
        const clique = moveu < 6;
        // Volta suavemente à posição de repouso.
        const ry0 = extra.ry;
        void animar(600, (t) => {
            extra.ry = misturar(ry0, 0, suave(t));
        });
        if (clique && fase === "fechado") {
            const r = tela.getBoundingClientRect();
            ponto.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
            raio.setFromCamera(ponto, camera);
            if (raio.intersectObject(envelope, true).length)
                opcoes.aoClicar?.();
        }
    };
    tela.addEventListener("pointerup", soltar);
    tela.addEventListener("pointercancel", soltar);
    // ---------- Sequências ----------
    const rompeSelo = async () => {
        if (!seloVisivel)
            return;
        // Estala: incha um instante, depois cai e some.
        await animar(260, (t) => {
            seloSolto = { y: -FH + 0.32, z: 0.03 + Math.sin(t * PI) * 0.05, esc: 1 + Math.sin(t * PI) * 0.18, rz: Math.sin(t * PI * 3) * 0.08, opacidade: 1 };
        });
        await animar(520, (t) => {
            const e = suave(t);
            seloSolto = { y: -FH + 0.32 - e * 0.9, z: 0.03 + e * 0.1, esc: 1 - e * 0.35, rz: e * 0.9, opacidade: 1 - e };
            seloGrupo.children.forEach((m) => {
                m.material.transparent = true;
                m.material.opacity = 1 - e;
            });
        });
        seloVisivel = false;
        seloGrupo.children.forEach((m) => {
            m.material.opacity = 1;
        });
    };
    const abrir = async () => {
        if (fase === "aberta" || fase === "ocupado")
            return;
        fase = "ocupado";
        // Se estiver de frente (lado do endereço), gira primeiro para o lado da aba.
        const ry0 = E.ry;
        if (ry0 !== 0)
            await animar(700, (t) => { E.ry = misturar(ry0, 0, suave(t)); });
        await rompeSelo();
        await animar(900, (t) => { E.aba = suave(t); }); // 1) a aba se abre para trás
        await animar(950, (t) => { C.y = misturar(-0.12, 1.5, suave(t)); }); // 2) a carta sobe, ainda dobrada
        // 3) a carta vem para a frente e se desdobra; o envelope desce e recua
        const ae = de(E, ["y", "z", "esc", "rx"]);
        const alvoEnq = enquadrarCarta();
        const enq0 = { ...enquadre };
        await animar(1300, (t) => {
            const e = suave(t);
            C.y = misturar(1.5, 0.1, e);
            C.enlace = 1 - e;
            C.dobra = 1 - saida(Math.min(1, t * 1.15));
            E.y = misturar(ae.y, -2.55, e);
            E.z = misturar(ae.z, -0.4, e);
            E.esc = misturar(ae.esc, 0.9, e);
            E.rx = misturar(ae.rx, 0, e);
            enquadre.largura = misturar(enq0.largura, alvoEnq.largura, e);
            enquadre.altura = misturar(enq0.altura, alvoEnq.altura, e);
            enquadre.y = misturar(enq0.y, alvoEnq.y, e);
            posicionarCamera();
        });
        C.dobra = 0;
        C.enlace = 0;
        fase = "aberta";
        avisar();
    };
    const selar = async () => {
        if (fase !== "aberta")
            return;
        fase = "ocupado";
        mensagemNoPapel = true;
        repintarCarta(dadosAtuais);
        repintarEnvelope(dadosAtuais);
        // 1) a carta se dobra em três
        await animar(1000, (t) => { C.dobra = suave(t); });
        // 2) o envelope volta ao centro e a carta desce para dentro
        const ae = de(E, ["y", "z", "esc", "rx"]);
        const enq0 = { ...enquadre };
        const alvoEnq = enquadrarEnvelope();
        await animar(1000, (t) => {
            const e = suave(t);
            C.y = misturar(0.1, 1.5, e);
            C.enlace = e;
            E.y = misturar(ae.y, 0, e);
            E.z = misturar(ae.z, 0, e);
            E.esc = misturar(ae.esc, 1, e);
            E.rx = misturar(ae.rx, -0.22, e);
            enquadre.largura = misturar(enq0.largura, alvoEnq.largura, e);
            enquadre.altura = misturar(enq0.altura, alvoEnq.altura, e);
            enquadre.y = misturar(enq0.y, alvoEnq.y, e);
            posicionarCamera();
        });
        await animar(850, (t) => { C.y = misturar(1.5, -0.12, suave(t)); });
        // 3) a aba fecha
        await animar(850, (t) => { E.aba = 1 - suave(t); });
        // 4) o selo de cera cai sobre a ponta da aba
        seloVisivel = true;
        await animar(750, (t) => {
            const e = t < 0.6 ? t / 0.6 : 1;
            const queda = (1 - e * e) * 0.9;
            const amassa = t > 0.6 ? Math.sin(((t - 0.6) / 0.4) * PI) * 0.12 : 0;
            seloSolto = { y: -FH + 0.32, z: 0.03 + queda, esc: (0.6 + 0.4 * e) * (1 + amassa), rz: (1 - e) * 0.6, opacidade: 1 };
            seloGrupo.children.forEach((m) => { m.material.opacity = 1; });
        });
        // 5) o envelope vira e o carimbo do correio marca o selo
        await animar(1200, (t) => {
            const e = suave(t);
            E.ry = misturar(0, PI, e);
            E.z = Math.sin(t * PI) * 0.7;
        });
        await animar(420, (t) => { marcaD = saida(t); });
        fase = "selada";
        pedir();
    };
    const mostrarEnvelope = (opc) => {
        mensagemNoPapel = true;
        repintarCarta(dadosAtuais);
        repintarEnvelope(dadosAtuais);
        poseEnvelope(opc.selado, opc.lado);
        posicionarCamera();
        pedir();
        avisar();
    };
    const virar = () => {
        if (fase !== "selada")
            return;
        fase = "ocupado";
        const alvo = Math.abs(E.ry) < PI / 2 ? PI : 0;
        const ry0 = E.ry;
        void animar(1000, (t) => {
            E.ry = misturar(ry0, alvo, suave(t));
            E.z = Math.sin(t * PI) * 0.5;
        }).then(() => {
            fase = "selada";
            pedir();
        });
    };
    const atualizar = (d) => {
        dadosAtuais = d;
        mensagemNoPapel = d.textoNoPapel;
        repintarCarta(d);
        repintarEnvelope(d);
        pedir();
    };
    const retanguloDaCarta = () => {
        cartaGrupo.updateMatrixWorld(true);
        const { width, height } = palco.getBoundingClientRect();
        const canto = (x, y) => {
            const p = new T.Vector3(x, y, 0).applyMatrix4(cartaGrupo.matrixWorld).project(camera);
            return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
        };
        const a = canto(-LW / 2, LH / 2);
        const b = canto(LW / 2, -LH / 2);
        return { x: a.x, y: a.y, largura: b.x - a.x, altura: b.y - a.y };
    };
    poseEnvelope(false, "costas");
    mensagemNoPapel = false;
    ajustar();
    palco.classList.add("carta-cena--pronta");
    return {
        get fase() {
            return fase;
        },
        abrir,
        selar,
        mostrarEnvelope,
        virar,
        atualizar,
        reservarDireita(px) {
            reserva = px;
            posicionarCamera();
            pedir();
            avisar();
        },
        retanguloDaCarta,
        redesenhar() {
            desenhar(performance.now());
        },
        aoReposicionar(fn) {
            reposicionar.push(fn);
        },
    };
}
