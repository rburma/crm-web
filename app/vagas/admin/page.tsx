"use client";
// Administração do módulo Vagas (admin do sistema): catálogo de cargos por
// marca (descrição pública, SEM salário) + cidades de franquia (prioritárias
// + carga IBGE). Funil/perguntas/score chegam na Fase 2.
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import VagasNav from "@/components/VagasNav";
import FunilAdmin from "./FunilAdmin";
import { BlocosAdmin, TestesAdmin } from "./TestesBlocos";
import {
  vagasCargosAdmin, vagasSalvarCargo, vagasCidades, vagasSalvarCidade,
  vagasImportarIbge, type VagaCargoAdmin, type VagaCidadeAdmin,
} from "@/lib/api";

const CARGO_NOVO: Partial<VagaCargoAdmin> = {
  tipo: "emprego", titulo: "", descricao: "", requisitos: "", texto_seo: "",
  ordem: 0, ativo: true,
};

export default function VagasAdminPage() {
  const [marcas, setMarcas] = useState<{ id: number; nome: string; sigla: string | null }[]>([]);
  const [cargos, setCargos] = useState<VagaCargoAdmin[]>([]);
  const [cidades, setCidades] = useState<VagaCidadeAdmin[]>([]);
  const [temIbge, setTemIbge] = useState(false);
  const [editando, setEditando] = useState<Partial<VagaCargoAdmin> | null>(null);
  const [novaCidade, setNovaCidade] = useState({ nome: "", uf: "" });
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  function carregar() {
    vagasCargosAdmin()
      .then((r) => { setMarcas(r.marcas); setCargos(r.cargos); })
      .catch((e: Error) => setErro(e.message));
    vagasCidades("", true)
      .then((r) => { setCidades(r.cidades); setTemIbge(r.tem_carga_ibge); })
      .catch(() => undefined);
  }
  useEffect(carregar, []);

  async function salvarCargo() {
    if (!editando?.titulo?.trim() || !editando.marca_id) {
      setErro("Preencha marca e título."); return;
    }
    setErro("");
    try {
      await vagasSalvarCargo(editando);
      setEditando(null);
      setMsg("Cargo salvo.");
      carregar();
    } catch (e) { setErro((e as Error).message); }
  }

  async function addCidade() {
    if (!novaCidade.nome.trim() || novaCidade.uf.trim().length !== 2) {
      setErro("Cidade + UF (2 letras)."); return;
    }
    setErro("");
    try {
      await vagasSalvarCidade(novaCidade.nome.trim(), novaCidade.uf.trim(), true);
      setNovaCidade({ nome: "", uf: "" });
      carregar();
    } catch (e) { setErro((e as Error).message); }
  }

  const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm";
  const nomeMarca = (id: number) => marcas.find((m) => m.id === id)?.nome || `#${id}`;

  return (
    <Shell>
      <div className="p-4 max-w-5xl mx-auto">
        <VagasNav atual="admin" />
        <h1 className="text-xl font-bold mb-1">💼 Vagas — administração</h1>
        <p className="text-sm text-slate-500 mb-4">
          Catálogo de cargos por marca (aparece nas páginas públicas; sem faixa
          salarial) e cidades de franquia. Links públicos:{" "}
          <a href="/vagas" className="underline" target="_blank">/vagas</a> ·{" "}
          <a href="/franquias" className="underline" target="_blank">/franquias</a> ·{" "}
          <a href="/vagas/sitemap.xml" className="underline" target="_blank">sitemap</a>
        </p>
        {erro && <div className="mb-3 text-sm text-red-600">{erro}</div>}
        {msg && <div className="mb-3 text-sm text-emerald-700">{msg}</div>}

        <div className="panel p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold">Cargos</h2>
            <button className="text-sm bg-indigo-600 text-white rounded-lg px-3 py-1.5"
              onClick={() => setEditando({ ...CARGO_NOVO, marca_id: marcas[0]?.id })}>
              + Novo cargo
            </button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-left">
                <th className="p-2">Marca</th><th className="p-2">Tipo</th>
                <th className="p-2">Título</th><th className="p-2">Descrição</th>
                <th className="p-2">Status</th><th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {cargos.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-2">{nomeMarca(c.marca_id)}</td>
                  <td className="p-2">{c.tipo === "franquia" ? "🏪 franquia" : "emprego"}</td>
                  <td className="p-2 font-medium">{c.titulo}</td>
                  <td className="p-2 text-slate-500 max-w-[280px] truncate">{c.descricao || "—"}</td>
                  <td className="p-2">{c.ativo ? "✅ ativo" : "⏸ inativo"}</td>
                  <td className="p-2">
                    <button className="text-indigo-600 font-semibold"
                      onClick={() => setEditando({ ...c })}>✏️ editar</button>
                  </td>
                </tr>
              ))}
              {cargos.length === 0 && (
                <tr><td colSpan={6} className="p-3 text-slate-400">Nenhum cargo ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {editando && (
          <div className="panel p-4 mb-4 border-2 border-indigo-300">
            <h3 className="font-bold mb-2">{editando.id ? "Editar cargo" : "Novo cargo"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select className={inputCls} value={editando.marca_id ?? ""}
                onChange={(e) => setEditando({ ...editando, marca_id: Number(e.target.value) })}>
                {marcas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <select className={inputCls} value={editando.tipo ?? "emprego"}
                onChange={(e) => setEditando({ ...editando, tipo: e.target.value })}>
                <option value="emprego">Vaga de emprego</option>
                <option value="franquia">Franquia (expansão)</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="w-4 h-4 accent-indigo-600"
                  checked={editando.ativo !== false}
                  onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} />
                Ativo
              </label>
            </div>
            <input className={`${inputCls} mt-3`} placeholder="Título (ex.: Atendente)"
              value={editando.titulo ?? ""}
              onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} />
            <textarea className={`${inputCls} mt-3`} rows={3}
              placeholder="Descrição pública do cargo (aparece nas páginas de vagas)"
              value={editando.descricao ?? ""}
              onChange={(e) => setEditando({ ...editando, descricao: e.target.value })} />
            <textarea className={`${inputCls} mt-3`} rows={2}
              placeholder="Requisitos (público)"
              value={editando.requisitos ?? ""}
              onChange={(e) => setEditando({ ...editando, requisitos: e.target.value })} />
            <textarea className={`${inputCls} mt-3`} rows={2}
              placeholder="Texto extra p/ SEO (opcional)"
              value={editando.texto_seo ?? ""}
              onChange={(e) => setEditando({ ...editando, texto_seo: e.target.value })} />
            <div className="mt-3 flex gap-2">
              <button className="bg-indigo-600 text-white text-sm rounded-lg px-4 py-2" onClick={salvarCargo}>
                Salvar
              </button>
              <button className="text-sm rounded-lg px-4 py-2 border border-slate-300"
                onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </div>
        )}

        <div className="panel p-4">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <h2 className="font-bold">🎯 Cidades de franquia</h2>
            <button
              className="text-sm rounded-lg px-3 py-1.5 border border-slate-300 hover:bg-slate-50"
              onClick={() =>
                vagasImportarIbge()
                  .then((r) => setMsg(r.mensagem))
                  .catch((e: Error) => setErro(e.message))
              }
            >
              {temIbge ? "🔄 Atualizar carga IBGE" : "⬇️ Carga IBGE (todas as cidades)"}
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Prioritárias = destaque na página de franquia. A carga IBGE traz
            todos os municípios com população — cidades &lt;100 mil hab viram
            sugestão de Franquia Pop-Up.
          </p>
          <div className="flex gap-2 mb-3">
            <input className={inputCls} placeholder="Cidade" value={novaCidade.nome}
              onChange={(e) => setNovaCidade({ ...novaCidade, nome: e.target.value })} />
            <input className={`${inputCls} w-20`} placeholder="UF" maxLength={2}
              value={novaCidade.uf}
              onChange={(e) => setNovaCidade({ ...novaCidade, uf: e.target.value.toUpperCase() })} />
            <button className="bg-indigo-600 text-white text-sm rounded-lg px-3 py-1.5 whitespace-nowrap"
              onClick={addCidade}>+ Prioritária</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cidades.map((c) => (
              <span key={c.id}
                className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                {c.nome}/{c.uf}
                {c.populacao ? <span className="text-blue-400">({Math.round(c.populacao / 1000)}k)</span> : null}
                <button title="Remover das prioritárias"
                  onClick={() =>
                    vagasSalvarCidade(c.nome, c.uf, false, c.ativo)
                      .then(carregar)
                      .catch((e: Error) => setErro(e.message))
                  }
                  className="text-blue-400 hover:text-red-600">✕</button>
              </span>
            ))}
            {cidades.length === 0 && (
              <span className="text-xs text-slate-400">Nenhuma cidade prioritária ainda.</span>
            )}
          </div>
        </div>

        <div className="mt-4">
          <FunilAdmin />
          <TestesAdmin />
          <BlocosAdmin />
        </div>
      </div>
    </Shell>
  );
}
