"use client";
// Portal do candidato (link mágico ?t=token) — substitui o WhatsApp: o
// candidato acompanha fase/status por aqui + e-mail. F1: linha do tempo
// básica; as etapas interativas (vídeos/testes) chegam na Fase 2.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { vagasAcompanhar, type VagasAcompanhar } from "@/lib/api";

const FASES = ["inscricao", "triagem", "videos", "teste", "decisao", "entrevista"];
const ROTULOS: Record<string, string> = {
  inscricao: "Inscrição", triagem: "Triagem", videos: "Vídeos",
  teste: "Teste", decisao: "Análise", entrevista: "Entrevista",
};

function Conteudo() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const [dados, setDados] = useState<VagasAcompanhar | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!token) { setErro("Link inválido."); return; }
    vagasAcompanhar(token).then(setDados).catch((e: Error) => setErro(e.message));
  }, [token]);

  const cor = dados?.marca?.tema?.cor || "#0f172a";
  const idxAtual = Math.max(0, FASES.indexOf(dados?.fase || "inscricao"));
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="text-white px-4 py-6 text-center" style={{ background: cor }}>
        <h1 className="font-extrabold text-lg">🔗 Acompanhe seu processo</h1>
        {dados && (
          <p className="text-xs opacity-90 mt-1">
            {dados.nome} · {dados.cargo || `Franquia — ${dados.cidade || ""}`}
            {dados.loja ? ` · ${dados.loja}` : ""}
          </p>
        )}
      </header>
      <section className="max-w-md mx-auto p-4">
        {erro && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{erro}</div>}
        {!dados && !erro && <div className="text-sm text-slate-500">Carregando…</div>}
        {dados && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex flex-wrap gap-1.5 mb-4">
              {FASES.map((f, i) => (
                <span key={f}
                  className={`text-[11px] px-2.5 py-1 rounded-full border ${
                    i < idxAtual ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                    : i === idxAtual ? "text-white border-transparent"
                    : "bg-slate-50 border-slate-200 text-slate-400"}`}
                  style={i === idxAtual ? { background: cor } : undefined}
                >
                  {ROTULOS[f]}
                </span>
              ))}
            </div>
            {dados.status === "aprovado" && (
              <p className="text-sm font-bold text-emerald-700">✅ Você foi aprovado! A loja vai entrar em contato.</p>
            )}
            {dados.status === "em_processo" && (
              <p className="text-sm text-slate-600">
                Sua candidatura está em análise. Os próximos passos chegam por
                e-mail e aparecem aqui — não precisa fazer nada agora.
              </p>
            )}
            {dados.status === "banco" && (
              <p className="text-sm text-slate-600">
                Seu perfil está no banco de talentos. Se uma vaga abrir, você já
                está na frente.
              </p>
            )}
            {dados.status === "desclassificado" && (
              <p className="text-sm text-slate-600">
                Este processo foi encerrado. Obrigado pelo interesse!
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-4">
              Dúvidas ou exclusão dos seus dados (LGPD): responda o e-mail de
              confirmação que você recebeu.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default function AcompanharPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Carregando…</div>}>
      <Conteudo />
    </Suspense>
  );
}
