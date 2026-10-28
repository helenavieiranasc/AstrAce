// Mapa de Inspiração: mapa-múndi estático com as fronteiras dos países (o SVG vem do template) e os pins por cima.
// Pins rosas são os projetos do AstrAce (os mesmos dados do antigo "Onde elas brilham"); verdes são as mulheres
// da história da ciência. Pins muito próximos viram um só, com a contagem; clicar abre os detalhes.
import { api, el, esc, htmlFoto, mensagemDeErro, urlSegura } from "./comum.js";
// Faixa de latitude do desenho (sem a Antártida). Tem que bater com app/templates/mapa_mundi.svg.
const LAT_NORTE = 84;
const LAT_SUL = -58;
// Distância, em unidades do desenho (1000 de largura), abaixo da qual dois pins viram um grupo.
const DISTANCIA_GRUPO = 26;
const area = el("mapa-area");
const palco = el("mapa-palco");
const caixa = el("mapa-caixa");
const pinosEl = el("mapa-pinos");
const rotulo = el("mapa-rotulo");
const detalhe = el("mapa-detalhe");
const detalheConteudo = el("mapa-detalhe-conteudo");
const resumo = el("mapa-resumo");
const semLocal = el("mapa-sem-local");
const listaAstrace = el("lista-astrace");
const listaHistoria = el("lista-historia");
let cidades = [];
let cidadesMulheres = [];
let historicas = [];
let pinos = [];
let selecionados = [];
const visiveis = { projetos: true, mulheres: true, historia: true };
let origem = null;
let abertos = []; // o que está no pop-up agora
let termo = ""; // o que foi digitado na busca, normalizado
let jaDesenhou = false; // a entrada animada dos pins acontece só na primeira vez
const idCidade = (c) => `projetos:${c.cidade}-${c.uf}`;
const idMulheres = (c) => `mulheres:${c.cidade}-${c.uf}`;
const idHistorica = (h) => `historia:${h.id}`;
const noMovimentoReduzido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function plural(n, um, varios) {
    return `${n} ${n === 1 ? um : varios}`;
}
function inclinacao(id) {
    const x = Math.sin(id * 12.9898) * 43758.5453;
    return ((x - Math.floor(x)) * 3.2 - 1.6).toFixed(2);
}
function descricaoDoLocal(h) {
    const { cidade, detalhe: d, pais } = h.local;
    return `${cidade}${d ? ` (${d})` : ""}, ${pais}`;
}
// ---------- Conteúdo do painel ----------
function htmlHistorica(h) {
    const anos = h.morte ? `${h.nascimento}–${h.morte}` : `nasceu em ${h.nascimento}`;
    const fonte = h.fontes[0] ?? "";
    const nomeDaFonte = fonte.includes("pt.wikipedia") ? "Wikipédia" : "Wikipédia (em inglês)";
    return `
    <article class="mapa-cartao mapa-cartao--historia">
      <div class="mapa-cartao__topo">
        <div class="mapa-cartao__foto" data-inicial="${esc(h.nome[0])}">
          <img src="${esc(urlSegura(h.foto.url) ?? "")}" alt="Retrato de ${esc(h.nome)}" width="120" height="150"
               loading="lazy" referrerpolicy="no-referrer">
        </div>
        <div>
          <h2 class="mapa-cartao__nome" id="mapa-detalhe-titulo" tabindex="-1">${esc(h.nome)}</h2>
          <p class="mapa-cartao__area">${esc(h.area)}</p>
          <p class="mapa-cartao__origem">${esc(descricaoDoLocal(h))} · ${esc(anos)}</p>
        </div>
      </div>
      <p class="mapa-cartao__bio">${esc(h.bio)}</p>
      <div class="mapa-cartao__destaque">
        <p class="mapa-cartao__destaque-titulo">Contribuição de destaque</p>
        <p>${esc(h.destaque)}</p>
      </div>
      <p class="mapa-cartao__credito">
        Foto: ${esc(h.foto.autor)}, ${esc(h.foto.licenca)}
        (<a href="${esc(h.foto.fonte)}" target="_blank" rel="noopener">fonte<span class="visualmente-oculto"> (abre em outra aba)</span></a>).
        ${fonte ? `<a href="${esc(fonte)}" target="_blank" rel="noopener">${nomeDaFonte}<span class="visualmente-oculto"> (abre em outra aba)</span></a>.` : ""}
      </p>
    </article>`;
}
function htmlProjeto(c) {
    return `
    <li>
      <a class="mini" href="/mural?projeto=${c.id}" style="--rot: ${inclinacao(c.id)}deg">
        <span class="mini__foto">${htmlFoto(c)}</span>
        <span class="mini__tipo">${esc(c.tipo_rotulo)}</span>
        <span class="mini__titulo">${esc(c.titulo)}</span>
        <span class="mini__area">${esc(c.autora)} · ${esc(c.area_rotulo)}</span>
      </a>
    </li>`;
}
function htmlCidade(c) {
    return `
    <article class="mapa-cartao mapa-cartao--astrace">
      <h2 class="mapa-cartao__nome" id="mapa-detalhe-titulo" tabindex="-1">${esc(c.cidade)}, ${esc(c.uf)}</h2>
      <p class="mapa-cartao__area">${plural(c.total, "projeto", "projetos")} de cientistas do AstrAce</p>
      <ul class="mapa-cartao__projetos">${c.projetos.map(htmlProjeto).join("")}</ul>
    </article>`;
}
function htmlCidadeMulheres(c) {
    return `
    <article class="mapa-cartao mapa-cartao--mulheres">
      <h2 class="mapa-cartao__nome" id="mapa-detalhe-titulo" tabindex="-1">${esc(c.cidade)}, ${esc(c.uf)}</h2>
      <p class="mapa-cartao__area">${c.total === 1 ? "1 mulher cadastrada no AstrAce mora aqui" : `${c.total} mulheres cadastradas no AstrAce moram aqui`}</p>
      ${c.nomes.length ? `<ul class="mapa-cartao__nomes">${c.nomes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      ${c.total > c.nomes.length
        ? `<p class="mapa-cartao__credito">${c.nomes.length ? `Outras ${c.total - c.nomes.length} ainda não publicaram um projeto, então aparecem só na contagem.` : "Ainda não publicou um projeto, então aparece só na contagem."}</p>`
        : ""}
    </article>`;
}
function htmlGrupo(ids) {
    const itens = ids
        .map((id) => {
        const c = cidades.find((x) => idCidade(x) === id);
        const m = cidadesMulheres.find((x) => idMulheres(x) === id);
        const h = historicas.find((x) => idHistorica(x) === id);
        if (c)
            return botaoDoGrupo(id, "rosa", `${c.cidade}, ${c.uf}`, plural(c.total, "projeto", "projetos"));
        if (m)
            return botaoDoGrupo(id, "estrela-rosa", `${m.cidade}, ${m.uf}`, plural(m.total, "mulher do AstrAce", "mulheres do AstrAce"));
        if (h)
            return botaoDoGrupo(id, "estrela", h.nome, descricaoDoLocal(h));
        return "";
    })
        .join("");
    return `
    <article class="mapa-cartao mapa-cartao--grupo">
      <h2 class="mapa-cartao__nome" id="mapa-detalhe-titulo" tabindex="-1">${plural(ids.length, "pin", "pins")} aqui perto</h2>
      <p class="mapa-cartao__area">Escolha um para ver os detalhes.</p>
      <ul class="mapa-grupo">${itens}</ul>
    </article>`;
}
function botaoDoGrupo(id, forma, titulo, sub) {
    return `
    <li>
      <button class="mapa-item" type="button" data-pin="${esc(id)}">
        <span class="mapa-amostra mapa-amostra--${forma}" aria-hidden="true"></span>
        <span class="mapa-item__texto"><span class="mapa-item__nome">${esc(titulo)}</span>
        <span class="mapa-item__sub">${esc(sub)}</span></span>
      </button>
    </li>`;
}
// ---------- Abrir e fechar o painel ----------
function abrir(ids, quem = null) {
    if (!ids.length)
        return;
    if (quem)
        origem = quem;
    const unico = ids.length === 1 ? ids[0] : null;
    const cidade = unico ? cidades.find((c) => idCidade(c) === unico) : undefined;
    const mulheres = unico ? cidadesMulheres.find((c) => idMulheres(c) === unico) : undefined;
    const historica = unico ? historicas.find((h) => idHistorica(h) === unico) : undefined;
    detalheConteudo.innerHTML = cidade
        ? htmlCidade(cidade)
        : mulheres
            ? htmlCidadeMulheres(mulheres)
            : historica
                ? htmlHistorica(historica)
                : htmlGrupo(ids);
    detalhe.hidden = false;
    detalhe.scrollTop = 0;
    area.classList.add("mapa-area--aberta");
    detalhe.querySelector(".mapa-cartao__foto img")?.addEventListener("error", (e) => {
        const foto = e.target.parentElement;
        foto.classList.add("mapa-cartao__foto--sem");
        foto.textContent = foto.dataset.inicial ?? "?";
    }, { once: true });
    document.getElementById("mapa-detalhe-titulo")?.focus({ preventScroll: true });
    abertos = ids;
    posicionar();
    destacar(ids);
    const url = new URL(location.href);
    url.search = "";
    if (cidade)
        url.searchParams.set("cidade", `${cidade.cidade}-${cidade.uf}`);
    if (historica)
        url.searchParams.set("mulher", historica.id);
    history.replaceState(null, "", url);
}
/** Põe o pop-up ao lado do pin escolhido: à direita, ou à esquerda se não couber; sempre dentro do mapa. */
function posicionar() {
    const ids = abertos;
    const c = caixa.getBoundingClientRect();
    const pino = [...pinosEl.querySelectorAll(".mapa-pino")].find((b) => (b.dataset.pins ?? "").split(",").some((id) => ids.includes(id)));
    const folga = 18;
    // No celular o mapa é baixo demais para caber o cartão: ele sai por cima da página, sem limite de altura.
    const celular = matchMedia("(max-width: 640px)").matches;
    detalhe.style.maxHeight = celular ? "none" : `${Math.max(c.height - 16, 160)}px`;
    const largura = detalhe.offsetWidth, altura = celular ? detalhe.offsetHeight : Math.min(detalhe.offsetHeight, c.height - 16);
    let x = c.width / 2, y = c.height / 2;
    if (pino) {
        const p = pino.getBoundingClientRect();
        x = p.left - c.left + p.width / 2;
        y = p.top - c.top + p.height / 2;
    }
    const direita = x + folga + largura <= c.width || x < c.width / 2;
    const esquerda = direita ? x + folga : x - folga - largura;
    detalhe.style.left = `${Math.min(Math.max(esquerda, 8), Math.max(c.width - largura - 8, 8))}px`;
    detalhe.style.top = celular
        ? `${Math.max(y - 40, 8)}px`
        : `${Math.min(Math.max(y - altura / 2, 8), Math.max(c.height - altura - 8, 8))}px`;
}
window.addEventListener("resize", () => {
    if (!detalhe.hidden)
        posicionar();
});
function fechar() {
    if (detalhe.hidden)
        return;
    detalhe.hidden = true;
    abertos = [];
    area.classList.remove("mapa-area--aberta");
    destacar([]);
    history.replaceState(null, "", location.pathname);
    (origem ?? pinosEl.querySelector("button"))?.focus({ preventScroll: true });
}
/** Clique numa lista: leva o mapa para a vista e abre os detalhes. */
function escolher(id, quem, rolar) {
    if (rolar)
        palco.scrollIntoView({ behavior: noMovimentoReduzido() ? "auto" : "smooth", block: "center" });
    abrir([id], quem);
}
/** Marca os pins escolhidos sem redesenhar (assim o foco do teclado não se perde). */
function destacar(ids) {
    selecionados = ids;
    pinosEl.querySelectorAll(".mapa-pino").forEach((b) => {
        b.classList.toggle("mapa-pino--escolhido", (b.dataset.pins ?? "").split(",").some((id) => ids.includes(id)));
    });
}
// ---------- Listas ----------
function desenharListas() {
    listaAstrace.innerHTML = cidades
        .map((c) => `<li>${botaoDaLista(idCidade(c), "rosa", `${c.cidade} ${c.uf}`, plural(c.total, "projeto", "projetos"))}</li>`)
        .join("");
    const ordenadas = [...historicas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    listaHistoria.innerHTML = ordenadas
        .map((h) => `<li>${botaoDaLista(idHistorica(h), "estrela", h.nome, `${descricaoDoLocal(h)} · ${h.area}`)}</li>`)
        .join("");
    el("total-astrace").textContent = cidades.length ? `(${plural(cidades.length, "cidade", "cidades")})` : "";
    el("total-mulheres").textContent = cidadesMulheres.length ? `(${plural(cidadesMulheres.length, "cidade", "cidades")})` : "";
    el("total-historia").textContent = historicas.length ? `(${historicas.length})` : "";
}
function botaoDaLista(id, forma, titulo, sub) {
    return `
    <button class="mapa-item" type="button" data-pin="${esc(id)}" aria-haspopup="true">
      <span class="mapa-amostra mapa-amostra--${forma}" aria-hidden="true"></span>
      <span class="mapa-item__texto"><span class="mapa-item__nome">${esc(titulo)}</span>
      <span class="mapa-item__sub">${esc(sub)}</span></span>
    </button>`;
}
// ---------- Pins sobre o mapa ----------
/** Posição de uma coordenada no desenho (projeção equirretangular, mesma do SVG). */
function posicao(lat, lon) {
    return {
        x: ((lon + 180) / 360) * 100,
        y: ((LAT_NORTE - lat) / (LAT_NORTE - LAT_SUL)) * 100,
    };
}
function montarPinos() {
    const projetos = cidades.map((c) => ({
        id: idCidade(c), categoria: "projetos", ...posicao(c.lat, c.lon),
        titulo: `${c.cidade}, ${c.uf}`, sub: plural(c.total, "projeto", "projetos"),
    }));
    const mulheres = cidadesMulheres.map((c) => {
        const p = posicao(c.lat, c.lon);
        // Mesma cidade dos projetos: a estrela sai um pouco do lado, para as duas categorias aparecerem separadas.
        const igual = projetos.some((o) => Math.abs(o.x - p.x) < 0.3 && Math.abs(o.y - p.y) < 0.3);
        return {
            id: idMulheres(c), categoria: "mulheres", x: igual ? p.x + 1.4 : p.x, y: igual ? p.y - 1 : p.y,
            titulo: `${c.cidade}, ${c.uf}`, sub: plural(c.total, "mulher do AstrAce", "mulheres do AstrAce"),
        };
    });
    const historias = historicas.map((h) => ({
        id: idHistorica(h), categoria: "historia", ...posicao(h.local.lat, h.local.lon),
        titulo: h.nome, sub: descricaoDoLocal(h),
    }));
    pinos = [...projetos, ...mulheres, ...historias];
}
/** Junta pins que caem no mesmo lugar (ou quase): um botão com a contagem, que abre a lista. */
function agrupar(lista) {
    const grupos = [];
    for (const p of lista) {
        const perto = grupos.find((g) => g.some((o) => o.categoria === p.categoria && Math.hypot((o.x - p.x) * 10, (o.y - p.y) * 3.94) < DISTANCIA_GRUPO));
        if (perto)
            perto.push(p);
        else
            grupos.push([p]);
    }
    return grupos;
}
/** Texto para comparar na busca: sem acento e sem maiúsculas ("São Paulo" acha "sao paulo"). */
function normalizar(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function combina(p) {
    return normalizar(`${p.titulo} ${p.sub}`).includes(termo);
}
function htmlPino(g, ordem) {
    const cat = g[0].categoria;
    const forma = cat === "projetos" ? "rosa" : cat === "mulheres" ? "estrela-rosa" : "estrela";
    const ids = g.map((p) => p.id).join(",");
    const rotulo_ = g.length === 1 ? g[0].titulo : `${g.length} pins aqui perto`;
    const n = g.length > 1 ? `<span class="mapa-pino__n" aria-hidden="true">${g.length}</span>` : "";
    const x = g.reduce((s, p) => s + p.x, 0) / g.length;
    const y = g.reduce((s, p) => s + p.y, 0) / g.length;
    // Com busca ativa, o grupo que não tem ninguém procurado fica apagado (continua no lugar).
    const apagado = termo && !g.some(combina) ? " mapa-pino--fora" : "";
    const parado = jaDesenhou ? " mapa-pino--parado" : "";
    return `<button class="mapa-pino mapa-pino--${forma}${apagado}${parado}" type="button" style="left: ${x.toFixed(2)}%; top: ${y.toFixed(2)}%; --i: ${ordem}"
    data-pins="${esc(ids)}" data-rotulo="${esc(rotulo_)}" data-sub="${esc(g.length === 1 ? g[0].sub : "Clique para ver a lista")}"
    aria-label="${esc(rotulo_)}">${n}</button>`;
}
function desenharPinos() {
    const ativos = pinos.filter((p) => visiveis[p.categoria]);
    pinosEl.innerHTML = agrupar(ativos).map((g, k) => htmlPino(g, k)).join("");
    jaDesenhou = true;
    destacar(selecionados);
}
// ---------- Busca por nome ----------
const campoBusca = el("mapa-busca-campo");
const resultados = el("mapa-resultados");
function mostrarResultados() {
    const achados = termo ? pinos.filter(combina).slice(0, 8) : [];
    if (!termo) {
        resultados.hidden = true;
        campoBusca.setAttribute("aria-expanded", "false");
    }
    else if (!achados.length) {
        resultados.innerHTML = '<li class="mapa-busca__vazio">Ninguém com esse nome ou cidade no mapa ainda.</li>';
        resultados.hidden = false;
        campoBusca.setAttribute("aria-expanded", "true");
    }
    else {
        resultados.innerHTML = achados
            .map((p) => `<li><button type="button" role="option" data-pin="${esc(p.id)}">
        <span class="mapa-amostra mapa-amostra--${p.categoria === "projetos" ? "rosa" : p.categoria === "mulheres" ? "estrela-rosa" : "estrela"}" aria-hidden="true"></span>
        <span><span>${esc(p.titulo)}</span><small>${esc(p.sub)}</small></span></button></li>`)
            .join("");
        resultados.hidden = false;
        campoBusca.setAttribute("aria-expanded", "true");
    }
}
campoBusca.addEventListener("input", () => {
    termo = normalizar(campoBusca.value.trim());
    mostrarResultados();
    desenharPinos();
});
campoBusca.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        campoBusca.value = "";
        termo = "";
        mostrarResultados();
        desenharPinos();
    }
    if (e.key === "Enter") {
        e.preventDefault();
        const primeiro = resultados.querySelector("button");
        if (primeiro)
            primeiro.click();
    }
});
resultados.addEventListener("click", (e) => {
    const item = e.target.closest("button[data-pin]");
    if (!item)
        return;
    resultados.hidden = true;
    campoBusca.setAttribute("aria-expanded", "false");
    escolher(item.dataset.pin, item, true);
});
document.addEventListener("click", (e) => {
    if (!e.target.closest("#mapa-busca")) {
        resultados.hidden = true;
        campoBusca.setAttribute("aria-expanded", "false");
    }
});
function mostrarRotulo(botao) {
    const x = parseFloat(botao.style.left), y = parseFloat(botao.style.top);
    rotulo.innerHTML = `<strong>${esc(botao.dataset.rotulo ?? "")}</strong><span>${esc(botao.dataset.sub ?? "")}</span>`;
    rotulo.style.left = `${x}%`;
    rotulo.style.top = `${y}%`;
    rotulo.hidden = false;
}
// ---------- Eventos ----------
pinosEl.addEventListener("click", (e) => {
    const botao = e.target.closest(".mapa-pino");
    if (!botao)
        return;
    abrir((botao.dataset.pins ?? "").split(","), botao);
});
pinosEl.addEventListener("pointerover", (e) => {
    const botao = e.target.closest(".mapa-pino");
    if (botao)
        mostrarRotulo(botao);
});
pinosEl.addEventListener("pointerleave", () => (rotulo.hidden = true));
pinosEl.addEventListener("focusin", (e) => {
    const botao = e.target.closest(".mapa-pino");
    if (botao)
        mostrarRotulo(botao);
});
pinosEl.addEventListener("focusout", () => (rotulo.hidden = true));
document.addEventListener("click", (e) => {
    const alvo = e.target;
    const item = alvo.closest("[data-pin]");
    if (item && !item.classList.contains("mapa-pino"))
        return escolher(item.dataset.pin, item, true);
    const filtro = alvo.closest("[data-categoria]");
    if (filtro) {
        const ligado = filtro.getAttribute("aria-pressed") !== "true";
        filtro.setAttribute("aria-pressed", String(ligado));
        visiveis[filtro.dataset.categoria] = ligado;
        rotulo.hidden = true;
        desenharPinos();
    }
});
el("mapa-detalhe-fechar").addEventListener("click", fechar);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !detalhe.hidden)
        fechar();
});
// ---------- Início ----------
async function iniciar() {
    const [mapa, mulheres, porCidade] = await Promise.allSettled([
        api("/api/mural/mapa"),
        api("/api/mapa/historicas"),
        api("/api/mapa/mulheres-astrace"),
    ]);
    if (porCidade.status === "fulfilled")
        cidadesMulheres = porCidade.value.cidades;
    const avisos = [];
    let sem = 0;
    let total = 0;
    if (mapa.status === "fulfilled") {
        cidades = mapa.value.cidades.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
        sem = mapa.value.sem_local;
        total = mapa.value.total - mapa.value.sem_local;
    }
    else
        avisos.push(`Não deu para carregar os projetos: ${mensagemDeErro(mapa.reason)}`);
    if (mulheres.status === "fulfilled")
        historicas = mulheres.value.mulheres;
    else
        avisos.push(`Não deu para carregar as mulheres da história: ${mensagemDeErro(mulheres.reason)}`);
    desenharListas();
    if (avisos.length)
        resumo.textContent = avisos.join(" ");
    else {
        resumo.textContent =
            `${plural(total, "projeto", "projetos")} em ${plural(cidades.length, "cidade", "cidades")} e ` +
                `${plural(historicas.length, "mulher", "mulheres")} da história. Escolha um nome para vê-lo no mapa.`;
    }
    if (!cidades.length && mapa.status === "fulfilled") {
        listaAstrace.innerHTML = '<li class="mapa-lista__vazio">Ainda não tem projeto com cidade no mapa. Publique o seu e seja a primeira!</li>';
    }
    if (sem) {
        semLocal.textContent = `E mais ${plural(sem, "projeto", "projetos")} de cidades que o mapa ainda não conhece.`;
        semLocal.hidden = false;
    }
    montarPinos();
    desenharPinos();
    caixa.classList.add("mapa-caixa--pronta");
    // Links antigos (?cidade=Recife-PE) e novos (?mulher=ada-lovelace) abrem o pin direto.
    const params = new URLSearchParams(location.search);
    const cidadePedida = cidades.find((c) => `${c.cidade}-${c.uf}` === params.get("cidade"));
    const mulherPedida = historicas.find((h) => h.id === params.get("mulher"));
    const pedido = cidadePedida ? idCidade(cidadePedida) : mulherPedida ? idHistorica(mulherPedida) : null;
    if (pedido)
        escolher(pedido, null, false);
}
void iniciar();
