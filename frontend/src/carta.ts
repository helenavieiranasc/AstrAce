// Carta para o futuro: convite, escrita, reabertura e o bloco do perfil. A carta e o envelope são 3D (carta-cena.ts);
// o texto é HTML por cima do papel, alinhado pela projeção da câmera, para ficar nítido, selecionável e acessível.
// O servidor decide tudo o que importa (prazo, envio único, sigilo da mensagem); aqui só se conta a história.
import { api, el, esc, ErroApi, postJson } from "./comum.js";
import { dataPorExtenso, lerData, type DadosPapel } from "./carta-papel.js";
import type { Cena } from "./carta-cena.js";

interface DadosCarta {
  nome: string;
  area: string;
  anos: number | null;
  mensagem?: string;
  objetivos?: string;
  enviada_em?: string | null;
  revela_em?: string | null;
}

interface Resposta {
  situacao: "adiada" | "em_criacao" | "aguardando" | "disponivel" | "aberta" | null;
  carta: DadosCarta | null;
  sugestoes: { nome: string; area: string };
  areas: Array<{ valor: string; rotulo: string }>;
  anos_validos: number[];
  agora: string;
}

let areas: Array<{ valor: string; rotulo: string }> = [];
const rotuloDaArea = (valor: string): string => areas.find((a) => a.valor === valor)?.rotulo ?? "";

// ---------- Datas ----------

/** A mesma conta do servidor: a data daqui a N anos (29/02 cai em 28/02 se o ano de destino não for bissexto). */
function somarAnos(iso: string, anos: number): string {
  const d = lerData(iso);
  const ano = d.getUTCFullYear() + anos;
  const ultimo = new Date(Date.UTC(ano, d.getUTCMonth() + 1, 0)).getUTCDate();
  const nova = new Date(Date.UTC(ano, d.getUTCMonth(), Math.min(d.getUTCDate(), ultimo), d.getUTCHours(), d.getUTCMinutes()));
  return nova.toISOString();
}

const plural = (n: number): string => `${n} ${n === 1 ? "ano" : "anos"}`;

// ---------- Cena ----------

async function montarNaPagina(palco: HTMLElement, dados: DadosPapel, aoClicar?: () => void): Promise<Cena | null> {
  try {
    const modulo = await import("./carta-cena.js");
    return await modulo.montarCena(palco, { dados, aoClicar });
  } catch {
    return null;
  }
}

function papel(d: Partial<DadosCarta> | null, textoNoPapel: boolean, sugerido = ""): DadosPapel {
  return {
    nome: d?.nome || sugerido,
    area: d?.area ? rotuloDaArea(d.area) : "",
    mensagem: d?.mensagem ?? "",
    objetivos: d?.objetivos ?? "",
    anos: d?.anos ?? null,
    enviada: d?.enviada_em ?? null,
    revela: d?.revela_em ?? null,
    textoNoPapel,
  };
}

/** Põe a camada de texto exatamente sobre a carta aberta (ou só mostra, se não houver 3D). */
function alinhar(camada: HTMLElement, cena: Cena | null, palco: HTMLElement): void {
  if (!cena) return;
  const r = cena.retanguloDaCarta();
  const caixa = palco.getBoundingClientRect();
  const pai = camada.offsetParent?.getBoundingClientRect() ?? caixa;
  camada.style.left = `${r.x + caixa.left - pai.left}px`;
  camada.style.top = `${r.y + caixa.top - pai.top}px`;
  camada.style.width = `${r.largura}px`;
  camada.style.height = `${r.altura}px`;
  camada.style.setProperty("--h", `${r.altura}px`);
}

/** No computador o painel flutua à direita: a carta se desloca para não ficar por baixo dele. */
function reservarPainel(cena: Cena | null): void {
  if (!cena) return;
  const aplicar = (): void => {
    const painel = document.querySelector<HTMLElement>(".carta-painel");
    cena.reservarDireita(painel && matchMedia("(min-width: 900px)").matches ? painel.offsetWidth + 40 : 0);
  };
  aplicar();
  window.addEventListener("resize", aplicar);
}

