"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { minhasObrigacoes, type ObrigacaoLojaItem } from "@/lib/api";

function fmt(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

/** Obrigações abertas (lidas do sistema de cobrança, só-leitura) das lojas do
 *  escopo do usuário: a loja vê as suas; o franqueado vê as das suas lojas. */
export default function ObrigacoesPage() {
  const [itens, setItens] = useState<ObrigacaoLojaItem[]>([]);
  const [disponivel, setDisponivel] = useState(true);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    minhasObrigacoes()
      .then((r) => {
        setDisponivel(r.disponivel);
        setItens(r.itens);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, []);

  const hoje = new Date().toISOString().slice(0, 10);
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const arr = t
      ? itens.filter((i) =>
          [i.loja_nome, i.sigla, i.titulo, i.tipo].some((v) =>
            (v ?? "").toLowerCase().includes(t),
          ),
        )
      : itens;
    return [...arr].sort((a, b) =>
      (a.vencimento ?? "9999").localeCompare(b.vencimento ?? "9999"),
    );
  }, [itens, q]);

  const atrasadas = filtrados.filter((i) => i.vencimento != null && i.vencimento < hoje).length;

  return (
    <Shell title="Obrigações">
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            className="input w-72"
            placeholder="Buscar loja, sigla, título…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="ml-auto text-xs text-slate-400">
            {filtrados.length} aberta(s)
            {atrasadas > 0 ? ` · ${atrasadas} vencida(s)` : ""}
          </span>
        </div>

        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-4">{erro}</div>
        )}

        {!disponivel && !loading ? (
          <div className="card p-6 text-sm text-slate-500">
            A integração com o sistema de cobrança ainda não está ligada — sem obrigações para
            mostrar.
          </div>
        ) : loading ? (
          <div className="text-sm text-slate-400">Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-400">
            Nenhuma obrigação aberta. 🎉
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((i, idx) => {
              const atrasada = i.vencimento != null && i.vencimento < hoje;
              return (
                <div key={idx} className="card px-4 py-3 flex items-center gap-3">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-700 truncate">
                      {i.titulo || "—"}
                    </span>
                    <span className="block text-xs text-slate-400 truncate">
                      {i.loja_nome}
                      {i.sigla ? ` · ${i.sigla}` : ""}
                    </span>
                  </span>
                  {i.tipo ? (
                    <span className="badge-gray text-[10px] shrink-0">{i.tipo}</span>
                  ) : null}
                  <span
                    className={`text-xs shrink-0 tabular-nums ${
                      atrasada ? "text-red-600 font-semibold" : "text-slate-500"
                    }`}
                  >
                    {atrasada ? "venceu " : "vence "}
                    {fmt(i.vencimento)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
