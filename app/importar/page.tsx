"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import {
  CAMPOS_IMPORT,
  importAplicar,
  importColunas,
  importPreview,
  type ImportColunas,
  type ImportPreview,
  type ImportResultado,
} from "@/lib/api";

// Heurística de auto-mapeamento pelo nome da coluna (o usuário pode trocar).
function adivinhar(coluna: string): string {
  const c = coluna.toLowerCase();
  if (c.includes("cpf")) return "cpf";
  if (c.includes("mail")) return "email";
  if (/(tel|cel|fone|whats|contato)/.test(c)) return "telefone";
  if (/(nascim|nasc\.|data de nasc)/.test(c)) return "nascimento";
  if (c.includes("nome")) return "nome";
  if (/(loja|franquia|unidade|apelido)/.test(c)) return "loja_ref";
  if (c.includes("tag")) return "tags";
  return "";
}

export default function ImportarPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [cols, setCols] = useState<ImportColunas | null>(null);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [origem, setOrigem] = useState("evento");
  const [descricao, setDescricao] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [resultado, setResultado] = useState<ImportResultado | null>(null);
  const [carregando, setCarregando] = useState<"" | "colunas" | "preview" | "aplicar">("");
  const [erro, setErro] = useState("");

  const temContato = Object.values(mapa).some((v) => ["cpf", "telefone", "email"].includes(v));
  const temLoja = Object.values(mapa).some((v) => v === "loja_ref");

  function reset() {
    setCols(null); setMapa({}); setPreview(null); setResultado(null); setErro("");
  }

  async function aoEscolher(f: File | null) {
    setArquivo(f);
    reset();
    if (!f) return;
    setCarregando("colunas");
    try {
      const c = await importColunas(f);
      setCols(c);
      const m: Record<string, string> = {};
      c.colunas.forEach((col) => { m[col] = adivinhar(col); });
      setMapa(m);
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setCarregando("");
    }
  }

  // Mapeamento enviado ao backend: só as colunas com destino escolhido.
  function mapaEfetivo(): Record<string, string> {
    const out: Record<string, string> = {};
    Object.entries(mapa).forEach(([col, campo]) => { if (campo) out[col] = campo; });
    return out;
  }

  async function aoPrever() {
    if (!arquivo) return;
    setErro(""); setResultado(null); setCarregando("preview");
    try {
      setPreview(await importPreview(arquivo, mapaEfetivo(), origem.trim() || "import"));
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setCarregando("");
    }
  }

  async function aoAplicar() {
    if (!arquivo) return;
    if (!confirm("Aplicar a importação na base? Clientes novos serão criados e os existentes enriquecidos.")) return;
    setErro(""); setCarregando("aplicar");
    try {
      const r = await importAplicar(arquivo, mapaEfetivo(), origem.trim() || "import", descricao.trim() || undefined);
      setResultado(r);
      setPreview(null);
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setCarregando("");
    }
  }

  return (
    <Shell title="Importar clientes (planilha)">
      <div className="max-w-5xl space-y-5">
        {/* Passo 1 — arquivo */}
        <div className="card p-4">
          <div className="label">1. Planilha (.xlsx) — a 1ª linha deve ser o cabeçalho</div>
          <input
            type="file"
            accept=".xlsx"
            className="input"
            onChange={(e) => aoEscolher(e.target.files?.[0] ?? null)}
          />
          {carregando === "colunas" && <p className="text-xs text-slate-500 mt-2">Lendo colunas…</p>}
        </div>

        {erro && (
          <div className="card p-3 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>
        )}

        {/* Passo 2 — mapeamento */}
        {cols && (
          <div className="card p-4 space-y-3">
            <div className="label">2. Para que serve cada coluna?</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Coluna da planilha</th>
                    <th className="th">Vira…</th>
                    <th className="th">Exemplo</th>
                  </tr>
                </thead>
                <tbody>
                  {cols.colunas.map((col, i) => (
                    <tr key={col} className="border-t border-[var(--line)]">
                      <td className="td font-medium">{col}</td>
                      <td className="td">
                        <select
                          className="input"
                          value={mapa[col] ?? ""}
                          onChange={(e) => setMapa({ ...mapa, [col]: e.target.value })}
                        >
                          {CAMPOS_IMPORT.map((c) => (
                            <option key={c.campo} value={c.campo}>{c.rotulo}</option>
                          ))}
                        </select>
                      </td>
                      <td className="td text-slate-500">{cols.amostra[0]?.[i] ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="label">Origem (rótulo do lote)</div>
                <input className="input" value={origem} onChange={(e) => setOrigem(e.target.value)}
                  placeholder="evento | sistema | erp…" />
              </div>
              <div>
                <div className="label">Descrição (opcional)</div>
                <input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: Lista da feira X, jun/2026" />
              </div>
            </div>

            {!temContato && (
              <p className="text-xs text-amber-700">⚠️ Mapeie ao menos um contato (CPF, telefone ou e-mail) — é o que identifica o cliente.</p>
            )}
            {!temLoja && (
              <p className="text-xs text-amber-700">⚠️ Sem uma coluna de <b>Loja</b>, todas as linhas vão dar erro “loja não encontrada”.</p>
            )}

            <div className="flex gap-2">
              <button className="btn-ghost" onClick={aoPrever} disabled={!temContato || carregando !== ""}>
                {carregando === "preview" ? "Conferindo…" : "Pré-visualizar"}
              </button>
              <button className="btn-primary" onClick={aoAplicar}
                disabled={!preview || carregando !== ""}
                title={!preview ? "Pré-visualize primeiro" : ""}>
                {carregando === "aplicar" ? "Aplicando…" : "Aplicar na base"}
              </button>
            </div>
          </div>
        )}

        {/* Passo 3 — resultado do preview */}
        {preview && (
          <div className="card p-4 space-y-3">
            <div className="label">3. Prévia (nada foi gravado ainda)</div>
            <div className="flex flex-wrap gap-2">
              <span className="badge-gray">Total: {preview.total}</span>
              <span className="badge-green">Novos: {preview.novos}</span>
              <span className="badge-blue">Enriquece: {preview.enriquece}</span>
              <span className={preview.erros.length ? "badge-amber" : "badge-gray"}>Erros: {preview.erros.length}</span>
            </div>
            {preview.erros.length > 0 && (
              <div className="text-sm">
                <div className="text-slate-500 mb-1">Erros (primeiros):</div>
                <ul className="list-disc pl-5 text-slate-600">
                  {preview.erros.slice(0, 15).map((er) => (
                    <li key={er.linha}>Linha {er.linha}: {er.motivo}</li>
                  ))}
                  {preview.erros.length > 15 && <li>… e mais {preview.erros.length - 15}.</li>}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-500">Confira os números. Se estiver certo, clique em <b>Aplicar na base</b>.</p>
          </div>
        )}

        {/* Resultado do aplicar */}
        {resultado && (
          <div className="card p-4 space-y-2 border-emerald-200 bg-emerald-50">
            <div className="label">✅ Importação concluída (lote #{resultado.importacao_id})</div>
            <div className="flex flex-wrap gap-2">
              <span className="badge-gray">Total: {resultado.total_linhas}</span>
              <span className="badge-green">Criados: {resultado.novos}</span>
              <span className="badge-blue">Enriquecidos: {resultado.enriquecidos}</span>
              <span className={resultado.erros ? "badge-amber" : "badge-gray"}>Erros: {resultado.erros}</span>
            </div>
            <p className="text-xs text-slate-600">Origem: {resultado.origem}{resultado.descricao ? ` · ${resultado.descricao}` : ""}</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
