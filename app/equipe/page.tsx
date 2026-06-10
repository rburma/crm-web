"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import {
  equipeAlterarAdmin,
  equipeBuscarUsuarios,
  equipeDesvincular,
  equipeLojas,
  equipeLojasDoUsuario,
  equipeResumo,
  equipeUsuariosDaLoja,
  equipeVincular,
  type EquipeResumo,
  type LojaDoUsuario,
  type LojaEquipe,
  type MembroLoja,
} from "@/lib/api";

export default function EquipePage() {
  const [resumo, setResumo] = useState<EquipeResumo | null>(null);
  const [erro, setErro] = useState("");

  const [marcaSel, setMarcaSel] = useState<number | null>(null);
  const [lojas, setLojas] = useState<LojaEquipe[]>([]);
  const [totalLojas, setTotalLojas] = useState(0);
  const [qLoja, setQLoja] = useState("");

  const [lojaSel, setLojaSel] = useState<LojaEquipe | null>(null);
  const [membros, setMembros] = useState<MembroLoja[]>([]);

  // adicionar usuário (autocomplete)
  const [qUser, setQUser] = useState("");
  const [sugestoes, setSugestoes] = useState<
    { id: number; nome: string | null; email: string | null; papel: string }[]
  >([]);

  // modal "lojas do usuário"
  const [userView, setUserView] = useState<{ id: number; nome: string | null } | null>(null);
  const [lojasUser, setLojasUser] = useState<LojaDoUsuario[]>([]);

  const carregarResumo = useCallback(async () => {
    try {
      const r = await equipeResumo();
      setResumo(r);
      if (marcaSel === null && r.marcas.length > 0) setMarcaSel(r.marcas[0].id);
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }, [marcaSel]);

  const carregarLojas = useCallback(async () => {
    if (marcaSel === null) return;
    try {
      const r = await equipeLojas(marcaSel, qLoja, 100, 0);
      setLojas(r.items);
      setTotalLojas(r.total);
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }, [marcaSel, qLoja]);

  const carregarMembros = useCallback(async (loja: LojaEquipe) => {
    try {
      setMembros(await equipeUsuariosDaLoja(loja.id));
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }, []);

  useEffect(() => { carregarResumo(); }, [carregarResumo]);
  useEffect(() => { carregarLojas(); }, [carregarLojas]);

  // autocomplete de usuários (debounce simples)
  useEffect(() => {
    if (!qUser.trim()) { setSugestoes([]); return; }
    const t = setTimeout(() => {
      equipeBuscarUsuarios(qUser.trim()).then(setSugestoes).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [qUser]);

  async function abrirLoja(l: LojaEquipe) {
    setLojaSel(l);
    setQUser(""); setSugestoes([]);
    await carregarMembros(l);
  }

  async function adicionar(usuarioId: number, admin: boolean) {
    if (!lojaSel) return;
    setErro("");
    try {
      await equipeVincular(lojaSel.id, usuarioId, admin);
      setQUser(""); setSugestoes([]);
      await carregarMembros(lojaSel);
      carregarLojas(); carregarResumo();
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }

  async function toggleAdmin(m: MembroLoja) {
    if (!lojaSel) return;
    try {
      await equipeAlterarAdmin(lojaSel.id, m.usuario_id, !m.admin_loja);
      await carregarMembros(lojaSel);
      carregarLojas();
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }

  async function remover(m: MembroLoja) {
    if (!lojaSel) return;
    if (!confirm(`Remover ${m.nome ?? m.email} da equipe de "${lojaSel.nome}"?`)) return;
    try {
      await equipeDesvincular(lojaSel.id, m.usuario_id);
      await carregarMembros(lojaSel);
      carregarLojas(); carregarResumo();
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }

  async function verLojasDoUsuario(id: number, nome: string | null) {
    setUserView({ id, nome });
    try { setLojasUser(await equipeLojasDoUsuario(id)); } catch { setLojasUser([]); }
  }

  return (
    <Shell title="Equipe & Departamentos">
      {/* KPIs */}
      {resumo && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="card px-5 py-3 text-center">
            <div className="text-xl font-bold">{resumo.totais.vinculos.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-slate-500">vínculos usuário↔loja</div>
          </div>
          <div className="card px-5 py-3 text-center">
            <div className="text-xl font-bold">{resumo.totais.usuarios_vinculados.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-slate-500">usuários com loja</div>
          </div>
          <div className="card px-5 py-3 text-center">
            <div className="text-xl font-bold">{resumo.totais.admins_globais}</div>
            <div className="text-xs text-slate-500">admins globais (veem tudo)</div>
          </div>
        </div>
      )}

      {erro && <div className="card p-3 mb-3 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* coluna 1 — marcas */}
        <div className="card p-3">
          <div className="label">Marcas</div>
          <div className="space-y-1 max-h-[560px] overflow-y-auto">
            {(resumo?.marcas ?? []).map((m) => (
              <button key={m.id} onClick={() => { setMarcaSel(m.id); setLojaSel(null); }}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                  marcaSel === m.id ? "bg-brand-50 text-brand-700 font-semibold" : "hover:bg-slate-50"
                }`}>
                {m.nome}
                <span className="block text-xs text-slate-400">
                  {m.lojas} loja(s) · {m.usuarios} usuário(s)
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* coluna 2 — lojas da marca */}
        <div className="card p-3">
          <div className="label">Lojas / Departamentos {totalLojas ? `(${totalLojas})` : ""}</div>
          <input className="input mb-2" placeholder="🔎 Buscar loja…" value={qLoja}
            onChange={(e) => setQLoja(e.target.value)} />
          <div className="space-y-1 max-h-[520px] overflow-y-auto">
            {lojas.map((l) => (
              <button key={l.id} onClick={() => abrirLoja(l)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                  lojaSel?.id === l.id ? "bg-brand-50 text-brand-700 font-semibold" : "hover:bg-slate-50"
                }`}>
                <span className="truncate block">{l.nome}</span>
                <span className="text-xs text-slate-400">
                  {l.usuarios} usuário(s){l.admins ? ` · ${l.admins} admin` : ""}
                </span>
              </button>
            ))}
            {lojas.length === 0 && <p className="text-sm text-slate-400 px-2 py-4">Nenhuma loja.</p>}
          </div>
        </div>

        {/* coluna 3 — equipe da loja */}
        <div className="card p-3">
          <div className="label">
            {lojaSel ? `Equipe — ${lojaSel.nome}` : "Equipe (escolha uma loja)"}
          </div>
          {lojaSel && (
            <>
              {/* adicionar usuário */}
              <div className="relative mb-3">
                <input className="input" placeholder="＋ Adicionar usuário (nome ou e-mail)…"
                  value={qUser} onChange={(e) => setQUser(e.target.value)} />
                {sugestoes.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                    {sugestoes.map((s) => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50">
                        <span className="truncate">{s.nome ?? s.email} <span className="text-xs text-slate-400">{s.email}</span></span>
                        <span className="shrink-0 ml-2">
                          <button className="text-xs text-brand-700 hover:underline mr-2"
                            onClick={() => adicionar(s.id, false)}>+ atendente</button>
                          <button className="text-xs text-emerald-700 hover:underline"
                            onClick={() => adicionar(s.id, true)}>+ admin</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1 max-h-[470px] overflow-y-auto">
                {membros.map((m) => (
                  <div key={m.usuario_id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
                    <button className="text-left text-sm truncate" title="Ver todas as lojas deste usuário"
                      onClick={() => verLojasDoUsuario(m.usuario_id, m.nome)}>
                      <span className="font-medium">{m.nome ?? m.email}</span>
                      <span className="block text-xs text-slate-400 truncate">{m.email}</span>
                    </button>
                    <div className="shrink-0 flex items-center gap-2 ml-2">
                      <button onClick={() => toggleAdmin(m)}
                        className={m.admin_loja ? "badge-green" : "badge-gray"}
                        title="Clique para alternar admin da loja">
                        {m.admin_loja ? "Admin da loja" : "Atendente"}
                      </button>
                      <button onClick={() => remover(m)} className="text-xs text-red-500 hover:underline">remover</button>
                    </div>
                  </div>
                ))}
                {membros.length === 0 && (
                  <p className="text-sm text-slate-400 px-2 py-4">Ninguém vinculado a esta loja ainda.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* modal: lojas do usuário */}
      {userView && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={() => setUserView(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Lojas de {userView.nome ?? `#${userView.id}`}</h2>
              <button onClick={() => setUserView(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            {lojasUser.length === 0 && <p className="text-sm text-slate-400">Nenhuma loja vinculada.</p>}
            <div className="space-y-1">
              {lojasUser.map((l) => (
                <div key={l.loja_id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-slate-50">
                  <span className="truncate">{l.loja} <span className="text-xs text-slate-400">{l.marca ?? ""}</span></span>
                  <span className={l.admin_loja ? "badge-green" : "badge-gray"}>
                    {l.admin_loja ? "Admin" : "Atendente"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
