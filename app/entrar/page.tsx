"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { me } from "@/lib/api";

// Finaliza o login pelo Google: o cookie de sessão já veio do /callback; aqui só
// buscamos o usuário (/auth/me), guardamos no localStorage e seguimos pro CRM.
function EntrarInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [erro, setErro] = useState("");

  useEffect(() => {
    const e = sp?.get("erro");
    if (e) {
      router.replace(`/login?erro=${encodeURIComponent(e)}`);
      return;
    }
    me()
      .then((u) => {
        try { localStorage.setItem("crm_usuario", JSON.stringify(u)); } catch { /* ignore */ }
        router.replace("/clientes");
      })
      .catch(() => router.replace("/login?erro=sessao"));
  }, [router, sp]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      {erro || "Entrando…"}
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Entrando…</div>}
    >
      <EntrarInner />
    </Suspense>
  );
}
