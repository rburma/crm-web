"use client";

import { useState } from "react";
import { consultaIA, type ConsultaIAResult } from "@/lib/api";

// Painel abre-fecha (admin) para consultas ad-hoc ao banco em linguagem natural.
// Discreto e fechado por padrão — não atrapalha o visual. A consulta é SOMENTE
// LEITURA no backend (transação read-only + SELECT-only + limite + timeout).
export default function ChatIA() {
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<ConsultaIAResult | null>(null);

  async function perguntar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!pergunta.trim()) return;
    setLoading(true);
    setErro("");
    setRes(null);
    try {
      setRes(await consultaIA(pergunta.trim()));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  function baixarCsv() {
    if (!res) return;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [res.colunas.map(esc).join(","), ...res.linhas.map((l) => l.map(esc).join(","))];
    const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "consulta_ia.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
        title="Consultas ad-hoc ao banco (somente leitura, admin)"
      >
        <span>{aberto ? "▼" : "▶"}</span> 🤖 Consultar com IA <span className="text-slate-400">(admin · só leitura)</span>
      </button>

      {aberto && (
        <div className="card p-4 mt-2 bg-slate-50/60">
          <form onSubmit={perguntar} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Ex.: quantos atendimentos por marca em 2014? top 10 cidades dos clientes?"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
            />
            <button className="btn-primary whitespace-nowrap" disabled={loading}>
              {loading ? "Consultando…" : "Perguntar"}
            </button>
          </form>
          <p className="text-[11px] text-slate-400 mt-1">
            Para perguntas pontuais. A IA gera uma consulta <b>somente leitura</b> — nunca altera dados. Confira o SQL abaixo.
          </p>

          {erro && (
            <div className="card border-red-200 bg-red-50 text-red-700 p-2 text-sm mt-3">{erro}</div>
          )}

          {res && (
            <div className="mt-3 space-y-2">
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer">SQL gerado</summary>
                <pre className="mt-1 p-2 bg-slate-100 rounded overflow-x-auto whitespace-pre-wrap text-[11px]">{res.sql}</pre>
              </details>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{res.n} linha(s){res.n >= 500 ? " (limite 500)" : ""}</span>
                {res.n > 0 && (
                  <button type="button" className="text-brand-700 hover:underline" onClick={baixarCsv}>
                    Exportar CSV
                  </button>
                )}
              </div>
              {res.n > 0 && (
                <div className="card overflow-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-[var(--line)] sticky top-0">
                      <tr>
                        {res.colunas.map((c) => (
                          <th key={c} className="th whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {res.linhas.map((linha, i) => (
                        <tr key={i}>
                          {linha.map((cel, j) => (
                            <td key={j} className="td whitespace-nowrap">{cel === null ? "—" : String(cel)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
