"use client";

// PICKER de lojas estilo cobranca (Renato 06/07): busca por sigla/nome/cidade/
// apelido e MULTIPLAS lojas viram chips. Exibe SO a sigla (maiuscula, com o
// prefixo da marca quando falta — ex.: World Tennis "sben" -> WTSBEN).
import { useEffect, useRef, useState } from "react";
import {
  listarLojas,
  siglaLoja,
  type LojaItem,
  type MarcaItem,
} from "@/lib/api";

export type LojaSel = { id: number; rotulo: string };

export default function LojaPicker({
  marcaId,
  marcas,
  value,
  onChange,
  placeholder,
}: {
  marcaId: number | null;
  marcas: MarcaItem[];
  value: LojaSel[];
  onChange: (v: LojaSel[]) => void;
  placeholder?: string;
}) {
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<LojaItem[]>([]);
  const [aberto, setAberto] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function rotuloDe(l: LojaItem): string {
    const m = marcas.find((x) => x.id === l.marca_id);
    return siglaLoja(l.sigla, m?.sigla, l.nome);
  }

  // Busca com debounce; sem termo lista as primeiras (ordenadas por sigla).
  useEffect(() => {
    if (!aberto) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      listarLojas({ marcaId: marcaId ?? undefined, q: busca.trim() || undefined, limit: 30 })
        .then((ls) => setSugestoes(ls.filter((l) => !value.some((v) => v.id === l.id))))
        .catch(() => setSugestoes([]));
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, marcaId, aberto, value]);

  // fecha ao clicar fora
  useEffect(() => {
    function fora(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function adicionar(l: LojaItem) {
    onChange([...value, { id: l.id, rotulo: rotuloDe(l) }]);
    setBusca("");
  }
  function remover(id: number) {
    onChange(value.filter((v) => v.id !== id));
  }

  return (
    <div ref={boxRef} className="relative flex flex-wrap items-center gap-1 min-w-[220px]">
      {value.map((v) => (
        <span
          key={v.id}
          className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2 py-0.5 text-xs font-medium"
        >
          {v.rotulo}
          <button
            type="button"
            onClick={() => remover(v.id)}
            className="hover:text-brand-900"
            aria-label={`Remover ${v.rotulo}`}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        className="input flex-1 min-w-[150px] text-sm"
        placeholder={placeholder ?? "+ loja (sigla, nome, cidade…)"}
        value={busca}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
      />
      {aberto && sugestoes.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full max-h-64 overflow-auto rounded-lg border border-[var(--line)] bg-white shadow-lg z-30">
          {sugestoes.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => adicionar(l)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2"
            >
              <span className="font-mono font-semibold">{rotuloDe(l)}</span>
              <span className="text-xs text-slate-400 truncate">
                {l.nome}{l.cidade ? ` · ${l.cidade}${l.uf ? "/" + l.uf : ""}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
