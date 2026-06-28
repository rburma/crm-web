"use client";

import { useState } from "react";
import Link from "next/link";
import { iaAjuda } from "@/lib/api";

// Botao flutuante de AJUDA, em todas as paginas (via Shell), para qualquer usuario.
// Responde duvidas de USO com base no manual (nao acessa dados).
export default function AjudaWidget() {
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [conversa, setConversa] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

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
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      {aberto && (
        <div className="mb-2 flex max-h-[70vh] w-80 max-w-[90vw] flex-col rounded-xl border border-[var(--line)] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">Ajuda do sistema</span>
            <button className="text-slate-400 hover:text-slate-700" onClick={() => setAberto(false)} aria-label="Fechar">
              x
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-auto p-3">
            {conversa.length === 0 && (
              <p className="text-xs text-slate-500">
                Pergunte como usar o sistema (ex.: como atualizo os e-mails em massa?). A IA responde com base no manual.
              </p>
            )}
            {conversa.map((m, i) => (
              <div key={i} className="space-y-1">
                <div className="text-xs font-medium text-slate-600">Voce: {m.q}</div>
                <div className="whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-slate-50 p-2 text-sm text-slate-800">
                  {m.a}
                </div>
              </div>
            ))}
            {erro && <div className="text-sm text-red-700">{erro}</div>}
          </div>
          <form onSubmit={perguntar} className="flex gap-2 border-t border-[var(--line)] p-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Sua duvida..."
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
            />
            <button className="btn-primary text-sm" disabled={busy}>
              {busy ? "..." : "Enviar"}
            </button>
          </form>
          <div className="px-3 pb-2 text-right">
            <Link href="/ajuda" className="text-xs text-brand-700 hover:underline">
              Ver manual completo
            </Link>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="btn-primary rounded-full shadow-lg"
        title="Ajuda — como usar o sistema"
      >
        ? Ajuda
      </button>
    </div>
  );
}
