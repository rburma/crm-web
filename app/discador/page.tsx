"use client";

// Discador da loja — fila de ligações ligada ao CRM (06/08/2026).
// Tela dividida: à esquerda ligar e registrar; à direita o ATENDIMENTO
// INTEIRO (decisão do Renato: melhor abrir o atendimento normal ao lado,
// para o operador trabalhar por onde preferir).
// A ligação sai pelo celular vinculado ao Windows (link tel:).

import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import {
  DiscadorDesfecho, DiscadorFila, DiscadorItem, discadorAssumir,
  discadorDesfecho, discadorFila, discadorRemover, discadorReordenar,
} from "@/lib/api";

function soDigitos(t: string | null | undefined) {
  return (t || "").replace(/\D/g, "");
}

function telefoneBonito(t: string | null | undefined) {
  const d = soDigitos(t);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t || "";
}

export default function DiscadorPage() {
  const [fila, setFila] = useState<DiscadorFila | null>(null);
  const [atualId, setAtualId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  // formulário do desfecho
  const [desfecho, setDesfecho] = useState("");
  const [texto, setTexto] = useState("");
  const [interna, setInterna] = useState(false);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [encerrar, setEncerrar] = useState(false);
  const [quando, setQuando] = useState("");
  const arrastando = useRef<number | null>(null);

  const carregar = useCallback(async (manterAtual = true) => {
    try {
      const f = await discadorFila();
      setFila(f);
      const pendentes = f.itens.filter((i) => i.estado === "pendente");
      if (!manterAtual || !pendentes.some((i) => i.id === atualId)) {
        setAtualId(pendentes.length ? pendentes[0].id : null);
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }, [atualId]);

  useEffect(() => { carregar(false); /* eslint-disable-next-line */ }, []);

  const atual: DiscadorItem | null =
    fila?.itens.find((i) => i.id === atualId) ?? null;
  const defAtual: DiscadorDesfecho | undefined =
    fila?.desfechos.find((d) => d.chave === desfecho);

  function limparForm() {
    setDesfecho(""); setTexto(""); setInterna(false);
    setEnviarEmail(false); setEncerrar(false); setQuando("");
  }

  async function escolher(id: number) {
    setAtualId(id);
    limparForm();
    try { await discadorAssumir(id); } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function salvar(irProximo: boolean) {
    if (!atual || !desfecho) { setMsg("Escolha o desfecho da ligação."); return; }
    if (desfecho === "nao_contatar" && !window.confirm(
      "Confirma bloquear contatos futuros?\n\n" +
      `${atual.nome} deixará de receber ligações, campanhas, e-mails e ` +
      "mensagens desta marca. A decisão fica registrada no cadastro.")) return;
    setSalvando(true);
    setMsg("");
    try {
      const r = await discadorDesfecho(atual.id, {
        desfecho, texto: texto || undefined, interna, enviar_email: enviarEmail,
        encerrar, quando: quando || null,
        confirmar_opt_out: desfecho === "nao_contatar",
      });
      setMsg(r.mensagem);
      limparForm();
      const f = await discadorFila();
      setFila(f);
      if (irProximo) {
        const pend = f.itens.filter(
          (i) => i.estado === "pendente" && i.id !== atual.id);
        setAtualId(pend.length ? pend[0].id : null);
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function soltarEm(destinoId: number) {
    const origem = arrastando.current;
    arrastando.current = null;
    if (!fila || origem == null || origem === destinoId) return;
    const ids = fila.itens.filter((i) => i.estado === "pendente").map((i) => i.id);
    const de = ids.indexOf(origem);
    const para = ids.indexOf(destinoId);
    if (de < 0 || para < 0) return;
    ids.splice(para, 0, ids.splice(de, 1)[0]);
    setFila({ ...fila, itens: [
      ...ids.map((id) => fila.itens.find((i) => i.id === id)!),
      ...fila.itens.filter((i) => i.estado !== "pendente"),
    ] });
    try { await discadorReordenar(ids); } catch { carregar(); }
  }

  async function tirarDaFila(id: number) {
    if (!window.confirm("Tirar este contato da fila?")) return;
    await discadorRemover(id);
    carregar(false);
  }

  const pendentes = fila?.itens.filter((i) => i.estado === "pendente") ?? [];
  const concluidos = fila?.itens.filter((i) => i.estado !== "pendente") ?? [];
  const motorUrl = process.env.NEXT_PUBLIC_MOTOR_URL || "";

  return (
    <Shell>
      <div className="mx-auto max-w-[1500px] px-3">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">☎ Discador</h1>
          <span className="text-sm text-gray-500">
            {fila?.loja ? `${fila.loja} · ` : ""}
            {pendentes.length} para ligar
          </span>
          <a href="/discador/importar"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
            + importar lista
          </a>
          <a href="/discador/encerrar"
            className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50">
            encerrar lista
          </a>
          {msg && <span className="text-sm text-blue-700">{msg}</span>}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* ─── Esquerda: ligar e registrar ─── */}
          <div className="space-y-3">
            {!atual ? (
              <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
                <div className="text-lg">Nenhum contato na fila</div>
                <div className="mt-1 text-sm">
                  Adicione pela lista de oportunidades, pela ficha do cliente
                  ou importando uma lista.
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-white p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Ligando agora · {pendentes.findIndex((i) => i.id === atual.id) + 1}
                    {" de "}{pendentes.length}
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {atual.nome || "Sem nome"}
                  </div>
                  <div className="my-2 text-3xl font-semibold tracking-wide">
                    {telefoneBonito(atual.telefone)}
                  </div>
                  {atual.tentativas > 0 && (
                    <div className="mb-2 text-xs text-amber-700">
                      já tentado {atual.tentativas}×
                      {atual.desfecho_rotulo ? ` · último: ${atual.desfecho_rotulo}` : ""}
                    </div>
                  )}
                  {atual.importado && (
                    <div className="mb-2 text-xs text-gray-500">
                      contato importado{atual.origem ? ` · origem: ${atual.origem}` : ""}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`tel:+55${soDigitos(atual.telefone)}`}
                      className="rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700">
                      📞 Ligar
                    </a>
                    <a href={`https://wa.me/55${soDigitos(atual.telefone)}`}
                      target="_blank" rel="noreferrer"
                      className="rounded-lg border px-4 py-3 text-sm hover:bg-gray-50">
                      WhatsApp
                    </a>
                    <button onClick={() => {
                      const p = pendentes.filter((i) => i.id !== atual.id);
                      if (p.length) escolher(p[0].id);
                    }} className="rounded-lg border px-4 py-3 text-sm text-gray-500">
                      pular
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    A ligação sai pelo celular vinculado ao Windows.
                  </div>
                </div>

                {/* Desfecho */}
                <div className="rounded-xl border bg-white p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Desfecho da ligação
                  </div>
                  <select value={desfecho} onChange={(e) => setDesfecho(e.target.value)}
                    className="w-full rounded border px-2 py-2 text-sm">
                    <option value="">— escolher —</option>
                    {fila?.desfechos.map((d) => (
                      <option key={d.chave} value={d.chave}>
                        {d.rotulo}{d.sai ? "" : "  (continua na fila)"}
                      </option>
                    ))}
                  </select>

                  {defAtual?.data && (
                    <label className="block text-sm">
                      {defAtual.data === "retorno_em"
                        ? "Quando ligar de novo:" : "Quando vai passar na loja:"}
                      <input type="datetime-local" value={quando}
                        onChange={(e) => setQuando(e.target.value)}
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
                    </label>
                  )}

                  <textarea rows={3} value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="O que foi conversado (vira etapa do atendimento)"
                    className="w-full rounded border px-2 py-2 text-sm" />

                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={interna}
                        onChange={(e) => setInterna(e.target.checked)} />
                      mensagem interna (o cliente não vê)
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={enviarEmail}
                        onChange={(e) => setEnviarEmail(e.target.checked)}
                        disabled={interna} />
                      enviar ao cliente
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={encerrar}
                        onChange={(e) => setEncerrar(e.target.checked)} />
                      encerrar o atendimento
                    </label>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => salvar(true)} disabled={salvando || !desfecho}
                      className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40">
                      {salvando ? "Salvando..." : "Salvar e ir para o próximo"}
                    </button>
                    <button onClick={() => salvar(false)} disabled={salvando || !desfecho}
                      className="rounded border px-4 py-2 text-sm disabled:opacity-40">
                      Salvar
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Fila */}
            <div className="rounded-xl border bg-white p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                Fila da loja · arraste para reordenar
              </div>
              {pendentes.length === 0 && concluidos.length === 0 && (
                <div className="text-sm text-gray-400">Fila vazia.</div>
              )}
              <ul className="space-y-1">
                {pendentes.map((i, n) => (
                  <li key={i.id} draggable
                    onDragStart={() => { arrastando.current = i.id; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => soltarEm(i.id)}
                    onClick={() => escolher(i.id)}
                    className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-sm
                      ${i.id === atualId ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}>
                    <span className="text-gray-300">↕</span>
                    <span className="w-5 text-gray-400">{n + 1}.</span>
                    <span className="flex-1 truncate">
                      {i.nome || telefoneBonito(i.telefone)}
                    </span>
                    {i.corrigir_telefone && (
                      <span className="rounded bg-red-100 px-1.5 text-xs text-red-700">
                        corrigir telefone
                      </span>
                    )}
                    {i.retorno_em && (
                      <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">
                        retorno {i.retorno_em.slice(8, 10)}/{i.retorno_em.slice(5, 7)}
                      </span>
                    )}
                    {i.importado && (
                      <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">
                        importado
                      </span>
                    )}
                    {i.tentativas > 0 && (
                      <span className="text-xs text-gray-400">{i.tentativas}×</span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); tirarDaFila(i.id); }}
                      className="text-xs text-gray-400 hover:text-red-600">✕</button>
                  </li>
                ))}
                {concluidos.map((i) => (
                  <li key={i.id}
                    className="flex items-center gap-2 rounded border bg-gray-50 px-2 py-1.5 text-sm text-gray-400">
                    <span className="flex-1 truncate line-through">
                      {i.nome || telefoneBonito(i.telefone)}
                    </span>
                    <span className="rounded bg-green-100 px-1.5 text-xs text-green-800">
                      {i.desfecho_rotulo}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ─── Direita: o ATENDIMENTO inteiro ─── */}
          <div className="rounded-xl border bg-white overflow-hidden"
            style={{ minHeight: "70vh" }}>
            {atual?.oportunidade_id ? (
              <>
                <div className="flex items-center justify-between border-b bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium">
                    Atendimento #{atual.oportunidade_id}
                  </span>
                  <a href={`/atendimentos/${atual.oportunidade_id}`} target="_blank"
                    rel="noreferrer" className="text-blue-600 hover:underline">
                    abrir em outra aba ↗
                  </a>
                </div>
                <iframe
                  key={atual.oportunidade_id}
                  src={`/atendimentos/${atual.oportunidade_id}?embutido=1`}
                  className="h-full w-full"
                  style={{ minHeight: "calc(70vh - 40px)", border: 0 }}
                  title="Atendimento" />
              </>
            ) : atual ? (
              <div className="p-6 text-sm text-gray-500">
                <div className="text-base font-medium text-gray-700">
                  Ainda sem atendimento
                </div>
                <p className="mt-2">
                  Este contato ainda não tem atendimento aberto. Ao registrar o
                  desfecho, o sistema abre um automaticamente, já preenchido com
                  nome e telefone — e o atendimento aparece aqui.
                </p>
                {atual.consumidor_id && (
                  <a href={`/clientes/${atual.consumidor_id}`} target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
                    ver ficha do cliente ↗
                  </a>
                )}
              </div>
            ) : (
              <div className="p-6 text-sm text-gray-400">
                Escolha um contato na fila para ver o atendimento aqui.
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
