"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import LojaCadastro from "@/components/LojaCadastro";
import DispositivosLoja from "@/components/DispositivosLoja";
import {
  criarLoja,
  entrarComo,
  equipeAlterarAdmin,
  equipeApagarLoja,
  equipeBuscarUsuarios,
  equipeDesativarLoja,
  equipeDesvincular,
  equipeLojas,
  equipeReativarLoja,
  equipeLojasDoUsuario,
  equipeResumo,
  equipeUsuariosDaLoja,
  equipeVincular,
  listarMarcas,
  siglaLoja,
  usuarioLogado,
  type EquipeResumo,
  type MarcaItem,
  type LojaDoUsuario,
  type LojaEquipe,
  type MembroLoja,
  type VinculosLoja,
} from "@/lib/api";

export default function EquipePage() {
  const [resumo, setResumo] = useState<EquipeResumo | null>(null);
  const [erro, setErro] = useState("");

  const [marcaSel, setMarcaSel] = useState<number | null>(null);
  const [lojas, setLojas] = useState<LojaEquipe[]>([]);
  const [marcasSigla, setMarcasSigla] = useState<Record<number, string>>({});
  useEffect(() => {
    listarMarcas().then((ms: MarcaItem[]) => {
      const m: Record<number, string> = {};
      for (const x of ms) if (x.sigla) m[x.id] = x.sigla;
      setMarcasSigla(m);
    }).catch(() => {});
  }, []);
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

  // modal "cadastro da loja" (e-mail + campos/placeholders)
  const [cadLoja, setCadLoja] = useState<LojaEquipe | null>(null);
  // modal "novo departamento" (criar loja na marca selecionada)
  const [novoDept, setNovoDept] = useState(false);
  const [ndNome, setNdNome] = useState("");
  const [ndSigla, setNdSigla] = useState("");
  const [ndCidade, setNdCidade] = useState("");
  const [ndUf, setNdUf] = useState("");
  const [ndEmail, setNdEmail] = useState("");
  const [ndSalvando, setNdSalvando] = useState(false);
  // modal "dispositivos da loja" (app de balcão: online/offline + revogar)
  const [dispLoja, setDispLoja] = useState<LojaEquipe | null>(null);
  // apagar/desativar loja com transferência anotada (SÓ admin)
  const [ehAdmin, setEhAdmin] = useState(false);
  useEffect(() => {
    const u = usuarioLogado();
    setEhAdmin(!u || u.papel === "admin"); // sem login = piloto (backend valida)
  }, []);
  const [lojaAcao, setLojaAcao] = useState<{
    loja: LojaEquipe; acao: "apagar" | "desativar"; vinculos: VinculosLoja;
  } | null>(null);
  const [destinoId, setDestinoId] = useState<number | "">("");
  const [acaoBusy, setAcaoBusy] = useState(false);

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

  async function depoisAcaoLoja(id: number, resultado: "apagada" | "inativa" | "ativa") {
    if (lojaSel && lojaSel.id === id) {
      if (resultado === "apagada") { setLojaSel(null); setMembros([]); }
      else setLojaSel({ ...lojaSel, ativo: resultado === "ativa" });
    }
    await carregarLojas();
    carregarResumo();
  }

  async function iniciarAcaoLoja(l: LojaEquipe, acao: "apagar" | "desativar") {
    setErro("");
    const rotulo = l.sigla || l.nome;
    const pergunta = acao === "apagar"
      ? `Apagar a loja/departamento ${rotulo}? Essa ação NÃO pode ser desfeita.`
      : l.ativo === false
        ? `Transferir os vínculos da loja inativa ${rotulo} para outra loja?`
        : `Desativar a loja/departamento ${rotulo}?`;
    if (!confirm(pergunta)) return;
    try {
      const r = acao === "apagar"
        ? await equipeApagarLoja(l.id)
        : await equipeDesativarLoja(l.id);
      if (r.ok) { await depoisAcaoLoja(l.id, acao === "apagar" ? "apagada" : "inativa"); return; }
      setDestinoId("");
      setLojaAcao({ loja: l, acao, vinculos: r.vinculos });
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }

  async function confirmarAcaoLoja() {
    if (!lojaAcao || destinoId === "") return;
    setAcaoBusy(true); setErro("");
    try {
      const r = lojaAcao.acao === "apagar"
        ? await equipeApagarLoja(lojaAcao.loja.id, Number(destinoId))
        : await equipeDesativarLoja(lojaAcao.loja.id, { transferirPara: Number(destinoId) });
      if (r.ok) {
        const id = lojaAcao.loja.id;
        setLojaAcao(null);
        await depoisAcaoLoja(id, lojaAcao.acao === "apagar" ? "apagada" : "inativa");
      }
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setAcaoBusy(false);
    }
  }

  async function desativarMantendo() {
    if (!lojaAcao) return;
    setAcaoBusy(true); setErro("");
    try {
      const r = await equipeDesativarLoja(lojaAcao.loja.id, { manter: true });
      if (r.ok) {
        const id = lojaAcao.loja.id;
        setLojaAcao(null);
        await depoisAcaoLoja(id, "inativa");
      }
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setAcaoBusy(false);
    }
  }

  async function reativarLoja(l: LojaEquipe) {
    setErro("");
    try {
      await equipeReativarLoja(l.id);
      await depoisAcaoLoja(l.id, "ativa");
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
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

  function abrirNovoDept() {
    setNdNome(""); setNdSigla(""); setNdCidade(""); setNdUf(""); setNdEmail("");
    setNovoDept(true);
  }

  async function criarDepartamento() {
    if (marcaSel === null) { setErro("Escolha uma marca antes de criar o departamento."); return; }
    if (ndNome.trim().length < 1) { setErro("Dê um nome ao departamento."); return; }
    setNdSalvando(true); setErro("");
    try {
      await criarLoja({
        marca_id: marcaSel,
        nome: ndNome.trim(),
        sigla: ndSigla.trim().toUpperCase() || undefined,
        cidade: ndCidade.trim() || undefined,
        uf: ndUf.trim().toUpperCase() || undefined,
        email: ndEmail.trim() || undefined,
      });
      setNovoDept(false);
      await carregarLojas();
      carregarResumo();
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setNdSalvando(false);
    }
  }

  async function comoUsuario(id: number, nome: string | null) {
    if (!confirm(
      `Entrar como "${nome ?? `#${id}`}"?\n\nUma nova janela vai abrir mostrando o sistema ` +
      `exatamente como ELE vê (lojas/oportunidades do escopo dele).\n\nPara voltar, ` +
      `clique em "voltar a ser admin" na faixa amarela.`
    )) return;
    setErro("");
    try {
      await entrarComo(id);
      window.open("/atendimentos", "_blank");
      window.location.reload();
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
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
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="label mb-0">Lojas / Departamentos {totalLojas ? `(${totalLojas})` : ""}</div>
            <button onClick={abrirNovoDept} disabled={marcaSel === null}
              className="text-xs text-brand-700 hover:underline disabled:opacity-40 shrink-0"
              title="Criar um novo departamento/loja nesta marca">
              ＋ Novo
            </button>
          </div>
          <input className="input mb-2" placeholder="🔎 Buscar por nome ou sigla…" value={qLoja}
            onChange={(e) => setQLoja(e.target.value)} />
          <div className="space-y-1 max-h-[520px] overflow-y-auto">
            {lojas.map((l) => (
              <button key={l.id} onClick={() => abrirLoja(l)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                  lojaSel?.id === l.id ? "bg-brand-50 text-brand-700 font-semibold" : "hover:bg-slate-50"
                }`}>
                <span className="truncate block">
                  <span className="font-mono font-semibold" title="Sigla — liga com o cobrança">
                    {siglaLoja(l.sigla, marcaSel != null ? marcasSigla[marcaSel] : undefined, l.nome)}
                  </span>
                  {l.sigla && (
                    <span className="ml-1.5 text-xs text-slate-400">{l.nome}</span>
                  )}
                  {l.ativo === false && (
                    <span className="ml-1.5 badge-gray" title="Loja inativa — reative ou transfira os vínculos na coluna Equipe">inativa</span>
                  )}
                </span>
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
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="label mb-0">
              {lojaSel ? `Equipe — ${lojaSel.nome}` : "Equipe (escolha uma loja)"}
            </div>
            {lojaSel && (
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setDispLoja(lojaSel)}
                  className="text-xs text-brand-700 hover:underline"
                  title="App de balcão: dispositivos online/offline, ativação e revogação"
                >
                  📟 Dispositivos
                </button>
                <button
                  onClick={() => setCadLoja(lojaSel)}
                  className="text-xs text-brand-700 hover:underline"
                  title="E-mail da loja + campos (endereço, WhatsApp, redes, links de avaliação…)"
                >
                  ⚙ Cadastro da loja
                </button>
                {ehAdmin && lojaSel.ativo !== false && (
                  <button
                    onClick={() => iniciarAcaoLoja(lojaSel, "desativar")}
                    className="text-xs text-amber-700 hover:underline"
                    title="Desativa a loja; se tiver oportunidades/clientes, pergunta se transfere para outra loja (com anotação) ou mantém o histórico"
                  >
                    🚫 Desativar
                  </button>
                )}
                {ehAdmin && lojaSel.ativo === false && (
                  <>
                    <button
                      onClick={() => reativarLoja(lojaSel)}
                      className="text-xs text-emerald-700 hover:underline"
                      title="Volta a loja para ativa"
                    >
                      ♻ Reativar
                    </button>
                    <button
                      onClick={() => iniciarAcaoLoja(lojaSel, "desativar")}
                      className="text-xs text-amber-700 hover:underline"
                      title="Transfere oportunidades/clientes/avaliações desta loja inativa para outra loja, com anotação"
                    >
                      ↪ Transferir vínculos
                    </button>
                  </>
                )}
                {ehAdmin && (
                  <button
                    onClick={() => iniciarAcaoLoja(lojaSel, "apagar")}
                    className="text-xs text-red-600 hover:underline"
                    title="Apaga a loja/departamento; se tiver vínculos, exige transferir para outra loja antes (com anotação)"
                  >
                    🗑 Apagar
                  </button>
                )}
              </div>
            )}
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
                      <button onClick={() => comoUsuario(m.usuario_id, m.nome)}
                        className="text-xs text-brand-700 hover:underline"
                        title="Abrir o sistema como este usuário (nova janela)">
                        👁 entrar como
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

      {/* modal: novo departamento */}
      {novoDept && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={() => setNovoDept(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Novo departamento / loja</h2>
              <button onClick={() => setNovoDept(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Cria nesta marca:{" "}
              <b>{resumo?.marcas.find((m) => m.id === marcaSel)?.nome ?? "—"}</b>.
              Depois vincule a equipe pela coluna ao lado.
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Nome *</label>
                <input className="input" placeholder="Ex.: WT Iguatemi, Delivery SP…"
                  value={ndNome} onChange={(e) => setNdNome(e.target.value)} />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div>
                  <label className="label">Sigla (liga com o cobrança)</label>
                  <input className="input font-mono" placeholder="Ex.: WTIGUA"
                    value={ndSigla} onChange={(e) => setNdSigla(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="label">UF</label>
                  <input className="input w-16 uppercase" maxLength={2} placeholder="SP"
                    value={ndUf} onChange={(e) => setNdUf(e.target.value.toUpperCase())} />
                </div>
              </div>
              <div>
                <label className="label">Cidade</label>
                <input className="input" value={ndCidade} onChange={(e) => setNdCidade(e.target.value)} />
              </div>
              <div>
                <label className="label">E-mail da loja (notificações)</label>
                <input className="input" type="email" placeholder="loja@marca.com.br"
                  value={ndEmail} onChange={(e) => setNdEmail(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button className="btn-ghost" onClick={() => setNovoDept(false)}>Cancelar</button>
              <button className="btn-primary" onClick={criarDepartamento} disabled={ndSalvando || !ndNome.trim()}>
                {ndSalvando ? "Criando…" : "Criar departamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal: cadastro da loja */}
      {cadLoja && (
        <LojaCadastro
          lojaId={cadLoja.id}
          lojaNome={cadLoja.nome}
          onClose={() => setCadLoja(null)}
          onSalvo={() => { carregarLojas(); carregarResumo(); }}
        />
      )}

      {/* modal: dispositivos da loja */}
      {dispLoja && (
        <DispositivosLoja
          lojaId={dispLoja.id}
          lojaNome={dispLoja.nome}
          onClose={() => setDispLoja(null)}
        />
      )}

      {/* modal: apagar/desativar loja com transferência */}
      {lojaAcao && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={() => setLojaAcao(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">
                {lojaAcao.acao === "apagar" ? "Apagar" : "Desativar"} {lojaAcao.loja.sigla || lojaAcao.loja.nome}
              </h2>
              <button onClick={() => setLojaAcao(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <p className="text-sm text-slate-600 mb-2">Esta loja/departamento ainda tem vínculos:</p>
            <ul className="text-sm mb-3 list-disc pl-5">
              <li>{lojaAcao.vinculos.oportunidades} oportunidade(s)</li>
              <li>{lojaAcao.vinculos.clientes} cliente(s)</li>
              <li>{lojaAcao.vinculos.avaliacoes} avaliação(ões)</li>
            </ul>
            <p className="text-sm text-slate-600 mb-2">
              Escolha a loja de <b>destino</b>: tudo será transferido com anotação
              (mensagem interna na oportunidade e nota na ficha do cliente).
            </p>
            <select className="input mb-3" value={destinoId}
              onChange={(e) => setDestinoId(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">— escolher a loja de destino —</option>
              {lojas.filter((x) => x.id !== lojaAcao.loja.id && x.ativo !== false).map((x) => (
                <option key={x.id} value={x.id}>
                  {siglaLoja(x.sigla, marcaSel != null ? marcasSigla[marcaSel] : undefined, x.nome)} — {x.nome}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-2 mt-2">
              <button className="btn-ghost" onClick={() => setLojaAcao(null)}>Cancelar</button>
              {lojaAcao.acao === "desativar" && lojaAcao.loja.ativo !== false && (
                <button className="btn-ghost" onClick={desativarMantendo} disabled={acaoBusy}
                  title="A loja fica inativa e as oportunidades/clientes permanecem nela (histórico preservado)">
                  Desativar mantendo histórico
                </button>
              )}
              <button className="btn-primary" onClick={confirmarAcaoLoja}
                disabled={acaoBusy || destinoId === ""}>
                {acaoBusy ? "Executando…" : lojaAcao.acao === "apagar" ? "Transferir e apagar" : "Transferir e desativar"}
              </button>
            </div>
          </div>
        </div>
      )}

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
