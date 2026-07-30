"use client";
// Bandeiras 🇧🇷 🇵🇹 🇺🇸 alternando o mapa do país (pedido 30/07). O código
// do estado/distrito no campo UF da loja define o país sozinho:
// UFs do Brasil → BR · distritos PT (PO/LX/FA/…) → PT · estados US (FL/…)
// → US. Colisões (AL/MA/MS/PA/SC existem no BR e nos EUA) valem como BRASIL.
import { useState } from "react";
import MapaBrasil, { UFS_BR } from "./MapaBrasil";
import MapaEUA, { ESTADOS_US } from "./MapaEUA";
import MapaPortugal, { DISTRITOS_PT } from "./MapaPortugal";

export type Pais = "BR" | "PT" | "US";

export function paisDoCodigo(cod: string | null | undefined): Pais | "OUTRAS" {
  const u = (cod || "").toUpperCase();
  if (UFS_BR.includes(u)) return "BR";
  if (DISTRITOS_PT.includes(u)) return "PT";
  if (ESTADOS_US.includes(u)) return "US";
  return "OUTRAS";
}

// Bandeiras em SVG proprio (emoji de bandeira NAO renderiza no Windows —
// aparecia so "BR PT US"; bug relatado 30/07).
function Bandeira({ pais }: { pais: Pais }) {
  const cls = "w-7 h-5 rounded-[3px] shrink-0 border border-black/10";
  if (pais === "BR") {
    return (
      <svg viewBox="0 0 30 20" className={cls}>
        <rect width="30" height="20" fill="#009c3b" />
        <path d="M15 2.5 27 10 15 17.5 3 10Z" fill="#ffdf00" />
        <circle cx="15" cy="10" r="4.2" fill="#002776" />
      </svg>
    );
  }
  if (pais === "PT") {
    return (
      <svg viewBox="0 0 30 20" className={cls}>
        <rect width="30" height="20" fill="#da291c" />
        <rect width="12" height="20" fill="#046a38" />
        <circle cx="12" cy="10" r="4" fill="#ffe900" />
        <circle cx="12" cy="10" r="2.2" fill="#da291c" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 30 20" className={cls}>
      <rect width="30" height="20" fill="#b22234" />
      {[1, 3, 5, 7, 9].map((i) => (
        <rect key={i} y={i * 2 - 0.2} width="30" height="1.6" fill="#ffffff" />
      ))}
      <rect width="13" height="10" fill="#3c3b6e" />
    </svg>
  );
}

const PAISES: { id: Pais; nome: string }[] = [
  { id: "BR", nome: "Brasil" },
  { id: "PT", nome: "Portugal" },
  { id: "US", nome: "EUA" },
];

export default function MapaMundo({ contagem, cor, selecionado, onSelect, paisInicial, onPais }: {
  contagem: Record<string, number>;
  cor: string;
  selecionado: string | null;
  onSelect: (cod: string | null) => void;
  paisInicial?: Pais;
  onPais?: (p: Pais) => void;
}) {
  const [pais, setPais] = useState<Pais>(paisInicial ?? "BR");
  const total = (p: Pais | "OUTRAS") =>
    Object.entries(contagem)
      .filter(([c]) => paisDoCodigo(c) === p || (p === "OUTRAS" && c === "OUTRAS"))
      .reduce((s, [, n]) => s + n, 0);
  const filtrada = (p: Pais): Record<string, number> => {
    const r: Record<string, number> = {};
    for (const [c, n] of Object.entries(contagem)) {
      const pc = paisDoCodigo(c);
      if (pc === p) r[c] = (r[c] || 0) + n;
      else if (p === "BR" && (pc === "OUTRAS" || c === "OUTRAS")) {
        r.OUTRAS = (r.OUTRAS || 0) + n;  // desconhecidas ficam no rodapé do BR
      }
    }
    return r;
  };
  return (
    <div>
      <div className="flex justify-center gap-2 mb-3 flex-wrap">
        {PAISES.map((p) => {
          const n = total(p.id);
          const on = pais === p.id;
          return (
            <button key={p.id} type="button"
              onClick={() => { setPais(p.id); onSelect(null); onPais?.(p.id); }}
              className={`text-sm px-3.5 py-2 rounded-xl border font-semibold inline-flex items-center gap-2 ${
                on ? "text-white border-transparent" : "bg-white border-slate-300"}`}
              style={on ? { background: cor } : undefined}>
              <Bandeira pais={p.id} />
              {p.nome}
              <span className={`text-[11px] ${on ? "opacity-80" : "text-slate-400"}`}>{n}</span>
            </button>
          );
        })}
      </div>
      {pais === "BR" && (
        <MapaBrasil contagem={filtrada("BR")} cor={cor}
          selecionado={selecionado} onSelect={onSelect} />
      )}
      {pais === "PT" && (
        <MapaPortugal contagem={filtrada("PT")} cor={cor}
          selecionado={selecionado} onSelect={onSelect} />
      )}
      {pais === "US" && (
        <MapaEUA contagem={filtrada("US")} cor={cor}
          selecionado={selecionado} onSelect={onSelect} />
      )}
      {pais !== "BR" && (
        <div className="flex justify-center gap-2 mt-1 flex-wrap">
          {selecionado && (
            <button type="button" onClick={() => onSelect(null)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold">
              ✕ Limpar filtro ({selecionado})
            </button>
          )}
          <span className="text-[11px] text-slate-400 self-center">
            {total(pais)} loja(s) — clique numa região para filtrar
          </span>
        </div>
      )}
    </div>
  );
}
