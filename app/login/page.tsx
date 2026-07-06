"use client";

import { useEffect, useState } from "react";
// Login e 100% Google (decisao Renato 05/07): sem senha na tela. O e-mail digitado
// (opcional) vira login_hint — o Google ja abre na conta certa.

const MAPA_ERRO: Record<string, string> = {
  "sem-acesso": "Sua conta Google não tem acesso ao CRM. Peça ao administrador.",
  "email-nao-verificado": "Esse e-mail do Google não está verificado.",
  "google-nao-configurado": "Login pelo Google ainda não foi configurado.",
  "google-falhou": "Não foi possível concluir o login com o Google.",
  sessao: "Sua sessão expirou. Entre novamente.",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("erro");
    if (e) setErro(MAPA_ERRO[e] ?? "Não foi possível entrar. Tente de novo.");
  }, []);

  const urlGoogle = "/api/auth/google/start" + (email.trim() ? "?email=" + encodeURIComponent(email.trim()) : "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="card p-7 w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-800">CRM World Tennis</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">Entre com a sua conta Google.</p>

        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-4">{erro}</div>
        )}

        <label className="block text-xs text-slate-500 mb-1">Seu e-mail (opcional — agiliza a escolha da conta)</label>
        <input
          className="input w-full mb-4"
          type="email"
          placeholder="voce@franquia.email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />

        <a href={urlGoogle} className="btn-primary w-full flex items-center justify-center gap-2">
          Entrar com Google
        </a>
        <p className="text-[11px] text-slate-400 mt-3 text-center">
          Sem senha: a conta Google cadastrada no CRM é o seu acesso.
        </p>
        <p className="text-[10px] text-slate-300 mt-2 text-center" title="Versão do frontend (commit)">
          v{process.env.NEXT_PUBLIC_VERSION ?? "dev"}
        </p>
      </div>
    </div>
  );
}
