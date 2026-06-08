"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import {
  detalheAtendimento,
  fmtData,
  paresFicha,
  statusBadge,
  type AtendimentoDetalhe,
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
          {m.privado ? " · nota interna" : ""} · {fmtData(m.criado_em)}
        </div>
      </div>
    </div>
  );
}

export default function AtendimentoPage({ params }: { params: { id: string } }) {
  const [d, setD] = useState<AtendimentoDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      try {
        const r = await detalheAtendimento(params.id);
        if (vivo) setD(r);
      } catch (err) {
        if (vivo) setErro(err instanceof Error ? err.message : "Erro");
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [params.id]);

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
                Aberto em {fmtData(d.criado_em)} · {d.total_mensagens} mensagem(ns)
              </div>
            </div>

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

            {/* Conversa */}
            <div className="card p-5 bg-slate-50/60">
              {/* Solicitacao inicial do cliente: no legado o cliente raramente
                  postava texto (98% das msgs sao notas do atendente). O pedido
                  dele e o ASSUNTO (+ ficha). Renderizamos como a 1a fala do
                  cliente p/ a conversa fazer sentido. */}
              {d.assunto && !d.mensagens.some((m) => m.autor_tipo === "consumidor") && (
                <div className="flex justify-start mb-3">
                  <div className="max-w-[78%]">
                    <div className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words bg-white border border-[var(--line)] text-slate-800 rounded-bl-sm">
                      {d.assunto}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 text-left">
                      Cliente · abertura do atendimento · {fmtData(d.criado_em)}
                    </div>
                  </div>
                </div>
              )}
              {d.mensagens.map((m) => <Balao key={m.id} m={m} />)}
              {d.mensagens.length === 0 && !d.assunto && (
                <div className="text-sm text-slate-400">Sem mensagens.</div>
              )}
              {d.total_mensagens > d.mensagens.length && (
                <div className="text-center text-xs text-slate-400 mt-2">
                  mostrando as primeiras {d.mensagens.length} de {d.total_mensagens}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
