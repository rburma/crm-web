import type { Vitrine } from "@/lib/vitrineServer";

// Exibição da vitrine de avaliações (server component, sem estado). Usada na
// página pública /vitrine/[slug] (modo "pagina") e no widget /embed (modo "embed").

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function Estrelas({ nota }: { nota: number }) {
  const cheias = Math.max(0, Math.min(5, Math.round(nota)));
  return (
    <span aria-label={`${nota} de 5`} className="tracking-wide" style={{ color: "#f5a623" }}>
      {"★".repeat(cheias)}
      <span style={{ color: "#d8dee9" }}>{"★".repeat(5 - cheias)}</span>
    </span>
  );
}

export default function VitrineView({
  v,
  modo = "pagina",
}: {
  v: Vitrine;
  modo?: "pagina" | "embed";
}) {
  const cor = v.marca.tema?.cor || "#0f6bd7";
  const nome = v.marca.nome ?? v.marca.slug;
  return (
    <div className={modo === "embed" ? "p-3" : ""}>
      {modo === "pagina" && (
        <header className="flex items-center gap-3 mb-6">
          {v.marca.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/render/${v.marca.logo_path}`} alt={nome}
              className="w-14 h-14 rounded-xl object-contain bg-white border border-slate-200" />
          ) : null}
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">{nome}</h1>
            <p className="text-sm text-slate-500">Avaliações de clientes</p>
          </div>
        </header>
      )}

      {v.agregado.media != null && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-5 flex items-center gap-4 shadow-sm">
          <div className="text-4xl font-extrabold" style={{ color: cor }}>
            {v.agregado.media.toFixed(1)}
          </div>
          <div>
            <Estrelas nota={v.agregado.media} />
            <div className="text-sm text-slate-500">{v.agregado.total} avaliações</div>
          </div>
        </div>
      )}

      {v.itens.length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">
          Ainda não há avaliações publicadas.
        </p>
      ) : (
        <div className={`grid grid-cols-1 ${modo === "pagina" ? "sm:grid-cols-2" : ""} gap-3`}>
          {v.itens.map((i, idx) => (
            <article key={idx} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Estrelas nota={i.nota} />
                <span className="text-xs text-slate-400">{fmtData(i.data)}</span>
              </div>
              <p className="text-slate-700 text-sm mb-3 whitespace-pre-line">“{i.comentario}”</p>
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{i.nome}</span>
                {i.loja ? <span> · {i.loja}</span> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
