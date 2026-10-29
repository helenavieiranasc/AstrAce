// Página "Editar projeto": a autora ou a admin muda os textos e o local. Tipo, arquivos e fotos ficam como estão.
import {
  api,
  el,
  esc,
  ErroApi,
  icone,
  mensagemDeErro,
  preencherSelect,
  type CampoExtra,
  type MaterialExigido,
  type Opcao,
} from "./comum.js";

interface ParaEditar {
  projeto: {
    id: number;
    tipo_rotulo: string;
    titulo: string;
    resumo: string;
    area: string;
    ano: number;
    nivel: string;
    instituicao: string;
    cidade: string;
    uf: string;
    link_externo: string;
    detalhes: Record<string, string>;
    arquivos: number;
    fotos: number;
    autora: string;
  };
  campos_extras: CampoExtra[];
  material: MaterialExigido | null;
  opcoes: { areas: Opcao[]; niveis: Opcao[]; estados: Opcao[] };
}

const form = el<HTMLFormElement>("form-editar");
const id = Number(form.dataset.id);
const corpo = el("editar-corpo");
const intro = el("editar-intro");
const resumoErros = el("resumo-erros");
const extras = el("extras");
const campoUf = el<HTMLSelectElement>("uf");
const campoCidade = el<HTMLSelectElement>("cidade");
const botaoSalvar = el<HTMLButtonElement>("salvar");

// Projetos antigos podem ter a cidade só como texto, sem estado. Ela continua até alguém escolher outra.
let cidadeSemEstado = "";

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

// ---------- Campos ----------

function htmlCampoExtra(campo: CampoExtra, valor: string): string {
  const idCampo = `extra-${campo.nome}`;
  const erroId = `erro-detalhes.${campo.nome}`;
  const ajudaId = `${idCampo}-ajuda`;
  const descritores = [campo.ajuda ? ajudaId : "", erroId].filter(Boolean).join(" ");
  const obrigatorio = campo.obrigatorio ? " required" : "";

  let controle: string;
  if (campo.tipo === "selecao") {
    const opcoesHtml = (campo.opcoes ?? [])
      .map((o) => `<option value="${esc(o.valor)}"${o.valor === valor ? " selected" : ""}>${esc(o.rotulo)}</option>`)
      .join("");
    controle = `<select id="${idCampo}" data-extra="${esc(campo.nome)}" aria-describedby="${descritores}"${obrigatorio}>
        <option value="">Escolha</option>${opcoesHtml}
      </select>`;
  } else {
    const tipoInput = campo.tipo === "url" ? 'type="url" placeholder="https://"' : 'type="text" maxlength="300"';
    controle = `<input id="${idCampo}" ${tipoInput} data-extra="${esc(campo.nome)}" value="${esc(valor)}"
        aria-describedby="${descritores}"${obrigatorio}>`;
  }

  return `
    <div class="campo">
      <label for="${idCampo}">${esc(campo.rotulo)}${campo.obrigatorio ? " *" : ""}</label>
      ${controle}
      ${campo.ajuda ? `<small id="${ajudaId}">${esc(campo.ajuda)}</small>` : ""}
      <p class="campo__erro" id="${erroId}" hidden></p>
    </div>`;
}

function montar(dados: ParaEditar): void {
  const p = dados.projeto;
  const anexos = [
    p.arquivos ? plural(p.arquivos, "arquivo", "arquivos") : "",
    p.fotos ? plural(p.fotos, "foto", "fotos") : "",
  ].filter(Boolean);
  intro.textContent =
    `${p.tipo_rotulo} de ${p.autora}. Campos com * são obrigatórios. ` +
    (anexos.length
      ? `O que já foi enviado (${anexos.join(" e ")}) continua como está.`
      : "Este projeto não tem arquivos.");

  el<HTMLInputElement>("titulo").value = p.titulo;
  const resumo = el<HTMLTextAreaElement>("resumo");
  resumo.value = p.resumo;
  el("resumo-contador").textContent = String(p.resumo.length);
  resumo.addEventListener("input", () => (el("resumo-contador").textContent = String(resumo.value.length)));

  const area = el<HTMLSelectElement>("area");
  preencherSelect(area, dados.opcoes.areas);
  area.value = p.area;
  el<HTMLInputElement>("ano").value = String(p.ano);
  const nivel = el<HTMLSelectElement>("nivel");
  preencherSelect(nivel, dados.opcoes.niveis);
  nivel.value = p.nivel;

  if (dados.campos_extras.length) {
    el("extras-titulo").textContent = `Sobre: ${p.tipo_rotulo.toLowerCase()}`;
    extras.innerHTML = dados.campos_extras.map((c) => htmlCampoExtra(c, p.detalhes[c.nome] ?? "")).join("");
    el("bloco-extras").hidden = false;
  }

  if (dados.material) {
    const exigeLink = dados.material.exige === "link";
    el("link-rotulo").textContent = dados.material.rotulo_link + (exigeLink ? " *" : "");
    if (dados.material.ajuda_link) {
      el("link-ajuda").textContent = dados.material.ajuda_link;
      el("link-ajuda").hidden = false;
    }
  }
  el<HTMLInputElement>("link_externo").value = p.link_externo;
  el<HTMLInputElement>("instituicao").value = p.instituicao;

  preencherSelect(campoUf, dados.opcoes.estados);
  if (p.uf) {
    campoUf.value = p.uf;
    void carregarCidades(p.uf, p.cidade);
  } else if (p.cidade) {
    cidadeSemEstado = p.cidade;
    campoCidade.innerHTML = `<option value="">${esc(p.cidade)} (escolha o estado para trocar)</option>`;
  }

  corpo.hidden = false;
}

