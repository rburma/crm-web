// Formulário de candidatura (vaga OU franquia). Server wrapper lê a query e
// entrega ao componente cliente. Mobile-first.
import CandidatarForm from "./CandidatarForm";

export const metadata = { title: "Candidatura — Trabalhe Conosco" };

type Props = {
  searchParams: {
    marca?: string; loja?: string; cargo?: string;
    tipo?: string; cidade?: string; uf?: string; ftipo?: string;
  };
};

export default function CandidatarPage({ searchParams }: Props) {
  return (
    <CandidatarForm
      marca={searchParams.marca || ""}
      lojaId={Number(searchParams.loja) || 0}
      cargoId={Number(searchParams.cargo) || 0}
      tipo={searchParams.tipo === "franquia" ? "franquia" : "vaga"}
      cidade={searchParams.cidade || ""}
      uf={searchParams.uf || ""}
      franquiaTipo={searchParams.ftipo === "popup" ? "popup" : "loja"}
    />
  );
}
