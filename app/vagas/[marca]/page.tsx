// Página de vagas da MARCA (público, SEO): lojas agrupadas por cidade.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hubMarca } from "@/lib/vagasServer";
import BuscaLojas from "./BuscaLojas";

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
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="text-white px-4 py-8 text-center" style={{ background: cor }}>
        <h1 className="text-2xl font-extrabold">Trabalhe na {marca.nome}</h1>
        <p className="text-sm opacity-90 mt-1">
          Vagas de emprego nas lojas {marca.nome} — busque pela sua cidade,
          bairro, CEP ou shopping
        </p>
      </header>
      <section className="max-w-3xl mx-auto p-4">
        <BuscaLojas marcaSlug={marca.slug} cor={cor} lojas={lojas} cargos={cargos} />
        <p className="text-xs text-slate-400 mt-6">
          <Link href="/vagas" className="underline">← Todas as marcas</Link>
        </p>
      </section>
    </main>
  );
}