// ---------- Estado e cidade ----------

const cidadesPorUf = new Map<string, string[]>();

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

// ---------- Erros ----------

function idDoCampo(chave: string): string {
  return chave.startsWith("detalhes.") ? `extra-${chave.slice("detalhes.".length)}` : chave;
}

function mostrarErroCampo(chave: string, mensagem: string): void {
  const paragrafo = document.getElementById(`erro-${chave}`);
  if (paragrafo) {
    paragrafo.innerHTML = `${icone("alerta")}<span>${esc(mensagem)}</span>`;
    paragrafo.hidden = false;
  }
  const controle = document.getElementById(idDoCampo(chave));
  controle?.setAttribute("aria-invalid", "true");
  controle?.closest(".campo")?.classList.add("campo--erro");
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

function mostrarErros(erros: Record<string, string>): void {
  const itens: string[] = [];
  for (const [chave, mensagem] of Object.entries(erros)) {
    mostrarErroCampo(chave, mensagem);
    itens.push(`<li><a href="#${esc(idDoCampo(chave))}">${esc(mensagem)}</a></li>`);
  }
  resumoErros.innerHTML = `<p>Confira os campos marcados:</p><ul>${itens.join("")}</ul>`;
  resumoErros.hidden = false;
  resumoErros.focus();
}

// ---------- Salvar ----------

function coletar(): Record<string, unknown> {
  const valor = (campo: string): string => el<HTMLInputElement>(campo).value.trim();
  const detalhes: Record<string, string> = {};
  extras.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-extra]").forEach((c) => {
    detalhes[c.dataset.extra!] = c.value.trim();
  });
  const uf = campoUf.value;
  return {
    titulo: valor("titulo"),
    resumo: el<HTMLTextAreaElement>("resumo").value.trim(),
    area: valor("area"),
    ano: valor("ano"),
    nivel: valor("nivel"),
    instituicao: valor("instituicao"),
    uf,
    cidade: uf ? campoCidade.value : cidadeSemEstado,
    link_externo: valor("link_externo"),
    detalhes,
  };
}

async function salvar(evento: SubmitEvent): Promise<void> {
  evento.preventDefault();
  limparErros();
  const dados = coletar();
  if (dados.uf && !dados.cidade) {
    mostrarErros({ cidade: "Escolha a cidade." });
    return;
  }

  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando…";
  try {
    await api(`/api/projetos/${id}`, { method: "PATCH", body: JSON.stringify(dados) });
    location.href = `/mural?editado=${id}`;
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 422 && Object.keys(erro.erros).length) {
      mostrarErros(erro.erros);
    } else {
      resumoErros.innerHTML = `<p>${esc(mensagemDeErro(erro))}</p>`;
      resumoErros.hidden = false;
      resumoErros.focus();
    }
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar alterações";
  }
}

async function iniciar(): Promise<void> {
  form.addEventListener("submit", (e) => void salvar(e));
  campoUf.addEventListener("change", () => {
    cidadeSemEstado = "";
    void carregarCidades(campoUf.value);
  });
  try {
    montar(await api<ParaEditar>(`/api/projetos/${id}/edicao`));
    el<HTMLInputElement>("titulo").focus();
  } catch (erro) {
    intro.textContent = mensagemDeErro(erro);
  }
}

void iniciar();
