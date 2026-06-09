"use client";

import { useState } from "react";

// Seleção de linhas reutilizável (Usuários, Clientes, Atendimentos).
// - chaves são strings (use String(id));
// - toggleAt(index, shiftKey) suporta Shift+click para marcar/desmarcar um
//   intervalo entre o último clique e o atual (na lista visível atual);
// - a seleção sobrevive à troca de página (chaveada por id), então ações em
//   massa podem operar em itens de várias páginas;
// - toggleAll marca/desmarca todos os itens da PÁGINA atual.
export function useSelecao<T>(items: T[], getId: (x: T) => string) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [lastIndex, setLastIndex] = useState<number | null>(null);

  function toggleAt(index: number, shiftKey: boolean) {
    const alvo = items[index];
    if (!alvo) return;
    const id = getId(alvo);
    setSel((prev) => {
      const s = new Set(prev);
      if (shiftKey && lastIndex !== null && lastIndex !== index) {
        const start = Math.min(lastIndex, index);
        const end = Math.max(lastIndex, index);
        const marcar = !s.has(id); // estado alvo = oposto do item clicado
        for (let i = start; i <= end; i++) {
          const it = items[i];
          if (!it) continue;
          if (marcar) s.add(getId(it));
          else s.delete(getId(it));
        }
      } else if (s.has(id)) {
        s.delete(id);
      } else {
        s.add(id);
      }
      return s;
    });
    setLastIndex(index);
  }

  const todosDaPagina = items.length > 0 && items.every((x) => sel.has(getId(x)));

  function toggleAll() {
    setSel((prev) => {
      const s = new Set(prev);
      const todos = items.length > 0 && items.every((x) => s.has(getId(x)));
      for (const x of items) {
        if (todos) s.delete(getId(x));
        else s.add(getId(x));
      }
      return s;
    });
  }

  function limpar() {
    setSel(new Set());
    setLastIndex(null);
  }

  return {
    sel,
    ids: Array.from(sel),
    count: sel.size,
    tem: (id: string) => sel.has(id),
    toggleAt,
    toggleAll,
    todosDaPagina,
    limpar,
  };
}
