import { api, el, esc, formatarTamanho, icone, mensagemDeErro, nomeDoFormato, postJson, preencherSelect, urlSegura, } from "./comum.js";
const POR_PAGINA = 12;
const CAMPOS_FILTRO = ["q", "tipo", "area", "nivel", "instituicao", "cidade", "identidade"];
const PINS = ["--pin-magenta", "--pin-violeta", "--pin-verde", "--pin-ambar", "--pin-azul"];
const CORES_CAPA = {
    computacao: "#c9dcf5",
    engenharias: "#f8d9a8",
    matematica: "#dccff5",
    fisica: "#c7cdf2",
    quimica: "#c4ecd8",
    biologicas: "#d2efc2",
    saude: "#f9cbd8",
    ambiental: "#dcedb6",
    humanas: "#f6d5c0",
    educacao: "#fbe5a0",
};
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
let opcoes = null;
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
    return CAMPOS_FILTRO.some((campo) => filtros[campo] !== "");
}
function sincronizarUrl(filtros) {
    const params = new URLSearchParams();
    for (const campo of CAMPOS_FILTRO) {
        if (filtros[campo])
            params.set(campo, filtros[campo]);
    }
    const busca = params.toString();
    history.replaceState(null, "", busca ? `?${busca}` : location.pathname);
}
function aplicarFiltrosDaUrl() {
    const params = new URLSearchParams(location.search);
    let algumSelect = false;
    for (const campo of CAMPOS_FILTRO) {
        const valor = params.get(campo);
        const controle = form.elements.namedItem(campo);
        if (valor && controle) {
            controle.value = valor;
            if (campo !== "q")
                algumSelect = true;
        }
    }
    if (algumSelect)
        alternarFiltros(true);
}
function preencherFiltros(o) {
    const select = (nome) => form.elements.namedItem(nome);
    preencherSelect(select("tipo"), o.tipos);
    preencherSelect(select("area"), o.areas);
    preencherSelect(select("nivel"), o.niveis);
    preencherSelect(select("instituicao"), o.instituicoes);
    preencherSelect(select("cidade"), o.cidades);
    preencherSelect(select("identidade"), o.identidades);
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
/** Rotação estável por projeto, entre -2.2 e 2.2 graus. */
function rotacao(id, escala = 1) {
    const x = Math.sin(id * 12.9898) * 43758.5453;
    return (((x - Math.floor(x)) * 4.4 - 2.2) * escala).toFixed(2);
}
function htmlCartao(c, variante) {
    const pin = PINS[c.id % PINS.length];
    const imagem = urlSegura(c.imagem_url);
    let foto = "";
    if (imagem) {
        foto = `<div class="cartao__foto"><img src="${esc(imagem)}" alt="" loading="lazy"></div>`;
    }
    else if (variante === "polaroid") {
        const cor = CORES_CAPA[c.area] ?? "var(--rosa-claro)";
        foto = `<div class="cartao__foto"><div class="capa" style="--cor-capa: ${cor}">${icone(c.icone)}</div></div>`;
    }
    const classes = ["cartao"];
    if (variante === "polaroid")
        classes.push("cartao--polaroid");
    if (!foto)
        classes.push("cartao--ficha");
    const enfeite = variante === "polaroid" ? "" : `<span class="pin" style="--cor-pin: var(${pin})" aria-hidden="true"></span>`;
    const resumo = foto ? "" : `<p class="cartao__resumo">${esc(c.resumo_curto)}</p>`;
    return `
    <li>
      <article class="${classes.join(" ")}"
        style="--rot: ${rotacao(c.id, variante === "polaroid" ? 1.3 : 1)}deg; --rot-fita: ${rotacao(c.id + 7, 2)}deg; --cor-ficha: var(${pin})">
        ${enfeite}
        ${foto}
        <p class="cartao__tipo">${icone(c.icone)}${esc(c.tipo_rotulo)}</p>
        <div class="cartao__corpo">
          <h3 class="cartao__titulo">
            <a class="cartao__link" href="/mural?projeto=${c.id}" data-id="${c.id}">${esc(c.titulo)}</a>
          </h3>
          <p class="cartao__area">${esc(c.area_rotulo)}</p>
          ${resumo}
          <p class="cartao__autora">${esc(c.autora)}, ${esc(c.ano)}${htmlClipe(c.materiais)}</p>
        </div>
      </article>
    </li>`;
}
function htmlClipe(quantidade) {
    if (!quantidade)
        return "";
    const texto = quantidade === 1 ? "1 arquivo" : `${quantidade} arquivos`;
    return `<span class="cartao__anexos" title="${texto}">${icone("clipe")}<span>${quantidade}</span>
    <span class="visualmente-oculto">${quantidade === 1 ? "arquivo anexado" : "arquivos anexados"}</span></span>`;
}
function htmlMateriais(p) {
    if (p.arquivos.length === 0)
        return "";
    const itens = p.arquivos
        .map((a) => {
        const url = urlSegura(a.url);
        if (!url)
            return "";
        return `
        <li>
          <a class="material" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
            ${icone(a.tipo === "imagem" ? "imagem" : "arquivo")}
            <span class="material__texto">
              <span class="material__nome">${esc(a.nome)}</span>
              <span class="material__info">${esc(nomeDoFormato(a.tipo))}, ${esc(formatarTamanho(a.tamanho))}</span>
            </span>
            ${icone("baixar")}
          </a>
        </li>`;
    })
        .join("");
    return `<h3 class="detalhe__subtitulo">Materiais</h3><ul class="materiais">${itens}</ul>`;
}
/** Foto grande + miniaturas. Sem fotos na galeria, mostra só a capa (se houver). */
function htmlGaleria(p, capa) {
    const urls = p.fotos.map((f) => urlSegura(f.url)).filter((u) => Boolean(u));
    if (urls.length === 0) {
        return capa ? `<figure class="detalhe__foto"><img src="${esc(capa)}" alt=""></figure>` : "";
    }
    const total = urls.length;
    const miniaturas = total > 1
        ? `<div class="galeria__miniaturas">
          ${urls
            .map((u, i) => `
            <button class="galeria__miniatura" type="button" data-foto="${esc(u)}" data-indice="${i + 1}"
              aria-label="Ver foto ${i + 1} de ${total}"${i === 0 ? ' aria-current="true"' : ""}>
              <img src="${esc(u)}" alt="">
            </button>`)
            .join("")}
        </div>`
        : "";
    return `
    <figure class="galeria">
      <div class="detalhe__foto galeria__principal">
        <img src="${esc(urls[0])}" alt="Foto 1 de ${total} do projeto ${esc(p.titulo)}" id="galeria-imagem">
      </div>
      ${miniaturas}
    </figure>`;
}
const HTML_CONVITE = `
  <li>
    <a class="postit postit--amarelo grade__convite" href="/mural/novo">
      <span class="pin" style="--cor-pin: var(--pin-magenta)" aria-hidden="true"></span>
      <strong>Fez um projeto?</strong>
      <span class="grade__convite-texto">Do TCC ao trabalho da feira de ciências, ele tem lugar aqui.</span>
      <span>Publicar o meu</span>
    </a>
  </li>`;
function htmlEsqueletos(quantidade) {
    return Array.from({ length: quantidade }, () => '<li><div class="esqueleto"></div></li>').join("");
}
function htmlVazio(comFiltro) {
    if (comFiltro) {
        return `
      <div class="postit postit--amarelo estado">
        <span class="pin" aria-hidden="true"></span>
        <h3>Nenhum projeto com esses filtros</h3>
        <p>Tente tirar um filtro ou buscar outra palavra.</p>
        <button class="botao botao--secundario" type="button" data-acao="limpar">Limpar filtros</button>
      </div>`;
    }
    return `
    <div class="postit postit--amarelo estado">
      <span class="pin" aria-hidden="true"></span>
      <h3>O mural ainda está vazio</h3>
      <p>Publique o primeiro projeto e abra caminho para as próximas.</p>
      <a class="botao botao--primario" href="/mural/novo">Publicar projeto</a>
    </div>`;
}
function htmlErro(mensagem) {
    return `
    <div class="postit postit--rosa estado" role="alert">
      <span class="pin" style="--cor-pin: var(--pin-violeta)" aria-hidden="true"></span>
      <h3>Não deu para carregar os projetos</h3>
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
        const dados = await api(`/api/projetos?${params}`);
        if (pedido !== pedidoAtual)
            return;
        const cartoes = dados.itens.map((c) => htmlCartao(c, "grade"));
        if (reiniciar && !temFiltro(filtros) && cartoes.length >= 5)
            cartoes.splice(4, 0, HTML_CONVITE);
        if (reiniciar) {
            grade.innerHTML = cartoes.join("");
        }
        else {
            const primeiroNovo = grade.children.length;
            grade.insertAdjacentHTML("beforeend", cartoes.join(""));
            grade.children[primeiroNovo]?.querySelector(".cartao__link")?.focus();
        }
        const sufixo = temFiltro(filtros) ? " encontrados" : "";
        contagem.textContent =
            dados.total === 1 ? `1 projeto${sufixo ? " encontrado" : ""}` : `${dados.total} projetos${sufixo}`;
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
            botaoMais.textContent = "Carregar mais projetos";
        }
    }
}
async function carregarDestaques() {
    try {
        const lista = await api("/api/projetos/destaques");
        if (lista.length === 0)
            return;
        destaquesLista.innerHTML = lista.map((c) => htmlCartao(c, "polaroid")).join("");
        destaques.hidden = false;
    }
    catch {
        // A faixa de destaques é opcional: sem ela, o mural continua funcionando.
    }
}
// ---------- Detalhe ----------
function itemFicha(rotulo, valor, link = false) {
    if (valor === null || valor === undefined || valor === "")
        return "";
    const url = link ? urlSegura(String(valor)) : null;
    const conteudo = url
        ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir link</a>`
        : esc(valor);
    return `<div><dt>${esc(rotulo)}</dt><dd>${conteudo}</dd></div>`;
}
function htmlDetalhe(p) {
    const imagem = urlSegura(p.imagem_url);
    const link = urlSegura(p.link_externo);
    const motivos = (opcoes?.motivos_denuncia ?? [])
        .map((m) => `<option value="${esc(m.valor)}">${esc(m.rotulo)}</option>`)
        .join("");
    return `
    <p class="cartao__tipo">${icone(p.icone)}${esc(p.tipo_rotulo)}</p>
    <h2 id="detalhe-titulo">${esc(p.titulo)}</h2>
    <p class="detalhe__autora">por ${esc(p.autora)}</p>
    ${htmlGaleria(p, imagem)}
    <p class="detalhe__resumo">${esc(p.resumo)}</p>
    ${htmlMateriais(p)}
    <dl class="ficha-dados">
      ${itemFicha("Área", p.area_rotulo)}
      ${itemFicha("Ano", p.ano)}
      ${itemFicha("Nível", p.nivel_rotulo)}
      ${itemFicha("Instituição", p.instituicao)}
      ${itemFicha("Cidade", p.cidade)}
      ${p.detalhes.map((d) => itemFicha(d.rotulo, d.valor, d.e_link)).join("")}
    </dl>
    <div class="detalhe__acoes">
      ${link
        ? `<a class="botao botao--primario" href="${esc(link)}" target="_blank" rel="noopener noreferrer">
               Abrir link do projeto ${icone("externo")}
             </a>`
        : ""}
      <button class="denunciar" type="button" id="denunciar" aria-expanded="false" aria-controls="denuncia">
        Denunciar projeto
      </button>
    </div>
    <form class="denuncia" id="denuncia" data-id="${p.id}" novalidate hidden>
      <h3>Denunciar projeto</h3>
      <p>A equipe revisa toda denúncia. Projetos com várias denúncias saem do mural até a revisão.</p>
      <label for="denuncia-motivo">Motivo</label>
      <select id="denuncia-motivo" name="motivo" required>
        <option value="">Escolha um motivo</option>
        ${motivos}
      </select>
      <label for="denuncia-comentario">Conte mais (opcional)</label>
      <textarea id="denuncia-comentario" name="comentario" rows="3" maxlength="1000"></textarea>
      <div class="denuncia__acoes">
        <button class="botao botao--secundario" type="submit">Enviar denúncia</button>
        <button class="botao botao--texto" type="button" data-acao="cancelar-denuncia">Cancelar</button>
      </div>
      <p class="denuncia__resultado" id="denuncia-resultado" role="status"></p>
    </form>`;
}
async function abrirDetalhe(id, origem, mensagem) {
    focoAntesDoDetalhe = origem ?? document.activeElement;
    conteudoDetalhe.innerHTML = '<p class="carregando" id="detalhe-titulo">Carregando projeto…</p>';
    if (!dialogo.open)
        dialogo.showModal();
    try {
        const projeto = await api(`/api/projetos/${id}`);
        const aviso = mensagem ? `<p class="detalhe__aviso" role="status">${esc(mensagem)}</p>` : "";
        conteudoDetalhe.innerHTML = aviso + htmlDetalhe(projeto);
    }
    catch (erro) {
        conteudoDetalhe.innerHTML = `
      <h2 id="detalhe-titulo">Projeto indisponível</h2>
      <p>${esc(mensagemDeErro(erro))}</p>`;
    }
}
async function enviarDenuncia(formDenuncia) {
    const resultado = el("denuncia-resultado");
    const dados = new FormData(formDenuncia);
    const motivo = String(dados.get("motivo") ?? "");
    if (!motivo) {
        resultado.textContent = "Escolha o motivo da denúncia.";
        el("denuncia-motivo").focus();
        return;
    }
    const botao = formDenuncia.querySelector('button[type="submit"]');
    if (botao)
        botao.disabled = true;
    try {
        const resposta = await postJson(`/api/projetos/${formDenuncia.dataset.id}/denuncias`, {
            motivo,
            comentario: dados.get("comentario"),
        });
        formDenuncia.innerHTML = `<p class="denuncia__resultado" role="status">${esc(resposta.mensagem)}</p>`;
        document.getElementById("denunciar")?.remove();
    }
    catch (erro) {
        resultado.textContent = mensagemDeErro(erro);
        if (botao)
            botao.disabled = false;
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
        if (e.target.tagName === "SELECT")
            aoMudarFiltros();
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
            dialogo.close(); // clique fora da folha
    });
    dialogo.addEventListener("close", () => focoAntesDoDetalhe?.focus());
    conteudoDetalhe.addEventListener("click", (e) => {
        const alvo = e.target;
        const miniatura = alvo.closest(".galeria__miniatura");
        if (miniatura) {
            const imagem = el("galeria-imagem");
            imagem.src = miniatura.dataset.foto;
            imagem.alt = imagem.alt.replace(/^Foto \d+/, `Foto ${miniatura.dataset.indice}`);
            conteudoDetalhe.querySelectorAll(".galeria__miniatura").forEach((b) => b.removeAttribute("aria-current"));
            miniatura.setAttribute("aria-current", "true");
            return;
        }
        const formDenuncia = document.getElementById("denuncia");
        if (!formDenuncia)
            return;
        if (alvo.closest("#denunciar")) {
            const abrir = formDenuncia.hidden;
            formDenuncia.hidden = !abrir;
            el("denunciar").setAttribute("aria-expanded", String(abrir));
            if (abrir)
                el("denuncia-motivo").focus();
        }
        if (alvo.closest('[data-acao="cancelar-denuncia"]')) {
            formDenuncia.hidden = true;
            el("denunciar").setAttribute("aria-expanded", "false");
            el("denunciar").focus();
        }
    });
    conteudoDetalhe.addEventListener("submit", (e) => {
        e.preventDefault();
        void enviarDenuncia(e.target);
    });
}
function preencherCartaz() {
    const hoje = new Date();
    el("cartaz-mes").textContent = hoje.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    el("cartaz-dia").textContent = String(hoje.getDate());
}
async function iniciar() {
    preencherCartaz();
    ligarEventos();
    try {
        opcoes = await api("/api/mural/opcoes");
        preencherFiltros(opcoes);
    }
    catch {
        // Sem as opções, os filtros ficam só com "Todos"; a busca por texto continua funcionando.
    }
    const params = new URLSearchParams(location.search);
    aplicarFiltrosDaUrl();
    const filtros = lerFiltros();
    botaoLimpar.hidden = !temFiltro(filtros);
    sincronizarUrl(filtros); // tira ?projeto= e ?publicado= da barra de endereço
    void carregarDestaques();
    await carregar(true);
    const publicado = Number(params.get("publicado"));
    const projeto = Number(params.get("projeto"));
    if (publicado) {
        void abrirDetalhe(publicado, undefined, "Projeto publicado no mural.");
    }
    else if (projeto) {
        void abrirDetalhe(projeto);
    }
}
void iniciar();
