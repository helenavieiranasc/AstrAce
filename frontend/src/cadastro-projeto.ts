import {
  ErroApi,
  EXTENSOES_IMAGEM,
  EXTENSOES_MATERIAL,
  api,
  conferirArquivo,
  el,
  enviarArquivo,
  esc,
  formatarTamanho,
  icone,
  mensagemDeErro,
  postJson,
  preencherSelect,
  type ArquivoEnviado,
  type CampoExtra,
  type Detalhe,
  type OpcoesMural,
  type TipoProjeto,
} from "./comum.js";

const LIMITE_ARQUIVOS = 5;
const LIMITE_FOTOS = 5;

const form = el<HTMLFormElement>("form-projeto");
const campoUf = el<HTMLSelectElement>("uf");
const campoCidade = el<HTMLSelectElement>("cidade");
const tipos = el("tipos");
const blocoExtras = el<HTMLFieldSetElement>("bloco-extras");
const extras = el("extras");
const blocoMaterial = el<HTMLFieldSetElement>("bloco-material");
const campoArquivos = el("campo-arquivos");
const inputArquivos = el<HTMLInputElement>("arquivos");
const areaSoltar = el<HTMLLabelElement>("arquivos-soltar");
const listaAnexos = el<HTMLUListElement>("anexos");
const campoLink = el<HTMLInputElement>("link_externo");
const inputFotos = el<HTMLInputElement>("fotos");
const galeria = el<HTMLUListElement>("galeria-envio");
const fotosAdicionar = el<HTMLLIElement>("fotos-adicionar");
const fotosSoltar = el<HTMLLabelElement>("fotos-soltar");
const resumoErros = el("resumo-erros");
const botaoPublicar = el<HTMLButtonElement>("publicar");
const campoResumo = el<HTMLTextAreaElement>("resumo");
const campoAno = el<HTMLInputElement>("ano");

interface Anexo {
  chave: number;
  nome: string;
  tamanho: number;
  estado: "enviando" | "pronto" | "erro";
  arquivo?: ArquivoEnviado;
  erro?: string;
  previa?: string; // endereço local da imagem, para mostrar a foto antes de terminar o envio
}

let opcoes: OpcoesMural | null = null;
let tipoAtual: TipoProjeto | null = null;
const valoresExtras: Record<string, string> = {}; // guarda o que foi digitado ao trocar de tipo
let anexos: Anexo[] = [];
let fotos: Anexo[] = [];
let proximaChave = 1;

const OBRIGATORIOS: Record<string, string> = {
  titulo: "Escreva o título do projeto.",
  resumo: "Escreva o resumo do projeto.",
  area: "Escolha a área do projeto.",
  ano: "Informe o ano com 4 dígitos, como 2025.",
};

// ---------- Tipos e campos extras ----------

function renderTipos(lista: TipoProjeto[]): void {
  tipos.innerHTML = lista
    .map(
      (t) => `
      <div class="tipo-opcao">
        <input type="radio" name="tipo" id="tipo-${esc(t.valor)}" value="${esc(t.valor)}">
        <label for="tipo-${esc(t.valor)}">
          ${icone(t.icone)}
          <span class="tipo-opcao__nome">${esc(t.rotulo)}</span>
          <span class="tipo-opcao__desc">${esc(t.descricao)}</span>
        </label>
      </div>`,
    )
    .join("");
}

function htmlCampoExtra(campo: CampoExtra): string {
  const id = `extra-${campo.nome}`;
  const erroId = `erro-detalhes.${campo.nome}`;
  const ajudaId = `${id}-ajuda`;
  const descritores = [campo.ajuda ? ajudaId : "", erroId].filter(Boolean).join(" ");
  const valor = valoresExtras[campo.nome] ?? "";
  const obrigatorio = campo.obrigatorio ? " required" : "";

  let controle: string;
  if (campo.tipo === "selecao") {
    const opcoesHtml = (campo.opcoes ?? [])
      .map((o) => `<option value="${esc(o.valor)}"${o.valor === valor ? " selected" : ""}>${esc(o.rotulo)}</option>`)
      .join("");
    controle = `<select id="${id}" data-extra="${esc(campo.nome)}" aria-describedby="${descritores}"${obrigatorio}>
        <option value="">Escolha</option>${opcoesHtml}
      </select>`;
  } else {
    const tipoInput = campo.tipo === "url" ? 'type="url" placeholder="https://"' : 'type="text" maxlength="300"';
    controle = `<input id="${id}" ${tipoInput} data-extra="${esc(campo.nome)}" value="${esc(valor)}"
        aria-describedby="${descritores}"${obrigatorio}>`;
  }

  return `
    <div class="campo">
      <label for="${id}">${esc(campo.rotulo)}${campo.obrigatorio ? " *" : ""}</label>
      ${controle}
      ${campo.ajuda ? `<small id="${ajudaId}">${esc(campo.ajuda)}</small>` : ""}
      <p class="campo__erro" id="${erroId}" hidden></p>
    </div>`;
}

