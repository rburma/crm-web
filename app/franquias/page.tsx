// Hub de EXPANSÃO (público, SEO): marcas com página de franquia.
import type { Metadata } from "next";
import Link from "next/link";
import { hubGeral } from "@/lib/vagasServer";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Seja um franqueado — franquias das nossas marcas",
  description:
    "Abra uma franquia das nossas marcas: lojas em shoppings e Franquias " +
    "Pop-Up para cidades menores. Cadastre seu interesse online.",
};

export default async function FranquiasHub() {
  const dados = await hubGeral();
  const marcas = dados?.franquias ?? [];
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-amber-900 text-white px-4 py-8 text-center">
        <h1 className="text-2xl font-extrabold">🏪 Seja um franqueado</h1>
        <p className="text-sm opacity-90 mt-1">
          Leve uma das nossas marcas para a sua cidade
        </p>
      </header>
      <section className="max-w-3xl mx-auto p-4">
        {marcas.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">
            Nenhum programa de expansão publicado no momento.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {marcas.map((m) => (
            <Link key={m.slug} href={`/franquias/${m.slug}`}
              className="block bg-white border border-slate-200 rounded-xl p-4 hover:shadow">
              <div className="font-bold" style={{ color: m.tema?.cor || "#0f172a" }}>
                Franquia {m.nome}
              </div>
              <div className="text-xs text-slate-500 mt-1">Conheça o programa →</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
