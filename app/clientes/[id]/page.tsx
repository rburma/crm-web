"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { ficha360, fmtData, statusBadge, type Ficha } from "@/lib/api";

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{rotulo}</div>
      <div className="text-sm text-slate-800">{valor || "—"}</div>
    </div>
  );
}

export default function FichaPage({ params }: { params: { id: string } }) {
  const [f, setF] = useState<Ficha | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      try {
        const d = await ficha360(params.id);
        if (vivo) setF(d);
      } catch (err) {
        if (vivo) setErro(err instanceof Error ? err.message : "Erro");
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [params.id]);

  return (
    <Shell title="Ficha do cliente">
      <div className="max-w-5xl">
        <Link href="/clientes" className="text-sm text-slate-500 hover:underline">
          ← Voltar para a busca
        </Link>

        {loading && <div className="text-slate-400 mt-6">Carregando…</div>}
        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mt-4">
            {erro}
          </div>
        )}

        {f && (
          <div className="mt-4 space-y-5">
            {/* Cabecalho */}
            <div className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {f.nome || "(sem nome)"}
                  </h2>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {f.email || "sem e-mail"}
                  </div>
                </div>
                <span className="badge-blue">{f.total_atendimentos} atendimento(s)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                <Campo rotulo="CPF" valor={f.cpf} />
                <Campo rotulo="Telefone" valor={f.telefone} />
                <Campo rotulo="UF" valor={f.uf} />
                <Campo rotulo="Nascimento" valor={f.nascimento} />
                <Campo rotulo="Cliente desde" valor={fmtData(f.criado_em)} />
              </div>
            </div>

            {/* Clubes */}
            {f.clubes.length > 0 && (
              <div className="card p-5">
                <div className="text-sm font-semibold text-slate-700 mb-2">Clubes</div>
                <div className="flex flex-wrap gap-2">
                  {f.clubes.map((c) => (
                    <span key={c.vinculo_id} className="badge-gray">
                      {c.clube_nome}
                      {c.nivel ? ` · ${c.nivel}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Atendimentos */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--line)] text-sm font-semibold text-slate-700">
                Atendimentos
              </div>
              {f.atendimentos.length === 0 ? (
                <div className="px-5 py-4 text-sm text-slate-400">
                  Nenhum atendimento.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-[var(--line)]">
                    <tr>
                      <th className="th">Assunto</th>
                      <th className="th w-28">Status</th>
                      <th className="th w-28">Aberto em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {f.atendimentos.map((a) => (
                      <tr key={a.id} className="row-link">
                        <td className="td">
                          <Link
                            href={`/atendimentos/${a.id}`}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {a.assunto || `Atendimento ${a.numero}`}
                          </Link>
                        </td>
                        <td className="td">
                          <span className={statusBadge(a.status)}>{a.status}</span>
                        </td>
                        <td className="td text-slate-500">{fmtData(a.criado_em)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
