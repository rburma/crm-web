"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Pager from "@/components/Pager";
import { useSelecao } from "@/lib/useSelecao";
import {
  atualizarUsuario,
  criarUsuario,
  definirSenha,
  listarUsuarios,
  usuariosEmLote,
  type UsuarioGestao,
} from "@/lib/api";

const PAPEIS = ["admin", "rede", "matriz", "master", "franqueado", "loja", "staff"];
const PAGE = 50;

export default function UsuariosPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UsuarioGestao[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // novo usuário
  const [nNome, setNNome] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPapel, setNPapel] = useState("loja");
  const [nSenha, setNSenha] = useState("");
  const [criando, setCriando] = useState(false);

  // seleção + ações em massa
  const selec = useSelecao(rows, (u) => String(u.id));
  const [bulkPapel, setBulkPapel] = useState("loja");
  const [bulkBusy, setBulkBusy] = useState(false);

  async function carregar(pg: number) {
    setLoading(true);
    setErro("");
    try {
      const r = await listarUsuarios(q.trim(), PAGE, pg * PAGE);
      setRows(r.items);
      setTotal(r.total);
      setPage(pg);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  // Nova busca volta à 1ª página.
  function buscar() {
    return carregar(0);
  }

  useEffect(() => {
    carregar(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nNome.trim() || !nEmail.trim()) return;
    setCriando(true);
    setErro("");
    setMsg("");
    try {
      await criarUsuario({
        nome: nNome.trim(), email: nEmail.trim(), papel: nPapel,
        senha: nSenha.trim() || undefined,
      });
      setMsg(`Usuário ${nNome.trim()} criado.`);
      setNNome(""); setNEmail(""); setNSenha(""); setNPapel("loja");
      await carregar(0);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar");
    } finally {
      setCriando(false);
    }
  }

  async function setPapel(u: UsuarioGestao, papel: string) {
    try { await atualizarUsuario(u.id, { papel }); await carregar(page); }
    catch (err) { setErro(err instanceof Error ? err.message : "Erro"); }
  }
  async function toggleAtivo(u: UsuarioGestao) {
    try { await atualizarUsuario(u.id, { ativo: !u.ativo }); await carregar(page); }
    catch (err) { setErro(err instanceof Error ? err.message : "Erro"); }
  }
  async function senha(u: UsuarioGestao) {
    const s = window.prompt(`Nova senha para ${u.nome || u.email} (mín. 6):`);
    if (!s) return;
    try { await definirSenha(u.id, s); setMsg(`Senha definida para ${u.email}.`); await carregar(page); }
    catch (err) { setErro(err instanceof Error ? err.message : "Erro"); }
  }

  async function aplicarBulk(acao: "papel" | "ativar" | "desativar") {
    const ids = selec.ids.map(Number);
    if (!ids.length) return;
    const oque =
      acao === "papel" ? `definir papel "${bulkPapel}"`
      : acao === "ativar" ? "ativar" : "desativar";
    if (!window.confirm(`${oque} para ${ids.length} usuário(s) selecionado(s)?`)) return;
    setBulkBusy(true);
    setErro("");
    setMsg("");
    try {
      const r = await usuariosEmLote(ids, acao, acao === "papel" ? bulkPapel : undefined);
      let m = `${r.ok} usuário(s) atualizado(s).`;
      if (r.falhas.length) m += ` ${r.falhas.length} ignorado(s) (ex.: o próprio usuário).`;
      setMsg(m);
      selec.limpar();
      await carregar(page);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro na ação em massa");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <Shell title="Usuários">
      <div className="max-w-5xl space-y-5">
        {erro && <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm">{erro}</div>}
        {msg && <div className="card border-green-200 bg-green-50 text-green-700 p-3 text-sm">{msg}</div>}

        {/* Novo usuário */}
        <form onSubmit={criar} className="card p-5">
          <div className="text-sm font-semibold text-slate-700 mb-3">Novo usuário</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <input className="input md:col-span-1" placeholder="Nome" value={nNome} onChange={(e) => setNNome(e.target.value)} />
            <input className="input md:col-span-2" placeholder="E-mail" type="email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} />
            <select className="input" value={nPapel} onChange={(e) => setNPapel(e.target.value)}>
              {PAPEIS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input className="input" placeholder="Senha (opcional)" value={nSenha} onChange={(e) => setNSenha(e.target.value)} />
          </div>
          <button className="btn-primary mt-3" disabled={criando}>{criando ? "Criando…" : "Criar usuário"}</button>
        </form>

        {/* Busca + lista */}
        <form onSubmit={(e) => { e.preventDefault(); buscar(); }} className="flex gap-2">
          <input className="input flex-1" placeholder="Buscar por nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-ghost" disabled={loading}>{loading ? "…" : "Buscar"}</button>
        </form>

        {/* Barra de ações em massa */}
        {selec.count > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm">
            <span className="text-blue-800 font-medium">{selec.count} selecionado(s)</span>
            <span className="text-slate-300">·</span>
            <select className="input py-1 text-xs w-32" value={bulkPapel} onChange={(e) => setBulkPapel(e.target.value)} disabled={bulkBusy}>
              {PAPEIS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button className="btn-ghost" disabled={bulkBusy} onClick={() => aplicarBulk("papel")}>Definir papel</button>
            <button className="btn-ghost" disabled={bulkBusy} onClick={() => aplicarBulk("ativar")}>Ativar</button>
            <button className="btn-ghost" disabled={bulkBusy} onClick={() => aplicarBulk("desativar")}>Desativar</button>
            <span className="text-slate-300">·</span>
            <button className="btn-ghost" disabled={bulkBusy} onClick={selec.limpar}>Limpar</button>
            <span className="text-xs text-slate-400 ml-auto">dica: clique e Shift+clique para marcar um intervalo</span>
          </div>
        )}

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-[var(--line)]">
              <tr>
                <th className="th w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selec.todosDaPagina}
                    onChange={selec.toggleAll}
                    title="Selecionar todos desta página"
                  />
                </th>
                <th className="th">Nome</th>
                <th className="th">E-mail</th>
                <th className="th w-32">Papel</th>
                <th className="th w-28">Senha</th>
                <th className="th w-24">Ativo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {rows.map((u, idx) => (
                <tr key={u.id} className={selec.tem(String(u.id)) ? "bg-blue-50/40" : ""}>
                  <td className="td">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selec.tem(String(u.id))}
                      onClick={(e) => selec.toggleAt(idx, e.shiftKey)}
                      onChange={() => { /* tratado em onClick */ }}
                    />
                  </td>
                  <td className="td">{u.nome || "—"}</td>
                  <td className="td text-slate-600">{u.email || "—"}</td>
                  <td className="td">
                    <select className="input py-1 text-xs" value={u.papel} onChange={(e) => setPapel(u, e.target.value)}>
                      {PAPEIS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="td">
                    <button className="text-xs text-brand-700 hover:underline" onClick={() => senha(u)}>
                      {u.tem_senha ? "✓ trocar" : "definir"}
                    </button>
                  </td>
                  <td className="td">
                    <button
                      className={`text-xs hover:underline ${u.ativo ? "text-green-700" : "text-slate-400"}`}
                      onClick={() => toggleAtivo(u)}
                    >
                      {u.ativo ? "ativo" : "inativo"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td className="td text-slate-400" colSpan={6}>Nenhum usuário.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <Pager page={page} pageSize={PAGE} total={total} loading={loading} onPage={carregar} />
        )}
      </div>
    </Shell>
  );
}
