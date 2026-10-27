import { api, el, esc, icone, mensagemDeErro, preencherSelect, urlSegura, } from "./comum.js";
const POR_PAGINA = 12;
const CAMPOS_FILTRO = [
    "q",
    "area",
    "categoria",
    "cientista_brasileira",
    "cientista_negra",
    "ordem",
];
const PINS = ["--pin-magenta", "--pin-violeta", "--pin-verde", "--pin-ambar", "--pin-azul"];
const form = el("filtros");
const grade = el("grade");
const estado = el("estado");
const contagem = el("contagem");
const botaoMais = el("carregar-mais");
const destaques = el("destaques");
const destaquesLista = el("destaques-lista");
const dialogo = el("detalhe");
const conteudoDetalhe = el("detalhe-conteudo");
const aviso = el("aviso");
const botaoAlternar = el("filtros-alternar");
const botaoLimpar = el("filtros-limpar");
let pagina = 1;
let pedidoAtual = 0;
let focoAntesDoDetalhe = null;
let temporizadorBusca;
let temporizadorAviso;
// ---------- Filtros ----------
function lerFiltros() {
    const dados = new FormData(form);
    return Object.fromEntries(CAMPOS_FILTRO.map((campo) => [campo, String(dados.get(campo) ?? "").trim()]));
}
function temFiltro(filtros) {
    return CAMPOS_FILTRO.some((campo) => {
        if (campo === "ordem")
            return filtros.ordem !== "" && filtros.ordem !== "recentes";
        return filtros[campo] !== "";
    });
}
function sincronizarUrl(filtros) {
    const params = new URLSearchParams();
    for (const campo of CAMPOS_FILTRO) {
        if (campo === "ordem" && filtros.ordem === "recentes")
            continue;
        if (filtros[campo])
            params.set(campo, filtros[campo]);
    }
    const busca = params.toString();
    history.replaceState(null, "", busca ? `?${busca}` : location.pathname);
}
function aplicarFiltrosDaUrl() {
    const params = new URLSearchParams(location.search);
    let algumExtra = false;
    for (const campo of CAMPOS_FILTRO) {
        const valor = params.get(campo);
        const controle = form.elements.namedItem(campo);
        if (valor && controle) {
            if (controle instanceof HTMLInputElement && controle.type === "checkbox") {
                controle.checked = valor === "1" || valor === "true" || valor === "on";
            }
            else {
                controle.value = valor;
            }
            if (campo !== "q" && campo !== "ordem")
                algumExtra = true;
        }
    }
    if (algumExtra)
        alternarFiltros(true);
}
function preencherFiltros(o) {
    const select = (nome) => form.elements.namedItem(nome);
    preencherSelect(select("area"), o.areas);
    preencherSelect(select("categoria"), o.categorias);
}
function alternarFiltros(abrir) {
    const aberto = abrir ?? botaoAlternar.getAttribute("aria-expanded") !== "true";
    botaoAlternar.setAttribute("aria-expanded", String(aberto));
    form.classList.toggle("filtros--aberto", aberto);
}
function aoMudarFiltros() {
    const filtros = lerFiltros();
    botaoLimpar.hidden = !temFiltro(filtros);
    sincronizarUrl(filtros);
    void carregar(true);
}
// ---------- Cartões ----------
function rotacao(id, escala = 1) {
    const x = Math.sin(id * 15.731) * 43758.5453;
    return (((x - Math.floor(x)) * 3.0 - 1.5) * escala).toFixed(2);
}
function htmlSelos(selos) {
    if (selos.length === 0)
        return "";
    const itens = selos
        .map((s) => `<li class="selo selo--${esc(s.valor)}">${esc(s.rotulo)}</li>`)
        .join("");
    return `<ul class="selos" aria-label="Recortes de protagonismo">${itens}</ul>`;
}
function htmlCartao(n, variante) {
    const pin = PINS[n.id % PINS.length];
    const classes = ["cartao", "cartao--recorte"];
    if (variante === "destaque")
        classes.push("cartao--recorte-destaque");
    const enfeite = variante === "destaque"
        ? ""
        : `<span class="pin" style="--cor-pin: var(${pin})" aria-hidden="true"></span>`;
    return `
    <li>
      <article class="${classes.join(" ")}"
        style="--rot: ${rotacao(n.id, variante === "destaque" ? 1.2 : 1)}deg; --rot-fita: ${rotacao(n.id + 5, 2)}deg; --cor-ficha: var(${pin})">
        ${enfeite}
        <div>
          <div class="recorte__topo">
            <span class="recorte__categoria">${icone(n.icone)}${esc(n.categoria_rotulo)}</span>
            <span>${esc(n.data_publicacao_rotulo)}</span>
          </div>
          <h3 class="cartao__titulo">
            <a class="cartao__link" href="/noticias?noticia=${n.id}" data-id="${n.id}">${esc(n.titulo)}</a>
          </h3>
          <p class="recorte__protagonista">${esc(n.cientista)}</p>
          ${n.instituicao ? `<p class="recorte__instituicao">${esc(n.instituicao)}</p>` : ""}
          ${htmlSelos(n.selos)}
          <p class="cartao__resumo">${esc(n.resumo_curto)}</p>
        </div>
        <div class="recorte__rodape">
          <span class="recorte__area">${esc(n.area_rotulo)}</span>
          <span>Fonte: ${esc(n.fonte_nome)}</span>
        </div>
      </article>
    </li>`;
}
function htmlEsqueletos(quantidade) {
    return Array.from({ length: quantidade }, () => '<li><div class="esqueleto"></div></li>').join("");
}
function htmlVazio(comFiltro) {
    if (comFiltro) {
        return `
      <div class="postit postit--amarelo estado">
        <span class="pin" aria-hidden="true"></span>
        <h3>Nenhuma descoberta com esses filtros</h3>
        <p>Tente limpar algum filtro ou buscar por outra área ou cientista.</p>
        <button class="botao botao--secundario" type="button" data-acao="limpar">Limpar filtros</button>
      </div>`;
    }
    return `
    <div class="postit postit--amarelo estado">
      <span class="pin" aria-hidden="true"></span>
      <h3>Ainda não há notícias publicadas</h3>
      <p>Novos recortes de descobertas científicas serão adicionados em breve.</p>
    </div>`;
}
function htmlErro(mensagem) {
    return `
    <div class="postit postit--rosa estado" role="alert">
      <span class="pin" style="--cor-pin: var(--pin-violeta)" aria-hidden="true"></span>
      <h3>Não deu para carregar as notícias</h3>
      <p>${esc(mensagem)}</p>
      <button class="botao botao--secundario" type="button" data-acao="tentar">Tentar de novo</button>
    </div>`;
}
// ---------- Carregamento ----------
async function carregar(reiniciar) {
    const pedido = ++pedidoAtual;
    const filtros = lerFiltros();
    if (reiniciar) {
        pagina = 1;
        grade.innerHTML = htmlEsqueletos(6);
        grade.setAttribute("aria-busy", "true");
        estado.innerHTML = "";
        botaoMais.hidden = true;
    }
    else {
        pagina += 1;
        botaoMais.disabled = true;
        botaoMais.textContent = "Carregando…";
    }
    const params = new URLSearchParams({ pagina: String(pagina), por_pagina: String(POR_PAGINA) });
    for (const campo of CAMPOS_FILTRO) {
        if (filtros[campo])
            params.set(campo, filtros[campo]);
    }
    try {
        const dados = await api(`/api/noticias?${params}`);
        if (pedido !== pedidoAtual)
            return;
        const cartoes = dados.itens.map((n) => htmlCartao(n, "grade"));
        if (reiniciar) {
            grade.innerHTML = cartoes.join("");
        }
        else {
            const primeiroNovo = grade.children.length;
            grade.insertAdjacentHTML("beforeend", cartoes.join(""));
            grade.children[primeiroNovo]?.querySelector(".cartao__link")?.focus();
        }
        const sufixo = temFiltro(filtros) ? " encontradas" : "";
        contagem.textContent =
            dados.total === 1 ? `1 descoberta${sufixo ? " encontrada" : ""}` : `${dados.total} descobertas${sufixo}`;
        botaoMais.hidden = !dados.tem_mais;
        if (dados.total === 0)
            estado.innerHTML = htmlVazio(temFiltro(filtros));
    }
    catch (erro) {
        if (pedido !== pedidoAtual)
            return;
        if (reiniciar) {
            grade.innerHTML = "";
            contagem.textContent = "";
            estado.innerHTML = htmlErro(mensagemDeErro(erro));
        }
        else {
            pagina -= 1;
            avisar(mensagemDeErro(erro));
        }
    }
    finally {
        if (pedido === pedidoAtual) {
            grade.removeAttribute("aria-busy");
            botaoMais.disabled = false;
            botaoMais.textContent = "Carregar mais notícias";
        }
    }
}
async function carregarDestaques() {
    try {
        const lista = await api("/api/noticias/destaques");
        if (lista.length === 0)
            return;
        destaquesLista.innerHTML = lista.map((n) => htmlCartao(n, "destaque")).join("");
        destaques.hidden = false;
    }
    catch {
        // Destaques são opcionais.
    }
}
// ---------- Detalhe ----------
function itemFicha(rotulo, valor) {
    if (valor === null || valor === undefined || valor === "")
        return "";
    return `<div><dt>${esc(rotulo)}</dt><dd>${esc(valor)}</dd></div>`;
}
function htmlDetalhe(n) {
    const link = urlSegura(n.link_fonte);
    const urlVagasArea = `/vagas?area=${encodeURIComponent(n.area)}`;
    const urlMuralArea = `/mural?area=${encodeURIComponent(n.area)}`;
    return `
    <p class="cartao__tipo">${icone(n.icone)}${esc(n.categoria_rotulo)}</p>
    <h2 id="detalhe-titulo">${esc(n.titulo)}</h2>
    <p class="detalhe__organizacao">${esc(n.cientista)}</p>
    ${htmlSelos(n.selos)}
    <p class="detalhe__resumo">${esc(n.resumo)}</p>
    <dl class="ficha-dados">
      ${itemFicha("Cientista / Protagonista", n.cientista)}
      ${itemFicha("Instituição", n.instituicao)}
      ${itemFicha("Área", n.area_rotulo)}
      ${itemFicha("Fonte", n.fonte_nome)}
      ${itemFicha("Publicação", n.data_publicacao_rotulo)}
    </dl>
    <div class="detalhe__ponte">
      <h3>Inspire-se e dê o próximo passo</h3>
      <p>Gostou dessa descoberta em <strong>${esc(n.area_rotulo)}</strong>? Veja oportunidades e trabalhos de outras mulheres nessa mesma área:</p>
      <div class="detalhe__ponte-botoes">
        <a class="botao botao--secundario" href="${esc(urlVagasArea)}">Ver vagas em ${esc(n.area_rotulo)}</a>
        <a class="botao botao--secundario" href="${esc(urlMuralArea)}">Ver projetos no Mural</a>
      </div>
    </div>
    <div class="detalhe__acoes">
      ${link
        ? `<a class="botao botao--primario botao--grande" href="${esc(link)}" target="_blank" rel="noopener noreferrer">
               Ler fonte / matéria original ${icone("externo")}
             </a>`
        : ""}
    </div>`;
}
async function abrirDetalhe(id, origem) {
    focoAntesDoDetalhe = origem ?? document.activeElement;
    conteudoDetalhe.innerHTML = '<p class="carregando" id="detalhe-titulo">Carregando notícia…</p>';
    if (!dialogo.open)
        dialogo.showModal();
    try {
        const noticia = await api(`/api/noticias/${id}`);
        conteudoDetalhe.innerHTML = htmlDetalhe(noticia);
    }
    catch (erro) {
        conteudoDetalhe.innerHTML = `
      <h2 id="detalhe-titulo">Notícia indisponível</h2>
      <p>${esc(mensagemDeErro(erro))}</p>`;
    }
}
// ---------- Aviso ----------
function avisar(texto) {
    aviso.textContent = texto;
    aviso.hidden = false;
    window.clearTimeout(temporizadorAviso);
    temporizadorAviso = window.setTimeout(() => {
        aviso.hidden = true;
    }, 4500);
}
// ---------- Eventos ----------
function abrirAoClicar(evento) {
    const link = evento.target.closest(".cartao__link");
    if (!link)
        return;
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey)
        return;
    evento.preventDefault();
    void abrirDetalhe(Number(link.dataset.id), link);
}
function ligarEventos() {
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        window.clearTimeout(temporizadorBusca);
        aoMudarFiltros();
    });
    form.addEventListener("change", (e) => {
        const alvo = e.target;
        if (alvo.tagName === "SELECT" || (alvo instanceof HTMLInputElement && alvo.type === "checkbox")) {
            aoMudarFiltros();
        }
    });
    form.addEventListener("input", (e) => {
        if (e.target.name !== "q")
            return;
        window.clearTimeout(temporizadorBusca);
        temporizadorBusca = window.setTimeout(aoMudarFiltros, 300);
    });
    form.addEventListener("reset", () => {
        window.setTimeout(aoMudarFiltros, 0);
    });
    botaoAlternar.addEventListener("click", () => alternarFiltros());
    grade.addEventListener("click", abrirAoClicar);
    destaquesLista.addEventListener("click", abrirAoClicar);
    botaoMais.addEventListener("click", () => void carregar(false));
    estado.addEventListener("click", (e) => {
        const acao = e.target.closest("[data-acao]")?.dataset.acao;
        if (acao === "limpar")
            form.reset();
        if (acao === "tentar")
            void carregar(true);
    });
    el("detalhe-fechar").addEventListener("click", () => dialogo.close());
    dialogo.addEventListener("click", (e) => {
        if (e.target === dialogo)
            dialogo.close();
    });
    dialogo.addEventListener("close", () => focoAntesDoDetalhe?.focus());
}
async function iniciar() {
    ligarEventos();
    try {
        const opcoes = await api("/api/noticias/opcoes");
        preencherFiltros(opcoes);
    }
    catch {
        // Continua funcionando com filtros padrão.
    }
    const params = new URLSearchParams(location.search);
    aplicarFiltrosDaUrl();
    const filtros = lerFiltros();
    botaoLimpar.hidden = !temFiltro(filtros);
    sincronizarUrl(filtros);
    void carregarDestaques();
    await carregar(true);
    const noticiaId = Number(params.get("noticia"));
    if (noticiaId) {
        void abrirDetalhe(noticiaId);
    }
}
void iniciar();
