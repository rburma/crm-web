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

// ── Obrigações da loja (lidas do cobranca-wt, só-leitura) ───────────
export type ObrigacaoLojaItem = {
  loja_id: number | null;
  loja_nome: string | null;
  sigla: string | null;
  titulo: string | null;
  tipo: string | null;
  status: string;
  vencimento: string | null;
  instrucoes_link: string | null;
};

export type ObrigacoesLojaResp = { disponivel: boolean; itens: ObrigacaoLojaItem[] };

/** Obrigações abertas de TODAS as lojas do escopo do usuário (visão franqueado/admin). */
export function minhasObrigacoes(): Promise<ObrigacoesLojaResp> {
  return req<ObrigacoesLojaResp>("obrigacoes-loja/minhas");
}

/** Obrigações abertas de uma loja específica. */
export function obrigacoesDaLoja(lojaId: number): Promise<ObrigacoesLojaResp> {
  return req<ObrigacoesLojaResp>(`obrigacoes-loja/loja/${lojaId}`);
}

// ── Portal FINANCEIRO do franqueado (Fase A, 28/07/2026) ────────────
// Rating + boletos + obrigações da(s) loja(s) que o usuário administra,
// lidos da cobrança via motor. Visual espelha a /boletos da cobrança.

export type RatingComponenteFin = {
  rotulo: string | null;
  pontos: number | null;
  max: number | null;
  pct: number | null;
  info: string | null;
};

export type RatingFin = {
  nota: number | null;
  letra: string | null;
  componentes: RatingComponenteFin[];
} | null;

export type LojaFinanceiro = {
  loja_id: number;
  nome: string | null;
  sigla: string;
  rating: RatingFin;
};

export type BoletoFin = {
  id: string;
  nnum: number;
  num_doc: string;
  sigla: string | null;
  codigo_mestre: string | null;
  apelido: string | null;
  cliente_nome: string | null;
  cnpj_cpf: string | null;
  empresa: string | null;
  data_documento: string | null;
  vencimento: string | null;
  valor_doc: number | null;
  estado: string | null;
  estado_efetivo: string;
  data_pagamento: string | null;
  valor_recebido: number | null;
  pode_pdf: boolean;
  pode_tratar: boolean;
};

export type ObrigacaoFin = {
  id: string;
  sigla: string | null;
  codigo_mestre: string | null;
  apelido: string | null;
  titulo: string | null;
  tipo: string | null;
  tipo_nome: string | null;
  numero: string | null;
  status: string;
  vencimento: string | null;
  respondido_em: string | null;
  link_responder: string | null;
};

export type PaginaFin<T> = { total: number; itens: T[]; limit: number; offset: number };

export function financeiroMinhasLojas(): Promise<{ disponivel: boolean; lojas: LojaFinanceiro[] }> {
  return req("portal-financeiro/minhas");
}

export type FiltrosFin = {
  q?: string;
  venc_de?: string;
  venc_ate?: string;
  limit: number;
  offset: number;
};

function _qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  return p.toString();
}

/** Boletos de TODAS as lojas do usuário numa lista só (com filtros). */
export function financeiroBoletos(
  f: FiltrosFin & { estado?: string; origem?: string },
): Promise<PaginaFin<BoletoFin>> {
  return req(`portal-financeiro/boletos?${_qs(f)}`);
}

/** Obrigações de TODAS as lojas do usuário numa lista só (com filtros). */
export function financeiroObrigacoes(
  f: FiltrosFin & { status_filtro?: string; tipo?: string },
): Promise<PaginaFin<ObrigacaoFin>> {
  return req(`portal-financeiro/obrigacoes?${_qs(f)}`);
}

/** Gera o link público de tratamento do boleto vencido e devolve a URL. */
export function financeiroTratarBoleto(boletoId: string): Promise<{ url: string }> {
  return req(`portal-financeiro/boletos/${boletoId}/tratar`, { method: "POST" });
}

/** URL da 2ª via (PDF) — abrir em nova aba; o proxy injeta a identidade. */
export function financeiroPdfUrl(boletoId: string): string {
  return `${BASE}/portal-financeiro/boletos/${boletoId}/pdf`;
}

// ── Backup completo do CRM (admin) ──────────────────────────────────
export type BackupResumo = {
  total_tabelas: number;
  total_registros: number;
  contagens: Record<string, number>;
  tabelas_sem_model: string[];
};

export type BackupJob = {
  status: "rodando" | "pronto" | "erro";
  fase?: string | null;
  progresso?: number | null;
  atual?: number | null;
  total?: number | null;
  arquivo?: string | null;
  total_registros?: number | null;
  total_tabelas?: number | null;
  erro?: string | null;
  download_url?: string;
  size_bytes?: number | null;
};

export function backupResumo(): Promise<BackupResumo> {
  return req<BackupResumo>("backup/resumo");
}

export function backupIniciar(): Promise<{ job_id: string }> {
  return req<{ job_id: string }>("backup/iniciar", { method: "POST" });
}

export function backupJob(jobId: string): Promise<BackupJob> {
  return req<BackupJob>(`backup/jobs/${jobId}`);
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
  avaliacoes_total: number;
  avaliacoes_media: number | null;
  avaliacoes_recentes: {
    media: number | null;
    comentario: string | null;
    origem: string | null;
    loja_id: number | null;
    com_compra: boolean;
    criado_em: string | null;
  }[];
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
  encerrado_em?: string | null;  // p/ tempo decorrido (aberto -> encerrado)
  loja_sigla?: string | null;
  marca_sigla?: string | null;
  vence_em?: string | null;   // SLA: prazo (vermelho ao passar)
  alerta_em?: string | null;  // SLA: a partir daqui fica amarelo
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
  anexo_url?: string | null;
  criado_em: string | null;
};

export type AtendimentoDetalhe = {
  id: number;
  numero: string;
  marca_id: number | null;
  marca: string | null;
  loja_id: number | null;
  loja: string | null;
  assunto: string | null;
  status: string;
  prioridade: string;
  canal_origem: string | null;
  criado_em: string | null;
  encerrado_em: string | null;
  vence_em?: string | null;
  alerta_em?: string | null;
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
  emails?: EmailEvento[];
  total_mensagens: number;
};

// Rastreio de e-mail (abertura via pixel, clique via redirect).
export type EmailEvento = {
  tipo: string | null;          // cliente_abertura, cliente_avaliacao, ...
  email: string | null;
  enviado_em: string | null;
  aberto_em: string | null;     // 1a abertura (ISO) — null se nunca abriu
  aberturas: number;
  clicado_em: string | null;    // ultimo clique (ISO) — null se nunca clicou
  cliques: number;
};

// ── Endpoints ──────────────────────────────────────────────────────
export type ClientesPagina = { items: ClienteResumo[]; total: number };

export function buscarClientes(
  q: string, limit = 50, offset = 0,
  lojaId?: number | null, lojaIds?: number[], marcaId?: number | null,
): Promise<ClientesPagina> {
  const qs = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
  if (lojaId) qs.set("loja_id", String(lojaId));
  for (const id of lojaIds ?? []) qs.append("loja_ids", String(id));
  if (marcaId != null) qs.set("marca_id", String(marcaId));
  return reqLista<ClienteResumo>(`clientes?${qs.toString()}`);
}

