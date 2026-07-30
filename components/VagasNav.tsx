"use client";
// Navegação interna do módulo VAGAS (pedido Renato 30/07: admin não pode ter
// que adivinhar URL). Abas no topo das 3 telas: Matriz · Candidatos ·
// Administração (esta só aparece p/ admin do sistema — mesma regra do Shell:
// campo `menu` do /auth/me decide; fallback no papel). O backend revalida.
import Link from "next/link";
import { useEffect, useState } from "react";
import { usuarioLogado } from "@/lib/api";

const GLOBAIS = ["admin", "rede", "matriz"];

export default function VagasNav({ atual }: { atual: "matriz" | "ranking" | "admin" }) {
  const [ehAdmin, setEhAdmin] = useState(false);
  useEffect(() => {
    const u = usuarioLogado();
    const menu = u?.menu ?? "";
    setEhAdmin(menu ? menu === "admin" : GLOBAIS.includes(u?.papel ?? ""));
  }, []);
  const abas = [
    { chave: "matriz", href: "/vagas/matriz", rotulo: "💼 Matriz de vagas" },
    { chave: "ranking", href: "/vagas/ranking", rotulo: "🏆 Candidatos" },
    ...(ehAdmin
      ? [{ chave: "admin", href: "/vagas/admin", rotulo: "⚙️ Administração" }]
      : []),
  ];
  return (
    <div className="flex gap-1.5 flex-wrap mb-4">
      {abas.map((a) => (
        <Link
          key={a.chave}
          href={a.href}
          className={`text-sm px-3.5 py-1.5 rounded-lg border font-semibold ${
            atual === a.chave
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {a.rotulo}
        </Link>
      ))}
    </div>
  );
}
