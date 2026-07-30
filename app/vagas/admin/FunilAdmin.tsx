"use client";
// Editor do FUNIL (v4): perguntas DENTRO das fases; cada fase tem textos,
// instruções, prazo e e-mails por situação (entrar/avançar/reprovar).
import { useEffect, useState } from "react";
import {
  vagasApagarPergunta, vagasFunilAdmin, vagasSalvarFase, vagasSalvarPergunta,
  type FunilFaseAdmin, type FunilPerguntaAdmin,
} from "@/lib/api";

const TIPOS_PERGUNTA = [
  ["aberta", "Aberta (IA avalia)"], ["sim_nao", "Sim/Não"],
  ["multipla", "Múltipla escolha"], ["numero", "Número"], ["data", "Data"],
  ["anexo", "Anexar arquivo"], ["video", "Gravar vídeo"],
] as const;

export default function FunilAdmin() {
  const [tipo, setTipo] = useState<"vaga" | "franquia">("vaga");
  const [fases, setFases] = useState<FunilFaseAdmin[]>([]);
  const [aberta, setAberta] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  function carregar() {
    vagasFunilAdmin(tipo).then((r) => setFases(r.fases))
      .catch((e: Error) => setErro(e.message));
  }
  useEffect(carregar, [tipo]);

  async function salvarFase(f: FunilFaseAdmin) {
    setErro(""); setMsg("");
    try {
      await vagasSalvarFase({ id: f.id, tipo, nome: f.nome, ordem: f.ordem,
        ativo: f.ativo, config: f.config });
      setMsg("Fase salva."); carregar();
    } catch (e) { setErro((e as Error).message); }
  }

  async function apagarPergunta(p: FunilPerguntaAdmin) {
    if (!confirm(`Apagar a pergunta "${p.texto.slice(0, 60)}…"? Respostas já dadas por candidatos são preservadas.`)) return;
    setErro(""); setMsg("");
    try {
      await vagasApagarPergunta(p.id);
      setMsg("Pergunta apagada."); carregar();
    } catch (e) { setErro((e as Error).message); }
  }

  async function salvarPergunta(faseId: number, p: Partial<FunilPerguntaAdmin> & { texto: string }) {
    setErro(""); setMsg("");
    try {
      await vagasSalvarPergunta({
        id: p.id, fase_id: faseId, texto: p.texto, tipo: p.tipo || "aberta",
        opcoes: p.opcoes ?? undefined, rankeia: p.rankeia ?? "",
        notas: p.notas ?? undefined, peso: p.peso ?? 1,
        ordem: p.ordem ?? 0, ativo: p.ativo !== false,
      });
      setMsg("Pergunta salva."); carregar();
    } catch (e) { setErro((e as Error).message); }
  }

  function muda(fi: number, patch: Partial<FunilFaseAdmin>) {
    setFases((fs) => fs.map((f, i) => (i === fi ? { ...f, ...patch } : f)));
  }
  function mudaEmail(fi: number, situ: string, campo: "assunto" | "corpo", v: string) {
    setFases((fs) => fs.map((f, i) => {
      if (i !== fi) return f;
      const emails = { ...(f.config.emails || {}) };
      emails[situ] = { ...(emails[situ] || {}), [campo]: v };
      return { ...f, config: { ...f.config, emails } };
    }));
  }

  const inputCls = "w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs";
  return (
    <div className="panel p-4 mb-4">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
        <h2 className="font-bold">Funil — fases e perguntas</h2>
        <div className="flex gap-1">
          <button onClick={() => setTipo("vaga")}
            className={`text-xs px-3 py-1.5 rounded-lg border ${tipo === "vaga" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300"}`}>Vagas</button>
          <button onClick={() => setTipo("franquia")}
            className={`text-xs px-3 py-1.5 rounded-lg border ${tipo === "franquia" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300"}`}>Franquias</button>
        </div>
      </div>
      {erro && <div className="text-xs text-red-600 mb-2">{erro}</div>}
      {msg && <div className="text-xs text-emerald-700 mb-2">{msg}</div>}
      {fases.map((f, fi) => (
        <div key={f.id} className="border border-slate-200 rounded-xl mb-2 overflow-hidden">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 flex-wrap">
            <span className="font-semibold text-sm flex-1">
              {f.ordem + 1}. {f.nome}
              {f.fixa && <span className="ml-2 text-[10px] text-slate-400">FIXA</span>}
              {!f.ativo && <span className="ml-2 text-[10px] text-red-500">DESLIGADA</span>}
            </span>
            <span className="text-[11px] text-slate-400">{f.perguntas.length} pergunta(s)</span>
            <button className="text-xs text-indigo-600 font-semibold"
              onClick={() => setAberta(aberta === f.id ? null : f.id)}>
              {aberta === f.id ? "▲ recolher" : "▼ abrir"}
            </button>
          </div>
          {aberta === f.id && (
            <div className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
                <input className={inputCls} value={f.nome}
                  onChange={(e) => muda(fi, { nome: e.target.value })} placeholder="Nome da fase" />
                <input className={inputCls} type="number" value={f.ordem}
                  onChange={(e) => muda(fi, { ordem: Number(e.target.value) })} placeholder="Ordem" />
                <label className="text-xs flex items-center gap-1.5">
                  <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" disabled={f.fixa}
                    checked={f.ativo} onChange={(e) => muda(fi, { ativo: e.target.checked })} />
                  Ativa {f.fixa ? "(fixa)" : "(desligar = pula)"}
                </label>
                <input className={inputCls} type="number" placeholder="Prazo (dias)"
                  value={f.config.prazo_dias ?? ""}
                  onChange={(e) => muda(fi, { config: { ...f.config, prazo_dias: Number(e.target.value) || undefined } })} />
              </div>
              <textarea className={`${inputCls} mb-2`} rows={2} placeholder="Texto da página desta fase (o candidato vê)"
                value={f.config.texto_pagina ?? ""}
                onChange={(e) => muda(fi, { config: { ...f.config, texto_pagina: e.target.value } })} />
              <textarea className={`${inputCls} mb-2`} rows={2} placeholder="Instruções ao candidato"
                value={f.config.instrucoes ?? ""}
                onChange={(e) => muda(fi, { config: { ...f.config, instrucoes: e.target.value } })} />

              <details className="mb-2">
                <summary className="text-xs font-bold text-slate-500 cursor-pointer">✉️ E-mails desta fase (entrar · avançar · reprovar) — {"{nome} {marca} {link}"}</summary>
                {["entrar", "avancar", "reprovar"].map((situ) => (
                  <div key={situ} className="mt-2 border border-slate-100 rounded-lg p-2">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">
                      {situ === "entrar" ? "Ao ENTRAR na fase" : situ === "avancar" ? "Ao AVANÇAR desta fase" : "Ao REPROVAR nesta fase"}
                    </div>
                    <input className={`${inputCls} mb-1`} placeholder="Assunto (vazio = não envia)"
                      value={f.config.emails?.[situ]?.assunto ?? ""}
                      onChange={(e) => mudaEmail(fi, situ, "assunto", e.target.value)} />
                    <textarea className={inputCls} rows={2} placeholder="Corpo do e-mail"
                      value={f.config.emails?.[situ]?.corpo ?? ""}
                      onChange={(e) => mudaEmail(fi, situ, "corpo", e.target.value)} />
                  </div>
                ))}
              </details>
              <button className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 mb-3"
                onClick={() => salvarFase(f)}>💾 Salvar fase</button>

              <div className="text-xs font-bold text-slate-500 mb-1">❓ Perguntas (com score: notas 1–5 × peso)</div>
              {f.perguntas.map((p) => (
                <details key={p.id} className="border border-slate-100 rounded-lg p-2 mb-1.5">
                  <summary className="text-xs cursor-pointer">
                    <span className="font-semibold text-indigo-600 uppercase text-[10px] mr-1">{p.tipo}</span>
                    {p.texto.slice(0, 90)} <span className="text-slate-400">· peso {p.peso}{p.rankeia ? ` · ${p.rankeia}` : ""}{!p.ativo ? " · INATIVA" : ""}</span>
                    <span className="text-indigo-600 font-semibold ml-2">✏️ editar ▾</span>
                  </summary>
                  <EditPergunta p={p} onSalvar={(np) => salvarPergunta(f.id, np)}
                    onApagar={() => apagarPergunta(p)} />
                </details>
              ))}
              <details className="border border-dashed border-slate-300 rounded-lg p-2">
                <summary className="text-xs cursor-pointer text-indigo-600 font-semibold">+ Nova pergunta</summary>
                <EditPergunta
                  p={{ id: 0, texto: "", tipo: "aberta", opcoes: null, rankeia: null, notas: null, peso: 1, peso_por_tipo: null, ordem: f.perguntas.length, ativo: true }}
                  onSalvar={(np) => salvarPergunta(f.id, { ...np, id: undefined })}
                />
              </details>
            </div>
          )}
        </div>
      ))}
      <button className="text-xs border border-slate-300 rounded-lg px-3 py-1.5"
        onClick={() => {
          const nome = prompt("Nome da nova fase (ex.: Teste prático):");
          if (nome?.trim()) {
            vagasSalvarFase({ tipo, nome: nome.trim(), ordem: fases.length - 1, ativo: true, config: {} })
              .then(carregar).catch((e: Error) => setErro(e.message));
          }
        }}>+ Nova fase</button>
      <p className="text-[11px] text-slate-400 mt-2">
        Fases fixas (Inscrição/Decisão) não desligam. Candidatos em andamento terminam no funil em que entraram. Tudo auditado.
      </p>
    </div>
  );
}