// dd/mm/aa HH:mm (curto com hora — listagens densas)
export function fmtDataHoraCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 16);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// Edita o cadastro do cliente (colunas quentes e/ou atributos — atributos fazem MERGE).
export function atualizarCliente(
  id: number,
  dados: { nome?: string | null; cpf?: string | null; telefone?: string | null;
           email?: string | null; nascimento?: string | null;
           atributos?: Record<string, string> },
): Promise<unknown> {
  return req(`clientes/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}

export function ficha360(id: number | string): Promise<Ficha> {
  return req<Ficha>(`clientes/${id}`);
}

export function listarAtendimentos(opts: {
  q?: string;
  status?: string;
  marcaId?: number | null;
  lojaIds?: number[];
  limit?: number;
  offset?: number;
} = {}): Promise<AtendimentosLista> {
  const qs = new URLSearchParams();
  if (opts.q) qs.set("q", opts.q);
  if (opts.status) qs.set("status", opts.status);
  if (opts.marcaId != null) qs.set("marca_id", String(opts.marcaId));
  for (const id of opts.lojaIds ?? []) qs.append("loja_ids", String(id));
  qs.set("limit", String(opts.limit ?? 50));
  qs.set("offset", String(opts.offset ?? 0));
  return req<AtendimentosLista>(`atendimentos?${qs.toString()}`);
}

export type MarcaItem = { id: number; slug: string; nome: string | null; sigla?: string | null; ativo: boolean };

export function listarMarcas(): Promise<MarcaItem[]> {
  return req<MarcaItem[]>("marcas");
}

export type LojaItem = {
  id: number; marca_id: number | null; nome: string;
  sigla?: string | null;
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

// ── Cadastro da loja (campos fixos + campos extensíveis/placeholders) ──
export type LojaCampoDef = {
  id: number; chave: string; rotulo: string; placeholder: string;
  tipo: string; categoria: string | null; ordem: number; ativo: boolean;
};
export type LojaCadastro = {
  id: number; marca_id: number | null; nome: string;
  sigla: string | null; // rede+loja (WTRIBE…) — liga com o cobrança
  cidade: string | null; uf: string | null; email: string | null;
  // Endereço/identificação estruturado (cadastro canônico + busca de roteamento)
  endereco: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; cep: string | null;
  shopping: string | null; shopping_piso: string | null; shopping_loja: string | null;
  apelidos: string | null; tipo: "fisica" | "virtual";
  atributos: Record<string, string>; ativo: boolean;
};
// Campos de endereço/identificação editáveis (admin e, depois, franqueado).
export type LojaDados = {
  nome?: string; cidade?: string; uf?: string; email?: string; sigla?: string; ativo?: boolean;
  endereco?: string; numero?: string; complemento?: string; bairro?: string; cep?: string;
  shopping?: string; shopping_piso?: string; shopping_loja?: string; apelidos?: string;
  tipo?: "fisica" | "virtual";
};

// Catálogo de campos da loja (padrão + criados pela operação).
export function lojaCampos(): Promise<LojaCampoDef[]> {
  return req<LojaCampoDef[]>("lojas-cadastro/campos");
}
// Dados de uma loja (campos fixos + gaveta de atributos).
export function lojaDetalhe(id: number): Promise<LojaCadastro> {
  return req<LojaCadastro>(`lojas-cadastro/${id}`);
}
// Salva campos FIXOS (nome/cidade/uf/email — e-mail das notificações).
export function lojaSalvarDados(
  id: number,
  dados: LojaDados,
): Promise<LojaCadastro> {
  return req<LojaCadastro>(`lojas-cadastro/${id}/dados`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}
// Cria um departamento/loja novo numa marca (papel global). Retorna a loja criada.
export function criarLoja(
  dados: { marca_id: number; nome: string; cidade?: string; uf?: string; email?: string; sigla?: string },
): Promise<LojaCadastro> {
  return req<LojaCadastro>("lojas-cadastro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}

// ── Portal do FRANQUEADO (preenche o cadastro da loja por link; admin aprova) ──
export type FranqueadoLoja = {
  loja_id: number; nome: string; sigla: string | null;
  marca?: string | null;
  atual: Record<string, unknown>;
  campos_extra: { chave: string; rotulo: string; categoria: string | null }[];
  ja_tem_pendente: boolean;
};
export function franqueadoLoja(token: string): Promise<FranqueadoLoja> {
  return req(`franqueado/loja/${encodeURIComponent(token)}`);
}
// A cobrança monta o link só com a sigla ({codigo_loja}); o CRM resolve → token.
export function franqueadoPorSigla(sigla: string): Promise<{ token: string; loja_id: number; nome: string }> {
  return req(`franqueado/por-sigla/${encodeURIComponent(sigla)}`);
}
export function franqueadoEnviarProposta(token: string, body: {
  autor_nome?: string; autor_email?: string;
  valores: Record<string, string>; ativo?: boolean;
}): Promise<{ ok: boolean; proposta_id: number | null; n_campos: number; sem_mudanca?: boolean }> {
  return req(`franqueado/loja/${encodeURIComponent(token)}/proposta`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
// (tipo GoogleCandidato ja declarado mais abaixo, junto da busca do admin)
// O SISTEMA busca a loja no Google (nome+endereco); o franqueado so confirma.
export function franqueadoSugerirGoogle(token: string, endereco?: string): Promise<{ candidatos: GoogleCandidato[]; erro?: string }> {
  return req(`franqueado/loja/${encodeURIComponent(token)}/sugerir-google`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endereco: endereco || undefined }),
  });
}
export type RedeCandidato = { titulo: string; subtitulo: string; link: string };
// Busca a pagina da loja na rede (instagram|tripadvisor) — franqueado escolhe e o campo e preenchido.
export function franqueadoSugerirRede(token: string, rede: string, termo?: string): Promise<{ candidatos: RedeCandidato[]; erro?: string }> {
  return req(`franqueado/loja/${encodeURIComponent(token)}/sugerir-rede`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rede, termo: termo || undefined }),
  });
}
export function franqueadoConfirmarGoogle(token: string, placeId: string): Promise<{ ok?: boolean; nota?: number; qtd?: number }> {
  return req(`franqueado/loja/${encodeURIComponent(token)}/confirmar-google`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place_id: placeId }),
  });
}
export function franqueadoGerarLink(lojaId: number): Promise<{ token: string; loja_id: number }> {
  return req(`franqueado/admin/loja/${lojaId}/link`, { method: "POST" });
}
export type PropostaMudanca = { campo: string; antes: unknown; depois: unknown };
export type Proposta = {
  id: number; loja_id: number; loja_nome: string;
  autor_nome: string | null; autor_email: string | null;
  criado_em: string | null; mudancas: PropostaMudanca[];
};
export function franqueadoPropostas(status = "pendente"): Promise<Proposta[]> {
  return req(`franqueado/admin/propostas?status=${encodeURIComponent(status)}`);
}
export type AjusteCampo = { campo: string; de: string; para: string };
export function franqueadoAplicar(
  propId: number, campos: string[], motivo?: string,
): Promise<{ ok: boolean; aprovados: number; reprovados: number; ajustes?: AjusteCampo[] }> {
  return req(`franqueado/admin/propostas/${propId}/aplicar`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campos, motivo }),
  });
}
// Salva valores dos campos extensíveis (merge na gaveta Loja.atributos).
export function lojaSalvarAtributos(
  id: number, valores: Record<string, string>,
): Promise<{ id: number; atributos: Record<string, string> }> {
  return req(`lojas-cadastro/${id}/atributos`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(valores),
  });
}
// Cria um campo novo de loja (vira placeholder {loja.<chave>}).
export function lojaCriarCampo(body: {
  chave: string; rotulo: string; placeholder?: string; tipo?: string;
  categoria?: string; ordem?: number;
}): Promise<LojaCampoDef> {
  return req<LojaCampoDef>("lojas-cadastro/campos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Respostas prontas / auto-resposta por palavra-chave ──────────
export type RespostaPronta = {
  id: number; marca_id: number; loja_id: number | null;
  frase: string; texto: string; gatilhos: string | null;
};
export function listarRespostas(marcaId?: number, lojaId?: number): Promise<RespostaPronta[]> {
  const qs = new URLSearchParams();
  if (marcaId != null) qs.set("marca_id", String(marcaId));
  if (lojaId != null) qs.set("loja_id", String(lojaId));
  return req<RespostaPronta[]>(`catalogo/respostas?${qs.toString()}`);
}
export function criarResposta(body: {
  marca_id: number; loja_id?: number | null; frase: string; texto: string; gatilhos?: string;
}): Promise<RespostaPronta> {
  return req<RespostaPronta>("catalogo/respostas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function excluirResposta(id: number): Promise<{ ok: boolean }> {
  return req(`catalogo/respostas/${id}`, { method: "DELETE" });
}

// ── Dispositivos das lojas (app de balcão) ───────────────────────
export type Dispositivo = {
  id: number; loja_id: number; marca_id: number | null;
  nome: string; pessoa: string | null;
  status: "pendente" | "ativo" | "revogado";
  online: boolean; ultimo_visto_em: string | null;
  ativado_em: string | null; criado_em: string | null;
};
export type DispositivoCriado = Dispositivo & { codigo: string; codigo_expira_em: string };

export function listarDispositivos(lojaId?: number): Promise<Dispositivo[]> {
  const qs = lojaId != null ? `?loja_id=${lojaId}` : "";
  return req<Dispositivo[]>(`dispositivos${qs}`);
}
export function criarDispositivo(body: {
  loja_id: number; nome: string; pessoa?: string;
}): Promise<DispositivoCriado> {
  return req<DispositivoCriado>("dispositivos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function revogarDispositivo(id: number): Promise<{ id: number; status: string }> {
  return req(`dispositivos/${id}/revogar`, { method: "POST" });
}
export function excluirDispositivo(id: number): Promise<{ ok: boolean }> {
  return req(`dispositivos/${id}`, { method: "DELETE" });
}

// Cria atendimento INTERNO (telefone/balcão/WhatsApp). Cliente existente OU novo
// (a identidade resolve: se telefone/e-mail já existem, usa o cliente existente).
export type AtendimentoCriado = {
  id: number; numero: string; status: string;
  consumidor_id: number; cliente_nome: string | null;
  cliente_status: "existente" | "novo";
  nome_divergente?: boolean;
  loja_id: number; marca_id: number | null; criado_em: string;
};

export function criarAtendimento(body: {
  loja_id: number;
  consumidor_id?: number;
  novo_cliente?: { nome: string; telefone?: string; email?: string; cpf?: string };
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
// Anexa uma FOTO ao atendimento: sobe pro Box (servidor) e devolve o link. O
// arquivo já vem reduzido do navegador (lib/reduzirImagem). privado=true = nota interna.
export function anexarFoto(
  atendimentoId: number | string, arquivo: File, privado = true,
): Promise<{ id: number; anexo_url: string; texto: string; privado: boolean; autor_tipo: string; criado_em: string | null }> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  fd.append("privado", privado ? "true" : "false");
  return req(`atendimentos/${atendimentoId}/foto`, { method: "POST", body: fd });
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

// Transfere o atendimento para outro departamento DA MESMA MARCA. Auditado.
export function transferirAtendimento(
  id: number | string, lojaId: number, motivo?: string,
): Promise<{ id: number; status: string }> {
  return req(`atendimentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loja_id: lojaId, motivo }),
  });
}

// Ação em lote sobre atendimentos: muda status ou define marca.
// Exclui um atendimento (SO admin; p/ limpar testes). Irreversivel; auditado.
export function excluirAtendimento(id: number, comCliente = false): Promise<{ ok: boolean; cliente_excluido?: boolean }> {
  return req(`atendimentos/${id}${comCliente ? "?com_cliente=true" : ""}`, { method: "DELETE" });
}

export function atendimentosEmLote(
  ids: number[], acao: "status" | "marca" | "excluir", valor: string,
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
  // Qual menu mostrar — decidido pelo MOTOR (admin | franqueado | loja).
  // Opcional p/ compat com sessões salvas antes do campo existir.
  menu?: string;
};

export function login(email: string, senha: string): Promise<{ token: string; usuario: UsuarioLogado }> {
  return req("auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
}

// Usuário do token/sessão atual (usado ao finalizar o login pelo Google).
export function me(): Promise<UsuarioLogado> {
  return req("auth/me");
}

// ── 📦 Box (anexos de atendimento) — conexão OAuth global (admin) ──
export function boxStatus(): Promise<{ configurado: boolean; conectado: boolean }> {
  return req("box/status");
}
export function boxIniciar(): Promise<{ url: string }> {
  return req("box/oauth/iniciar");
}
export function boxDesconectar(): Promise<{ ok: boolean }> {
  return req("box/desconectar", { method: "POST" });
}

// ── 🚀 Planilha de Go-live (importa lojas + usuários Google + CNPJ) ──
export type GoLiveDetalhe = {
  linha: number; sigla: string; loja?: string; acoes: string[]; erro: string | null;
};
export type GoLiveResultado = {
  resumo: {
    linhas: number; lojas_atualizadas: number; usuarios_criados: number;
    vinculos_criados: number; erros: number;
  };
  detalhes: GoLiveDetalhe[];
};
export function golivePreview(arquivo: File): Promise<GoLiveResultado> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  return req("golive/importar/preview", { method: "POST", body: fd });
}
export function goliveAplicar(arquivo: File): Promise<GoLiveResultado> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  return req("golive/importar/aplicar", { method: "POST", body: fd });
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

