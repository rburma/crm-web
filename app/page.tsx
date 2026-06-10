"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import {
  dashboardResumo,
  fmtDataHora,
  type DashboardResumo,
} from "@/lib/api";

const nf = (n: number) => n.toLocaleString("pt-BR");

// ── KPI ──────────────────────────────────────────────────────────────
function Kpi({
  rotulo,
  valor,
  sub,
  tom,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  tom?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-500">{rotulo}</div>
      <div className={`mt-1 text-3xl font-bold tracking-tight ${tom ?? "text-slate-800"}`}>
        {valor}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

// ── Gráfico de barras (volume 14 dias), SVG na mão ──────────────────
function VolumeChart({ dados }: { dados: { dia: string; qtd: number }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.qtd));
  const W = 560;
  const H = 130;
  const n = Math.max(1, dados.length);
  const gap = 6;
  const bw = (W - gap * (n - 1)) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Volume de atendimentos nos últimos 14 dias">
      {dados.map((d, i) => {
        const h = Math.round((d.qtd / max) * H);
        const x = i * (bw + gap);
        const y = H - Math.max(h, 2);
        const mostraData = i === 0 || i === n - 1 || i === Math.floor(n / 2);
        return (
          <g key={d.dia}>
            <rect x={x} y={y} width={bw} height={Math.max(h, 2)} rx={3} className="fill-brand-500" />
            {d.qtd > 0 ? (
              <text x={x + bw / 2} y={y - 3} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>
                {d.qtd}
              </text>
            ) : null}
            {mostraData ? (
              <text x={x + bw / 2} y={H + 13} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>
                {d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// ── Barra horizontal ────────────────────────────────────────────────
function BarH({
  rotulo,
  valor,
  max,
  texto,
  cor,
}: {
  rotulo: string;
  valor: number;
  max: number;
  texto?: string;
  cor?: string;
}) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600 truncate pr-2">{rotulo}</span>
        <span className="text-slate-400 tabular-nums shrink-0">{texto ?? nf(valor)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${cor ?? "bg-brand-500"}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

function Estrelas({ media }: { media: number | null }) {
  if (media == null) return <span className="text-slate-300">—</span>;
  return (
    <span className="text-amber-500 font-semibold tabular-nums">
      {media.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ★
    </span>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold text-slate-700 mb-3">{titulo}</div>
      {children}
    </div>
  );
}

export default function PainelPage() {
  const [d, setD] = useState<DashboardResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await dashboardResumo();
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

  const maxMarca = d ? Math.max(1, ...d.por_marca.map((m) => m.total)) : 1;
  const maxLoja = d ? Math.max(1, ...d.top_lojas.map((l) => l.abertos)) : 1;

  return (
    <Shell title="Painel">
      {loading ? (
        <div className="text-sm text-slate-500">Carregando o painel…</div>
      ) : erro ? (
        <div className="card p-4 text-sm text-red-600">{erro}</div>
      ) : d ? (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi rotulo="Atendimentos abertos" valor={nf(d.abertos)} tom="text-brand-700" />
            <Kpi rotulo="Em espera" valor={nf(d.em_espera)} tom="text-amber-600" />
            <Kpi rotulo="Encerrados hoje" valor={nf(d.encerrados_hoje)} tom="text-emerald-600" />
            <Kpi rotulo="Novos hoje" valor={nf(d.novos_hoje)} />
            <Kpi
              rotulo="Satisfação média"
              valor={d.nps_geral != null ? `${d.nps_geral.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ★` : "—"}
              sub="últimos 90 dias"
              tom="text-amber-500"
            />
            <Kpi rotulo="Clientes na base" valor={nf(d.total_clientes)} />
          </div>

          {/* Volume + por marca */}
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <Secao titulo="Volume de atendimentos — últimos 14 dias">
                <VolumeChart dados={d.volume_14d} />
              </Secao>
            </div>
            <Secao titulo="Atendimentos por marca">
              {d.por_marca.length === 0 ? (
                <div className="text-sm text-slate-400">Sem dados ainda.</div>
              ) : (
                <div className="space-y-2.5">
                  {d.por_marca.map((m) => (
                    <BarH
                      key={m.marca}
                      rotulo={m.marca}
                      valor={m.total}
                      max={maxMarca}
                      texto={`${nf(m.total)} · ${nf(m.abertos)} abertos`}
                    />
                  ))}
                </div>
              )}
            </Secao>
          </div>

          {/* NPS por marca + Top lojas */}
          <div className="grid lg:grid-cols-2 gap-5">
            <Secao titulo="Satisfação por marca (média 1–5)">
              {d.nps_por_marca.length === 0 ? (
                <div className="text-sm text-slate-400">Sem avaliações recentes.</div>
              ) : (
                <div className="space-y-2.5">
                  {d.nps_por_marca.map((m) => (
                    <BarH
                      key={m.marca}
                      rotulo={m.marca}
                      valor={m.media}
                      max={5}
                      texto={`${m.media.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ★ · ${nf(m.n)}`}
                      cor="bg-amber-400"
                    />
                  ))}
                </div>
              )}
            </Secao>
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
          </div>

          {/* Recentes + avaliações */}
          <div className="grid lg:grid-cols-2 gap-5">
            <Secao titulo="Últimos atendimentos abertos">
              {d.recentes_abertos.length === 0 ? (
                <div className="text-sm text-slate-400">Nenhum atendimento aberto.</div>
              ) : (
                <div className="divide-y divide-slate-100 -mx-1">
                  {d.recentes_abertos.map((a) => (
                    <Link
                      key={a.id}
                      href={`/atendimentos/${a.id}`}
                      className="flex items-center gap-3 px-1 py-2 hover:bg-slate-50 rounded transition"
                    >
                      <span className="badge-blue shrink-0">#{a.numero}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-slate-700 truncate">{a.assunto || "(sem assunto)"}</span>
                        <span className="block text-xs text-slate-400 truncate">
                          {a.cliente || "—"}
                          {a.marca ? ` · ${a.marca}` : ""}
                        </span>
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">{fmtDataHora(a.criado_em)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Secao>
            <Secao titulo="Avaliações recentes">
              {d.avaliacoes_recentes.length === 0 ? (
                <div className="text-sm text-slate-400">Nenhuma avaliação com comentário ainda.</div>
              ) : (
                <div className="space-y-3">
                  {d.avaliacoes_recentes.map((a, i) => (
                    <div key={i} className="border-l-2 border-amber-300 pl-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Estrelas media={a.media} />
                        <span className="truncate">
                          {[a.marca, a.loja].filter(Boolean).join(" · ") || "—"}
                        </span>
                        <span className="ml-auto shrink-0">{fmtDataHora(a.criado_em)}</span>
                      </div>
                      <div className="text-sm text-slate-700 mt-0.5">“{a.comentario}”</div>
                    </div>
                  ))}
                </div>
              )}
            </Secao>
          </div>

          <div className="text-center text-xs text-slate-400 pt-1">
            {nf(d.total_atendimentos)} atendimentos no total · base de {nf(d.total_clientes)} clientes
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
