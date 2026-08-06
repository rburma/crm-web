"use client";

// Base de Conhecimento — upload em LOTE: o lote define o público (marca +
// nível + classes) e todos os arquivos escolhidos herdam esses campos.
// Uploads seguem em paralelo, DIRETO ao Render (proxy limita 4,5MB).

import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import {
  BaseConteudoItem, BaseOpcoes, baseConteudos, baseIndexar,
  baseIndexarStatus, baseOpcoes, baseTicket, baseUploadDireto,
} from "@/lib/api";

type ItemFila = {
  arquivo: File;
  estado: "aguardando" | "subindo" | "ok" | "erro";
  msg?: string;
  link?: string;
};

export default function BaseConhecimentoPage() {
  const [opcoes, setOpcoes] = useState<BaseOpcoes | null>(null);
  const [marca, setMarca] = useState("Todas as marcas");
  const [nivel, setNivel] = useState("Lojas");
  const [receituario, setReceituario] = useState(false);
  const [soFranqueados, setSoFranqueados] = useState(false);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [historico, setHistorico] = useState<BaseConteudoItem[]>([]);
  const [erro, setErro] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    baseOpcoes().then(setOpcoes).catch((e) => setErro(String(e.message || e)));
    baseConteudos().then(setHistorico).catch(() => {});
  }, []);

  function escolher(files: FileList | null) {
    if (!files || !files.length) return;
    const novos = Array.from(files).map((f) => ({
      arquivo: f, estado: "aguardando" as const,
    }));
    setFila((q) => [...q, ...novos]);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Sobe os arquivos indicados. LIMITE de 3 por vez + 3 tentativas com espera
  // crescente: mandar tudo de uma vez derrubava o servidor ("Failed to fetch").
  async function enviar(indices: number[]) {
    if (indices.length === 0 || subindo) return;
    setSubindo(true);
    setErro("");
    try {
      const { ticket } = await baseTicket();
      const classes = [
        receituario ? "receituario" : "",
        soFranqueados ? "so_franqueados" : "",
      ].filter(Boolean).join(",");
      const pendentes = [...indices];

      async function trabalhador() {
        for (;;) {
          const idx = pendentes.shift();
          if (idx === undefined) return;
          const item = fila[idx];
          if (!item) continue;
          setFila((q) => q.map((x, i) => (i === idx ? { ...x, estado: "subindo", msg: undefined } : x)));
          let ultimoErro = "";
          for (let tentativa = 1; tentativa <= 3; tentativa++) {
            try {
              const r = await baseUploadDireto(ticket, item.arquivo, marca, nivel, classes);
              setFila((q) => q.map((x, i) =>
                (i === idx ? { ...x, estado: "ok", link: r.box_link, msg: undefined } : x)));
              ultimoErro = "";
              break;
            } catch (e: unknown) {
              ultimoErro = e instanceof Error ? e.message : String(e);
              if (tentativa < 3) {
                setFila((q) => q.map((x, i) => (i === idx
                  ? { ...x, msg: `tentativa ${tentativa} falhou, repetindo...` } : x)));
                await new Promise((r) => setTimeout(r, tentativa * 2500));
              }
            }
          }
          if (ultimoErro) {
            setFila((q) => q.map((x, i) =>
              (i === idx ? { ...x, estado: "erro", msg: ultimoErro } : x)));
          }
        }
      }
      await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
      baseConteudos().then(setHistorico).catch(() => {});
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSubindo(false);
    }
  }

  function enviarLote() {
    const idx = fila.map((i, n) => (i.estado === "aguardando" ? n : -1)).filter((n) => n >= 0);
    return enviar(idx);
  }

  function repetirFalhas() {
    const idx = fila.map((i, n) => (i.estado === "erro" ? n : -1)).filter((n) => n >= 0);
    return enviar(idx);
  }

  const aguardando = fila.filter((i) => i.estado === "aguardando").length;
  const falhas = fila.filter((i) => i.estado === "erro").length;
  const maxMb = opcoes?.max_mb ?? 45;
  const [statusIdx, setStatusIdx] = useState("");

  async function reindexar() {
    try {
      await baseIndexar();
      setStatusIdx("Indexação iniciada...");
      const timer = setInterval(async () => {
        try {
          const s = await baseIndexarStatus();
          setStatusIdx(s.msg);
          if (!s.rodando) clearInterval(timer);
        } catch { clearInterval(timer); }
      }, 4000);
    } catch (e: unknown) {
      setStatusIdx(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Shell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">📚 Base de Conhecimento</h1>
          <p className="text-sm text-gray-500">
            O <b>lote define o público</b>: escolha marca e nível, selecione
            vários arquivos de uma vez e envie. Áudio e vídeo entram na fila
            de transcrição; documentos ficam prontos para a indexação.
            Arquivos acima de {maxMb} MB: suba direto na pasta do Box.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={reindexar}
              className="text-sm border rounded px-3 py-1 bg-white hover:bg-gray-50">
              🔄 Reindexar base (Q&amp;A)
            </button>
            {statusIdx && (
              <span className="text-xs text-gray-500">{statusIdx}</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 space-y-3">
          <div className="font-semibold text-sm">1. Público do lote</div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-sm">
              Marca{" "}
              <select value={marca} onChange={(e) => setMarca(e.target.value)}
                disabled={nivel === "Interno"}
                className="border rounded px-2 py-1">
                {(opcoes?.marcas ?? [marca]).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Nível{" "}
              <select value={nivel} onChange={(e) => setNivel(e.target.value)}
                className="border rounded px-2 py-1">
                {(opcoes?.niveis ?? [nivel]).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="text-sm flex items-center gap-1">
              <input type="checkbox" checked={receituario}
                onChange={(e) => setReceituario(e.target.checked)} />
              Receituário (proteção anti-extração)
            </label>
            <label className="text-sm flex items-center gap-1">
              <input type="checkbox" checked={soFranqueados}
                onChange={(e) => setSoFranqueados(e.target.checked)} />
              Só franqueados (nem callcenter)
            </label>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 space-y-3">
          <div className="font-semibold text-sm">2. Arquivos</div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="cursor-pointer inline-block bg-blue-600 text-white rounded px-4 py-2 text-sm">
              Escolher arquivos
              <input ref={inputRef} type="file" multiple className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.mp3,.m4a,.wav,.mp4,.mov,.wmv,.avi"
                onChange={(e) => escolher(e.target.files)} />
            </label>
            <button onClick={enviarLote}
              disabled={subindo || aguardando === 0}
              className="rounded px-4 py-2 text-sm bg-green-600 text-white disabled:opacity-40">
              {subindo ? "Enviando..." : `Enviar lote (${aguardando})`}
            </button>
            {falhas > 0 && (
              <button onClick={repetirFalhas} disabled={subindo}
                className="rounded px-4 py-2 text-sm bg-amber-600 text-white disabled:opacity-40">
                🔄 Tentar novamente as {falhas} que falharam
              </button>
            )}
            {fila.length > 0 && !subindo && (
              <button onClick={() => setFila((q) => q.filter((i) => i.estado !== "ok"))}
                className="rounded border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                limpar concluídos
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Os arquivos sobem 3 por vez, com 3 tentativas automáticas cada —
            falhas de rede se resolvem sozinhas na maioria das vezes.
          </p>
          {erro && <div className="text-sm text-red-600">{erro}</div>}
          {fila.length > 0 && (
            <ul className="text-sm divide-y">
              {fila.map((i, idx) => (
                <li key={idx} className="py-1 flex items-center gap-2">
                  <span>
                    {i.estado === "ok" ? "✅" : i.estado === "erro" ? "❌"
                      : i.estado === "subindo" ? "⏳" : "•"}
                  </span>
                  <span className="flex-1 truncate">{i.arquivo.name}</span>
                  <span className="text-gray-400">
                    {(i.arquivo.size / 1048576).toFixed(1)} MB
                  </span>
                  {i.link && (
                    <a href={i.link} target="_blank" rel="noreferrer"
                      className="text-blue-600 underline">Box</a>
                  )}
                  {i.msg && (
                    <span className={i.estado === "erro" ? "text-red-600" : "text-gray-500"}>
                      {i.msg}
                    </span>
                  )}
                  {i.estado === "erro" && !subindo && (
                    <button onClick={() => enviar([idx])}
                      className="rounded border border-amber-400 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-50">
                      tentar de novo
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="font-semibold text-sm mb-2">Últimos envios</div>
          {historico.length === 0 ? (
            <div className="text-sm text-gray-400">Nada enviado ainda.</div>
          ) : (
            <ul className="text-sm divide-y">
              {historico.map((h) => (
                <li key={h.id} className="py-1 flex items-center gap-2 flex-wrap">
                  <span className="flex-1 truncate">{h.nome}</span>
                  <span className="text-gray-500">{h.marca} · {h.nivel}</span>
                  {h.classes && (
                    <span className="text-amber-600">{h.classes}</span>
                  )}
                  <span className="text-gray-400">{h.tamanho_mb} MB</span>
                  {h.link && (
                    <a href={h.link} target="_blank" rel="noreferrer"
                      className="text-blue-600 underline">Box</a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Shell>
  );
}
