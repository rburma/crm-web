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

// Variante para listas paginadas: devolve o corpo (array) + o total (header
// X-Total-Count, repassado pelo proxy). Usada por Clientes e Usuários.
async function reqLista<T>(path: string): Promise<{ items: T[]; total: number }> {
  const r = await fetch(`${BASE}/${path}`, { cache: "no-store" });
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
  const items = (await r.json()) as T[];
  const tc = Number(r.headers.get("X-Total-Count"));
  return { items, total: Number.isFinite(tc) && tc > 0 ? tc : items.length };
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
export type ClientesPagina = { items: ClienteResumo[]; total: number };

export function buscarClientes(q: string, limit = 50, offset = 0): Promise<ClientesPagina> {
  const qs = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
  return reqLista<ClienteResumo>(`clientes?${qs.toString()}`);
}

export function ficha360(id: number | string): Promise<Ficha> {
  return req<Ficha>(`clientes/${id}`);
}

export function listarAtendimentos(opts: {
  q?: string;
  status?: string;
  marcaId?: number | null;
  limit?: number;
  offset?: number;
} = {}): Promise<AtendimentosLista> {
  const qs = new URLSearchParams();
  if (opts.q) qs.set("q", opts.q);
  if (opts.status) qs.set("status", opts.status);
  if (opts.marcaId != null) qs.set("marca_id", String(opts.marcaId));
  qs.set("limit", String(opts.limit ?? 50));
  qs.set("offset", String(opts.offset ?? 0));
  return req<AtendimentosLista>(`atendimentos?${qs.toString()}`);
}

export type MarcaItem = { id: number; slug: string; nome: string | null; ativo: boolean };

export function listarMarcas(): Promise<MarcaItem[]> {
  return req<MarcaItem[]>("marcas");
}

export function detalheAtendimento(id: number | string, msgLimit = 300): Promise<AtendimentoDetalhe> {
  return req<AtendimentoDetalhe>(`atendimentos/${id}?msg_limit=${msgLimit}`);
}

// Ação em lote sobre atendimentos: muda status ou define marca.
export function atendimentosEmLote(
  ids: number[], acao: "status" | "marca", valor: string,
): Promise<BulkResult> {
  return req<BulkResult>("atendimentos/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, acao, valor }),
  });
}

// ── Login / sessão ─────────────────────────────────────────────────
export type UsuarioLogado = {
  id: number; nome: string | null; email: string | null; papel: string; ativo: boolean;
};

export function login(email: string, senha: string): Promise<{ token: string; usuario: UsuarioLogado }> {
  return req("auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
}

export function salvarSessao(token: string, usuario: UsuarioLogado): void {
  document.cookie = `crm_token=${token}; path=/; max-age=${7 * 86400}; samesite=lax`;
  try { localStorage.setItem("crm_usuario", JSON.stringify(usuario)); } catch { /* ignore */ }
}

export function usuarioLogado(): UsuarioLogado | null {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem("crm_usuario") : null;
    return s ? (JSON.parse(s) as UsuarioLogado) : null;
  } catch { return null; }
}

export function logout(): void {
  document.cookie = "crm_token=; path=/; max-age=0";
  try { localStorage.removeItem("crm_usuario"); } catch { /* ignore */ }
}

// ── Gestão de usuários (admin) ──────────────────────────────────────
export type UsuarioGestao = {
  id: number; nome: string | null; email: string | null; papel: string;
  ativo: boolean; tem_senha: boolean;
};

export type UsuariosPagina = { items: UsuarioGestao[]; total: number };

export function listarUsuarios(q = "", limit = 50, offset = 0): Promise<UsuariosPagina> {
  const qs = `q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;
  return reqLista<UsuarioGestao>(`auth/usuarios?${qs}`);
}

export function criarUsuario(dados: {
  nome: string; email: string; papel: string; senha?: string;
}): Promise<UsuarioGestao> {
  return req("auth/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}

export function atualizarUsuario(
  id: number, dados: { nome?: string; papel?: string; ativo?: boolean },
): Promise<UsuarioGestao> {
  return req(`auth/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}

export function definirSenha(id: number, senha: string): Promise<{ ok: boolean }> {
  return req(`auth/usuarios/${id}/senha`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senha }),
  });
}

export type BulkResult = { ok: number; falhas: { id?: number; motivo: string }[] };

