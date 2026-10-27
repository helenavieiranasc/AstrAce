// Cadastro inicial do perfil, logo depois do primeiro login com Google.
import { EXTENSOES_IMAGEM, ErroApi, api, conferirArquivo, el, enviarArquivo, esc, mensagemDeErro, postJson, preencherSelect, urlSegura, } from "./comum.js";
const form = el("form-perfil");
const salvar = el("salvar");
const status = el("status");
const resumoErros = el("resumo-erros");
const campoFoto = el("campo-foto");
const moldura = el("foto-moldura");
const iniciais = el("foto-iniciais");
const entradaFoto = el("foto");
const removerFoto = el("foto-remover");
const apelido = el("apelido");
const nivel = el("nivel");
const estado = el("estado");
const campoCidade = el("campo-cidade");
const ajudaCidade = el("cidade-ajuda");
const campoEscola = el("campo-escola");
const campoFormacoes = el("campo-formacoes");
const listaFormacoes = el("formacoes");
const adicionarFormacao = el("formacao-adicionar");
const listaIdentidades = el("identidades");
const CAMPOS_SIMPLES = ["apelido", "nivel", "area_interesse"];
const ROTULOS = {
    apelido: "Como quer ser chamada",
    nivel: "Fase dos estudos",
    area_interesse: "Área de interesse",
    data_nascimento: "Data de nascimento",
    estado: "Estado",
    foto: "Foto de perfil",
};
const MAX_FORMACOES = 4;
let fotoId = null;
let fotoRemovida = false;
let enviandoFoto = false;
let urlPreviaLocal = null;
let cidadesExistentes = [];
// ---------- Foto ----------
function mostrarFoto(url) {
    moldura.querySelector("img")?.remove();
    const segura = url && (url.startsWith("blob:") ? url : urlSegura(url));
    if (segura) {
        const img = document.createElement("img");
        img.className = "perfil-foto__imagem";
        img.alt = "Sua foto de perfil";
        img.referrerPolicy = "no-referrer"; // fotos do Google
        img.src = segura;
        img.addEventListener("error", () => mostrarFoto(null), { once: true });
        moldura.prepend(img);
    }
    iniciais.hidden = Boolean(segura);
    removerFoto.hidden = !segura;
}
function atualizarIniciais() {
    const nome = apelido.value.trim();
    iniciais.textContent = nome ? nome[0].toLocaleUpperCase("pt-BR") : "?";
}
entradaFoto.addEventListener("change", async () => {
    const arquivo = entradaFoto.files?.[0];
    entradaFoto.value = "";
    if (!arquivo)
        return;
    limparErro("foto");
    const problema = conferirArquivo(arquivo, EXTENSOES_IMAGEM);
    if (problema) {
        mostrarErro("foto", problema);
        return;
    }
    const anterior = moldura.querySelector("img")?.src ?? null;
    if (urlPreviaLocal)
        URL.revokeObjectURL(urlPreviaLocal);
    urlPreviaLocal = URL.createObjectURL(arquivo);
    mostrarFoto(urlPreviaLocal);
    enviandoFoto = true;
    campoFoto.classList.add("perfil-foto--enviando");
    status.textContent = "Enviando sua foto…";
    try {
        const enviado = await enviarArquivo(arquivo, "foto");
        fotoId = enviado.id;
        fotoRemovida = false;
        status.textContent = "Foto pronta. Ela é salva junto com o perfil.";
    }
    catch (erro) {
        mostrarFoto(anterior);
        mostrarErro("foto", mensagemDeErro(erro));
        status.textContent = "";
    }
    finally {
        enviandoFoto = false;
        campoFoto.classList.remove("perfil-foto--enviando");
    }
});
removerFoto.addEventListener("click", () => {
    fotoId = null;
    fotoRemovida = true;
    mostrarFoto(null);
    limparErro("foto");
    entradaFoto.focus();
});
apelido.addEventListener("input", atualizarIniciais);
// ---------- Estado e cidade (municípios do IBGE) ----------
const municipiosPorUf = new Map();
async function municipios(uf) {
    const guardados = municipiosPorUf.get(uf);
    if (guardados)
        return guardados;
    const parar = new AbortController();
    const limite = window.setTimeout(() => parar.abort(), 8000);
    try {
        const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`, { signal: parar.signal });
        if (!resposta.ok)
            throw new Error(`IBGE respondeu ${resposta.status}`);
        const lista = (await resposta.json()).map((m) => m.nome);
        municipiosPorUf.set(uf, lista);
        return lista;
    }
    finally {
        window.clearTimeout(limite);
    }
}
function campoCidadeAtual() {
    return document.getElementById("cidade");
}
/** Sem a lista do IBGE, a cidade vira texto livre com as cidades que já existem no site como sugestão. */
function cidadeComoTexto(valor) {
    const atual = campoCidadeAtual();
    if (atual instanceof HTMLInputElement) {
        atual.value = valor;
        return;
    }
    const entrada = document.createElement("input");
    entrada.id = "cidade";
    entrada.name = "cidade";
    entrada.maxLength = 120;
    entrada.autocomplete = "address-level2";
    entrada.setAttribute("list", "cidades-existentes");
    entrada.setAttribute("aria-describedby", "cidade-ajuda");
    entrada.value = valor;
    const sugestoes = document.createElement("datalist");
    sugestoes.id = "cidades-existentes";
    sugestoes.innerHTML = cidadesExistentes.map((c) => `<option value="${esc(c)}"></option>`).join("");
    atual.replaceWith(entrada);
    campoCidade.append(sugestoes);
    ajudaCidade.textContent = "Não conseguimos carregar a lista de cidades. Escreva o nome da sua.";
    ajudaCidade.hidden = false;
}
async function carregarCidades(uf, selecionada) {
    const atual = campoCidadeAtual();
    if (atual instanceof HTMLInputElement)
        return; // já está no modo texto
    const select = atual;
    if (!uf) {
        select.innerHTML = '<option value="">Escolha o estado primeiro</option>';
        select.disabled = true;
        return;
    }
    select.disabled = true;
    select.innerHTML = '<option value="">Carregando cidades…</option>';
    try {
        const nomes = await municipios(uf);
        if (estado.value !== uf)
            return; // trocou de estado no meio
        const opcoes = selecionada && !nomes.includes(selecionada) ? [selecionada, ...nomes] : nomes;
        select.innerHTML = '<option value="">Escolha</option>';
        preencherSelect(select, opcoes);
        select.value = selecionada;
        select.disabled = false;
    }
    catch {
        cidadeComoTexto(selecionada);
    }
}
estado.addEventListener("change", () => {
    limparErro("estado");
    carregarCidades(estado.value, "");
});
// ---------- Escola (ensino médio) ou graduações ----------
let proximaFormacao = 0;
function linhaFormacao(formacao) {
    const n = proximaFormacao++;
    const li = document.createElement("li");
    li.className = "formacao";
    li.innerHTML = `
    <div class="campo">
      <label for="curso-${n}">Curso</label>
      <input id="curso-${n}" class="formacao__curso" maxlength="120" value="${esc(formacao.curso)}">
    </div>
    <div class="campo">
      <label for="instituicao-${n}">Instituição</label>
      <input id="instituicao-${n}" class="formacao__instituicao" maxlength="160" autocomplete="organization"
             value="${esc(formacao.instituicao)}">
    </div>
    <button class="botao botao--texto formacao__remover" type="button" aria-label="Remover esta graduação">Remover</button>`;
    li.querySelector(".formacao__remover").addEventListener("click", () => {
        li.remove();
        atualizarFormacoes();
        listaFormacoes.querySelector("input")?.focus();
    });
    return li;
}
function atualizarFormacoes() {
    const linhas = listaFormacoes.querySelectorAll(".formacao");
    if (!linhas.length)
        listaFormacoes.append(linhaFormacao({ curso: "", instituicao: "" }));
    const total = listaFormacoes.querySelectorAll(".formacao").length;
    listaFormacoes.querySelectorAll(".formacao__remover").forEach((botao) => (botao.hidden = total < 2));
    adicionarFormacao.hidden = total >= MAX_FORMACOES;
}
adicionarFormacao.addEventListener("click", () => {
    const linha = linhaFormacao({ curso: "", instituicao: "" });
    listaFormacoes.append(linha);
    atualizarFormacoes();
    linha.querySelector("input")?.focus();
});
function formacoesPreenchidas() {
    return Array.from(listaFormacoes.querySelectorAll(".formacao"))
        .map((li) => ({
        curso: li.querySelector(".formacao__curso").value.trim(),
        instituicao: li.querySelector(".formacao__instituicao").value.trim(),
    }))
        .filter((f) => f.curso || f.instituicao);
}
/** Ensino médio não tem curso: mostra só o campo da escola. */
function ajustarAoNivel() {
    const ensinoMedio = nivel.value === "ensino_medio";
    campoEscola.hidden = !ensinoMedio;
    campoFormacoes.hidden = ensinoMedio;
}
nivel.addEventListener("change", () => {
    // Leva a escola/instituição de um campo para o outro quando troca de nível.
    const escola = el("escola");
    const primeira = listaFormacoes.querySelector(".formacao__instituicao");
    if (nivel.value === "ensino_medio" && !escola.value && primeira)
        escola.value = primeira.value;
    if (nivel.value !== "ensino_medio" && primeira && !primeira.value)
        primeira.value = escola.value;
    ajustarAoNivel();
});
// ---------- Data de nascimento (dia, mês e ano) ----------
const PARTES_NASCIMENTO = ["data_nascimento", "nascimento-mes", "nascimento-ano"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
function montarDataDeNascimento(iso) {
    const [dia, mes, ano] = PARTES_NASCIMENTO.map((id) => el(id));
    preencherSelect(dia, Array.from({ length: 31 }, (_, i) => ({ valor: String(i + 1), rotulo: String(i + 1) })));
    preencherSelect(mes, MESES.map((nome, i) => ({ valor: String(i + 1), rotulo: nome })));
    // Do ano atual até 110 anos atrás, do mais recente para o mais antigo.
    const esteAno = new Date().getFullYear();
    preencherSelect(ano, Array.from({ length: 111 }, (_, i) => String(esteAno - i)));
    if (iso) {
        const [a, m, d] = iso.split("-").map(Number);
        ano.value = String(a);
        mes.value = String(m);
        dia.value = String(d);
    }
}
/** "AAAA-MM-DD"; "" se os três estão vazios; null se falta algum; "invalida" para 31/02 e afins. */
function dataDeNascimento() {
    const [dia, mes, ano] = PARTES_NASCIMENTO.map((id) => el(id).value);
    if (!dia && !mes && !ano)
        return "";
    if (!dia || !mes || !ano)
        return null;
    const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
    if (data.getMonth() !== Number(mes) - 1)
        return "invalida";
    return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}
// ---------- Identidades ----------
function montarIdentidades(opcoes, marcadas) {
    const porValor = new Map(marcadas.map((i) => [i.valor, i.publica]));
    listaIdentidades.innerHTML = opcoes
        .map((opcao) => {
        const id = `ident-${esc(opcao.valor)}`;
        const marcada = porValor.has(opcao.valor);
        return `
        <li class="identidade">
          <label for="${id}">
            <input class="identidade__marcar" type="checkbox" id="${id}" value="${esc(opcao.valor)}"${marcada ? " checked" : ""}>
            ${esc(opcao.rotulo)}
          </label>
          <label class="identidade__publica" for="${id}-publica"${marcada ? "" : " hidden"}>
            <input type="checkbox" id="${id}-publica"${porValor.get(opcao.valor) ? " checked" : ""}>
            Mostrar no perfil
          </label>
        </li>`;
    })
        .join("");
    listaIdentidades.addEventListener("change", (evento) => {
        const alvo = evento.target;
        if (!alvo.classList.contains("identidade__marcar"))
            return;
        const publica = alvo.closest("li")?.querySelector(".identidade__publica");
        if (!publica)
            return;
        publica.hidden = !alvo.checked;
        if (!alvo.checked)
            publica.querySelector("input").checked = false;
    });
}
function identidadesMarcadas() {
    return Array.from(listaIdentidades.querySelectorAll(".identidade__marcar:checked")).map((caixa) => ({
        valor: caixa.value,
        publica: document.getElementById(`${caixa.id}-publica`)?.checked ?? false,
    }));
}
// ---------- Erros ----------
function campoDe(nome) {
    return nome === "foto" ? campoFoto : document.getElementById(nome)?.closest(".campo") ?? null;
}
function mostrarErro(nome, mensagem) {
    const caixa = document.getElementById(`erro-${nome}`);
    if (caixa) {
        caixa.textContent = mensagem;
        caixa.hidden = false;
    }
    campoDe(nome)?.classList.add("campo--erro");
    document.getElementById(nome)?.setAttribute("aria-invalid", "true");
}
function limparErro(nome) {
    const caixa = document.getElementById(`erro-${nome}`);
    if (caixa)
        caixa.hidden = true;
    campoDe(nome)?.classList.remove("campo--erro");
    document.getElementById(nome)?.removeAttribute("aria-invalid");
}
function mostrarErros(erros) {
    for (const nome of [...CAMPOS_SIMPLES, "data_nascimento", "estado", "foto"])
        limparErro(nome);
    const nomes = Object.keys(erros);
    if (!nomes.length) {
        resumoErros.hidden = true;
        return;
    }
    for (const nome of nomes)
        mostrarErro(nome, erros[nome]);
    resumoErros.innerHTML = `
    <p>${nomes.length === 1 ? "Falta ajustar um campo:" : `Faltam ajustar ${nomes.length} campos:`}</p>
    <ul>${nomes
        .map((nome) => `<li><a href="#${esc(nome)}">${esc(ROTULOS[nome] ?? nome)}</a>: ${esc(erros[nome])}</li>`)
        .join("")}</ul>`;
    resumoErros.hidden = false;
    resumoErros.focus();
}
function validarAqui() {
    const erros = {};
    if (apelido.value.trim().length < 2)
        erros.apelido = "Escreva como você quer ser chamada (pelo menos 2 letras).";
    if (!nivel.value)
        erros.nivel = "Escolha em que fase dos estudos você está.";
    const nascimento = dataDeNascimento();
    if (nascimento === null)
        erros.data_nascimento = "Escolha o dia, o mês e o ano, ou deixe os três em branco.";
    else if (nascimento === "invalida")
        erros.data_nascimento = "Esse dia não existe nesse mês. Confira a data.";
    return erros;
}
for (const nome of ["apelido", "nivel"]) {
    el(nome).addEventListener("change", () => limparErro(nome));
}
for (const id of PARTES_NASCIMENTO) {
    el(id).addEventListener("change", () => limparErro("data_nascimento"));
}
// ---------- Carregar e salvar ----------
function valor(nome) {
    return document.getElementById(nome).value.trim();
}
async function carregar() {
    let resposta;
    try {
        resposta = await api("/api/perfil");
    }
    catch (erro) {
        if (erro instanceof ErroApi && erro.status === 401) {
            window.location.href = "/";
            return;
        }
        status.textContent = mensagemDeErro(erro);
        return;
    }
    const { perfil, opcoes } = resposta;
    cidadesExistentes = opcoes.cidades_existentes;
    preencherSelect(nivel, opcoes.niveis);
    preencherSelect(el("area_interesse"), opcoes.areas);
    preencherSelect(estado, opcoes.estados);
    // O nome do Google entra como sugestão; a pessoa pode trocar.
    apelido.value = perfil.apelido || perfil.nome;
    nivel.value = perfil.nivel;
    el("area_interesse").value = perfil.area_interesse;
    montarDataDeNascimento(perfil.data_nascimento);
    el("escola").value = perfil.nivel === "ensino_medio" ? perfil.instituicao : "";
    for (const formacao of perfil.nivel === "ensino_medio" ? [] : perfil.formacoes) {
        listaFormacoes.append(linhaFormacao(formacao));
    }
    atualizarFormacoes();
    ajustarAoNivel();
    estado.value = perfil.estado;
    if (perfil.estado)
        carregarCidades(perfil.estado, perfil.cidade);
    else if (perfil.cidade)
        cidadeComoTexto(perfil.cidade); // cidade antiga, de antes do campo de estado
    montarIdentidades(opcoes.identidades, perfil.identidades);
    mostrarFoto(perfil.foto_url);
    atualizarIniciais();
    if (perfil.cadastro_completo)
        salvar.textContent = "Salvar alterações";
    salvar.disabled = false;
    form.setAttribute("aria-busy", "false");
}
form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (enviandoFoto) {
        status.textContent = "Espere a foto terminar de enviar.";
        return;
    }
    const errosLocais = validarAqui();
    mostrarErros(errosLocais);
    if (Object.keys(errosLocais).length)
        return;
    const textoBotao = salvar.textContent;
    salvar.disabled = true;
    salvar.textContent = "Salvando…";
    status.classList.remove("perfil-status--ok");
    status.textContent = "";
    const ensinoMedio = nivel.value === "ensino_medio";
    try {
        const resposta = await postJson("/api/perfil", {
            ...Object.fromEntries(CAMPOS_SIMPLES.map((nome) => [nome, valor(nome)])),
            data_nascimento: dataDeNascimento() || "",
            estado: estado.value,
            cidade: valor("cidade"),
            instituicao: ensinoMedio ? valor("escola") : "",
            formacoes: ensinoMedio ? [] : formacoesPreenchidas(),
            identidades: identidadesMarcadas(),
            foto_id: fotoId,
            remover_foto: fotoRemovida,
        });
        salvar.textContent = "Perfil salvo";
        status.classList.add("perfil-status--ok");
        status.textContent = "Pronto! Abrindo o mural…";
        window.setTimeout(() => (window.location.href = resposta.proximo), 900);
    }
    catch (erro) {
        salvar.disabled = false;
        salvar.textContent = textoBotao;
        if (erro instanceof ErroApi && erro.status === 422) {
            mostrarErros(erro.erros);
        }
        else if (erro instanceof ErroApi && erro.status === 401) {
            status.innerHTML = `${esc(erro.message)} <a href="/">Voltar ao início</a>`;
        }
        else {
            status.textContent = mensagemDeErro(erro);
        }
    }
});
carregar();
