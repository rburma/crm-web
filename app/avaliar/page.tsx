"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  publicoAvaliacaoForm,
  publicoAvaliar,
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
  const numero = (sp?.get("n") ?? "").replace(/^#/, "");
  const email = sp?.get("e") ?? "";

  const [form, setForm] = useState<PublicoAvaliacaoForm | null>(null);
  const [erro, setErro] = useState("");
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const cor = form?.marca_tema?.cor || "#0f6bd7";

  useEffect(() => {
    if (!numero || !email) { setErro("Link inválido — abra pela página de acompanhamento."); return; }
    publicoAvaliacaoForm(numero, email)
      .then(setForm)
      .catch(() => setErro("Atendimento não encontrado. Confira o número e o e-mail."));
  }, [numero, email]);

  async function enviar() {
    if (!form) return;
    const dadas = Object.fromEntries(Object.entries(notas).filter(([, v]) => v >= 1));
    if (Object.keys(dadas).length === 0) { setErro("Dê ao menos uma nota."); return; }
    setEnviando(true); setErro("");
    try {
      await publicoAvaliar(numero, email, dadas, comentario.trim() || undefined);
      setEnviado(true);
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] py-8 px-4">
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
          {erro && !form && <p className="text-sm text-slate-500">{erro}</p>}

          {form && (enviado || form.ja_avaliada) && (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">🙏</div>
              <h2 className="text-xl font-bold mb-1">Obrigado!</h2>
              <p className="text-sm text-slate-500">
                {enviado ? "Sua avaliação foi registrada com sucesso."
                  : "Este atendimento já foi avaliado."}
              </p>
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
