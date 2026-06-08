"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { login, salvarSessao } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) return;
    setCarregando(true);
    setErro("");
    try {
      const r = await login(email.trim(), senha);
      salvarSessao(r.token, r.usuario);
      router.push("/clientes");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <form onSubmit={entrar} className="card p-7 w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-800">CRM World Tennis</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">Entre com seu e-mail e senha.</p>

        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-4">{erro}</div>
        )}

        <label className="block text-xs text-slate-500 mb-1">E-mail</label>
        <input
          className="input w-full mb-3"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />

        <label className="block text-xs text-slate-500 mb-1">Senha</label>
        <input
          className="input w-full mb-5"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <button className="btn-primary w-full" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
