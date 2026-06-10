"use client";

import { useParams } from "next/navigation";
import AvaliacaoAbertaPagina from "@/components/AvaliacaoAbertaPagina";

// Página pública de avaliação DA LOJA — o QR code da loja aponta pra cá.
export default function AvaliarLojaPage() {
  const params = useParams<{ lojaId: string }>();
  return <AvaliacaoAbertaPagina modo="loja" ref_={params?.lojaId ?? ""} />;
}
