"use client";

import Link from "next/link";
import { useState } from "react";
import Shell from "@/components/Shell";
import { buscarClientes, type ClienteResumo } from "@/lib/api";

export default function ClientesPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ClienteResumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [buscou, setBuscou] = useState(false);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setErro("");
    setBuscou(true);
    try {
      setRows(await buscarClientes(q.trim(), 50));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao buscar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Clientes">
      <div className="max-w-5xl">
        <form onSubmit={buscar} className="flex gap-2 mb-5">
          <input
            className="input"
            placeholder="Buscar por nome, CPF, telefone ou e-mail…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
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
                <th className="th">Nome</th>
                <th className="th">Contato</th>
                <th className="th w-20">UF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading && (
                <tr>
                  <td className="td text-slate-400" colSpan={3}>
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && buscou && rows.length === 0 && (
                <tr>
                  <td className="td text-slate-400" colSpan={3}>
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
              {!loading && !buscou && (
                <tr>
                  <td className="td text-slate-400" colSpan={3}>
                    Digite um termo e busque — entre 334 mil clientes.
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="row-link">
                  <td className="td">
                    <Link
                      href={`/clientes/${c.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {c.nome || "(sem nome)"}
                    </Link>
                  </td>
                  <td className="td text-slate-600">
                    <div>{c.email || "—"}</div>
                    <div className="text-xs text-slate-400">
                      {[c.telefone, c.cpf ? `CPF ${c.cpf}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="td">
                    <span className="badge-gray">{c.uf || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="text-xs text-slate-400 mt-3">
            {rows.length} resultado(s) — clique no nome para abrir a ficha 360.
          </div>
        )}
      </div>
    </Shell>
  );
}
