"use client";

/**
 * FINANCEIRO do franqueado (Fase A, 28/07/2026) — v2 lista única.
 *
 * Como a página de boletos da cobrança (pedido do admin): TODAS as lojas do
 * usuário numa lista só (coluna Loja), com as mesmas buscas — texto, Estado
 * (boletos e obrigações no mesmo seletor) e vencimento de/até — e a mesma
 * paginação. Rating por loja no topo (letra + nota + fatores, SEM alertas
 * internos). Boleto em dia → 2ª via (PDF); vencido → TRATAR (mesma página
 * dos e-mails de cobrança). Obrigações abertas → Responder.
 */

import { useEffect, useState } from "react";
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
  type PaginaFin,
} from "@/lib/api";

const PAGE_SIZE = 50;

// Mesmos rótulos/cores da página de boletos da cobrança
const ESTADOS_LABEL: Record<string, { short: string; badge: string }> = {
  aberto: { short: "ABERTO", badge: "badge-blue" },
  vencido: { short: "VENC", badge: "badge-red" },
  pago_auto: { short: "PG CNAB", badge: "badge-green" },
  pago_manual: { short: "PG MANUAL", badge: "badge-green" },
  baixado: { short: "BAIXA", badge: "badge-gray" },
  rejeitado: { short: "REJ", badge: "badge-yellow" },
  cancelado: { short: "CANC", badge: "badge-gray" },
};

