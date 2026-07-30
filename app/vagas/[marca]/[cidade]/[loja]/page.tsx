// Página de vagas da LOJA (público, SEO forte): título com marca+shopping+
// cidade, endereço completo (bairro/CEP) e JSON-LD JobPosting por vaga aberta
// (Google for Jobs). Vaga sem abertura vira botão de banco (mesmo funil).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaLoja } from "@/lib/vagasServer";

export const revalidate = 600;

type Props = { params: { marca: string; cidade: string; loja: string } };

function lojaId(param: string): number {
  const m = param.match(/-(\d+)$/);
  return m ? Number(m[1]) : NaN;
}

function endereco(lj: {
  endereco: string | null; numero: string | null; bairro: string | null;
  cep: string | null; shopping: string | null; cidade: string | null; uf: string | null;
}): string {
  return [
    [lj.endereco, lj.numero].filter(Boolean).join(", "),
    lj.shopping, lj.bairro,
    lj.cep ? `CEP ${lj.cep}` : null,
    [lj.cidade, lj.uf].filter(Boolean).join("/"),
  ].filter(Boolean).join(" · ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = lojaId(params.loja);
  const dados = Number.isFinite(id) ? await paginaLoja(params.marca, id) : null;
  if (!dados) return { title: "Vagas" };
  const { marca, loja } = dados;
  const local = [loja.shopping, loja.cidade, loja.uf].filter(Boolean).join(", ");
  return {
    title: `Vagas de emprego ${marca.nome} — ${local}`,
    description:
      `Trabalhe na ${marca.nome} ${local}: veja as vagas abertas nesta loja ` +
      `(${endereco(loja)}) e candidate-se online em poucos minutos.`,
  };
}

export default async function VagasLoja({ params }: Props) {
  const id = lojaId(params.loja);
  const dados = Number.isFinite(id) ? await paginaLoja(params.marca, id) : null;
  if (!dados) notFound();
  const { marca, loja, cargos, outras_lojas: outras } = dados;
  const cor = marca.tema?.cor || "#0f172a";
  const abertos = cargos.filter((c) => c.aberta);
  const banco = cargos.filter((c) => !c.aberta);

  // JSON-LD JobPosting (Google for Jobs) — 1 por vaga ABERTA.
  const jsonLd = abertos.map((c) => ({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: c.titulo,
    description: [c.descricao, c.requisitos].filter(Boolean).join("\n\n") || c.titulo,
    datePosted: (c.aberta_em || new Date().toISOString()).slice(0, 10),
    employmentType: "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: marca.nome },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: [loja.endereco, loja.numero].filter(Boolean).join(", "),
        addressLocality: loja.cidade || "",
        addressRegion: loja.uf || "",
        postalCode: loja.cep || "",
        addressCountry: "BR",
      },
    },
    directApply: true,
  }));

  return (
    <main className="min-h-screen bg-slate-50">
      {jsonLd.map((j, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }}
        />
      ))}
      <header className="text-white px-4 py-6" style={{ background: cor }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-extrabold">
            Vagas de emprego — {marca.nome} {loja.shopping || loja.nome}, {loja.cidade}/{loja.uf}
          </h1>
          <p className="text-xs opacity-90 mt-1">{endereco(loja)}</p>
        </div>
      </header>
      <section className="max-w-3xl mx-auto p-4">
        {abertos.map((c) => (
          <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 mb-3">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <h2 className="font-bold">{c.titulo}</h2>
              <Link
                href={`/vagas/candidatar?marca=${marca.slug}&loja=${loja.id}&cargo=${c.id}`}
                className="text-white text-sm font-semibold rounded-lg px-4 py-2"
                style={{ background: cor }}
              >
                Candidatar-se
              </Link>
            </div>
            {c.descricao && <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{c.descricao}</p>}
            {c.requisitos && (
              <p className="text-xs text-slate-500 mt-2 whitespace-pre-line">
                <b>Requisitos:</b> {c.requisitos}
              </p>
            )}
            {c.texto_seo && <p className="text-xs text-slate-400 mt-2 whitespace-pre-line">{c.texto_seo}</p>}
          </div>
        ))}
        {banco.map((c) => (
          <div key={c.id} className="bg-white border border-dashed border-slate-300 rounded-xl p-4 mb-3">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <h2 className="font-bold">{c.titulo}</h2>
              <Link
                href={`/vagas/candidatar?marca=${marca.slug}&loja=${loja.id}&cargo=${c.id}`}
                className="text-sm font-semibold rounded-lg px-3 py-2 border border-slate-300 hover:bg-slate-50"
              >
                📥 Quero enviar meu currículo p/ quando houver disponibilidade
              </Link>
            </div>
            {c.descricao && <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{c.descricao}</p>}
          </div>
        ))}
        {cargos.length === 0 && (
          <p className="text-sm text-slate-500 py-6 text-center">
            Nenhum cargo cadastrado para esta marca ainda.
          </p>
        )}
        {outras.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-slate-600 mb-2">
              Outras lojas {marca.nome} em {loja.cidade}
            </h3>
            <div className="flex flex-wrap gap-2">
              {outras.map((o) => (
                <Link
                  key={o.id}
                  href={`/vagas/${marca.slug}/${o.cidade_slug}/${o.slug}-${o.id}`}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:shadow"
                >
                  {o.nome}
                </Link>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-6">
          <Link href={`/vagas/${marca.slug}`} className="underline">← Lojas {marca.nome}</Link>
          {" · "}
          <Link href="/vagas" className="underline">Todas as marcas</Link>
        </p>
      </section>
    </main>
  );
}
