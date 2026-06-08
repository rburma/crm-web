"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { ficha360, fmtData, type Ficha } from "@/lib/api";

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{rotulo}</div>
      <div className="text-sm text-slate-800 break-words">{valor || "—"}</div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-slate-700 mb-3">{titulo}</div>
      {children}
    </div>
  );
}

// Idade atual a partir de "dd/mm/aaaa" ou "aaaa-mm-dd".
function calcIdade(nasc: string | null): string {
  if (!nasc) return "—";
  const br = nasc.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const iso = nasc.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let d: Date | null = null;
  if (br) d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  else if (iso) d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (!d || isNaN(d.getTime())) return "—";
  const h = new Date();
  let i = h.getFullYear() - d.getFullYear();
  const m = h.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < d.getDate())) i--;
  return i >= 0 && i < 130 ? `${i} anos` : "—";
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

  const atr = (f?.atributos || {}) as Record<string, unknown>;
  const av = (k: string): string | null => {
    const v = atr[k];
    return v != null && String(v).trim() !== "" ? String(v) : null;
  };
  const estado = av("uf") || f?.uf || null;
  const temEndereco = !!(av("endereco") || av("bairro") || av("cidade") || estado || av("cep") || av("loja_proxima"));
  // Primeiro atendimento = mais antigo da lista carregada (newest-first -> ultimo).
  const primeiro = f && f.atendimentos.length
    ? f.atendimentos[f.atendimentos.length - 1].criado_em
    : null;

  return (
    <Shell title="Ficha do cliente">
      <div className="max-w-5xl">
        <Link href="/clientes" className="text-sm text-slate-500 hover:underline">
          ← Voltar para a busca
        </Link>

        {loading && <div className="text-slate-400 mt-6">Carregando…</div>}
        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mt-4">{erro}</div>
        )}

        {f && (
          <div className="mt-4 space-y-5">
            {/* Cabecalho + Contato */}
            <div className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{f.nome || "(sem nome)"}</h2>
                  <div className="text-sm text-slate-500 mt-0.5">{f.email || "sem e-mail"}</div>
                </div>
                <span className="badge-blue">{f.total_atendimentos} atendimento(s)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                <Campo rotulo="E-mail" valor={f.email} />
                <Campo rotulo="Telefone" valor={f.telefone} />
                <Campo rotulo="CPF" valor={f.cpf} />
                <Campo rotulo="Nascimento" valor={f.nascimento} />
                <Campo rotulo="Idade" valor={calcIdade(f.nascimento)} />
                <Campo rotulo="Primeiro atendimento" valor={fmtData(primeiro)} />
              </div>
            </div>

            {/* Endereco */}
            {temEndereco && (
              <Bloco titulo="Endereço">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Campo rotulo="Rua e número" valor={av("endereco")} />
                  <Campo rotulo="Bairro" valor={av("bairro")} />
                  <Campo rotulo="Cidade" valor={av("cidade")} />
                  <Campo rotulo="Estado" valor={estado} />
                  <Campo rotulo="CEP" valor={av("cep")} />
                  <Campo rotulo="Loja mais próxima" valor={av("loja_proxima")} />
                </div>
              </Bloco>
            )}

            {/* Enriquecimento */}
            <Bloco titulo="Enriquecimento">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Campo rotulo="Esporte" valor={av("esporte")} />
                <Campo rotulo="Tamanho do tênis" valor={av("tamanho")} />
              </div>
              {f.clubes.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-slate-400 mb-1">Clubes</div>
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
              <div className="mt-3 text-xs text-slate-400 italic">
                Enriquecimento por IA (perfil, interesses, propensão) — em breve.
              </div>
            </Bloco>

            {/* Atendimentos (Data, Assunto, Status — mais recente primeiro) */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--line)] text-sm font-semibold text-slate-700">
                Atendimentos
              </div>
              {f.atendimentos.length === 0 ? (
                <div className="px-5 py-4 text-sm text-slate-400">Nenhum atendimento.</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-[var(--line)]">
                    <tr>
                      <th className="th w-28">Data</th>
                      <th className="th">Assunto</th>
                      <th className="th w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {f.atendimentos.map((a) => (
                      <tr key={a.id} className="row-link">
                        <td className="td text-slate-500 whitespace-nowrap">{fmtData(a.criado_em)}</td>
                        <td className="td">
                          <Link
                            href={`/atendimentos/${a.id}`}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {a.assunto || `Atendimento ${a.numero}`}
                          </Link>
                        </td>
                        <td className="td">
                          <span className={"badge-" + (a.status === "encerrada" ? "gray" : a.status === "em_espera" ? "amber" : "green")}>
                            {a.status}
                          </span>
                        </td>
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