function _lerCookie(nome: string): string {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + nome + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  } catch { return ""; }
}

export function logout(): void {
  document.cookie = "crm_token=; path=/; max-age=0";
  try {
    localStorage.removeItem("crm_usuario");
    localStorage.removeItem("crm_impersonando");
    localStorage.removeItem("crm_admin_backup_u");
    localStorage.removeItem("crm_admin_backup_t");
  } catch { /* ignore */ }
}

// ── "Entrar como" (impersonação — admin verifica a visão de outro usuário) ──
export async function entrarComo(usuarioId: number): Promise<UsuarioLogado> {
  // Guarda a sessao ATUAL (admin) pra poder VOLTAR sem re-login.
  try {
    const adminU = localStorage.getItem("crm_usuario");
    const adminT = _lerCookie("crm_token");
    if (adminU) localStorage.setItem("crm_admin_backup_u", adminU);
    if (adminT) localStorage.setItem("crm_admin_backup_t", adminT);
  } catch { /* ignore */ }
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
  // Restaura a sessao admin guardada (sem re-login). Sem backup -> desloga.
  try {
    const adminU = localStorage.getItem("crm_admin_backup_u");
    const adminT = localStorage.getItem("crm_admin_backup_t");
    if (adminU && adminT) {
      salvarSessao(adminT, JSON.parse(adminU) as UsuarioLogado);
    } else {
      document.cookie = "crm_token=; path=/; max-age=0";
      localStorage.removeItem("crm_usuario");
    }
    localStorage.removeItem("crm_impersonando");
    localStorage.removeItem("crm_admin_backup_u");
    localStorage.removeItem("crm_admin_backup_t");
  } catch { /* ignore */ }
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
  id: number, dados: { nome?: string; email?: string; papel?: string; ativo?: boolean },
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

export type BulkResult = { ok: number; convites_avaliacao?: number; falhas: { id?: number; motivo: string }[] };

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
// EXCLUSAO de clientes — SO papel admin (backend valida). Cliente com
// atendimento e PULADO (o backend reporta) — exclua os atendimentos antes.
// Importacao de CANDIDATOS a emprego (planilha Breezy) — previa + aplicar async.
export type CandidatosPreview = {
  total: number; sem_loja: number;
  siglas_nao_encontradas: Record<string, number>;
  linhas_de_siglas_nao_encontradas: number;
  ja_importados: number;
  amostra: { nome: string | null; loja: string | null; stage: string | null; source: string | null; added: string | null }[];
};
export function candidatosPreview(file: File): Promise<CandidatosPreview> {
  const fd = new FormData();
  fd.append("arquivo", file);
  return req("importacoes/candidatos/preview", { method: "POST", body: fd });
}
export function candidatosAplicarAsync(file: File): Promise<{ importacao_id: number; status: string; total_linhas: number }> {
  const fd = new FormData();
  fd.append("arquivo", file);
  return req("importacoes/candidatos/aplicar-async", { method: "POST", body: fd });
}

// Recupera nomes cortados em 20 chars pelo legado (SO admin; previa/aplicar).
export function recuperarNomesLegado(aplicar: boolean): Promise<{
  aplicado: boolean; suspeitos_analisados: number;
  corrigiveis?: number; corrigidos?: number;
  amostra: { id: number; antes: string; depois: string }[];
}> {
  return req(`clientes/recuperar-nomes-legado?aplicar=${aplicar}`, { method: "POST" });
}

export function excluirCliente(id: number, comAtendimentos = false): Promise<{ ok: boolean }> {
  return req(`clientes/${id}${comAtendimentos ? "?com_atendimentos=true" : ""}`, { method: "DELETE" });
}
export function excluirClientesLote(ids: number[], comAtendimentos = false): Promise<{
  ok: number; pulados_com_atendimento: number[]; inexistentes: number;
}> {
  return req("clientes/excluir-lote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, com_atendimentos: comAtendimentos }),
  });
}

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
  // Campos de ENDEREÇO e extras: entram na gaveta de dados do cliente (atributos).
  { campo: "cidade", rotulo: "Cidade (dado do cliente)" },
  { campo: "uf", rotulo: "UF / Estado (dado do cliente)" },
  { campo: "cep", rotulo: "CEP (dado do cliente)" },
  { campo: "endereco", rotulo: "Endereço (dado do cliente)" },
  { campo: "bairro", rotulo: "Bairro (dado do cliente)" },
  { campo: "pais", rotulo: "País (dado do cliente)" },
  { campo: "sobrenome", rotulo: "Sobrenome (dado do cliente)" },
  { campo: "origem_id", rotulo: "ID no sistema de origem (dado do cliente)" },
  // Contatos corporativos (Vahrcav/expansão — 07/07): empresa, cargo e 2º telefone.
  { campo: "empresa", rotulo: "Empresa (dado do cliente)" },
  { campo: "cargo", rotulo: "Cargo (dado do cliente)" },
  { campo: "telefone2", rotulo: "Telefone 2 (dado do cliente)" },
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
  total_arquivo?: number;
  parcial?: boolean;
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

// Lotes GRANDES: aplica em SEGUNDO PLANO no motor (nao estoura o tempo do proxy).
export function importAplicarAsync(
  arquivo: File, mapeamento: Record<string, string>, origem: string, descricao?: string,
): Promise<{ importacao_id: number; status: string; total_linhas: number }> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  fd.append("mapeamento", JSON.stringify(mapeamento));
  fd.append("origem", origem);
  if (descricao) fd.append("descricao", descricao);
  return req("importacoes/clientes/aplicar-async", { method: "POST", body: fd });
}
export type ImportLoteStatus = {
  importacao_id: number; status: string; processadas: number; total_linhas: number;
  novos: number; enriquecidos: number; erros: number; erro?: string | null;
};
export function importLoteStatus(id: number): Promise<ImportLoteStatus> {
  return req(`importacoes/clientes/lote/${id}`);
}
// ── Equipe & Departamentos (matriz usuário↔loja, modelo do legado) ──
export type EquipeResumo = {
  totais: { vinculos: number; usuarios_vinculados: number; admins_globais: number };
  marcas: { id: number; nome: string; lojas: number; usuarios: number }[];
};
export type LojaEquipe = { id: number; nome: string; sigla?: string | null; ativo?: boolean; usuarios: number; admins: number };
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
  // Chat da marca (widget): horário de atendimento + mensagem fora do horário.
  chat_abre?: string; chat_fecha?: string; chat_fechado_msg?: string;
  chat_abre_sem?: string; chat_fecha_sem?: string;
  chat_abre_sab?: string; chat_fecha_sab?: string;
  chat_abre_dom?: string; chat_fecha_dom?: string;
  // Textos editáveis da página pública de atendimento (todos com fallback no código).
  subtitulo?: string; consent?: string; ph_assunto?: string; ph_loja?: string;
  // Texto do checkbox de consentimento na AVALIAÇÃO (publicar na vitrine/redes).
  consent_avaliacao?: string;
};

// Campo da avaliação ABERTA: nota (estrelas), texto (resposta livre) ou checkbox.
export type PerguntaDef = { texto: string; tipo: "nota" | "texto" | "checkbox"; sugestao: string | null };
export type PublicoMarca = {
  id: number; slug: string; nome: string | null; tema: TemaMarca;
  logo_path?: string | null;
  logo_quadrado_path?: string | null;
  favicon_path?: string | null;
};
export type CampoForm = {
  id: number; nome: string; obrigatorio: boolean;
  tipo: string; extra: string | null; loja_id: number | null;
};

