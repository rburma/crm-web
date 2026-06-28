"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Pager from "@/components/Pager";
import { useSelecao } from "@/lib/useSelecao";
import {
  atualizarUsuario,
  criarUsuario,
  definirSenha,
  emailsBulk,
  exportarUsuarios,
  listarUsuarios,
  me,
  usuariosEmLote,
  type EmailBulkResultado,
  type UsuarioGestao,
} from "@/lib/api";

const PAPEIS = ["admin", "rede", "matriz", "master", "franqueado", "loja", "staff"];
const PAGE = 50;
const GLOBAIS = ["admin", "rede", "matriz"];

function parseCSV(text: string): Record<string, string>[] {
  const linhas = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (!linhas.length) return [];
  const delim = linhas[0].split(";").length > linhas[0].split(",").length ? ";" : ",";
  const corta = (linha: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (q) {
        if (c === '"') {
          if (linha[i + 1] === '"') { cur += '"'; i++; } else q = false;
        } else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const heads = corta(linhas[0]).map((h) => h.trim().toLowerCase());
  return linhas.slice(1).map((l) => {
    const cs = corta(l);
    const o: Record<string, string> = {};
    heads.forEach((h, i) => (o[h] = (cs[i] ?? "").trim()));
    return o;
  });
}

function montarCSV(
  usuarios: { id: number; nome: string | null; papel: string; email_atual: string | null; lojas: string }[],
): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const linhas = ["id,nome,papel,email_atual,email_novo,lojas"];
  for (const u of usuarios) {
    linhas.push([u.id, u.nome, u.papel, u.email_atual, "", u.lojas].map(esc).join(","));
  }
  return linhas.join("\r\n");
}

function baixarArquivo(nome: string, conteudo: string) {
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default function UsuariosPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UsuarioGestao[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE);
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

  // e-mails em massa (planilha) — so admin ve
  const [isAdmin, setIsAdmin] = useState(false);
  const [previa, setPrevia] = useState<EmailBulkResultado | null>(null);
  const [importItens, setImportItens] = useState<{ id: number; email: string }[]>([]);
  const [importBusy, setImportBusy] = useState(false);

  async function carregar(pg: number, size = pageSize) {
    setLoading(true);
    setErro("");
    try {
      const r = await listarUsuarios(q.trim(), size, pg * size);
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

  useEffect(() => {
    me()
      .then((u) => setIsAdmin(GLOBAIS.includes(u.papel)))
      .catch(() => setIsAdmin(false));
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

  async function exportarPlanilha() {
    setErro("");
    setMsg("");
    try {
      const r = await exportarUsuarios();
      baixarArquivo("usuarios-emails.csv", montarCSV(r.usuarios));
      setMsg(`Planilha exportada (${r.usuarios.length} usuarios). Preencha a coluna email_novo e importe.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao exportar");
    }
  }

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErro("");
    setMsg("");
    setImportBusy(true);
    try {
      const texto = await file.text();
      const itens = parseCSV(texto)
        .filter((l) => (l["email_novo"] || "") !== "" && (l["id"] || "") !== "")
        .map((l) => ({ id: Number(l["id"]), email: l["email_novo"] }))
        .filter((x) => Number.isFinite(x.id));
      if (!itens.length) {
        setErro("Nenhuma linha com id e email_novo preenchidos.");
        return;
      }
      setImportItens(itens);
      setPrevia(await emailsBulk(false, itens));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao ler a planilha");
    } finally {
      setImportBusy(false);
    }
  }

  async function aplicarImport() {
    if (!importItens.length) return;
    setImportBusy(true);
    setErro("");
    setMsg("");
    try {
      const r = await emailsBulk(true, importItens);
      setMsg(`${r.aplicados} e-mail(s) atualizado(s)${r.erros ? `, ${r.erros} com erro` : ""}.`);
      setPrevia(null);
      setImportItens([]);
      await carregar(page);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao aplicar");
    } finally {
      setImportBusy(false);
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

        {isAdmin && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-700">E-mails em massa (planilha)</span>
              <button className="btn-ghost" onClick={exportarPlanilha}>Exportar planilha</button>
              <label className="btn-ghost cursor-pointer">
                Importar planilha
                <input type="file" accept=".csv,text/csv" className="hidden" disabled={importBusy} onChange={onArquivo} />
              </label>
              <span className="text-xs text-slate-400">
                Exporte, preencha a coluna email_novo no Excel/Sheets e importe (ha previa antes de aplicar).
              </span>
            </div>

            {previa && (
              <div className="rounded-lg border border-[var(--line)] overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span><b>{previa.total}</b> linhas</span>
                  <span className="text-green-700"><b>{previa.validos}</b> a atualizar</span>
                  <span className="text-red-700"><b>{previa.erros}</b> erros</span>
                  <span className="text-amber-600 ml-auto">PREVIA — nada alterado ainda</span>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-[var(--line)]">
                      <tr>
                        <th className="th">Nome</th>
                        <th className="th">De</th>
                        <th className="th">Para</th>
                        <th className="th w-44">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {previa.itens.map((it, i) => (
                        <tr key={i} className={it.status === "erro" ? "bg-red-50/50" : ""}>
                          <td className="td">{it.nome || `id ${it.id}`}</td>
                          <td className="td text-slate-500">{it.de || "-"}</td>
                          <td className="td">{it.para || "-"}</td>
                          <td className="td">
                            {it.status === "ok" && <span className="text-green-700">vai atualizar</span>}
                            {it.status === "igual" && <span className="text-slate-400">sem mudanca</span>}
                            {it.status === "ignorado" && <span className="text-slate-400">ignorado</span>}
                            {it.status === "erro" && <span className="text-red-700">{it.erro}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 bg-slate-50 flex gap-2">
                  <button className="btn-primary" disabled={importBusy || previa.validos === 0} onClick={aplicarImport}>
                    {importBusy ? "Aplicando..." : `Aplicar ${previa.validos} valida(s)`}
                  </button>
                  <button className="btn-ghost" disabled={importBusy} onClick={() => { setPrevia(null); setImportItens([]); }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
          <Pager
            page={page}
            pageSize={pageSize}
            total={total}
            loading={loading}
            onPage={carregar}
            onPageSize={(n) => { setPageSize(n); carregar(0, n); }}
          />
        )}
      </div>
    </Shell>
  );
}
