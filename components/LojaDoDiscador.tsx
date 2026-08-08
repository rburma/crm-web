"use client";

// A fila do discador é DA LOJA. Quem enxerga uma loja só (gerente, atendente)
// não escolhe nada. Quem é global (admin/rede/matriz) precisa dizer de qual
// loja é a fila — sem isso o servidor devolve "Informe a loja".
// A escolha fica guardada no navegador para não repetir a cada tela.
// O aviso de global só aparece depois de montar, para não brigar com o
// HTML gerado no servidor (que não conhece o usuário).

import { useEffect, useState } from "react";
import { listarLojas, usuarioLogado, type LojaItem } from "@/lib/api";

const CHAVE = "discador_loja";
const GLOBAIS = ["admin", "rede", "matriz"];

export default function LojaDoDiscador({
  onTrocar,
}: {
  /** (loja escolhida, o usuário é global?) — chamado ao montar e a cada troca. */
  onTrocar: (id: number | undefined, global: boolean) => void;
}) {
  const [lojas, setLojas] = useState<LojaItem[]>([]);
  const [id, setId] = useState<number | undefined>(undefined);
  const [global, setGlobal] = useState(false);

  useEffect(() => {
    const ehGlobal = GLOBAIS.includes(usuarioLogado()?.papel ?? "");
    setGlobal(ehGlobal);
    const salva = Number(window.localStorage.getItem(CHAVE) || 0) || undefined;
    if (ehGlobal) {
      setId(salva);
      listarLojas({ limit: 500 })
        .then((l) => setLojas(l.filter((x) => x.ativo)))
        .catch(() => setLojas([]));
    }
    onTrocar(ehGlobal ? salva : undefined, ehGlobal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!global) return null;

  function escolher(v: string) {
    const novo = v ? Number(v) : undefined;
    setId(novo);
    if (novo) window.localStorage.setItem(CHAVE, String(novo));
    else window.localStorage.removeItem(CHAVE);
    onTrocar(novo, true);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">Loja da fila:</span>
      <select
        value={id ?? ""}
        onChange={(e) => escolher(e.target.value)}
        className={`rounded border px-2 py-1 text-sm ${
          id ? "" : "border-amber-400 bg-amber-50"
        }`}
      >
        <option value="">— escolha a loja —</option>
        {lojas.map((l) => (
          <option key={l.id} value={l.id}>
            {l.sigla ? `${l.sigla} · ` : ""}
            {l.nome}
          </option>
        ))}
      </select>
      {lojas.length === 0 && (
        <span className="text-xs text-gray-400">carregando lojas…</span>
      )}
    </label>
  );
}
