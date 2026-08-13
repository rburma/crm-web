"use client";

// Base de Conhecimento — upload em LOTE: o lote define o público (marca +
// nível + classes) e todos os arquivos escolhidos herdam esses campos.
// Uploads seguem em paralelo, DIRETO ao Render (proxy limita 4,5MB).

import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import {
  BaseConteudoItem, BaseMedicao, BaseOpcoes, BaseProgresso, BaseVetores,
  baseContarOnboarding, baseConteudos, baseLote, baseOpcoes, basePreparar,
  baseProgresso, baseProjetarOnboarding, baseTicket, baseUploadDireto,
  baseVetoresLote, baseVetoresProgresso,
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
  const [medicao, setMedicao] = useState<BaseMedicao | null>(null);
  const [idiomas, setIdiomas] = useState<Record<string, number>>({});
  const [medindo, setMedindo] = useState("");

  const [prog, setProg] = useState<BaseProgresso | null>(null);
  const pararRef = useRef(false);

  // Onboarding: so CONTA os tokens das transcricoes e mostra o preco.
  // Nao gera texto nem grava nada — e seguro clicar. Em lotes, igual a
  // indexacao: cada volta e uma requisicao curta.
  async function medirCusto() {
    setMedicao(null);
    setIdiomas({});
    setMedindo("Contando os tokens das transcrições...");
    try {
      let inicio = 0;
      let tokens = 0;
      let arquivos = 0;
      const idi: Record<string, number> = {};
      for (;;) {
        const c = await baseContarOnboarding(inicio);
        if (c.erro) { setMedindo(c.erro); return; }
        tokens += c.tokens;
        arquivos += c.arquivos_medidos;
        for (const [k, v] of Object.entries(c.por_idioma)) {
          idi[k] = (idi[k] || 0) + v;
        }
        setMedindo(`Contando ${arquivos} de ${c.arquivos} transcrições...`);
        if (c.proximo === null) break;
        inicio = c.proximo;
      }
      setIdiomas(idi);
      setMedicao(await baseProjetarOnboarding(tokens, arquivos));
      setMedindo("");
    } catch (e) {
      setMedindo("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Indexa em lotes pequenos: cada volta e uma requisicao CURTA. Se o
  // servidor reiniciar, e so clicar de novo — a fila fica no banco.
  async function indexar(completo = false) {
    if (completo && !window.confirm(
      "Refazer a indexação do ZERO? Leva bem mais tempo.")) return;
    pararRef.current = false;
    setStatusIdx("Montando a fila de arquivos...");
    try {
      let p = await basePreparar(completo);
      setProg(p);
      while (p.pendentes > 0 && !pararRef.current) {
        setStatusIdx(`Indexando ${p.feitos} de ${p.total} (${p.percentual}%)`);
        try {
          p = await baseLote(4);
        } catch {
          // erro de rede/reinício: espera e tenta de novo do ponto atual
          await new Promise((r) => setTimeout(r, 5000));
          try { p = await baseProgresso(); } catch { break; }
        }
        setProg(p);
      }
      setStatusIdx(pararRef.current
        ? `Pausado em ${p.feitos} de ${p.total}`
        : `Concluída: ${p.ok} indexados, ${p.vazios} sem texto, ` +
          `${p.erros} com erro, ${p.grandes} grandes demais — ` +
          `${p.trechos} trechos no índice`);
    } catch (e: unknown) {
      setStatusIdx(e instanceof Error ? e.message : String(e));
    }
  }

  const [vet, setVet] = useState<BaseVetores | null>(null);

  // Gera os vetores de significado em lotes (busca semantica).
  async function gerarVetores() {
    pararRef.current = false;
    try {
      let v = await baseVetoresProgresso();
      setVet(v);
      if (!v.configurado) {
        setStatusIdx("Falta a chave VOYAGE_API_KEY no servidor.");
        return;
      }
      let seguidas = 0;  // falhas em sequencia: nao girar em falso
      while (v.faltam > 0 && !pararRef.current) {
        setStatusIdx(`Entendendo o conteúdo: ${v.com_vetor} de ${v.total} (${v.percentual}%)`);
        try {
          const antes = v.com_vetor;
          // 32 por requisição (o servidor divide em chamadas de 8 à Voyage):
          // menos idas e vindas, mesma folga de memória.
          v = await baseVetoresLote(32);
          seguidas = v.com_vetor > antes ? 0 : seguidas + 1;
        } catch (e: unknown) {
          seguidas += 1;
          const msg = e instanceof Error ? e.message : String(e);
          setStatusIdx(`Erro ao gerar vetores: ${msg}`);
          if (seguidas >= 3) return;   // mostra o erro e para
          await new Promise((r) => setTimeout(r, 4000));
          try { v = await baseVetoresProgresso(); } catch { return; }
        }
        if (seguidas >= 3) {
          setStatusIdx("Parou sem avançar — veja o motivo em /base/diagnostico");
          return;
        }
        setVet(v);
      }
      setStatusIdx(pararRef.current
        ? `Pausado: ${v.com_vetor} de ${v.total}`
        : `Busca semântica pronta: ${v.com_vetor} trechos (${v.modelo})`);
    } catch (e: unknown) {
      setStatusIdx(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    baseProgresso().then((p) => {
      setProg(p);
      if (p.total) setStatusIdx(`${p.feitos} de ${p.total} indexados`);
    }).catch(() => {});
    baseVetoresProgresso().then(setVet).catch(() => {});
  }, []);

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
            <button onClick={() => indexar(false)}
              disabled={!!prog && prog.pendentes > 0 && !pararRef.current}
              className="text-sm border rounded px-3 py-1 bg-white hover:bg-gray-50 disabled:opacity-40">
              ▶️ Indexar / continuar
            </button>
            <button onClick={() => indexar(true)}
              className="text-sm border rounded px-3 py-1 text-gray-500 hover:bg-gray-50">
              🔄 refazer do zero
            </button>
            <button onClick={gerarVetores}
              className="text-sm border rounded px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100">
              🧠 entender conteúdo{vet && vet.faltam > 0 ? ` (${vet.faltam})` : ""}
            </button>
            <button onClick={() => { pararRef.current = true; }}
              className="text-sm border rounded px-3 py-1 text-amber-700 hover:bg-amber-50">
              ⏸ pausar
            </button>
            <button onClick={medirCusto} disabled={!!medindo}
              className="text-sm border rounded px-3 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              💲 medir custo do onboarding
            </button>
            {statusIdx && (
              <span className="text-xs text-gray-600">{statusIdx}</span>
            )}
          </div>
          {prog && prog.total > 0 && (
            <div className="mt-1 h-2 w-full rounded bg-gray-200">
              <div className="h-2 rounded bg-green-600 transition-all"
                style={{ width: `${prog.percentual}%` }} />
            </div>
          )}
          {medindo && (
            <div className="mt-2 text-xs text-gray-600">{medindo}</div>
          )}
          {medicao && (
            <div className="mt-2 rounded border bg-gray-50 p-3 text-sm">
              <div className="font-semibold">
                Custo de resumir {medicao.arquivos} transcrições
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {medicao.tokens_entrada_total.toLocaleString("pt-BR")} tokens de
                entrada (medidos) +{" "}
                {medicao.tokens_saida_estimados.toLocaleString("pt-BR")} de saída
                (estimados)
                {Object.keys(idiomas).length > 0 && (
                  <>. Idiomas:{" "}
                    {Object.entries(idiomas)
                      .map(([k, v]) => `${k}: ${v}`).join(", ")}</>
                )}
              </div>
              <table className="mt-2 text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pr-6">modelo</th>
                    <th className="pr-6">normal</th>
                    <th>em lote (-50%)</th>
                  </tr>
                </thead>
                <tbody>
                  {medicao.custos.map((c) => (
                    <tr key={c.modelo}>
                      <td className="pr-6">{c.rotulo}</td>
                      <td className="pr-6">US$ {c.normal_usd.toFixed(2)}</td>
                      <td className="font-semibold">
                        US$ {c.lote_usd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-xs text-gray-500">{medicao.nota}</div>
            </div>
          )}
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