function guardarExtras(): void {
  extras.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-extra]").forEach((c) => {
    valoresExtras[c.dataset.extra!] = c.value;
  });
}

function renderExtras(): void {
  guardarExtras();
  const campos = tipoAtual?.campos ?? [];
  blocoExtras.hidden = campos.length === 0;
  if (!tipoAtual || campos.length === 0) {
    extras.innerHTML = "";
    return;
  }
  el("extras-titulo").textContent = `Sobre: ${tipoAtual.rotulo.toLowerCase()}`;
  extras.innerHTML = campos.map(htmlCampoExtra).join("");
}

// ---------- Material (arquivos e link) ----------

/** Ajusta textos e ordem do bloco de material para o tipo escolhido. */
function renderMaterial(): void {
  if (!tipoAtual) {
    blocoMaterial.hidden = true;
    return;
  }
  const m = tipoAtual.material;
  blocoMaterial.hidden = false;
  el("material-regra").textContent = m.erro;

  const marca = { arquivo: [" *", " (opcional)"], link: [" (opcional)", " *"], um_dos_dois: ["", ""] }[m.exige];
  el("arquivos-rotulo").textContent = m.rotulo_arquivo + marca[0];
  el("link-rotulo").textContent = m.rotulo_link + marca[1];

  const ajudaLink = el("link-ajuda");
  ajudaLink.textContent = m.ajuda_link ?? "";
  ajudaLink.hidden = !m.ajuda_link;

  // Quando o link é o principal (ex.: software), ele vem primeiro.
  const campoDoLink = campoLink.closest(".campo")!;
  if (m.exige === "link") blocoMaterial.insertBefore(campoDoLink, campoArquivos);
  else blocoMaterial.appendChild(campoDoLink);
}

function anexosValidos(): Anexo[] {
  return anexos.filter((a) => a.estado !== "erro");
}

function renderAnexos(): void {
  listaAnexos.innerHTML = anexos
    .map((a) => {
      const ehImagem = /\.(jpe?g|png|webp)$/i.test(a.nome);
      const info =
        a.estado === "enviando" ? "Enviando…" : a.estado === "erro" ? a.erro ?? "Não foi enviado." : formatarTamanho(a.tamanho);
      return `
        <li class="anexo anexo--${a.estado}">
          ${icone(ehImagem ? "imagem" : "arquivo")}
          <span class="anexo__texto">
            <span class="anexo__nome">${esc(a.nome)}</span>
            <span class="anexo__info">${esc(info)}</span>
          </span>
          <button class="anexo__remover" type="button" data-chave="${a.chave}" aria-label="Remover ${esc(a.nome)}">
            Remover
          </button>
        </li>`;
    })
    .join("");
  areaSoltar.hidden = anexosValidos().length >= LIMITE_ARQUIVOS;
}

async function subir(anexo: Anexo, arquivo: File): Promise<void> {
  try {
    anexo.arquivo = await enviarArquivo(arquivo, "material");
    anexo.tamanho = anexo.arquivo.tamanho;
    anexo.estado = "pronto";
  } catch (erro) {
    anexo.estado = "erro";
    anexo.erro = mensagemDeErro(erro);
  }
  renderAnexos();
}

function adicionarArquivos(lista: FileList | File[]): void {
  esconderErro("arquivos");
  for (const arquivo of Array.from(lista)) {
    if (anexosValidos().length >= LIMITE_ARQUIVOS) {
      mostrarErroCampo("arquivos", `Envie no máximo ${LIMITE_ARQUIVOS} arquivos.`);
      break;
    }
    const problema = conferirArquivo(arquivo, EXTENSOES_MATERIAL);
    const anexo: Anexo = {
      chave: proximaChave++,
      nome: arquivo.name,
      tamanho: arquivo.size,
      estado: problema ? "erro" : "enviando",
      erro: problema ?? undefined,
    };
    anexos.push(anexo);
    if (!problema) void subir(anexo, arquivo);
  }
  inputArquivos.value = "";
  renderAnexos();
}

// ---------- Fotos ----------

