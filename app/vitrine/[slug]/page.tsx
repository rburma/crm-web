import type { Metadata } from "next";
import { metadataMarca } from "@/lib/metadataMarca";
import { buscarVitrine, type Vitrine } from "@/lib/vitrineServer";
import VitrineView from "@/components/VitrineView";

// Página PÚBLICA da vitrine de avaliações da marca (server: SEO + schema.org).
export async function generateMetadata(
  { params }: { params: { slug: string } },
): Promise<Metadata> {
  return metadataMarca(params.slug, "Avaliações de clientes");
}

// Dados estruturados (schema.org) p/ o Google entender as notas. ⚠️ estrelas na
// busca não são garantidas p/ avaliações no próprio site (Google restringe
// "self-serving reviews") — ajuda, mas garantia mesmo é via Google Meu Negócio.
function jsonLd(v: Vitrine): Record<string, unknown> {
  const nome = v.marca.nome ?? v.marca.slug;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: nome,
  };
  if (v.agregado.media != null && v.agregado.total > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: v.agregado.media,
      reviewCount: v.agregado.total,
      bestRating: 5,
      worstRating: 1,
    };
  }
  ld.review = v.itens.slice(0, 30).map((i) => ({
    "@type": "Review",
    author: { "@type": "Person", name: i.nome },
    reviewRating: { "@type": "Rating", ratingValue: i.nota, bestRating: 5, worstRating: 1 },
    reviewBody: i.comentario,
    ...(i.data ? { datePublished: i.data.slice(0, 10) } : {}),
  }));
  return ld;
}

export default async function VitrinePage({ params }: { params: { slug: string } }) {
  const v = await buscarVitrine(params.slug);
  if (!v) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Vitrine não encontrada.
      </div>
    );
  }
  const cor = v.marca.tema?.cor || "#0f6bd7";
  return (
    <div
      className="min-h-screen py-10 px-4"
      style={{ background: `linear-gradient(180deg, ${cor}1f 0%, #f3f5f9 320px)` }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(v)) }}
      />
      <div className="max-w-4xl mx-auto">
        <VitrineView v={v} modo="pagina" />
        <p className="text-center text-xs text-slate-400 mt-8">
          Avaliações reais de clientes · {v.marca.nome ?? v.marca.slug}
        </p>
      </div>
    </div>
  );
}
