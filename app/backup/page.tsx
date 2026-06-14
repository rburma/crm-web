"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import {
  backupIniciar,
  backupJob,
  backupResumo,
  type BackupJob,
  type BackupResumo,
} from "@/lib/api";

function fmtBytes(n?: number | null): string {
  if (!n) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < u.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(1)} ${u[i]}`;
}

function nf(n?: number | null): string {
  return (n ?? 0).toLocaleString("pt-BR");
}

/** Backup completo do CRM (admin): gera em segundo plano e baixa direto do Render. */
export default function BackupPage() {
  const [resumo, setResumo] = useState<BackupResumo | null>(null);
  const [job, setJob] = useState<BackupJob | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    backupResumo()
      .then(setResumo)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro"));
  }, []);

  async function gerar() {
    setErro("");
    setGerando(true);
    setJob(null);
    try {
      const { job_id } = await backupIniciar();
      let j = await backupJob(job_id);
      setJob(j);
      while (j.status === "rodando") {
        await new Promise((r) => setTimeout(r, 1200));
        j = await backupJob(job_id);
        setJob(j);
      }
      if (j.status === "erro") setErro(j.erro || "Falha ao gerar o backup.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setGerando(false);
    }
  }

  const contagens = resumo
    ? Object.entries(resumo.contagens).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <Shell title="Backup">
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <h2 className="font-semibold text-slate-700 mb-1">Backup completo do CRM</h2>
          <p className="text-sm text-slate-500 mb-4">
            Gera um <b>.zip</b> com TODAS as tabelas (1 CSV por tabela) + um manifesto com as
            contagens. Roda em segundo plano e o download vem direto do servidor (aguenta a base
            cheia). As senhas dos usuários não entram no backup.
          </p>
          <button className="btn-primary" onClick={gerar} disabled={gerando}>
            {gerando ? "Gerando…" : "Gerar backup"}
          </button>

          {job && job.status === "rodando" ? (
            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-1">
                {job.fase || "processando"} · {job.progresso ?? 0}%
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${job.progresso ?? 0}%` }}
                />
              </div>
            </div>
          ) : null}

          {job && job.status === "pronto" && job.download_url ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="text-emerald-800 font-medium mb-1">Backup pronto! ✅</div>
              <div className="text-slate-600 mb-2">
                {nf(job.total_tabelas)} tabelas · {nf(job.total_registros)} registros
                {job.size_bytes ? ` · ${fmtBytes(job.size_bytes)}` : ""}
              </div>
              <a className="btn-primary inline-block" href={job.download_url}>
                ⬇ Baixar (.zip)
              </a>
              <div className="text-[11px] text-slate-400 mt-1.5">
                O link é de uso único e expira em ~20 minutos.
              </div>
            </div>
          ) : null}

          {erro ? <div className="mt-3 text-sm text-red-600">{erro}</div> : null}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 mb-2">
            Conferência — o que está no banco agora
          </h3>
          {!resumo ? (
            <div className="text-sm text-slate-400">Carregando…</div>
          ) : (
            <>
              <div className="text-sm text-slate-500 mb-3">
                {nf(resumo.total_tabelas)} tabelas · {nf(resumo.total_registros)} registros no total.
              </div>
              <div className="max-h-80 overflow-y-auto border border-slate-100 rounded-lg">
                <table className="w-full text-sm">
                  <tbody>
                    {contagens.map(([t, n]) => (
                      <tr key={t} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-1.5 text-slate-600">{t}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                          {nf(n)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