// ---------- Tela cheia ----------
// Como no passaporte: ao abrir o envelope, a cortiça cobre a tela toda. Usa a tela cheia do navegador quando existe
// (ela precisa ser pedida no clique); onde não existe, como no iPhone, a camada fixa faz o papel.

const cortica = document.querySelector<HTMLElement>(".carta-cortica");
const sairTela = document.getElementById("carta-sair-tela");
const voltarTela = document.getElementById("carta-entrar-tela");
let jaEntrou = false; // depois da primeira vez, quem sai da tela cheia ganha um botão para voltar
const emTelaCheia = (): boolean => cortica?.classList.contains("carta-cortica--tela-cheia") ?? false;

function entrarTelaCheia(): void {
  if (!cortica || !sairTela || emTelaCheia()) return;
  cortica.classList.add("carta-cortica--tela-cheia");
  document.documentElement.classList.add("carta-sem-rolagem");
  sairTela.hidden = false;
  if (voltarTela) voltarTela.hidden = true;
  jaEntrou = true;
  cortica.requestFullscreen?.({ navigationUI: "hide" }).catch(() => undefined);
}

function sairTelaCheia(): void {
  if (!cortica || !sairTela || !emTelaCheia()) return;
  cortica.classList.remove("carta-cortica--tela-cheia");
  document.documentElement.classList.remove("carta-sem-rolagem");
  sairTela.hidden = true;
  if (voltarTela) voltarTela.hidden = !jaEntrou;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
}

sairTela?.addEventListener("click", sairTelaCheia);
voltarTela?.addEventListener("click", entrarTelaCheia); // é um clique: o navegador aceita pedir a tela cheia
// Esc (ou o gesto do sistema) tira o navegador da tela cheia: a camada sai junto. O que foi escrito continua lá.
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) sairTelaCheia();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") sairTelaCheia();
});

/** Gaveta do painel (só aparece no celular, em tela cheia): fechada, a carta ganha a tela para escrever. */
function gaveta(aberta: boolean): void {
  const painel = document.getElementById("carta-painel");
  const alca = document.getElementById("carta-painel-alca");
  painel?.classList.toggle("carta-painel--aberto", aberta);
  alca?.setAttribute("aria-expanded", String(aberta));
}
document.getElementById("carta-painel-alca")?.addEventListener("click", () => {
  gaveta(!document.getElementById("carta-painel")?.classList.contains("carta-painel--aberto"));
});

function mostrarPasso(passo: string): void {
  document.querySelectorAll<HTMLElement>("[data-passo]").forEach((p) => {
    p.hidden = p.dataset.passo !== passo;
  });
  // Escrevendo, a gaveta fica fechada para a carta aparecer inteira; nos outros passos ela abre sozinha.
  gaveta(passo !== "escrever");
}

// ---------- Convite ----------

async function iniciarConvite(): Promise<void> {
  const palco = el("carta-palco");
  const r = await api<Resposta>("/api/carta").catch(() => null);
  if (r) areas = r.areas;
  const cena = await montarNaPagina(palco, papel(null, false, r?.sugestoes.nome ?? ""), () => {
    location.href = "/carta/escrever";
  });
  if (!cena) el("carta-cena").classList.add("carta-cena--sem3d");
  reservarPainel(cena);
}

// ---------- Escrever ----------

function lerCampos(): { nome: string; area: string; mensagem: string; objetivos: string; anos: number | null } {
  const anos = document.querySelector<HTMLInputElement>('input[name="anos"]:checked')?.value;
  return {
    nome: el<HTMLInputElement>("carta-nome").value.trim(),
    area: el<HTMLSelectElement>("carta-area").value,
    mensagem: el<HTMLTextAreaElement>("carta-mensagem").value.trim(),
    objetivos: el<HTMLTextAreaElement>("carta-objetivos").value.trim(),
    anos: anos ? Number(anos) : null,
  };
}