export function publicoForm(slug: string): Promise<{ marca: PublicoMarca }> {
  return req(`publico/form/${encodeURIComponent(slug)}`);
}
// Resultado da busca de loja (roteamento): nome + endereço por extenso.
export type LojaPublica = {
  id: number; nome: string; endereco: string;
  cidade: string | null; uf: string | null; shopping: string | null;
  tipo: "fisica" | "virtual";
  whatsapp?: string | null;
};
export function publicoLojas(slug: string, q = ""): Promise<LojaPublica[]> {
  return req(`publico/form/${encodeURIComponent(slug)}/lojas?q=${encodeURIComponent(q)}`);
}
export function publicoCampos(slug: string, lojaId?: number): Promise<CampoForm[]> {
  const qs = lojaId != null ? `?loja_id=${lojaId}` : "";
  return req(`publico/form/${encodeURIComponent(slug)}/campos${qs}`);
}
export function publicoAbrir(body: {
  marca_slug: string; loja_id?: number; virtual?: boolean; canal_compra?: string;
  nome: string; email: string;
  telefone?: string; cpf?: string; assunto: string; mensagem: string;
  campos?: Record<string, string>; aceita_contato?: boolean; canal?: string;
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
  marca_favicon_path?: string | null;
  cliente_nome: string | null; criado_em: string | null;
  pode_avaliar?: boolean; ja_avaliada?: boolean;
  mensagens: { autor: "voce" | "equipe"; texto: string; anexo_url?: string | null; criado_em: string | null }[];
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

// O cliente anexa uma foto ao atendimento (sobe pro Box; máx 3 por atendimento).
export function publicoAnexarFoto(
  numero: string, email: string, arquivo: File,
): Promise<{ ok: boolean; anexo_url: string }> {
  const fd = new FormData();
  fd.append("email", email);
  fd.append("arquivo", arquivo);
  return req(`publico/atendimentos/${encodeURIComponent(numero)}/foto`, { method: "POST", body: fd });
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
  marca_favicon_path?: string | null;
  ja_avaliada: boolean; perguntas: PerguntaDef[];
  consent_texto?: string;
};
export function publicoAvaliacaoForm(numero: string, email: string): Promise<PublicoAvaliacaoForm> {
  return req(`publico/avaliacao/${encodeURIComponent(numero)}?email=${encodeURIComponent(email)}`);
}
export type LinkExterno = { url: string; rotulo: string };
export type AvaliarResp = {
  ok: boolean;
  media: number | null;
  nivel: "alta" | "media" | "baixa";
  reaberto: boolean;
  obrigado: string;
  cta?: string;
  links_externos: LinkExterno[];
};
export function publicoAvaliar(
  numero: string, email: string, notas: Record<string, number>,
  comentario?: string,
  extra?: { respostas?: Record<string, string>; autoriza_publicacao?: boolean },
): Promise<AvaliarResp> {
  return req(`publico/avaliacao/${encodeURIComponent(numero)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, notas, comentario, ...extra }),
  });
}

// ── Avaliação ABERTA: da loja (QR) e do site — com ou sem compra ────
export type AvaliacaoAbertaForm = {
  marca: string | null; marca_slug: string; marca_tema: TemaMarca;
  marca_logo_path: string | null;
  marca_favicon_path?: string | null;
  loja_id: number | null; loja: string | null;
  perguntas: PerguntaDef[];
  consent_texto?: string;
};
export type AvaliacaoAbertaBody = {
  nome: string; email?: string; telefone?: string; telefone2?: string; cpf?: string;
  venda_ref?: string; notas: Record<string, number>;
  respostas?: Record<string, string>; comentario?: string;
  canal?: string; autoriza_publicacao?: boolean;
  // No site, o cliente pode escolher a loja (autocomplete) — aí a avaliação já
  // cai na loja certa e vira atendimento dela.
  loja_id?: number;
};
export type AvaliacaoAbertaResp = { ok: boolean; repetida: boolean; obrigado: string; numero?: string | null };

export function publicoAvaliacaoLojaForm(lojaId: number | string): Promise<AvaliacaoAbertaForm> {
  return req(`publico/avaliacao-loja/${lojaId}`);
}
export function publicoAvaliarLoja(
  lojaId: number | string, body: AvaliacaoAbertaBody,
): Promise<AvaliacaoAbertaResp> {
  return req(`publico/avaliacao-loja/${lojaId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function publicoAvaliacaoSiteForm(slug: string): Promise<AvaliacaoAbertaForm> {
  return req(`publico/avaliacao-site/${encodeURIComponent(slug)}`);
}
export function publicoAvaliarSite(
  slug: string, body: AvaliacaoAbertaBody,
): Promise<AvaliacaoAbertaResp> {
  return req(`publico/avaliacao-site/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── ⭐ Vitrine de avaliações (curadoria admin) ──────────────────────
export type VitrineCandidata = {
  id: number; nota: number | null; comentario: string;
  cliente: string | null; loja: string | null; data: string | null; vitrine: boolean;
};
export function vitrineCandidatas(marcaId: number, min = 4): Promise<VitrineCandidata[]> {
  const q = new URLSearchParams({ marca_id: String(marcaId), min: String(min) });
  return req(`avaliacoes/vitrine/candidatas?${q.toString()}`);
}
export function definirVitrine(id: number, publicar: boolean): Promise<{ id: number; vitrine: boolean }> {
  return req(`avaliacoes/${id}/vitrine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicar }),
  });
}

// ── ⚙️ Configurações (admin) ─────────────────────────────────────────
export type MarcaConfig = {
  id: number; slug: string; nome: string | null; sigla?: string | null; tema: TemaMarca;
  envio: Record<string, string>;
  ativo: boolean; tem_logo: boolean; logo_path: string | null;
  tem_logo_quadrado: boolean; logo_quadrado_path: string | null;
  tem_favicon: boolean; favicon_path: string | null;
};
export type CampoConfig = {
  id: number; marca_id: number | null; loja_id: number | null;
  loja_nome: string | null; nome: string; obrigatorio: boolean;
  tipo: string; ordem: number; ativo: boolean;
};
export type PerguntaConfig = {
  id: number; marca_id: number; texto: string;
  tipo: "nota" | "texto" | "checkbox"; sugestao: string | null;
  ordem: number; ativo: boolean;
};

export function configMarcas(): Promise<MarcaConfig[]> {
  return req("config/marcas");
}
// Criar/apagar MARCA — so papel admin (backend valida; apagar exige marca vazia).
export function configCriarMarca(body: { nome: string; slug: string; sigla?: string }): Promise<MarcaConfig> {
  return req("config/marcas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function configApagarMarca(id: number): Promise<{ ok: boolean }> {
  return req(`config/marcas/${id}`, { method: "DELETE" });
}

export function configEditarMarca(
  id: number,
  body: {
    nome?: string;
    sigla?: string;
    slug?: string;
    tema?: Record<string, string>;
    envio?: Record<string, string>;
    // Config geral (tipada): autoclose_dias (number), flood (bool),
    // banidos_emails/banidos_ips (string[]).
    config?: Record<string, unknown>;
  },
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
// Favicon (ícone da aba) e logo quadrado — uploads independentes do logo. O
// arquivo já chega convertido p/ PNG quadrado pelo navegador (lib/imagemQuadrada).
export function configSubirFavicon(id: number, arquivo: File): Promise<MarcaConfig> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  return req(`config/marcas/${id}/favicon`, { method: "POST", body: fd });
}
export function configRemoverFavicon(id: number): Promise<MarcaConfig> {
  return req(`config/marcas/${id}/favicon`, { method: "DELETE" });
}
export function configSubirLogoQuadrado(id: number, arquivo: File): Promise<MarcaConfig> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  return req(`config/marcas/${id}/logo-quadrado`, { method: "POST", body: fd });
}
export function configRemoverLogoQuadrado(id: number): Promise<MarcaConfig> {
  return req(`config/marcas/${id}/logo-quadrado`, { method: "DELETE" });
}
export function configCampos(marcaId: number): Promise<CampoConfig[]> {
  return req(`config/marcas/${marcaId}/campos`);
}
// Desativa TODOS os campos extras da marca (globais + de todas as lojas).
export function configDesativarTodosCampos(marcaId: number): Promise<{ ok: boolean; desativados: number }> {
  return req(`config/marcas/${marcaId}/campos/desativar-todos`, { method: "POST" });
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
  marca_id: number; texto: string; tipo?: string; sugestao?: string | null; ordem?: number;
}): Promise<PerguntaConfig> {
  return req("config/perguntas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function configEditarPergunta(
  id: number,
  body: { texto?: string; tipo?: string; sugestao?: string | null; ordem?: number; ativo?: boolean },
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
export function configReordenarPerguntas(marcaId: number, ids: number[]): Promise<{ ok: boolean }> {
  return req(`config/marcas/${marcaId}/perguntas/reordenar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

// ── Modelos de e-mail (por marca; padrão herdado do legado) ─────────
export type ModeloTipo = {
  tipo: string;
  rotulo: string;
  destinatario: string;
  descricao: string;
};
export type PlaceholderInfo = { ph: string; desc: string };
export type ModeloEmailItem = ModeloTipo & {
  assunto: string;
  corpo: string;
  personalizado: boolean;
};

export function configModelosCatalogo(): Promise<{
  tipos: ModeloTipo[];
  placeholders: PlaceholderInfo[];
}> {
  return req("config/modelos/catalogo");
}
export function configModelos(marcaId: number): Promise<ModeloEmailItem[]> {
  return req(`config/marcas/${marcaId}/modelos`);
}
export function configSalvarModelo(
  marcaId: number,
  tipo: string,
  body: { assunto: string; corpo: string },
): Promise<{ ok: boolean; tipo: string; personalizado: boolean }> {
  return req(`config/marcas/${marcaId}/modelos/${tipo}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function configResetarModelo(
  marcaId: number,
  tipo: string,
): Promise<{ ok: boolean; tipo: string; personalizado: boolean }> {
  return req(`config/marcas/${marcaId}/modelos/${tipo}`, { method: "DELETE" });
}

// ── Avaliações (ver / tratar) ───────────────────────────────────────
export type AvaliacaoLinha = {
  id: number;
  loja_id: number | null;
  loja: string | null;
  marca: string | null;
  cliente: string | null;
  media: number | null;
  notas: Record<string, number>;
  comentario: string | null;
  origem: string | null;
  com_compra: boolean;
  verificada: boolean;
  tratada: boolean;
  resposta: string | null;
  respondida_em: string | null;
  criado_em: string | null;
};
export function listarAvaliacoes(
  p: { marcaId?: number | null; status?: string; limit?: number; offset?: number } = {},
): Promise<{ items: AvaliacaoLinha[]; total: number }> {
  const q = new URLSearchParams();
  if (p.marcaId != null) q.set("marca_id", String(p.marcaId));
  if (p.status) q.set("status", p.status);
  q.set("limit", String(p.limit ?? 50));
  q.set("offset", String(p.offset ?? 0));
  return reqLista<AvaliacaoLinha>(`avaliacoes?${q.toString()}`);
}
export function tratarAvaliacao(id: number): Promise<{ ok: boolean; tratada: boolean }> {
  return req(`avaliacoes/${id}/tratar`, { method: "POST" });
}
export function reabrirAvaliacao(id: number): Promise<{ ok: boolean; tratada: boolean }> {
  return req(`avaliacoes/${id}/reabrir`, { method: "POST" });
}
export function responderAvaliacao(
  id: number,
  texto: string,
): Promise<{ ok: boolean; respondida: boolean; email_enviado: boolean }> {
  return req(`avaliacoes/${id}/responder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });
}
// Atribui uma avaliação (do site, sem loja) a uma loja: cria o atendimento dela.
export function atribuirLojaAvaliacao(
  id: number,
  lojaId: number,
): Promise<{ ok: boolean; loja_id: number; oportunidade_id: number | null; atendimento_criado: boolean }> {
  return req(`avaliacoes/${id}/atribuir-loja`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loja_id: lojaId }),
  });
}

// ── Util ───────────────────────────────────────────────────────────
// Exibe sempre no fuso de Brasilia (o instante e guardado em UTC). O Intl trata
// o horario de verao historico do Brasil — corrige o "dia a menos".
// ── Painel (dashboard) ──────────────────────────────────────────────
export type DashboardResumo = {
  abertos: number;
  em_espera: number;
  encerrados_hoje: number;
  novos_hoje: number;
  total_atendimentos: number;
  total_clientes: number;
  nps_geral: number | null;
  periodo_dias: number;
  tempo_resolucao_min: number | null;
  tempo_primeira_resposta_min: number | null;
  aval_periodo_dias: number;
  aval_limite: number;
  aval_ordem: string;
  ranking_avaliacoes: { loja: string; n: number; media: number }[];
  volume: { dia: string; qtd: number }[];
  por_marca: { marca: string; abertos: number; total: number }[];
  top_lojas: { loja: string; abertos: number }[];
  nps_por_marca: { marca: string; media: number; n: number }[];
  recentes_abertos: {
    id: number;
    numero: string;
    assunto: string | null;
    cliente: string | null;
    marca: string | null;
    criado_em: string | null;
  }[];
  avaliacoes_recentes: {
    marca: string | null;
    loja: string | null;
    media: number | null;
    comentario: string | null;
    criado_em: string | null;
  }[];
};

export async function dashboardResumo(
  p: { dias?: number; avalDias?: number; avalLimite?: number; avalOrdem?: string } = {},
): Promise<DashboardResumo> {
  const q = new URLSearchParams();
  q.set("dias", String(p.dias ?? 14));
  if (p.avalDias != null) q.set("aval_dias", String(p.avalDias));
  if (p.avalLimite != null) q.set("aval_limite", String(p.avalLimite));
  if (p.avalOrdem) q.set("aval_ordem", p.avalOrdem);
  return req<DashboardResumo>(`dashboard/resumo?${q.toString()}`);
}

// Layout salvo do Painel (por usuário). Tudo opcional — a página aplica defaults.
export type DashboardConfig = {
  cards?: Record<string, boolean>;
  secoes?: Record<string, boolean>;
  ordem?: string[];
  periodo?: number;
  ranking_dias?: number;
  ranking_linhas?: number;
  ranking_ordem?: "media" | "qtd";
};

// Preferências por usuário (key-value JSON), salvas na conta (segue em qualquer
// aparelho). Genérico — reaproveitável por outras telas customizáveis.
export async function obterPreferencia<T = Record<string, unknown>>(
  chave: string,
): Promise<T> {
  const r = await req<{ chave: string; valor: T }>(`preferencias/${chave}`);
  return r.valor;
}

export async function salvarPreferencia(chave: string, valor: unknown): Promise<void> {
  await req(`preferencias/${chave}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valor }),
  });
}

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

// SIGLA DE EXIBICAO da loja (padrao Renato 06/07): MAIUSCULA e com o prefixo
// da marca quando o dado nao tem (World Tennis legado: "sben" -> WTSBEN).
// O DADO nao muda — a sigla gravada e a chave da ponte com a cobranca.
export function siglaLoja(
  sigla: string | null | undefined,
  marcaSigla?: string | null,
  fallback?: string | null,
): string {
  const s = (sigla || "").trim().toUpperCase();
  if (!s) return fallback || "—";
  const pref = (marcaSigla || "").trim().toUpperCase();
  if (pref && !s.startsWith(pref)) return pref + s;
  return s;
}

// dd/mm/aa (curto, p/ listagens densas)
export function fmtDataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

// Tempo decorrido em DIAS, HORAS e MINUTOS (Renato 06/07): da abertura ate o
// encerramento — ou ate AGORA se ainda aberto. Ex.: "2d 4h 13m", "6h 2m", "14m".
export function fmtDecorrido(
  criadoEm: string | null | undefined,
  encerradoEm?: string | null,
): string {
  if (!criadoEm) return "—";
  const ini = new Date(criadoEm).getTime();
  const fim = encerradoEm ? new Date(encerradoEm).getTime() : Date.now();
  if (isNaN(ini) || isNaN(fim)) return "—";
  let min = Math.max(0, Math.floor((fim - ini) / 60000));
  const d = Math.floor(min / 1440);
  min -= d * 1440;
  const h = Math.floor(min / 60);
  const m = min - h * 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Status ABREVIADO (como na cobranca): AB / ESP / ENC.
export function statusAbrev(status: string): string {
  if (status === "encerrada") return "ENC";
  if (status === "em_espera") return "ESP";
  if (status === "aberta") return "AB";
  return (status || "?").slice(0, 3).toUpperCase();
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


// ── Bulk de e-mails de usuario (planilha) ────────────────────────────
export type UsuarioExport = {
  id: number; nome: string | null; papel: string;
  email_atual: string | null; ativo: boolean; lojas: string;
};

export function exportarUsuarios(): Promise<{ usuarios: UsuarioExport[] }> {
  return req("auth/usuarios/export");
}

export type EmailBulkLinha = {
  id: number; nome: string | null; de: string | null;
  para: string; status: string; erro: string | null;
};
export type EmailBulkResultado = {
  total: number; validos: number; erros: number; aplicados: number;
  preview: boolean; itens: EmailBulkLinha[];
};

export function emailsBulk(
  aplicar: boolean, itens: { id: number; email: string }[],
): Promise<EmailBulkResultado> {
  return req("auth/usuarios/emails-bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aplicar, itens }),
  });
}


// ── IA de Ajuda (duvidas de uso do CRM) ──────────────────────────────
export function iaAjuda(pergunta: string): Promise<{ resposta: string }> {
  return req("ia/ajuda", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pergunta }),
  });
}

