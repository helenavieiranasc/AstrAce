// Perfil: lista das próprias publicações (projetos do mural), com ver, editar e excluir.
import { ErroApi, api, el, esc, icone, mensagemDeErro, urlSegura } from "./comum.js";
const lista = el("minhas-lista");
const estadoLista = el("minhas-estado");
const contagem = el("minhas-contagem");
const aviso = el("aviso");
const dialogoEditar = el("dialogo-editar");
const formEditar = el("form-editar");
const camposEditar = el("editar-campos");
const errosEditar = el("editar-erros");
const salvarEdicao = el("editar-salvar");
const statusEdicao = el("editar-status");
const dialogoExcluir = el("dialogo-excluir");
const confirmarExclusao = el("excluir-confirmar");
const statusExclusao = el("excluir-status");
let publicacoes = [];
let editando = null;
let excluindo = null;
let quemAbriu = null;
// ---------- Aviso rápido ----------
let avisoTimer = 0;
function avisar(texto) {
    aviso.textContent = texto;
    aviso.hidden = false;
    window.clearTimeout(avisoTimer);
    avisoTimer = window.setTimeout(() => (aviso.hidden = true), 4000);
}
if (!aviso.hidden) {
    avisoTimer = window.setTimeout(() => (aviso.hidden = true), 4000);
    history.replaceState(null, "", location.pathname); // tira o ?salvo=1
}
// ---------- Lista ----------
function data(iso) {
    const quando = new Date(iso.endsWith("Z") ? iso : `${iso}Z`); // o servidor guarda em UTC
    return quando.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}
