"use client";
// Busca COMPLETA de lojas na página pública da marca (pedido 30/07):
// nome, endereço, número, bairro, CEP, cidade, UF e shopping — sem acento,
// vários termos = todos precisam casar. Renderiza no servidor também
// (client component hidrata), então o SEO da lista continua intacto.
import { useMemo, useState } from "react";
import Link from "next/link";
import MapaBrasil, { UFS_BR } from "@/components/MapaBrasil";
import type { CargoPub, LojaPub } from "@/lib/vagasServer";

function norm(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function BuscaLojas({ marcaSlug, cor, lojas, cargos, ufInicial }: {
  marcaSlug: string; cor: string; lojas: LojaPub[]; cargos: CargoPub[];
  ufInicial?: string;
}) {
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState<string | null>(
    ufInicial && (UFS_BR.includes(ufInicial.toUpperCase()) || ufInicial === "OUTRAS")
      ? ufInicial.toUpperCase() : null,
  );
  const titulos = useMemo(
    () => new Map(cargos.map((c) => [c.id, c.titulo])), [cargos],
  );
  const indice = useMemo(
    () => lojas.map((lj) => ({
      lj,
      texto: norm([
        lj.nome, lj.endereco, lj.numero, lj.bairro, lj.cep,
        lj.cep ? lj.cep.replace(/\D/g, "") : "",
        lj.cidade, lj.uf, lj.shopping,
      ].filter(Boolean).join(" ")),
    })),
    [lojas],
  );
  const termos = norm(busca).split(/\s+/).filter(Boolean);
  const buscadas = termos.length
    ? indice
        .filter((i) =>
          termos.every((t) => {
            // CEP digitado com traço/ponto casa com a forma só-dígitos
            const chave = /^[\d.-]+$/.test(t) ? t.replace(/\D/g, "") : t;
            if (!chave) return false;
            // termos de 1-2 letras (ex.: UF "CE") casam por PALAVRA inteira
            if (chave.length <= 2) return ` ${i.texto} `.includes(` ${chave} `);
            return i.texto.includes(chave);
          }),
        )
        .map((i) => i.lj)
    : lojas;
  const contagem: Record<string, number> = {};
  for (const lj of lojas) {
    const u = (lj.uf || "").toUpperCase();
    const chave = UFS_BR.includes(u) ? u : "OUTRAS";
    contagem[chave] = (contagem[chave] || 0) + 1;
  }
  const visiveis = uf
    ? buscadas.filter((lj) => {
        const u = (lj.uf || "").toUpperCase();
        return uf === "OUTRAS" ? !UFS_BR.includes(u) : u === uf;
      })
    : buscadas;

  const porCidade = new Map<string, LojaPub[]>();
  for (const lj of visiveis) {
    const c = lj.cidade || "Outras cidades";
    if (!porCidade.has(c)) porCidade.set(c, []);
    porCidade.get(c)!.push(lj);
  }

  return (
    <div>
      <input
        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm mb-4 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        placeholder="🔎 Busque por cidade, bairro, CEP, shopping, rua ou nome da loja…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <MapaBrasil contagem={contagem} cor={cor} selecionado={uf} onSelect={setUf} />
      {visiveis.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-6">
          Nenhuma loja encontrada para “{busca}” — tente outro termo (cidade,
          CEP ou shopping).
        </p>
      )}
      {[...porCidade.entries()].map(([cidade, ljs]) => (
        <div key={cidade} className="mb-6">
          <h2 className="font-bold text-slate-700 mb-2">{cidade}</h2>
          <div className="grid grid-cols-1 gap-2">
            {ljs.map((lj) => (
              <Link
                key={lj.id}
                href={`/vagas/${marcaSlug}/${lj.cidade_slug}/${lj.slug}-${lj.id}`}
                className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow flex justify-between items-center gap-2 flex-wrap"
              >
                <span>
                  <span className="font-semibold">{lj.nome}</span>
                  <span className="block text-xs text-slate-500">
                    {[lj.shopping, [lj.endereco, lj.numero].filter(Boolean).join(", "),
                      lj.bairro, lj.cep, lj.uf].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-xs">
                  {(lj.cargos_abertos ?? []).length > 0 ? (
                    <span className="font-bold" style={{ color: cor }}>
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
    </div>
  );
}
