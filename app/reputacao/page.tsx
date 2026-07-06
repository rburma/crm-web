"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import LojaCadastro from "@/components/LojaCadastro";
import { me, reputacaoEnviarEmail, reputacaoMatriz, reputacaoRefresh, type ReputacaoMatriz } from "@/lib/api";

const GLOBAIS = ["admin", "rede", "matriz"];

export default function ReputacaoPage() {
  const [data, setData] = useState<ReputacaoMatriz | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sync, setSync] = useState(false);
  const [marcaSel, setMarcaSel] = useState<number | "">("");
  const [sortCol, setSortCol] = useState("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [busca, setBusca] = useState("");
  // Cadastro da loja direto da matriz + selecao p/ e-mail (Renato 07/07)
  const [cadLoja, setCadLoja] = useState<{ id: number; nome: string } | null>(null);
  const [selLojas, setSelLojas] = useState<Set<number>>(new Set());
  const [emailAberto, setEmailAberto] = useState(false);
  const [emAssunto, setEmAssunto] = useState("Reputação da sua loja {sigla}");
  const [emCorpo, setEmCorpo] = useState(
    "Olá, franqueado da {loja}!\n\nA nota consolidada da sua loja está em {total} (de 0 a 5).\n\n"
  );
  const [emBusy, setEmBusy] = useState(false);

  function toggleLoja(id: number) {
    setSelLojas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function enviarEmails() {
    const ids = [...selLojas];
    if (!ids.length) return;
    setEmBusy(true); setErro(""); setMsg("");
    try {
      const r = await reputacaoEnviarEmail(ids, emAssunto, emCorpo);
      const sem = r.resultados.filter((x) => !x.enviados);
      setMsg(
        `${r.enviados} e-mail(s) enviados para ${r.lojas} loja(s).` +
        (sem.length ? ` Sem envio: ${sem.map((x) => x.loja ?? x.loja_id).join(", ")}.` : "")
      );
      setEmailAberto(false);
      setSelLojas(new Set());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro no envio");
    } finally {
      setEmBusy(false);
    }
  }

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      setData(await reputacaoMatriz());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    carregar();
  }, []);
  useEffect(() => {
    me().then((u) => setIsAdmin(GLOBAIS.includes(u.papel))).catch(() => setIsAdmin(false));
  }, []);

  async function dispararRefresh(redes: string[]) {
    setSync(true);
    setErro("");
    setMsg("");
    try {
      const r = await reputacaoRefresh(redes);
      setMsg(r.msg || "Atualização iniciada. Recarregue a página em ~2 min.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setSync(false);
    }
  }

  const redes = data?.redes ?? [];
  const REDES_REFRESH = [
    { rede: "google", label: "Google" },
    { rede: "ifood", label: "iFood" },
    { rede: "ubereats", label: "Uber Eats" },
    { rede: "tripadvisor", label: "TripAdvisor" },
    { rede: "instagram", label: "Instagram" },
    { rede: "facebook", label: "Facebook" },
    { rede: "tiktok", label: "TikTok" },
  ];
  const fmtPost = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };
  const marcas = data?.marcas ?? [];

  function ordenar(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "loja" ? "asc" : "desc");
    }
  }

  // Busca estilo cobranca: palavras soltas = OU; trecho "entre aspas" = frase
  // exata OBRIGATORIA (E). Sem acento/caixa. Campos: sigla, nome, marca,
  // cidade, UF, shopping, apelidos.
  const semAcento = (t: string) =>
    t.normalize("NFD").replace(new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g"), "").toLowerCase();

  const lojas = useMemo(() => {
    let base = (data?.lojas ?? []).filter((l) => marcaSel === "" || l.marca_id === marcaSel);
    const q = busca.trim();
    if (q) {
      const frases: string[] = [];
      const resto = q.replace(/"([^"]+)"/g, (_m, fr) => { frases.push(fr); return " "; });
      const palavras = resto.split(" ").map((w) => w.trim()).filter(Boolean);
      const alvo = (l: (typeof base)[number]) =>
        semAcento([l.sigla, l.nome, l.marca, l.cidade, l.uf, l.shopping, l.apelidos]
          .filter(Boolean).join(" "));
      base = base.filter((l) => {
        const t = alvo(l);
        if (frases.some((fr) => !t.includes(semAcento(fr)))) return false;
        if (palavras.length && !palavras.some((w) => t.includes(semAcento(w)))) return false;
        return true;
      });
    }
    const val = (l: (typeof base)[number]): number | string => {
      if (sortCol === "total") return l.total ?? -1;
      if (sortCol === "loja") return (l.nome || "").toLowerCase();
      const c = l.redes[sortCol];
      return c ? (c.tipo === "social" ? (c.seguidores ?? 0) : (c.nota ?? -1)) : -1;
    };
    return [...base].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, marcaSel, sortCol, sortDir, busca]);

  const seta = (col: string) => (sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <Shell title="Reputação / Avaliações">
      <div className="space-y-4">
        {erro && <div className="card border-red-200 bg-red-50 text-red-700 p-3 text-sm">{erro}</div>}
        {msg && <div className="card border-green-200 bg-green-50 text-green-700 p-3 text-sm">{msg}</div>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              className="input py-1 text-sm w-64"
              placeholder={'Buscar loja: sigla, cidade, shopping… ("aspas" = exato)'}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select
              className="input py-1 text-sm"
              value={marcaSel}
              onChange={(e) => setMarcaSel(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Todas as marcas (total da rede)</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
            <span className="text-xs text-slate-400">{lojas.length} loja(s) · clique no cabeçalho p/ ordenar</span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <button className="btn-primary text-sm whitespace-nowrap" onClick={() => dispararRefresh([])} disabled={sync}>
                {sync ? "Iniciando…" : "🔄 Atualizar tudo"}
              </button>
              {REDES_REFRESH.map((rr) => (
                <button
                  key={rr.rede}
                  className="btn-ghost text-sm whitespace-nowrap"
                  onClick={() => dispararRefresh([rr.rede])}
                  disabled={sync}
                >
                  Atualizar {rr.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {selLojas.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
            <span className="text-blue-800 font-medium">{selLojas.size} loja(s) selecionada(s)</span>
            <button className="btn-primary text-sm" onClick={() => setEmailAberto(true)}>
              ✉️ Enviar e-mail ({selLojas.size})
            </button>
            <button className="btn-ghost text-sm" onClick={() => setSelLojas(new Set())}>Limpar</button>
          </div>
        )}
        <div className="card overflow-x-auto">
          <table className="text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-[var(--line)]">
              <tr>
                <th className="th w-8">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={lojas.length > 0 && lojas.every((l) => selLojas.has(l.loja_id))}
                    onChange={(e) =>
                      setSelLojas(e.target.checked ? new Set(lojas.map((l) => l.loja_id)) : new Set())
                    }
                    title="Selecionar todas as lojas visíveis"
                  />
                </th>
                <th
                  className="th sticky left-0 bg-slate-50 z-10 text-left cursor-pointer select-none"
                  onClick={() => ordenar("loja")}
                >
                  Loja{seta("loja")}
                </th>
                {redes.map((r) => (
                  <th
                    key={r}
                    className="th text-center px-2 cursor-pointer select-none"
                    onClick={() => ordenar(r)}
                  >
                    {r}{seta(r)}
                  </th>
                ))}
                <th
                  className="th text-center px-2 cursor-pointer select-none"
                  onClick={() => ordenar("total")}
                >
                  Total{seta("total")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {lojas.map((l) => (
                <tr key={l.loja_id}>
                  <td className="td">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selLojas.has(l.loja_id)}
                      onChange={() => toggleLoja(l.loja_id)}
                    />
                  </td>
                  <td className="td sticky left-0 bg-white z-10">
                    <button
                      className="mr-1 text-slate-400 hover:text-brand-700"
                      title="Abrir/editar o cadastro desta loja"
                      onClick={() => setCadLoja({ id: l.loja_id, nome: l.nome || `Loja ${l.loja_id}` })}
                    >
                      ✏️
                    </button>
                    <span className="text-xs text-slate-400">{l.sigla || ""}</span> {l.nome || `Loja ${l.loja_id}`}
                  </td>
                  {redes.map((r) => {
                    const c = l.redes[r];
                    const conteudo =
                      c == null ? null : c.tipo === "link" ? (
                        <>🔗</>
                      ) : c.tipo === "social" ? (
                        <>
                          {(c.seguidores ?? 0).toLocaleString("pt-BR")}
                          {c.ultimo_post && (
                            <span className="block text-[10px] text-slate-400">{fmtPost(c.ultimo_post)}</span>
                          )}
                        </>
                      ) : (
                        <>
                          {(c.nota ?? 0).toFixed(1)}/{c.qtd ?? 0}
                        </>
                      );
                    return (
                      <td key={r} className="td text-center px-2">
                        {c == null ? (
                          <span className="text-slate-300">—</span>
                        ) : c.link ? (
                          <a href={c.link} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                            {conteudo}
                          </a>
                        ) : (
                          <span>{conteudo}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="td text-center px-2 font-semibold text-amber-600">
                    {l.total != null ? `${l.total.toFixed(2)}/${l.total_qtd}` : "—"}
                  </td>
                </tr>
              ))}
              {!loading && lojas.length === 0 && (
                <tr>
                  <td className="td text-slate-400" colSpan={redes.length + 3}>
                    Nenhuma reputação nesta seleção.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {cadLoja && (
        <LojaCadastro
          lojaId={cadLoja.id}
          lojaNome={cadLoja.nome}
          onClose={() => setCadLoja(null)}
          onSalvo={() => { setCadLoja(null); carregar(); }}
        />
      )}

      {emailAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-auto">
          <div className="card bg-white p-5 w-full max-w-xl">
            <h2 className="font-bold text-sm mb-1">✉️ E-mail para {selLojas.size} loja(s)</h2>
            <p className="text-xs text-slate-500 mb-3">
              Vai para o e-mail da loja + usuários vinculados com aviso ligado.
              Curingas: <code>{"{loja}"}</code> <code>{"{sigla}"}</code> <code>{"{total}"}</code> (nota consolidada).
            </p>
            <label className="label">Assunto</label>
            <input className="input w-full mb-2" value={emAssunto} onChange={(e) => setEmAssunto(e.target.value)} />
            <label className="label">Mensagem</label>
            <textarea className="input w-full h-40" value={emCorpo} onChange={(e) => setEmCorpo(e.target.value)} />
            <div className="flex justify-end gap-2 mt-3">
              <button className="btn-ghost" onClick={() => setEmailAberto(false)} disabled={emBusy}>Cancelar</button>
              <button className="btn-primary" onClick={enviarEmails} disabled={emBusy || !emAssunto.trim() || !emCorpo.trim()}>
                {emBusy ? "Enviando…" : `Enviar (${selLojas.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