// Ação em lote sobre usuários: define papel, ativa ou desativa (não exclui).
export function usuariosEmLote(
  ids: number[], acao: "papel" | "ativar" | "desativar", papel?: string,
): Promise<BulkResult> {
  return req<BulkResult>("auth/usuarios/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, acao, papel }),
  });
}

export type RespostaResult = {
  id: number;
  autor_tipo: string;
  texto: string;
  privado: boolean;
  criado_em: string | null;
  email: { tentado: boolean; ok: boolean; detalhe: string; para: string | null };
};

// Registra resposta do atendente (e envia por e-mail se enviarEmail + SMTP no servidor).
export function responderAtendimento(
  id: number | string, texto: string, privado: boolean, enviarEmail: boolean,
): Promise<RespostaResult> {
  return req<RespostaResult>(`atendimentos/${id}/responder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto, privado, enviar_email: enviarEmail }),
  });
}

export type MergeResult = {
  principal: ClienteResumo;
  fundidos: number[];
  ignorados: number[];
  total_atendimentos: number;
};

// Funde varios clientes num so (principal sobrevive). Admin-only no backend.
export function mergeClientes(principalId: number, ids: number[]): Promise<MergeResult> {
  return req<MergeResult>("clientes/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ principal_id: principalId, ids }),
  });
}

// Define (ou remove, se valor vazio) um atributo de cadastro em varios clientes.
export function clientesBulkAtributo(
  ids: number[], chave: string, valor: string,
): Promise<BulkResult> {
  return req<BulkResult>("clientes/bulk-atributo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, chave, valor }),
  });
}

// LGPD: anonimiza o titular (remove identificacao, preserva o registro). Admin-only.
export function anonimizarCliente(id: number): Promise<ClienteResumo> {
  return req<ClienteResumo>(`clientes/${id}/anonimizar`, { method: "POST" });
}

// ── Util ───────────────────────────────────────────────────────────
// Exibe sempre no fuso de Brasilia (o instante e guardado em UTC). O Intl trata
// o horario de verao historico do Brasil — corrige o "dia a menos".
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 16);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function statusBadge(status: string): string {
  if (status === "encerrada") return "badge-gray";
  if (status === "em_espera") return "badge-amber";
  return "badge-green";
}

// Telefone no padrao "+55 (DD) XXXXX-XXXX". Aceita com/sem 55, com/sem DDD.
// Se nao reconhecer o formato, devolve os digitos crus (nunca mente).
export function fmtTelefone(raw: string | null | undefined): string {
  if (!raw) return "—";
  let d = String(raw).replace(/\D/g, "");
  if (!d) return String(raw);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2); // tira codigo do pais
  let ddd = "";
  let num = d;
  if (d.length === 11 || d.length === 10) {
    ddd = d.slice(0, 2);
    num = d.slice(2);
  } else if (d.length !== 9 && d.length !== 8) {
    return "+55 " + d; // formato inesperado: devolve sem mascara
  }
  const numFmt =
    num.length === 9 ? `${num.slice(0, 5)}-${num.slice(5)}`
    : num.length === 8 ? `${num.slice(0, 4)}-${num.slice(4)}`
    : num;
  return ddd ? `+55 (${ddd}) ${numFmt}` : numFmt;
}

// CPF mascarado "000.000.000-00" (so visual; nao altera o dado).
export function fmtCpf(raw: string | null | undefined): string {
  if (!raw) return "—";
  const c = String(raw).replace(/\D/g, "");
  if (c.length !== 11) return String(raw);
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

// Valida CPF pelos digitos verificadores (algoritmo oficial da Receita).
export function cpfValido(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const c = String(raw).replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i], 10) * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i], 10) * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
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

export type ParFicha = { chave: string; rotulo: string; valor: string; isLink: boolean };

// Transforma um objeto (custom/atributos) numa lista ordenada de pares exibiveis.
// Mostra TODOS os campos da ficha, na ORDEM original (do formulario). Para chaves
// canonicas (atributos do cliente) usa um rotulo amigavel; para a ficha completa
// do atendimento, a propria chave JA E o rotulo do formulario.
export function paresFicha(obj: Record<string, unknown> | null | undefined): ParFicha[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => ({
      chave: k,
      rotulo: ROTULO_FICHA[k] ?? k,
      valor: String(v),
      isLink: k === "link" || /^https?:\/\//i.test(String(v)),
    }));
}
