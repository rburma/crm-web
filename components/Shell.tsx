"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AjudaWidget from "@/components/AjudaWidget";
import {
  impersonando,
  logout,
  sairImpersonacao,
  usuarioLogado,
  type UsuarioLogado,
} from "@/lib/api";

// vis: "todos" (loja+franqueado+admin) | "franqueado" (franqueado+admin) | "admin" (só global)
const NAV = [
  { href: "/", label: "Painel", icon: "📊", vis: "todos" },
  { href: "/clientes", label: "Clientes", icon: "👥", vis: "admin" },
  { href: "/atendimentos", label: "Atendimentos", icon: "💬", vis: "todos" },
  { href: "/obrigacoes", label: "Obrigações", icon: "📋", vis: "todos" },
  { href: "/avaliacoes", label: "Avaliações", icon: "⭐", vis: "todos" },
  { href: "/reputacao", label: "Reputação", icon: "🏆", vis: "todos" },
  { href: "/minhas-lojas", label: "Minha Loja", icon: "🏬", vis: "franqueado" },
  { href: "/importar", label: "Importar", icon: "📥", vis: "admin" },
  { href: "/equipe", label: "Equipe", icon: "🏪", vis: "admin" },
  { href: "/aprovacoes", label: "Aprovações", icon: "📝", vis: "admin" },
  { href: "/usuarios", label: "Usuários", icon: "🔑", vis: "admin" },
  { href: "/go-live", label: "Go-live", icon: "🚀", vis: "admin" },
  { href: "/ajuda", label: "Ajuda", icon: "❓", vis: "todos" },
  { href: "/configuracoes", label: "Configurações", icon: "⚙️", vis: "admin" },
  { href: "/backup", label: "Backup", icon: "💾", vis: "admin" },
  { href: "/lgpd", label: "LGPD", icon: "🛡️", vis: "admin" },
];
const GLOBAIS_MENU = ["admin", "rede", "matriz", "staff", "master"];

export default function Shell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const path = usePathname() ?? "";
  const [u, setU] = useState<UsuarioLogado | null>(null);
  const [imp, setImp] = useState(false);
  useEffect(() => {
    setU(usuarioLogado());
    setImp(impersonando());
  }, []);
  const papel = u?.papel ?? "";
  // Piloto: atras do portao, o backend trata sem-login como admin (X-Usuario-Id=1).
  // Entao SEM usuario salvo -> menu de admin. So um usuario NAO-global logado (ex.:
  // franqueado) ve o menu restrito.
  const ehGlobal = !papel || GLOBAIS_MENU.includes(papel);
  const navVisivel = NAV.filter(
    (n) =>
      ehGlobal ||
      n.vis === "todos" ||
      (n.vis === "franqueado" && papel === "franqueado"),
  );
  return (
    <div className="min-h-screen flex flex-col">
      {imp && u && (
        <div className="bg-amber-400 text-amber-950 text-sm px-4 py-2 flex items-center justify-center gap-3 sticky top-0 z-30">
          <span>
            👁 Você está vendo o sistema como <b>{u.nome || u.email}</b>
            <span className="text-amber-800"> ({u.papel})</span> — o que aparece é o que ELE vê.
          </span>
          <button
            onClick={() => {
              sairImpersonacao();
              window.location.href = "/equipe";
            }}
            className="underline font-semibold hover:text-amber-800"
          >
            voltar a ser admin
          </button>
        </div>
      )}
      <div className="flex flex-1">
      <aside className="w-60 shrink-0 border-r border-[var(--line)] bg-white px-3 py-4 hidden md:flex md:flex-col">
        <div className="px-2 mb-6">
          <div className="text-lg font-bold tracking-tight">WT · CRM</div>
          <div className="text-xs text-slate-400">piloto</div>
        </div>
        <nav className="space-y-1">
          {navVisivel.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
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
        <main className="flex-1 p-6">
          <AjudaWidget />
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
