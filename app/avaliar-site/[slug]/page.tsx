"use client";

import { useParams } from "next/navigation";
import AvaliacaoAbertaPagina from "@/components/AvaliacaoAbertaPagina";

// Página pública de avaliação DO SITE (marca, sem loja específica).
export default function AvaliarSitePage() {
  const params = useParams<{ slug: string }>();
  return <AvaliacaoAbertaPagina modo="site" ref_={params?.slug ?? ""} />;
}