export function iaManual(): Promise<{ markdown: string }> {
  return req("ia/manual");
}


// ── Reputacao online da loja (score ponderado + notas por veiculo) ──
export type ReputacaoVeic = { veiculo: string; nota: number; qtd_avaliacoes: number; peso: number };
export type ReputacaoLoja = {
  loja_id: number; score: number | null; qtd_veiculos: number; qtd_avaliacoes: number; veiculos: ReputacaoVeic[];
};

export function reputacaoLoja(lojaId: number): Promise<ReputacaoLoja> {
  return req(`reputacao/loja/${lojaId}`);
}

export function reputacaoUpsert(payload: {
  loja_id: number; veiculo: string; nota: number; qtd_avaliacoes: number; peso: number;
}): Promise<ReputacaoVeic> {
  return req("reputacao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}


// ── Preference center do cliente (opt-in canal x tema x marca, LGPD) ──
export type ClientePrefs = {
  canais: string[];
  temas: string[];
  itens: { canal: string; tema: string; marca_id: number | null; permitido: boolean }[];
};

export function clientePreferencias(id: number | string): Promise<ClientePrefs> {
  return req(`clientes/${id}/preferencias`);
}

export function clientePreferenciaSet(
  id: number | string,
  payload: { canal: string; tema: string; marca_id?: number | null; permitido: boolean },
): Promise<{ ok: boolean }> {
  return req(`clientes/${id}/preferencias`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}


// ── Identity graph: sinais que reconhecem o cliente ──────────────────
export type ClienteIdentidade = { canonico_id: number; sinais: { tipo: string; valor: string }[] };
export function clienteIdentidade(id: number | string): Promise<ClienteIdentidade> {
  return req(`clientes/${id}/identidade`);
}


export function reputacaoSyncGoogle(
  lojaId: number,
): Promise<{ ok: boolean; nota?: number; qtd?: number; motivo?: string }> {
  return req(`reputacao/loja/${lojaId}/sync-google`, { method: "POST" });
}


// ── Ranking de reputacao (ver a reputacao no CRM) ────────────────────
export type ReputacaoRankItem = {
  loja_id: number; nome: string | null; sigla: string | null;
  score: number | null; qtd_veiculos: number; qtd_avaliacoes: number;
  google_place_id?: string | null;
};
export function reputacaoRanking(): Promise<{ items: ReputacaoRankItem[] }> {
  return req("reputacao/ranking");
}
export function reputacaoSyncGoogleTodas(): Promise<{ ok: number; falhas: number; total: number; erro?: string }> {
  return req("reputacao/sync-google", { method: "POST" });
}


export function reputacaoRemover(lojaId: number, veiculo: string): Promise<{ ok: boolean }> {
  return req(`reputacao/loja/${lojaId}/veiculo/${encodeURIComponent(veiculo)}`, { method: "DELETE" });
}


// ── Matriz de reputacao (lojas x redes) ──────────────────────────────
export type ReputacaoMatriz = {
  redes: string[];
  marcas: { id: number; nome: string | null }[];
  lojas: {
    loja_id: number; nome: string | null; sigla: string | null;
    marca_id: number | null; marca: string | null;
    cidade?: string | null; uf?: string | null;
    shopping?: string | null; apelidos?: string | null;
    total: number | null; total_qtd: number;
    redes: Record<string, { nota?: number; qtd?: number; link: string | null; tipo?: string | null; seguidores?: number; ultimo_post?: string | null }>;
  }[];
};
export function reputacaoMatriz(): Promise<ReputacaoMatriz> {
  return req("reputacao/matriz");
}


// ── Busca-no-cadastro do Google (sugerir + confirmar place_id) ──────
export type GoogleCandidato = {
  place_id: string | null; nome: string | null; endereco: string | null;
  nota: number | null; qtd: number | null; link: string | null;
};
export function sugerirGoogleLoja(
  lojaId: number, endereco?: string,
): Promise<{ query?: string; candidatos: GoogleCandidato[]; erro?: string }> {
  return req(`reputacao/loja/${lojaId}/sugerir-google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endereco: endereco || "" }),
  });
}
export function confirmarGoogleLoja(
  lojaId: number, placeId: string,
): Promise<{ ok: boolean; nota?: number; qtd?: number; motivo?: string }> {
  return req(`reputacao/loja/${lojaId}/confirmar-google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place_id: placeId }),
  });
}
// Cola o LINK do Google (curto ou completo) -> o motor resolve o place_id DA
// LOJA e confirma (as avaliacoes passam a vir daquele lugar, nao do shopping).
export function conectarGoogleLink(
  lojaId: number, link: string,
): Promise<{
  ok: boolean; nota?: number; qtd?: number; motivo?: string; place_id?: string;
  lugar?: { nome?: string | null; endereco?: string | null };
}> {
  return req(`reputacao/loja/${lojaId}/conectar-google-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link }),
  });
}

// ── iFood (Apify): salvar a URL da loja + buscar nota/qtd (grava veiculo iFood) ──
export function confirmarIfood(
  lojaId: number,
  url: string,
): Promise<{ ok: boolean; nome?: string; nota?: number; qtd?: number; motivo?: string }> {
  return req(`reputacao/loja/${lojaId}/ifood`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

// ── Atualizar reputacoes (background): redes vazio = tudo (Google + iFood) ──
// Envia e-mail aos franqueados das lojas selecionadas na matriz de reputacao.
export function reputacaoEnviarEmail(lojaIds: number[], assunto: string, corpo: string): Promise<{
  lojas: number; enviados: number;
  resultados: { loja_id: number; loja: string | null; enviados: number; motivo: string | null }[];
}> {
  return req("reputacao/enviar-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loja_ids: lojaIds, assunto, corpo }),
  });
}

export function reputacaoRefresh(
  redes?: string[],
): Promise<{ ok: boolean; iniciado?: string[]; msg?: string }> {
  return req("reputacao/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redes: redes ?? [] }),
  });
}

// ── Minha Loja (portal como pagina; franqueado logado ve as SUAS lojas) ──
export type MinhaLoja = { loja_id: number; nome: string | null; sigla: string | null; token: string };
export function minhasLojas(): Promise<MinhaLoja[]> {
  return req("franqueado/minhas-lojas");
}

// ── 🗑/🚫 Apagar ou desativar loja com transferência anotada (SÓ admin) ──
// O backend devolve 409 com as CONTAGENS quando a loja tem vínculos e nenhum
// destino foi informado — a tela usa isso para abrir o modal de transferência.
export type VinculosLoja = { oportunidades: number; clientes: number; avaliacoes: number };
export type ResultadoAcaoLoja =
  | ({ ok: true } & Record<string, unknown>)
  | { ok: false; precisaDestino: true; motivo: string; vinculos: VinculosLoja };

async function acaoLoja(path: string, method: string): Promise<ResultadoAcaoLoja> {
  const r = await fetch(`${BASE}/${path}`, { method, cache: "no-store" });
  if (r.status === 409) {
    const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
    const d = j.detail;
    if (d && typeof d === "object") {
      const dd = d as { motivo?: string; oportunidades?: number; clientes?: number; avaliacoes?: number };
      return {
        ok: false, precisaDestino: true,
        motivo: dd.motivo ?? "A loja tem vínculos.",
        vinculos: {
          oportunidades: dd.oportunidades ?? 0,
          clientes: dd.clientes ?? 0,
          avaliacoes: dd.avaliacoes ?? 0,
        },
      };
    }
    throw new Error(typeof d === "string" ? d : "Conflito ao executar a ação.");
  }
  if (!r.ok) {
    let detail = `Erro ${r.status}`;
    try {
      const j = (await r.json()) as { detail?: unknown };
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* mantem o detail padrao */
    }
    throw new Error(detail);
  }
  return { ok: true, ...((await r.json()) as Record<string, unknown>) };
}
export function equipeApagarLoja(lojaId: number, transferirPara?: number): Promise<ResultadoAcaoLoja> {
  const qs = transferirPara ? `?transferir_para=${transferirPara}` : "";
  return acaoLoja(`equipe/lojas/${lojaId}${qs}`, "DELETE");
}
export function equipeDesativarLoja(
  lojaId: number, opts?: { transferirPara?: number; manter?: boolean },
): Promise<ResultadoAcaoLoja> {
  const p = new URLSearchParams();
  if (opts?.transferirPara) p.set("transferir_para", String(opts.transferirPara));
  if (opts?.manter) p.set("manter", "true");
  const qs = p.toString();
  return acaoLoja(`equipe/lojas/${lojaId}/desativar${qs ? `?${qs}` : ""}`, "POST");
}
export function equipeReativarLoja(lojaId: number): Promise<ResultadoAcaoLoja> {
  return acaoLoja(`equipe/lojas/${lojaId}/reativar`, "POST");
}

// ── Monitor de Precos de Atacado (pagina Cotacoes) ─────────────────────────
export type PrecoCentral = { id: number; cidade: string; estado?: string | null; central: string; ativo: boolean; metodo: string; dias_publicacao?: string | null };
export type PrecoCelula = { central_id: number; cidade: string; data: string; preco_bruto: number; preco_kg: number | null; embalagem?: string | null; fonte_url?: string | null; produto_fonte?: string | null; variedade?: string | null; equiv?: string | null };
export type PrecoProduto = { produto: string; equiv?: string | null; insumo?: string | null; precos: PrecoCelula[] };
export type PrecoAlertaItem = { data: string; cidade: string; produto: string; tipo: string; variacao_pct: number; preco_anterior: number; preco_novo: number; data_anterior?: string | null };
export type PrecoSeriePonto = { data: string; central_id: number; cidade: string; preco_bruto: number; preco_kg: number | null };
export type PrecoDestaque = { termo: string; ocultados?: number; pontos: { data: string; cidade: string; preco_kg: number }[] };
export type PrecoStatus = { ultima_coleta_em: string | null; ultima_data_cotacao: string | null; total_registros: number; rodou_hoje: boolean; pode_atualizar: boolean };

export async function precosStatus(): Promise<PrecoStatus> {
  return req<PrecoStatus>("precos/status");
}
export async function precosCentrais(): Promise<{ centrais: PrecoCentral[] }> {
  return req<{ centrais: PrecoCentral[] }>("precos/centrais");
}
export async function precosBusca(q: string): Promise<{ itens: { produto: string; n_centrais: number }[] }> {
  return req(`precos/busca?q=${encodeURIComponent(q)}`);
}
export async function precosComparativo(q: string): Promise<{ produtos: PrecoProduto[] }> {
  return req(`precos/comparativo?q=${encodeURIComponent(q)}`);
}
export async function precosSerie(produto: string, dias = 365): Promise<{ produto: string; pontos: PrecoSeriePonto[] }> {
  return req(`precos/serie?produto=${encodeURIComponent(produto)}&dias=${dias}`);
}
export async function precosAlertas(dias = 7): Promise<{ alertas: PrecoAlertaItem[] }> {
  return req(`precos/alertas?dias=${dias}`);
}
export async function precosPainel(termos?: string[], dias = 365): Promise<{ destaques: PrecoDestaque[] }> {
  const q = new URLSearchParams();
  if (termos && termos.length) q.set("termos", termos.join(","));
  q.set("dias", String(dias));
  return req(`precos/painel?${q.toString()}`);
}
export async function precosAnalise(): Promise<{ texto: string | null; criado_em: string | null }> {
  return req("precos/analise");
}
export async function precosAtualizar(backfillDias = 0): Promise<{ ok: boolean; msg: string }> {
  return req(`precos/atualizar?backfill_dias=${backfillDias}`, { method: "POST" });
}

// ── Chatboxes (roteiros do widget de chat, por marca) ─────────────────────
export type ChatboxExtra = { rotulo: string; obrigatorio?: boolean };
export type ChatboxConfig = {
  titulo?: string; saudacao?: string; cor?: string;
  assunto_fixo?: string; perguntar_assunto?: boolean;
  extras?: ChatboxExtra[];
};
export type Chatbox = { id: number; marca_id?: number; nome: string; config: ChatboxConfig; ativo: boolean };
export function chatboxesListar(marcaId: number): Promise<Chatbox[]> {
  return req(`config/marcas/${marcaId}/chatboxes`);
}
export function chatboxCriar(marcaId: number, body: { nome: string; config: ChatboxConfig; ativo?: boolean }): Promise<Chatbox> {
  return req(`config/marcas/${marcaId}/chatboxes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: true, ...body }) });
}
export function chatboxEditar(id: number, body: { nome: string; config: ChatboxConfig; ativo?: boolean }): Promise<Chatbox> {
  return req(`config/chatboxes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: true, ...body }) });
}
export function chatboxApagar(id: number): Promise<void> {
  return req(`config/chatboxes/${id}`, { method: "DELETE" });
}
export function publicoChatbox(slug: string, id: number): Promise<{ id: number; nome: string; config: ChatboxConfig }> {
  return req(`publico/chat/${encodeURIComponent(slug)}/chatbox/${id}`);
}

export function avaliacoesExcluirLote(ids: number[]): Promise<{ excluidas: number }> {
  return req("avaliacoes/excluir-lote", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}


// ── Módulo Vagas (F1) — matriz do franqueado + admin + público ──────────
export type VagasMatriz = {
  lojas: { id: number; nome: string; sigla: string | null; marca_id: number; cidade: string | null }[];
  cargos: { id: number; titulo: string; marca_id: number; marca_sigla: string | null }[];
  abertas: { cargo_id: number; loja_id: number }[];
};
export function vagasMatriz(): Promise<VagasMatriz> {
  return req<VagasMatriz>("vagas/matriz");
}
export function vagasMarcar(cargoId: number, lojaId: number, aberta: boolean): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>("vagas/matriz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cargo_id: cargoId, loja_id: lojaId, aberta }),
  });
}

export type VagaCargoAdmin = {
  id: number; marca_id: number; tipo: string; titulo: string; slug: string;
  descricao: string | null; requisitos: string | null; texto_seo: string | null;
  ordem: number; ativo: boolean;
};
export function vagasCargosAdmin(): Promise<{
  marcas: { id: number; nome: string; slug: string; sigla: string | null }[];
  cargos: VagaCargoAdmin[];
}> {
  return req<{
    marcas: { id: number; nome: string; slug: string; sigla: string | null }[];
    cargos: VagaCargoAdmin[];
  }>("vagas/admin/cargos");
}
export function vagasSalvarCargo(
  c: Partial<VagaCargoAdmin> & { marca_ids?: number[] },
): Promise<{ ok: boolean; id: number }> {
  return req<{ ok: boolean; id: number }>("vagas/admin/cargos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
  });
}
export type VagaCidadeAdmin = {
  id: number; nome: string; uf: string; slug: string;
  populacao: number | null; prioritaria: boolean; ativo: boolean;
};
export function vagasCidades(q = "", soPrio = false): Promise<{ tem_carga_ibge: boolean; cidades: VagaCidadeAdmin[] }> {
  return req<{ tem_carga_ibge: boolean; cidades: VagaCidadeAdmin[] }>(
    `vagas/admin/cidades?q=${encodeURIComponent(q)}&so_prioritarias=${soPrio}`,
  );
}
export function vagasSalvarCidade(nome: string, uf: string, prioritaria: boolean, ativo = true): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>("vagas/admin/cidades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, uf, prioritaria, ativo }),
  });
}
export function vagasImportarIbge(): Promise<{ ok: boolean; mensagem: string }> {
  return req<{ ok: boolean; mensagem: string }>("vagas/admin/cidades/importar-ibge", { method: "POST" });
}

export type CandidatarPayload = {
  marca_slug: string; tipo: "vaga" | "franquia";
  cargo_id?: number; loja_id?: number; lojas_interesse?: number[];
  cidade?: string; uf?: string; capital?: string; franquia_tipo?: "loja" | "popup";
  nome: string; cpf: string; nascimento?: string; telefone: string; email: string;
  redes?: Record<string, string>; ja_trabalhou: boolean;
  experiencia?: { empresa: string; cargo: string; entrada: string; saida: string;
    descricao: string; telefone_ref: string; superior: string }[];
  consent: boolean;
};
export type CandidatarResp = {
  travado: boolean; numero: string | null; token: string | null;
  banco?: boolean; mensagem: string;
};
export function vagasCandidatar(p: CandidatarPayload): Promise<CandidatarResp> {
  return req<CandidatarResp>("publico/vagas/candidatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
}
export type VagasAcompanhar = {
  marca: { nome: string; tema: { cor?: string } } | null; nome: string | null;
  tipo: string; cargo: string | null; loja: string | null;
  cidade: string | null; uf: string | null; fase: string; status: string;
};
export function vagasAcompanhar(token: string): Promise<VagasAcompanhar> {
  return req<VagasAcompanhar>(`publico/vagas/acompanhar/${encodeURIComponent(token)}`);
}


// ── Vagas F2: ranking, painel, funil admin, testes, blocos, portal ──────
export type RankingLinha = {
  id: number; oportunidade_id: number | null; nome: string; email: string;
  telefone: string | null; redes: Record<string, string> | null;
  cidade: string | null; uf: string | null; capital: string | null;
  tipo: string; cargo: string | null; loja: string | null;
  fase: string; status: string; score: number | null; mbi: number | null;
  disc: string | null; disc_pct: string | null; videos: number; alertas: number;
  parado_min: number; criado_em: string | null;
};
export function vagasRanking(params: Record<string, string | number>): Promise<{
  total: number; pagina: number; por_pagina: number; linhas: RankingLinha[];
  smtp_ok?: boolean;
}> {
  const q = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return req<{ total: number; pagina: number; por_pagina: number; linhas: RankingLinha[]; smtp_ok?: boolean }>(
    `vagas/ranking?${q}`,
  );
}
export function vagasAcaoLote(payload: {
  ids: number[]; acao: string; modelo_tipo?: string;
  dia?: string; hora?: string; local?: string;
}): Promise<{ ok: boolean; feitos: number; erros: string[] }> {
  return req<{ ok: boolean; feitos: number; erros: string[] }>("vagas/ranking/acao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export type PainelCandidatura = {
  id: number; status: string; fase: string; tipo: string;
  score: number | null; score_detalhe: { itens: { pergunta_id: number; fase: string; rankeia: string | null; nota: number; peso: number }[] } | null;
  disc: { D: number; I: number; S: number; C: number; perfil: string } | null;
  disc_fit: {
    aderencia: number; faixa: "dentro" | "atencao" | "fora";
    leitura: string; ideal: Record<string, string>;
  } | null;
  candidato: {
    nome: string; email: string; telefone: string | null;
    nascimento: string | null; cidade: string | null;
    uf: string | null; redes: Record<string, string> | null; ja_trabalhou: boolean;
    experiencia: { empresa: string; cargo: string; entrada: string; saida: string;
      descricao: string; telefone_ref: string; superior: string }[] | null;
    cpf: string | null;
  } | null;
  respostas: { pergunta_id: number; valor: string; tipo: string; nota?: number;
    nota_ia?: number; nota_manual?: number; aval_ia?: string;
    alertas_ia?: string[];
    pergunta: string | null; rankeia: string | null; peso: number | null; fase: string }[];
  fases: { slug: string; nome: string }[];
  capital: string | null; cidade: string | null; uf: string | null;
  lojas_interesse: number[] | null;
};
export function vagasPainel(id: number): Promise<PainelCandidatura> {
  return req<PainelCandidatura>(`vagas/candidatura/${id}`);
}
export function vagasNotaManual(id: number, perguntaId: number, nota: number): Promise<{ ok: boolean; score: number | null }> {
  return req<{ ok: boolean; score: number | null }>(`vagas/candidatura/${id}/nota`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pergunta_id: perguntaId, nota }),
  });
}

export type FunilFaseAdmin = {
  id: number; slug: string; nome: string; ordem: number; fixa: boolean;
  ativo: boolean; config: {
    texto_pagina?: string; instrucoes?: string; prazo_dias?: number;
    emails?: Record<string, { assunto?: string; corpo?: string }>;
  };
  perguntas: FunilPerguntaAdmin[];
};
export type FunilPerguntaAdmin = {
  id: number; texto: string; tipo: string; opcoes: string[] | null;
  rankeia: string | null; notas: Record<string, number> | null; peso: number;
  peso_por_tipo: Record<string, number> | null; ordem: number; ativo: boolean;
};
export function vagasFunilAdmin(tipo: string): Promise<{ tipo: string; fases: FunilFaseAdmin[] }> {
  return req<{ tipo: string; fases: FunilFaseAdmin[] }>(`vagas/admin/funil?tipo=${tipo}`);
}
export function vagasSalvarFase(f: {
  id?: number; tipo?: string; nome: string; ordem: number; ativo: boolean;
  config: FunilFaseAdmin["config"];
}): Promise<{ ok: boolean; id: number }> {
  return req<{ ok: boolean; id: number }>("vagas/admin/fases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(f),
  });
}
export function vagasSalvarPergunta(p: {
  id?: number; fase_id: number; texto: string; tipo: string; opcoes?: string[];
  rankeia?: string; notas?: Record<string, number>; peso: number;
  peso_por_tipo?: Record<string, number>; ordem?: number; ativo?: boolean;
}): Promise<{ ok: boolean; id: number }> {
  return req<{ ok: boolean; id: number }>("vagas/admin/perguntas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
}
export type TesteAdmin = {
  id: number; tipo: string; nome: string; ativo: boolean;
  variacoes: { id: number; numero: number; ativo: boolean; usos: number; n_itens: number }[];
};
export function vagasTestes(): Promise<{ testes: TesteAdmin[] }> {
  return req<{ testes: TesteAdmin[] }>("vagas/admin/testes");
}
export function vagasGerarVariacoes(testeId: number, quantas = 10): Promise<{ ok: boolean; mensagem: string }> {
  return req<{ ok: boolean; mensagem: string }>(
    `vagas/admin/testes/${testeId}/gerar?quantas=${quantas}`, { method: "POST" },
  );
}
export function vagasVerVariacao(id: number): Promise<{
  id: number; numero: number; ativo: boolean; usos: number;
  perguntas: { itens: { texto: string; opcoes: { rotulo: string; dim: string }[] }[] };
}> {
  return req<{
    id: number; numero: number; ativo: boolean; usos: number;
    perguntas: { itens: { texto: string; opcoes: { rotulo: string; dim: string }[] }[] };
  }>(`vagas/admin/testes/variacao/${id}`);
}
export function vagasAtivarVariacao(id: number, ativo: boolean): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>(`vagas/admin/testes/variacao/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ativo }),
  });
}
export type BlocoAdmin = {
  id: number; escopo: string; titulo: string | null; texto: string | null;
  ordem: number; ativo: boolean;
};
export function vagasBlocos(): Promise<{ blocos: BlocoAdmin[] }> {
  return req<{ blocos: BlocoAdmin[] }>("vagas/admin/blocos");
}
export function vagasSalvarBloco(b: Partial<BlocoAdmin>): Promise<{ ok: boolean; id: number }> {
  return req<{ ok: boolean; id: number }>("vagas/admin/blocos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
}
export type PortalEstado = {
  marca: { nome: string; tema: { cor?: string } } | null; nome: string | null;
  tipo: string; status: string; fase: string;
  fases: { slug: string; nome: string }[];
  perguntas: { id: number; texto: string; tipo: string; opcoes: string[] | null; respondida: boolean }[];
  teste: { variacao_id: number; itens: { texto: string; opcoes: string[] }[] } | null;
  texto: string | null; instrucoes: string | null;
  contato: string | null;
};
export function vagasPortal(token: string): Promise<PortalEstado> {
  return req<PortalEstado>(`publico/vagas/portal/${encodeURIComponent(token)}`);
}
export function vagasPortalResponder(token: string, respostas: { pergunta_id: number; valor: string }[]): Promise<{ ok: boolean; avancou: boolean; faltam: number; fase: string }> {
  return req<{ ok: boolean; avancou: boolean; faltam: number; fase: string }>(
    `publico/vagas/portal/${encodeURIComponent(token)}/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respostas }),
    },
  );
}
export function vagasPortalTeste(token: string, variacaoId: number, escolhas: number[]): Promise<{ ok: boolean; resultado: Record<string, number | string>; fase: string }> {
  return req<{ ok: boolean; resultado: Record<string, number | string>; fase: string }>(
    `publico/vagas/portal/${encodeURIComponent(token)}/teste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variacao_id: variacaoId, escolhas }),
    },
  );
}

