"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  publicoAcompanhar,
  publicoEncerrar,
  publicoResponder,
  type PublicoConversa,
} from "@/lib/api";

function fmtDH(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function AcompanharInner() {
  const sp = useSearchParams();
  const [numero, setNumero] = useState(sp?.get("n") ?? "");
  const [email, setEmail] = useState(sp?.get("e") ?? "");
  const [conv, setConv] = useState<PublicoConversa | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cor = conv?.marca_tema?.cor || "#0f6bd7";

  const buscar = useCallback(async (n?: string, e?: string) => {
    const num = (n ?? numero).trim().replace(/^#/, "");
    const em = (e ?? email).trim();
    if (!num || !em) { setErro("Informe o número do atendimento e o e-mail."); return; }
    setCarregando(true); setErro("");
    try {
      setConv(await publicoAcompanhar(num, em));
    } catch {
      setErro("Atendimento não encontrado. Confira o número e o e-mail usado na abertura.");
      setConv(null);
    } finally {
      setCarregando(false);
    }
  }, [numero, email]);

  // auto-busca quando veio pelo link (?n=&e=)
  useEffect(() => {
    const n = sp?.get("n"); const e = sp?.get("e");
    if (n && e) buscar(n, e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function responder() {
    if (!conv || !resposta.trim()) return;
    setEnviando(true); setErro("");
    try {
      await publicoResponder(conv.numero, email.trim(), resposta.trim());
      setResposta("");
      await buscar(conv.numero, email.trim());
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen py-8 px-4"
      style={{ background: `linear-gradient(180deg, ${cor}26 0%, ${cor}0d 180px, #f3f5f9 420px)` }}>
      <div className="fixed top-0 left-0 right-0 h-1.5 z-10" style={{ background: cor }} />
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          {conv?.marca_logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/render/${conv.marca_logo_path}`} alt={conv.marca ?? ""}
              className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200" />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-lg"
              style={{ background: cor }}>
              {(conv?.marca ?? "Atendimento").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-lg leading-tight">{conv?.marca ?? "Acompanhar atendimento"}</div>
            <div className="text-xs text-slate-500">Acompanhamento de atendimento</div>
          </div>
        </div>

        <div className="card p-6">
          {/* busca */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-3 items-end">
            <div>
              <label className="label">Número do atendimento</label>
              <input className="input" placeholder="#562366" value={numero}
                onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div>
              <label className="label">Seu e-mail</label>
              <input className="input" type="email" placeholder="voce@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button onClick={() => buscar()} disabled={carregando}
              className="text-white font-semibold rounded-lg px-5 py-2.5 disabled:opacity-50"
              style={{ background: cor }}>
              {carregando ? "Buscando…" : "Acessar"}
            </button>
          </div>

          {erro && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{erro}</div>}

          {/* conversa */}
          {conv && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="badge-blue">#{conv.numero}</span>
                <span className={conv.status === "encerrada" ? "badge-gray" : "badge-green"}>
                  {conv.status === "encerrada" ? "Encerrado" : conv.status === "em_espera" ? "Em espera" : "Em andamento"}
                </span>
                {conv.loja && <span className="badge-gray">{conv.loja}</span>}
              </div>
              {conv.assunto && <p className="text-sm font-semibold mb-3">{conv.assunto}</p>}

              {conv.status !== "encerrada" && (
                <button
                  onClick={async () => {
                    if (!confirm("Marcar como resolvido e encerrar o atendimento?")) return;
                    setErro("");
                    try {
                      await publicoEncerrar(conv.numero, email.trim());
                      await buscar(conv.numero, email.trim());
                    } catch (e) {
                      setErro(String((e as Error).message || e));
                    }
                  }}
                  className="block w-full text-left rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 mb-4 hover:bg-emerald-100">
                  ✅ <b>Meu problema foi resolvido</b> — encerrar atendimento
                </button>
              )}
              {conv.pode_avaliar && (
                <Link href={`/avaliar?n=${encodeURIComponent(conv.numero)}&e=${encodeURIComponent(email.trim())}`}
                  className="block rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 mb-4 hover:bg-amber-100">
                  ⭐ Seu atendimento foi encerrado — <b>avalie nosso atendimento</b> (leva 1 minuto)
                </Link>
              )}
              {conv.ja_avaliada && (
                <p className="text-xs text-emerald-700 mb-3">✅ Você já avaliou este atendimento. Obrigado!</p>
              )}

              <div className="space-y-3 max-h-[420px] overflow-y-auto border border-slate-100 rounded-lg p-3">
                {conv.mensagens.map((m, i) => (
                  <div key={i} className={m.autor === "voce" ? "text-right" : "text-left"}>
                    <div className="text-[11px] text-slate-400 mb-0.5">
                      {m.autor === "voce" ? "Você" : "Equipe"} · {fmtDH(m.criado_em)}
                    </div>
                    <div className={`inline-block px-3 py-2 rounded-xl text-sm max-w-[85%] whitespace-pre-wrap text-left ${
                      m.autor === "voce" ? "bg-brand-50" : "bg-emerald-50"
                    }`}>
                      {m.texto}
                    </div>
                  </div>
                ))}
                {conv.mensagens.length === 0 && (
                  <p className="text-sm text-slate-400">Sem mensagens ainda.</p>
                )}
              </div>

              <div className="mt-3">
                <label className="label">Responder</label>
                <textarea className="input" rows={2} value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  placeholder="Escreva sua resposta…" />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    {conv.status === "encerrada" ? "Responder reabre o atendimento." : ""}
                  </p>
                  <button onClick={responder} disabled={enviando || !resposta.trim()}
                    className="text-white font-semibold rounded-lg px-5 py-2 disabled:opacity-50"
                    style={{ background: cor }}>
                    {enviando ? "Enviando…" : "Enviar resposta"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Perdeu o número? Ele está no e-mail de confirmação que você recebeu ao abrir o atendimento.
        </p>
      </div>
    </div>
  );
}

export default function AcompanharPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Carregando…</div>}>
      <AcompanharInner />
    </Suspense>
  );
}
