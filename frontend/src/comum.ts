// Tipos da API do mural e utilidades usadas pelas páginas do mural.

export interface Opcao {
  valor: string;
  rotulo: string;
}

export interface CampoExtra {
  nome: string;
  rotulo: string;
  tipo: "texto" | "selecao" | "url";
  obrigatorio: boolean;
  opcoes?: Opcao[];
  ajuda?: string;
}

export interface MaterialExigido {
  exige: "arquivo" | "link" | "um_dos_dois";
  rotulo_arquivo: string;
  rotulo_link: string;
  ajuda_link: string | null;
  erro: string;
  fotos_contam: boolean;
}

export interface TipoProjeto {
  valor: string;
  rotulo: string;
  icone: string;
  descricao: string;
  campos: CampoExtra[];
  material: MaterialExigido;
}

export interface ArquivoEnviado {
  id: number;
  nome: string;
  url: string;
  tipo: "pdf" | "imagem" | "documento" | "apresentacao";
  tamanho: number;
}

export interface OpcoesMural {
  tipos: TipoProjeto[];
  areas: Opcao[];
  niveis: Opcao[];
  identidades: Opcao[];
  instituicoes: string[];
  cidades: string[];
  motivos_denuncia: Opcao[];
}

export interface Cartao {
  id: number;
  titulo: string;
  tipo: string;
  tipo_rotulo: string;
  icone: string;
  area: string;
  area_rotulo: string;
  autora: string;
  ano: number;
  imagem_url: string | null;
  resumo_curto: string;
  destaque: boolean;
  materiais: number;
}

export interface DetalheExtra {
  rotulo: string;
  valor: string;
  e_link: boolean;
}

export interface Detalhe extends Cartao {
  resumo: string;
  link_externo: string | null;
  instituicao: string | null;
  cidade: string | null;
  nivel_rotulo: string | null;
  detalhes: DetalheExtra[];
  arquivos: ArquivoEnviado[];
  fotos: ArquivoEnviado[];
}

export interface PaginaProjetos {
  itens: Cartao[];
  total: number;
  pagina: number;
  tem_mais: boolean;
}

export class ErroApi extends Error {
  status: number;
  erros: Record<string, string>;

  constructor(mensagem: string, status: number, erros: Record<string, string> = {}) {
    super(mensagem);
    this.status = status;
    this.erros = erros;
  }
}

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });
  } catch {
    throw new ErroApi("Sem conexão com o servidor. Verifique sua internet e tente de novo.", 0);
  }

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroApi(
      corpo.erro ?? `O servidor respondeu com erro ${resposta.status}. Tente de novo em instantes.`,
      resposta.status,
      corpo.erros ?? {},
    );
  }
  return corpo as T;
}

export function postJson<T>(url: string, dados: unknown): Promise<T> {
  return api<T>(url, { method: "POST", body: JSON.stringify(dados) });
}

export const LIMITE_UPLOAD_MB = 10;
export const EXTENSOES_MATERIAL = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".docx", ".pptx"];
export const EXTENSOES_IMAGEM = [".jpg", ".jpeg", ".png", ".webp"];

/** Confere formato e tamanho antes de enviar. Devolve a mensagem de erro, ou null se estiver tudo certo. */
export function conferirArquivo(arquivo: File, extensoes: string[]): string | null {
  const nome = arquivo.name.toLowerCase();
  if (!extensoes.some((ext) => nome.endsWith(ext))) {
    return extensoes === EXTENSOES_IMAGEM
      ? "As fotos precisam ser imagens jpg, png ou webp."
      : "Formato não aceito. Envie PDF, imagem, Word (.docx) ou PowerPoint (.pptx).";
  }
  if (arquivo.size > LIMITE_UPLOAD_MB * 1024 * 1024) {
    return `O arquivo passa de ${LIMITE_UPLOAD_MB} MB. Diminua o tamanho e envie de novo.`;
  }
  return null;
}

export async function enviarArquivo(
  arquivo: File,
  finalidade: "material" | "foto" | "capa",
): Promise<ArquivoEnviado> {
  const corpo = new FormData();
  corpo.append("arquivo", arquivo);
  corpo.append("finalidade", finalidade);

  let resposta: Response;
  try {
    resposta = await fetch("/api/uploads", { method: "POST", body: corpo });
  } catch {
    throw new ErroApi("Sem conexão com o servidor. Verifique sua internet e tente de novo.", 0);
  }
  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroApi(json.erro ?? `O envio falhou (erro ${resposta.status}). Tente de novo.`, resposta.status);
  }
  return json as ArquivoEnviado;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

const NOME_DO_FORMATO: Record<ArquivoEnviado["tipo"], string> = {
  pdf: "PDF",
  imagem: "Imagem",
  documento: "Word",
  apresentacao: "PowerPoint",
};

export function nomeDoFormato(tipo: ArquivoEnviado["tipo"]): string {
  return NOME_DO_FORMATO[tipo] ?? "Arquivo";
}

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Algo deu errado. Tente de novo.";
}

const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapa texto antes de colocar em HTML. Use em todo dado que vem da API. */
export function esc(texto: unknown): string {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

/** Aceita só links http(s) ou imagens enviadas pelo próprio site. */
export function urlSegura(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) return url;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const elemento = document.getElementById(id);
  if (!elemento) throw new Error(`Elemento #${id} não encontrado na página.`);
  return elemento as T;
}

export function preencherSelect(select: HTMLSelectElement, itens: Array<Opcao | string>): void {
  for (const item of itens) {
    const opcao = typeof item === "string" ? { valor: item, rotulo: item } : item;
    select.add(new Option(opcao.rotulo, opcao.valor));
  }
}

// Ícones de traço, 24x24. Um por tipo de projeto, mais alguns de interface.
const ICONES: Record<string, string> = {
  monografia: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6M9 11h4"/>',
  congresso: '<rect x="3" y="3.5" width="18" height="12" rx="1"/><path d="M12 15.5V20M8 21l4-1 4 1"/><path d="m7 12 3-3 2.5 2L17 7"/>',
  ic: '<path d="M9 3h6M10 3v6.2L4.6 18.4A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"/><path d="M7.2 15h9.6"/>',
  extensao: '<circle cx="8.5" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.4"/><path d="M3 20a5.5 5.5 0 0 1 11 0"/><path d="M14.5 15.6A4 4 0 0 1 21 18.5"/>',
  software: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8.5h18"/><path d="m10 12-2.5 2.5L10 17M14 12l2.5 2.5L14 17"/>',
  social: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z"/>',
  aula: '<path d="M6 3h11.5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z"/><path d="M6 3v18M3.5 7.5H6M3.5 12H6M3.5 16.5H6"/><path d="M10 8h5M10 11.5h5"/>',
  prototipo: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>',
  externo: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  alerta: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.5v.01"/>',
  arquivo: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  imagem: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  clipe: '<path d="m20.5 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  enviar: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  baixar: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
};

export function icone(nome: string): string {
  return `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] ?? ICONES.prototipo}</svg>`;
}
