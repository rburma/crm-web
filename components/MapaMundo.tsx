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

const PAISES: { id: Pais; bandeira: string; nome: string }[] = [
  { id: "BR", bandeira: "🇧🇷", nome: "Brasil" },
  { id: "PT", bandeira: "🇵🇹", nome: "Portugal" },
  { id: "US", bandeira: "🇺🇸", nome: "EUA" },
];

export default function MapaMundo({ contagem, cor, selecionado, onSelect, paisInicial }: {
  contagem: Record<string, number>;
  cor: string;
  selecionado: string | null;
  onSelect: (cod: string | null) => void;
  paisInicial?: Pais;
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
              onClick={() => { setPais(p.id); onSelect(null); }}
              className={`text-sm px-3.5 py-2 rounded-xl border font-semibold inline-flex items-center gap-2 ${
                on ? "text-white border-transparent" : "bg-white border-slate-300"}`}
              style={on ? { background: cor } : undefined}>
              <span className="text-xl leading-none">{p.bandeira}</span>
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
