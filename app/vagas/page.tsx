// Hub geral de vagas da rede (público, SEO). Server Component + ISR.
import type { Metadata } from "next";
import Link from "next/link";
import { hubGeral } from "@/lib/vagasServer";
import MapaRede from "./MapaRede";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Trabalhe Conosco — vagas de emprego nas nossas lojas",
  description:
    "Vagas de emprego nas lojas das nossas marcas em todo o Brasil. " +
    "Candidate-se online ou deixe seu currículo no banco de talentos.",
};

export default async function VagasHub() {
  const dados = await hubGeral();
  const marcas = dados?.vagas ?? [];
  const franquias = dados?.franquias ?? [];
  const blocos = (dados?.blocos ?? []).filter((b) => b.escopo === "vagas");
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-4 py-8 text-center">
        <h1 className="text-2xl font-extrabold">Trabalhe Conosco</h1>
        <p className="text-sm opacity-80 mt-1">
          Escolha a marca e veja as vagas abertas perto de você
        </p>
      </header>
      <section className="max-w-3xl mx-auto p-4">
        {blocos.map((b, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 mb-3">
            {b.titulo && <h2 className="font-bold mb-1">{b.titulo}</h2>}
            {b.texto && <p className="text-sm text-slate-600 whitespace-pre-line">{b.texto}</p>}
          </div>
        ))}
        {marcas.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">
            Nenhuma vaga publicada no momento — volte em breve!
          </p>
        )}
        {marcas.length > 0 && <MapaRede marcas={marcas} />}
        {franquias.length > 0 && (
          <div className="mt-8">
            <h2 className="font-bold mb-2">Quer ser franqueado?</h2>
            <div className="flex flex-wrap gap-2">
              {franquias.map((m) => (
                <Link
                  key={m.slug}
                  href={`/franquias/${m.slug}`}
                  className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 hover:shadow"
                >
                  🏪 Franquia {m.nome}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
