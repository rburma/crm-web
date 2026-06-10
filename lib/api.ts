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

export type LojaItem = {
  id: number; marca_id: number | null; nome: string;
  cidade: string | null; uf: string | null; ativo: boolean;
};

// Lojas no escopo do usuário (com busca e limite — para pickers).
export function listarLojas(opts: { marcaId?: number; q?: string; limit?: number } = {}): Promise<LojaItem[]> {
  const qs = new URLSearchParams();
  if (opts.marcaId != null) qs.set("marca_id", String(opts.marcaId));
  if (opts.q) qs.set("q", opts.q);
  qs.set("limit", String(opts.limit ?? 30));
  return req<LojaItem[]>(`lojas?${qs.toString()}`);
}

// Cria atendimento INTERNO (telefone/balcão/WhatsApp). Cliente existente OU novo
// (a identidade resolve: se telefone/e-mail já existem, usa o cliente existente).
export type AtendimentoCriado = {
  id: number; numero: string; status: string;
  consumidor_id: number; cliente_nome: string | null;
  cliente_status: "existente" | "novo";
  loja_id: number; marca_id: number | null; criado_em: string;
};

export function criarAtendimento(body: {
  loja_id: number;
  consumidor_id?: number;
  novo_cliente?: { nome: string; telefone?: string; email?: string };
  assunto: string;
  mensagem: string;
  prioridade?: string;
  canal_origem?: string;
  resposta_imediata?: string;
  encerrar?: boolean;
}): Promise<AtendimentoCriado> {
  return req<AtendimentoCriado>("atendimentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function detalheAtendimento(id: number | string, msgLimit = 300): Promise<AtendimentoDetalhe> {
  return req<AtendimentoDetalhe>(`atendimentos/${id}?msg_limit=${msgLimit}`);
}

// Muda o status do atendimento (aberta | em_espera | encerrada). Auditado.
export function mudarStatusAtendimento(
  id: number | string, status: "aberta" | "em_espera" | "encerrada",
): Promise<{ id: number; status: string }> {
  return req(`atendimentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
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

// ── "Entrar como" (impersonação — admin verifica a visão de outro usuário) ──
export async function entrarComo(usuarioId: number): Promise<UsuarioLogado> {
  const r = await req<{ token: string; usuario: UsuarioLogado }>(
    `auth/impersonar/${usuarioId}`, { method: "POST" },
  );
  salvarSessao(r.token, r.usuario);
  try { localStorage.setItem("crm_impersonando", "1"); } catch { /* ignore */ }
  return r.usuario;
}

export function impersonando(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem("crm_impersonando") === "1";
  } catch { return false; }
}

export function sairImpersonacao(): void {
  logout();
  try { localStorage.removeItem("crm_impersonando"); } catch { /* ignore */ }
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

// Chat de consultas (IA -> SQL somente leitura). Admin-only no backend.
export type ConsultaIAResult = {
  sql: string;
  colunas: string[];
  linhas: (string | number | boolean | null)[][];
  n: number;
  resposta?: string;
};

export function consultaIA(pergunta: string): Promise<ConsultaIAResult> {
  return req<ConsultaIAResult>("ia/consulta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pergunta }),
  });
}

// ── Importação de clientes por planilha (.xlsx) ─────────────────────
// Campos de destino que o backend reconhece como "quentes" (o resto vira atributo).
export const CAMPOS_IMPORT: { campo: string; rotulo: string }[] = [
  { campo: "", rotulo: "— ignorar —" },
  { campo: "nome", rotulo: "Nome" },
  { campo: "cpf", rotulo: "CPF" },
  { campo: "telefone", rotulo: "Telefone" },
  { campo: "email", rotulo: "E-mail" },
  { campo: "nascimento", rotulo: "Nascimento" },
  { campo: "loja_ref", rotulo: "Loja (apelido/código/CNPJ/nome)" },
  { campo: "tags", rotulo: "Tags (separadas por , ou ;)" },
];

export type ImportColunas = { colunas: string[]; amostra: string[][] };

// Lê só o cabeçalho + amostra do .xlsx (para montar o mapeamento). Só leitura.
export function importColunas(arquivo: File): Promise<ImportColunas> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  return req<ImportColunas>("importacoes/clientes/colunas", { method: "POST", body: fd });
}

export type ImportLinhaPreview = {
  linha: number; acao: "novo" | "enriquece" | "erro";
  consumidor_id?: number; loja_id?: number; motivo?: string;
};
export type ImportPreview = {
  total: number; novos: number; enriquece: number;
  erros: { linha: number; motivo: string }[];
  amostra: ImportLinhaPreview[];
};

// Dry-run: classifica cada linha (novo/enriquece/erro). NÃO escreve nada.
export function importPreview(
  arquivo: File, mapeamento: Record<string, string>, origem: string,
): Promise<ImportPreview> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  fd.append("mapeamento", JSON.stringify(mapeamento));
  fd.append("origem", origem);
  return req<ImportPreview>("importacoes/clientes/preview", { method: "POST", body: fd });
}

export type ImportResultado = {
  importacao_id: number; origem: string; descricao: string | null;
  total_linhas: number; novos: number; enriquecidos: number; erros: number;
  detalhe: { linhas: { _linha: number; acao: string; motivo?: string }[] };
};

// Aplica de fato (cria/enriquece + multi-loja + identidade). Auditado no backend.
export function importAplicar(
  arquivo: File, mapeamento: Record<string, string>, origem: string, descricao?: string,
): Promise<ImportResultado> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  fd.append("mapeamento", JSON.stringify(mapeamento));
  fd.append("origem", origem);
  if (descricao) fd.append("descricao", descricao);
  return req<ImportResultado>("importacoes/clientes/aplicar", { method: "POST", body: fd });
}

// ── Equipe & Departamentos (matriz usuário↔loja, modelo do legado) ──
export type EquipeResumo = {
  totais: { vinculos: number; usuarios_vinculados: number; admins_globais: number };
  marcas: { id: number; nome: string; lojas: number; usuarios: number }[];
};
export type LojaEquipe = { id: number; nome: string; usuarios: number; admins: number };
export type MembroLoja = {
  usuario_id: number; nome: string | null; email: string | null;
  papel: string; ativo: boolean; admin_loja: boolean;
};
export type LojaDoUsuario = {
  loja_id: number; loja: string; marca: string | null; admin_loja: boolean;
};

export function equipeResumo(): Promise<EquipeResumo> {
  return req<EquipeResumo>("equipe/resumo");
}
export function equipeLojas(
  marcaId: number, q = "", limit = 50, offset = 0,
): Promise<{ total: number; items: LojaEquipe[] }> {
  const qs = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
  return req(`equipe/marcas/${marcaId}/lojas?${qs.toString()}`);
}
export function equipeUsuariosDaLoja(lojaId: number): Promise<MembroLoja[]> {
  return req(`equipe/lojas/${lojaId}/usuarios`);
}
export function equipeVincular(
  lojaId: number, usuarioId: number, admin: boolean,
): Promise<{ ok: boolean }> {
  return req(`equipe/lojas/${lojaId}/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario_id: usuarioId, admin }),
  });
}
export function equipeAlterarAdmin(
  lojaId: number, usuarioId: number, admin: boolean,
): Promise<{ ok: boolean }> {
  return req(`equipe/lojas/${lojaId}/usuarios/${usuarioId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin }),
  });
}
export function equipeDesvincular(lojaId: number, usuarioId: number): Promise<{ ok: boolean }> {
  return req(`equipe/lojas/${lojaId}/usuarios/${usuarioId}`, { method: "DELETE" });
}
export function equipeBuscarUsuarios(
  q: string,
): Promise<{ id: number; nome: string | null; email: string | null; papel: string }[]> {
  return req(`equipe/usuarios/busca?q=${encodeURIComponent(q)}`);
}
export function equipeLojasDoUsuario(usuarioId: number): Promise<LojaDoUsuario[]> {
  return req(`equipe/usuarios/${usuarioId}/lojas`);
}

// ── Páginas PÚBLICAS (formulário de abertura + acompanhamento) ──────
export type TemaMarca = {
  cor?: string; titulo?: string; boas_vindas?: string; rodape?: string;
};
export type PublicoMarca = {
  id: number; slug: string; nome: string | null; tema: TemaMarca;
  logo_path?: string | null;
};
export type CampoForm = {
  id: number; nome: string; obrigatorio: boolean;
  tipo: string; extra: string | null; loja_id: number | null;
};

export function publicoForm(slug: string): Promise<{ marca: PublicoMarca }> {
  return req(`publico/form/${encodeURIComponent(slug)}`);
}
export function publicoLojas(slug: string, q = ""): Promise<{ id: number; nome: string }[]> {
  return req(`publico/form/${encodeURIComponent(slug)}/lojas?q=${encodeURIComponent(q)}`);
}
export function publicoCampos(slug: string, lojaId: number): Promise<CampoForm[]> {
  return req(`publico/form/${encodeURIComponent(slug)}/campos?loja_id=${lojaId}`);
}
export function publicoAbrir(body: {
  marca_slug: string; loja_id: number; nome: string; email: string;
  telefone?: string; assunto: string; mensagem: string;
  campos?: Record<string, string>; aceita_contato?: boolean;
}): Promise<{ numero: string; id: number; repetido: boolean; mensagem: string }> {
  return req("publico/atendimentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export type PublicoConversa = {
  numero: string; status: string; assunto: string | null;
  loja: string | null; marca: string | null; marca_tema: TemaMarca;
  marca_logo_path?: string | null;
  cliente_nome: string | null; criado_em: string | null;
  pode_avaliar?: boolean; ja_avaliada?: boolean;
  mensagens: { autor: "voce" | "equipe"; texto: string; criado_em: string | null }[];
};
export function publicoAcompanhar(numero: string, email: string): Promise<PublicoConversa> {
  return req(`publico/atendimentos/${encodeURIComponent(numero)}?email=${encodeURIComponent(email)}`);
}
export function publicoResponder(
  numero: string, email: string, texto: string,
): Promise<{ ok: boolean; reaberto: boolean }> {
  return req(`publico/atendimentos/${encodeURIComponent(numero)}/responder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, texto }),
  });
}