function mostrarErros(erros: Record<string, string>): void {
  const lista = el("carta-erros");
  const mensagens = Object.values(erros);
  lista.hidden = mensagens.length === 0;
  lista.innerHTML = mensagens.map((m) => `<li>${esc(m)}</li>`).join("");
  for (const campo of ["nome", "area", "mensagem", "anos"]) {
    const no = document.getElementById(`carta-${campo}`) ?? document.getElementById(`carta-${campo}-grupo`);
    no?.setAttribute("aria-invalid", String(campo in erros));
  }
}

async function iniciarEscrever(): Promise<void> {
  const palco = el("carta-palco");
  const escrita = el("carta-escrita");
  const status = el("carta-status");
  let r: Resposta;
  try {
    r = await api<Resposta>("/api/carta");
  } catch (erro) {
    el("carta-carregando").textContent = erro instanceof ErroApi ? erro.message : "Não deu para abrir sua carta agora.";
    return;
  }
  areas = r.areas;
  el("carta-carregando").hidden = true;
  let agora = r.agora;

  // Campos: o nome e a área vêm da conta, só como sugestão; o resto é da pessoa.
  const c = r.carta;
  el<HTMLInputElement>("carta-nome").value = c?.nome || r.sugestoes.nome;
  const selectArea = el<HTMLSelectElement>("carta-area");
  selectArea.innerHTML = '<option value="">Sua área</option>' + areas.map((a) => `<option value="${esc(a.valor)}">${esc(a.rotulo)}</option>`).join("");
  selectArea.value = c?.area || r.sugestoes.area;
  el<HTMLTextAreaElement>("carta-mensagem").value = c?.mensagem ?? "";
  el<HTMLTextAreaElement>("carta-objetivos").value = c?.objetivos ?? "";
  el("carta-anos-opcoes").innerHTML = r.anos_validos
    .map((n) => `<label class="carta-ano"><input type="radio" name="anos" value="${n}"${c?.anos === n ? " checked" : ""}><span>${plural(n)}</span></label>`)
    .join("");

  const pronta = ["aguardando", "disponivel", "aberta"].includes(r.situacao ?? "");
  const textoQuando = (): string => {
    const { anos } = lerCampos();
    return anos ? `Chega em ${dataPorExtenso(somarAnos(agora, anos))}.` : "Escolha em quantos anos quer abrir a carta.";
  };

  const dadosAtuais = (texto: boolean): DadosPapel => {
    const campos = lerCampos();
    return { ...papel(campos, texto), area: campos.area ? rotuloDaArea(campos.area) : "", revela: campos.anos ? somarAnos(agora, campos.anos) : null };
  };

  const cena = await montarNaPagina(palco, pronta && c ? papel(c, true) : dadosAtuais(false), () => {
    if (!pronta) void abrirEnvelope();
  });
  if (!cena) el("carta-cena").classList.add("carta-cena--sem3d");
  reservarPainel(cena);
  const reposicionar = (): void => {
    if (!escrita.hidden) alinhar(escrita, cena, palco);
  };
  cena?.aoReposicionar(reposicionar);

  // ----- Cartas que já foram enviadas: não se edita; mostra o estado e os caminhos -----
  if (pronta && c) {
    cena?.mostrarEnvelope({ selado: r.situacao !== "aberta", lado: r.situacao === "aguardando" ? "frente" : "costas" });
    mostrarPasso("guardada");
    const quando = dataPorExtenso(c.revela_em ?? null);
    el("carta-guardada-texto").textContent =
      r.situacao === "aguardando" ? `Sua carta está selada e chega em ${quando}. Até lá, a mensagem fica escondida.`
        : r.situacao === "disponivel" ? "Sua carta chegou! Já dá para abri-la."
          : "Você já abriu esta carta. Dá para relê-la quando quiser.";
    const acao = el<HTMLAnchorElement>("carta-guardada-acao");
    acao.hidden = r.situacao === "aguardando";
    acao.textContent = r.situacao === "disponivel" ? "Abrir minha carta" : "Reler minha carta";
    el("carta-chip-texto").textContent = "Sua carta para o futuro";
    if (cena && r.situacao === "aguardando") el("carta-virar").hidden = false;
    el("carta-virar").addEventListener("click", () => cena?.virar());
    return;
  }

  // ----- Escrever -----
  mostrarPasso("abrir");
  el("carta-abrir").addEventListener("click", () => void abrirEnvelope());
  const dizer = (t: string): void => {
    status.textContent = t;
  };

  async function abrirEnvelope(): Promise<void> {
    entrarTelaCheia(); // no próprio clique, para o navegador aceitar
    el<HTMLButtonElement>("carta-abrir").disabled = true;
    await cena?.abrir();
    mostrarPasso("escrever");
    escrita.hidden = false;
    alinhar(escrita, cena, palco);
    el("carta-quando").textContent = textoQuando();
    el<HTMLTextAreaElement>("carta-mensagem").focus({ preventScroll: true });
  }

  const salvar = async (): Promise<boolean> => {
    dizer("Salvando…");
    try {
      await api("/api/carta", { method: "PUT", body: JSON.stringify(lerCampos()) });
      dizer("Rascunho salvo. Você pode continuar depois pelo seu perfil.");
      return true;
    } catch (erro) {
      if (erro instanceof ErroApi) mostrarErros(erro.erros);
      dizer(erro instanceof ErroApi ? erro.message : "Não consegui salvar agora.");
      return false;
    }
  };

  let timer: number | undefined;
  const aoEditar = (): void => {
    cena?.atualizar(dadosAtuais(false));
    el("carta-quando").textContent = textoQuando();
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void salvar(), 1000);
  };
  for (const id of ["carta-nome", "carta-area", "carta-mensagem", "carta-objetivos"]) {
    el(id).addEventListener("input", aoEditar);
    el(id).addEventListener("change", aoEditar);
  }
  el("carta-anos-opcoes").addEventListener("change", aoEditar);
  // A lista aberta de áreas sobe para uma camada acima da página: garante que a carta continue desenhada por baixo.
  for (const evento of ["focus", "click", "blur", "change"]) el("carta-area").addEventListener(evento, () => cena?.redesenhar());
  el("carta-salvar").addEventListener("click", () => {
    window.clearTimeout(timer);
    void salvar();
  });

  // Revisar: confere no navegador (para avisar cedo) e mostra a carta pronta. O servidor confere de novo ao enviar.
  el("carta-revisar").addEventListener("click", () => {
    window.clearTimeout(timer);
    const campos = lerCampos();
    const erros: Record<string, string> = {};
    if (!campos.nome) erros.nome = "Escreva o seu nome.";
    if (!campos.area) erros.area = "Escolha a sua área.";
    if (campos.mensagem.length < 20) erros.mensagem = "Escreva um pouco mais: pelo menos 20 caracteres.";
    if (!campos.anos) erros.anos = "Escolha em quantos anos quer abrir a carta.";
    mostrarErros(erros);
    if (Object.keys(erros).length) {
      dizer("Falta preencher alguns campos.");
      return;
    }
    dizer("");
    cena?.atualizar(dadosAtuais(true));
    escrita.hidden = true;
    el("carta-resumo").textContent = `Sua carta será selada e só poderá ser aberta em ${dataPorExtenso(somarAnos(agora, campos.anos ?? 1))}. Depois de enviada, ela não pode mais ser alterada.`;
    mostrarPasso("revisar");
  });

  el("carta-voltar-escrever").addEventListener("click", () => {
    cena?.atualizar(dadosAtuais(false));
    escrita.hidden = false;
    alinhar(escrita, cena, palco);
    mostrarPasso("escrever");
  });

  // Enviar: só anima depois que o servidor confirmou. Falha de conexão não vira "enviada".
  let enviando = false;
  el("carta-enviar").addEventListener("click", async () => {
    if (enviando) return;
    enviando = true;
    const botao = el<HTMLButtonElement>("carta-enviar");
    botao.disabled = true;
    el("carta-enviar-status").textContent = "Enviando…";
    try {
      const resposta = await postJson<Resposta>("/api/carta/enviar", { ...lerCampos(), confirmar: true });
      agora = resposta.agora;
      const sel = resposta.carta;
      el("carta-enviar-status").textContent = "";
      mostrarPasso("selando");
      cena?.atualizar({ ...dadosAtuais(true), enviada: sel?.enviada_em ?? null, revela: sel?.revela_em ?? null });
      await cena?.selar();
      el("carta-final-texto").textContent = `Sua carta foi selada. Ela chega em ${dataPorExtenso(sel?.revela_em ?? null)}.`;
      mostrarPasso("enviada");
      el("carta-final-titulo").focus();
    } catch (erro) {
      enviando = false;
      botao.disabled = false;
      if (erro instanceof ErroApi && erro.status === 409) {
        el("carta-enviar-status").textContent = "Esta carta já tinha sido enviada. Atualizando…";
        location.reload();
        return;
      }
      if (erro instanceof ErroApi) mostrarErros(erro.erros);
      el("carta-enviar-status").textContent = erro instanceof ErroApi ? erro.message : "Não consegui enviar. Tente de novo.";
    }
  });

  el("carta-virar").addEventListener("click", () => cena?.virar());
  window.addEventListener("resize", reposicionar);
}

