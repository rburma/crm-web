"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Pager from "@/components/Pager";
import {
  atualizarUsuario,
  criarUsuario,
  definirSenha,
  listarUsuarios,
  type UsuarioGestao,
} from "@/lib/api";

const PAPEIS = ["admin", "rede", "matriz", "master", "franqueado", "loja", "staff"];
const PAGE = 50;

export default function UsuariosPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UsuarioGestao[]>([]);
  const [page, setPage] = useState(0);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // novo usuário
  const [nNome, setNNome] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPapel, setNPapel] = useState("loja");
  const [nSenha, setNSenha] = useState("");
  const [criando, setCriando] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      setRows(await listarUsuarios(q.trim()));
      setPage(0);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  const visiveis = rows.slice(page * PAGE, (page + 1) * PAGE);
  useEffect(() => {
    carregar();
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
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar");
    } finally {
      setCriando(false);
    }
  }

  async function setPapel(u: UsuarioGestao, papel: string) {
    try { await atualizarUsuario(u.id, { papel }); await carregar(); }
    catch (err) { setErro(err instanceof Error ? err.message : "Erro"); }
  }
  async function toggleAtivo(u: UsuarioGestao) {
    try { await atualizarUsuario(u.id, { ativo: !u.ativo }); await carregar(); }
    catch (err) { setErro(err instanceof Error ? err.message : "Erro"); }
  }
  async function senha(u: UsuarioGestao) {
    const s = window.prompt(`Nova senha para ${u.nome || u.email} (mín. 6):`);
    if (!s) return;
    try { await definirSenha(u.id, s); setMsg(`Senha definida para ${u.email}.`); await carregar(); }
    catch (err) { setErro(err instanceof Error ? err.message : "Erro"); }
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
        <form onSubmit={(e) => { e.preventDefault(); carregar(); }} className="flex gap-2">
          <input className="input flex-1" placeholder="Buscar por nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-ghost" disabled={loading}>{loading ? "…" : "Buscar"}</button>
        </form>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-[var(--line)]">
              <tr>
                <th className="th">Nome</th>
                <th className="th">E-mail</th>
                <th className="th w-32">Papel</th>
                <th className="th w-28">Senha</th>
                <th className="th w-24">Ativo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {visiveis.map((u) => (
                <tr key={u.id}>
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
                <tr><td className="td text-slate-400" colSpan={5}>Nenhum usuário.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <Pager page={page} pageSize={PAGE} total={rows.length} loading={loading} onPage={setPage} />
        )}
      </div>
    </Shell>
  );
}