function fotosValidas(): Anexo[] {
  return fotos.filter((f) => f.estado !== "erro");
}

function renderFotos(): void {
  galeria.querySelectorAll(".foto-envio").forEach((li) => li.remove());
  const primeiraValida = fotosValidas()[0];
  const itens = fotos
    .map((f) => {
      const capa = f === primeiraValida ? '<span class="foto-envio__capa">Capa</span>' : "";
      const estado =
        f.estado === "enviando"
          ? '<span class="foto-envio__estado">Enviando…</span>'
          : f.estado === "erro"
            ? `<span class="foto-envio__estado foto-envio__estado--erro">${esc(f.erro ?? "Não foi enviada.")}</span>`
            : "";
      const imagem = f.previa ? `<img src="${esc(f.previa)}" alt="">` : icone("imagem");
      return `
        <li class="foto-envio foto-envio--${f.estado}">
          <div class="foto-envio__imagem">${imagem}${capa}${estado}</div>
          <span class="foto-envio__nome">${esc(f.nome)}</span>
          <button class="anexo__remover" type="button" data-foto="${f.chave}" aria-label="Remover foto ${esc(f.nome)}">
            Remover
          </button>
        </li>`;
    })
    .join("");
  fotosAdicionar.insertAdjacentHTML("beforebegin", itens);
  fotosAdicionar.hidden = fotosValidas().length >= LIMITE_FOTOS;
}

async function subirFoto(foto: Anexo, arquivo: File): Promise<void> {
  try {
    foto.arquivo = await enviarArquivo(arquivo, "foto");
    foto.estado = "pronto";
  } catch (erro) {
    foto.estado = "erro";
    foto.erro = mensagemDeErro(erro);
  }
  renderFotos();
}

function adicionarFotos(lista: FileList | File[]): void {
  esconderErro("fotos");
  for (const arquivo of Array.from(lista)) {
    if (fotosValidas().length >= LIMITE_FOTOS) {
      mostrarErroCampo("fotos", `Envie no máximo ${LIMITE_FOTOS} fotos.`);
      break;
    }
    const problema = conferirArquivo(arquivo, EXTENSOES_IMAGEM);
    const foto: Anexo = {
      chave: proximaChave++,
      nome: arquivo.name,
      tamanho: arquivo.size,
      estado: problema ? "erro" : "enviando",
      erro: problema ?? undefined,
      previa: problema ? undefined : URL.createObjectURL(arquivo),
    };
    fotos.push(foto);
    if (!problema) void subirFoto(foto, arquivo);
  }
  inputFotos.value = "";
  renderFotos();
}

function removerFoto(chave: number): void {
  const foto = fotos.find((f) => f.chave === chave);
  if (foto?.previa) URL.revokeObjectURL(foto.previa);
  fotos = fotos.filter((f) => f.chave !== chave);
  renderFotos();
  inputFotos.focus();
}

// ---------- Erros ----------

function idDoCampo(chave: string): string {
  if (chave === "tipo") return tipos.querySelector("input")?.id ?? "tipos";
  if (chave === "imagem_url") return "fotos";
  if (chave.startsWith("detalhes.")) return `extra-${chave.slice("detalhes.".length)}`;
  return chave;
}

function mostrarErroCampo(chave: string, mensagem: string): void {
  const paragrafo = document.getElementById(`erro-${chave}`);
  if (paragrafo) {
    paragrafo.innerHTML = `${icone("alerta")}<span>${esc(mensagem)}</span>`;
    paragrafo.hidden = false;
  }
  const controle = document.getElementById(idDoCampo(chave));
  if (controle && chave !== "tipo") {
    controle.setAttribute("aria-invalid", "true");
    controle.closest(".campo")?.classList.add("campo--erro");
  }
}

function esconderErro(chave: string): void {
  const paragrafo = document.getElementById(`erro-${chave}`);
  if (paragrafo) {
    paragrafo.hidden = true;
    paragrafo.textContent = "";
  }
  const controle = document.getElementById(idDoCampo(chave));
  controle?.removeAttribute("aria-invalid");
  controle?.closest(".campo")?.classList.remove("campo--erro");
}

function limparErros(): void {
  resumoErros.hidden = true;
  resumoErros.innerHTML = "";
  form.querySelectorAll<HTMLElement>(".campo__erro").forEach((p) => {
    p.hidden = true;
    p.textContent = "";
  });
  form.querySelectorAll(".campo--erro").forEach((c) => c.classList.remove("campo--erro"));
  form.querySelectorAll("[aria-invalid]").forEach((c) => c.removeAttribute("aria-invalid"));
}

