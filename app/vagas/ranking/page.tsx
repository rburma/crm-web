"use client";
// 🏆 Ranking de candidatos (wireframe v4): colunas configuráveis (salvas),
// sort em qualquer coluna, ações em MASSA (padrão /boletos: checkbox +
// shift-clique), ficha abre em JANELA NOVA (estado preservado), parado em
// d/h/min, status Aprovado. Franqueado vê suas lojas; admin vê tudo;
// aba Franquias = candidatos a franqueado (depto Franquias).
import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import VagasNav from "@/components/VagasNav";
import { vagasAcaoLote, vagasRanking, type RankingLinha } from "@/lib/api";

const COLUNAS: { chave: string; rotulo: string; padrao: boolean }[] = [
  { chave: "score", rotulo: "Score", padrao: true },
  { chave: "nome", rotulo: "Candidato", padrao: true },
  { chave: "cargo", rotulo: "Cargo", padrao: true },
  { chave: "loja", rotulo: "Loja", padrao: true },
  { chave: "status", rotulo: "Status", padrao: true },
  { chave: "fase", rotulo: "Fase", padrao: true },
  { chave: "mbi", rotulo: "MBI", padrao: true },
  { chave: "disc", rotulo: "DISC", padrao: true },
  { chave: "alertas", rotulo: "⚠ Alertas", padrao: true },
  { chave: "videos", rotulo: "Vídeos", padrao: false },
  { chave: "cidade", rotulo: "Cidade", padrao: false },
  { chave: "capital", rotulo: "Capital", padrao: false },
  { chave: "redes", rotulo: "Redes", padrao: false },
  { chave: "parado_min", rotulo: "Parado há", padrao: true },
  { chave: "criado_em", rotulo: "Inscrição", padrao: false },
];

function parado(min: number): string {
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return `${d}d ${h}h ${m}min`;
}

function chipStatus(s: string) {
  if (s === "aprovado") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-700 text-white">✅ APROVADO</span>;
  if (s === "desclassificado") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">✖ DESCLASSIF.</span>;
  if (s === "banco") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">⏸ BANCO</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">EM PROCESSO</span>;
}

function chipScore(v: number | null) {
  if (v == null) return <span className="text-slate-300">—</span>;
  const cls = v >= 80 ? "bg-emerald-100 text-emerald-800"
    : v >= 60 ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800";
  return <span className={`inline-block min-w-[42px] text-center px-1.5 py-0.5 rounded-lg font-extrabold ${cls}`}>{Math.round(v)}</span>;
}

