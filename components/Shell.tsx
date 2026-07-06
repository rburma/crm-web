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
  { href: "/clientes", label: "Clientes", icon: "👥", vis: "todos" }, // loja/franqueado veem SO os clientes do proprio escopo (backend)
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
      {/* MENU HORIZONTAL no topo (Renato 06/07): as listas ganham a largura
          inteira da tela. Mesmo NAV/permissoes do menu lateral antigo. */}
      <header className="bg-slate-900 text-slate-300 sticky top-0 z-20">
        <div className="px-4 py-2 flex items-center gap-1 flex-wrap">
          <Link href="/" className="text-white font-bold tracking-tight text-sm mr-3">
            WT · CRM
          </Link>
          {navVisivel.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                className={`rounded px-2 py-1 text-[13px] font-medium transition whitespace-nowrap ${
                  active ? "bg-slate-700 text-white" : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="mr-1">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
          <div className="ml-auto flex items-center gap-2 text-xs">
            {u ? (
              <>
                <span className="text-slate-400 truncate max-w-[180px]">{u.nome || u.email}</span>
                <button
                  onClick={() => {
                    logout();
                    window.location.href = "/login";
                  }}
                  className="hover:text-white border-l border-slate-700 pl-2"
                >
                  Sair
                </button>
              </>
            ) : (
              <Link href="/login" className="hover:text-white">Entrar</Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 min-w-0 flex flex-col">
        {title && (
          <div className="px-4 pt-3">
            <h1 className="text-sm font-semibold text-slate-700">{title}</h1>
          </div>
        )}
        <main className="flex-1 p-4">
          <AjudaWidget />
          {children}
        </main>
      </div>
    </div>
  );
}
