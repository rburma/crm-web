"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, usuarioLogado, type UsuarioLogado } from "@/lib/api";

const NAV = [
  { href: "/clientes", label: "Clientes", icon: "👥" },
  { href: "/atendimentos", label: "Atendimentos", icon: "💬" },
  { href: "/usuarios", label: "Usuários", icon: "🔑" },
];

export default function Shell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const path = usePathname() ?? "";
  const [u, setU] = useState<UsuarioLogado | null>(null);
  useEffect(() => setU(usuarioLogado()), []);
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-[var(--line)] bg-white px-3 py-4 hidden md:flex md:flex-col">
        <div className="px-2 mb-6">
          <div className="text-lg font-bold tracking-tight">WT · CRM</div>
          <div className="text-xs text-slate-400">piloto</div>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="text-base leading-none">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2 text-xs text-slate-400">
          {u ? (
            <div>
              <div className="text-slate-600 font-medium truncate">{u.nome || u.email}</div>
              <button
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
                className="text-slate-400 hover:underline mt-0.5"
              >
                Sair
              </button>
            </div>
          ) : (
            <Link href="/login" className="hover:underline">
              Entrar
            </Link>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-[var(--line)] bg-white/80 backdrop-blur sticky top-0 z-10 flex items-center px-6">
          <h1 className="text-sm font-semibold text-slate-700">{title}</h1>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
