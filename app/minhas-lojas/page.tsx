"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { minhasLojas, type MinhaLoja } from "@/lib/api";

export default function MinhasLojasPage() {
  const [lojas, setLojas] = useState<MinhaLoja[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  useEffect(() => {
    minhasLojas()
      .then((r) => setLojas(r))
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"))
      .finally(() => setCarregando(false));
  }, []);
  return (
    <Shell title="Minha Loja">
      <div className="max-w-3xl">
        <p className="text-sm text-slate-500 mb-4">
          Atualize o cadastro da(s) sua(s) loja(s): endereço, contatos, redes sociais,
          delivery e links de avaliação. As alterações passam por aprovação.
        </p>
        {erro && <div className="text-sm text-red-600 mb-3">{erro}</div>}
        {carregando ? (
          <div className="text-sm text-slate-400">Carregando…</div>
        ) : lojas.length === 0 ? (
          <div className="text-sm text-slate-400">Nenhuma loja vinculada ao seu acesso.</div>
        ) : (
          <div className="space-y-2">
            {lojas.map((l) => (
              <div
                key={l.loja_id}
                className="card flex items-center justify-between gap-3 p-3"
              >
                <div>
                  <div className="font-medium text-slate-700">
                    {l.nome || `Loja ${l.loja_id}`}
                  </div>
                  {l.sigla && (
                    <div className="text-xs text-slate-400 font-mono">{l.sigla}</div>
                  )}
                </div>
                <Link
                  href={`/minha-loja/${l.token}`}
                  className="btn-primary text-sm whitespace-nowrap"
                >
                  Editar cadastro
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
