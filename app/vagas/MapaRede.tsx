"use client";
// Hub /vagas: mapa da REDE (todas as marcas). Clicar num estado filtra as
// marcas presentes nele; o link da marca já leva o estado (?uf=XX) para a
// página abrir filtrada. A busca detalhada fica na página da marca.
import { useState } from "react";
import Link from "next/link";
import MapaMundo, { paisDoCodigo } from "@/components/MapaMundo";
import type { MarcaPub } from "@/lib/vagasServer";

export default function MapaRede({ marcas }: { marcas: MarcaPub[] }) {
  const [uf, setUf] = useState<string | null>(null);
  const contagem: Record<string, number> = {};
  for (const m of marcas) {
    for (const [u, n] of Object.entries(m.ufs || {})) {
      const chave = paisDoCodigo(u) === "OUTRAS" ? "OUTRAS" : u;
      contagem[chave] = (contagem[chave] || 0) + n;
    }
  }
  const temNoUf = (m: MarcaPub): number => {
    if (!uf) return 1;
    if (uf === "OUTRAS") {
      return Object.entries(m.ufs || {})
        .filter(([u]) => paisDoCodigo(u) === "OUTRAS")
        .reduce((s, [, n]) => s + n, 0);
    }
    return (m.ufs || {})[uf] || 0;
  };
  const visiveis = marcas.filter((m) => temNoUf(m) > 0);
  return (
    <div>
      <h2 className="font-bold text-slate-700 mb-2 text-center">
        📍 Onde estamos — escolha o país e clique na região
      </h2>
      <MapaMundo contagem={contagem} cor="#0f172a" selecionado={uf} onSelect={setUf} />
      {uf && visiveis.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-4">
          Nenhuma loja neste estado ainda.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visiveis.map((m) => (
          <Link
            key={m.slug}
            href={`/vagas/${m.slug}${uf && uf !== "OUTRAS" ? `?uf=${uf}` : ""}`}
            className="block bg-white border border-slate-200 rounded-xl p-4 hover:shadow"
          >
            <div className="font-bold" style={{ color: m.tema?.cor || "#0f172a" }}>
              {m.nome}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {uf
                ? `${temNoUf(m)} loja(s) em ${uf === "OUTRAS" ? "outras localidades" : uf} →`
                : "Ver vagas e lojas →"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
