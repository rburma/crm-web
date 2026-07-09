"use client";

// Cotacoes de atacado (Monitor de Precos) — spec Renato 08/07:
// alertas no topo + destaques configuraveis com grafico + busca autocomplete +
// grupos (batatas/carnes/lacteos) + regioes selecionaveis. Fontes: Ceasas
// (fase 1 = CEASA/PR); celula sem cotacao publicada fica vazia, nunca estimada.
import { useEffect, useMemo, useRef, useState } from "react";
import Shell from "@/components/Shell";
import {
  me,
  obterPreferencia,
  precosAlertas,
  precosAnalise,
  precosAtualizar,
  precosBusca,
  precosCentrais,
  precosComparativo,
  precosPainel,
  precosSerie,
  precosStatus,
  salvarPreferencia,
  type PrecoAlertaItem,
  type PrecoCentral,
  type PrecoDestaque,
  type PrecoProduto,
  type PrecoSeriePonto,
  type PrecoStatus,
} from "@/lib/api";

const GLOBAIS = ["admin", "rede", "matriz"];
const CORES = ["#0369a1", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0d9488"];
const GRUPOS = [
  { rotulo: "Batatas", termo: "batata" },
  { rotulo: "Laranjas", termo: "laranja" },
  { rotulo: "Tomates", termo: "tomate" },
  { rotulo: "Cebolas", termo: "cebola" },
  { rotulo: "Bananas", termo: "banana" },
  { rotulo: "Ovos", termo: "ovos" },
];
const DESTAQUES_PADRAO = ["batata florão", "batata asterix", "laranja pêra", "tomate italiano", "cebola"];

function fmtBR(v: number | null | undefined, dec = 2): string {
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtDia(iso: string): string {
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}

// Grafico de linhas interativo: 1 linha por cidade; pontos clicaveis (mostra
// cidade + data + cotacao); eixo X com marcas de MES (historico de ate 1 ano).
type Pt = { data: string; cidade: string; v: number };
function SerieChart({ pontos, altura, onPick }: { pontos: Pt[]; altura?: number; onPick?: (p: Pt) => void }) {
  const [sel, setSel] = useState<Pt | null>(null);
  const W = 560;
  const H = altura ?? 130;
  const cidades = [...new Set(pontos.map((p) => p.cidade))];
  const datas = [...new Set(pontos.map((p) => p.data))].sort();
  if (!datas.length) return <div className="py-6 text-center text-xs text-slate-400">Sem histórico ainda — use Atualizar (ou a carga histórica do admin).</div>;
  const vals = pontos.map((p) => p.v);
  const vMin = Math.min(...vals);
  const vMax = Math.max(...vals, vMin + 0.01);
  const x = (d: string) => (datas.indexOf(d) / Math.max(1, datas.length - 1)) * (W - 76) + 10;
  const y = (v: number) => H - 14 - ((v - vMin) / (vMax - vMin)) * (H - 34);
  // linhas horizontais de faixa de preco (pedido Renato 09/07)
  const faixas = [0, 0.25, 0.5, 0.75, 1].map((f) => vMin + f * (vMax - vMin));
  // marcas de mes no eixo (1a data de cada mes presente)
  const ticks: string[] = [];
  let mesVisto = "";
  for (const d of datas) { const m = d.slice(0, 7); if (m !== mesVisto) { ticks.push(d); mesVisto = m; } }
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function pick(p: Pt) { setSel(p); if (onPick) onPick(p); }
  return (
    <div>
      <svg viewBox={"0 0 " + W + " " + (H + 16)} className="w-full" role="img" aria-label="Serie de precos">
        {faixas.map((v) => (
          <g key={"f" + v.toFixed(3)}>
            <line x1={10} x2={W - 66} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={0.7} strokeDasharray="3 3" />
            <text x={W - 62} y={y(v) + 3} className="fill-slate-400" style={{ fontSize: 8.5 }}>R$ {fmtBR(v)}</text>
          </g>
        ))}
        {ticks.map((d) => (
          <g key={"t" + d}>
            <line x1={x(d)} x2={x(d)} y1={16} y2={H - 12} stroke="#e2e8f0" strokeWidth={0.6} />
            <text x={x(d)} y={H + 11} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 8.5 }}>
              {MESES[parseInt(d.slice(5, 7), 10) - 1]}{ticks.length > 9 ? "" : "/" + d.slice(2, 4)}
            </text>
          </g>
        ))}
        {cidades.map((cid, ci) => {
          const meus = datas.map((d) => pontos.find((p) => p.data === d && p.cidade === cid)).filter(Boolean) as Pt[];
          const pts = meus.map((p) => x(p.data).toFixed(1) + "," + y(p.v).toFixed(1)).join(" ");
          return (
            <g key={cid}>
              <polyline points={pts} fill="none" stroke={CORES[ci % CORES.length]} strokeWidth={1.6} />
              {meus.map((p) => (
                <circle key={p.data} cx={x(p.data)} cy={y(p.v)} r={meus.length > 40 ? 1.5 : 2.2}
                        fill={CORES[ci % CORES.length]} fillOpacity={0.85} className="cursor-pointer"
                        onClick={() => pick(p)}>
                  <title>{p.cidade + " · " + p.data.slice(8, 10) + "/" + p.data.slice(5, 7) + "/" + p.data.slice(0, 4) + " · R$ " + fmtBR(p.v) + "/kg"}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {cidades.map((cid, ci) => (
          <text key={cid} x={10 + ci * 90} y={10} className="font-medium" fill={CORES[ci % CORES.length]} style={{ fontSize: 9 }}>{cid}</text>
        ))}
      </svg>
      {sel ? (
        <div className="mt-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
          📍 <b>{sel.cidade}</b> · {sel.data.slice(8, 10)}/{sel.data.slice(5, 7)}/{sel.data.slice(0, 4)} · <b>R$ {fmtBR(sel.v)}/kg</b>
        </div>
      ) : <div className="mt-1 text-[10px] text-slate-400">Clique num ponto para ver cidade, data e cotação.</div>}
    </div>
  );
}
export default function CotacoesPage() {
  const [status, setStatus] = useState<PrecoStatus | null>(null);
  const [alertas, setAlertas] = useState<PrecoAlertaItem[]>([]);
  const [destaques, setDestaques] = useState<PrecoDestaque[]>([]);
  const [termosDestaque, setTermosDestaque] = useState<string[]>(DESTAQUES_PADRAO);
  const [novoDestaque, setNovoDestaque] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<{ produto: string; n_centrais: number }[]>([]);
  const [termoSel, setTermoSel] = useState("");
  const [produtos, setProdutos] = useState<PrecoProduto[]>([]);
  const [serieDe, setSerieDe] = useState("");
  const [serie, setSerie] = useState<PrecoSeriePonto[]>([]);
  const [cidadesSel, setCidadesSel] = useState<string[]>([]);
  const [periodo, setPeriodo] = useState(365);
  const [analiseTxt, setAnaliseTxt] = useState<string | null>(null);
  const [analiseEm, setAnaliseEm] = useState<string | null>(null);
  const [analiseAberta, setAnaliseAberta] = useState(true);
  const [centrais, setCentrais] = useState<PrecoCentral[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const buscaRef = useRef<number | null>(null);

  async function carregarBase(termos?: string[], dias?: number) {
    const [st, al, pn, ct, an] = await Promise.all([
      precosStatus(), precosAlertas(7), precosPainel(termos, dias ?? periodo), precosCentrais(),
      precosAnalise().catch(() => ({ texto: null, criado_em: null })),
    ]);
    setStatus(st); setAlertas(al.alertas); setDestaques(pn.destaques);
    setCentrais(ct.centrais.filter((c) => c.ativo));
    setAnaliseTxt(an.texto); setAnaliseEm(an.criado_em);
  }

  async function mudarPeriodo(dias: number) {
    setPeriodo(dias);
    try { setDestaques((await precosPainel(termosDestaque, dias)).destaques); } catch { /* ok */ }
    if (serieDe) { try { setSerie((await precosSerie(serieDe, dias)).pontos); } catch { /* ok */ } }
  }

  useEffect(() => {
    (async () => {
      try {
        const eu = await me().catch(() => null);
        setIsAdmin(!!eu && GLOBAIS.includes(eu.papel));
        let termos = DESTAQUES_PADRAO;
        try {
          const pref = await obterPreferencia<{ destaques?: string[]; cidades?: string[] }>("cotacoes");
          if (pref.destaques && pref.destaques.length) { termos = pref.destaques; setTermosDestaque(pref.destaques); }
          if (pref.cidades && pref.cidades.length) setCidadesSel(pref.cidades);
        } catch { /* sem preferencia salva */ }
        await carregarBase(termos);
      } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar"); }
      setLoading(false);
    })();
  }, []);

  // Autocomplete: busca conforme digita (300ms de folga).
  useEffect(() => {
    if (buscaRef.current) window.clearTimeout(buscaRef.current);
    if (busca.trim().length < 2) { setSugestoes([]); return; }
    buscaRef.current = window.setTimeout(async () => {
      try { setSugestoes((await precosBusca(busca.trim())).itens); } catch { setSugestoes([]); }
    }, 300);
  }, [busca]);

  async function abrirTermo(t: string) {
    setTermoSel(t); setSugestoes([]); setSerieDe(""); setSerie([]);
    try { setProdutos((await precosComparativo(t)).produtos); }
    catch (e) { setErro(e instanceof Error ? e.message : "Erro na busca"); }
  }

  async function abrirSerie(produto: string) {
    setSerieDe(produto);
    try { setSerie((await precosSerie(produto, periodo)).pontos); } catch { setSerie([]); }
  }

  async function atualizar(backfill = 0) {
    setBusy(true); setErro(""); setMsg("");
    try {
      const r = await precosAtualizar(backfill);
      setMsg(r.msg);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao atualizar"); }
    setBusy(false);
  }

  async function salvarDestaques(lista: string[]) {
    setTermosDestaque(lista);
    try { await salvarPreferencia("cotacoes", { destaques: lista, cidades: cidadesSel }); } catch { /* ok */ }
    try { setDestaques((await precosPainel(lista, periodo)).destaques); } catch { /* ok */ }
  }

  // Cidades presentes nos resultados (colunas da tabela); filtro do franqueado.
  const cidadesDosDados = useMemo(() => {
    const s = new Set<string>();
    produtos.forEach((p) => p.precos.forEach((c) => s.add(c.cidade)));
    return [...s].sort();
  }, [produtos]);
  const colunas = cidadesDosDados.filter((c) => !cidadesSel.length || cidadesSel.includes(c));

  function toggleCidade(c: string) {
    const nova = cidadesSel.includes(c) ? cidadesSel.filter((x) => x !== c) : [...cidadesSel, c];
    setCidadesSel(nova);
    salvarPreferencia("cotacoes", { destaques: termosDestaque, cidades: nova }).catch(() => undefined);
  }

  const seriePts = useMemo(
    () => serie.filter((p) => p.preco_kg != null).map((p) => ({ data: p.data, cidade: p.cidade, v: p.preco_kg as number })),
    [serie],
  );

  return (
    <Shell title="Cotações de atacado">
      <div className="space-y-4">
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="grow">
            <div className="text-lg font-semibold text-slate-800">📈 Cotações de atacado (Ceasas)</div>
            <div className="text-xs text-slate-500">
              {status?.ultima_coleta_em
                ? "Última atualização: " + new Date(status.ultima_coleta_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) + " · " + status.total_registros.toLocaleString("pt-BR") + " preços no histórico"
                : "Nenhuma coleta ainda — clique em Atualizar."}
            </div>
          </div>
          <button className="btn-primary text-sm" disabled={busy || (status ? !status.pode_atualizar : false)}
                  onClick={() => atualizar(0)}
                  title={status && !status.pode_atualizar ? "As cotações de hoje já foram atualizadas" : "Buscar as cotações de hoje nas fontes"}>
            {busy ? "Atualizando…" : status && !status.pode_atualizar ? "✓ Atualizado hoje" : "🔄 Atualizar agora"}
          </button>
          {isAdmin ? (
            <button className="btn-ghost text-sm" disabled={busy} onClick={() => atualizar(365)}
                    title="Admin: baixa o histórico dos últimos 12 meses das fontes (roda em segundo plano)">
              📚 Carga histórica 12m
            </button>
          ) : null}
        </div>
        {msg ? <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</div> : null}
        {erro ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{erro}</div> : null}

        {analiseTxt ? (
          <div className="card border-l-4 border-violet-400 p-4">
            <button className="flex w-full items-center gap-2 text-left" onClick={() => setAnaliseAberta(!analiseAberta)}>
              <span className="text-sm font-semibold text-slate-800">🔮 Tendências e análise de preços (IA)</span>
              <span className="text-[11px] text-slate-400">
                {analiseEm ? "gerada em " + new Date(analiseEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""}
              </span>
              <span className="ml-auto text-slate-400">{analiseAberta ? "▾" : "▸"}</span>
            </button>
            {analiseAberta ? (
              <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-slate-700">
                {analiseTxt.split(String.fromCharCode(10)).filter((l) => l.trim()).map((l, i) => {
                  let cls = "";
                  if (l.includes("[FORTE ALTA]")) cls = "text-red-700";
                  else if (l.includes("[ALTA]")) cls = "text-red-600";
                  else if (l.includes("[FORTE QUEDA]")) cls = "text-emerald-700";
                  else if (l.includes("[QUEDA]")) cls = "text-emerald-600";
                  const partes = l.split("**");
                  return (
                    <p key={i} className={cls}>
                      {partes.map((seg, j) => (j % 2 ? <b key={j}>{seg}</b> : <span key={j}>{seg}</span>))}
                    </p>
                  );
                })}
                <p className="pt-1 text-[10px] text-slate-400">⚠️ Análise gerada por inteligência artificial com base nas nossas cotações + notícias de mercado (safra, clima, economia). É orientação, não garantia — os preços das tabelas continuam vindo só das fontes oficiais. Atualiza a cada "Atualizar agora".</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="card flex flex-wrap items-center gap-1.5 p-3">
          <span className="text-xs font-semibold text-slate-600">Praças:</span>
          <button onClick={() => { setCidadesSel([]); salvarPreferencia("cotacoes", { destaques: termosDestaque, cidades: [] }).catch(() => undefined); }}
                  className={"rounded-full px-2.5 py-1 text-xs " + (!cidadesSel.length ? "bg-slate-800 text-white" : "border hover:bg-slate-50")}>
            Todas
          </button>
          {[...new Set(centrais.map((c) => c.estado).filter((x): x is string => !!x))].map((uf) => {
            const doUf = centrais.filter((c) => c.estado === uf).map((c) => c.cidade);
            const ligado = doUf.length > 0 && doUf.every((c) => cidadesSel.includes(c));
            return (
              <button key={uf} onClick={() => {
                        const nova = ligado ? cidadesSel.filter((c) => !doUf.includes(c)) : [...new Set([...cidadesSel, ...doUf])];
                        setCidadesSel(nova);
                        salvarPreferencia("cotacoes", { destaques: termosDestaque, cidades: nova }).catch(() => undefined);
                      }}
                      className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (ligado ? "bg-brand-600 text-white" : "border hover:bg-slate-50")}
                      title={"Todas as praças de " + uf}>
                {uf}
              </button>
            );
          })}
          <span className="mx-1 text-slate-300">|</span>
          {centrais.map((c) => (
            <button key={c.id} onClick={() => toggleCidade(c.cidade)}
                    className={"rounded-full px-2 py-0.5 text-[11px] " + (!cidadesSel.length || cidadesSel.includes(c.cidade) ? "bg-brand-600 text-white" : "border text-slate-400 hover:bg-slate-50")}
                    title={c.central}>
              {c.cidade}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-slate-400">SP e interior entram na fase 2 (CEAGESP/CONAB)</span>
        </div>


        {alertas.length ? (
          <div className="card p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700">🔔 Alertas (últimos 7 dias) — variação ≥ 10%</div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {alertas.map((al, i) => (
                <button key={i} onClick={() => abrirTermo(al.produto)}
                        className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-50">
                  <span className={al.tipo.startsWith("alta") || al.tipo === "acima_sazonal" ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>
                    {al.tipo === "alta_rapida" ? "🔺🔺" : al.tipo === "queda_rapida" ? "🟢🟢" : al.tipo === "acima_sazonal" ? "📈" : al.tipo === "abaixo_sazonal" ? "📉" : al.tipo === "alta" ? "🔴" : "🟢"}
                    {al.variacao_pct > 0 ? " +" : " "}{fmtBR(al.variacao_pct, 1)}%
                  </span>{" "}
                  <span className="font-medium text-slate-700">{al.produto}</span>
                  <span className="text-slate-500">
                    {al.tipo === "acima_sazonal" ? " em " + al.cidade + ": R$ " + fmtBR(al.preco_novo) + "/kg — ACIMA do padrão desta época do ano (histórico R$ " + fmtBR(al.preco_anterior) + ")"
                     : al.tipo === "abaixo_sazonal" ? " em " + al.cidade + ": R$ " + fmtBR(al.preco_novo) + "/kg — ABAIXO do padrão desta época do ano (histórico R$ " + fmtBR(al.preco_anterior) + ")"
                     : al.tipo === "alta_rapida" ? " em " + al.cidade + ": subindo RÁPIDO — R$ " + fmtBR(al.preco_anterior) + " → R$ " + fmtBR(al.preco_novo) + " em 1 semana"
                     : al.tipo === "queda_rapida" ? " em " + al.cidade + ": caindo RÁPIDO — R$ " + fmtBR(al.preco_anterior) + " → R$ " + fmtBR(al.preco_novo) + " em 1 semana"
                     : " em " + al.cidade + ": R$ " + fmtBR(al.preco_anterior) + " → R$ " + fmtBR(al.preco_novo) + " (" + fmtDia(al.data) + ")"}
                  </span>
                  {al.tipo === "queda" || al.tipo === "queda_rapida" || al.tipo === "abaixo_sazonal" ? <span className="ml-1 rounded bg-emerald-100 px-1 text-emerald-700">★ oportunidade de estocagem</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="grow text-sm font-semibold text-slate-700">📊 Destaques (R$/kg — mediana semanal por praça)</div>
            {[{ d: 7, r: "7 dias" }, { d: 30, r: "30 dias" }, { d: 90, r: "3 meses" }, { d: 365, r: "12 meses" }].map((o) => (
              <button key={o.d} onClick={() => mudarPeriodo(o.d)}
                      className={"rounded-full px-2 py-0.5 text-[11px] " + (periodo === o.d ? "bg-slate-800 text-white" : "border hover:bg-slate-50")}>
                {o.r}
              </button>
            ))}
            <input value={novoDestaque} onChange={(e) => setNovoDestaque(e.target.value)}
                   placeholder="adicionar produto ao painel…" className="input w-48 text-xs"
                   onKeyDown={(e) => {
                     if (e.key === "Enter" && novoDestaque.trim()) {
                       salvarDestaques([...termosDestaque, novoDestaque.trim().toLowerCase()]);
                       setNovoDestaque("");
                     }
                   }} />
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {termosDestaque.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {t}
                <button className="text-slate-400 hover:text-red-600" title="Tirar do painel"
                        onClick={() => salvarDestaques(termosDestaque.filter((x) => x !== t))}>×</button>
              </span>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {destaques.map((d) => (
              <div key={d.termo} className="rounded border border-slate-100 p-2">
                <button className="mb-1 text-xs font-semibold uppercase text-slate-600 hover:text-brand-600"
                        onClick={() => abrirTermo(d.termo)}>{d.termo} →</button>
                <SerieChart pontos={d.pontos.filter((p) => !cidadesSel.length || cidadesSel.includes(p.cidade)).map((p) => ({ data: p.data, cidade: p.cidade, v: p.preco_kg }))} />
                {d.ocultados ? <div className="text-[10px] text-slate-400">{d.ocultados} ponto(s) improvável(is) da fonte ocultado(s) do gráfico</div> : null}
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Fase 1 = Ceasas do PR (hortifrúti). Leite, carnes e frango entram quando as fontes de atacarejo/CONAB forem ligadas; São Paulo (CEAGESP) e demais praças na fase 2.
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold text-slate-700">🔎 Buscar produto</div>
          <div className="relative">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="digite: batata, laranja, alho…"
                   className="input w-full" />
            {busca.trim().length >= 2 && !sugestoes.length ? <div className="mt-1 text-[11px] text-slate-400">Nada publicado com “{busca}” nos últimos 60 dias nas praças coletadas.</div> : null}
            {sugestoes.length ? (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow">
                {sugestoes.map((s) => (
                  <button key={s.produto} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                          onClick={() => { setBusca(""); abrirTermo(s.produto); }}>
                    {s.produto} <span className="text-slate-400">({s.n_centrais} praça{s.n_centrais > 1 ? "s" : ""})</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GRUPOS.map((g) => (
              <button key={g.termo} onClick={() => abrirTermo(g.termo)}
                      className={"rounded-full px-2.5 py-1 text-xs " + (termoSel === g.termo ? "bg-slate-800 text-white" : "border hover:bg-slate-50")}>
                {g.rotulo}
              </button>
            ))}
          </div>
        </div>

        {termoSel ? (
          <div className="card overflow-x-auto p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="grow text-sm font-semibold text-slate-700">Comparativo: “{termoSel}” (último preço por praça)</div>
            </div>
            {loading ? <div className="py-6 text-center text-sm text-slate-400">Carregando…</div> : null}
            {!produtos.length ? (
              <div className="py-4 text-center text-sm text-slate-400">Nenhuma cotação publicada para este termo nos últimos 60 dias.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-2 text-left">Produto (como publicado na fonte)</th>
                    {colunas.map((c) => <th key={c} className="p-2 text-right">{c} (R$/kg)</th>)}
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p) => (
                    <tr key={p.produto} className={"border-t border-slate-100 hover:bg-amber-50 " + (produtos.indexOf(p) % 2 ? "bg-slate-50" : "bg-white")}>
                      <td className="p-2">
                        <button className="text-left font-medium text-slate-700 hover:text-brand-600" onClick={() => abrirSerie(p.produto)}
                                title="Ver histórico (gráfico)">{p.equiv && p.insumo ? p.insumo : p.produto} 📉</button>
                      </td>
                      {colunas.map((cid) => {
                        const cel = p.precos.find((x) => x.cidade === cid);
                        return (
                          <td key={cid} className="p-2 text-right">
                            {cel ? (
                              <span className="inline-flex items-start gap-1">
                                <a href={cel.fonte_url ?? undefined} target="_blank" rel="noreferrer" className="hover:underline"
                                   title={"Publicado em " + fmtDia(cel.data) + (cel.embalagem ? " · " + cel.embalagem + " = R$ " + fmtBR(cel.preco_bruto) : "") + " · clique p/ ver a fonte"}>
                                  <span className="font-semibold text-slate-800">{cel.preco_kg != null ? fmtBR(cel.preco_kg) : "R$ " + fmtBR(cel.preco_bruto) + (cel.embalagem ? "/" + cel.embalagem : "")}</span>
                                  <span className="block text-[10px] text-slate-400">{fmtDia(cel.data)}/{cel.data.slice(2, 4)}</span>
                                </a>
                                {p.equiv ? (
                                  <span className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full bg-amber-400 text-[11px] font-black leading-none text-white"
                                        title={"Preço publicado pela fonte como: " + p.produto + ". " + p.equiv}>!</span>
                                ) : null}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {serieDe ? (
          <div className="card p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700">
              📉 Histórico: {(() => { const pr = produtos.find((x) => x.produto === serieDe); return pr && pr.equiv && pr.insumo ? pr.insumo : serieDe; })()}
              {(() => {
                const pr = produtos.find((x) => x.produto === serieDe);
                return pr && pr.equiv ? (
                  <span className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-amber-400 align-middle text-[11px] font-black leading-none text-white"
                        title={"Preço publicado pela fonte como: " + pr.produto + ". " + pr.equiv}>!</span>
                ) : null;
              })()}
            </div>
            <SerieChart pontos={seriePts.filter((p) => !cidadesSel.length || cidadesSel.includes(p.cidade))} altura={160} />
            <div className="mt-1 text-[11px] text-slate-400">Cada ponto = preço publicado pela fonte no dia (R$/kg). A sazonalidade aparece conforme o histórico cresce (a carga histórica do admin puxa os últimos 12 meses).</div>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