export function vagasRecuperarLink(cpf: string, nascimento: string): Promise<{
  ok: boolean; mensagem?: string; token?: string; link?: string;
  nome?: string; contato?: string | null;
}> {
  return req<{
    ok: boolean; mensagem?: string; token?: string; link?: string;
    nome?: string; contato?: string | null;
  }>("publico/vagas/portal/recuperar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cpf, nascimento }),
  });
}

export function vagasApagarPergunta(id: number): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>(`vagas/admin/perguntas/${id}`, { method: "DELETE" });
}


// ── Base de Conhecimento (upload em lote → Box) ──────────────────────
export type BaseOpcoes = { marcas: string[]; niveis: string[]; max_mb: number };
export type BaseConteudoItem = {
  id: number; nome: string; marca: string; nivel: string;
  classes: string | null; link: string | null; tamanho_mb: number;
  status: string; criado_em: string | null;
};

export function baseOpcoes(): Promise<BaseOpcoes> {
  return req("base/opcoes");
}

export function baseConteudos(): Promise<BaseConteudoItem[]> {
  return req("base/conteudos");
}

export function baseTicket(): Promise<{ ticket: string }> {
  return req("base/ticket", { method: "POST" });
}

// Upload DIRETO ao Render (o proxy da Vercel limita o corpo a 4,5MB).
export async function baseUploadDireto(
  ticket: string, arquivo: File, marca: string, nivel: string, classes: string,
): Promise<{ id: number; box_link: string; status: string }> {
  const motor = process.env.NEXT_PUBLIC_MOTOR_URL || "https://crm-motor.onrender.com";
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  fd.append("marca", marca);
  fd.append("nivel", nivel);
  fd.append("classes", classes);
  const r = await fetch(`${motor}/base/upload-direto/${ticket}`, {
    method: "POST", body: fd,
  });
  if (!r.ok) {
    let msg = `Erro ${r.status}`;
    try { const j = await r.json(); msg = j.detail || msg; } catch { /* segue */ }
    throw new Error(msg);
  }
  return r.json();
}

