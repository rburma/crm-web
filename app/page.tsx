"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import {
  dashboardResumo,
  fmtDataHora,
  obterPreferencia,
  salvarPreferencia,
  type DashboardConfig,
  type DashboardResumo,
} from "@/lib/api";

const nf = (n: number) => n.toLocaleString("pt-BR");
const fmt1 = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function fmtDur(min: number | null): string {
  if (min == null) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) {
    const r = m % 60;
    return r ? `${h}h ${r}min` : `${h}h`;
  }
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

// ── Catálogo do que é configurável ───────────────────────────────────
const CARDS: { key: string; label: string }[] = [
  { key: "abertos", label: "Atendimentos abertos" },
  { key: "em_espera", label: "Em espera" },
  { key: "encerrados_hoje", label: "Encerrados hoje" },
  { key: "novos_hoje", label: "Novos hoje" },
  { key: "satisfacao", label: "Satisfação média" },
  { key: "tempo_resposta", label: "Tempo médio 1ª resposta" },
  { key: "tempo_resolucao", label: "Tempo médio de resolução" },
  { key: "clientes", label: "Clientes na base" },
];

const SECOES: { key: string; label: string }[] = [
  { key: "volume", label: "Volume de atendimentos" },
  { key: "por_marca", label: "Atendimentos por marca" },
  { key: "satisfacao_marca", label: "Satisfação por marca" },
  { key: "ranking", label: "Ranking de lojas por avaliações" },
  { key: "top_lojas", label: "Top lojas (abertos)" },
  { key: "avaliacoes", label: "Avaliações recentes" },
];

const PERIODOS = [7, 14, 30, 60];
const RANKING_PERIODOS = [7, 30, 90, 365];
const RANKING_LINHAS = [5, 10, 20, 0]; // 0 = todas

type Cfg = Required<DashboardConfig>;

const DEFAULT_CFG: Cfg = {
  cards: {
    abertos: true, em_espera: true, encerrados_hoje: true, novos_hoje: true,
    satisfacao: true, tempo_resposta: true, tempo_resolucao: true, clientes: true,
  },
  secoes: { volume: true, por_marca: true, satisfacao_marca: true, ranking: true, top_lojas: true, avaliacoes: true },
  ordem: SECOES.map((s) => s.key),
  periodo: 14,
  ranking_dias: 30,
  ranking_linhas: 10,
  ranking_ordem: "media",
};

function mergeCfg(saved: DashboardConfig | null): Cfg {
  const known = SECOES.map((s) => s.key);
  const savedOrdem = (saved?.ordem ?? []).filter((k) => known.includes(k));
  const ordem = [...savedOrdem, ...known.filter((k) => !savedOrdem.includes(k))];
  const periodo = saved?.periodo && PERIODOS.includes(saved.periodo) ? saved.periodo : DEFAULT_CFG.periodo;
  const ranking_dias = saved?.ranking_dias && RANKING_PERIODOS.includes(saved.ranking_dias)
    ? saved.ranking_dias : DEFAULT_CFG.ranking_dias;
  const ranking_linhas = typeof saved?.ranking_linhas === "number" && saved.ranking_linhas >= 0 && saved.ranking_linhas <= 500
    ? saved.ranking_linhas : DEFAULT_CFG.ranking_linhas;
  const ranking_ordem = saved?.ranking_ordem === "qtd" ? "qtd" : "media";
  return {
    cards: { ...DEFAULT_CFG.cards, ...(saved?.cards ?? {}) },
    secoes: { ...DEFAULT_CFG.secoes, ...(saved?.secoes ?? {}) },
    ordem,
    periodo,
    ranking_dias,
    ranking_linhas,
    ranking_ordem,
  };
}