export default function RankingPage() {
  const [escopo, setEscopo] = useState<"vagas" | "franquias">("vagas");
  const [linhas, setLinhas] = useState<RankingLinha[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [sort, setSort] = useState("score");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [ultimo, setUltimo] = useState<number | null>(null);
  const [colunas, setColunas] = useState<Set<string>>(
    new Set(COLUNAS.filter((c) => c.padrao).map((c) => c.chave)),
  );
  const [mostraCol, setMostraCol] = useState(false);
  const [convite, setConvite] = useState<{ dia: string; hora: string; local: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const carregouCol = useRef(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("vagas_ranking_colunas");
      if (salvo) setColunas(new Set(JSON.parse(salvo) as string[]));
    } catch { /* padrao */ }
    carregouCol.current = true;
  }, []);
  useEffect(() => {
    if (!carregouCol.current) return;
    try {
      localStorage.setItem("vagas_ranking_colunas", JSON.stringify([...colunas]));
    } catch { /* sem storage */ }
  }, [colunas]);

  const carregar = useCallback(() => {
    vagasRanking({ escopo, q, status_f: statusF, sort, dir, pagina })
      .then((r) => { setLinhas(r.linhas); setTotal(r.total); })
      .catch((e: Error) => setErro(e.message));
  }, [escopo, q, statusF, sort, dir, pagina]);
  useEffect(carregar, [carregar]);

  function ordenar(chave: string) {
    if (sort === chave) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(chave); setDir(chave === "nome" ? "asc" : "desc"); }
  }

  function marcar(id: number, idx: number, shift: boolean) {
    setSel((s) => {
      const novo = new Set(s);
      if (shift && ultimo !== null) {
        const iA = linhas.findIndex((l) => l.id === ultimo);
        if (iA >= 0) {
          const [a, b] = [Math.min(iA, idx), Math.max(iA, idx)];
          for (let i = a; i <= b; i++) novo.add(linhas[i].id);
          return novo;
        }
      }
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
    setUltimo(id);
  }

  async function acao(nome: string, extra?: { dia?: string; hora?: string; local?: string; modelo_tipo?: string }) {
    if (sel.size === 0) return;
    setErro(""); setMsg("");
    try {
      const r = await vagasAcaoLote({ ids: [...sel], acao: nome, ...extra });
      setMsg(`${r.feitos} candidato(s) processado(s).` + (r.erros.length ? ` Avisos: ${r.erros.join("; ")}` : ""));
      setSel(new Set());
      setConvite(null);
      carregar();
    } catch (e) { setErro((e as Error).message); }
  }

  const visiveis = COLUNAS.filter((c) => colunas.has(c.chave));

  function celula(l: RankingLinha, chave: string) {
    switch (chave) {
      case "score": return chipScore(l.score);
      case "nome": return (
        <span>
          <b>{l.nome}</b>
          {l.redes && colunas.has("redes") === false && Object.keys(l.redes).length > 0 && (
            <span className="ml-1 text-slate-400" title={Object.values(l.redes).join(" · ")}>📷</span>
          )}
        </span>
      );
      case "status": return chipStatus(l.status);
      case "fase": return <span className="text-slate-600">{l.fase}</span>;
      case "mbi": return l.mbi != null ? l.mbi.toFixed(1) : "—";
      case "disc": return l.disc || "—";
      case "videos": return l.videos > 0 ? `${l.videos} ▶` : "—";
      case "alertas": return l.alertas > 0 ? (
        <span className={`px-1.5 py-0.5 rounded-lg font-bold ${l.alertas >= 3 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
          title="Sinais de alerta (Murphy/Quinn) detectados pela IA — detalhe na ficha">
          ⚠ {l.alertas}
        </span>
      ) : <span className="text-emerald-600">✓ 0</span>;
      case "parado_min": return (
        <span className={l.parado_min > 5 * 1440 ? "text-amber-600 font-semibold" : ""}>
          {parado(l.parado_min)}{l.parado_min > 5 * 1440 ? " ⏰" : ""}
        </span>
      );
      case "redes": return l.redes ? Object.values(l.redes).map((r) => (
        <a key={r} href={r.startsWith("http") ? r : `https://${r}`} target="_blank"
          rel="noreferrer" className="underline text-indigo-600 block truncate max-w-[140px]">{r}</a>
      )) : "—";
      case "criado_em": return l.criado_em ? l.criado_em.slice(0, 10).split("-").reverse().join("/") : "—";
      case "cargo": return l.cargo || (l.tipo === "popup" ? "Pop-Up" : l.tipo === "franquia" ? "Loja" : "—");
      case "cidade": return [l.cidade, l.uf].filter(Boolean).join("/") || "—";
      default: return (l as unknown as Record<string, unknown>)[chave] as string || "—";
    }
  }

  return (
    <Shell>
      <div className="p-4 max-w-7xl mx-auto">
        <VagasNav atual="ranking" />
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h1 className="text-xl font-bold">🏆 Ranking de candidatos</h1>
          <div className="flex gap-1">
            <button onClick={() => { setEscopo("vagas"); setPagina(1); setSel(new Set()); }}
              className={`text-sm px-3 py-1.5 rounded-lg border ${escopo === "vagas" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300"}`}>
              Vagas
            </button>
            <button onClick={() => { setEscopo("franquias"); setPagina(1); setSel(new Set()); }}
              className={`text-sm px-3 py-1.5 rounded-lg border ${escopo === "franquias" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300"}`}>
              🏪 Franquias
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Ordenado por {sort} ({dir}). Score = notas × pesos das perguntas do funil (0–100). Clique no cabeçalho para ordenar; shift-clique seleciona intervalo; “abrir ↗” abre a ficha em janela nova (esta página fica como está).
        </p>
        <div className="flex gap-2 flex-wrap mb-2">
          <input className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56"
            placeholder="Buscar nome/e-mail/CPF…" value={q}
            onChange={(e) => { setQ(e.target.value); setPagina(1); }} />
          <select className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
            value={statusF} onChange={(e) => { setStatusF(e.target.value); setPagina(1); }}>
            <option value="">Todos os status</option>
            <option value="em_processo">Em processo</option>
            <option value="aprovado">✅ Aprovados</option>
            <option value="banco">⏸ Banco</option>
            <option value="desclassificado">✖ Desclassificados</option>
          </select>
          <button onClick={() => setMostraCol(!mostraCol)}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white">⚙ Colunas ▾</button>
        </div>
        {mostraCol && (
          <div className="border-2 border-indigo-300 bg-white rounded-xl p-3 mb-2 flex flex-wrap gap-3">
            {COLUNAS.map((c) => (
              <label key={c.chave} className="text-xs flex items-center gap-1.5">
                <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                  checked={colunas.has(c.chave)}
                  onChange={(e) => setColunas((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(c.chave); else n.delete(c.chave);
                    return n;
                  })} />
                {c.rotulo}
              </label>
            ))}
            <span className="text-[10px] text-slate-400">(salvo neste navegador)</span>
          </div>
        )}

        {erro && <div className="mb-2 text-sm text-red-600">{erro}</div>}
        {msg && <div className="mb-2 text-sm text-emerald-700">{msg}</div>}
        {sel.size > 0 && (
          <div className="border-2 border-indigo-400 bg-white rounded-xl p-2.5 mb-2 flex items-center gap-2 flex-wrap">
            <b className="text-sm">{sel.size} selecionado(s)</b>
            <button className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
              onClick={() => setConvite({ dia: "", hora: "", local: "na própria loja" })}>
              📧 Convite de entrevista
            </button>
            <button className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold"
              onClick={() => acao("classificar")}>✔ Classificar (avançar fase)</button>
            <button className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#065f46" }}
              onClick={() => acao("aprovar")}>✅ Aprovar</button>
            <button className="text-xs px-2.5 py-1.5 rounded-lg border border-red-300 text-red-700 font-semibold"
              onClick={() => { if (confirm(`Desclassificar ${sel.size} candidato(s)? Um e-mail padrão de dispensa será enviado.`)) acao("desclassificar"); }}>
              ✖ Desclassificar
            </button>
            <button className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-700 font-semibold"
              onClick={() => acao("banco")}>⏸ Banco</button>
            <button className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold"
              onClick={() => acao("reativar")}>▶ Reativar</button>
          </div>
        )}
        {convite && (
          <div className="border-2 border-emerald-400 bg-white rounded-xl p-3 mb-2">
            <b className="text-sm">📧 Convite de entrevista em massa ({sel.size})</b>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              <input className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" placeholder="Dia (ex.: 21/08)"
                value={convite.dia} onChange={(e) => setConvite({ ...convite, dia: e.target.value })} />
              <input className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" placeholder="Hora (ex.: 15:00)"
                value={convite.hora} onChange={(e) => setConvite({ ...convite, hora: e.target.value })} />
              <input className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" placeholder="Local"
                value={convite.local} onChange={(e) => setConvite({ ...convite, local: e.target.value })} />
            </div>
            <div className="mt-2 flex gap-2">
              <button className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                onClick={() => acao("email", { modelo_tipo: "vaga_convite_entrevista", ...convite })}>
                Enviar convites
              </button>
              <button className="text-xs px-3 py-1.5 rounded-lg border border-slate-300"
                onClick={() => setConvite(null)}>Cancelar</button>
              <span className="text-[11px] text-slate-400 self-center">texto do e-mail: modelo “Convite de entrevista” (editável em Configurações → E-mails)</span>
            </div>
          </div>
        )}

        <div className="panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase">
                <th className="p-2 border-b border-slate-200">
                  <input type="checkbox" className="w-4 h-4 accent-indigo-600"
                    checked={sel.size > 0 && sel.size === linhas.length}
                    onChange={(e) =>
                      setSel(e.target.checked ? new Set(linhas.map((l) => l.id)) : new Set())
                    } />
                </th>
                {visiveis.map((c) => (
                  <th key={c.chave} onClick={() => ordenar(c.chave)}
                    className="p-2 border-b border-slate-200 text-left cursor-pointer select-none whitespace-nowrap">
                    {c.rotulo}{sort === c.chave ? (dir === "asc" ? " ▲" : " ▼") : " ▲▼"}
                  </th>
                ))}
                <th className="p-2 border-b border-slate-200"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, idx) => (
                <tr key={l.id} className={`${idx % 2 ? "bg-slate-50/60" : ""} hover:bg-indigo-50/40`}>
                  <td className="p-2 border-b border-slate-100">
                    <input type="checkbox" className="w-4 h-4 accent-indigo-600"
                      checked={sel.has(l.id)}
                      onClick={(e) => marcar(l.id, idx, (e as unknown as MouseEvent).shiftKey)}
                      onChange={() => undefined} />
                  </td>
                  {visiveis.map((c) => (
                    <td key={c.chave} className="p-2 border-b border-slate-100 whitespace-nowrap">
                      {celula(l, c.chave)}
                    </td>
                  ))}
                  <td className="p-2 border-b border-slate-100">
                    {l.oportunidade_id && (
                      <button className="text-indigo-600 font-semibold"
                        onClick={() => window.open(`/atendimentos/${l.oportunidade_id}`, "_blank")}>
                        abrir ↗
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr><td colSpan={visiveis.length + 2} className="p-4 text-slate-400 text-center">
                  Nenhum candidato ainda{escopo === "vagas" ? " — abra vagas na matriz 💼" : ""}.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
          <span>Exibindo {linhas.length ? (pagina - 1) * 50 + 1 : 0}–{(pagina - 1) * 50 + linhas.length} de {total}</span>
          <span className="flex gap-2">
            <button disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40">← Anterior</button>
            <button disabled={pagina * 50 >= total} onClick={() => setPagina(pagina + 1)}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40">Próxima →</button>
          </span>
        </div>
      </div>
    </Shell>
  );
}
