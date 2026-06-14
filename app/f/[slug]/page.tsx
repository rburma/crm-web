import type { Metadata } from "next";
import { metadataMarca } from "@/lib/metadataMarca";
import FormPublico from "./FormPublico";

// Server component: só monta a METADATA por marca (título/Open Graph/favicon).
// O formulário em si é o FormPublico (client).
export async function generateMetadata(
  { params }: { params: { slug: string } },
): Promise<Metadata> {
  return metadataMarca(params.slug, "Atendimento ao cliente");
}

export default function Page() {
  return <FormPublico />;
}