function mostrarResumo(html: string): void {
  resumoErros.innerHTML = html;
  resumoErros.hidden = false;
  resumoErros.focus();
}

function mostrarErros(erros: Record<string, string>): void {
  const itens: string[] = [];
  for (const [chave, mensagem] of Object.entries(erros)) {
    mostrarErroCampo(chave, mensagem);
    itens.push(`<li><a href="#${esc(idDoCampo(chave))}">${esc(mensagem)}</a></li>`);
  }
  mostrarResumo(`<p>Confira os campos marcados:</p><ul>${itens.join("")}</ul>`);
}

// ---------- Estado e cidade ----------

const cidadesPorUf = new Map<string, string[]>();

/** Preenche as cidades do estado. Sem estado, a cidade fica desligada. */
async function carregarCidades(uf: string, selecionada = ""): Promise<void> {
  campoCidade.disabled = true;
  if (!uf) {
    campoCidade.innerHTML = '<option value="">Escolha o estado primeiro</option>';
    return;
  }
  campoCidade.innerHTML = '<option value="">Carregando cidades…</option>';
  try {
    let nomes = cidadesPorUf.get(uf);
    if (!nomes) {
      nomes = await api<string[]>(`/api/cidades?uf=${encodeURIComponent(uf)}`);
      cidadesPorUf.set(uf, nomes);
    }
    if (campoUf.value !== uf) return; // trocou de estado no meio
    campoCidade.innerHTML = '<option value="">Escolha</option>';
    preencherSelect(campoCidade, nomes);
    campoCidade.value = nomes.includes(selecionada) ? selecionada : "";
    campoCidade.disabled = false;
  } catch (erro) {
    campoCidade.innerHTML = '<option value="">Escolha o estado primeiro</option>';
    mostrarErroCampo("cidade", `Não deu para carregar as cidades. ${mensagemDeErro(erro)}`);
  }
}

// ---------- Envio ----------

function coletar(): Record<string, unknown> {
  const dados = new FormData(form);
  const valor = (nome: string) => String(dados.get(nome) ?? "").trim();
  const detalhes: Record<string, string> = {};
  extras.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-extra]").forEach((c) => {
    detalhes[c.dataset.extra!] = c.value.trim();
  });
  return {
    tipo: valor("tipo"),
    titulo: valor("titulo"),
    resumo: valor("resumo"),
    area: valor("area"),
    ano: valor("ano"),
    nivel: valor("nivel"),
    instituicao: valor("instituicao"),
    uf: valor("uf"),
    cidade: valor("cidade"),
    link_externo: valor("link_externo"),
    detalhes,
    arquivos: anexos.filter((a) => a.estado === "pronto").map((a) => a.arquivo!.id),
    fotos: fotos.filter((f) => f.estado === "pronto").map((f) => f.arquivo!.id),
  };
}

function validarNoNavegador(dados: Record<string, unknown>): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!dados.tipo) erros.tipo = "Escolha o tipo do projeto.";
  for (const [campo, mensagem] of Object.entries(OBRIGATORIOS)) {
    if (!dados[campo]) erros[campo] = mensagem;
  }
  const detalhes = dados.detalhes as Record<string, string>;
  for (const campo of tipoAtual?.campos ?? []) {
    if (campo.obrigatorio && !detalhes[campo.nome]) {
      erros[`detalhes.${campo.nome}`] = `Preencha o campo ${campo.rotulo}.`;
    }
  }

  if (dados.uf && !dados.cidade) erros.cidade = "Escolha a cidade.";

  const enviandoFotos = fotos.some((f) => f.estado === "enviando");
  if (enviandoFotos) erros.fotos = "Espere as fotos terminarem de enviar.";

  if (anexos.some((a) => a.estado === "enviando")) {
    erros.arquivos = "Espere os arquivos terminarem de enviar.";
  } else if (tipoAtual && !enviandoFotos) {
    const m = tipoAtual.material;
    const temFotos = (dados.fotos as number[]).length > 0;
    const temArquivo = (dados.arquivos as number[]).length > 0 || (m.fotos_contam && temFotos);
    const temLink = Boolean(dados.link_externo);
    if (m.exige === "arquivo" && !temArquivo) erros.arquivos = m.erro;
    if (m.exige === "link" && !temLink) erros.link_externo = m.erro;
    if (m.exige === "um_dos_dois" && !temArquivo && !temLink) erros.arquivos = m.erro;
  }
  return erros;
}

