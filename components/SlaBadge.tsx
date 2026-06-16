"use client";

import { useEffect, useState } from "react";

/** Selo de SLA: conta o tempo até o prazo (vence_em) e muda de cor —
 *  neutro → amarelo (após alerta_em) → vermelho (passou de vence_em).
 *  Sem vence_em (marca sem SLA) não mostra nada. Atualiza sozinho a cada minuto. */
function fmtDur(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}min` : `${h}h`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${d}d ${hh}h` : `${d}d`;
}

export default function SlaBadge({
  venceEm, alertaEm, className = "",
}: { venceEm?: string | null; alertaEm?: string | null; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  if (!venceEm || now === null) return null;
  const vence = new Date(venceEm).getTime();
  const alerta = alertaEm ? new Date(alertaEm).getTime() : null;
  const diff = vence - now;

  let cor = "text-slate-500 bg-slate-100";
  let label = `vence em ${fmtDur(diff)}`;
  let icone = "⏱";
  if (diff <= 0) {
    cor = "text-red-700 bg-red-100 font-semibold";
    label = `venceu há ${fmtDur(-diff)}`;
    icone = "⏰";
  } else if (alerta !== null && now >= alerta) {
    cor = "text-amber-700 bg-amber-100";
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${cor} ${className}`}
      title="Prazo de atendimento (SLA)">
      {icone} {label}
    </span>
  );
}