const STATUS_OBRIG_LABEL: Record<string, { label: string; badge: string }> = {
  em_aberto: { label: "ABERTO", badge: "badge-blue" },
  vencida: { label: "VENC", badge: "badge-red" },
  respondida: { label: "RESP", badge: "badge-blue" },
  aceita: { label: "OK", badge: "badge-green" },
  recusada: { label: "ABERTO", badge: "badge-blue" },
  nao_cumprida: { label: "NÃO OK", badge: "badge-red" },
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
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={`Rating ${letra}`}>
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
    <div className="mb-3">
      <div className="flex gap-2 flex-wrap">
        {lojas.map((lj) => (
          <button
            key={lj.loja_id}
            onClick={() => setAbertaId(abertaId === lj.loja_id ? null : lj.loja_id)}
            className={`card px-3 py-2 flex items-center gap-2 text-left hover:bg-slate-50 ${
              abertaId === lj.loja_id ? "ring-2 ring-brand-500" : ""
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
        <div className="card p-3 mt-2 max-w-xl">
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

function Paginacao({
  total, offset, count, onMove,
}: {
  total: number; offset: number; count: number; onMove: (novo: number) => void;
}) {
  if (total <= 0) return null;
  return (
    <div className="flex items-center justify-between mt-2 text-sm">
      <div className="text-slate-500">
        Exibindo{" "}
        <strong className="text-slate-700">
          {offset + 1}–{Math.min(offset + count, total)}
        </strong>{" "}
        de <strong className="text-slate-700">{total}</strong>
      </div>
      <div className="flex gap-1">
        <button
          className="btn-ghost text-xs"
          disabled={offset <= 0}
          onClick={() => onMove(Math.max(0, offset - PAGE_SIZE))}
        >
          ‹ Anterior
        </button>
        <button
          className="btn-ghost text-xs"
          disabled={offset + count >= total}
          onClick={() => onMove(offset + PAGE_SIZE)}
        >
          Próxima ›
        </button>
      </div>
    </div>
  );
}

// Filtros compartilhados (mesma barra da /boletos da cobrança)
type Filtros = { q: string; estado: string; vencDe: string; vencAte: string };
const FILTROS_VAZIOS: Filtros = { q: "", estado: "", vencDe: "", vencAte: "" };

export default function FinanceiroPage() {
  const [lojas, setLojas] = useState<LojaFinanceiro[]>([]);
  const [disponivel, setDisponivel] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // Campos digitados x filtros APLICADOS (busca ao clicar/Enter, como na cobrança)
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

  const estadoEhObrig = filtros.estado.startsWith("o:");
  const mostraBoletos = !estadoEhObrig;
  const mostraObrigacoes = !filtros.estado || estadoEhObrig;

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

            {/* Barra de busca — mesma da página de boletos da cobrança */}
            <div className="card p-3 mb-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-slate-500 mb-0.5">
                    Busca (nº documento, NNum, título…)
                  </label>
                  <input
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                    value={form.q}
                    onChange={(e) => setForm({ ...form, q: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && buscar()}
                    placeholder="Ex: 4310, DRE, 123456"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Estado</label>
                  <select
                    className="border border-slate-300 rounded px-2 py-1.5 text-sm"
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
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Venc. de</label>
                  <input
                    type="date"
                    className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                    value={form.vencDe}
                    onChange={(e) => setForm({ ...form, vencDe: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Venc. até</label>
                  <input
                    type="date"
                    className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                    value={form.vencAte}
                    onChange={(e) => setForm({ ...form, vencAte: e.target.value })}
                  />
                </div>
                <button className="btn-primary text-sm" onClick={buscar}>
                  🔍 Buscar
                </button>
                <button className="btn-ghost text-sm" onClick={limpar}>
                  Limpar
                </button>
              </div>
            </div>

            {mostraBoletos && <BoletosLista filtros={filtros} multiLoja={lojas.length > 1} />}
            {mostraObrigacoes && (
              <ObrigacoesLista filtros={filtros} multiLoja={lojas.length > 1} />
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

function BoletosLista({ filtros, multiLoja }: { filtros: Filtros; multiLoja: boolean }) {
  const [offset, setOffset] = useState(0);
  const [pagina, setPagina] = useState<PaginaFin<BoletoFin> | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [tratandoId, setTratandoId] = useState<string | null>(null);

  useEffect(() => { setOffset(0); }, [filtros]);

  useEffect(() => {
    setCarregando(true);
    financeiroBoletos({
      q: filtros.q,
      estado: filtros.estado.startsWith("o:") ? "" : filtros.estado,
      venc_de: filtros.vencDe || undefined,
      venc_ate: filtros.vencAte || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((r) => { setPagina(r); setErro(""); })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"))
      .finally(() => setCarregando(false));
  }, [filtros, offset]);

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

  return (
    <section className="card p-3 mb-3">
      <h2 className="font-semibold text-slate-700 mb-2">Boletos</h2>
      {erro && <div className="text-sm text-red-600 mb-2">{erro}</div>}
      {carregando ? (
        <div className="text-sm text-slate-400">Carregando…</div>
      ) : !pagina || pagina.itens.length === 0 ? (
        <div className="text-sm text-slate-400">Nenhum boleto com esses filtros.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {multiLoja && <th className="th">Loja</th>}
                  <th className="th">Empresa</th>
                  <th className="th">NNum</th>
                  <th className="th">Doc</th>
                  <th className="th">Vencimento</th>
                  <th className="th text-right">Valor</th>
                  <th className="th">Estado</th>
                  <th className="th">Pagamento</th>
                  <th className="th text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pagina.itens.map((b, idx) => {
                  const est = ESTADOS_LABEL[b.estado_efetivo] ??
                    { short: (b.estado_efetivo || "—").toUpperCase(), badge: "badge-gray" };
                  return (
                    <tr
                      key={b.id}
                      className={`border-t border-slate-100 ${idx % 2 === 1 ? "bg-slate-50/60" : ""}`}
                    >
                      {multiLoja && (
                        <td className="td font-mono text-xs">{b.sigla ?? "—"}</td>
                      )}
                      <td className="td">{b.empresa ?? "—"}</td>
                      <td className="td font-mono text-xs">{b.nnum}</td>
                      <td className="td font-mono text-xs">{b.num_doc}</td>
                      <td className="td">{fmtData(b.vencimento)}</td>
                      <td className="td text-right">{fmtValor(b.valor_doc)}</td>
                      <td className="td"><span className={est.badge}>{est.short}</span></td>
                      <td className="td text-xs">
                        {b.data_pagamento
                          ? `${fmtData(b.data_pagamento)}${b.valor_recebido != null ? ` · ${fmtValor(b.valor_recebido)}` : ""}`
                          : "—"}
                      </td>
                      <td className="td text-right whitespace-nowrap">
                        {b.pode_pdf && (
                          <a
                            href={financeiroPdfUrl(b.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 hover:underline text-xs font-medium"
                          >
                            📄 2ª via
                          </a>
                        )}
                        {b.pode_tratar && (
                          <button
                            onClick={() => tratar(b)}
                            disabled={tratandoId === b.id}
                            className="text-red-600 hover:underline text-xs font-semibold"
                          >
                            {tratandoId === b.id ? "abrindo…" : "⚠️ Tratar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacao
            total={pagina.total}
            offset={pagina.offset}
            count={pagina.itens.length}
            onMove={setOffset}
          />
        </>
      )}
    </section>
  );
}

function ObrigacoesLista({ filtros, multiLoja }: { filtros: Filtros; multiLoja: boolean }) {
  const [offset, setOffset] = useState(0);
  const [pagina, setPagina] = useState<PaginaFin<ObrigacaoFin> | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { setOffset(0); }, [filtros]);

  useEffect(() => {
    setCarregando(true);
    financeiroObrigacoes({
      q: filtros.q,
      status_filtro: filtros.estado.startsWith("o:")
        ? filtros.estado.slice(2)
        : "",
      venc_de: filtros.vencDe || undefined,
      venc_ate: filtros.vencAte || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((r) => { setPagina(r); setErro(""); })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"))
      .finally(() => setCarregando(false));
  }, [filtros, offset]);

  return (
    <section className="card p-3">
      <h2 className="font-semibold text-slate-700 mb-2">Obrigações</h2>
      {erro && <div className="text-sm text-red-600 mb-2">{erro}</div>}
      {carregando ? (
        <div className="text-sm text-slate-400">Carregando…</div>
      ) : !pagina || pagina.itens.length === 0 ? (
        <div className="text-sm text-slate-400">Nenhuma obrigação com esses filtros.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {multiLoja && <th className="th">Loja</th>}
                  <th className="th">Nº</th>
                  <th className="th">Título</th>
                  <th className="th">Tipo</th>
                  <th className="th">Vencimento</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pagina.itens.map((o, idx) => {
                  const stEf = statusObrigEfetivo(o);
                  const st = STATUS_OBRIG_LABEL[stEf] ??
                    { label: (stEf || "—").toUpperCase(), badge: "badge-gray" };
                  return (
                    <tr
                      key={o.id}
                      className={`border-t border-slate-100 ${idx % 2 === 1 ? "bg-slate-50/60" : ""}`}
                    >
                      {multiLoja && (
                        <td className="td font-mono text-xs">{o.sigla ?? "—"}</td>
                      )}
                      <td className="td font-mono text-xs">{o.numero ?? "—"}</td>
                      <td className="td">{o.titulo ?? "—"}</td>
                      <td className="td text-xs">{o.tipo_nome || o.tipo || "—"}</td>
                      <td className="td">{fmtData(o.vencimento)}</td>
                      <td className="td"><span className={st.badge}>{st.label}</span></td>
                      <td className="td text-right">
                        {o.link_responder && (
                          <a
                            href={o.link_responder}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 hover:underline text-xs font-medium"
                          >
                            ✍️ Responder
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacao
            total={pagina.total}
            offset={pagina.offset}
            count={pagina.itens.length}
            onMove={setOffset}
          />
        </>
      )}
    </section>
  );
}