async function publicar(evento: SubmitEvent): Promise<void> {
  evento.preventDefault();
  limparErros();

  const dados = coletar();
  const erros = validarNoNavegador(dados);
  if (Object.keys(erros).length > 0) {
    mostrarErros(erros);
    return;
  }

  botaoPublicar.disabled = true;
  botaoPublicar.textContent = "Publicando…";
  try {
    const projeto = await postJson<Detalhe>("/api/projetos", dados);
    window.location.href = `/mural?publicado=${projeto.id}`;
    return;
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 422 && Object.keys(erro.erros).length > 0) {
      mostrarErros(erro.erros);
    } else if (erro instanceof ErroApi && erro.status === 401) {
      mostrarResumo(`<p>${esc(erro.message)}</p><ul><li><a href="/login">Entrar na minha conta</a></li></ul>`);
    } else {
      mostrarResumo(`<p>${esc(mensagemDeErro(erro))}</p>`);
    }
  }
  botaoPublicar.disabled = false;
  botaoPublicar.textContent = "Publicar no mural";
}

// ---------- Início ----------

function ligarEventos(): void {
  campoUf.addEventListener("change", () => {
    esconderErro("uf");
    esconderErro("cidade");
    void carregarCidades(campoUf.value);
  });
  campoCidade.addEventListener("change", () => esconderErro("cidade"));
  const contador = el("resumo-contador");
  campoResumo.addEventListener("input", () => {
    contador.textContent = String(campoResumo.value.length);
  });

  tipos.addEventListener("change", (e) => {
    const valor = (e.target as HTMLInputElement).value;
    tipoAtual = opcoes?.tipos.find((t) => t.valor === valor) ?? null;
    esconderErro("tipo");
    renderExtras();
    renderMaterial();
  });

  inputArquivos.addEventListener("change", () => {
    if (inputArquivos.files) adicionarArquivos(inputArquivos.files);
  });
  areaSoltar.addEventListener("dragover", (e) => {
    e.preventDefault();
    areaSoltar.classList.add("soltar--ativo");
  });
  areaSoltar.addEventListener("dragleave", () => areaSoltar.classList.remove("soltar--ativo"));
  areaSoltar.addEventListener("drop", (e) => {
    e.preventDefault();
    areaSoltar.classList.remove("soltar--ativo");
    if (e.dataTransfer?.files.length) adicionarArquivos(e.dataTransfer.files);
  });
  listaAnexos.addEventListener("click", (e) => {
    const botao = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-chave]");
    if (!botao) return;
    anexos = anexos.filter((a) => a.chave !== Number(botao.dataset.chave));
    renderAnexos();
    inputArquivos.focus();
  });

  inputFotos.addEventListener("change", () => {
    if (inputFotos.files) adicionarFotos(inputFotos.files);
  });
  fotosSoltar.addEventListener("dragover", (e) => {
    e.preventDefault();
    fotosSoltar.classList.add("soltar--ativo");
  });
  fotosSoltar.addEventListener("dragleave", () => fotosSoltar.classList.remove("soltar--ativo"));
  fotosSoltar.addEventListener("drop", (e) => {
    e.preventDefault();
    fotosSoltar.classList.remove("soltar--ativo");
    if (e.dataTransfer?.files.length) adicionarFotos(e.dataTransfer.files);
  });
  galeria.addEventListener("click", (e) => {
    const botao = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-foto]");
    if (botao) removerFoto(Number(botao.dataset.foto));
  });

  form.addEventListener("submit", (e) => void publicar(e as SubmitEvent));
}

async function iniciar(): Promise<void> {
  const anoAtual = new Date().getFullYear();
  campoAno.value = String(anoAtual);
  campoAno.max = String(anoAtual + 1);
  ligarEventos();

  try {
    opcoes = await api<OpcoesMural>("/api/mural/opcoes");
    renderTipos(opcoes.tipos);
    preencherSelect(el<HTMLSelectElement>("area"), opcoes.areas);
    preencherSelect(el<HTMLSelectElement>("nivel"), opcoes.niveis);
    preencherSelect(campoUf, opcoes.estados);
    if (opcoes.local_perfil) {
      campoUf.value = opcoes.local_perfil.uf;
      void carregarCidades(opcoes.local_perfil.uf, opcoes.local_perfil.cidade);
    }
  } catch (erro) {
    tipos.innerHTML = `<p class="campo__erro">${icone("alerta")}<span>Não foi possível carregar o formulário. ${esc(
      mensagemDeErro(erro),
    )}</span></p>`;
    botaoPublicar.disabled = true;
  }
}

void iniciar();