function plural(n, um, varios) {
    return `${n} ${n === 1 ? um : varios}`;
}
function htmlItem(p) {
    const capa = urlSegura(p.imagem_url);
    const anexos = [
        p.arquivos ? plural(p.arquivos, "arquivo", "arquivos") : "",
        p.fotos ? plural(p.fotos, "foto", "fotos") : "",
    ].filter(Boolean);
    return `
    <li class="publicacao" data-id="${p.id}">
      <div class="publicacao__capa" aria-hidden="true">
        ${capa ? `<img src="${esc(capa)}" alt="" loading="lazy">` : icone(p.icone)}
      </div>
      <div class="publicacao__texto">
        <h3 class="publicacao__titulo">${esc(p.titulo)}</h3>
        <p class="publicacao__meta">${esc(p.tipo_rotulo)} · ${esc(p.area_rotulo)} · ${esc(p.ano)}</p>
        <p class="publicacao__meta">
          <span>Publicado em ${esc(data(p.criado_em))}</span>
          <span class="publicacao__estado publicacao__estado--${esc(p.estado.valor)}">${esc(p.estado.rotulo)}</span>
        </p>
        ${p.estado.ajuda ? `<p class="publicacao__ajuda">${esc(p.estado.ajuda)}</p>` : ""}
        <p class="publicacao__numeros">
          <span>${icone("estrela")}${esc(plural(p.estrelas, "estrela", "estrelas"))}</span>
          ${anexos.length ? `<span>${icone("clipe")}${esc(anexos.join(" e "))}</span>` : ""}
        </p>
      </div>
      <div class="publicacao__acoes">
        ${p.estado.valor === "oculto" ? "" : `<a class="botao botao--texto" href="${esc(p.url)}">Ver no mural</a>`}
        <button class="botao botao--secundario" type="button" data-editar="${p.id}"
                aria-label="Editar ${esc(p.titulo)}">Editar</button>
        <button class="botao botao--texto publicacao__excluir" type="button" data-excluir="${p.id}"
                aria-label="Excluir ${esc(p.titulo)}">Excluir</button>
      </div>
    </li>`;
}
function desenharLista() {
    lista.innerHTML = publicacoes.map(htmlItem).join("");
    lista.setAttribute("aria-busy", "false");
    contagem.textContent = publicacoes.length ? plural(publicacoes.length, "publicação", "publicações") : "";
    estadoLista.innerHTML = publicacoes.length
        ? ""
        : `<div class="minhas__vazio">
         <p class="minhas__vazio-titulo">Você ainda não publicou nada.</p>
         <p>Mostre um trabalho seu: TCC, pôster, iniciação científica, app, projeto social ou protótipo.</p>
         <a class="botao botao--primario" href="/mural/novo">Publicar meu primeiro projeto</a>
       </div>`;
}
async function carregarLista() {
    try {
        const resposta = await api("/api/minhas-publicacoes");
        publicacoes = resposta.itens;
        desenharLista();
    }
    catch (erro) {
        if (erro instanceof ErroApi && erro.status === 401) {
            window.location.href = "/";
            return;
        }
        lista.setAttribute("aria-busy", "false");
        estadoLista.innerHTML = `
      <div class="minhas__vazio" role="alert">
        <p class="minhas__vazio-titulo">Não conseguimos carregar suas publicações.</p>
        <p>${esc(mensagemDeErro(erro))}</p>
        <button class="botao botao--secundario" type="button" id="minhas-tentar">Tentar de novo</button>
      </div>`;
        el("minhas-tentar").addEventListener("click", () => {
            estadoLista.innerHTML = '<p class="minhas__carregando">Carregando suas publicações…</p>';
            carregarLista();
        });
    }
}
// ---------- Janelas (editar e excluir) ----------
function abrir(dialogo, origem) {
    quemAbriu = origem;
    dialogo.showModal();
}
for (const dialogo of [dialogoEditar, dialogoExcluir]) {
    dialogo.addEventListener("click", (evento) => {
        const alvo = evento.target;
        if (alvo === dialogo || alvo.closest("[data-fechar]"))
            dialogo.close(); // fundo ou "Cancelar"
    });
    dialogo.addEventListener("close", () => {
        quemAbriu?.focus();
        quemAbriu = null;
    });
}
// ---------- Editar ----------
function idDoCampo(chave) {
    return `ed-${chave.replace(".", "-")}`;
}
function campoTexto(chave, rotulo, valor, extra = "") {
    const id = idDoCampo(chave);
    return `
    <div class="campo">
      <label for="${id}">${esc(rotulo)}</label>
      <input id="${id}" name="${esc(chave)}" value="${esc(valor)}" aria-describedby="erro-${id}" ${extra}>
      <p class="campo__erro" id="erro-${id}" hidden></p>
    </div>`;
}
function campoSelecao(chave, rotulo, valor, opcoes, vazio) {
    const id = idDoCampo(chave);
    const itens = opcoes
        .map((o) => `<option value="${esc(o.valor)}"${o.valor === valor ? " selected" : ""}>${esc(o.rotulo)}</option>`)
        .join("");
    return `
    <div class="campo">
      <label for="${id}">${esc(rotulo)}</label>
      <select id="${id}" name="${esc(chave)}" aria-describedby="erro-${id}">
        <option value="">${esc(vazio)}</option>${itens}
      </select>
      <p class="campo__erro" id="erro-${id}" hidden></p>
    </div>`;
}
function montarFormulario(dados) {
    const p = dados.projeto;
    const extras = dados.campos_extras
        .map((c) => {
        const chave = `detalhes.${c.nome}`;
        const rotulo = c.obrigatorio ? `${c.rotulo} *` : c.rotulo;
        const valor = p.detalhes[c.nome] ?? "";
        if (c.tipo === "selecao")
            return campoSelecao(chave, rotulo, valor, c.opcoes ?? [], "Escolha");
        return campoTexto(chave, rotulo, valor, c.tipo === "url" ? 'type="url" placeholder="https://"' : 'maxlength="300"');
    })
        .join("");
    const anexos = [
        p.arquivos ? plural(p.arquivos, "arquivo", "arquivos") : "",
        p.fotos ? plural(p.fotos, "foto", "fotos") : "",
    ].filter(Boolean);
    el("editar-intro").textContent =
        `${p.tipo_rotulo}. Campos com * são obrigatórios. ` +
            (anexos.length ? `Os ${anexos.join(" e ")} continuam como estão.` : "Esta publicação não tem arquivos.");
    camposEditar.innerHTML = `
    ${campoTexto("titulo", "Título *", p.titulo, 'maxlength="160" required')}
    <div class="campo">
      <label for="ed-resumo">Resumo *</label>
      <textarea id="ed-resumo" name="resumo" rows="6" maxlength="3000" required
                aria-describedby="ed-resumo-ajuda erro-ed-resumo">${esc(p.resumo)}</textarea>
      <small id="ed-resumo-ajuda"><span id="ed-resumo-contador">${p.resumo.length}</span> de 3000 caracteres.</small>
      <p class="campo__erro" id="erro-ed-resumo" hidden></p>
    </div>
    <div class="linha">
      ${campoSelecao("area", "Área *", p.area, dados.opcoes.areas, "Escolha")}
      ${campoTexto("ano", "Ano *", String(p.ano), 'type="number" inputmode="numeric" min="1950" required')}
      ${campoSelecao("nivel", "Nível", p.nivel, dados.opcoes.niveis, "O do meu perfil")}
    </div>
    ${extras ? `<div class="linha">${extras}</div>` : ""}
    <div class="linha">
      ${campoTexto("instituicao", "Instituição", p.instituicao, 'maxlength="160"')}
      ${campoTexto("cidade", "Cidade", p.cidade, 'maxlength="120"')}
    </div>
    ${campoTexto("link_externo", dados.material?.rotulo_link ?? "Link do projeto", p.link_externo, 'type="url" placeholder="https://"')}`;
    const resumo = el("ed-resumo");
    resumo.addEventListener("input", () => (el("ed-resumo-contador").textContent = String(resumo.value.length)));
}
function limparErrosEdicao() {
    errosEditar.hidden = true;
    camposEditar.querySelectorAll(".campo__erro").forEach((p) => (p.hidden = true));
    camposEditar.querySelectorAll(".campo--erro").forEach((c) => c.classList.remove("campo--erro"));
    camposEditar.querySelectorAll("[aria-invalid]").forEach((c) => c.removeAttribute("aria-invalid"));
}
function mostrarErrosEdicao(erros) {
    limparErrosEdicao();
    const itens = [];
    for (const [chave, mensagem] of Object.entries(erros)) {
        const id = idDoCampo(chave);
        const campo = document.getElementById(id);
        const caixa = document.getElementById(`erro-${id}`);
        if (campo && caixa) {
            caixa.textContent = mensagem;
            caixa.hidden = false;
            campo.closest(".campo")?.classList.add("campo--erro");
            campo.setAttribute("aria-invalid", "true");
            const rotulo = document.querySelector(`label[for="${id}"]`)?.textContent?.replace(" *", "") ?? chave;
            itens.push(`<li><a href="#${id}">${esc(rotulo)}</a>: ${esc(mensagem)}</li>`);
        }
        else {
            itens.push(`<li>${esc(mensagem)}</li>`);
        }
    }
    errosEditar.innerHTML = `<p>Confira ${itens.length === 1 ? "o campo" : "os campos"}:</p><ul>${itens.join("")}</ul>`;
    errosEditar.hidden = false;
    errosEditar.focus();
}
async function abrirEdicao(id, origem) {
    editando = id;
    statusEdicao.textContent = "";
    limparErrosEdicao();
    camposEditar.innerHTML = '<p class="carregando">Carregando…</p>';
    salvarEdicao.disabled = true;
    abrir(dialogoEditar, origem);
    try {
        montarFormulario(await api(`/api/minhas-publicacoes/${id}`));
        salvarEdicao.disabled = false;
        el("ed-titulo").focus();
    }
    catch (erro) {
        camposEditar.innerHTML = `<p class="campo__erro" role="alert">${esc(mensagemDeErro(erro))}</p>`;
    }
}
formEditar.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (editando === null)
        return;
    const valor = (chave) => document.getElementById(idDoCampo(chave))?.value.trim() ?? "";
    const detalhes = {};
    camposEditar.querySelectorAll("[name^='detalhes.']").forEach((campo) => {
        detalhes[campo.name.slice("detalhes.".length)] = campo.value.trim();
    });
    salvarEdicao.disabled = true;
    salvarEdicao.textContent = "Salvando…";
    statusEdicao.textContent = "";
    try {
        const resposta = await api(`/api/minhas-publicacoes/${editando}`, {
            method: "PATCH",
            body: JSON.stringify({
                titulo: valor("titulo"),
                resumo: el("ed-resumo").value.trim(),
                area: valor("area"),
                ano: valor("ano"),
                nivel: valor("nivel"),
                instituicao: valor("instituicao"),
                cidade: valor("cidade"),
                link_externo: valor("link_externo"),
                detalhes,
            }),
        });
        publicacoes = publicacoes.map((p) => (p.id === resposta.item.id ? resposta.item : p));
        desenharLista();
        dialogoEditar.close();
        quemAbriu = lista.querySelector(`[data-editar="${resposta.item.id}"]`);
        quemAbriu?.focus();
        avisar("Publicação atualizada.");
    }
    catch (erro) {
        if (erro instanceof ErroApi && erro.status === 422)
            mostrarErrosEdicao(erro.erros);
        else
            statusEdicao.textContent = mensagemDeErro(erro);
    }
    finally {
        salvarEdicao.disabled = false;
        salvarEdicao.textContent = "Salvar alterações";
    }
});
// ---------- Excluir ----------
function abrirExclusao(id, origem) {
    const publicacao = publicacoes.find((p) => p.id === id);
    if (!publicacao)
        return;
    excluindo = id;
    statusExclusao.textContent = "";
    el("excluir-titulo").textContent = `Excluir “${publicacao.titulo}”?`;
    el("excluir-texto").textContent =
        "A publicação sai do mural e é apagada com os arquivos, as fotos e as estrelas. Não dá para desfazer.";
    abrir(dialogoExcluir, origem);
    dialogoExcluir.querySelector("[data-fechar]")?.focus(); // o foco começa no "Cancelar"
}
confirmarExclusao.addEventListener("click", async () => {
    if (excluindo === null)
        return;
    confirmarExclusao.disabled = true;
    confirmarExclusao.textContent = "Excluindo…";
    try {
        await api(`/api/minhas-publicacoes/${excluindo}`, { method: "DELETE" });
        publicacoes = publicacoes.filter((p) => p.id !== excluindo);
        quemAbriu = null;
        dialogoExcluir.close();
        desenharLista();
        el("titulo-minhas").focus();
        avisar("Publicação excluída.");
    }
    catch (erro) {
        statusExclusao.textContent = mensagemDeErro(erro);
    }
    finally {
        confirmarExclusao.disabled = false;
        confirmarExclusao.textContent = "Excluir de vez";
    }
});
lista.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-editar], [data-excluir]");
    if (!botao)
        return;
    if (botao.dataset.editar)
        abrirEdicao(Number(botao.dataset.editar), botao);
    else
        abrirExclusao(Number(botao.dataset.excluir), botao);
});
carregarLista();