function EditPergunta({ p, onSalvar, onApagar }: {
  p: FunilPerguntaAdmin;
  onSalvar: (p: Partial<FunilPerguntaAdmin> & { texto: string }) => void;
  onApagar?: () => void;
}) {
  const [e, setE] = useState<FunilPerguntaAdmin>({ ...p });
  const inputCls = "w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs";
  const notaDe = (k: string) => (e.notas?.[k] != null ? String(e.notas[k]) : "");
  function setNota(k: string, v: string) {
    const notas = { ...(e.notas || {}) };
    if (v.trim() === "") delete notas[k];
    else notas[k] = Number(v);
    setE({ ...e, notas });
  }
  return (
    <div className="mt-2">
      <textarea className={`${inputCls} mb-1.5`} rows={2} placeholder="Texto da pergunta"
        value={e.texto} onChange={(ev) => setE({ ...e, texto: ev.target.value })} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-1.5">
        <select className={inputCls} value={e.tipo}
          onChange={(ev) => setE({ ...e, tipo: ev.target.value })}>
          {TIPOS_PERGUNTA.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
        <input className={inputCls} placeholder="Rankeia (ex.: locus interno)"
          value={e.rankeia ?? ""} onChange={(ev) => setE({ ...e, rankeia: ev.target.value })} />
        <input className={inputCls} type="number" step="0.5" min={0} max={10}
          placeholder="Peso" value={e.peso}
          onChange={(ev) => setE({ ...e, peso: Number(ev.target.value) })} />
        <label className="text-xs flex items-center gap-1.5">
          <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" checked={e.ativo}
            onChange={(ev) => setE({ ...e, ativo: ev.target.checked })} /> Ativa
        </label>
      </div>
      {e.tipo === "sim_nao" && (
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <input className={inputCls} placeholder="Nota do SIM (1-5)" value={notaDe("Sim")}
            onChange={(ev) => setNota("Sim", ev.target.value)} />
          <input className={inputCls} placeholder="Nota do NÃO (1-5)" value={notaDe("Não")}
            onChange={(ev) => setNota("Não", ev.target.value)} />
        </div>
      )}
      {e.tipo === "multipla" && (
        <div className="mb-1.5">
          <input className={`${inputCls} mb-1`} placeholder="Opções separadas por vírgula (ex.: manhã, tarde, noite)"
            value={(e.opcoes ?? []).join(", ")}
            onChange={(ev) => setE({ ...e, opcoes: ev.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          {(e.opcoes ?? []).map((op) => (
            <input key={op} className={`${inputCls} mb-1`} placeholder={`Nota de "${op}" (1-5)`}
              value={notaDe(op)} onChange={(ev) => setNota(op, ev.target.value)} />
          ))}
        </div>
      )}
      <div className="text-[10px] text-slate-400 mb-1.5">
        Peso 0 = não conta no score. Abertas/vídeos: IA sugere a nota e o franqueado ajusta na ficha.
      </div>
      <div className="flex gap-2">
        <button className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5"
          onClick={() => e.texto.trim() && onSalvar(e)}>💾 Salvar pergunta</button>
        {onApagar && p.id > 0 && (
          <button className="text-xs border border-red-300 text-red-700 rounded-lg px-3 py-1.5"
            onClick={onApagar}>🗑 Apagar pergunta</button>
        )}
      </div>
    </div>
  );
}
