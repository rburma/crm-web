"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Pager from "@/components/Pager";
import ColunasConfig from "@/components/ColunasConfig";
import { useSelecao } from "@/lib/useSelecao";
import {
  buscarClientes,
  equipeLojas,
  listarMarcas,
  mergeClientes,
  usuarioLogado,
  clientesBulkAtributo,
  fmtTelefone,
  fmtCpf,
  obterPreferencia,
  type ClienteResumo,
  type LojaEquipe,
  type MarcaItem,
} from "@/lib/api";

const PAGE = 50;

// Catálogo de colunas da lista de clientes.
const COLS_CLI: {
  key: string;
  label: string;
  th?: string;
  render: (c: ClienteResumo) => React.ReactNode;
}[] = [
  {
    key: "nome",
    label: "Nome",
    render: (c) => (
      <Link href={`/clientes/${c.id}`} className="font-medium text-brand-700 hover:underline">
        {c.nome || "(sem nome)"}
      </Link>
    ),
  },
  { key: "email", label: "E-mail", render: (c) => <span className="text-slate-600 break-words">{c.email || "—"}</span> },
  { key: "telefone", label: "Telefone", render: (c) => <span className="text-slate-600">{c.telefone ? fmtTelefone(c.telefone) : "—"}</span> },
  { key: "cpf", label: "CPF", render: (c) => <span className="text-slate-600">{c.cpf ? fmtCpf(c.cpf) : "—"}</span> },
  { key: "uf", label: "UF", th: "th w-20", render: (c) => <span className="badge-gray">{c.uf || "—"}</span> },
];
const COLS_CLI_DEFAULT = ["nome", "email", "telefone", "uf"];
const COLS_CLI_KEYS = COLS_CLI.map((c) => c.key);

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
  const [pageSize, setPageSize] = useState(PAGE);
  const [total, setTotal] = useState(0);

  const selec = useSelecao(rows, (c) => String(c.id));
  const [modal, setModal] = useState(false);
  const [principalId, setPrincipalId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [cols, setCols] = useState<string[]>(COLS_CLI_DEFAULT);
  // Filtro "clientes de cada loja" (pedido Renato 05/07): marca -> loja.
  const [marcas, setMarcas] = useState<MarcaItem[]>([]);
  const [marcaSel, setMarcaSel] = useState<number | null>(null);
  const [lojas, setLojas] = useState<LojaEquipe[]>([]);
  const [lojaSel, setLojaSel] = useState<number | null>(null);
  // Filtros de marca/loja so p/ papeis globais (loja/franqueado ja veem so o escopo;
  // e os endpoints de equipe usados nos selects sao admin-only).
  const ehGlobal = ["admin", "rede", "matriz", "staff", "master"].includes(usuarioLogado()?.papel ?? "admin");

  useEffect(() => {
    if (ehGlobal) listarMarcas().then(setMarcas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setLojaSel(null);
    setLojas([]);
    if (marcaSel != null) {
      equipeLojas(marcaSel, "", 200, 0).then((r) => setLojas(r.items)).catch(() => {});
    }
  }, [marcaSel]);

  useEffect(() => {
    obterPreferencia<{ cols?: string[] }>("cols_clientes")
      .then((v) => {
        const ok = (v.cols || []).filter((k) => COLS_CLI_KEYS.includes(k));
        if (ok.length) setCols(ok);
      })
      .catch(() => {});
  }, []);

  async function carregar(pg: number, size = pageSize) {
    if (!q.trim() && lojaSel == null) return; // sem termo, precisa ao menos da loja
    setLoading(true);
    setErro("");
    setMsg("");
    setBuscou(true);
    selec.limpar();
    try {
      const r = await buscarClientes(q.trim(), size, pg * size, lojaSel);
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

  const selecionados = rows.filter((r) => selec.tem(String(r.id)));

  function abrirMerge() {
    setPrincipalId(selecionados[0]?.id ?? null);
    setModal(true);
  }

  async function confirmarMerge() {
    if (principalId == null) return;
    setMerging(true);
    setErro("");
    try {
      const r = await mergeClientes(principalId, selec.ids.map(Number));
      setModal(false);
      selec.limpar();
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

  async function editarAtributo() {
    const ids = selec.ids.map(Number);
    if (!ids.length) return;
    const chave = window.prompt("Campo a definir (ex.: segmento, esporte, origem). Vazio cancela:");
    if (!chave || !chave.trim()) return;
    const valor = window.prompt(`Valor para "${chave.trim()}" nos ${ids.length} cliente(s). Vazio REMOVE o campo:`);
    if (valor === null) return; // cancelou
    if (!window.confirm(`Definir "${chave.trim()}" = "${valor}" em ${ids.length} cliente(s)?`)) return;
    setBulkBusy(true);
    setErro("");
    setMsg("");
    try {
      const r = await clientesBulkAtributo(ids, chave.trim(), valor);
      setMsg(`${r.ok} cliente(s) atualizado(s) (campo "${chave.trim()}").`);
      selec.limpar();
      await carregar(page);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro na ação em massa");
    } finally {
      setBulkBusy(false);
    }
  }

  // Exporta os clientes SELECIONADOS desta página em CSV (dados já carregados).
  function exportarCsv() {
    if (!selecionados.length) return;
    const esc = (v: string | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [
      ["id", "nome", "cpf", "telefone", "email", "uf"].join(","),
      ...selecionados.map((c) =>
        [c.id, esc(c.nome), esc(c.cpf), esc(c.telefone), esc(c.email), esc(c.uf)].join(","),
      ),
    ];
    const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_selecionados_${selecionados.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const principal = selecionados.find((c) => c.id === principalId) || null;
  const outros = selecionados.filter((c) => c.id !== principalId);
  const merged = principal ? previa(principal, outros) : null;

  return (
    <Shell title="Clientes">
      <div className="max-w-5xl">
        <div className="flex justify-end mb-2">
          <ColunasConfig
            chave="cols_clientes"
            todas={COLS_CLI.map((c) => ({ key: c.key, label: c.label }))}
            value={cols}
            onChange={setCols}
          />
        </div>
        <form onSubmit={buscar} className="flex flex-wrap gap-2 mb-5">
          <input
            className="input flex-1 min-w-[220px]"
            placeholder="Buscar por nome, CPF, telefone ou e-mail…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          {ehGlobal && (<>
          <select className="input w-44" value={marcaSel ?? ""}
            onChange={(e) => setMarcaSel(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">Todas as marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nome || m.slug}</option>
            ))}
          </select>
          <select className="input w-56" value={lojaSel ?? ""} disabled={marcaSel == null}
            onChange={(e) => setLojaSel(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">{marcaSel == null ? "(escolha a marca)" : "Todas as lojas da marca"}</option>
            {lojas.map((l2) => (
              <option key={l2.id} value={l2.id}>{l2.nome}{l2.sigla ? ` · ${l2.sigla}` : ""}</option>
            ))}
          </select>
          </>)}
          <button className="btn-primary whitespace-nowrap" disabled={loading}>
            {loading ? "Buscando…" : "Buscar"}
          </button>
          <p className="w-full text-[11px] text-slate-400 -mt-1">
            Com uma <b>loja</b> escolhida, pode buscar sem termo — lista todos os clientes daquela loja.
          </p>
        </form>

        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-4">{erro}</div>
        )}
        {msg && (
          <div className="card border-green-200 bg-green-50 text-green-700 p-3 text-sm mb-4">{msg}</div>
        )}

        {/* Barra de seleção + ações em massa */}
        {selec.count >= 1 && (
          <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-3 text-sm">
            <span className="text-blue-800 font-medium">{selec.count} cliente(s) selecionado(s)</span>
            <span className="text-slate-300">·</span>
            <button
              className="btn-primary"
              disabled={selec.count < 2 || bulkBusy}
              onClick={abrirMerge}
              title={selec.count < 2 ? "Selecione ao menos 2" : "Fundir os selecionados"}
            >
              Fundir {selec.count >= 2 ? `(${selec.count})` : ""}
            </button>
            <button className="btn-ghost" disabled={bulkBusy} onClick={editarAtributo}>
              Editar atributo
            </button>
            <button className="btn-ghost" disabled={bulkBusy || selecionados.length === 0} onClick={exportarCsv}>
              Exportar CSV
            </button>
            <span className="text-slate-300">·</span>
            <button className="btn-ghost" disabled={bulkBusy} onClick={selec.limpar}>
              Limpar
            </button>
            <span className="text-xs text-slate-400 ml-auto">dica: clique e Shift+clique para um intervalo</span>
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
                {cols.map((k) => {
                  const c = COLS_CLI.find((x) => x.key === k);
                  if (!c) return null;
                  return (
                    <th key={k} className={c.th || "th"}>
                      {c.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading && (
                <tr><td className="td text-slate-400" colSpan={cols.length + 1}>Carregando…</td></tr>
              )}
              {!loading && buscou && rows.length === 0 && (
                <tr><td className="td text-slate-400" colSpan={cols.length + 1}>Nenhum cliente encontrado.</td></tr>
              )}
              {!loading && !buscou && (
                <tr><td className="td text-slate-400" colSpan={cols.length + 1}>Digite um termo e busque — entre 304 mil clientes.</td></tr>
              )}
              {rows.map((cli, idx) => (
                <tr key={cli.id} className={selec.tem(String(cli.id)) ? "bg-blue-50/40" : "row-link"}>
                  <td className="td">
                    <input
                      type="checkbox"
                      checked={selec.tem(String(cli.id))}
                      onClick={(e) => selec.toggleAt(idx, e.shiftKey)}
                      onChange={() => { /* tratado em onClick */ }}
                      className="h-4 w-4"
                    />
                  </td>
                  {cols.map((k) => {
                    const c = COLS_CLI.find((x) => x.key === k);
                    if (!c) return null;
                    return (
                      <td key={k} className="td">
                        {c.render(cli)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {buscou && total > 0 && (
          <>
            <Pager
              page={page}
              pageSize={pageSize}
              total={total}
              loading={loading}
              onPage={carregar}
              onPageSize={(n) => { setPageSize(n); carregar(0, n); }}
            />
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
