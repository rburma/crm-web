"use client";
// 🔒 Painel de recrutamento acoplado ao ATENDIMENTO (wireframe v4): visível
// SÓ para franqueado (admin da loja) e admin do sistema — o backend devolve
// 403 para atendentes e o painel simplesmente não aparece. Mostra score +
// breakdown, MBI, DISC, vídeos, respostas e permite ajustar nota manual.
import { useEffect, useState } from "react";
import {
  vagasNotaManual, vagasPainel, type PainelCandidatura,
} from "@/lib/api";

// Leitura interpretada do DISC (pedido 31/07: so as barras estavam cruas).
// Texto deterministico por dimensao predominante + traco secundario.
const DISC_INFO: Record<string, { nome: string; forte: string; loja: string; atencao: string }> = {
  D: {
    nome: "Dominância",
    forte: "direto, decidido e focado em resultado — gosta de meta e resolve rápido",
    loja: "rende com metas claras e autonomia; bom para puxar resultado e encarar situações difíceis",
    atencao: "pode ser impaciente com processos lentos e rotina repetitiva",
  },
  I: {
    nome: "Influência",
    forte: "comunicativo e entusiasmado — cria conexão fácil com clientes e colegas",
    loja: "brilha no salão e em vendas; é o cartão de visitas da loja",
    atencao: "pode dispersar em tarefas longas e silenciosas (estoque, fechamento)",
  },
  S: {
    nome: "Estabilidade",
    forte: "paciente, constante e leal — escuta de verdade e mantém o ritmo",
    loja: "segura a operação do dia a dia e atende com calma até o cliente difícil",
    atencao: "tende a evitar conflito e a sofrer com mudanças bruscas",
  },
  C: {
    nome: "Conformidade",
    forte: "detalhista e organizado — segue o procedimento e entrega bem-feito",
    loja: "preciso em caixa, estoque, fechamento e processos",
    atencao: "pode travar buscando perfeição e demorar para decidir",
  },
};

function descreverDisc(d: { D: number; I: number; S: number; C: number; perfil: string }): string {
  const [p1, p2] = (d.perfil || "").split("-");
  const a = DISC_INFO[p1];
  if (!a) return "";
  const pct = (k: string) => d[k as "D" | "I" | "S" | "C"] ?? 0;
  let txt = `Predominante ${a.nome} (${pct(p1)}%): ${a.forte}.`;
  const b = p2 ? DISC_INFO[p2] : null;
  if (b) txt += ` Traço secundário ${b.nome} (${pct(p2)}%): ${b.forte}.`;
  txt += ` Na loja: ${a.loja}. Ponto de atenção: ${a.atencao}.`;
  return txt;
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <div className="text-slate-400">{rotulo}</div>
      <div className="font-medium text-slate-800">{valor || "—"}</div>
    </div>
  );
}

