"use client";

// Tira-dúvidas da Base de Conhecimento (Fase 1). Toda resposta sai com o
// alerta curto de proteção contratual + carimbo de identificação (decisão
// Renato 06/08). As respostas usam SOMENTE a base, com fontes citadas.

import { useRef, useState } from "react";
import Shell from "@/components/Shell";
import { BaseResposta, basePerguntar } from "@/lib/api";

type Msg = { de: "eu" | "ia"; texto: string; r?: BaseResposta };

export default function PerguntarPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  async function enviar() {
    const p = texto.trim();
    if (!p || carregando) return;
    setMsgs((m) => [...m, { de: "eu", texto: p }]);
    setTexto("");
    setCarregando(true);
    try {
      const r = await basePerguntar(p);
      setMsgs((m) => [...m, { de: "ia", texto: r.resposta, r }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMsgs((m) => [...m, { de: "ia", texto: "Erro: " + msg }]);
    } finally {
      setCarregando(false);
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <Shell>
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">❓ Tira-dúvidas da rede</h1>
          <p className="text-sm text-gray-500">
            Pergunte sobre manuais, treinamentos, produtos, receitas e
            procedimentos. As respostas vêm <b>somente</b> da base oficial da
            franqueadora, com as fontes citadas.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
            ⚠ Conteúdo de uso interno da rede, protegido pelo contrato de
            franquia (multa e responsabilização cível/criminal). Todo acesso é
            registrado com usuário, IP, data e hora.
          </p>
        </div>

        <div className="space-y-3">
          {msgs.map((m, i) => (
            <div key={i} className={m.de === "eu"
              ? "bg-blue-50 border border-blue-100 rounded-lg p-3 ml-10"
              : "bg-white border rounded-lg p-3 mr-10"}>
              <div className="text-sm whitespace-pre-wrap">{m.texto}</div>
              {m.r?.fontes && m.r.fontes.length > 0 && (
                <div className="mt-2 text-xs text-gray-500 border-t pt-1">
                  Fontes: {m.r.fontes.map((f, j) => (
                    <span key={j}>
                      {j > 0 && " · "}
                      {f.url ? (
                        <a href={f.url} target="_blank" rel="noreferrer"
                          className="text-blue-600 underline">{f.titulo}</a>
                      ) : f.titulo}
                    </span>
                  ))}
                </div>
              )}
              {m.r?.carimbo && (
                <div className="mt-1 text-[11px] text-gray-400">
                  Gerado para {m.r.carimbo.nome} · {m.r.carimbo.email} · IP{" "}
                  {m.r.carimbo.ip} · {m.r.carimbo.quando} · acesso registrado
                </div>
              )}
            </div>
          ))}
          {carregando && (
            <div className="text-sm text-gray-400">Consultando a base...</div>
          )}
          <div ref={fimRef} />
        </div>

        <div className="flex gap-2 sticky bottom-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar()}
            placeholder="Ex.: como faço o teste de pisada?"
            className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white" />
          <button onClick={enviar} disabled={carregando || !texto.trim()}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-40">
            Perguntar
          </button>
        </div>
      </div>
    </Shell>
  );
}