// O cliente marca como resolvido (encerra; pode avaliar em seguida).
export function publicoEncerrar(
  numero: string, email: string,
): Promise<{ ok: boolean; ja_encerrado: boolean }> {
  return req(`publico/atendimentos/${encodeURIComponent(numero)}/encerrar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export type PublicoAvaliacaoForm = {
  numero: string; assunto: string | null; loja: string | null;
  marca: string | null; marca_tema: TemaMarca; marca_logo_path?: string | null;
  ja_avaliada: boolean; perguntas: string[];
};
export function publicoAvaliacaoForm(numero: string, email: string): Promise<PublicoAvaliacaoForm> {
  return req(`publico/avaliacao/${encodeURIComponent(numero)}?email=${encodeURIComponent(email)}`);
}
export function publicoAvaliar(
  numero: string, email: string, notas: Record<string, number>, comentario?: string,
): Promise<{ ok: boolean }> {
  return req(`publico/avaliacao/${encodeURIComponent(numero)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, notas, comentario }),
  });
}

// ── ⚙️ Configurações (admin) ─────────────────────────────────────────
export type MarcaConfig = {
  id: number; slug: string; nome: string | null; tema: TemaMarca;
  ativo: boolean; tem_logo: boolean; logo_path: string | null;
};
export type CampoConfig = {
  id: number; marca_id: number | null; loja_id: number | null;
  loja_nome: string | null; nome: string; obrigatorio: boolean;
  tipo: string; ordem: number; ativo: boolean;
};
export type PerguntaConfig = {
  id: number; marca_id: number; texto: string; ordem: number; ativo: boolean;
};

