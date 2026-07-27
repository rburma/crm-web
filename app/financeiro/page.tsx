"use client";

/**
 * FINANCEIRO do franqueado (Fase A, 28/07/2026).
 *
 * Admin da loja vê, por loja: rating (letra + nota + fatores — SEM os alertas
 * internos), boletos (histórico completo, paginado — mesmo visual da /boletos
 * da cobrança) e obrigações (com link público de responder).
 * Boleto em dia → 2ª via (PDF). Boleto vencido → TRATAR (mesma página dos
 * e-mails de cobrança; a resposta cai na fila normal de tratativas).
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
  type RatingFin,
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

function LetraRating({ letra, size = 28 }: { letra: string; size?: number }) {
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

function RatingCard({ rating }: { rating: RatingFin }) {
  const [aberto, setAberto] = useState(false);
  if (!rating?.letra) {
    return (
      <div className="text-xs text-slate-400">
        Rating ainda não calculado para esta loja.
      </div>
    );
  }
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2">
        <LetraRating letra={rating.letra} />
        <div>
          <div className="font-semibold text-slate-700">
            Rating {rating.letra}
            {rating.nota != null && (
              <span className="text-slate-400 font-normal"> · {rating.nota}/100</span>
            )}
          </div>
          <button
            className="text-xs text-brand-600 hover:underline"
            onClick={() => setAberto(!aberto)}
          >
            {aberto ? "esconder detalhes" : "como essa nota é formada?"}
          </button>
        </div>
      </div>
      {aberto && (
        <div className="mt-2 space-y-1 text-xs">
          {rating.componentes.map((c, i) => (
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
      )}
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

export default function FinanceiroPage() {
  const [lojas, setLojas] = useState<LojaFinanceiro[]>([]);
  const [disponivel, setDisponivel] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [lojaSel, setLojaSel] = useState<number | null>(null);

  useEffect(() => {
    financeiroMinhasLojas()
      .then((r) => {
        setDisponivel(r.disponivel);
        setLojas(r.lojas);
        if (r.lojas.length > 0) setLojaSel(r.lojas[0].loja_id);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"))
      .finally(() => setCarregando(false));
  }, []);

  const loja = lojas.find((l2) => l2.loja_id === lojaSel) ?? null;

  return (
    <Shell title="Financeiro">
      <div className="max-w-5xl">
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
            {lojas.length > 1 && (
              <div className="flex gap-1 flex-wrap mb-3">
                {lojas.map((l2) => (
                  <button
                    key={l2.loja_id}
                    onClick={() => setLojaSel(l2.loja_id)}
                    className={`rounded px-2 py-1 text-xs font-medium border ${
                      l2.loja_id === lojaSel
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {l2.rating?.letra ? `${l2.rating.letra} · ` : ""}
                    {l2.nome || l2.sigla}
                  </button>
                ))}
              </div>
            )}
            {loja && <LojaFinanceiroView key={loja.loja_id} loja={loja} />}
          </>
        )}
      </div>
    </Shell>
  );
}

function LojaFinanceiroView({ loja }: { loja: LojaFinanceiro }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-bold text-slate-800">{loja.nome || loja.sigla}</div>
          <div className="text-xs text-slate-400 font-mono">{loja.sigla}</div>
        </div>
        <RatingCard rating={loja.rating} />
      </div>
      <BoletosDaLoja lojaId={loja.loja_id} />
      <ObrigacoesDaLoja lojaId={loja.loja_id} />
    </div>
  );
}

function BoletosDaLoja({ lojaId }: { lojaId: number }) {
  const [situacao, setSituacao] = useState("todos");
  const [offset, setOffset] = useState(0);
  const [pagina, setPagina] = useState<PaginaFin<BoletoFin> | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [tratandoId, setTratandoId] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    financeiroBoletos(lojaId, situacao, PAGE_SIZE, offset)
      .then((r) => { setPagina(r); setErro(""); })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"))
      .finally(() => setCarregando(false));
  }, [lojaId, situacao, offset]);

  async function tratar(b: BoletoFin) {
    setTratandoId(b.id);
    try {
      const { url } = await financeiroTratarBoleto(lojaId, b.id);
      window.open(url, "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao gerar o link de tratamento.");
    } finally {
      setTratandoId(null);
    }
  }

  return (
    <section className="card p-3">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="font-semibold text-slate-700">Boletos</h2>
        <div className="flex gap-1">
          {[["todos", "Todos"], ["pendentes", "Pendentes"], ["pagos", "Pagos"]].map(
            ([v, rotulo]) => (
              <button
                key={v}
                onClick={() => { setSituacao(v); setOffset(0); }}
                className={`rounded px-2 py-1 text-xs font-medium border ${
                  situacao === v
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {rotulo}
              </button>
            ),
          )}
        </div>
      </div>
      {erro && <div className="text-sm text-red-600 mb-2">{erro}</div>}
      {carregando ? (
        <div className="text-sm text-slate-400">Carregando…</div>
      ) : !pagina || pagina.itens.length === 0 ? (
        <div className="text-sm text-slate-400">Nenhum boleto aqui.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
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
                            href={financeiroPdfUrl(lojaId, b.id)}
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

function ObrigacoesDaLoja({ lojaId }: { lojaId: number }) {
  const [offset, setOffset] = useState(0);
  const [pagina, setPagina] = useState<PaginaFin<ObrigacaoFin> | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    financeiroObrigacoes(lojaId, PAGE_SIZE, offset)
      .then((r) => { setPagina(r); setErro(""); })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"))
      .finally(() => setCarregando(false));
  }, [lojaId, offset]);

  return (
    <section className="card p-3">
      <h2 className="font-semibold text-slate-700 mb-2">Obrigações</h2>
      {erro && <div className="text-sm text-red-600 mb-2">{erro}</div>}
      {carregando ? (
        <div className="text-sm text-slate-400">Carregando…</div>
      ) : !pagina || pagina.itens.length === 0 ? (
        <div className="text-sm text-slate-400">Nenhuma obrigação aqui.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
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
