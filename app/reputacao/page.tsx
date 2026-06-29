"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { me, reputacaoRanking, reputacaoSyncGoogleTodas, type ReputacaoRankItem } from "@/lib/api";

const GLOBAIS = ["admin", "rede", "matriz"];

export default function ReputacaoPage() {
  const [items, setItems] = useState<ReputacaoRankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sync, setSync] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const r = await reputacaoRanking();
      setItems(r.items);
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
      else setMsg(`Google atualizado: ${r.ok} loja(s) ok, ${r.falhas} sem nota/erro.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setSync(false);
    }
  }

  return (
    <Shell title="Reputação">
      <div className="max-w-4xl space-y-4">
        {erro && <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm">{erro}</div>}
        {msg && <div className="card border-green-200 bg-green-50 text-green-700 p-3 text-sm">{msg}</div>}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-500">Lojas por nota (o Google atualiza sozinho todo dia).</p>
          {isAdmin && (
            <button className="btn-primary text-sm whitespace-nowrap" onClick={atualizarTodas} disabled={sync}>
              {sync ? "Atualizando…" : "🔄 Atualizar Google (todas)"}
            </button>
          )}
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-[var(--line)]">
              <tr>
                <th className="th w-10">#</th>
                <th className="th w-24">Sigla</th>
                <th className="th">Loja</th>
                <th className="th w-24">Nota</th>
                <th className="th w-32">Avaliações</th>
                <th className="th w-20">Fontes</th>
                <th className="th w-24">Conferir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {items.map((it, i) => (
                <tr key={it.loja_id}>
                  <td className="td text-slate-400">{i + 1}</td>
                  <td className="td">{it.sigla || "—"}</td>
                  <td className="td">{it.nome || `Loja ${it.loja_id}`}</td>
                  <td className="td font-semibold text-amber-600">
                    {it.score != null ? `${it.score.toFixed(2)} ★` : "—"}
                  </td>
                  <td className="td text-slate-500">{it.qtd_avaliacoes}</td>
                  <td className="td text-slate-500">{it.qtd_veiculos}</td>
                  <td className="td">
                    {it.google_place_id ? (
                      <a
                        className="text-brand-700 hover:underline text-xs"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://www.google.com/maps/place/?q=place_id:${it.google_place_id}`}
                      >
                        ver no Google
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td className="td text-slate-400" colSpan={7}>
                    Nenhuma reputação ainda. Use "Atualizar Google (todas)".
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
