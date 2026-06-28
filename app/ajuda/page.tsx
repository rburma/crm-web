"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { iaAjuda, iaManual } from "@/lib/api";

export default function AjudaPage() {
  const [pergunta, setPergunta] = useState("");
  const [conversa, setConversa] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    iaManual()
      .then((r) => setManual(r.markdown))
      .catch(() => setManual(""));
  }, []);

  async function perguntar(e: React.FormEvent) {
    e.preventDefault();
    const q = pergunta.trim();
    if (!q || busy) return;
    setBusy(true);
    setErro("");
    try {
      const r = await iaAjuda(q);
      setConversa((c) => [...c, { q, a: r.resposta }]);
      setPergunta("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao perguntar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Ajuda">
      <div className="max-w-3xl space-y-5">
        <div className="card p-5">
          <div className="text-sm font-semibold text-slate-700">Pergunte a IA de Ajuda</div>
          <p className="text-xs text-slate-500 mt-1 mb-3">
            Tire duvidas de COMO usar o sistema. A IA responde com base no manual (nao acessa dados).
          </p>
          <form onSubmit={perguntar} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Ex.: como atualizo os e-mails em massa?"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
            />
            <button className="btn-primary" disabled={busy}>
              {busy ? "..." : "Perguntar"}
            </button>
          </form>
          {erro && <div className="mt-3 text-sm text-red-700">{erro}</div>}
          <div className="mt-4 space-y-3">
            {conversa.map((m, i) => (
              <div key={i} className="space-y-1">
                <div className="text-sm font-medium text-slate-700">Voce: {m.q}</div>
                <div className="text-sm text-slate-800 whitespace-pre-wrap rounded-lg bg-slate-50 border border-[var(--line)] p-3">
                  {m.a}
                </div>
              </div>
            ))}
          </div>
        </div>

        <details className="card p-5">
          <summary className="text-sm font-semibold text-slate-700 cursor-pointer">
            Manual completo do sistema
          </summary>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-700" style={{ fontFamily: "inherit" }}>
            {manual || "Carregando..."}
          </pre>
        </details>
      </div>
    </Shell>
  );
}
