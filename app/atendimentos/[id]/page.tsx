"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import SlaBadge from "@/components/SlaBadge";
import {
  anexarFoto,
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
import { paraJpegReduzido } from "@/lib/reduzirImagem";

function iniciais(nome?: string | null): string {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function Avatar({ nome, tipo }: { nome?: string | null; tipo: "staff" | "consumidor" }) {
  const staff = tipo === "staff";
  return (
    <div
      className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold ${
        staff ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-600"
      }`}
      aria-hidden
    >
      {staff ? "AT" : iniciais(nome)}
    </div>
  );
}

function iconeSistema(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("transfer")) return "↪️";
  if (t.includes("resolvid") || t.includes("encerr")) return "✅";
  if (t.includes("espera")) return "⏸";
  if (t.includes("reabr")) return "↩️";
  return "•";
}

const ROTULOS_EMAIL: Record<string, string> = {
  cliente_abertura: "Confirmação de abertura",
  cliente_andamento: "Resposta ao cliente",
  cliente_resposta: "Resposta ao cliente",
  cliente_encerramento: "Encerramento",
  cliente_avaliacao: "Convite p/ avaliar",
  resposta_avaliacao: "Resposta à avaliação",
};
function rotuloEmail(tipo: string | null): string {
  return (tipo && ROTULOS_EMAIL[tipo]) || "E-mail";
}

function Evento({ m, clienteNome }: { m: Mensagem; clienteNome?: string | null }) {
  if (m.autor_tipo === "sistema") {
    return (
      <div className="flex justify-center my-3">
        <span className="badge-gray text-[11px] inline-flex items-center gap-1.5">
          <span aria-hidden>{iconeSistema(m.texto || "")}</span>
          {m.texto}
          <span className="text-slate-400">· {fmtDataHora(m.criado_em)}</span>
        </span>
      </div>
    );
  }
  const staff = m.autor_tipo === "staff";
  return (
    <div className="flex gap-3 mb-4">
      <Avatar nome={staff ? null : clienteNome} tipo={staff ? "staff" : "consumidor"} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs mb-1">
          <span className="font-medium text-slate-700">{staff ? "Atendente" : clienteNome || "Cliente"}</span>
          {m.privado ? <span className="badge-amber text-[10px]">nota interna</span> : null}
          <span className="text-slate-400 ml-auto shrink-0">{fmtDataHora(m.criado_em)}</span>
        </div>
        <div
          className={`rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words border ${
            staff
              ? m.privado
                ? "bg-amber-50 border-amber-200 text-slate-800"
                : "bg-brand-50 border-brand-100 text-slate-800"
              : "bg-white border-[var(--line)] text-slate-800"
          }`}
        >
          {m.texto || "—"}
          {m.anexo_url ? (
            <a
              href={m.anexo_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
            >
              📎 Ver foto
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AtendimentoPage({ params }: { params: { id: string } }) {
  const [d, setD] = useState<AtendimentoDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

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
  const [anexando, setAnexando] = useState(false);

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

  async function anexar(file: File | null) {
    if (!file) return;
    setAnexando(true);
    setRespMsg("");
    try {
      const leve = await paraJpegReduzido(file);
      await anexarFoto(params.id, leve, privado);
      setRespMsg("Foto anexada.");
      await carregar();
    } catch (e) {
      setRespMsg(String((e as Error).message || e));
    } finally {
      setAnexando(false);
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
                <span className="flex items-center gap-2 shrink-0">
                  <span className={statusBadge(d.status)}>{d.status}</span>
                  <SlaBadge venceEm={d.vence_em} alertaEm={d.alerta_em} />
                </span>
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

            {/* Rastreio de e-mails: abriu / clicou, com dia e hora:minuto */}
            {d.emails && d.emails.length > 0 && (
              <div className="card p-5">
                <div className="text-sm font-semibold text-slate-700 mb-3">
                  Rastreio de e-mails
                </div>
                <ul className="space-y-2">
                  {d.emails.map((ev, i) => (
                    <li key={i} className="text-sm flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-medium text-slate-700">{rotuloEmail(ev.tipo)}</span>
                      <span className="text-slate-400">· enviado {fmtDataHora(ev.enviado_em)}</span>
                      {ev.aberto_em ? (
                        <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                          📬 aberto {fmtDataHora(ev.aberto_em)}{ev.aberturas > 1 ? ` (${ev.aberturas}x)` : ""}
                        </span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-500">não aberto</span>
                      )}
                      {ev.clicado_em && (
                        <span className="badge bg-brand-50 text-brand-700 border border-brand-200">
                          🔗 clicou {fmtDataHora(ev.clicado_em)}{ev.cliques > 1 ? ` (${ev.cliques}x)` : ""}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-400 mt-2">
                  Abertura depende de o cliente baixar as imagens do e-mail; clique é sempre registrado.
                </p>
              </div>
            )}

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
                <label
                  className={`text-sm cursor-pointer flex items-center gap-1 text-brand-700 hover:underline ${anexando ? "opacity-50 pointer-events-none" : ""}`}
                >
                  {anexando ? "Anexando…" : "📎 Anexar foto"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={anexando}
                    onChange={(e) => { anexar(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
                  />
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

            {/* Conversa (timeline: mais RECENTES no topo; abertura por último) */}
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-sm font-semibold text-slate-700">Conversa</div>
                <input
                  className="input w-auto py-1 ml-auto max-w-[220px]"
                  placeholder="🔎 Buscar na conversa…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              {(() => {
                const termo = busca.trim().toLowerCase();
                const assunto = d.assunto || "";
                const msgs = termo
                  ? d.mensagens.filter((m) => (m.texto || "").toLowerCase().includes(termo))
                  : d.mensagens;
                const mostrarAbertura =
                  assunto !== "" &&
                  !d.mensagens.some((m) => m.autor_tipo === "consumidor") &&
                  (!termo || assunto.toLowerCase().includes(termo));
                if (msgs.length === 0 && !mostrarAbertura) {
                  return (
                    <div className="text-sm text-slate-400">
                      {termo ? "Nada encontrado na conversa." : "Sem mensagens."}
                    </div>
                  );
                }
                return (
                  <>
                    {msgs.map((m) => (
                      <Evento key={m.id} m={m} clienteNome={d.cliente?.nome} />
                    ))}
                    {!termo && d.total_mensagens > d.mensagens.length && (
                      <div className="text-center text-xs text-slate-400 my-2">
                        mostrando as {d.mensagens.length} mais recentes de {d.total_mensagens}
                      </div>
                    )}
                    {mostrarAbertura && (
                      <div className="flex gap-3 mb-2 mt-1">
                        <Avatar nome={d.cliente?.nome} tipo="consumidor" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs mb-1">
                            <span className="font-medium text-slate-700">{d.cliente?.nome || "Cliente"}</span>
                            <span className="badge-gray text-[10px]">abertura</span>
                            <span className="text-slate-400 ml-auto shrink-0">{fmtDataHora(d.criado_em)}</span>
                          </div>
                          <div className="rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words border bg-white border-[var(--line)] text-slate-800">
                            {assunto}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
