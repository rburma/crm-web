// Página de franquia POR CIDADE (SEO em massa: "franquia MARCA em CIDADE").
// A cidade vem do slug (ex.: ourinhos-sp); o conteúdo é o modelo da marca.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaFranquia } from "@/lib/vagasServer";

export const revalidate = 3600;

type Props = { params: { marca: string; cidade: string } };

function nomeCidade(slug: string): { nome: string; uf: string } {
  const m = slug.match(/^(.*)-([a-z]{2})$/);
  const bruto = (m ? m[1] : slug).replace(/-/g, " ");
  const nome = bruto.replace(/\b\w/g, (c) => c.toUpperCase());
  return { nome, uf: (m ? m[2] : "").toUpperCase() };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dados = await paginaFranquia(params.marca);
  const { nome, uf } = nomeCidade(params.cidade);
  if (!dados) return { title: "Franquia" };
  return {
    title: `Franquia ${dados.marca.nome} em ${nome}${uf ? `/${uf}` : ""} — invista na sua cidade`,
    description:
      `Abra uma franquia ${dados.marca.nome} em ${nome}${uf ? `/${uf}` : ""}: ` +
      "loja ou Franquia Pop-Up. Cadastre seu interesse online em poucos minutos.",
  };
}

export default async function FranquiaCidade({ params }: Props) {
  const dados = await paginaFranquia(params.marca);
  if (!dados) notFound();
  const { marca, cargo } = dados;
  const { nome, uf } = nomeCidade(params.cidade);
  const cor = marca.tema?.cor || "#7c2d12";
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="text-white px-4 py-8" style={{ background: cor }}>
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-extrabold">
            Franquia {marca.nome} em {nome}{uf ? `/${uf}` : ""}
          </h1>
          <p className="text-sm opacity-90 mt-1">
            Ainda não temos loja em {nome} — pode ser a sua
          </p>
        </div>
      </header>
      <section className="max-w-3xl mx-auto p-4">
        {cargo?.descricao && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-slate-700 whitespace-pre-line">{cargo.descricao}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={`/vagas/candidatar?marca=${marca.slug}&tipo=franquia&cidade=${encodeURIComponent(nome)}&uf=${uf}`}
            className="text-white text-sm font-bold rounded-xl px-5 py-3"
            style={{ background: cor }}
          >
            Quero abrir em {nome} →
          </Link>
          <Link
            href={`/vagas/candidatar?marca=${marca.slug}&tipo=franquia&ftipo=popup&cidade=${encodeURIComponent(nome)}&uf=${uf}`}
            className="text-sm font-bold rounded-xl px-5 py-3 border-2"
            style={{ borderColor: cor, color: cor }}
          >
            🚪 Modelo Pop-Up
          </Link>
        </div>
        <p className="text-xs text-slate-400">
          <Link href={`/franquias/${marca.slug}`} className="underline">← Franquia {marca.nome}</Link>
        </p>
      </section>
    </main>
  );
}
