"use client";

// Navegação de páginas reutilizável (Clientes, Atendimentos, Usuários).
// page é 0-based. Mostra "Página X de Y" + faixa de itens + Anterior/Próxima,
// e (opcional) um seletor de itens-por-página.
const OPCOES_TAMANHO = [50, 100, 200];

export default function Pager({
  page,
  pageSize,
  total,
  loading,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  loading?: boolean;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const de = total === 0 ? 0 : page * pageSize + 1;
  const ate = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-sm">
      <div className="flex items-center gap-2 text-slate-400">
        <span>
          {total.toLocaleString("pt-BR")} no total
          {total > 0 && ` · ${de.toLocaleString("pt-BR")}–${ate.toLocaleString("pt-BR")}`}
        </span>
        {onPageSize && (
          <select
            className="input py-0.5 px-1 text-xs w-auto"
            value={pageSize}
            disabled={loading}
            onChange={(e) => onPageSize(Number(e.target.value))}
            title="Itens por página"
          >
            {OPCOES_TAMANHO.map((n) => (
              <option key={n} value={n}>{n}/página</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost"
          disabled={loading || page <= 0}
          onClick={() => onPage(page - 1)}
        >
          ← Anterior
        </button>
        <span className="text-slate-500 whitespace-nowrap">
          Página {(page + 1).toLocaleString("pt-BR")} de {pages.toLocaleString("pt-BR")}
        </span>
        <button
          className="btn-ghost"
          disabled={loading || page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >
          Próxima →
        </button>
      </div>
    </div>
  );
}
