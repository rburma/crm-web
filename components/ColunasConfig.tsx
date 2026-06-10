"use client";

import { useState } from "react";
import { salvarPreferencia } from "@/lib/api";

export type ColMeta = { key: string; label: string };

// Botão "⚙ Colunas" + popover: liga/desliga e reordena as colunas de uma lista.
// O estado (`value`) e o catálogo (`todas`) ficam na página; aqui só editamos um
// rascunho e, ao salvar, persistimos em /preferencias/{chave} (segue na conta).
export default function ColunasConfig({
  chave,
  todas,
  value,
  onChange,
}: {
  chave: string;
  todas: ColMeta[];
  value: string[];
  onChange: (cols: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rasc, setRasc] = useState<string[]>(value);
  const [salvando, setSalvando] = useState(false);

  function abrir() {
    setRasc(value);
    setAberto(true);
  }
  function toggle(k: string, on: boolean) {
    setRasc((c) => (on ? [...c.filter((x) => x !== k), k] : c.filter((x) => x !== k)));
  }
  function mover(i: number, dir: -1 | 1) {
    setRasc((c) => {
      const j = i + dir;
      if (j < 0 || j >= c.length) return c;
      const n = [...c];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }
  async function salvar() {
    setSalvando(true);
    try {
      await salvarPreferencia(chave, { cols: rasc });
      onChange(rasc);
      setAberto(false);
    } catch {
      /* mantem aberto */
    } finally {
      setSalvando(false);
    }
  }

  // Ordem do editor: visíveis primeiro (na ordem salva), depois as ocultas.
  const ordem = [...rasc, ...todas.map((t) => t.key).filter((k) => !rasc.includes(k))];

  return (
    <div className="relative">
      <button className="btn-ghost text-sm whitespace-nowrap" onClick={abrir}>
        ⚙ Colunas
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setAberto(false)} />
          <div className="absolute right-0 mt-1 z-30 w-72 card p-3 shadow-lg">
            <div className="text-sm font-semibold text-slate-700 mb-2">Colunas da lista</div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {ordem.map((k) => {
                const meta = todas.find((t) => t.key === k);
                if (!meta) return null;
                const i = rasc.indexOf(k);
                const vis = i >= 0;
                return (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <label className="flex items-center gap-2 flex-1 min-w-0 text-slate-600">
                      <input
                        type="checkbox"
                        checked={vis}
                        onChange={(e) => toggle(k, e.target.checked)}
                      />
                      <span className="truncate">{meta.label}</span>
                    </label>
                    {vis && (
                      <>
                        <button
                          className="btn-ghost px-1.5 py-0.5 text-xs"
                          disabled={i === 0}
                          onClick={() => mover(i, -1)}
                          aria-label="Subir"
                        >
                          ↑
                        </button>
                        <button
                          className="btn-ghost px-1.5 py-0.5 text-xs"
                          disabled={i === rasc.length - 1}
                          onClick={() => mover(i, 1)}
                          aria-label="Descer"
                        >
                          ↓
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-[var(--line)]">
              <button className="btn-ghost text-sm" onClick={() => setAberto(false)} disabled={salvando}>
                Cancelar
              </button>
              <button
                className="btn-primary text-sm"
                onClick={salvar}
                disabled={salvando || rasc.length === 0}
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
