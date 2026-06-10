"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import {
  detalheAtendimento,
  fmtDataHora,
  fmtTelefone,
  fmtCpf,
  listarLojas,
  mudarStatusAtendimento,
  paresFicha,
  responderAtendimento,
  statusBadge,
  transferirAtendimento,
  type AtendimentoDetalhe,
  type LojaItem,
  type Mensagem,
} from "@/lib/api";

function Balao({ m }: { m: Mensagem }) {
  if (m.autor_tipo === "sistema") {
    return (
      <div className="text-center my-2">
        <span className="badge-gray text-[11px]">{m.texto}</span>
      </div>
    );
  }
  const staff = m.autor_tipo === "staff";
  return (
    <div className={`flex ${staff ? "justify-end" : "justify-start"} mb-3`}>
      <div className="max-w-[78%]">
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
            staff
              ? "bg-brand-600 text-white rounded-br-sm"
              : "bg-white border border-[var(--line)] text-slate-800 rounded-bl-sm"
          }`}
        >
          {m.texto || "—"}
        </div>
        <div
          className={`text-[11px] text-slate-400 mt-1 ${
            staff ? "text-right" : "text-left"
          }`}
        >
          {staff ? "Atendente" : "Cliente"}
          {m.privado ? " · nota interna" : ""} · {fmtDataHora(m.criado_em)}
        </div>
      </div>
    </div>
  );
}

export default function AtendimentoPage({ params }: { params: { id: string } }) {
  const [d, setD] = useState<AtendimentoDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  // transferência de departamento (mesma marca)
  const [transfOpen, setTransfOpen] = useState(false);
  const [transfQ, setTransfQ] = useState("");
  const [transfLojas, setTransfLojas] = useState<LojaItem[]>([]);

  // resposta do atendente
  const [resp, setResp] = useState("");
  const [privado, setPrivado] = useState(false);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [respMsg, setRespMsg] = useState("");

  async function carregar() {
    try {
      setD(await detalheAtendimento(params.id));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // busca de lojas da MESMA marca p/ transferir (debounce)
  useEffect(() => {
    if (!transfOpen || d?.marca_id == null) { setTransfLojas([]); return; }
    const t = setTimeout(() => {
      listarLojas({ marcaId: d.marca_id!, q: transfQ, limit: 10 })
        .then((ls) => setTransfLojas(ls.filter((l) => l.id !== d.loja_id)))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfOpen, transfQ, d?.marca_id]);

  async function transferir(loja: LojaItem) {
    if (!confirm(`Transferir este atendimento para:\n\n${loja.nome}?`)) return;
    try {
      await transferirAtendimento(params.id, loja.id);
      setTransfOpen(false); setTransfQ("");
      await carregar();
      setRespMsg("✓ Atendimento transferido.");
    } catch (err) {
      setRespMsg(err instanceof Error ? err.message : "Erro ao transferir");
    }
  }

  async function enviarResposta() {
    if (!resp.trim()) return;
    setEnviando(true);
    setRespMsg("");
    try {
      const r = await responderAtendimento(params.id, resp.trim(), privado, enviarEmail && !privado);
      setResp("");
      if (r.email.tentado) {
        setRespMsg(r.email.ok ? `✓ E-mail enviado a ${r.email.para}` : `Registrado. E-mail NÃO enviado (${r.email.detalhe}).`);
      } else {
        setRespMsg(privado ? "✓ Nota interna registrada." : "✓ Resposta registrada.");
      }
      await carregar();
    } catch (err) {
      setRespMsg(err instanceof Error ? err.message : "Erro ao responder");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Shell title="Atendimento">
      <div className="max-w-3xl">
        <Link href="/atendimentos" className="text-sm text-slate-500 hover:underline">
          ← Voltar para atendimentos
        </Link>

        {loading && <div className="text-slate-400 mt-6">Carregando…</div>}
        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mt-4">
            {erro}
          </div>
        )}

        {d && (
          <div className="mt-4 space-y-4">
            {/* Cabecalho */}
            <div className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {d.assunto || `Atendimento ${d.numero}`}
                  </h2>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {d.cliente ? (
                      <Link
                        href={`/clientes/${d.cliente.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {d.cliente.nome || "(cliente)"}
                      </Link>
                    ) : (
                      "sem cliente vinculado"
                    )}
                    {d.marca ? ` · ${d.marca}` : ""}
                    {d.loja ? ` · ${d.loja}` : ""}
                  </div>
                </div>
                <span className={statusBadge(d.status)}>{d.status}</span>
              </div>
              <div className="text-xs text-slate-400 mt-3">
                Aberto em {fmtDataHora(d.criado_em)} · {d.total_mensagens} mensagem(ns)
              </div>
              {/* controles de status */}
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
                {d.status !== "encerrada" && (
                  <button
                    className="btn bg-emerald-600 text-white hover:bg-emerald-700 text-xs px-3 py-1.5"
                    onClick={async () => {
                      if (!confirm("Encerrar este atendimento? (O cliente poderá avaliar e, se responder, ele reabre.)")) return;
                      try { await mudarStatusAtendimento(params.id, "encerrada"); await carregar(); }
                      catch (err) { setRespMsg(err instanceof Error ? err.message : "Erro"); }
                    }}
                  >
                    ✅ Encerrar atendimento
                  </button>
                )}
                {d.status === "aberta" && (
                  <button
                    className="btn-ghost text-xs px-3 py-1.5"
                    onClick={async () => {
                      try { await mudarStatusAtendimento(params.id, "em_espera"); await carregar(); }
                      catch (err) { setRespMsg(err instanceof Error ? err.message : "Erro"); }
                    }}
                  >
                    ⏸ Em espera
                  </button>
                )}
                {d.status !== "aberta" && (
                  <button
                    className="btn-ghost text-xs px-3 py-1.5"
                    onClick={async () => {
                      try { await mudarStatusAtendimento(params.id, "aberta"); await carregar(); }
                      catch (err) { setRespMsg(err instanceof Error ? err.message : "Erro"); }
                    }}
                  >
                    ↩️ Reabrir
                  </button>
                )}
                {d.marca_id != null && (
                  <button
                    className="btn-ghost text-xs px-3 py-1.5"
                    onClick={() => setTransfOpen((v) => !v)}
                    title="Transferir para outro departamento da mesma marca"
                  >
                    ↪️ Transferir
                  </button>
                )}
              </div>
              {transfOpen && (
                <div className="mt-3 border border-slate-200 rounded-lg p-3">
                  <label className="label">Transferir para (lojas da marca {d.marca ?? ""})</label>
                  <input className="input" placeholder="🔎 Buscar departamento/loja…"
                    value={transfQ} onChange={(e) => setTransfQ(e.target.value)} autoFocus />
                  <div className="mt-1 max-h-44 overflow-y-auto">
                    {transfLojas.map((l) => (
                      <button key={l.id}
                        className="block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-slate-50"
                        onClick={() => transferir(l)}>
                        {l.nome}
                      </button>
                    ))}
                    {transfQ.trim() !== "" && transfLojas.length === 0 && (
                      <p className="text-xs text-slate-400 px-2 py-2">Nenhuma loja encontrada.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Ficha do cliente (resumo) — sempre no topo */}
            {d.cliente && (() => {
              const cli = d.cliente!;
              const a = (cli.atributos || {}) as Record<string, unknown>;
              const av = (k: string) => {
                const v = a[k];
                return v != null && String(v).trim() !== "" ? String(v) : null;
              };
              const local = [av("cidade"), av("uf")].filter(Boolean).join(" / ");
              return (
                <div className="card p-5">
                  <div className="text-sm font-semibold text-slate-700 mb-3">Cliente</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-slate-400">Nome</div>
                      <div className="text-sm">
                        <Link href={`/clientes/${cli.id}`} className="text-brand-700 hover:underline">
                          {cli.nome || "(cliente)"}
                        </Link>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">E-mail</div>
                      <div className="text-sm text-slate-800 break-words">{cli.email || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Telefone</div>
                      <div className="text-sm text-slate-800">{cli.telefone ? fmtTelefone(cli.telefone) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">CPF</div>
                      <div className="text-sm text-slate-800">{cli.cpf ? fmtCpf(cli.cpf) : "—"}</div>
                    </div>
                    {local && (
                      <div>
                        <div className="text-xs text-slate-400">Cidade/UF</div>
                        <div className="text-sm text-slate-800">{local}</div>
                      </div>
                    )}
                    {av("loja_proxima") && (
                      <div>
                        <div className="text-xs text-slate-400">Loja mais próxima</div>
                        <div className="text-sm text-slate-800">{av("loja_proxima")}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Ficha do produto (custom do ticket: "Localizar produto" etc.) */}
            {(() => {
              const pares = paresFicha(d.custom);
              if (pares.length === 0) return null;
              return (
                <div className="card p-5">
                  <div className="text-sm font-semibold text-slate-700 mb-3">
                    Ficha do produto
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {pares.map((p) => (
                      <div key={p.chave}>
                        <div className="text-xs text-slate-400">{p.rotulo}</div>
                        {p.isLink ? (
                          <a
                            href={p.valor}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-brand-700 hover:underline break-all"
                          >
                            abrir ↗
                          </a>
                        ) : (
                          <div className="text-sm text-slate-800 break-words">{p.valor}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Responder (registra + envia e-mail se habilitado) */}
            <div className="card p-5">
              <div className="text-sm font-semibold text-slate-700 mb-2">Responder</div>
              <textarea
                className="input w-full min-h-[90px]"
                placeholder="Escreva a resposta ao cliente ou uma nota interna…"
                value={resp}
                onChange={(e) => setResp(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <label className="text-sm text-slate-600 flex items-center gap-1.5">
                  <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} />
                  Nota interna (não enviar)
                </label>
                <label className={`text-sm flex items-center gap-1.5 ${privado ? "text-slate-300" : "text-slate-600"}`}>
                  <input
                    type="checkbox"
                    disabled={privado}
                    checked={enviarEmail && !privado}
                    onChange={(e) => setEnviarEmail(e.target.checked)}
                  />
                  Enviar por e-mail ao cliente
                </label>
                <button
                  className="btn-primary ml-auto"
                  onClick={enviarResposta}
                  disabled={enviando || !resp.trim()}
                >
                  {enviando ? "Enviando…" : "Enviar"}
                </button>
              </div>
              {respMsg && <div className="text-xs text-slate-500 mt-2">{respMsg}</div>}
            </div>

            {/* Conversa */}
            <div className="card p-5 bg-slate-50/60">
              {d.mensagens.length === 0 && !d.assunto && (
                <div className="text-sm text-slate-400">Sem mensagens.</div>
              )}
              {/* mais RECENTES no topo (o backend ja devolve desc) */}
              {d.mensagens.map((m) => <Balao key={m.id} m={m} />)}
              {d.total_mensagens > d.mensagens.length && (
                <div className="text-center text-xs text-slate-400 my-2">
                  mostrando as {d.mensagens.length} mais recentes de {d.total_mensagens}
                </div>
              )}
              {/* Abertura do atendimento (mais ANTIGA) por ULTIMO. No legado o
                  cliente raramente postava texto; o pedido dele e o ASSUNTO. So
                  aparece quando NAO ha mensagem do cliente (senao seria redundante). */}
              {d.assunto && !d.mensagens.some((m) => m.autor_tipo === "consumidor") && (
                <div className="flex justify-start mt-3">
                  <div className="max-w-[78%]">
                    <div className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words bg-white border border-[var(--line)] text-slate-800 rounded-bl-sm">
                      {d.assunto}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 text-left">
                      Cliente · abertura do atendimento · {fmtDataHora(d.criado_em)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
