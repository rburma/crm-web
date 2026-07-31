"use client";
// Portal do candidato (link mágico ?t=token) — Fase 2: o candidato PERCORRE o
// funil por aqui: responde as perguntas da fase, grava/enviar vídeos (máx 3
// min), faz o teste de perfil. Sem WhatsApp: tudo por aqui + e-mail.
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  vagasPortal, vagasPortalResponder, vagasPortalTeste, vagasRecuperarLink,
  type PortalEstado,
} from "@/lib/api";

const MAX_VIDEO_SEG = 180; // 3 minutos (decisão 29/07)

function Recorder({ token, perguntaId, aoEnviar, soAnexo }: {
  token: string; perguntaId: number; aoEnviar: () => void; soAnexo?: boolean;
}) {
  const [gravando, setGravando] = useState(false);
  const [seg, setSeg] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const media = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  async function iniciar() {
    setErro("");
    try {
      // Resolucao/bitrate CONTIDOS (31/07): 3 min ficam em ~15-20MB e o
      // upload nao estoura limites de corpo (o 413 vinha do proxy Vercel).
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        void videoRef.current.play();
      }
      pedacos.current = [];
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(stream, {
          videoBitsPerSecond: 800_000, audioBitsPerSecond: 64_000,
        });
      } catch {
        rec = new MediaRecorder(stream);
      }
      rec.ondataavailable = (e) => { if (e.data.size > 0) pedacos.current.push(e.data); };
      rec.onstop = () => {
        setBlob(new Blob(pedacos.current, { type: rec.mimeType || "video/webm" }));
        stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      };
      media.current = rec;
      rec.start();
      setGravando(true);
      setSeg(0);
      timer.current = setInterval(() => setSeg((s) => {
        if (s + 1 >= MAX_VIDEO_SEG) parar();
        return s + 1;
      }), 1000);
    } catch {
      setErro("Não foi possível acessar a câmera/microfone. Você pode anexar um arquivo de vídeo.");
    }
  }
  function parar() {
    if (timer.current) clearInterval(timer.current);
    if (media.current && media.current.state !== "inactive") media.current.stop();
    setGravando(false);
  }

  async function enviar(arquivo?: File) {
    const dado = arquivo ?? (blob ? new File([blob], "video.webm", { type: blob.type }) : null);
    if (!dado) return;
    if (dado.size > 40 * 1024 * 1024) {
      setErro("Arquivo muito grande (máx 40MB / 3 minutos) — grave novamente ou escolha um arquivo menor.");
      return;
    }
    setEnviando(true); setErro("");
    try {
      const fd = new FormData();
      fd.append("pergunta_id", String(perguntaId));
      fd.append("arquivo", dado);
      const caminho = `publico/vagas/portal/${encodeURIComponent(token)}/video`;
      // Upload DIRETO ao motor (31/07): o proxy da Vercel limita o corpo a
      // 4,5MB e devolvia 413 sem explicação. Fallback: proxy (arquivos pequenos).
      const motor = process.env.NEXT_PUBLIC_MOTOR_URL || "https://crm-motor.onrender.com";
      let r: Response | null = null;
      try {
        r = await fetch(`${motor}/${caminho}`, { method: "POST", body: fd });
      } catch {
        r = null; // CORS/rede — tenta o proxy
      }
      if (!r || (!r.ok && r.status === 401)) {
        r = await fetch(`/api/render/${caminho}`, { method: "POST", body: fd });
      }
      if (!r.ok) {
        if (r.status === 413) {
          throw new Error(
            "O vídeo ficou grande demais para o envio. Grave novamente "
            + "(a nova gravação já sai compactada) ou anexe um arquivo menor.",
          );
        }
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail || `Erro ${r.status}`);
      }
      setBlob(null);
      aoEnviar();
    } catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  }

  return (
    <div className="mt-2">
      <video ref={videoRef} className={`w-full rounded-lg bg-slate-900 ${gravando ? "" : "hidden"}`} playsInline />
      {erro && <div className="text-xs text-red-600 my-1">{erro}</div>}
      <div className="flex gap-2 flex-wrap mt-2">
        {!gravando && !blob && !soAnexo && (
          <button type="button" onClick={iniciar}
            className="text-sm bg-red-600 text-white rounded-lg px-3 py-2 font-semibold">⏺ Gravar agora</button>
        )}
        {gravando && (
          <button type="button" onClick={parar}
            className="text-sm bg-slate-800 text-white rounded-lg px-3 py-2 font-semibold">
            ⏹ Parar ({Math.floor(seg / 60)}:{String(seg % 60).padStart(2, "0")} / 3:00)
          </button>
        )}
        {blob && !enviando && (
          <>
            <button type="button" onClick={() => enviar()}
              className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-2 font-semibold">✔ Enviar vídeo</button>
            <button type="button" onClick={() => setBlob(null)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2">↺ Regravar</button>
          </>
        )}
        {enviando && <span className="text-sm text-slate-500 self-center">Enviando…</span>}
        <label className="text-sm border border-slate-300 rounded-lg px-3 py-2 cursor-pointer">
          📎 {soAnexo ? "Anexar arquivo" : "ou anexar arquivo"}
          <input type="file" accept={soAnexo ? undefined : "video/*"} className="hidden"
            onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} />
        </label>
      </div>
    </div>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const [dados, setDados] = useState<PortalEstado | null>(null);
  const [erro, setErro] = useState("");
  const [valores, setValores] = useState<Record<number, string>>({});
  const [escolhas, setEscolhas] = useState<Record<number, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  // Recuperação de link (31/07): candidato sem o e-mail entra com CPF +
  // nascimento e recebe o link NA TELA — não depende do e-mail chegar.
  const [recCpf, setRecCpf] = useState("");
  const [recNasc, setRecNasc] = useState("");
  const [recMsg, setRecMsg] = useState("");
  const [recLink, setRecLink] = useState("");
  const [recEnviando, setRecEnviando] = useState(false);

  async function recuperar() {
    setRecEnviando(true); setRecMsg("");
    try {
      const r = await vagasRecuperarLink(recCpf, recNasc);
      if (r.ok && r.token) setRecLink(`/vagas/acompanhar?t=${r.token}`);
      else setRecMsg(r.mensagem || "Não encontramos uma candidatura com esses dados.");
    } catch (e) { setRecMsg((e as Error).message); }
    finally { setRecEnviando(false); }
  }

  function carregar() {
    if (!token) return; // sem token: mostra a RECUPERACAO de link abaixo
    vagasPortal(token).then((d) => {
      setDados(d);
      // RASCUNHO local (31/07): caiu a conexão no meio da fase -> respostas
      // digitadas voltam ao reabrir o link (limpas ao concluir a etapa).
      try {
        const v = localStorage.getItem(`vaga_rasc_${token}_${d.fase}`);
        setValores(v ? (JSON.parse(v) as Record<number, string>) : {});
        const e = localStorage.getItem(`vaga_rasc_${token}_teste`);
        setEscolhas(d.teste && e ? (JSON.parse(e) as Record<number, number>) : {});
      } catch {
        setValores({}); setEscolhas({});
      }
    }).catch((e: Error) => setErro(e.message));
  }
  useEffect(carregar, [token]);

  useEffect(() => {
    if (!dados || Object.keys(valores).length === 0) return;
    try { localStorage.setItem(`vaga_rasc_${token}_${dados.fase}`, JSON.stringify(valores)); } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores]);
  useEffect(() => {
    if (!dados?.teste || Object.keys(escolhas).length === 0) return;
    try { localStorage.setItem(`vaga_rasc_${token}_teste`, JSON.stringify(escolhas)); } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolhas]);

  const cor = dados?.marca?.tema?.cor || "#0f172a";
  const idxAtual = Math.max(0, (dados?.fases ?? []).findIndex((f) => f.slug === dados?.fase));
  const pendentes = (dados?.perguntas ?? []).filter(
    (p) => !p.respondida && p.tipo !== "video" && p.tipo !== "anexo",
  );
  const videos = (dados?.perguntas ?? []).filter(
    (p) => !p.respondida && (p.tipo === "video" || p.tipo === "anexo"),
  );

  async function responder() {
    setEnviando(true); setErro(""); setAviso("");
    try {
      const lista = pendentes
        .map((p) => ({ pergunta_id: p.id, valor: valores[p.id] || "" }))
        .filter((r) => r.valor.trim());
      const r = await vagasPortalResponder(token, lista);
      try { localStorage.removeItem(`vaga_rasc_${token}_${dados?.fase}`); } catch { /* */ }
      setAviso(r.avancou ? "Etapa concluída! 🎉" : `Respostas salvas — faltam ${r.faltam}.`);
      carregar();
    } catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  }

  async function enviarTeste() {
    if (!dados?.teste) return;
    const total = dados.teste.itens.length;
    const feitas = Object.keys(escolhas).length;
    if (feitas < total) { setErro(`Responda todas (${feitas}/${total}).`); return; }
    setEnviando(true); setErro("");
    try {
      await vagasPortalTeste(
        token, dados.teste.variacao_id,
        dados.teste.itens.map((_, i) => escolhas[i]),
      );
      try { localStorage.removeItem(`vaga_rasc_${token}_teste`); } catch { /* */ }
      setAviso("Teste concluído! 🎉");
      carregar();
    } catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  }

  const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm";
  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <header className="text-white px-4 py-5 text-center" style={{ background: cor }}>
        <h1 className="font-extrabold text-lg">🔗 Seu processo seletivo</h1>
        {dados && <p className="text-xs opacity-90 mt-1">{dados.nome} · {dados.marca?.nome}</p>}
      </header>
      <section className="max-w-md mx-auto p-4">
        {erro && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-2">{erro}</div>}
        {aviso && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 mb-2">{aviso}</div>}
        {token && !dados && !erro && <div className="text-sm text-slate-500">Carregando…</div>}
        {!token && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-sm font-bold mb-1">🔑 Recuperar acesso à candidatura</p>
            <p className="text-xs text-slate-500 mb-3">
              Perdeu o link ou o e-mail não chegou? Informe seus dados e o link aparece aqui mesmo.
            </p>
            <label className="text-xs font-semibold text-slate-600">CPF</label>
            <input className={inputCls} inputMode="numeric" placeholder="000.000.000-00"
              value={recCpf} onChange={(e) => setRecCpf(e.target.value)} />
            <label className="text-xs font-semibold text-slate-600 mt-2 block">Data de nascimento</label>
            <input className={inputCls} type="date" value={recNasc}
              onChange={(e) => setRecNasc(e.target.value)} />
            {recMsg && <p className="text-xs text-red-600 mt-2">{recMsg}</p>}
            {recLink ? (
              <a href={recLink}
                className="block text-center w-full bg-emerald-600 text-white font-bold rounded-xl px-4 py-3 mt-3">
                ▶ Abrir minha candidatura
              </a>
            ) : (
              <button type="button" disabled={recEnviando || !recCpf || !recNasc}
                onClick={recuperar}
                className="w-full bg-slate-900 text-white font-bold rounded-xl px-4 py-3 mt-3 disabled:opacity-60">
                {recEnviando ? "Buscando…" : "Recuperar link →"}
              </button>
            )}
          </div>
        )}
        {dados && (
          <>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {dados.fases.map((f, i) => (
                <span key={f.slug}
                  className={`text-[11px] px-2.5 py-1 rounded-full border ${
                    i < idxAtual ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                    : i === idxAtual ? "text-white border-transparent"
                    : "bg-slate-50 border-slate-200 text-slate-400"}`}
                  style={i === idxAtual ? { background: cor } : undefined}>
                  {f.nome}
                </span>
              ))}
            </div>
            {dados.status === "aprovado" && (
              <div className="bg-white border border-emerald-300 rounded-2xl p-4 text-sm font-bold text-emerald-700">
                ✅ Você foi aprovado! A loja vai entrar em contato.
              </div>
            )}
            {dados.status === "desclassificado" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-600">
                Este processo foi encerrado. Obrigado pelo interesse!
              </div>
            )}
            {dados.status === "banco" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-600">
                Seu perfil está guardado no banco de talentos. Se uma vaga abrir, você já está na frente.
              </div>
            )}
            {dados.status === "em_processo" && dados.fase === "decisao" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-600">
                Tudo certo por enquanto! Sua candidatura está com a equipe da loja.
                Você recebe um e-mail assim que houver novidade.
              </div>
            )}
            {dados.status === "em_processo" && dados.fase !== "decisao" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                {dados.texto && <p className="text-sm text-slate-700 mb-2 whitespace-pre-line">{dados.texto}</p>}
                {dados.instrucoes && <p className="text-xs text-slate-500 mb-3 whitespace-pre-line">💡 {dados.instrucoes}</p>}

                {dados.teste && (
                  <div>
                    <p className="text-sm font-bold mb-3">📊 Teste de perfil — marque a opção que MAIS combina com você:</p>
                    {dados.teste.itens.map((item, i) => (
                      <div key={i}
                        className={`rounded-xl p-3.5 mb-5 border ${escolhas[i] != null ? "bg-white border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                        <p className="text-sm font-semibold mb-2.5 flex items-start gap-2">
                          <span className={`shrink-0 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${escolhas[i] != null ? "text-white" : "bg-slate-200 text-slate-600"}`}
                            style={escolhas[i] != null ? { background: cor } : undefined}>
                            {escolhas[i] != null ? "✓" : i + 1}
                          </span>
                          {item.texto}
                        </p>
                        <div className="grid grid-cols-1 gap-1.5">
                          {item.opcoes.map((op, j) => (
                            <button key={j} type="button"
                              onClick={() => setEscolhas({ ...escolhas, [i]: j })}
                              className={`text-left text-sm rounded-lg px-3 py-2.5 border ${escolhas[i] === j ? "text-white border-transparent" : "bg-white border-slate-300 hover:bg-slate-50"}`}
                              style={escolhas[i] === j ? { background: cor } : undefined}>
                              {op}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500 mb-2 text-center">
                      {Object.keys(escolhas).length} de {dados.teste.itens.length} respondidas
                    </p>
                    <button type="button" onClick={enviarTeste} disabled={enviando}
                      className="w-full text-white font-bold rounded-xl px-4 py-3 disabled:opacity-60"
                      style={{ background: cor }}>
                      {enviando ? "Enviando…" : "Concluir teste →"}
                    </button>
                  </div>
                )}
                {!dados.teste && (
                  <div>
                    {pendentes.map((p) => (
                      <div key={p.id} className="mb-3">
                        <p className="text-sm font-semibold mb-1">{p.texto}</p>
                        {p.tipo === "sim_nao" && (
                          <div className="flex gap-2">
                            {["Sim", "Não"].map((op) => (
                              <button key={op} type="button"
                                onClick={() => setValores({ ...valores, [p.id]: op })}
                                className={`flex-1 text-sm rounded-lg px-3 py-2 border ${valores[p.id] === op ? "text-white border-transparent" : "bg-white border-slate-300"}`}
                                style={valores[p.id] === op ? { background: cor } : undefined}>
                                {op}
                              </button>
                            ))}
                          </div>
                        )}
                        {p.tipo === "multipla" && (
                          <select className={inputCls} value={valores[p.id] || ""}
                            onChange={(e) => setValores({ ...valores, [p.id]: e.target.value })}>
                            <option value="">Escolha…</option>
                            {(p.opcoes ?? []).map((op) => <option key={op}>{op}</option>)}
                          </select>
                        )}
                        {(p.tipo === "numero" || p.tipo === "data") && (
                          <input className={inputCls} type={p.tipo === "numero" ? "number" : "date"}
                            value={valores[p.id] || ""}
                            onChange={(e) => setValores({ ...valores, [p.id]: e.target.value })} />
                        )}
                        {p.tipo === "aberta" && (
                          <textarea className={inputCls} rows={4}
                            placeholder="Escreva com suas palavras — não há resposta certa."
                            value={valores[p.id] || ""}
                            onChange={(e) => setValores({ ...valores, [p.id]: e.target.value })} />
                        )}
                      </div>
                    ))}
                    {pendentes.length > 0 && (
                      <button type="button" onClick={responder} disabled={enviando}
                        className="w-full text-white font-bold rounded-xl px-4 py-3 disabled:opacity-60 mb-3"
                        style={{ background: cor }}>
                        {enviando ? "Enviando…" : "Enviar respostas →"}
                      </button>
                    )}
                    {videos.map((p) => (
                      <div key={p.id} className="mb-3 border-t border-slate-100 pt-3">
                        <p className="text-sm font-semibold">{p.tipo === "video" ? "🎥" : "📎"} {p.texto}</p>
                        {p.tipo === "video" && (
                          <p className="text-[11px] text-slate-400">máx. 3 minutos · pode gravar direto do celular</p>
                        )}
                        <Recorder token={token} perguntaId={p.id} aoEnviar={carregar}
                          soAnexo={p.tipo === "anexo"} />
                      </div>
                    ))}
                    {pendentes.length === 0 && videos.length > 0 &&
                      videos.every((p) => p.tipo === "anexo") && (
                      <button type="button" disabled={enviando}
                        onClick={() => {
                          setEnviando(true);
                          vagasPortalResponder(token, []).then(() => { setAviso("Etapa concluída! 🎉"); carregar(); })
                            .catch((e: Error) => setErro(e.message))
                            .finally(() => setEnviando(false));
                        }}
                        className="w-full text-white font-bold rounded-xl px-4 py-3 disabled:opacity-60"
                        style={{ background: cor }}>
                        Concluir etapa (anexo é opcional) →
                      </button>
                    )}
                    {pendentes.length === 0 && videos.length === 0 && (
                      <p className="text-sm text-slate-500">Nada pendente nesta etapa — aguarde o próximo passo por e-mail.</p>
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-4">
              {dados.contato ? (
                <>Problemas com o sistema, dúvidas ou exclusão dos seus dados (LGPD):
                  {" "}escreva para <a className="underline" href={`mailto:${dados.contato}`}>{dados.contato}</a>.</>
              ) : (
                "Dúvidas ou exclusão dos seus dados (LGPD): responda o e-mail de confirmação."
              )}
            </p>
          </>
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
