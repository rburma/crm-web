// Página de vagas da MARCA (público, SEO): lojas agrupadas por cidade.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hubMarca } from "@/lib/vagasServer";

export const revalidate = 600;

type Props = { params: { marca: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dados = await hubMarca(params.marca);
  if (!dados) return { title: "Vagas" };
  const nome = dados.marca.nome;
  return {
    title: `Vagas de emprego ${nome} — trabalhe conosco`,
    description:
      `Vagas de emprego nas lojas ${nome}: veja as posições abertas por ` +
      "cidade e candidate-se online, ou deixe seu currículo no banco de talentos.",
  };
}

export default async function VagasMarca({ params }: Props) {
  const dados = await hubMarca(params.marca);
  if (!dados) notFound();
  const { marca, lojas, cargos } = dados;
  const cor = marca.tema?.cor || "#0f172a";
  const porCidade = new Map<string, typeof lojas>();
  for (const lj of lojas) {
    const c = lj.cidade || "Outras cidades";
    if (!porCidade.has(c)) porCidade.set(c, []);
    porCidade.get(c)!.push(lj);
  }
  const titulos = new Map(cargos.map((c) => [c.id, c.titulo]));
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="text-white px-4 py-8 text-center" style={{ background: cor }}>
        <h1 className="text-2xl font-extrabold">Trabalhe na {marca.nome}</h1>
        <p className="text-sm opacity-90 mt-1">
          Vagas de emprego nas lojas {marca.nome} — escolha a sua cidade
        </p>
      </header>
      <section className="max-w-3xl mx-auto p-4">
        {[...porCidade.entries()].map(([cidade, ljs]) => (
          <div key={cidade} className="mb-6">
            <h2 className="font-bold text-slate-700 mb-2">{cidade}</h2>
            <div className="grid grid-cols-1 gap-2">
              {ljs.map((lj) => (
                <Link
                  key={lj.id}
                  href={`/vagas/${marca.slug}/${lj.cidade_slug}/${lj.slug}-${lj.id}`}
                  className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow flex justify-between items-center gap-2 flex-wrap"
                >
                  <span>
                    <span className="font-semibold">{lj.nome}</span>
                    <span className="block text-xs text-slate-500">
                      {[lj.shopping, lj.bairro, lj.uf].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-xs">
                    {(lj.cargos_abertos ?? []).length > 0 ? (
                      <span className="text-emerald-700 font-bold">
                        {(lj.cargos_abertos ?? [])
                          .map((id) => titulos.get(id))
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : (
                      <span className="text-slate-400">banco de currículos</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-slate-400 mt-6">
          <Link href="/vagas" className="underline">← Todas as marcas</Link>
        </p>
      </section>
    </main>
  );
}
