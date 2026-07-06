"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { atualizarCliente, clienteIdentidade, clientePreferencias, clientePreferenciaSet, excluirCliente, ficha360, fmtData, fmtTelefone, fmtCpf, cpfValido, usuarioLogado, type ClienteIdentidade, type ClientePrefs, type Ficha } from "@/lib/api";

const fmt1 = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{rotulo}</div>
      <div className="text-sm text-slate-800 break-words">{valor || "—"}</div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-slate-700 mb-3">{titulo}</div>
      {children}
    </div>
  );
}

// Idade atual a partir de "dd/mm/aaaa" ou "aaaa-mm-dd".
function calcIdade(nasc: string | null): string {
  if (!nasc) return "—";
  const br = nasc.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const iso = nasc.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let d: Date | null = null;
  if (br) d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  else if (iso) d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (!d || isNaN(d.getTime())) return "—";
  const h = new Date();
  let i = h.getFullYear() - d.getFullYear();
  const m = h.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < d.getDate())) i--;
  return i >= 0 && i < 130 ? `${i} anos` : "—";
}

function iniciais(nome?: string | null): string {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Link de WhatsApp (BR): só-dígitos + DDI 55 quando vier sem.
function waUrl(tel: string): string {
  const d = (tel || "").replace(/\D/g, "");
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
}

function Stat({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <div className="text-[11px] text-slate-400">{rotulo}</div>
      <div className={`text-sm font-semibold ${tom ?? "text-slate-700"}`}>{valor}</div>
    </div>
  );
}

export default function FichaPage({ params }: { params: { id: string } }) {
  const [f, setF] = useState<Ficha | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [prefs, setPrefs] = useState<ClientePrefs | null>(null);
  const [prefBusy, setPrefBusy] = useState(false);
  const [ident, setIdent] = useState<ClienteIdentidade | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      try {
        const d = await ficha360(params.id);
        if (vivo) setF(d);
      } catch (err) {
        if (vivo) setErro(err instanceof Error ? err.message : "Erro");
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [params.id]);

  useEffect(() => {
    clientePreferencias(params.id)
      .then(setPrefs)
      .catch(() => setPrefs(null));
    clienteIdentidade(params.id)
      .then(setIdent)
      .catch(() => setIdent(null));
  }, [params.id]);

  const atr = (f?.atributos || {}) as Record<string, unknown>;
  const av = (k: string): string | null => {
    const v = atr[k];
    return v != null && String(v).trim() !== "" ? String(v) : null;
  };
  const estado = av("uf") || f?.uf || null;
  const temEndereco = !!(av("endereco") || av("bairro") || av("cidade") || estado || av("cep") || av("loja_proxima"));
  // Primeiro atendimento = mais antigo da lista carregada (newest-first -> ultimo).
  const primeiro = f && f.atendimentos.length
    ? f.atendimentos[f.atendimentos.length - 1].criado_em
    : null;
  const ultimo = f && f.atendimentos.length ? f.atendimentos[0].criado_em : null;
  const situacao = f && f.atendimentos.length ? f.atendimentos[0].status : null;

  // ── Edicao do cadastro (admin/escopo): colunas quentes + gaveta de atributos ──
  const [editando, setEditando] = useState(false);
  const [edForm, setEdForm] = useState<Record<string, string>>({});
  const [edExtras, setEdExtras] = useState<{ chave: string; valor: string }[]>([]);
  const [edNovaChave, setEdNovaChave] = useState("");
  const [edSalvando, setEdSalvando] = useState(false);
  const [edErro, setEdErro] = useState("");

  const ED_FIXOS = ["endereco", "bairro", "cidade", "uf", "cep", "instagram", "esporte", "tamanho"];

  function abrirEdicao() {
    if (!f) return;
    const m: Record<string, string> = {
      nome: f.nome ?? "", email: f.email ?? "", telefone: f.telefone ?? "",
      nascimento: f.nascimento ?? "", cpf: f.cpf ?? "",
    };
    for (const k of ED_FIXOS) m["attr:" + k] = av(k) ?? "";
    // demais atributos texto viram linhas extras editaveis
    const extras: { chave: string; valor: string }[] = [];
    for (const [k, v] of Object.entries(atr)) {
      if (ED_FIXOS.includes(k)) continue;
      if (typeof v === "string" && v.trim() !== "") extras.push({ chave: k, valor: v });
    }
    setEdExtras(extras);
    setEdForm(m);
    setEdErro("");
    setEditando(true);
  }

  async function salvarEdicao() {
    setEdSalvando(true);
    setEdErro("");
    try {
      const atributos: Record<string, string> = {};
      for (const k of ED_FIXOS) atributos[k] = (edForm["attr:" + k] ?? "").trim();
      for (const ex of edExtras) {
        if (ex.chave.trim()) atributos[ex.chave.trim()] = ex.valor.trim();
      }
      await atualizarCliente(Number(params.id), {
        nome: edForm.nome.trim() || null,
        email: edForm.email.trim() || null,
        telefone: edForm.telefone.trim() || null,
        nascimento: edForm.nascimento.trim() || null,
        cpf: edForm.cpf.trim() || null,
        atributos,
      });
      setEditando(false);
      setF(await ficha360(params.id));
    } catch (e) {
      setEdErro(String((e as Error).message || e));
    } finally {
      setEdSalvando(false);
    }
  }

  function permitidoPref(canal: string, tema: string): boolean {
    return !!prefs?.itens.find(
      (i) => i.canal === canal && i.tema === tema && i.marca_id == null && i.permitido,
    );
  }
  async function togglePref(canal: string, tema: string, novo: boolean) {
    setPrefBusy(true);
    try {
      await clientePreferenciaSet(params.id, { canal, tema, marca_id: null, permitido: novo });
      setPrefs(await clientePreferencias(params.id));
    } catch {
      /* mantem estado */
    } finally {
      setPrefBusy(false);
    }
  }

  async function copiar() {
    if (!f) return;
    const txt = [
      f.nome,
      f.email,
      f.telefone ? fmtTelefone(f.telefone) : null,
      f.cpf ? fmtCpf(f.cpf) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <Shell title="Ficha do cliente">
      <div className="max-w-5xl">
        <Link href="/clientes" className="text-sm text-slate-500 hover:underline">
          ← Voltar para a busca
        </Link>

        {loading && <div className="text-slate-400 mt-6">Carregando…</div>}
        {erro && (
          <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm mt-4">{erro}</div>
        )}

        {f && (
          <div className="mt-4 space-y-5">
            {/* Cabecalho + Contato */}
            <div className="card p-5">
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-bold shrink-0"
                  aria-hidden
                >
                  {iniciais(f.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-slate-800 break-words">{f.nome || "(sem nome)"}</h2>
                  <div className="text-sm text-slate-500 mt-0.5 break-all" title={f.email || undefined}>{f.email || "sem e-mail"}</div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {f.telefone && (
                      <a
                        href={waUrl(f.telefone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-xs px-3 py-1.5"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                    {f.email && (
                      <a href={`mailto:${f.email}`} className="btn-ghost text-xs px-3 py-1.5">
                        ✉️ E-mail
                      </a>
                    )}
                    {typeof av("instagram") === "string" && String(av("instagram")).trim() && (
                      <a
                        href={(() => {
                          const h = String(av("instagram")).trim();
                          if (/^https?:/i.test(h)) return h;
                          const limpo = h.replace(/^@+/, "");
                          return "https://instagram.com/" + (limpo.toLowerCase().startsWith("instagram.com/") ? limpo.slice(14) : limpo);
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-xs px-3 py-1.5"
                        title="Abrir o Instagram do cliente (logado como a loja, interaja manualmente)"
                      >
                        📸 Instagram
                      </a>
                    )}
                    <button onClick={copiar} className="btn-ghost text-xs px-3 py-1.5">
                      📋 {copiado ? "Copiado!" : "Copiar dados"}
                    </button>
                  </div>
                </div>
                <span className="badge-blue shrink-0">{f.total_atendimentos} atendimento(s)</span>
                <button className="btn-secondary text-xs shrink-0" onClick={abrirEdicao}>
                  ✏️ Editar cadastro
                </button>
                {(usuarioLogado()?.papel ?? "admin") === "admin" && (
                  <button
                    className="text-red-600 hover:underline text-xs shrink-0"
                    title="Excluir DEFINITIVAMENTE este cliente (só admin; bloqueado se tiver atendimentos)"
                    onClick={async () => {
                      if (!confirm(`EXCLUIR o cliente "${f.nome ?? f.id}"? IRREVERSÍVEL.`)) return;
                      let comAtend = false;
                      if (f.total_atendimentos > 0) {
                        comAtend = confirm(
                          `Ele tem ${f.total_atendimentos} atendimento(s).\n\nOK = excluir o cliente E os atendimentos dele.\nCancelar = não excluir nada.`
                        );
                        if (!comAtend) return;
                      }
                      if (!confirm("Confirma de novo: excluir DEFINITIVAMENTE?")) return;
                      try {
                        await excluirCliente(f.id, comAtend);
                        window.location.href = "/clientes";
                      } catch (e) {
                        alert(String((e as Error).message || e));
                      }
                    }}
                  >
                    🗑 Excluir
                  </button>
                )}
              </div>

              {/* mini-indicadores */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                <Stat rotulo="Atendimentos" valor={String(f.total_atendimentos)} />
                <Stat rotulo="Primeiro contato" valor={fmtData(primeiro)} />
                <Stat rotulo="Último contato" valor={fmtData(ultimo)} />
                <Stat
                  rotulo="Situação recente"
                  valor={situacao ?? "—"}
                  tom={
                    situacao === "encerrada"
                      ? "text-slate-500"
                      : situacao === "em_espera"
                        ? "text-amber-600"
                        : situacao
                          ? "text-emerald-600"
                          : "text-slate-400"
                  }
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
                <Campo rotulo="E-mail" valor={f.email} />
                <Campo rotulo="Telefone" valor={f.telefone ? fmtTelefone(f.telefone) : null} />
                <Campo
                  rotulo="CPF"
                  valor={
                    f.cpf ? (
                      <span className="inline-flex items-center gap-1.5">
                        {fmtCpf(f.cpf)}
                        {cpfValido(f.cpf) ? (
                          <span className="badge-green text-[10px] px-1.5 py-0">✓ válido</span>
                        ) : (
                          <span className="badge-amber text-[10px] px-1.5 py-0">verificar</span>
                        )}
                      </span>
                    ) : null
                  }
                />
                <Campo rotulo="Nascimento" valor={f.nascimento} />
                <Campo rotulo="Idade" valor={calcIdade(f.nascimento)} />
                <Campo rotulo="Primeiro atendimento" valor={fmtData(primeiro)} />
                {av("tel_residencial") && <Campo rotulo="Tel. residencial" valor={fmtTelefone(av("tel_residencial"))} />}
                {av("tel_comercial") && <Campo rotulo="Tel. comercial" valor={fmtTelefone(av("tel_comercial"))} />}
                {av("tel_fixo") && <Campo rotulo="Tel. fixo" valor={fmtTelefone(av("tel_fixo"))} />}
                {av("periodo_contato") && <Campo rotulo="Melhor horário" valor={av("periodo_contato")} />}
              </div>
            </div>

            {/* Endereco */}
            {temEndereco && (
              <Bloco titulo="Endereço">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Campo rotulo="Rua e número" valor={av("endereco")} />
                  <Campo rotulo="Bairro" valor={av("bairro")} />
                  <Campo rotulo="Cidade" valor={av("cidade")} />
                  <Campo rotulo="Estado" valor={estado} />
                  <Campo rotulo="CEP" valor={av("cep")} />
                  <Campo rotulo="Loja mais próxima" valor={av("loja_proxima")} />
                </div>
              </Bloco>
            )}

            {/* Enriquecimento */}
            <Bloco titulo="Enriquecimento">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Campo rotulo="Esporte" valor={av("esporte")} />
                <Campo rotulo="Tamanho do tênis" valor={av("tamanho")} />
              </div>
              {f.clubes.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-slate-400 mb-1">Clubes</div>
                  <div className="flex flex-wrap gap-2">
                    {f.clubes.map((c) => (
                      <span key={c.vinculo_id} className="badge-gray">
                        {c.clube_nome}
                        {c.nivel ? ` · ${c.nivel}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 text-xs text-slate-400 italic">
                Enriquecimento por IA (perfil, interesses, propensão) — em breve.
              </div>
            </Bloco>

            {/* Satisfação do cliente (avaliações dele) */}
            {f.avaliacoes_total > 0 && (
              <Bloco titulo="Satisfação do cliente">
                <div className="flex items-baseline gap-3 mb-3">
                  <div className="text-3xl font-bold text-amber-500">
                    {f.avaliacoes_media != null ? `${fmt1(f.avaliacoes_media)} ★` : "—"}
                  </div>
                  <div className="text-sm text-slate-500">
                    {f.avaliacoes_total} avaliação(ões)
                  </div>
                </div>
                {f.avaliacoes_recentes.filter((a) => a.comentario).length > 0 && (
                  <div className="space-y-2.5">
                    {f.avaliacoes_recentes
                      .filter((a) => a.comentario)
                      .map((a, i) => (
                        <div key={i} className="border-l-2 border-amber-300 pl-3">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="text-amber-500 font-semibold">
                              {a.media != null ? `${fmt1(a.media)} ★` : "—"}
                            </span>
                            {a.com_compra && <span className="badge-green text-[10px]">com compra</span>}
                            <span className="ml-auto">{fmtData(a.criado_em)}</span>
                          </div>
                          <div className="text-sm text-slate-700 mt-0.5">“{a.comentario}”</div>
                        </div>
                      ))}
                  </div>
                )}
              </Bloco>
            )}

            {/* Identidade (identity graph) — sinais que reconhecem o cliente */}
            {ident && ident.sinais.length > 0 && (
              <Bloco titulo="Identidade (como reconhecemos este cliente)">
                <div className="flex flex-wrap gap-2">
                  {ident.sinais.map((s, i) => (
                    <span key={i} className="text-xs rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                      <span className="text-slate-400 capitalize">{s.tipo}:</span>{" "}
                      <span className="text-slate-700">{s.valor}</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Sinais unificados pelo sistema — o mesmo cliente e' reconhecido por estes dados.
                </p>
              </Bloco>
            )}

            {/* Preferencias de comunicacao (LGPD) — opt-in por canal x tema */}
            <Bloco titulo="Preferências de comunicação (LGPD)">
              {!prefs ? (
                <div className="text-sm text-slate-400">Carregando…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-sm">
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-slate-400 pr-3 py-1">Tema \ Canal</th>
                        {prefs.canais.map((c) => (
                          <th key={c} className="px-2 text-xs text-slate-500 capitalize">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prefs.temas.map((t) => (
                        <tr key={t} className="border-t border-slate-100">
                          <td className="pr-3 py-1 capitalize text-slate-700">{t}</td>
                          {prefs.canais.map((c) => (
                            <td key={c} className="px-2 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={permitidoPref(c, t)}
                                disabled={prefBusy}
                                onChange={(e) => togglePref(c, t, e.target.checked)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-400 mt-2">
                    Marcado = o cliente ACEITA receber (todas as marcas). Aplicado nas campanhas (opt-in LGPD).
                  </p>
                </div>
              )}
            </Bloco>

            {/* Atendimentos (Data, Assunto, Status — mais recente primeiro) */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--line)] text-sm font-semibold text-slate-700">
                Atendimentos
              </div>
              {f.atendimentos.length === 0 ? (
                <div className="px-5 py-4 text-sm text-slate-400">Nenhum atendimento.</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-[var(--line)]">
                    <tr>
                      <th className="th w-28">Data</th>
                      <th className="th">Assunto</th>
                      <th className="th w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {f.atendimentos.map((a) => (
                      <tr key={a.id} className="row-link">
                        <td className="td text-slate-500 whitespace-nowrap">{fmtData(a.criado_em)}</td>
                        <td className="td">
                          <Link
                            href={`/atendimentos/${a.id}`}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {a.assunto || `Atendimento ${a.numero}`}
                          </Link>
                        </td>
                        <td className="td">
                          <span className={"badge-" + (a.status === "encerrada" ? "gray" : a.status === "em_espera" ? "amber" : "green")}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
          {editando && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditando(false); }}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Editar cadastro do cliente</h2>
              <button className="text-slate-400 hover:text-slate-700" onClick={() => setEditando(false)}>✕</button>
            </div>
            {edErro && <div className="card p-3 mb-3 border-red-200 bg-red-50 text-sm text-red-700">{edErro}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Nome</label>
                <input className="input" value={edForm.nome ?? ""} onChange={(e) => setEdForm({ ...edForm, nome: e.target.value })} />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input className="input" value={edForm.email ?? ""} onChange={(e) => setEdForm({ ...edForm, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Telefone (DDD + número)</label>
                <input className="input" value={edForm.telefone ?? ""} onChange={(e) => setEdForm({ ...edForm, telefone: e.target.value })} />
              </div>
              <div>
                <label className="label">Nascimento (dd/mm/aaaa)</label>
                <input className="input" value={edForm.nascimento ?? ""} onChange={(e) => setEdForm({ ...edForm, nascimento: e.target.value })} />
              </div>
              <div>
                <label className="label">CPF</label>
                <input className="input" value={edForm.cpf ?? ""} onChange={(e) => setEdForm({ ...edForm, cpf: e.target.value })} />
              </div>
              {ED_FIXOS.map((k) => (
                <div key={k}>
                  <label className="label capitalize">{k === "uf" ? "UF" : k}</label>
                  <input className="input" value={edForm["attr:" + k] ?? ""}
                    onChange={(e) => setEdForm({ ...edForm, ["attr:" + k]: e.target.value })} />
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="text-sm font-semibold text-slate-700 mb-2">Outros dados (enriquecimento)</div>
              {edExtras.map((ex, i2) => (
                <div key={i2} className="flex gap-2 mb-2">
                  <input className="input w-44 font-mono text-xs" value={ex.chave}
                    onChange={(e) => setEdExtras(edExtras.map((x, j) => j === i2 ? { ...x, chave: e.target.value } : x))} />
                  <input className="input flex-1" value={ex.valor}
                    onChange={(e) => setEdExtras(edExtras.map((x, j) => j === i2 ? { ...x, valor: e.target.value } : x))} />
                  <button className="btn-ghost text-xs" onClick={() => setEdExtras(edExtras.filter((_, j) => j !== i2))}>✕</button>
                </div>
              ))}
              <div className="flex gap-2">
                <input className="input w-44 font-mono text-xs" placeholder="novo campo (ex.: tiktok)"
                  value={edNovaChave} onChange={(e) => setEdNovaChave(e.target.value)} />
                <button className="btn-ghost text-xs" disabled={!edNovaChave.trim()}
                  onClick={() => { setEdExtras([...edExtras, { chave: edNovaChave.trim(), valor: "" }]); setEdNovaChave(""); }}>
                  + Adicionar campo
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Ex.: instagram, tiktok, time, calçado… Vira dado pesquisável do cliente.
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarEdicao} disabled={edSalvando}>
                {edSalvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
</Shell>
  );
}
