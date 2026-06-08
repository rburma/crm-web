"use client";

import Link from "next/link";
import { useState } from "react";
import Shell from "@/components/Shell";
import Pager from "@/components/Pager";
import { buscarClientes, mergeClientes, fmtTelefone, fmtCpf, type ClienteResumo } from "@/lib/api";

const PAGE = 50;

// Resultado da fusao client-side (preview): principal + preenche vazios dos outros.
function previa(principal: ClienteResumo, outros: ClienteResumo[]): ClienteResumo {
  const r: ClienteResumo = { ...principal };
  for (const o of outros) {
    if (!r.nome && o.nome) r.nome = o.nome;
    if (!r.cpf && o.cpf) r.cpf = o.cpf;
    if (!r.telefone && o.telefone) r.telefone = o.telefone;
    if (!r.email && o.email) r.email = o.email;
    if (!r.uf && o.uf) r.uf = o.uf;
  }
  return r;
}

export default function ClientesPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ClienteResumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [buscou, setBuscou] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [sel, setSel] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState(false);
  const [principalId, setPrincipalId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  const [msg, setMsg] = useState("");

  async function carregar(pg: number) {
    if (!q.trim()) return;
    setLoading(true);
    setErro("");
    setMsg("");
    setBuscou(true);
    setSel(new Set());
    try {
      const r = await buscarClientes(q.trim(), PAGE, pg * PAGE);
      setRows(r.items);
      setTotal(r.total);
      setPage(pg);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao buscar");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // Nova busca sempre volta para a 1ª página.
  function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    return carregar(0);
  }

  function toggle(id: number) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const selecionados = rows.filter((r) => sel.has(r.id));

  function abrirMerge() {
    setPrincipalId(selecionados[0]?.id ?? null);
    setModal(true);
  }

  async function confirmarMerge() {
    if (principalId == null) return;
    setMerging(true);
    setErro("");
    try {
      const r = await mergeClientes(principalId, Array.from(sel));
      setModal(false);
      setSel(new Set());
      setMsg(
        `Clientes fundidos. Sobreviveu #${r.principal.id} (${r.principal.nome || "sem nome"}) ` +
          `com ${r.total_atendimentos} atendimento(s).` +
          (r.ignorados.length ? ` Ignorados: ${r.ignorados.length}.` : "")
      );
      await buscar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao fundir");
    } finally {
      setMerging(false);
    }
  }

  const principal = selecionados.find((c) => c.id === principalId) || null;
  const outros = selecionados.filter((c) => c.id !== principalId);
  const merged = principal ? previa(principal, outros) : null;

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
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-4">{erro}</div>
        )}
        {msg && (
          <div className="card border-green-200 bg-green-50 text-green-700 p-3 text-sm mb-4">{msg}</div>
        )}

        {/* Barra de fusao */}
        {sel.size >= 1 && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-3 text-sm">
            <span className="text-blue-800">{sel.size} cliente(s) selecionado(s)</span>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setSel(new Set())}>
                Limpar
              </button>
              <button
                className="btn-primary"
                disabled={sel.size < 2}
                onClick={abrirMerge}
                title={sel.size < 2 ? "Selecione ao menos 2" : "Fundir os selecionados"}
              >
                Fundir {sel.size >= 2 ? `(${sel.size})` : ""}
              </button>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-[var(--line)]">
              <tr>
                <th className="th w-10"></th>
                <th className="th">Nome</th>
                <th className="th">Contato</th>
                <th className="th w-20">UF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading && (
                <tr><td className="td text-slate-400" colSpan={4}>Carregando…</td></tr>
              )}
              {!loading && buscou && rows.length === 0 && (
                <tr><td className="td text-slate-400" colSpan={4}>Nenhum cliente encontrado.</td></tr>
              )}
              {!loading && !buscou && (
                <tr><td className="td text-slate-400" colSpan={4}>Digite um termo e busque — entre 304 mil clientes.</td></tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className={sel.has(c.id) ? "bg-blue-50/40" : "row-link"}>
                  <td className="td">
                    <input
                      type="checkbox"
                      checked={sel.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="td">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.nome || "(sem nome)"}
                    </Link>
                  </td>
                  <td className="td text-slate-600">
                    <div>{c.email || "—"}</div>
                    <div className="text-xs text-slate-400">
                      {[c.telefone ? fmtTelefone(c.telefone) : "", c.cpf ? `CPF ${fmtCpf(c.cpf)}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="td"><span className="badge-gray">{c.uf || "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {buscou && total > 0 && (
          <>
            <Pager page={page} pageSize={PAGE} total={total} loading={loading} onPage={carregar} />
            <div className="text-xs text-slate-400 mt-1">
              Marque 2+ e clique “Fundir” para juntar duplicados.
            </div>
          </>
        )}
      </div>

      {/* Modal de fusao */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="card p-5 w-full max-w-2xl bg-white">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Fundir clientes</h3>
            <p className="text-sm text-slate-500 mb-4">
              Escolha qual cadastro <b>sobrevive</b>. Os campos vazios dele serão preenchidos
              pelos demais (repetidos ignorados), e <b>todo o histórico</b> (atendimentos,
              mensagens) vai para ele. Os outros são marcados como mesclados.
            </p>

            <div className="space-y-2 mb-4">
              {selecionados.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                    c.id === principalId ? "border-blue-400 bg-blue-50" : "border-[var(--line)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="principal"
                    checked={c.id === principalId}
                    onChange={() => setPrincipalId(c.id)}
                    className="mt-1"
                  />
                  <div className="text-sm">
                    <div className="font-medium text-slate-800">
                      {c.nome || "(sem nome)"} <span className="text-slate-400">#{c.id}</span>
                    </div>
                    <div className="text-slate-500 text-xs">
                      {[c.email, c.telefone ? fmtTelefone(c.telefone) : "", c.cpf ? `CPF ${fmtCpf(c.cpf)}` : "", c.uf]
                        .filter(Boolean)
                        .join(" · ") || "sem contato"}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {merged && (
              <div className="rounded-lg bg-slate-50 border border-[var(--line)] p-3 mb-4 text-sm">
                <div className="text-xs font-semibold text-slate-500 mb-2">Resultado da fusão</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-slate-400">Nome:</span> {merged.nome || "—"}</div>
                  <div><span className="text-slate-400">E-mail:</span> {merged.email || "—"}</div>
                  <div><span className="text-slate-400">Telefone:</span> {merged.telefone ? fmtTelefone(merged.telefone) : "—"}</div>
                  <div><span className="text-slate-400">CPF:</span> {merged.cpf ? fmtCpf(merged.cpf) : "—"}</div>
                  <div><span className="text-slate-400">UF:</span> {merged.uf || "—"}</div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setModal(false)} disabled={merging}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={confirmarMerge} disabled={merging || principalId == null}>
                {merging ? "Fundindo…" : "Confirmar fusão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
