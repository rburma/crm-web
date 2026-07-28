"use client";

/**
 * FINANCEIRO do franqueado — v4 ESPELHO da página de boletos da cobrança:
 *   - painel ÚNICO com a barra de abas "Tipo:" (Boletos · Todos · DRE ·
 *     Treinamento · …) — igual à /boletos: Boletos = só WT; Todos = inclui
 *     fornecedores; aba de tipo = obrigações daquele tipo
 *   - tabela compacta text-xs, chip de tipo em cada linha (BOL cinza /
 *     obrigação lilás), linhas de obrigação com fundo lilás claro
 *   - cabeçalhos ORDENÁVEIS (setinha ▲▼) e paginação "Exibindo X–Y de Z"
 *   - barra de busca: texto + Estado + vencimento de/até (Buscar/Limpar)
 * Ações: 2ª via (PDF) só em boleto em dia; vencido → TRATAR; obrigação
 * aberta → Responder. Rating por loja no topo (sem alertas internos).
 */

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import {
  financeiroBoletos,
  financeiroMinhasLojas,
  financeiroObrigacoes,
  financeiroPdfUrl,
  financeiroTratarBoleto,
  type BoletoFin,
  type LojaFinanceiro,
  type ObrigacaoFin,
} from "@/lib/api";

const PAGE_SIZE = 50;

// ── Réplica das classes visuais da cobrança ─────────────────────────────
const PANEL = "bg-white border border-slate-200 rounded-lg";
const TABLE =
  "w-full text-xs [&_td]:py-1 [&_th]:py-1 [&_td]:align-middle [&_td]:whitespace-nowrap";
const TH = "text-left p-2 text-xs uppercase text-slate-500";
const ROW_BOL = "border-t border-slate-100 hover:bg-slate-50";
const ROW_OBRIG = "border-t border-slate-100 bg-indigo-50/30 hover:bg-indigo-50";
const SELO = "inline-block px-2 py-0.5 rounded-full text-xs font-semibold uppercase";
const SELO_COR: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  yellow: "bg-yellow-100 text-yellow-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-slate-100 text-slate-700",
};

function Selo({ cor, children }: { cor: string; children: React.ReactNode }) {
  return <span className={`${SELO} ${SELO_COR[cor] ?? SELO_COR.gray}`}>{children}</span>;
}

const ESTADOS_LABEL: Record<string, { short: string; cor: string }> = {
  aberto: { short: "ABERTO", cor: "blue" },
  vencido: { short: "VENC", cor: "red" },
  pago_auto: { short: "PG CNAB", cor: "green" },
  pago_manual: { short: "PG MANUAL", cor: "green" },
  baixado: { short: "BAIXA", cor: "gray" },
  rejeitado: { short: "REJ", cor: "yellow" },
  cancelado: { short: "CANC", cor: "gray" },
};

const STATUS_OBRIG_LABEL: Record<string, { label: string; cor: string }> = {
  em_aberto: { label: "ABERTO", cor: "blue" },
  vencida: { label: "VENC", cor: "red" },
  respondida: { label: "RESP", cor: "blue" },
  aceita: { label: "OK", cor: "green" },
  recusada: { label: "ABERTO", cor: "blue" },
  nao_cumprida: { label: "NÃO OK", cor: "red" },
};

// Abas "Tipo:" — espelha a /boletos da cobrança (sem Helpcenter/Contratos/
// fornecedor-por-empresa; "Todos" inclui fornecedores, "Boletos" = só WT).
const ABAS: { v: string; r: string }[] = [
  { v: "BOLETOS", r: "Boletos" },
  { v: "TODOS", r: "Todos" },
  { v: "DRE", r: "DRE (relatório financeiro)" },
  { v: "RESPOSTAS", r: "Respostas / Perguntas" },
  { v: "CONTRATOS", r: "Contratos" },
  { v: "PESQUISAS", r: "Pesquisas" },
  { v: "ZOOM", r: "Treinamento" },
  { v: "DOCUMENTOS", r: "Documentos" },
  { v: "CHECKLISTS", r: "Checklists" },
  { v: "VISUAL_MERCH", r: "Visual Merchandising" },
  { v: "REFORMA", r: "Reforma de loja" },
  { v: "OUTRO", r: "Outros" },
];

// Abrevs da coluna Tipo (iguais às da /boletos)
const ABREV_TIPO: Record<string, string> = {
  DRE: "DRE", CHECKLISTS: "CK", OUTRO: "OUT", PESQUISAS: "PQ", ZOOM: "TR",
  DOCUMENTOS: "DOC", VISUAL_MERCH: "VM", REFORMA: "REF", CONTRATOS: "CT",
  RESPOSTAS: "RSP", COMPROVANTES: "CPR",
};

