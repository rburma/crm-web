"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Pager from "@/components/Pager";
import {
  fmtData,
  listarAvaliacoes,
  listarMarcas,
  reabrirAvaliacao,
  responderAvaliacao,
  tratarAvaliacao,
  type AvaliacaoLinha,
  type MarcaItem,
} from "@/lib/api";

const PAGE = 50;

function Estrelas({ media }: { media: number | null }) {
  if (media == null) return <span className="text-slate-300 text-sm shrink-0">— ☆</span>;
  const cheias = Math.min(5, Math.max(0, Math.round(media)));
  return (
    <span className="text-sm shrink-0 tabular-nums" title={`${media} de 5`}>
      <span className="text-amber-500">{"★".repeat(cheias)}</span>
      <span className="text-slate-300">{"★".repeat(5 - cheias)}</span>
      <span className="text-slate-500 ml-1">
        {media.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </span>
    </span>
  );
}

export default function AvaliacoesPage() {
  const [items, setItems] = useState<AvaliacaoLinha[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [marcas, setMarcas] = useState<MarcaItem[]>([]);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [status, setStatus] = useState("pendente");
  const [aberto, setAberto] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [resp, setResp] = useState<Record<number, string>>({});

  async function carregar(p = 0, ps = pageSize) {
    setLoading(true);
    setErro("");
    try {
      const r = await listarAvaliacoes({ marcaId, status, limit: ps, offset: p * ps });
      setItems(r.items);
      setTotal(r.total);
      setPage(p);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    listarMarcas().then(setMarcas).catch(() => {});
  }, []);
  useEffect(() => {
    carregar(0, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcaId, status]);

  function toggle(id: number) {
    setAberto((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function acao(id: number, tratar: boolean) {
    setBusy(id);
    setErro("");
    try {
      if (tratar) await tratarAvaliacao(id);
      else await reabrirAvaliacao(id);
      await carregar(page, pageSize);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  async function responder(id: number) {
    const txt = (resp[id] || "").trim();
    if (!txt) return;
    setBusy(id);
    setErro("");
    try {
      await responderAvaliacao(id, txt);
      setResp((r) => {
        const n = { ...r };
        delete n[id];
        return n;
      });
      await carregar(page, pageSize);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell title="Avaliações">
      <div className="max-w-4xl">
        <div className="flex flex-wrap gap-2 mb-4">
          <select
            className="input w-48"
            value={marcaId ?? ""}
            onChange={(e) => setMarcaId(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">Todas as marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome || m.slug}
              </option>
            ))}
          </select>
          <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pendente">Pendentes</option>
            <option value="tratada">Tratadas</option>
            <option value="todas">Todas</option>
          </select>
          <span className="ml-auto self-center text-xs text-slate-400">{total} avaliação(ões)</span>
        </div>

        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-4">{erro}</div>
        )}

        {loading ? (
          <div className="text-sm text-slate-400">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-400">Nenhuma avaliação.</div>
        ) : (
          <div className="space-y-2">
            {items.map((a) => (
              <div key={a.id} className="card overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50"
                  onClick={() => toggle(a.id)}
                >
                  <Estrelas media={a.media} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-700 truncate">
                      {a.loja || a.marca || "—"}
                      {a.cliente ? ` · ${a.cliente}` : ""}
                    </span>
                    {a.comentario ? (
                      <span className="block text-xs text-slate-400 truncate">“{a.comentario}”</span>
                    ) : null}
                  </span>
                  {a.com_compra ? <span className="badge-green text-[10px] shrink-0">com compra</span> : null}
                  {a.tratada ? (
                    <span className="badge-gray text-[10px] shrink-0">tratada</span>
                  ) : (
                    <span className="badge-amber text-[10px] shrink-0">pendente</span>
                  )}
                  <span className="text-xs text-slate-400 shrink-0">{fmtData(a.criado_em)}</span>
                  <span className="text-slate-300 shrink-0">{aberto.has(a.id) ? "▾" : "▸"}</span>
                </div>
                {aberto.has(a.id) ? (
                  <div className="px-4 pb-3 pt-2 border-t border-slate-100">
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 mb-3">
                      {Object.entries(a.notas).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm">
                          <span className="text-slate-500 truncate pr-2">{k}</span>
                          <span className="text-amber-500 tabular-nums shrink-0">{v} ★</span>
                        </div>
                      ))}
                    </div>
                    {a.comentario ? (
                      <div className="text-sm text-slate-700 mb-2">“{a.comentario}”</div>
                    ) : null}
                    <div className="text-xs text-slate-400 mb-3">
                      {[a.marca, a.origem, a.verificada ? "verificada" : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                    {a.resposta ? (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 text-sm text-slate-700 mb-3">
                        <div className="text-[11px] text-emerald-700 font-medium mb-0.5">
                          Resposta da loja{a.respondida_em ? ` · ${fmtData(a.respondida_em)}` : ""}
                        </div>
                        {a.resposta}
                      </div>
                    ) : (
                      <div className="mb-3">
                        <textarea
                          className="input min-h-[60px] text-sm"
                          placeholder="Agradeça o cliente… (envia por e-mail se o SMTP estiver ligado)"
                          value={resp[a.id] ?? ""}
                          onChange={(e) => setResp((r) => ({ ...r, [a.id]: e.target.value }))}
                        />
                        <button
                          className="btn-primary text-xs mt-1.5"
                          disabled={busy === a.id || !(resp[a.id] || "").trim()}
                          onClick={() => responder(a.id)}
                        >
                          Responder e agradecer
                        </button>
                      </div>
                    )}
                    {a.tratada ? (
                      <button
                        className="btn-ghost text-xs"
                        disabled={busy === a.id}
                        onClick={() => acao(a.id, false)}
                      >
                        Reabrir
                      </button>
                    ) : (
                      <button
                        className="btn-primary text-xs"
                        disabled={busy === a.id}
                        onClick={() => acao(a.id, true)}
                      >
                        ✓ Encerrar (tratada)
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {total > 0 ? (
          <Pager
            page={page}
            pageSize={pageSize}
            total={total}
            loading={loading}
            onPage={(p) => carregar(p, pageSize)}
            onPageSize={(n) => { setPageSize(n); carregar(0, n); }}
          />
        ) : null}
      </div>
    </Shell>
  );
}
