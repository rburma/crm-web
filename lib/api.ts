// Cliente da API — fala SEMPRE com o proxy do proprio site (/api/render/*).
// Nenhum segredo aqui; o proxy (servidor) injeta portao + identidade.

const BASE = "/api/render";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/${path}`, { cache: "no-store", ...init });
  if (!r.ok) {
    let detail = `Erro ${r.status}`;
    try {
      const j = await r.json();
      detail = j.detail ?? detail;
    } catch {
      /* mantem o detail padrao */
    }
    throw new Error(detail);
  }
  return r.json() as Promise<T>;
}

// ── Tipos ──────────────────────────────────────────────────────────
export type ClienteResumo = {
  id: number;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  uf: string | null;
};

export type AtendimentoResumo = {
  id: number;
  numero: string;
  assunto: string | null;
  status: string;
  prioridade: string;
  marca_id: number | null;
  loja_id: number | null;
  canal_origem: string | null;
  criado_em: string | null;
  encerrado_em: string | null;
};

export type ClubeVinculo = {
  vinculo_id: number;
  clube_nome: string;
  nivel: string | null;
  ativo: boolean;
  desde: string | null;
};

export type Ficha = {
  id: number;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  nascimento: string | null;
  uf: string | null;
  atributos: Record<string, unknown>;
  criado_em: string | null;
  atendimentos: AtendimentoResumo[];
  total_atendimentos: number;
  clubes: ClubeVinculo[];
};

export type AtendimentoItem = {
  id: number;
  numero: string;
  marca: string | null;
  loja: string | null;
  consumidor_id: number | null;
  cliente: string | null;
  assunto: string | null;
  status: string;
  prioridade: string;
  canal_origem: string | null;
  criado_em: string | null;
};

export type AtendimentosLista = {
  items: AtendimentoItem[];
  total: number;
  limit: number;
  offset: number;
};

export type Mensagem = {
  id: number;
  autor_tipo: string;
  autor_id: number | null;
  texto: string;
  privado: boolean;
  criado_em: string | null;
};

export type AtendimentoDetalhe = {
  id: number;
  numero: string;
  marca: string | null;
  loja: string | null;
  assunto: string | null;
  status: string;
  prioridade: string;
  canal_origem: string | null;
  criado_em: string | null;
  encerrado_em: string | null;
  custom: Record<string, unknown> | null;
  cliente: {
    id: number;
    nome: string | null;
    cpf: string | null;
    telefone: string | null;
    email: string | null;
    atributos?: Record<string, unknown> | null;
  } | null;
  mensagens: Mensagem[];
  total_mensagens: number;
};

// ── Endpoints ──────────────────────────────────────────────────────
export function buscarClientes(q: string, limit = 50, offset = 0): Promise<ClienteResumo[]> {
  const qs = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
  return req<ClienteResumo[]>(`clientes?${qs.toString()}`);
}

export function ficha360(id: number | string): Promise<Ficha> {
  return req<Ficha>(`clientes/${id}`);
}

export function listarAtendimentos(opts: {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AtendimentosLista> {
  const qs = new URLSearchParams();
  if (opts.q) qs.set("q", opts.q);
  if (opts.status) qs.set("status", opts.status);
  qs.set("limit", String(opts.limit ?? 50));
  qs.set("offset", String(opts.offset ?? 0));
  return req<AtendimentosLista>(`atendimentos?${qs.toString()}`);
}

export function detalheAtendimento(id: number | string, msgLimit = 300): Promise<AtendimentoDetalhe> {
  return req<AtendimentoDetalhe>(`atendimentos/${id}?msg_limit=${msgLimit}`);
}

// ── Util ───────────────────────────────────────────────────────────
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("pt-BR");
}

export function statusBadge(status: string): string {
  if (status === "encerrada") return "badge-gray";
  if (status === "em_espera") return "badge-amber";
  return "badge-green";
}

// Rotulos amigaveis das chaves da ficha (custom do ticket + atributos do cliente).
export const ROTULO_FICHA: Record<string, string> = {
  produto: "Produto",
  cor: "Cor",
  tamanho: "Tamanho",
  link: "Link do produto",
  pedido: "Nº do pedido",
  loja_proxima: "Loja mais próxima",
  cep: "CEP",
  cidade: "Cidade",
  uf: "UF",
  estado: "Estado",
  endereco: "Endereço",
};

// Ordem de exibicao preferida; chaves desconhecidas vao ao fim, na ordem original.
const _ORDEM_FICHA = [
  "produto", "cor", "tamanho", "pedido", "loja_proxima",
  "endereco", "cidade", "uf", "estado", "cep", "link",
];

export type ParFicha = { chave: string; rotulo: string; valor: string; isLink: boolean };

// Transforma um objeto (custom/atributos) numa lista ordenada de pares exibiveis.
export function paresFicha(obj: Record<string, unknown> | null | undefined): ParFicha[] {
  if (!obj || typeof obj !== "object") return [];
  const chaves = Object.keys(obj).filter((k) => {
    const v = obj[k];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
  chaves.sort((a, b) => {
    const ia = _ORDEM_FICHA.indexOf(a);
    const ib = _ORDEM_FICHA.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return chaves.map((k) => ({
    chave: k,
    rotulo: ROTULO_FICHA[k] ?? k,
    valor: String(obj[k]),
    isLink: k === "link" || /^https?:\/\//i.test(String(obj[k])),
  }));
}