const CORES_LETRA: Record<string, string> = {
  A: "#16a34a", B: "#2563eb", C: "#eab308", D: "#f97316", E: "#dc2626",
};

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtValor(v: number | null | undefined): string {
  if (v == null) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function statusObrigEfetivo(o: ObrigacaoFin): string {
  if (o.status === "em_aberto" && o.vencimento) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (o.vencimento.slice(0, 10) < hoje) return "vencida";
  }
  return o.status;
}

function LetraRating({ letra, size = 24 }: { letra: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={`Rating ${letra}`}
      style={{ display: "inline-block", verticalAlign: "middle" }}>
      <rect x="1" y="1" width="22" height="22" rx="5" fill={CORES_LETRA[letra] ?? "#94a3b8"} />
      <text x="12" y="12" textAnchor="middle" dominantBaseline="central" fontSize="15"
        fontWeight="800" fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#fff">
        {letra}
      </text>
    </svg>
  );
}

/** Faixa de ratings — 1 cartão por loja; clique abre os fatores. */
function RatingsStrip({ lojas }: { lojas: LojaFinanceiro[] }) {
  const [abertaId, setAbertaId] = useState<number | null>(null);
  const aberta = lojas.find((lj) => lj.loja_id === abertaId) ?? null;
  return (
    <div className="mb-4">
      <div className="flex gap-2 flex-wrap">
        {lojas.map((lj) => (
          <button
            key={lj.loja_id}
            onClick={() => setAbertaId(abertaId === lj.loja_id ? null : lj.loja_id)}
            className={`${PANEL} px-3 py-2 flex items-center gap-2 text-left hover:bg-slate-50 transition ${
              abertaId === lj.loja_id ? "ring-2 ring-blue-400" : ""
            }`}
            title="Clique para ver como a nota é formada"
          >
            {lj.rating?.letra ? (
              <LetraRating letra={lj.rating.letra} />
            ) : (
              <span className="text-slate-300 text-lg">—</span>
            )}
            <span>
              <span className="block text-sm font-medium text-slate-700">
                {lj.nome || lj.sigla}
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                {lj.sigla}
                {lj.rating?.nota != null ? ` · ${lj.rating.nota}/100` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
      {aberta?.rating?.componentes?.length ? (
        <div className={`${PANEL} p-3 mt-2 max-w-xl`}>
          <div className="text-xs font-semibold text-slate-600 mb-1">
            Como a nota de {aberta.nome || aberta.sigla} é formada
          </div>
          <div className="space-y-1 text-xs">
            {aberta.rating.componentes.map((c, i) => (
              <div key={i} className="flex items-start justify-between gap-2 border-t border-slate-100 pt-1">
                <div>
                  <div className="text-slate-700">{c.rotulo}</div>
                  {c.info && <div className="text-[10px] text-slate-400">{c.info}</div>}
                </div>
                <div className="whitespace-nowrap font-mono font-semibold text-slate-600">
                  {c.pontos == null ? "—" : `${c.pontos}/${c.max}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Cabeçalho ordenável com setinha — igual ao SortHeader da /boletos. */
function SortHeader({
  label, k, sortKey, sortDir, onClick, align = "left",
}: {
  label: string; k: string; sortKey: string; sortDir: "asc" | "desc";
  onClick: (k: string) => void; align?: "left" | "right";
}) {
  const ativo = sortKey === k;
  return (
    <th
      className={`${align === "right" ? "text-right" : "text-left"} p-2 text-xs uppercase text-slate-500 cursor-pointer select-none hover:text-slate-700`}
      onClick={() => onClick(k)}
      title="Clique para ordenar"
    >
      {label}
      {ativo && <span className="ml-0.5">{sortDir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}

function Paginacao({
  total, offset, count, onMove,
}: {
  total: number; offset: number; count: number; onMove: (novo: number) => void;
}) {
  if (total <= 0) return null;
  return (
    <div className="flex items-center justify-between mt-3 text-sm px-2 pb-2">
      <div className="text-slate-500">
        Exibindo{" "}
        <strong className="text-slate-700">
          {offset + 1}–{Math.min(offset + count, total)}
        </strong>{" "}
        de <strong className="text-slate-700">{total}</strong>
      </div>
      <div className="flex gap-1">
        <button
          className="bg-white border border-slate-300 text-slate-700 font-medium px-3 py-1 rounded hover:bg-slate-50 transition text-xs disabled:opacity-40"
          disabled={offset <= 0}
          onClick={() => onMove(Math.max(0, offset - PAGE_SIZE))}
        >
          ‹ Anterior
        </button>
        <button
          className="bg-white border border-slate-300 text-slate-700 font-medium px-3 py-1 rounded hover:bg-slate-50 transition text-xs disabled:opacity-40"
          disabled={offset + count >= total}
          onClick={() => onMove(offset + PAGE_SIZE)}
        >
          Próxima ›
        </button>
      </div>
    </div>
  );
}

type Filtros = { q: string; estado: string; vencDe: string; vencAte: string };
const FILTROS_VAZIOS: Filtros = { q: "", estado: "", vencDe: "", vencAte: "" };

const FIELD_LABEL = "text-xs font-semibold text-slate-600";
const FIELD_INPUT =
  "border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500";

export default function FinanceiroPage() {
  const [lojas, setLojas] = useState<LojaFinanceiro[]>([]);
  const [disponivel, setDisponivel] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [tipoFiltro, setTipoFiltro] = useState("BOLETOS");
  const [form, setForm] = useState<Filtros>(FILTROS_VAZIOS);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);

  useEffect(() => {
    financeiroMinhasLojas()
      .then((r) => {
        setDisponivel(r.disponivel);
        setLojas(r.lojas);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"))
      .finally(() => setCarregando(false));
  }, []);

  const buscar = () => setFiltros({ ...form });
  const limpar = () => { setForm(FILTROS_VAZIOS); setFiltros(FILTROS_VAZIOS); };

  const abaEhObrig = tipoFiltro !== "BOLETOS" && tipoFiltro !== "TODOS";

  return (
    <Shell title="Financeiro">
      <div className="max-w-6xl">
        {erro && <div className="text-sm text-red-600 mb-3">{erro}</div>}
        {carregando ? (
          <div className="text-sm text-slate-400">Carregando…</div>
        ) : !disponivel ? (
          <div className="text-sm text-slate-400">
            Integração com a cobrança ainda não está ligada.
          </div>
        ) : lojas.length === 0 ? (
          <div className="text-sm text-slate-400">
            O Financeiro é exclusivo do administrador da loja. Nenhuma loja
            com acesso encontrada para o seu usuário.
          </div>
        ) : (
          <>
            <RatingsStrip lojas={lojas} />

            {/* Barra de busca — mesma da /boletos */}
            <div className={`${PANEL} p-4 mb-4`}>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                  <label className={FIELD_LABEL}>
                    Busca (nº documento, NNum, título…)
                  </label>
                  <input
                    className={FIELD_INPUT}
                    value={form.q}
                    onChange={(e) => setForm({ ...form, q: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && buscar()}
                    placeholder="Ex: 4310, DRE, 123456"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={FIELD_LABEL}>Estado</label>
                  <select
                    className={FIELD_INPUT}
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  >
                    <option value="">Todos</option>
                    <optgroup label="Boletos">
                      <option value="pendentes">Pendentes (aberto + vencido)</option>
                      <option value="aberto">Aberto (em dia)</option>
                      <option value="vencido">Vencido</option>
                      <option value="pagos">Pagos</option>
                      <option value="baixado">Baixado</option>
                      <option value="rejeitado">Rejeitado</option>
                      <option value="cancelado">Cancelado</option>
                    </optgroup>
                    <optgroup label="Obrigações">
                      <option value="o:em_aberto">Em aberto</option>
                      <option value="o:vencida">Vencida</option>
                      <option value="o:respondida">Respondida</option>
                      <option value="o:aceita">OK (concluída)</option>
                      <option value="o:nao_cumprida">NÃO OK</option>
                    </optgroup>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={FIELD_LABEL}>Venc. de</label>
                  <input type="date" className={FIELD_INPUT} value={form.vencDe}
                    onChange={(e) => setForm({ ...form, vencDe: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={FIELD_LABEL}>Venc. até</label>
                  <input type="date" className={FIELD_INPUT} value={form.vencAte}
                    onChange={(e) => setForm({ ...form, vencAte: e.target.value })} />
                </div>
                <button
                  className="bg-blue-600 text-white font-medium px-4 py-2 rounded hover:bg-blue-700 transition text-sm"
                  onClick={buscar}
                >
                  🔍 Buscar
                </button>
                <button
                  className="bg-white border border-slate-300 text-slate-700 font-medium px-4 py-2 rounded hover:bg-slate-50 transition text-sm"
                  onClick={limpar}
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Painel único com abas Tipo + tabela — como a /boletos */}
            <div className={`${PANEL} overflow-x-auto p-2`}>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">Tipo:</span>
                {ABAS.map((f) => (
                  <button
                    key={f.v}
                    onClick={() => setTipoFiltro(f.v)}
                    className={`rounded px-2.5 py-1 text-xs ${
                      tipoFiltro === f.v
                        ? "bg-slate-800 text-white"
                        : "border hover:bg-gray-50"
                    }`}
                  >
                    {f.r}
                  </button>
                ))}
              </div>
              {abaEhObrig ? (
                <ObrigacoesTabela
                  tipo={tipoFiltro}
                  filtros={filtros}
                  multiLoja={lojas.length > 1}
                />
              ) : (
                <BoletosTabela
                  origem={tipoFiltro === "BOLETOS" ? "wt" : ""}
                  filtros={filtros}
                  multiLoja={lojas.length > 1}
                />
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function useSort(defaultKey: string) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const clickSort = (k: string) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };
  return { sortKey, sortDir, clickSort };
}

function cmp(a: unknown, b: unknown, dir: "asc" | "desc"): number {
  const va = a ?? "";
  const vb = b ?? "";
  if (va < vb) return dir === "asc" ? -1 : 1;
  if (va > vb) return dir === "asc" ? 1 : -1;
  return 0;
}

function BoletosTabela({
  origem, filtros, multiLoja,
}: {
  origem: string; filtros: Filtros; multiLoja: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [pagina, setPagina] = useState<{ total: number; itens: BoletoFin[]; offset: number } | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [tratandoId, setTratandoId] = useState<string | null>(null);
  const { sortKey, sortDir, clickSort } = useSort("vencimento");

  useEffect(() => { setOffset(0); }, [filtros, origem]);

  useEffect(() => {
    setCarregando(true);
    financeiroBoletos({
      q: filtros.q,
      estado: filtros.estado.startsWith("o:") ? "" : filtros.estado,
      origem,
      venc_de: filtros.vencDe || undefined,
      venc_ate: filtros.vencAte || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((r) => { setPagina(r); setErro(""); })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"))
      .finally(() => setCarregando(false));
  }, [filtros, origem, offset]);

  const itens = useMemo(() => {
    if (!pagina) return [];
    const arr = [...pagina.itens];
    arr.sort((a, b) => cmp(
      (a as unknown as Record<string, unknown>)[sortKey],
      (b as unknown as Record<string, unknown>)[sortKey],
      sortDir,
    ));
    return arr;
  }, [pagina, sortKey, sortDir]);

  async function tratar(b: BoletoFin) {
    setTratandoId(b.id);
    try {
      const { url } = await financeiroTratarBoleto(b.id);
      window.open(url, "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao gerar o link de tratamento.");
    } finally {
      setTratandoId(null);
    }
  }

  if (erro) return <div className="text-sm text-red-600 p-3">{erro}</div>;
  if (carregando) return <div className="text-sm text-slate-400 p-3">Carregando…</div>;
  if (!pagina || pagina.itens.length === 0) {
    return <div className="text-sm text-slate-400 p-3">Nenhum boleto com esses filtros.</div>;
  }

  return (
    <>
      <table className={TABLE}>
        <thead className="bg-slate-50">
          <tr>
            <th className={TH}>Tipo</th>
            {multiLoja && <SortHeader label="Cód. loja" k="sigla" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />}
            <SortHeader label="Empresa" k="empresa" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <SortHeader label="Estado" k="estado_efetivo" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <SortHeader label="NNum" k="nnum" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <SortHeader label="Num Doc" k="num_doc" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <SortHeader label="Valor" k="valor_doc" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} align="right" />
            <SortHeader label="Venc." k="vencimento" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <SortHeader label="Pago" k="valor_recebido" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} align="right" />
            <SortHeader label="Pagto" k="data_pagamento" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <th className={`${TH} text-right`}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((b) => {
            const est = ESTADOS_LABEL[b.estado_efetivo] ??
              { short: (b.estado_efetivo || "—").toUpperCase(), cor: "gray" };
            return (
              <tr key={b.id} className={ROW_BOL}>
                <td className="p-2">
                  <span className="rounded bg-slate-200 px-1 py-0.5 text-[10px] font-semibold">
                    BOL
                  </span>
                </td>
                {multiLoja && <td className="p-2 font-mono">{b.sigla ?? "—"}</td>}
                <td className="p-2">{b.empresa ?? "—"}</td>
                <td className="p-2"><Selo cor={est.cor}>{est.short}</Selo></td>
                <td className="p-2 font-mono">{b.nnum}</td>
                <td className="p-2 font-mono">{b.num_doc}</td>
                <td className="p-2 text-right">{fmtValor(b.valor_doc)}</td>
                <td className="p-2">{fmtData(b.vencimento)}</td>
                <td className="p-2 text-right">{fmtValor(b.valor_recebido)}</td>
                <td className="p-2">{fmtData(b.data_pagamento)}</td>
                <td className="p-2 text-right">
                  {b.pode_pdf && (
                    <a href={financeiroPdfUrl(b.id)} target="_blank" rel="noreferrer"
                      className="text-blue-600 hover:underline font-medium">
                      📄 2ª via
                    </a>
                  )}
                  {b.pode_tratar && (
                    <button onClick={() => tratar(b)} disabled={tratandoId === b.id}
                      className="text-red-600 hover:underline font-semibold">
                      {tratandoId === b.id ? "abrindo…" : "⚠️ Tratar"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Paginacao total={pagina.total} offset={pagina.offset}
        count={pagina.itens.length} onMove={setOffset} />
    </>
  );
}

function ObrigacoesTabela({
  tipo, filtros, multiLoja,
}: {
  tipo: string; filtros: Filtros; multiLoja: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [pagina, setPagina] = useState<{ total: number; itens: ObrigacaoFin[]; offset: number } | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const { sortKey, sortDir, clickSort } = useSort("vencimento");

  useEffect(() => { setOffset(0); }, [filtros, tipo]);

  useEffect(() => {
    setCarregando(true);
    financeiroObrigacoes({
      q: filtros.q,
      status_filtro: filtros.estado.startsWith("o:") ? filtros.estado.slice(2) : "",
      tipo,
      venc_de: filtros.vencDe || undefined,
      venc_ate: filtros.vencAte || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((r) => { setPagina(r); setErro(""); })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"))
      .finally(() => setCarregando(false));
  }, [filtros, tipo, offset]);

  const itens = useMemo(() => {
    if (!pagina) return [];
    const arr = [...pagina.itens];
    arr.sort((a, b) => cmp(
      (a as unknown as Record<string, unknown>)[sortKey],
      (b as unknown as Record<string, unknown>)[sortKey],
      sortDir,
    ));
    return arr;
  }, [pagina, sortKey, sortDir]);

  if (erro) return <div className="text-sm text-red-600 p-3">{erro}</div>;
  if (carregando) return <div className="text-sm text-slate-400 p-3">Carregando…</div>;
  if (!pagina || pagina.itens.length === 0) {
    return <div className="text-sm text-slate-400 p-3">Nenhuma obrigação com esses filtros.</div>;
  }

  return (
    <>
      <table className={TABLE}>
        <thead className="bg-slate-50">
          <tr>
            <th className={TH}>Tipo</th>
            {multiLoja && <SortHeader label="Cód. loja" k="sigla" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />}
            <SortHeader label="Estado" k="status" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <SortHeader label="Nº" k="numero" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <SortHeader label="Título" k="titulo" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <SortHeader label="Venc." k="vencimento" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <SortHeader label="Respondido" k="respondido_em" sortKey={sortKey} sortDir={sortDir} onClick={clickSort} />
            <th className={`${TH} text-right`}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((o) => {
            const stEf = statusObrigEfetivo(o);
            const st = STATUS_OBRIG_LABEL[stEf] ??
              { label: (stEf || "—").toUpperCase(), cor: "gray" };
            return (
              <tr key={o.id} className={ROW_OBRIG}>
                <td className="p-2">
                  <span
                    className="rounded bg-indigo-200 px-1 py-0.5 text-[10px] font-semibold"
                    title={o.tipo_nome || o.tipo || ""}
                  >
                    {ABREV_TIPO[o.tipo ?? ""] ?? o.tipo ?? "—"}
                  </span>
                </td>
                {multiLoja && <td className="p-2 font-mono">{o.sigla ?? "—"}</td>}
                <td className="p-2"><Selo cor={st.cor}>{st.label}</Selo></td>
                <td className="p-2 font-mono">{o.numero ?? "—"}</td>
                <td className="p-2">{o.titulo ?? "—"}</td>
                <td className="p-2">{fmtData(o.vencimento)}</td>
                <td className="p-2">{fmtData(o.respondido_em)}</td>
                <td className="p-2 text-right">
                  {o.link_responder && (
                    <a href={o.link_responder} target="_blank" rel="noreferrer"
                      className="text-blue-600 hover:underline font-medium">
                      ✍️ Responder
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Paginacao total={pagina.total} offset={pagina.offset}
        count={pagina.itens.length} onMove={setOffset} />
    </>
  );
}