export default function PainelRecrutamento({ id }: { id: number }) {
  const [dados, setDados] = useState<PainelCandidatura | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const [aberto, setAberto] = useState(true);
  const [editando, setEditando] = useState<number | null>(null);
  const [nota, setNota] = useState(3);

  function carregar() {
    vagasPainel(id).then(setDados).catch(() => setSemAcesso(true));
  }
  useEffect(carregar, [id]);

  if (semAcesso || !dados) return null;
  const c = dados.candidato;
  const videos = dados.respostas.filter((r) => r.tipo === "video");
  const anexos = dados.respostas.filter((r) => r.tipo === "anexo");
  const abertas = dados.respostas.filter((r) => r.tipo !== "video" && r.tipo !== "anexo");
  const idxAtual = dados.fases.findIndex((f) => f.slug === dados.fase);

  async function salvarNota(perguntaId: number) {
    try {
      await vagasNotaManual(id, perguntaId, nota);
      setEditando(null);
      carregar();
    } catch { /* mantem */ }
  }

  const chipStatus =
    dados.status === "aprovado" ? "✅ APROVADO"
    : dados.status === "desclassificado" ? "✖ DESCLASSIFICADO"
    : dados.status === "banco" ? "⏸ BANCO" : "EM PROCESSO";

  return (
    <div className="card p-5 border-2 border-red-200">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-semibold text-slate-700">
          🔒 Recrutamento — visível só para franqueado/admin
        </div>
        <div className="flex items-center gap-2">
          {dados.score != null && (
            <span className="px-2 py-0.5 rounded-lg font-extrabold text-sm bg-emerald-100 text-emerald-800">
              Score {Math.round(dados.score)}
            </span>
          )}
          <span className="text-xs font-bold text-slate-500">{chipStatus}</span>
          <button className="text-xs text-slate-400" onClick={() => setAberto(!aberto)}>
            {aberto ? "▲ recolher" : "▼ abrir"}
          </button>
        </div>
      </div>
      {aberto && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1 mb-3">
            {dados.fases.map((f, i) => (
              <span key={f.slug}
                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  i < idxAtual ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                  : i === idxAtual ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                {f.nome}
              </span>
            ))}
          </div>

          <div>
            <div>
              {c && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <Campo rotulo="Nome" valor={c.nome} />
                    <Campo rotulo="CPF" valor={c.cpf} />
                    <Campo rotulo="Nascimento" valor={(() => {
                      if (!c.nascimento) return null;
                      const n = new Date(`${c.nascimento}T00:00:00`);
                      const data = c.nascimento.split("-").reverse().join("/");
                      if (Number.isNaN(n.getTime())) return data;
                      const hoje = new Date();
                      let idade = hoje.getFullYear() - n.getFullYear();
                      const m = hoje.getMonth() - n.getMonth();
                      if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) idade--;
                      return `${data} (${idade} anos)`;
                    })()} />
                    <Campo rotulo="Cidade" valor={[c.cidade, c.uf].filter(Boolean).join("/") || null} />
                    <div>
                      <div className="text-slate-400">Telefone</div>
                      {c.telefone ? (
                        <a className="font-medium text-indigo-700" href={`tel:+55${c.telefone}`}>
                          {c.telefone.length === 11
                            ? `(${c.telefone.slice(0, 2)}) ${c.telefone.slice(2, 7)}-${c.telefone.slice(7)}`
                            : c.telefone}
                        </a>
                      ) : <div className="font-medium text-slate-800">—</div>}
                    </div>
                    <div>
                      <div className="text-slate-400">E-mail</div>
                      {c.email ? (
                        <a className="font-medium text-indigo-700 break-all" href={`mailto:${c.email}`}>{c.email}</a>
                      ) : <div className="font-medium text-slate-800">—</div>}
                    </div>
                    {dados.capital && <Campo rotulo="Capital declarado" valor={dados.capital} />}
                    {dados.cidade && <Campo rotulo="Cidade pretendida" valor={`${dados.cidade}/${dados.uf || ""}`} />}
                  </div>
                  {c.redes && Object.keys(c.redes).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(c.redes).map(([k, v]) => (
                        <a key={k} target="_blank" rel="noreferrer"
                          href={v.startsWith("http") ? v : `https://${v}`}
                          className="text-[11px] bg-white border border-slate-200 rounded-full px-2.5 py-1 text-indigo-700">
                          {k === "instagram" ? "📷" : "💼"} {v.replace(/^https?:\/\//, "")}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 mt-2">
                    Trava de recandidatura: 12 meses por CPF (qualquer loja/marca)
                  </div>
                </div>
              )}
              {c?.ja_trabalhou && c.experiencia && c.experiencia.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-bold text-slate-500 mb-1">Experiência</div>
                  {c.experiencia.map((e, i) => (
                    <div key={i} className="text-xs text-slate-600 mb-1">
                      <b>{e.empresa}</b> · {e.cargo} · {e.entrada}–{e.saida || "atual"}
                      {e.descricao && <div className="text-slate-500">{e.descricao}</div>}
                      {(e.telefone_ref || e.superior) && (
                        <div className="text-slate-400">Referência: {e.superior} {e.telefone_ref}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {videos.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-bold text-slate-500 mb-1">🎥 Vídeos</div>
                  <div className="flex flex-wrap gap-2">
                    {videos.map((v, i) => (
                      <a key={i} href={v.valor} target="_blank" rel="noreferrer"
                        className="text-xs bg-slate-900 text-white rounded-lg px-3 py-2">▶ Vídeo {i + 1}</a>
                    ))}
                  </div>
                </div>
              )}
              {anexos.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-bold text-slate-500 mb-1">📎 Anexos</div>
                  {anexos.map((v, i) => (
                    <a key={i} href={v.valor} target="_blank" rel="noreferrer"
                      className="text-xs text-indigo-600 underline block">{v.pergunta || `Anexo ${i + 1}`}</a>
                  ))}
                </div>
              )}
              {dados.disc && (
                <div className="mb-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <div className="text-xs font-bold text-slate-500 mb-1.5">📊 Perfil DISC: {dados.disc.perfil}</div>
                  <div className="max-w-md">
                    {(["D", "I", "S", "C"] as const).map((d) => (
                      <div key={d} className="flex items-center gap-2 text-[11px] mb-0.5">
                        <span className="w-3 font-bold">{d}</span>
                        <div className="flex-1 h-2 bg-slate-200 rounded overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${dados.disc?.[d] ?? 0}%` }} />
                        </div>
                        <span className="w-8 text-right">{dados.disc?.[d] ?? 0}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                    {descreverDisc(dados.disc)}
                  </p>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-bold text-slate-500 mb-1">Respostas do funil (nota × peso)</div>
              {abertas.length === 0 && <div className="text-xs text-slate-400">Ainda sem respostas.</div>}
              {abertas.map((r, i) => {
                const notaFinal = r.nota_manual ?? r.nota ?? r.nota_ia;
                return (
                  <div key={i} className="text-xs border border-slate-100 rounded-lg p-2 mb-1.5">
                    <div className="text-slate-500">{r.pergunta || `Pergunta #${r.pergunta_id}`}</div>
                    <div className="text-slate-800 whitespace-pre-line">“{r.valor}”</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {notaFinal != null ? (
                        <span className="font-bold">
                          nota {Number(notaFinal).toFixed(1)}
                          {r.nota_manual != null ? " (manual)" : r.nota_ia != null && r.nota == null ? " (IA)" : ""}
                        </span>
                      ) : <span className="text-slate-400">sem nota</span>}
                      {r.peso != null && <span className="text-slate-400">peso {r.peso}</span>}
                      {r.rankeia && <span className="text-violet-600">{r.rankeia}</span>}
                      {editando === r.pergunta_id ? (
                        <span className="flex items-center gap-1">
                          <select className="border border-slate-300 rounded px-1 py-0.5"
                            value={nota} onChange={(e) => setNota(Number(e.target.value))}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <button className="text-emerald-700 font-bold" onClick={() => salvarNota(r.pergunta_id)}>✔</button>
                          <button className="text-slate-400" onClick={() => setEditando(null)}>✕</button>
                        </span>
                      ) : (
                        <button className="text-indigo-600" onClick={() => { setEditando(r.pergunta_id); setNota(Math.round(Number(notaFinal ?? 3))); }}>
                          ✏️ ajustar nota
                        </button>
                      )}
                    </div>
                    {r.aval_ia && <div className="text-slate-400 mt-0.5">IA: {r.aval_ia}</div>}
                    {r.alertas_ia && r.alertas_ia.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.alertas_ia.map((a, j) => (
                          <span key={j} className="text-[10px] bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                            ⚠ {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