// ---------- Reabrir ----------

async function iniciarAbrir(): Promise<void> {
  const palco = el("carta-palco");
  const leitura = el("carta-leitura");
  let r: Resposta;
  try {
    r = await api<Resposta>("/api/carta");
  } catch (erro) {
    el("carta-carregando").textContent = erro instanceof ErroApi ? erro.message : "Não deu para abrir sua carta agora.";
    return;
  }
  areas = r.areas;
  el("carta-carregando").hidden = true;
  const c = r.carta;
  if (!c || !["aguardando", "disponivel", "aberta"].includes(r.situacao ?? "")) {
    mostrarPasso("sem-carta");
    return;
  }
  const cena = await montarNaPagina(palco, papel(c, true));
  if (!cena) el("carta-cena").classList.add("carta-cena--sem3d");
  reservarPainel(cena);
  const selado = r.situacao !== "aberta";
  cena?.mostrarEnvelope({ selado, lado: "costas" });
  cena?.aoReposicionar(() => {
    if (!leitura.hidden) alinhar(leitura, cena, palco);
  });

  if (r.situacao === "aguardando") {
    mostrarPasso("aguardando");
    el("carta-aguardando-texto").textContent = `Ainda não é hora. Sua carta chega em ${dataPorExtenso(c.revela_em ?? null)}.`;
    return;
  }
  mostrarPasso("pronta");
  el("carta-pronta-texto").textContent = r.situacao === "disponivel" ? "Chegou o dia. Sua carta está esperando por você." : "Quer reler a sua carta?";
  el("carta-abrir-carta").textContent = r.situacao === "disponivel" ? "Abrir minha carta" : "Reler minha carta";

  el("carta-abrir-carta").addEventListener("click", async () => {
    entrarTelaCheia();
    const botao = el<HTMLButtonElement>("carta-abrir-carta");
    botao.disabled = true;
    try {
      // É o servidor que confere a data e só então entrega a mensagem.
      const aberta = await postJson<Resposta>("/api/carta/abrir", {});
      const d = aberta.carta;
      if (!d) throw new ErroApi("Não consegui abrir sua carta.", 500);
      el("carta-leitura-mensagem").textContent = d.mensagem ?? "";
      el("carta-leitura-objetivos").textContent = d.objetivos ? `P.S. ${d.objetivos}` : "";
      el("carta-leitura-assinatura").textContent = `${d.nome}${d.area ? `, ${rotuloDaArea(d.area)}` : ""}`;
      mostrarPasso("lendo");
      cena?.atualizar(papel(d, false));
      await cena?.abrir();
      leitura.hidden = false;
      alinhar(leitura, cena, palco);
      el("carta-leitura-mensagem").focus({ preventScroll: true });
    } catch (erro) {
      botao.disabled = false;
      el("carta-pronta-texto").textContent = erro instanceof ErroApi ? erro.message : "Não consegui abrir agora. Tente de novo.";
    }
  });
  window.addEventListener("resize", () => {
    if (!leitura.hidden) alinhar(leitura, cena, palco);
  });
}