// ── Q&A da Base de Conhecimento ──────────────────────────────────────
export type BaseFonte = { titulo: string; url: string | null; marca: string };
export type BaseResposta = {
  resposta: string; fontes: BaseFonte[]; suspeita?: boolean; cota?: boolean;
  carimbo?: { nome: string; email: string; ip: string; quando: string };
};

export function basePerguntar(pergunta: string): Promise<BaseResposta> {
  return req("base/perguntar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pergunta }),
  });
}

// completo=false: continua de onde parou (pula o que ja esta indexado).
export function baseIndexar(completo = false): Promise<{ ok: boolean; msg: string }> {
  return req(`base/indexar?completo=${completo}`, { method: "POST" });
}

export type BaseIndexStatus = {
  rodando: boolean; msg: string; arquivos?: number; trechos?: number;
  detalhe?: { falhas?: string[]; grandes_pulados?: string[] };
};

export function baseIndexarStatus(): Promise<BaseIndexStatus> {
  return req("base/indexar/status");
}

export function baseIndexarDestravar(): Promise<{ ok: boolean; msg: string }> {
  return req("base/indexar/destravar", { method: "POST" });
}

// Onboarding etapa 1: mede o custo de passar as transcricoes por um resumo.
// So CONTA (count_tokens) — nao gera texto e nao grava nada. Vai em lotes
// pelo mesmo motivo da indexacao: requisicao longa morre no Render/Vercel.
export type BaseContagem = {
  erro?: string;
  arquivos: number;          // total do acervo
  caracteres: number;        // total do acervo
  inicio: number;
  proximo: number | null;    // null = acabou
  arquivos_medidos: number;  // nesta fatia
  tokens: number;            // nesta fatia
  caracteres_lote: number;
  por_idioma: Record<string, number>;
  falhas: string[];
};