function mover(arr: string[], i: number, dir: -1 | 1): string[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

// ── Blocos visuais ───────────────────────────────────────────────────
function Kpi({ rotulo, valor, sub, tom }: { rotulo: string; valor: string; sub?: string; tom?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-500">{rotulo}</div>
      <div className={`mt-1 text-3xl font-bold tracking-tight ${tom ?? "text-slate-800"}`}>{valor}</div>
      {sub ? <div className="mt-0.5 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

function VolumeChart({ dados }: { dados: { dia: string; qtd: number }[] }) {
  const max = Math.max(1, ...dados.map((x) => x.qtd));
  const W = 560;
  const H = 130;
  const n = Math.max(1, dados.length);
  const gap = n > 30 ? 2 : 6;
  const bw = (W - gap * (n - 1)) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Volume de atendimentos por dia">
      {dados.map((x, i) => {
        const h = Math.round((x.qtd / max) * H);
        const px = i * (bw + gap);
        const py = H - Math.max(h, 2);
        const marca = i === 0 || i === n - 1 || i === Math.floor(n / 2);
        return (
          <g key={x.dia}>
            <rect x={px} y={py} width={bw} height={Math.max(h, 2)} rx={n > 30 ? 1 : 3} className="fill-brand-500" />
            {marca ? (
              <text x={px + bw / 2} y={H + 13} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>
                {x.dia.slice(8, 10)}/{x.dia.slice(5, 7)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function BarH({ rotulo, valor, max, texto, cor }: { rotulo: string; valor: number; max: number; texto?: string; cor?: string }) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600 truncate pr-2">{rotulo}</span>
        <span className="text-slate-400 tabular-nums shrink-0">{texto ?? nf(valor)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${cor ?? "bg-brand-500"}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 h-full">
      <div className="text-sm font-semibold text-slate-700 mb-3">{titulo}</div>
      {children}
    </div>
  );
}

function renderKpi(key: string, d: DashboardResumo) {
  switch (key) {
    case "abertos":
      return <Kpi rotulo="Atendimentos abertos" valor={nf(d.abertos)} tom="text-brand-700" />;
    case "em_espera":
      return <Kpi rotulo="Em espera" valor={nf(d.em_espera)} tom="text-amber-600" />;
    case "encerrados_hoje":
      return <Kpi rotulo="Encerrados hoje" valor={nf(d.encerrados_hoje)} tom="text-emerald-600" />;
    case "novos_hoje":
      return <Kpi rotulo="Novos hoje" valor={nf(d.novos_hoje)} />;
    case "satisfacao":
      return (
        <Kpi
          rotulo="Satisfação média"
          valor={d.nps_geral != null ? `${fmt1(d.nps_geral)} ★` : "—"}
          sub="últimos 90 dias"
          tom="text-amber-500"
        />
      );
    case "tempo_resposta":
      return (
        <Kpi
          rotulo="Tempo médio 1ª resposta"
          valor={fmtDur(d.tempo_primeira_resposta_min)}
          sub={`últimos ${d.periodo_dias} dias`}
        />
      );
    case "tempo_resolucao":
      return (
        <Kpi
          rotulo="Tempo médio de resolução"
          valor={fmtDur(d.tempo_resolucao_min)}
          sub={`últimos ${d.periodo_dias} dias`}
        />
      );
    case "clientes":
      return <Kpi rotulo="Clientes na base" valor={nf(d.total_clientes)} />;
    default:
      return null;
  }
}

function renderSecao(key: string, d: DashboardResumo) {
  const maxMarca = Math.max(1, ...d.por_marca.map((m) => m.total));
  const maxLoja = Math.max(1, ...d.top_lojas.map((l) => l.abertos));
  switch (key) {
    case "volume":
      return (
        <Secao titulo={`Volume de atendimentos — últimos ${d.periodo_dias} dias`}>
          <VolumeChart dados={d.volume} />
        </Secao>
      );
    case "por_marca":
      return (
        <Secao titulo="Atendimentos por marca">
          {d.por_marca.length === 0 ? (
            <div className="text-sm text-slate-400">Sem dados ainda.</div>
          ) : (
            <div className="space-y-2.5">
              {d.por_marca.map((m) => (
                <BarH key={m.marca} rotulo={m.marca} valor={m.total} max={maxMarca} texto={`${nf(m.total)} · ${nf(m.abertos)} abertos`} />
              ))}
            </div>
          )}
        </Secao>
      );
    case "satisfacao_marca":
      return (
        <Secao titulo="Satisfação por marca (média 1–5)">
          {d.nps_por_marca.length === 0 ? (
            <div className="text-sm text-slate-400">Sem avaliações recentes.</div>
          ) : (
            <div className="space-y-2.5">
              {d.nps_por_marca.map((m) => (
                <BarH key={m.marca} rotulo={m.marca} valor={m.media} max={5} texto={`${fmt1(m.media)} ★ · ${nf(m.n)}`} cor="bg-amber-400" />
              ))}
            </div>
          )}
        </Secao>
      );
    case "top_lojas":
      return (
        <Secao titulo="Lojas com mais atendimentos abertos">
          {d.top_lojas.length === 0 ? (
            <div className="text-sm text-slate-400">Sem dados ainda.</div>
          ) : (
            <div className="space-y-2.5">
              {d.top_lojas.map((l) => (
                <BarH key={l.loja} rotulo={l.loja} valor={l.abertos} max={maxLoja} cor="bg-emerald-500" />
              ))}
            </div>
          )}
        </Secao>
      );
    case "ranking":
      return (
        <Secao titulo={`Ranking de lojas — avaliações (${d.aval_periodo_dias} dias)`}>
          {d.ranking_avaliacoes.length === 0 ? (
            <div className="text-sm text-slate-400">Sem avaliações no período.</div>
          ) : (
            <div className="-mx-1">
              {d.ranking_avaliacoes.map((r, i) => (
                <div
                  key={`${r.loja}-${i}`}
                  className="flex items-center gap-3 px-1 py-1.5 text-sm border-b border-slate-100 last:border-0"
                >
                  <span className="w-5 text-slate-400 tabular-nums shrink-0">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-slate-700">{r.loja}</span>
                  <span className="text-amber-500 font-semibold tabular-nums shrink-0">{fmt1(r.media)} ★</span>
                  <span className="text-slate-400 tabular-nums shrink-0 w-20 text-right">{nf(r.n)} aval.</span>
                </div>
              ))}
            </div>
          )}
        </Secao>
      );
    case "avaliacoes":
      return (
        <Secao titulo="Avaliações recentes">
          {d.avaliacoes_recentes.length === 0 ? (
            <div className="text-sm text-slate-400">Nenhuma avaliação com comentário ainda.</div>
          ) : (
            <div className="space-y-3">
              {d.avaliacoes_recentes.map((a, i) => (
                <div key={i} className="border-l-2 border-amber-300 pl-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-amber-500 font-semibold">{a.media != null ? `${fmt1(a.media)} ★` : "—"}</span>
                    <span className="truncate">{[a.marca, a.loja].filter(Boolean).join(" · ") || "—"}</span>
                    <span className="ml-auto shrink-0">{fmtDataHora(a.criado_em)}</span>
                  </div>
                  <div className="text-sm text-slate-700 mt-0.5">“{a.comentario}”</div>
                </div>
              ))}
            </div>
          )}
        </Secao>
      );
    default:
      return null;
  }
}

// ── Editor "Personalizar" ────────────────────────────────────────────
function Editor({
  rascunho,
  setRascunho,
  onSalvar,
  onCancelar,
  salvando,
}: {
  rascunho: Cfg;
  setRascunho: (c: Cfg) => void;
  onSalvar: () => void;
  onCancelar: () => void;
  salvando: boolean;
}) {
  return (
    <div className="card p-4 mb-5 border-brand-200">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-700">Personalizar painel</div>
        <button onClick={() => setRascunho(DEFAULT_CFG)} className="text-xs text-slate-400 hover:underline">
          restaurar padrão
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div>
          <div className="label">Cartões (KPIs)</div>
          <div className="space-y-1.5">
            {CARDS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={!!rascunho.cards[c.key]}
                  onChange={(e) => setRascunho({ ...rascunho, cards: { ...rascunho.cards, [c.key]: e.target.checked } })}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="label">Seções (ligar/desligar e ordenar)</div>
          <div className="space-y-1.5">
            {rascunho.ordem.map((k, i) => {
              const meta = SECOES.find((s) => s.key === k);
              if (!meta) return null;
              return (
                <div key={k} className="flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-2 text-slate-600 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={!!rascunho.secoes[k]}
                      onChange={(e) => setRascunho({ ...rascunho, secoes: { ...rascunho.secoes, [k]: e.target.checked } })}
                    />
                    <span className="truncate">{meta.label}</span>
                  </label>
                  <button
                    onClick={() => setRascunho({ ...rascunho, ordem: mover(rascunho.ordem, i, -1) })}
                    disabled={i === 0}
                    className="btn-ghost px-2 py-1 text-xs"
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => setRascunho({ ...rascunho, ordem: mover(rascunho.ordem, i, 1) })}
                    disabled={i === rascunho.ordem.length - 1}
                    className="btn-ghost px-2 py-1 text-xs"
                    aria-label="Descer"
                  >
                    ↓
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--line)] flex flex-wrap items-end gap-x-5 gap-y-3">
        <div>
          <span className="label">Gráfico de volume</span>
          <select
            className="input w-auto py-1"
            value={rascunho.periodo}
            onChange={(e) => setRascunho({ ...rascunho, periodo: Number(e.target.value) })}
          >
            {PERIODOS.map((p) => (
              <option key={p} value={p}>
                últimos {p} dias
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Ranking — período</span>
          <select
            className="input w-auto py-1"
            value={rascunho.ranking_dias}
            onChange={(e) => setRascunho({ ...rascunho, ranking_dias: Number(e.target.value) })}
          >
            {RANKING_PERIODOS.map((p) => (
              <option key={p} value={p}>
                {p} dias
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Ranking — linhas</span>
          <select
            className="input w-auto py-1"
            value={rascunho.ranking_linhas}
            onChange={(e) => setRascunho({ ...rascunho, ranking_linhas: Number(e.target.value) })}
          >
            {RANKING_LINHAS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "todas" : n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Ranking — ordenar por</span>
          <select
            className="input w-auto py-1"
            value={rascunho.ranking_ordem}
            onChange={(e) => setRascunho({ ...rascunho, ranking_ordem: e.target.value === "qtd" ? "qtd" : "media" })}
          >
            <option value="media">nota média</option>
            <option value="qtd">quantidade</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onCancelar} className="btn-ghost" disabled={salvando}>
            Cancelar
          </button>
          <button onClick={onSalvar} className="btn-primary" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────
export default function PainelPage() {
  const [d, setD] = useState<DashboardResumo | null>(null);
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [rascunho, setRascunho] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      let saved: DashboardConfig | null = null;
      try {
        saved = await obterPreferencia<DashboardConfig>("dashboard");
      } catch {
        saved = null; // sem preferência salva (ou motor ainda sem deploy): usa padrão
      }
      const merged = mergeCfg(saved);
      if (!vivo) return;
      setCfg(merged);
      try {
        const r = await dashboardResumo({
          dias: merged.periodo,
          avalDias: merged.ranking_dias,
          avalLimite: merged.ranking_linhas,
          avalOrdem: merged.ranking_ordem,
        });
        if (vivo) setD(r);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Falha ao carregar o painel.");
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar() {
    if (!rascunho) return;
    setSalvando(true);
    setErro("");
    const cfgNovo = rascunho;
    try {
      await salvarPreferencia("dashboard", cfgNovo);
      setCfg(cfgNovo);
      setRascunho(null);
      const r = await dashboardResumo({
        dias: cfgNovo.periodo,
        avalDias: cfgNovo.ranking_dias,
        avalLimite: cfgNovo.ranking_linhas,
        avalOrdem: cfgNovo.ranking_ordem,
      });
      setD(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const secoesVisiveis = cfg.ordem.filter((k) => cfg.secoes[k]);
  const cardsVisiveis = CARDS.filter((c) => cfg.cards[c.key]);

  return (
    <Shell title="Painel">
      <div className="flex items-center justify-end mb-4">
        {rascunho ? null : (
          <button onClick={() => setRascunho(cfg)} className="btn-ghost text-sm">
            ⚙ Personalizar
          </button>
        )}
      </div>

      {rascunho ? (
        <Editor
          rascunho={rascunho}
          setRascunho={setRascunho}
          onSalvar={salvar}
          onCancelar={() => setRascunho(null)}
          salvando={salvando}
        />
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando o painel…</div>
      ) : erro ? (
        <div className="card p-4 text-sm text-red-600">{erro}</div>
      ) : d ? (
        <div className="space-y-5">
          {cardsVisiveis.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {cardsVisiveis.map((c) => (
                <div key={c.key}>{renderKpi(c.key, d)}</div>
              ))}
            </div>
          ) : null}

          <div className="grid lg:grid-cols-2 gap-5 items-start">
            {secoesVisiveis.map((k) => (
              <div key={k} className={k === "volume" ? "lg:col-span-2" : ""}>
                {renderSecao(k, d)}
              </div>
            ))}
          </div>

          {cardsVisiveis.length === 0 && secoesVisiveis.length === 0 ? (
            <div className="card p-6 text-center text-sm text-slate-400">
              Tudo oculto. Clique em <b>Personalizar</b> para escolher o que mostrar.
            </div>
          ) : null}

          <div className="text-center text-xs text-slate-400 pt-1">
            {nf(d.total_atendimentos)} atendimentos no total · base de {nf(d.total_clientes)} clientes
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
