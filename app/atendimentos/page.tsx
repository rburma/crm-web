"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import {
  fmtData,
  listarAtendimentos,
  statusBadge,
  type AtendimentoItem,
} from "@/lib/api";

export default function AtendimentosPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AtendimentoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const r = await listarAtendimentos({
        q: q.trim() || undefined,
        status: status || undefined,
        limit: 50,
      });
      setItems(r.items);
      setTotal(r.total);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Carrega os mais recentes na 1a abertura.
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell title="Atendimentos">
      <div className="max-w-5xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            carregar();
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

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-[var(--line)]">
              <tr>
                <th className="th">Assunto</th>
                <th className="th">Cliente</th>
                <th className="th w-28">Status</th>
                <th className="th w-28">Aberto em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading && (
                <tr>
                  <td className="td text-slate-400" colSpan={4}>
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td className="td text-slate-400" colSpan={4}>
                    Nenhum atendimento.
                  </td>
                </tr>
              )}
              {items.map((a) => (
                <tr key={a.id} className="row-link">
                  <td className="td">
                    <Link
                      href={`/atendimentos/${a.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {a.assunto || `Atendimento ${a.numero}`}
                    </Link>
                    {a.marca && (
                      <span className="text-xs text-slate-400"> · {a.marca}</span>
                    )}
                  </td>
                  <td className="td text-slate-600">{a.cliente || "—"}</td>
                  <td className="td">
                    <span className={statusBadge(a.status)}>{a.status}</span>
                  </td>
                  <td className="td text-slate-500">{fmtData(a.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-400 mt-3">
          {total.toLocaleString("pt-BR")} atendimento(s) no total — mostrando até 50.
        </div>
      </div>
    </Shell>
  );
}
