"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { franqueadoPorSigla } from "@/lib/api";

/** Atalho do link da OBRIGAÇÃO da cobrança: /minha-loja/s/{codigo_loja} (sigla).
 *  Resolve a sigla → token e manda pro formulário do franqueado. Assim a cobrança
 *  monta o link só com a sigla que ela já tem, sem consultar o CRM. */
export default function MinhaLojaPorSigla() {
  const params = useParams<{ sigla: string }>();
  const router = useRouter();
  const [erro, setErro] = useState("");

  useEffect(() => {
    const sigla = params?.sigla ?? "";
    if (!sigla) return;
    franqueadoPorSigla(sigla)
      .then((r) => router.replace(`/minha-loja/${r.token}`))
      .catch(() => setErro("Loja não encontrada para este link. Confira com a franqueadora."));
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500 px-6 text-center">
      {erro || "Abrindo o cadastro da sua loja…"}
    </div>
  );
}
