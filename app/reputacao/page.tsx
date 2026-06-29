"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { me, reputacaoMatriz, reputacaoSyncGoogleTodas, type ReputacaoMatriz } from "@/lib/api";

const GLOBAIS = ["admin", "rede", "matriz"];

export default function ReputacaoPage() {
  const [data, setData] = useState<ReputacaoMatriz | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sync, setSync] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      setData(await reputacaoMatriz());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    carregar();
  }, []);
  useEffect(() => {
    me().then((u) => setIsAdmin(GLOBAIS.includes(u.papel))).catch(() => setIsAdmin(false));
  }, []);

  async function atualizarTodas() {
    setSync(true);
    setErro("");
    setMsg("");
    try {
      const r = await reputacaoSyncGoogleTodas();
      if (r.erro) setErro(r.erro);
      else setMsg(`Google: ${r.ok} loja(s) ok, ${r.falhas} sem nota.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setSync(false);
    }
  }

  const redes = data?.redes ?? [];
  const lojas = data?.lojas ?? [];

  return (
    <Shell title="Reputação / Avaliações">
      <div className="space-y-4">
        {erro && <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm">{erro}</div>}
        {msg && <div className="card border-green-200 bg-green-50 text-green-700 p-3 text-sm">{msg}</div>}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-500">
            Nota por rede (clique p/ abrir a rede). Total = média ponderada (peso × nº avaliações).
          </p>
          {isAdmin && (
            <button className="btn-primary text-sm whitespace-nowrap" onClick={atualizarTodas} disabled={sync}>
              {sync ? "Atualizando…" : "🔄 Atualizar Google (todas)"}
            </button>
          )}
        </div>
        <div className="card overflow-x-auto">
          <table className="text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-[var(--line)]">
              <tr>
                <th className="th sticky left-0 bg-slate-50 z-10 text-left">Loja</th>
                {redes.map((r) => (
                  <th key={r} className="th text-center px-2">{r}</th>
                ))}
                <th className="th text-center px-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {lojas.map((l) => (
                <tr key={l.loja_id}>
                  <td className="td sticky left-0 bg-white z-10">
                    <span className="text-xs text-slate-400">{l.sigla || ""}</span> {l.nome || `Loja ${l.loja_id}`}
                  </td>
                  {redes.map((r) => {
                    const c = l.redes[r];
                    return (
                      <td key={r} className="td text-center px-2">
                        {c ? (
                          c.link ? (
                            <a
                              href={c.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-700 hover:underline"
                              title={`${c.qtd} avaliações`}
                            >
                              {c.nota.toFixed(1)}
                            </a>
                          ) : (
                            <span title={`${c.qtd} avaliações`}>{c.nota.toFixed(1)}</span>
                          )
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="td text-center px-2 font-semibold text-amber-600">
                    {l.total != null ? l.total.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
              {!loading && lojas.length === 0 && (
                <tr>
                  <td className="td text-slate-400" colSpan={redes.length + 2}>
                    Nenhuma reputação ainda. Use "Atualizar Google (todas)" ou cadastre os links.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
