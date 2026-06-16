"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  franqueadoLoja,
  franqueadoEnviarProposta,
  type FranqueadoLoja,
} from "@/lib/api";

// Campos estruturados (sigla NÃO entra — é da franqueadora).
const CAMPOS: { campo: string; rotulo: string; cols?: string; area?: boolean }[] = [
  { campo: "nome", rotulo: "Nome da loja", cols: "sm:col-span-6" },
  { campo: "endereco", rotulo: "Rua / logradouro", cols: "sm:col-span-4" },
  { campo: "numero", rotulo: "Número", cols: "sm:col-span-2" },
  { campo: "complemento", rotulo: "Complemento", cols: "sm:col-span-3" },
  { campo: "bairro", rotulo: "Bairro", cols: "sm:col-span-3" },
  { campo: "cidade", rotulo: "Cidade", cols: "sm:col-span-4" },
  { campo: "uf", rotulo: "UF", cols: "sm:col-span-1" },
  { campo: "cep", rotulo: "CEP", cols: "sm:col-span-1" },
  { campo: "shopping", rotulo: "Shopping (se houver)", cols: "sm:col-span-3" },
  { campo: "shopping_piso", rotulo: "Piso", cols: "sm:col-span-1" },
  { campo: "shopping_loja", rotulo: "Nº da loja no shopping", cols: "sm:col-span-2" },
  { campo: "email", rotulo: "E-mail da loja", cols: "sm:col-span-6" },
  { campo: "apelidos", rotulo: "Apelidos / como também é conhecida (1 por linha)", cols: "sm:col-span-6", area: true },
];

export default function MinhaLojaPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [data, setData] = useState<FranqueadoLoja | null>(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [tipo, setTipo] = useState<"fisica" | "virtual">("fisica");
  const [ativo, setAtivo] = useState(true);
  const [autorNome, setAutorNome] = useState("");
  const [autorEmail, setAutorEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!token) return;
    franqueadoLoja(token)
      .then((d) => {
        setData(d);
        const atrs = (d.atual.atributos ?? {}) as Record<string, string>;
        const f: Record<string, string> = {};
        for (const c of CAMPOS) f[c.campo] = String((d.atual[c.campo] ?? "") as string);
        for (const ce of d.campos_extra) f[`attr:${ce.chave}`] = String(atrs[ce.chave] ?? "");
        setForm(f);
        setTipo((d.atual.tipo as "fisica" | "virtual") || "fisica");
        setAtivo(Boolean(d.atual.ativo));
      })
      .catch(() => setErro("Link inválido ou expirado. Peça um novo à franqueadora."));
  }, [token]);

  function set(k: string, v: string) { setForm((m) => ({ ...m, [k]: v })); }

  async function enviar() {
    setErro("");
    setEnviando(true);
    try {
      const valores: Record<string, string> = { ...form, tipo };
      await franqueadoEnviarProposta(token, {
        autor_nome: autorNome.trim() || undefined,
        autor_email: autorEmail.trim() || undefined,
        valores, ativo,
      });
      setEnviado(true);
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setEnviando(false);
    }
  }

  if (erro && !data) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 px-6 text-center">{erro}</div>;
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando…</div>;
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="card p-8 max-w-md text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold mb-1">Enviado para revisão!</h2>
          <p className="text-sm text-slate-500">
            A franqueadora vai revisar suas informações e aprovar. Obrigado por manter o
            cadastro de <b>{data.nome}</b> em dia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold">Cadastro da minha loja</h1>
        <p className="text-sm text-slate-500 mb-1">
          <b>{data.nome}</b>{data.sigla ? <> · <span className="font-mono text-xs">{data.sigla}</span></> : null}
        </p>
        <p className="text-xs text-slate-400 mb-5">
          Revise e corrija os dados. O endereço completo é o que faz o cliente achar sua loja
          no atendimento — capriche. <b>Suas alterações vão para a aprovação da franqueadora</b> antes de entrar no ar.
        </p>

        {data.ja_tem_pendente && (
          <div className="card p-3 mb-4 border-amber-200 bg-amber-50 text-sm text-amber-800">
            Já existe um envio seu aguardando aprovação. Pode enviar de novo se quiser corrigir algo.
          </div>
        )}
        {erro && <div className="card p-3 mb-4 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}

        <div className="card p-5 space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Loja <b>{ativo ? "ativa" : "inativa"}</b> (inativa não aparece para os clientes)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={tipo === "virtual"}
              onChange={(e) => setTipo(e.target.checked ? "virtual" : "fisica")} />
            É a <b>loja virtual</b> (site / marketplaces)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            {CAMPOS.map((c) => (
              <div key={c.campo} className={c.cols}>
                <label className="label">{c.rotulo}</label>
                {c.area ? (
                  <textarea className="input" rows={2} value={form[c.campo] ?? ""}
                    onChange={(e) => set(c.campo, e.target.value)} />
                ) : (
                  <input className={`input ${c.campo === "uf" ? "uppercase" : ""}`}
                    maxLength={c.campo === "uf" ? 2 : undefined}
                    value={form[c.campo] ?? ""} onChange={(e) => set(c.campo, e.target.value)} />
                )}
              </div>
            ))}
          </div>

          {data.campos_extra.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <div className="text-sm font-semibold text-slate-700 mb-2">Contato e links (WhatsApp, redes, delivery…)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.campos_extra.map((ce) => (
                  <div key={ce.chave}>
                    <label className="label">{ce.rotulo}</label>
                    <input className="input" value={form[`attr:${ce.chave}`] ?? ""}
                      onChange={(e) => set(`attr:${ce.chave}`, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Seu nome (quem preencheu)</label>
              <input className="input" value={autorNome} onChange={(e) => setAutorNome(e.target.value)} />
            </div>
            <div>
              <label className="label">Seu e-mail (opcional)</label>
              <input className="input" type="email" value={autorEmail} onChange={(e) => setAutorEmail(e.target.value)} />
            </div>
          </div>

          <button className="btn-primary" onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar para aprovação"}
          </button>
        </div>
      </div>
    </div>
  );
}
