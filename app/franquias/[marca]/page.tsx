// Página de FRANQUIA da marca (público, SEO): descrição + cidades prioritárias
// + formulário. FAQ JSON-LD entra quando o admin cadastrar blocos (F2).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaFranquia } from "@/lib/vagasServer";

export const revalidate = 600;

type Props = { params: { marca: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dados = await paginaFranquia(params.marca);
  if (!dados) return { title: "Franquias" };
  return {
    title: `Franquia ${dados.marca.nome} — abra a sua na sua cidade`,
    description:
      `Como abrir uma franquia ${dados.marca.nome}: requisitos, cidades ` +
      "prioritárias e Franquia Pop-Up para cidades menores. Cadastre seu interesse.",
  };
}

export default async function FranquiaMarca({ params }: Props) {
  const dados = await paginaFranquia(params.marca);
  if (!dados) notFound();
  const { marca, cargo, cidades_prioritarias: cidades } = dados;
  const cor = marca.tema?.cor || "#7c2d12";
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="text-white px-4 py-8" style={{ background: cor }}>
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-extrabold">Franquia {marca.nome}</h1>
          <p className="text-sm opacity-90 mt-1">Leve a marca para a sua cidade</p>
        </div>
      </header>
      <section className="max-w-3xl mx-auto p-4">
        {cargo?.descricao && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-slate-700 whitespace-pre-line">{cargo.descricao}</p>
            {cargo.requisitos && (
              <p className="text-xs text-slate-500 mt-3 whitespace-pre-line">
                <b>O que buscamos:</b> {cargo.requisitos}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link href={`/vagas/candidatar?marca=${marca.slug}&tipo=franquia`}
            className="text-white text-sm font-bold rounded-xl px-5 py-3"
            style={{ background: cor }}>
            Quero ser franqueado →
          </Link>
          <Link href={`/vagas/candidatar?marca=${marca.slug}&tipo=franquia&ftipo=popup`}
            className="text-sm font-bold rounded-xl px-5 py-3 border-2"
            style={{ borderColor: cor, color: cor }}>
            🚪 Franquia Pop-Up (cidades menores)
          </Link>
        </div>
        {cidades.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-slate-700 mb-2">Cidades prioritárias</h2>
            <div className="flex flex-wrap gap-2">
              {cidades.map((c) => (
                <Link key={c.slug} href={`/franquias/${marca.slug}/${c.slug}`}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:shadow">
                  {c.nome}/{c.uf}
                </Link>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-slate-400">
          <Link href="/franquias" className="underline">← Todas as marcas</Link>
        </p>
      </section>
    </main>
  );
}