// ---------- Perfil ----------

async function iniciarPerfil(): Promise<void> {
  const bloco = el("carta-perfil");
  const acao = el<HTMLAnchorElement>("carta-perfil-acao");
  let r: Resposta;
  try {
    r = await api<Resposta>("/api/carta");
  } catch {
    bloco.hidden = true; // sem a carta, o perfil segue normal
    return;
  }
  areas = r.areas;
  const c = r.carta;
  const texto = el("carta-perfil-texto");
  if ((r.situacao === "aguardando" || r.situacao === "disponivel" || r.situacao === "aberta") && c) {
    const palco = el("carta-perfil-palco");
    el("carta-perfil-grupo").hidden = false;
    bloco.hidden = false;
    const quando = dataPorExtenso(c.revela_em ?? null);
    if (r.situacao === "aguardando") {
      texto.textContent = `Sua carta para o futuro está selada. Ela chega em ${quando}, e até lá a mensagem fica escondida.`;
      acao.hidden = true;
    } else if (r.situacao === "disponivel") {
      texto.textContent = "Sua carta chegou! Chegou a hora de ler o que você escreveu.";
      acao.hidden = false;
      acao.href = "/carta/abrir";
      acao.textContent = "Abrir minha carta";
    } else {
      texto.textContent = "Você já abriu a sua carta para o futuro.";
      acao.hidden = false;
      acao.href = "/carta/abrir";
      acao.textContent = "Reler minha carta";
    }
    const cena = await montarNaPagina(palco, papel(c, true));
    if (cena) {
      cena.mostrarEnvelope({ selado: r.situacao !== "aberta", lado: r.situacao === "aguardando" ? "frente" : "costas" });
      const virar = el<HTMLButtonElement>("carta-perfil-virar");
      virar.hidden = false;
      virar.addEventListener("click", () => cena.virar());
    } else {
      el("carta-perfil-grupo").hidden = true;
    }
    return;
  }
  if (r.situacao === "em_criacao") {
    texto.textContent = "Você começou uma carta para a sua versão do futuro e ainda não enviou. Dá para continuar de onde parou.";
    acao.textContent = "Continuar minha carta";
  } else {
    texto.textContent = "Escreva uma carta para a cientista que você vai ser. Ela fica guardada e só abre na data que você escolher.";
    acao.textContent = "Escrever minha carta para o futuro";
  }
  acao.hidden = false;
  acao.href = "/carta/escrever";
  bloco.hidden = false;
}

if (document.getElementById("carta-cena")) {
  const modo = el("carta-cena").dataset.modo;
  if (modo === "convite") void iniciarConvite();
  if (modo === "escrever") void iniciarEscrever();
  if (modo === "abrir") void iniciarAbrir();
}
if (document.getElementById("carta-perfil")) void iniciarPerfil();