export function configMarcas(): Promise<MarcaConfig[]> {
  return req("config/marcas");
}
export function configEditarMarca(
  id: number, body: { nome?: string; slug?: string; tema?: Record<string, string> },
): Promise<MarcaConfig> {
  return req(`config/marcas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function configSubirLogo(id: number, arquivo: File): Promise<MarcaConfig> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  return req(`config/marcas/${id}/logo`, { method: "POST", body: fd });
}
export function configRemoverLogo(id: number): Promise<MarcaConfig> {
  return req(`config/marcas/${id}/logo`, { method: "DELETE" });
}
export function configCampos(marcaId: number): Promise<CampoConfig[]> {
  return req(`config/marcas/${marcaId}/campos`);
}
export function configCriarCampo(body: {
  marca_id: number; loja_id?: number | null; nome: string;
  obrigatorio?: boolean; ordem?: number;
}): Promise<CampoConfig> {
  return req("config/campos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function configEditarCampo(
  id: number, body: { nome?: string; obrigatorio?: boolean; ordem?: number; ativo?: boolean },
): Promise<CampoConfig> {
  return req(`config/campos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function configExcluirCampo(id: number): Promise<{ ok: boolean }> {
  return req(`config/campos/${id}`, { method: "DELETE" });
}
export function configPerguntas(marcaId: number): Promise<{
  perguntas: PerguntaConfig[]; usando_padrao: boolean; padrao: string[];
}> {
  return req(`config/marcas/${marcaId}/perguntas`);
}
export function configImportarPerguntasPadrao(marcaId: number): Promise<{ ok: boolean; criadas: number }> {
  return req(`config/marcas/${marcaId}/perguntas/importar-padrao`, { method: "POST" });
}
export function configCriarPergunta(body: {
  marca_id: number; texto: string; ordem?: number;
}): Promise<PerguntaConfig> {
  return req("config/perguntas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function configEditarPergunta(
  id: number, body: { texto?: string; ordem?: number; ativo?: boolean },
): Promise<PerguntaConfig> {
  return req(`config/perguntas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function configExcluirPergunta(id: number): Promise<{ ok: boolean }> {
  return req(`config/perguntas/${id}`, { method: "DELETE" });
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
