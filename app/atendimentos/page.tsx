"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Pager from "@/components/Pager";
import ColunasConfig from "@/components/ColunasConfig";
import SlaBadge from "@/components/SlaBadge";
import { useSelecao } from "@/lib/useSelecao";
import {
  atendimentosEmLote,
  fmtData,
  listarAtendimentos,
  listarMarcas,
  obterPreferencia,
  statusBadge,
  type AtendimentoItem,
  type MarcaItem,
} from "@/lib/api";

const PAGE = 50;

// Catálogo de colunas da lista de atendimentos (o que pode ser exibido).
const COLS_ATEND: {
  key: string;
  label: string;
  th?: string;
  render: (a: AtendimentoItem) => React.ReactNode;
}[] = [
  { key: "numero", label: "Nº", th: "th w-20", render: (a) => <span className="text-slate-500">#{a.numero}</span> },
  {
    key: "assunto",
    label: "Assunto",
    render: (a) => (
      <Link href={`/atendimentos/${a.id}`} className="font-medium text-brand-700 hover:underline">
        {a.assunto || `Atendimento ${a.numero}`}
      </Link>
    ),
  },
  { key: "cliente", label: "Cliente", render: (a) => <span className="text-slate-600">{a.cliente || "—"}</span> },
  { key: "marca", label: "Marca", render: (a) => <span className="text-slate-600">{a.marca || "—"}</span> },
  { key: "loja", label: "Loja", render: (a) => <span className="text-slate-600">{a.loja || "—"}</span> },
  { key: "status", label: "Status", th: "th w-28", render: (a) => <span className={statusBadge(a.status)}>{a.status}</span> },
  { key: "sla", label: "Prazo (SLA)", th: "th w-32", render: (a) => <SlaBadge venceEm={a.vence_em} alertaEm={a.alerta_em} /> },
  { key: "data", label: "Aberto em", th: "th w-28", render: (a) => <span className="text-slate-500">{fmtData(a.criado_em)}</span> },
];
const COLS_ATEND_DEFAULT = ["assunto", "cliente", "status", "sla", "data"];
const COLS_ATEND_KEYS = COLS_ATEND.map((c) => c.key);

export default function AtendimentosPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [marcas, setMarcas] = useState<MarcaItem[]>([]);
  const [items, setItems] = useState<AtendimentoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [cols, setCols] = useState<string[]>(COLS_ATEND_DEFAULT);

  // seleção + ações em massa
  const selec = useSelecao(items, (a) => String(a.id));
  const [bulkStatus, setBulkStatus] = useState("encerrada");
  const [bulkMarca, setBulkMarca] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);

  async function aplicarBulk(acao: "status" | "marca", valor: string, rotulo: string) {
    const ids = selec.ids.map(Number);
    if (!ids.length) return;
    if (!window.confirm(`${rotulo} em ${ids.length} atendimento(s)?`)) return;
    setBulkBusy(true);
    setErro("");
    setMsg("");
    try {
      const r = await atendimentosEmLote(ids, acao, valor);
      let m = `${r.ok} atendimento(s) atualizado(s).`;
      if (r.falhas.length) m += ` ${r.falhas.map((f) => f.motivo).join("; ")}.`;
      setMsg(m);
      selec.limpar();
      await carregar(page);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro na ação em massa");
    } finally {
      setBulkBusy(false);
    }
  }

  async function carregar(pg: number, size = pageSize) {
    setLoading(true);
    setErro("");
    try {
      const r = await listarAtendimentos({
        q: q.trim() || undefined,
        status: status || undefined,
        marcaId,
        limit: size,
        offset: pg * size,
      });
      setItems(r.items);
      setTotal(r.total);
      setPage(pg);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // Nova busca/filtro sempre volta para a 1ª página.
  function buscar() {
    return carregar(0);
  }

  // Carrega marcas (filtro) + os atendimentos mais recentes na 1a abertura.
  useEffect(() => {
    listarMarcas().then(setMarcas).catch(() => {});
    obterPreferencia<{ cols?: string[] }>("cols_atendimentos")
      .then((v) => {
        const ok = (v.cols || []).filter((k) => COLS_ATEND_KEYS.includes(k));
        if (ok.length) setCols(ok);
      })
      .catch(() => {});
    carregar(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell title="Atendimentos">
      <div className="max-w-5xl">
        <div className="flex justify-end items-center gap-2 mb-3">
          <ColunasConfig
            chave="cols_atendimentos"
            todas={COLS_ATEND.map((c) => ({ key: c.key, label: c.label }))}
            value={cols}
            onChange={setCols}
          />
          <Link href="/atendimentos/novo" className="btn-primary text-sm">
            ＋ Novo atendimento
          </Link>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
          className="flex flex-wrap gap-2 mb-5"
        >
          <input
            className="input flex-1 min-w-[220px]"
            placeholder="Buscar por assunto ou nome do cliente…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input w-44"
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
          <select
            className="input w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="aberta">Aberta</option>
            <option value="em_espera">Em espera</option>
            <option value="encerrada">Encerrada</option>
          </select>
          <button className="btn-primary whitespace-nowrap" disabled={loading}>
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-4">
            {erro}
          </div>
        )}
        {msg && (
          <div className="card border-green-200 bg-green-50 text-green-700 p-3 text-sm mb-4">
            {msg}
          </div>
        )}

        {/* Barra de ações em massa */}
        {selec.count > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 mb-3 text-sm">
            <span className="text-blue-800 font-medium">{selec.count} selecionado(s)</span>
            <span className="text-slate-300">·</span>
            <select className="input py-1 text-xs w-32" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} disabled={bulkBusy}>
              <option value="aberta">Aberta</option>
              <option value="em_espera">Em espera</option>
              <option value="encerrada">Encerrada</option>
            </select>
            <button className="btn-ghost" disabled={bulkBusy} onClick={() => aplicarBulk("status", bulkStatus, `Definir status "${bulkStatus}"`)}>
              Aplicar status
            </button>
            <span className="text-slate-300">·</span>
            <select className="input py-1 text-xs w-40" value={bulkMarca} onChange={(e) => setBulkMarca(e.target.value)} disabled={bulkBusy}>
              <option value="">(escolha a marca…)</option>
              {marcas.map((m) => <option key={m.id} value={m.id}>{m.nome || m.slug}</option>)}
            </select>
            <button className="btn-ghost" disabled={bulkBusy || !bulkMarca} onClick={() => aplicarBulk("marca", bulkMarca, "Definir marca")}>
              Aplicar marca
            </button>
            <span className="text-slate-300">·</span>
            <button className="btn-ghost" disabled={bulkBusy} onClick={selec.limpar}>Limpar</button>
            <span className="text-xs text-slate-400 ml-auto">dica: clique e Shift+clique para um intervalo</span>
          </div>
        )}

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-[var(--line)]">
              <tr>
                <th className="th w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selec.todosDaPagina}
                    onChange={selec.toggleAll}
                    title="Selecionar todos desta página"
                  />
                </th>
                {cols.map((k) => {
                  const c = COLS_ATEND.find((x) => x.key === k);
                  if (!c) return null;
                  return (
                    <th key={k} className={c.th || "th"}>
                      {c.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading && (
                <tr>
                  <td className="td text-slate-400" colSpan={cols.length + 1}>
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td className="td text-slate-400" colSpan={cols.length + 1}>
                    Nenhum atendimento.
                  </td>
                </tr>
              )}
              {items.map((a, idx) => (
                <tr key={a.id} className={selec.tem(String(a.id)) ? "bg-blue-50/40" : "row-link"}>
                  <td className="td">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selec.tem(String(a.id))}
                      onClick={(e) => selec.toggleAt(idx, e.shiftKey)}
                      onChange={() => { /* tratado em onClick */ }}
                    />
                  </td>
                  {cols.map((k) => {
                    const c = COLS_ATEND.find((x) => x.key === k);
                    if (!c) return null;
                    return (
                      <td key={k} className="td">
                        {c.render(a)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pager
          page={page}
          pageSize={pageSize}
          total={total}
          loading={loading}
          onPage={carregar}
          onPageSize={(n) => { setPageSize(n); carregar(0, n); }}
        />
      </div>
    </Shell>
  );
}