export type BaseMedicao = {
  arquivos: number;
  tokens_entrada: number;
  tokens_overhead_prompt: number;
  tokens_entrada_total: number;
  tokens_saida_estimados: number;
  modelo_da_contagem: string;
  custos: { modelo: string; rotulo: string; normal_usd: number; lote_usd: number }[];
  nota: string;
};

export function baseContarOnboarding(inicio: number, qtd = 25): Promise<BaseContagem> {
  return req(`base/onboarding/medir?inicio=${inicio}&qtd=${qtd}`, { method: "POST" });
}

export function baseProjetarOnboarding(tokens: number, arquivos: number): Promise<BaseMedicao> {
  return req(`base/onboarding/projetar?tokens=${tokens}&arquivos=${arquivos}`);
}

// Onboarding etapa 2: as transcricoes viram resumos estruturados (a materia
// -prima da trilha). Vai pela Batch API — metade do preco, ate 24h de espera.
export type BaseExtracaoEstado = {
  acervo: number;
  faltam_enviar: number;      // transcricoes ainda sem resumo nem lote
  rodando: number;            // lotes na fila da Anthropic
  a_colher: number;           // lotes que terminaram e faltam gravar
  resumos: number;            // ja no banco
  publicados_no_box: number;
  a_publicar: number;
  modelo: string;
  lotes: {
    id: number; batch_id: string; estado: string;
    total: number; colhidos: number; falhas: number; msg: string | null;
  }[];
  // Lotes que existem na Anthropic e nao no nosso banco: foram pagos e
  // ninguem registrou. Rastro de falha, nao operacao normal.
  orfaos: {
    batch_id: string; status: string; criado_em: string; pedidos: number;
  }[];
  // O que esta REALMENTE gravado numa linha, para nao termos que deduzir.
  amostra: {
    arquivo: string | null;
    tipo_gravado: string;
    campos: string[];
    titulo: string | null;
    letras_no_resumo: number;
    publicado: boolean;
  } | null;
};

export function baseExtrairEnviar(qtd = 50): Promise<{
  enviados: number; faltam: number; msg?: string;
}> {
  return req(`base/onboarding/extrair?qtd=${qtd}`, { method: "POST" });
}

export function baseExtrairEstado(): Promise<BaseExtracaoEstado> {
  return req("base/onboarding/extrair/estado");
}

export function baseExtrairColher(): Promise<{
  colhidos: number; falhas?: number; msg?: string;
}> {
  return req("base/onboarding/extrair/colher", { method: "POST" });
}

// refazer=true reescreve no Box tudo o que ja foi publicado (nova versao do
// mesmo arquivo). Use quando o conteudo mudou — prompt novo ou reprocessamento.
export function baseExtrairPublicar(limite = 8, refazer = false): Promise<{
  publicados: number; faltam: number;
}> {
  return req(
    `base/onboarding/extrair/publicar?limite=${limite}&refazer=${refazer}`,
    { method: "POST" },
  );
}

// Indexacao em LOTES: o navegador comanda o ritmo (nada de tarefa longa
// no servidor, que morria no restart do Render).
export type BaseProgresso = {
  total: number; pendentes: number; feitos: number; percentual: number;
  ok: number; vazios: number; erros: number; grandes: number; trechos: number;
};

export function basePreparar(completo = false): Promise<BaseProgresso> {
  return req(`base/indexar/preparar?completo=${completo}`, { method: "POST" });
}

export function baseLote(quantos = 4): Promise<BaseProgresso> {
  return req(`base/indexar/lote?quantos=${quantos}`, { method: "POST" });
}

export function baseProgresso(): Promise<BaseProgresso> {
  return req("base/indexar/progresso");
}

export type BaseProblema = {
  nome: string; estado: string; erro: string | null;
  marca: string; nivel: string;
};

export function baseProblemas(): Promise<BaseProblema[]> {
  return req("base/indexar/problemas");
}

// Busca semântica: vetores de significado (Voyage AI).
export type BaseVetores = {
  total: number; com_vetor: number; faltam: number; percentual: number;
  modelo: string; configurado: boolean;
};

export function baseVetoresLote(quantos = 32): Promise<BaseVetores> {
  return req(`base/vetores/lote?quantos=${quantos}`, { method: "POST" });
}

export function baseVetoresProgresso(): Promise<BaseVetores> {
  return req("base/vetores/progresso");
}

// ── Discador da loja (fila de ligações ligada ao CRM) ────────────────
export type DiscadorItem = {
  id: number; nome: string | null; telefone: string | null;
  estado: string; ordem: number;
  desfecho: string | null; desfecho_rotulo: string;
  oportunidade_id: number | null; consumidor_id: number | null;
  importado: boolean; origem: string | null;
  corrigir_telefone: boolean; tentativas: number;
  retorno_em: string | null; visita_em: string | null;
  em_uso_por: number | null;
};
export type DiscadorDesfecho = {
  chave: string; rotulo: string; sai: boolean; data: string | null;
};
export type DiscadorFila = {
  loja_id: number; loja: string | null; itens: DiscadorItem[];
  pendentes: number; desfechos: DiscadorDesfecho[];
};

export function discadorFila(lojaId?: number): Promise<DiscadorFila> {
  return req(`discador/fila${lojaId ? `?loja_id=${lojaId}` : ""}`);
}

export function discadorAdicionar(payload: {
  loja_id?: number; oportunidade_ids?: number[]; consumidor_ids?: number[];
}): Promise<{ ok: boolean; adicionados: number; mensagem: string;
              loja_id?: number; loja?: string | null }> {
  return req("discador/adicionar", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function discadorDesfecho(itemId: number, payload: {
  desfecho: string; texto?: string; interna?: boolean; enviar_email?: boolean;
  encerrar?: boolean; quando?: string | null; manter_na_fila?: boolean | null;
  confirmar_opt_out?: boolean;
}): Promise<{ ok: boolean; estado: string; oportunidade_id: number | null;
              consumidor_id: number | null; mensagem: string }> {
  return req(`discador/item/${itemId}/desfecho`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function discadorReordenar(ids: number[]): Promise<{ ok: boolean }> {
  return req("discador/reordenar", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

export function discadorAssumir(itemId: number): Promise<{ ok: boolean }> {
  return req(`discador/item/${itemId}/assumir`, { method: "POST" });
}

export function discadorRemover(itemId: number): Promise<{ ok: boolean }> {
  return req(`discador/item/${itemId}`, { method: "DELETE" });
}

export type DiscadorPrevia = {
  total: number; validos: number;
  itens: { nome: string; telefone: string; situacao: string;
           detalhe: string; consumidor_id?: number }[];
};

export function discadorImportarPrevia(payload: {
  loja_id?: number; origem: string; contatos: { nome: string; telefone: string }[];
}): Promise<DiscadorPrevia> {
  return req("discador/importar/previa", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, confirmo: true }),
  });
}

export function discadorImportar(payload: {
  loja_id?: number; origem: string; confirmo: boolean;
  contatos: { nome: string; telefone: string }[]; cadastrar_no_crm: boolean;
}): Promise<{ ok: boolean; na_fila: number; cadastrados: number;
              vinculados: number; mensagem: string }> {
  return req("discador/importar", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type DiscadorEncerrarPrevia = {
  loja_id: number; total_fila: number;
  sem_cadastro: { id: number; nome: string; telefone: string;
                  origem: string | null; desfecho: string | null;
                  tentativas: number }[];
};

export function discadorEncerrarPrevia(lojaId?: number): Promise<DiscadorEncerrarPrevia> {
  return req(`discador/encerrar/previa${lojaId ? `?loja_id=${lojaId}` : ""}`);
}

export function discadorEncerrar(payload: {
  loja_id?: number; cadastrar_ids: number[];
  limpar_concluidos?: boolean; limpar_tudo?: boolean;
}): Promise<{ ok: boolean; cadastrados: number; mensagem: string }> {
  return req("discador/encerrar", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
