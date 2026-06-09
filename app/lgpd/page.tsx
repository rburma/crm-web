"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import {
  anonimizarCliente,
  buscarClientes,
  ficha360,
  fmtCpf,
  fmtTelefone,
  type ClienteResumo,
} from "@/lib/api";

export default function LgpdPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ClienteResumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setErro("");
    setMsg("");
    setBuscou(true);
    try {
      const r = await buscarClientes(q.trim(), 25);
      setRows(r.items);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao buscar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Direito de acesso/portabilidade: baixa TODOS os dados do titular em JSON.
  async function exportar(c: ClienteResumo) {
    setBusy(c.id);
    setErro("");
    setMsg("");
    try {
      const f = await ficha360(c.id);
      const blob = new Blob([JSON.stringify(f, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `titular_${c.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`Dados do titular #${c.id} exportados (titular_${c.id}.json).`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao exportar");
    } finally {
      setBusy(null);
    }
  }

  // Direito ao esquecimento: anonimização (remove identificação, mantém histórico).
  async function anonimizar(c: ClienteResumo) {
    const resp = window.prompt(
      `ANONIMIZAR ${c.nome || "este titular"} (#${c.id}).\n\n` +
        "Remove nome, CPF, telefone, e-mail e endereço. O histórico é mantido SEM " +
        "identificação (não tem volta).\n\nPara confirmar, digite: ANONIMIZAR",
    );
    if (resp !== "ANONIMIZAR") return;
    setBusy(c.id);
    setErro("");
    setMsg("");
    try {
      await anonimizarCliente(c.id);
      setMsg(`Titular #${c.id} anonimizado.`);
      await buscar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao anonimizar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell title="LGPD / Privacidade">
      <div className="max-w-4xl space-y-6">
        {/* Aviso de transparência */}
        <div className="card p-5 text-sm text-slate-600 space-y-2">
          <div className="text-base font-semibold text-slate-800">Aviso de privacidade (LGPD)</div>
          <p>
            A WT trata dados pessoais de clientes para <b>atendimento, relacionamento e
            cumprimento de obrigações legais</b>, conforme a Lei nº 13.709/2018 (LGPD).
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Dados tratados:</b> nome, contato (e-mail/telefone), CPF, endereço e histórico de atendimentos.</li>
            <li><b>Finalidade/base legal:</b> execução do atendimento e do relacionamento (art. 7º), e obrigações legais/regulatórias.</li>
            <li><b>Retenção:</b> pelo tempo necessário ao atendimento e às exigências legais; depois, anonimização ou descarte.</li>
            <li><b>Compartilhamento:</b> apenas com operadores necessários à prestação do serviço, sob contrato.</li>
            <li><b>Direitos do titular:</b> acesso, correção, portabilidade e eliminação/anonimização — atendidos por esta tela.</li>
          </ul>
          <p className="text-xs text-amber-700">
            ⚠️ Texto de rascunho — revisar com o jurídico antes de publicar e definir o encarregado (DPO) e o canal de contato.
          </p>
        </div>

        {/* Direitos do titular */}
        <div className="card p-5">
          <div className="text-base font-semibold text-slate-800 mb-1">Atender pedido do titular</div>
          <p className="text-sm text-slate-500 mb-4">
            Localize a pessoa por nome, CPF, telefone ou e-mail e atenda o pedido: <b>exportar</b> os
            dados (acesso/portabilidade) ou <b>anonimizar</b> (direito ao esquecimento).
          </p>

          <form onSubmit={buscar} className="flex gap-2 mb-4">
            <input
              className="input flex-1"
              placeholder="Nome, CPF, telefone ou e-mail do titular…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            <button className="btn-primary whitespace-nowrap" disabled={loading}>
              {loading ? "Buscando…" : "Buscar"}
            </button>
          </form>

          {erro && <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-3">{erro}</div>}
          {msg && <div className="card border-green-200 bg-green-50 text-green-700 p-3 text-sm mb-3">{msg}</div>}

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-[var(--line)]">
                <tr>
                  <th className="th">Titular</th>
                  <th className="th">Contato</th>
                  <th className="th w-56">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {!loading && buscou && rows.length === 0 && (
                  <tr><td className="td text-slate-400" colSpan={3}>Nenhum titular encontrado.</td></tr>
                )}
                {!loading && !buscou && (
                  <tr><td className="td text-slate-400" colSpan={3}>Busque um titular para atender o pedido.</td></tr>
                )}
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="td">
                      <div className="font-medium text-slate-800">{c.nome || "(sem nome)"}</div>
                      <div className="text-xs text-slate-400">#{c.id}{c.cpf ? ` · CPF ${fmtCpf(c.cpf)}` : ""}</div>
                    </td>
                    <td className="td text-slate-600">
                      <div>{c.email || "—"}</div>
                      <div className="text-xs text-slate-400">{c.telefone ? fmtTelefone(c.telefone) : ""}</div>
                    </td>
                    <td className="td">
                      <div className="flex gap-2">
                        <button className="btn-ghost" disabled={busy === c.id} onClick={() => exportar(c)}>
                          Exportar
                        </button>
                        <button
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          disabled={busy === c.id}
                          onClick={() => anonimizar(c)}
                        >
                          Anonimizar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
