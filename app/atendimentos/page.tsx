"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Pager from "@/components/Pager";
import ColunasConfig from "@/components/ColunasConfig";
import SlaBadge from "@/components/SlaBadge";
import LojaPicker, { type LojaSel } from "@/components/LojaPicker";
import { lerEstadoLista, salvarEstadoLista } from "@/lib/estadoLista";
import { useSelecao } from "@/lib/useSelecao";
import {
  atendimentosEmLote,
  usuarioLogado,
  fmtDataHoraCurta,
  fmtDecorrido,
  listarAtendimentos,
  listarMarcas,
  minhasObrigacoes,
  obterPreferencia,
  siglaLoja,
  statusAbrev,
  statusBadge,
  type AtendimentoItem,
  type MarcaItem,
  type ObrigacaoLojaItem,
} from "@/lib/api";

const PAGE = 50;

// Catálogo de colunas da lista de atendimentos (o que pode ser exibido).
const COLS_ATEND: {
  key: string;
  label: string;
  th?: string;
  render: (a: AtendimentoItem) => React.ReactNode;
}[] = [
  { key: "numero", label: "Nº", th: "th w-16", render: (a) => <span className="text-slate-500">#{a.numero}</span> },
  {
    key: "assunto",
    label: "Assunto",
    // LARGO e em UMA linha (Renato 06/07): reticencias + title com o texto todo.
    render: (a) => (
      <Link
        href={`/atendimentos/${a.id}`}
        title={a.assunto || undefined}
        className="font-medium text-brand-700 hover:underline block max-w-[520px] truncate"
      >
        {a.assunto || `Atendimento ${a.numero}`}
      </Link>
    ),
  },
  {
    key: "cliente",
    label: "Cliente",
    render: (a) => (
      <span className="text-slate-600 block max-w-[220px] truncate" title={a.cliente || undefined}>
        {a.cliente || "—"}
      </span>
    ),
  },
  { key: "marca", label: "Marca", th: "th w-14", render: (a) => (
      <span className="text-slate-600" title={a.marca || undefined}>{a.marca_sigla || a.marca || "—"}</span>
  ) },
  { key: "loja", label: "Loja", th: "th w-24", render: (a) => (
      <span className="text-slate-600 font-mono block max-w-[110px] truncate" title={a.loja || undefined}>
        {siglaLoja(a.loja_sigla, a.marca_sigla, a.loja)}
      </span>
  ) },
  { key: "status", label: "St.", th: "th w-14", render: (a) => (
      <span className={statusBadge(a.status)} title={a.status}>{statusAbrev(a.status)}</span>
  ) },
  { key: "tempo", label: "Tempo", th: "th w-24", render: (a) => (
      <span className="text-slate-600" title={a.status === "encerrada" ? "da abertura ao encerramento" : "desde a abertura (em andamento)"}>
        {fmtDecorrido(a.criado_em, a.encerrado_em)}
      </span>
  ) },
  { key: "sla", label: "Prazo (SLA)", th: "th w-28", render: (a) => <SlaBadge venceEm={a.vence_em} alertaEm={a.alerta_em} /> },
  { key: "data", label: "Aberto", th: "th w-28", render: (a) => <span className="text-slate-500">{fmtDataHoraCurta(a.criado_em)}</span> },
];
const COLS_ATEND_DEFAULT = ["numero", "assunto", "cliente", "marca", "loja", "status", "tempo", "data"];
const COLS_ATEND_KEYS = COLS_ATEND.map((c) => c.key);

type EstadoAtend = {
  q: string; status: string; marcaId: number | null;
  lojasSel: LojaSel[]; page: number; pageSize: number;
};

export default function AtendimentosPage() {
  // Restaura a busca/paginacao salvas na aba (volta do atendimento no MESMO lugar).
  const salvo = lerEstadoLista<EstadoAtend>("atendimentos");
  const [q, setQ] = useState(salvo.q ?? "");
  const [status, setStatus] = useState(salvo.status ?? "");
  const [marcaId, setMarcaId] = useState<number | null>(salvo.marcaId ?? null);
  const [marcas, setMarcas] = useState<MarcaItem[]>([]);
  const [lojasSel, setLojasSel] = useState<LojaSel[]>(salvo.lojasSel ?? []);
  const [items, setItems] = useState<AtendimentoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(salvo.page ?? 0);
  const [pageSize, setPageSize] = useState(salvo.pageSize ?? PAGE);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [cols, setCols] = useState<string[]>(COLS_ATEND_DEFAULT);
  const [obrig, setObrig] = useState<ObrigacaoLojaItem[]>([]);

  // seleção + ações em massa
  const selec = useSelecao(items, (a) => String(a.id));
  const [bulkStatus, setBulkStatus] = useState("encerrada");
  const [bulkMarca, setBulkMarca] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const ehAdmin = (usuarioLogado()?.papel ?? "admin") === "admin";

  async function excluirSelecionados() {
    const ids = selec.ids.map(Number);
    if (!ids.length) return;
    if (!window.confirm(`EXCLUIR ${ids.length} atendimento(s)?\n\nApaga as mensagens junto (avaliações e logs são preservados). IRREVERSÍVEL.`)) return;
    const comCliente = window.confirm(
      "Excluir TAMBÉM os CLIENTES relacionados?\n\nOK = apaga cada cliente junto (com TODOS os atendimentos dele).\nCancelar = só os atendimentos selecionados."
    );
    if (!window.confirm("Confirma de novo: excluir DEFINITIVAMENTE?")) return;
    setBulkBusy(true); setErro(""); setMsg("");
    try {
      const r = await atendimentosEmLote(ids, "excluir", comCliente ? "com_cliente" : "");
      const extra = (r as { clientes_excluidos?: number }).clientes_excluidos;
      setMsg(`${r.ok} atendimento(s) excluído(s).` + (extra ? ` ${extra} cliente(s) excluído(s) junto.` : "") + (r.falhas.length ? ` ${r.falhas.map((f) => f.motivo).join("; ")}.` : ""));
      selec.limpar();
      await carregar(page);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setBulkBusy(false);
    }
  }

  async function aplicarBulk(acao: "status" | "marca", valor: string, rotulo: string) {
    const ids = selec.ids.map(Number);
    if (!ids.length) return;
    if (!window.confirm(`${rotulo} em ${ids.length} atendimento(s)?`)) return;
    setBulkBusy(true);
    setErro("");
    setMsg("");
    try {
      const r = await atendimentosEmLote(ids, acao, valor);
      let m = `${r.ok} atendimento(s) atualizado(s).`;
      if (r.convites_avaliacao) m += ` ${r.convites_avaliacao} convite(s) de avaliação enviado(s).`;
      if (r.falhas.length) m += ` ${r.falhas.map((f) => f.motivo).join("; ")}.`;
      setMsg(m);
      selec.limpar();
      await carregar(page);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro na ação em massa");
    } finally {
      setBulkBusy(false);
    }
  }

  async function carregar(pg: number, size = pageSize) {
    setLoading(true);
    setErro("");
    try {
      const r = await listarAtendimentos({
        q: q.trim() || undefined,
        status: status || undefined,
        marcaId,
        lojaIds: lojasSel.map((l) => l.id),
        limit: size,
        offset: pg * size,
      });
      setItems(r.items);
      setTotal(r.total);
      setPage(pg);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // Nova busca/filtro sempre volta para a 1ª página.
  function buscar() {
    return carregar(0);
  }

  // Carrega marcas (filtro) + os atendimentos mais recentes na 1a abertura.
    // Persiste o estado da lista na aba (sessionStorage) a cada mudanca.
  useEffect(() => {
    salvarEstadoLista("atendimentos", { q, status, marcaId, lojasSel, page, pageSize });
  }, [q, status, marcaId, lojasSel, page, pageSize]);

useEffect(() => {
    listarMarcas().then(setMarcas).catch(() => {});
    minhasObrigacoes().then((r) => setObrig(r.itens || [])).catch(() => {});
    obterPreferencia<{ cols?: string[] }>("cols_atendimentos")
      .then((v) => {
        let ok = (v.cols || []).filter((k) => COLS_ATEND_KEYS.includes(k));
        // MIGRACAO (06/07): preferencia salva antes da coluna "tempo" existir
        // mantinha so o SLA — troca sla->tempo (o SLA continua opcional no ⚙).
        if (ok.length && !ok.includes("tempo")) {
          ok = ok.includes("sla")
            ? ok.map((k) => (k === "sla" ? "tempo" : k))
            : [...ok, "tempo"];
        }
        if (ok.length) setCols(ok);
      })
      .catch(() => {});
    carregar(salvo.page ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell title="Atendimentos">
      <div className="w-full text-[13px]">
        {obrig.length > 0 && (
          <div className="card border-amber-300 bg-amber-50 p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-amber-800">📋 Obrigações a tratar ({obrig.length})</span>
              <Link href="/obrigacoes" className="text-xs text-amber-700 hover:underline">Ver todas →</Link>
            </div>
            <ul className="space-y-1">
              {[...obrig]
                .sort((a, b) => (a.vencimento ?? "9999").localeCompare(b.vencimento ?? "9999"))
                .slice(0, 6)
                .map((o, i) => (
                  <li key={i} className="text-sm text-amber-900 flex flex-wrap items-center gap-2">
                    {o.sigla && (
                      <span className="text-[11px] font-bold bg-amber-200 text-amber-900 rounded-full px-2 py-0.5">{o.sigla}</span>
                    )}
                    <span className="font-medium">{o.titulo || "(obrigação)"}</span>
                    {o.tipo && <span className="text-amber-700">{o.tipo}</span>}
                    {o.vencimento && (
                      <span className="text-amber-600">· vence {o.vencimento.split("-").reverse().join("/")}</span>
                    )}
                  </li>
                ))}
            </ul>
            {obrig.length > 6 && (
              <div className="text-xs text-amber-700 mt-1">
                +{obrig.length - 6} outra(s) —{" "}
                <Link href="/obrigacoes" className="underline">ver todas</Link>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end items-center gap-2 mb-3">
          <ColunasConfig
            chave="cols_atendimentos"
            todas={COLS_ATEND.map((c) => ({ key: c.key, label: c.label }))}
            value={cols}
            onChange={setCols}
          />
          <Link href="/atendimentos/novo" className="btn-primary text-sm">
            ＋ Novo atendimento
          </Link>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
          className="flex flex-wrap gap-2 mb-5"
        >
          <input
            className="input flex-1 min-w-[260px]"
            placeholder={'Buscar: assunto, cliente, CPF, e-mail, nº, loja, cidade… ("aspas" = exato)'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input w-36"
            value={marcaId ?? ""}
            onChange={(e) => setMarcaId(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">Marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.sigla ? `${m.sigla} — ${m.nome || m.slug}` : (m.nome || m.slug)}
              </option>
            ))}
          </select>
          <LojaPicker
            marcaId={marcaId}
            marcas={marcas}
            value={lojasSel}
            onChange={setLojasSel}
          />
          <select
            className="input w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="aberta">Aberta</option>
            <option value="em_espera">Em espera</option>
            <option value="encerrada">Encerrada</option>
          </select>
          <button className="btn-primary whitespace-nowrap" disabled={loading}>
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-4">
            {erro}
          </div>
        )}
        {msg && (
          <div className="card border-green-200 bg-green-50 text-green-700 p-3 text-sm mb-4">
            {msg}
          </div>
        )}

        {/* Barra de ações em massa */}
        {selec.count > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 mb-3 text-sm">
            <span className="text-blue-800 font-medium">{selec.count} selecionado(s)</span>
            <span className="text-slate-300">·</span>
            <select className="input py-1 text-xs w-32" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} disabled={bulkBusy}>
              <option value="aberta">Aberta</option>
              <option value="em_espera">Em espera</option>
              <option value="encerrada">Encerrada</option>
            </select>
            <button className="btn-ghost" disabled={bulkBusy} onClick={() => aplicarBulk("status", bulkStatus, `Definir status "${bulkStatus}"`)}>
              Aplicar status
            </button>
            <span className="text-slate-300">·</span>
            <select className="input py-1 text-xs w-40" value={bulkMarca} onChange={(e) => setBulkMarca(e.target.value)} disabled={bulkBusy}>
              <option value="">(escolha a marca…)</option>
              {marcas.map((m) => <option key={m.id} value={m.id}>{m.nome || m.slug}</option>)}
            </select>
            <button className="btn-ghost" disabled={bulkBusy || !bulkMarca} onClick={() => aplicarBulk("marca", bulkMarca, "Definir marca")}>
              Aplicar marca
            </button>
            {ehAdmin && (
              <>
                <span className="text-slate-300">·</span>
                <button className="text-red-600 hover:underline text-sm" disabled={bulkBusy} onClick={excluirSelecionados}
                  title="Excluir DEFINITIVAMENTE os selecionados (só admin)">
                  🗑 Excluir
                </button>
              </>
            )}
            <span className="text-slate-300">·</span>
            <button className="btn-ghost" disabled={bulkBusy} onClick={selec.limpar}>Limpar</button>
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
                  const c = COLS_ATEND.find((x) => x.key === k);
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
                <tr>
                  <td className="td text-slate-400" colSpan={cols.length + 1}>
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td className="td text-slate-400" colSpan={cols.length + 1}>
                    Nenhum atendimento.
                  </td>
                </tr>
              )}
              {items.map((a, idx) => (
                <tr key={a.id} className={selec.tem(String(a.id)) ? "bg-blue-50/40" : "row-link"}>
                  <td className="td">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selec.tem(String(a.id))}
                      onClick={(e) => selec.toggleAt(idx, e.shiftKey)}
                      onChange={() => { /* tratado em onClick */ }}
                    />
                  </td>
                  {cols.map((k) => {
                    const c = COLS_ATEND.find((x) => x.key === k);
                    if (!c) return null;
                    return (
                      <td key={k} className="td">
                        {c.render(a)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pager
          page={page}
          pageSize={pageSize}
          total={total}
          loading={loading}
          onPage={carregar}
          onPageSize={(n) => { setPageSize(n); carregar(0, n); }}
        />
      </div>
    </Shell>
  );
}
