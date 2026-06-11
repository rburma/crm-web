"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  publicoAvaliacaoForm,
  publicoAvaliar,
  type AvaliarResp,
  type PublicoAvaliacaoForm,
} from "@/lib/api";

function Estrelas({ valor, onChange }: {
  valor: number; onChange: (n: number) => void;
}) {
  return (
    <div className="whitespace-nowrap">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)} aria-label={`${n} estrela(s)`}
          className="text-2xl px-0.5 transition-transform hover:scale-110"
          style={{ color: n <= valor ? "#f5a623" : "#d8dee9" }}>
          ★
        </button>
      ))}
      <span className="text-xs text-slate-400 ml-1">{valor ? `${valor}/5` : ""}</span>
    </div>
  );
}

function AvaliarInner() {
  const sp = useSearchParams();
  const [numero, setNumero] = useState((sp?.get("n") ?? "").replace(/^#/, ""));
  const [email, setEmail] = useState(sp?.get("e") ?? "");

  const [form, setForm] = useState<PublicoAvaliacaoForm | null>(null);
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [resp, setResp] = useState<AvaliarResp | null>(null);

  const cor = form?.marca_tema?.cor || "#0f6bd7";

  async function buscar(n?: string, e?: string) {
    const num = (n ?? numero).trim().replace(/^#/, "");
    const em = (e ?? email).trim();
    if (!num || !em) { setErro("Informe o número do atendimento e o e-mail."); return; }
    setBuscando(true); setErro("");
    try {
      setForm(await publicoAvaliacaoForm(num, em));
    } catch {
      setErro("Atendimento não encontrado. Confira o número e o e-mail usado na abertura.");
      setForm(null);
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    const n = sp?.get("n"); const e = sp?.get("e");
    if (n && e) buscar(n.replace(/^#/, ""), e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar() {
    if (!form) return;
    const dadas = Object.fromEntries(Object.entries(notas).filter(([, v]) => v >= 1));
    if (Object.keys(dadas).length === 0) { setErro("Dê ao menos uma nota."); return; }
    setEnviando(true); setErro("");
    try {
      const r = await publicoAvaliar(
        numero.trim().replace(/^#/, ""), email.trim(), dadas,
        comentario.trim() || undefined,
      );
      setResp(r);
      setEnviado(true);
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
          {form?.marca_logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/render/${form.marca_logo_path}`} alt={form.marca ?? ""}
              className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200" />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-lg"
              style={{ background: cor }}>
              {(form?.marca ?? "AV").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-lg leading-tight">{form?.marca ?? "Avaliação"}</div>
            <div className="text-xs text-slate-500">Avaliação de atendimento</div>
          </div>
        </div>

        <div className="card p-6">
          {!form && (
            <div>
              <h2 className="text-lg font-bold mb-1">Avaliar atendimento</h2>
              <p className="text-sm text-slate-500 mb-4">
                Informe o número do atendimento e o e-mail usado na abertura.
              </p>
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
                <button onClick={() => buscar()} disabled={buscando}
                  className="text-white font-semibold rounded-lg px-5 py-2.5 disabled:opacity-50"
                  style={{ background: cor }}>
                  {buscando ? "Buscando…" : "Acessar"}
                </button>
              </div>
              {erro && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{erro}</div>}
            </div>
          )}

          {form && (enviado || form.ja_avaliada) && (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">
                {resp?.nivel === "alta" ? "🌟" : resp?.nivel === "baixa" ? "🤝" : "🙏"}
              </div>
              <h2 className="text-xl font-bold mb-1">
                {resp?.nivel === "baixa" ? "Vamos resolver isso" : "Obrigado!"}
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {resp?.obrigado
                  ?? (enviado ? "Sua avaliação foi registrada com sucesso."
                    : "Este atendimento já foi avaliado.")}
              </p>

              {/* Nota alta: convida a avaliar publicamente (Google / sites) */}
              {resp?.nivel === "alta" && resp.links_externos.length > 0 && (
                <div className="mt-6">
                  {resp.cta && <p className="text-sm font-medium mb-3">{resp.cta}</p>}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {resp.links_externos.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                        className="text-white font-semibold rounded-lg px-5 py-2.5 inline-flex items-center gap-2"
                        style={{ background: cor }}>
                        ★ {l.rotulo}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Nota baixa: já reabrimos — reforço visual */}
              {resp?.nivel === "baixa" && resp.reaberto && (
                <div className="mt-5 inline-block rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  Seu atendimento <b>#{form.numero}</b> foi reaberto. Em breve a loja
                  retoma o contato por aqui.
                </div>
              )}
            </div>
          )}

          {form && !enviado && !form.ja_avaliada && (
            <>
              <h2 className="text-lg font-bold mb-1">Avalie nosso atendimento</h2>
              <p className="text-sm text-slate-500 mb-5">
                Atendimento <b>#{form.numero}</b>{form.loja ? <> · {form.loja}</> : null} — leva menos de 1 minuto!
              </p>
              {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{erro}</div>}
              <div className="space-y-3">
                {form.perguntas.map((p, i) => (
                  <div key={p} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-100 pb-2.5">
                    <span className="text-sm">{i + 1}. {p}</span>
                    <Estrelas valor={notas[p] ?? 0}
                      onChange={(n) => setNotas({ ...notas, [p]: n })} />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <label className="label">Comentários (opcional)</label>
                <textarea className="input" rows={3} value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Deixe sua sugestão ou elogio…" />
              </div>
              <div className="mt-5">
                <button onClick={enviar} disabled={enviando}
                  className="text-white font-semibold rounded-lg px-6 py-2.5 disabled:opacity-50"
                  style={{ background: cor }}>
                  {enviando ? "Enviando…" : "Enviar avaliação"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AvaliarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Carregando…</div>}>
      <AvaliarInner />
    </Suspense>
  );
}
