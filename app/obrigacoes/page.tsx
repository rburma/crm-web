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
 *  escopo do usuário. ORGANIZADAS POR LOJA (cabeçalho por loja) + filtro de loja,
 *  para quem vê várias não ver tudo misturado. A loja vê a sua; quem é admin de
 *  várias / de um departamento vê as do escopo, separadas por loja. */
export default function ObrigacoesPage() {
  const [itens, setItens] = useState<ObrigacaoLojaItem[]>([]);
  const [disponivel, setDisponivel] = useState(true);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [q, setQ] = useState("");
  const [lojaSel, setLojaSel] = useState<string>("todas");

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

  const lojas = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of itens) {
      const id = String(i.loja_id ?? i.sigla ?? "—");
      m.set(id, i.loja_nome || i.sigla || "—");
    }
    return [...m.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [itens]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return itens.filter((i) => {
      const id = String(i.loja_id ?? i.sigla ?? "—");
      if (lojaSel !== "todas" && id !== lojaSel) return false;
      if (!t) return true;
      return [i.loja_nome, i.sigla, i.titulo, i.tipo].some((v) =>
        (v ?? "").toLowerCase().includes(t),
      );
    });
  }, [itens, q, lojaSel]);

  const grupos = useMemo(() => {
    const g = new Map<string, { id: string; nome: string; itens: ObrigacaoLojaItem[] }>();
    for (const i of filtrados) {
      const id = String(i.loja_id ?? i.sigla ?? "—");
      if (!g.has(id)) g.set(id, { id, nome: i.loja_nome || i.sigla || "—", itens: [] });
      g.get(id)!.itens.push(i);
    }
    const arr = [...g.values()];
    for (const grp of arr) {
      grp.itens.sort((a, b) =>
        (a.vencimento ?? "9999").localeCompare(b.vencimento ?? "9999"),
      );
    }
    arr.sort((a, b) => a.nome.localeCompare(b.nome));
    return arr;
  }, [filtrados]);

  const atrasadas = filtrados.filter(
    (i) => i.vencimento != null && i.vencimento < hoje,
  ).length;

  return (
    <Shell title="Obrigações">
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            className="input w-64"
            placeholder="Buscar título, sigla…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input w-56"
            value={lojaSel}
            onChange={(e) => setLojaSel(e.target.value)}
          >
            <option value="todas">Todas as lojas ({lojas.length})</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-slate-400">
            {filtrados.length} aberta(s)
            {atrasadas > 0 ? ` · ${atrasadas} vencida(s)` : ""}
          </span>
        </div>

        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-4">
            {erro}
          </div>
        )}

        {!disponivel && !loading ? (
          <div className="card p-6 text-sm text-slate-500">
            A integração com o sistema de cobrança ainda não está ligada — sem
            obrigações para mostrar.
          </div>
        ) : loading ? (
          <div className="text-sm text-slate-400">Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-400">
            Nenhuma obrigação aberta. 🎉
          </div>
        ) : (
          <div className="space-y-5">
            {grupos.map((grp) => (
              <div key={grp.id}>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <h3 className="text-sm font-semibold text-slate-700">{grp.nome}</h3>
                  <span className="text-xs text-slate-400">{grp.itens.length}</span>
                </div>
                <div className="space-y-2">
                  {grp.itens.map((i, idx) => {
                    const atrasada = i.vencimento != null && i.vencimento < hoje;
                    return (
                      <div key={idx} className="card px-4 py-3 flex items-center gap-3">
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-slate-700 truncate">
                            {i.titulo || "—"}
                          </span>
                          {i.sigla ? (
                            <span className="block text-xs text-slate-400 truncate">
                              {i.sigla}
                            </span>
                          ) : null}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
