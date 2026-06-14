"use client";

import { useEffect, useState } from "react";
import {
  publicoAvaliacaoLojaForm,
  publicoAvaliacaoSiteForm,
  publicoAvaliarLoja,
  publicoAvaliarSite,
  publicoLojas,
  type AvaliacaoAbertaForm,
} from "@/lib/api";
import { useFaviconMarca } from "@/lib/useFaviconMarca";

function Estrelas({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <div className="whitespace-nowrap">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)} aria-label={`${n} estrela(s)`}
          className="text-2xl px-0.5 transition-transform hover:scale-110"
          style={{ color: n <= valor ? "#f5a623" : "#d8dee9" }}>
          ★
        </button>
      ))}
      <span className="text-xs text-slate-400 ml-1">{valor ? `${valor}/5` : ""}</span>
    </div>
  );
}

/** Página pública de avaliação ABERTA (sem atendimento): da LOJA (QR no balcão)
 *  ou do SITE (marca). Com ou sem compra (nº do pedido opcional). */
export default function AvaliacaoAbertaPagina({ modo, ref_ }: {
  modo: "loja" | "site"; ref_: string;
}) {
  const [form, setForm] = useState<AvaliacaoAbertaForm | null>(null);
  useFaviconMarca(form?.marca_favicon_path);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pedido, setPedido] = useState("");
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [obrigado, setObrigado] = useState("");
  // Picker de loja (só no modo site): o cliente escolhe a loja que visitou.
  const [lojaQ, setLojaQ] = useState("");
  const [lojaSugestoes, setLojaSugestoes] = useState<{ id: number; nome: string }[]>([]);
  const [lojaSel, setLojaSel] = useState<{ id: number; nome: string } | null>(null);

  const cor = form?.marca_tema?.cor || "#0f6bd7";

  useEffect(() => {
    const carregar = modo === "loja"
      ? publicoAvaliacaoLojaForm(ref_)
      : publicoAvaliacaoSiteForm(ref_);
    carregar.then(setForm).catch(() => setErro("Página não encontrada. Confira o endereço."));
  }, [modo, ref_]);

  // Busca de lojas (autocomplete) — debounce simples; só modo site, sem loja escolhida.
  useEffect(() => {
    if (modo !== "site" || lojaSel || !lojaQ.trim()) { setLojaSugestoes([]); return; }
    const t = setTimeout(() => {
      publicoLojas(ref_, lojaQ.trim()).then(setLojaSugestoes).catch(() => setLojaSugestoes([]));
    }, 250);
    return () => clearTimeout(t);
  }, [modo, ref_, lojaQ, lojaSel]);

  async function enviar() {
    if (!form) return;
    setErro("");
    if (nome.trim().length < 2) { setErro("Preencha seu nome."); return; }
    if (!email.trim() && !telefone.trim()) {
      setErro("Informe e-mail ou telefone (a avaliação não é anônima)."); return;
    }
    const dadas = Object.fromEntries(Object.entries(notas).filter(([, v]) => v >= 1));
    if (Object.keys(dadas).length === 0) { setErro("Dê ao menos uma nota."); return; }
    setEnviando(true);
    try {
      const body = {
        nome: nome.trim(),
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        venda_ref: pedido.trim() || undefined,
        notas: dadas,
        comentario: comentario.trim() || undefined,
        // Site: se o cliente escolheu a loja, já direciona a avaliação a ela.
        loja_id: modo === "site" ? lojaSel?.id : undefined,
      };
      const r = modo === "loja"
        ? await publicoAvaliarLoja(ref_, body)
        : await publicoAvaliarSite(ref_, body);
      setObrigado(r.obrigado);
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen py-8 px-4"
      style={{ background: `linear-gradient(180deg, ${cor}26 0%, ${cor}0d 180px, #f3f5f9 420px)` }}>
      <div className="fixed top-0 left-0 right-0 h-1.5 z-10" style={{ background: cor }} />
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          {form?.marca_logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/render/${form.marca_logo_path}`} alt={form.marca ?? ""}
              className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200" />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-lg"
              style={{ background: cor }}>
              {(form?.marca ?? "AV").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-lg leading-tight">{form?.marca ?? "Avaliação"}</div>
            <div className="text-xs text-slate-500">
              {modo === "loja" ? (form?.loja ?? "Avaliação da loja") : "Avaliação do site"}
            </div>
          </div>
        </div>

        <div className="card p-6">
          {erro && !form && <p className="text-sm text-slate-500">{erro}</p>}

          {form && obrigado && (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">🙏</div>
              <h2 className="text-xl font-bold mb-1">Obrigado!</h2>
              <p className="text-sm text-slate-500">{obrigado}</p>
            </div>
          )}

          {form && !obrigado && (
            <>
              <h2 className="text-lg font-bold mb-1">
                {modo === "loja" ? "Avalie esta loja" : "Avalie nossa marca"}
              </h2>
              <p className="text-sm text-slate-500 mb-5">
                Sua opinião melhora nosso atendimento — leva menos de 1 minuto.
              </p>
              {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{erro}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div><label className="label">Seu nome *</label>
                  <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div><label className="label">E-mail</label>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><label className="label">Telefone / WhatsApp</label>
                  <input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
              </div>
              <div className="mb-4">
                <label className="label">Nº do pedido / cupom (se comprou — opcional)</label>
                <input className="input" value={pedido} onChange={(e) => setPedido(e.target.value)}
                  placeholder="Deixe em branco se não comprou" />
              </div>

              {modo === "site" && (
                <div className="mb-4 relative">
                  <label className="label">Qual loja você visitou? (opcional)</label>
                  {lojaSel ? (
                    <div className="flex items-center justify-between rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <span>📍 {lojaSel.nome}</span>
                      <button type="button" className="text-xs text-slate-400 hover:underline"
                        onClick={() => { setLojaSel(null); setLojaQ(""); }}>trocar</button>
                    </div>
                  ) : (
                    <input className="input" value={lojaQ} onChange={(e) => setLojaQ(e.target.value)}
                      placeholder="Digite o nome, a cidade ou o shopping da loja…" />
                  )}
                  {!lojaSel && lojaSugestoes.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                      {lojaSugestoes.map((l) => (
                        <button key={l.id} type="button"
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                          onClick={() => { setLojaSel(l); setLojaSugestoes([]); }}>
                          {l.nome}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    Direciona sua avaliação à loja certa. Se não souber, pode deixar em branco.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {form.perguntas.map((p, i) => (
                  <div key={p} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-100 pb-2.5">
                    <span className="text-sm">{i + 1}. {p}</span>
                    <Estrelas valor={notas[p] ?? 0}
                      onChange={(n) => setNotas({ ...notas, [p]: n })} />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <label className="label">Comentários (opcional)</label>
                <textarea className="input" rows={3} value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Deixe sua sugestão ou elogio…" />
              </div>
              <div className="mt-5">
                <button onClick={enviar} disabled={enviando}
                  className="text-white font-semibold rounded-lg px-6 py-2.5 disabled:opacity-50"
                  style={{ background: cor }}>
                  {enviando ? "Enviando…" : "Enviar avaliação"}
                </button>
              </div>
            </>
          )}
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">
          Seus dados são usados somente para registrar a avaliação.
        </p>
      </div>
    </div>
  );
}
