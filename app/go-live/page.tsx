"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { golivePreview, goliveAplicar, type GoLiveResultado } from "@/lib/api";

function Resumo({ r }: { r: GoLiveResultado["resumo"] }) {
  const cards = [
    { n: r.linhas, l: "linhas" },
    { n: r.lojas_atualizadas, l: "lojas atualizadas" },
    { n: r.usuarios_criados, l: "usuários criados" },
    { n: r.vinculos_criados, l: "acessos (loja↔pessoa)" },
    { n: r.erros, l: "linhas com erro", alerta: r.erros > 0 },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div
          key={c.l}
          className={`card p-3 text-center ${c.alerta ? "border-red-200 bg-red-50" : ""}`}
        >
          <div className="text-2xl font-extrabold">{c.n}</div>
          <div className="text-xs text-slate-500">{c.l}</div>
        </div>
      ))}
    </div>
  );
}

export default function GoLivePage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<GoLiveResultado | null>(null);
  const [aplicado, setAplicado] = useState<GoLiveResultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function escolher(f: File | null) {
    setArquivo(f);
    setPreview(null);
    setAplicado(null);
    setErro("");
    if (!f) return;
    setCarregando(true);
    try {
      setPreview(await golivePreview(f));
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setCarregando(false);
    }
  }

  async function aplicar() {
    if (!arquivo) return;
    if (!window.confirm("Aplicar a planilha? Vai ativar/desativar lojas e criar/vincular usuários.")) {
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      setAplicado(await goliveAplicar(arquivo));
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setCarregando(false);
    }
  }

  const r = aplicado ?? preview;

  return (
    <Shell>
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold">🚀 Planilha de Go-live</h1>
          <p className="text-sm text-slate-500">
            Suba uma planilha (1 linha por loja) para ativar lojas, gravar CNPJ e criar os
            usuários de login (Google, sem senha) com acesso à loja. Veja a PRÉVIA e só então
            aplique. Nada é apagado; tudo é auditado.
          </p>
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-3">
          <a href="/api/render/golive/modelo" className="btn-ghost text-sm">⬇ Baixar modelo (.xlsx)</a>
          <label className="btn-primary text-sm cursor-pointer">
            Escolher planilha…
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => { escolher(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
            />
          </label>
          {arquivo && <span className="text-sm text-slate-500">{arquivo.name}</span>}
          {carregando && <span className="text-sm text-slate-400">processando…</span>}
        </div>

        {erro && <div className="card p-3 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}

        {aplicado && (
          <div className="card p-3 border-emerald-200 bg-emerald-50 text-sm text-emerald-700">
            ✅ Aplicado! {aplicado.resumo.lojas_atualizadas} lojas, {aplicado.resumo.usuarios_criados}{" "}
            usuários, {aplicado.resumo.vinculos_criados} acessos.
          </div>
        )}

        {r && (
          <>
            <Resumo r={r.resumo} />
            {!aplicado && (
              <button className="btn-primary" onClick={aplicar} disabled={carregando}>
                {carregando ? "Aplicando…" : "Aplicar planilha"}
              </button>
            )}
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="p-2">Linha</th>
                    <th className="p-2">Sigla</th>
                    <th className="p-2">Loja</th>
                    <th className="p-2">Ações</th>
                    <th className="p-2">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {r.detalhes.map((d) => (
                    <tr key={d.linha} className={`border-b border-slate-100 ${d.erro ? "bg-red-50" : ""}`}>
                      <td className="p-2 text-slate-400">{d.linha}</td>
                      <td className="p-2 font-mono">{d.sigla}</td>
                      <td className="p-2">{d.loja ?? "—"}</td>
                      <td className="p-2 text-slate-600">{d.acoes.join(" · ") || "—"}</td>
                      <td className="p-2 text-red-600">{d.erro ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
