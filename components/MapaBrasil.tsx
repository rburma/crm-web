"use client";
// Mapa ESTILIZADO do Brasil (tile map por UF) — pedido 30/07: clicar num
// estado filtra as vagas. Leve (sem SVG pesado), perfeito no celular, cada
// estado é um botão com a contagem de lojas. UFs fora do padrão brasileiro
// (Portugal/EUA/legado sem UF) entram no cartão "Outras localidades".
// A posição dos blocos segue o arranjo geográfico clássico de tile maps.

const POS: Record<string, [number, number]> = {
  RR: [2, 0], AP: [4, 0],
  AM: [1, 1], PA: [3, 1], MA: [4, 1], CE: [6, 1], RN: [7, 1],
  AC: [0, 2], RO: [1, 2], MT: [2, 2], TO: [3, 2], PI: [5, 2], PE: [6, 2], PB: [7, 2],
  MS: [2, 3], GO: [3, 3], DF: [4, 3], BA: [5, 3], SE: [6, 3], AL: [7, 3],
  SP: [3, 4], MG: [4, 4], ES: [5, 4],
  PR: [3, 5], RJ: [5, 5],
  SC: [3, 6],
  RS: [3, 7],
};
const COLS = 8;
const ROWS = 8;

export default function MapaBrasil({ contagem, cor, selecionado, onSelect }: {
  contagem: Record<string, number>;
  cor: string;
  selecionado: string | null;
  onSelect: (uf: string | null) => void;
}) {
  const outras = Object.entries(contagem)
    .filter(([uf]) => !(uf in POS))
    .reduce((s, [, n]) => s + n, 0);
  const total = Object.values(contagem).reduce((s, n) => s + n, 0);
  return (
    <div className="mb-4">
      <div
        className="grid gap-1 max-w-md mx-auto"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const uf = Object.keys(POS).find(
            (u) => POS[u][0] === col && POS[u][1] === row,
          );
          if (!uf) return <div key={i} />;
          const n = contagem[uf] || 0;
          const ativo = n > 0;
          const sel = selecionado === uf;
          return (
            <button
              key={i}
              type="button"
              disabled={!ativo}
              onClick={() => onSelect(sel ? null : uf)}
              title={ativo ? `${uf}: ${n} loja(s)` : `${uf}: sem lojas`}
              className={`aspect-square rounded-md text-[11px] font-bold leading-tight flex flex-col items-center justify-center border transition ${
                sel
                  ? "text-white border-transparent ring-2 ring-offset-1 ring-slate-400"
                  : ativo
                    ? "text-white border-transparent hover:opacity-80"
                    : "bg-slate-100 text-slate-300 border-slate-200 cursor-default"
              }`}
              style={sel || ativo ? { background: cor, opacity: sel ? 1 : 0.55 + Math.min(0.45, n / 20) } : undefined}
            >
              {uf}
              {ativo && <span className="text-[9px] font-normal">{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="flex justify-center gap-2 mt-2 flex-wrap">
        {selecionado && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
          >
            ✕ Limpar filtro ({selecionado})
          </button>
        )}
        {outras > 0 && (
          <button
            type="button"
            onClick={() => onSelect(selecionado === "OUTRAS" ? null : "OUTRAS")}
            className={`text-xs px-3 py-1.5 rounded-lg border font-semibold ${
              selecionado === "OUTRAS"
                ? "text-white border-transparent"
                : "bg-white border-slate-300"
            }`}
            style={selecionado === "OUTRAS" ? { background: cor } : undefined}
          >
            🌎 Outras localidades ({outras})
          </button>
        )}
        <span className="text-[11px] text-slate-400 self-center">
          {total} loja(s) no total — clique num estado para filtrar
        </span>
      </div>
    </div>
  );
}

export const UFS_BR = Object.keys(POS);
