import { buscarVitrine } from "@/lib/vitrineServer";
import VitrineView from "@/components/VitrineView";

// Widget ENXUTO p/ a loja embutir no site dela via <iframe>. Herda noindex do
// layout (a página canônica de SEO é /vitrine/[slug], não o embed). Fundo
// transparente; sem cabeçalho da marca.
export default async function EmbedVitrine({ params }: { params: { slug: string } }) {
  const v = await buscarVitrine(params.slug);
  if (!v) {
    return <div className="p-4 text-sm text-slate-500">Sem avaliações no momento.</div>;
  }
  return <VitrineView v={v} modo="embed" />;
}
