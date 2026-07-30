"use client";
// Testes (variações por IA — admin revisa e ATIVA) + blocos do hub.
import { useEffect, useState } from "react";
import {
  vagasAtivarVariacao, vagasBlocos, vagasGerarVariacoes, vagasSalvarBloco,
  vagasTestes, vagasVerVariacao, type BlocoAdmin, type TesteAdmin,
} from "@/lib/api";

export function TestesAdmin() {
  const [testes, setTestes] = useState<TesteAdmin[]>([]);
  const [ver, setVer] = useState<{ id: number; itens: { texto: string; opcoes: { rotulo: string; dim: string }[] }[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  function carregar() {
    vagasTestes().then((r) => setTestes(r.testes)).catch((e: Error) => setErro(e.message));
  }
  useEffect(carregar, []);

  return (
    <div className="panel p-4 mb-4">
      <h2 className="font-bold mb-1">🧪 Testes — variações</h2>
      <p className="text-xs text-slate-500 mb-2">
        Quantas variações der: candidatos trocam respostas. A IA gera em lote;
        as novas entram <b>inativas</b> — revise (👁) e ative. Variação nunca
        repete para o mesmo CPF; a de nº 1 é a embutida.
      </p>
      {erro && <div className="text-xs text-red-600 mb-2">{erro}</div>}
      {msg && <div className="text-xs text-emerald-700 mb-2">{msg}</div>}
      {testes.map((t) => (
        <div key={t.id} className="mb-3">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <b className="text-sm">{t.nome}</b>
            <span className="text-xs text-slate-400">
              {t.variacoes.filter((v) => v.ativo).length} ativas / {t.variacoes.length} no total
            </span>
            <button className="text-xs bg-indigo-600 text-white rounded-lg px-2.5 py-1"
              onClick={() => vagasGerarVariacoes(t.id, 10).then((r) => { setMsg(r.mensagem); })
                .catch((e: Error) => setErro(e.message))}>
              🤖 Gerar +10 variações (IA)
            </button>
            <button className="text-xs border border-slate-300 rounded-lg px-2.5 py-1"
              onClick={carregar}>🔄 Atualizar lista</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {t.variacoes.map((v) => (
              <span key={v.id}
                className={`text-[11px] rounded-lg px-2 py-1 border inline-flex items-center gap-1.5 ${v.ativo ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                nº {v.numero} · {v.usos} usos
                <button title="Ver perguntas" onClick={() =>
                  vagasVerVariacao(v.id).then((d) => setVer({ id: d.id, itens: d.perguntas.itens }))
                    .catch((e: Error) => setErro(e.message))}>👁</button>
                <button title={v.ativo ? "Desativar" : "Ativar"}
                  onClick={() => vagasAtivarVariacao(v.id, !v.ativo).then(carregar)
                    .catch((e: Error) => setErro(e.message))}>
                  {v.ativo ? "⏸" : "▶"}
                </button>
              </span>
            ))}
          </div>
        </div>
      ))}
      {ver && (
        <div className="border-2 border-indigo-300 rounded-xl p-3 mt-2">
          <div className="flex justify-between">
            <b className="text-sm">Variação #{ver.id}</b>
            <button className="text-xs text-slate-400" onClick={() => setVer(null)}>✕ fechar</button>
          </div>
          {ver.itens.map((it, i) => (
            <div key={i} className="text-xs mt-2">
              <b>{i + 1}. {it.texto}</b>
              <div className="text-slate-500">
                {it.opcoes.map((o) => `${o.rotulo} (${o.dim})`).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BlocosAdmin() {
  const [blocos, setBlocos] = useState<BlocoAdmin[]>([]);
  const [erro, setErro] = useState("");
  const inputCls = "w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs";

  function carregar() {
    vagasBlocos().then((r) => setBlocos(r.blocos)).catch((e: Error) => setErro(e.message));
  }
  useEffect(carregar, []);

  function muda(i: number, patch: Partial<BlocoAdmin>) {
    setBlocos((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  return (
    <div className="panel p-4 mb-4">
      <h2 className="font-bold mb-1">🖼 Blocos das páginas /vagas e /franquias</h2>
      <p className="text-xs text-slate-500 mb-2">
        Conteúdo editável do hub (banner, depoimentos, informações da rede) — sem programação.
      </p>
      {erro && <div className="text-xs text-red-600 mb-2">{erro}</div>}
      {blocos.map((b, i) => (
        <div key={b.id} className="border border-slate-200 rounded-lg p-2 mb-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-1.5">
            <select className={inputCls} value={b.escopo}
              onChange={(e) => muda(i, { escopo: e.target.value })}>
              <option value="vagas">/vagas</option>
              <option value="franquias">/franquias</option>
            </select>
            <input className={inputCls} placeholder="Título" value={b.titulo ?? ""}
              onChange={(e) => muda(i, { titulo: e.target.value })} />
            <input className={inputCls} type="number" placeholder="Ordem" value={b.ordem}
              onChange={(e) => muda(i, { ordem: Number(e.target.value) })} />
            <label className="text-xs flex items-center gap-1.5">
              <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" checked={b.ativo}
                onChange={(e) => muda(i, { ativo: e.target.checked })} /> Ativo
            </label>
          </div>
          <textarea className={inputCls} rows={2} placeholder="Texto do bloco"
            value={b.texto ?? ""} onChange={(e) => muda(i, { texto: e.target.value })} />
          <button className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1 mt-1.5"
            onClick={() => vagasSalvarBloco(b).then(carregar).catch((e: Error) => setErro(e.message))}>
            💾 Salvar
          </button>
        </div>
      ))}
      <button className="text-xs border border-slate-300 rounded-lg px-3 py-1.5"
        onClick={() => vagasSalvarBloco({ escopo: "vagas", titulo: "Novo bloco", texto: "", ordem: blocos.length, ativo: false })
          .then(carregar).catch((e: Error) => setErro(e.message))}>
        + Bloco
      </button>
    </div>
  );
}
