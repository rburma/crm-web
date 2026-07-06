"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import QrAvaliacao from "@/components/QrAvaliacao";
import {
  boxDesconectar,
  boxIniciar,
  boxStatus,
  configCampos,
  configCriarCampo,
  configDesativarTodosCampos,
  configCriarPergunta,
  configEditarCampo,
  configApagarMarca,
  configCriarMarca,
  configEditarMarca,
  configEditarPergunta,
  configExcluirCampo,
  configExcluirPergunta,
  configImportarPerguntasPadrao,
  configReordenarPerguntas,
  configMarcas,
  configModelos,
  configModelosCatalogo,
  configPerguntas,
  configRemoverFavicon,
  configRemoverLogo,
  configRemoverLogoQuadrado,
  configResetarModelo,
  configSalvarModelo,
  configSubirFavicon,
  configSubirLogo,
  configSubirLogoQuadrado,
  criarResposta,
  usuarioLogado,
  excluirResposta,
  listarLojas,
  listarRespostas,
  type CampoConfig,
  type MarcaConfig,
  type ModeloEmailItem,
  type ModeloTipo,
  type PerguntaConfig,
  type PlaceholderInfo,
  type RespostaPronta,
  vitrineCandidatas,
  definirVitrine,
  type VitrineCandidata,
} from "@/lib/api";
import { paraPngQuadrado } from "@/lib/imagemQuadrada";

type Secao = "aparencia" | "email" | "modelos" | "formulario" | "avaliacao" | "paginas" | "geral" | "autoresposta" | "vitrine" | "box";

const SECOES: { id: Secao; rotulo: string }[] = [
  { id: "aparencia", rotulo: "1. Marca & Aparência" },
  { id: "email", rotulo: "2. E-mail da marca" },
  { id: "modelos", rotulo: "3. Modelos de e-mail" },
  { id: "formulario", rotulo: "4. Formulário de atendimento" },
  { id: "avaliacao", rotulo: "5. Avaliação (NPS)" },
  { id: "paginas", rotulo: "6. Páginas" },
  { id: "geral", rotulo: "7. Configurações gerais" },
  { id: "autoresposta", rotulo: "8. Auto-resposta" },
  { id: "vitrine", rotulo: "9. Vitrine de avaliações" },
  { id: "box", rotulo: "10. Box (anexos)" },
];

// Lembra a última marca escolhida (por navegador) p/ não voltar sempre à 1ª.
const MARCA_STORAGE = "crm_cfg_marca_id";
function lembrarMarca(id: number) {
  if (typeof window !== "undefined") window.localStorage.setItem(MARCA_STORAGE, String(id));
}
function marcaLembrada(): number | null {
  if (typeof window === "undefined") return null;
  const v = Number(window.localStorage.getItem(MARCA_STORAGE));
  return v > 0 ? v : null;
}

export default function ConfiguracoesPage() {
  const [marcas, setMarcas] = useState<MarcaConfig[]>([]);
  const [marca, setMarca] = useState<MarcaConfig | null>(null);
  const [secao, setSecao] = useState<Secao>("aparencia");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  // Criar/apagar marca: SO papel admin (Renato 06/07).
  const ehAdmin = (usuarioLogado()?.papel ?? "admin") === "admin";
  const [novaMarcaAberta, setNovaMarcaAberta] = useState(false);
  const [nmNome, setNmNome] = useState("");
  const [nmSigla, setNmSigla] = useState("");
  const [nmSlug, setNmSlug] = useState("");
  const [nmBusy, setNmBusy] = useState(false);

  async function criarMarcaNova() {
    if (!nmNome.trim() || !nmSlug.trim()) { setErro("Nome e endereço (slug) são obrigatórios."); return; }
    setNmBusy(true); setErro("");
    try {
      const m = await configCriarMarca({
        nome: nmNome.trim(), slug: nmSlug.trim().toLowerCase(),
        sigla: nmSigla.trim().toUpperCase() || undefined,
      });
      setNovaMarcaAberta(false); setNmNome(""); setNmSigla(""); setNmSlug("");
      await recarregarMarcas(m.id);
      flash(`Marca "${m.nome}" criada.`);
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setNmBusy(false);
    }
  }

  async function apagarMarcaAtual() {
    if (!marca) return;
    if (!confirm(`APAGAR a marca "${marca.nome ?? marca.slug}"?\n\nSó é possível quando ela está vazia (sem lojas e sem atendimentos). Isso é irreversível.`)) return;
    setErro("");
    try {
      await configApagarMarca(marca.id);
      await recarregarMarcas();
      flash("Marca apagada.");
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }

  const recarregarMarcas = useCallback(async (manterId?: number) => {
    try {
      const ms = await configMarcas();
      setMarcas(ms);
      const alvo = manterId ?? marca?.id ?? marcaLembrada() ?? undefined;
      const escolhida = ms.find((m) => m.id === alvo) ?? ms[0] ?? null;
      setMarca(escolhida);
      if (escolhida) lembrarMarca(escolhida.id);
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca?.id]);

  useEffect(() => { recarregarMarcas(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  function flash(msg: string) {
    setAviso(msg);
    setTimeout(() => setAviso(""), 2500);
  }

  return (
    <Shell title="⚙️ Configurações">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="label mb-0">Marca:</label>
        <select className="input max-w-xs" value={marca?.id ?? ""}
          onChange={(e) => {
            const m = marcas.find((x) => x.id === Number(e.target.value)) ?? null;
            setMarca(m);
            if (m) lembrarMarca(m.id);
          }}>
          {marcas.map((m) => <option key={m.id} value={m.id}>{m.sigla ? `${m.sigla} — ` : ""}{m.nome ?? m.slug}</option>)}
        </select>
        {ehAdmin && (
          <>
            <button className="btn-ghost text-sm" onClick={() => setNovaMarcaAberta(true)}>
              ＋ Nova marca
            </button>
            <button
              className="text-sm text-red-600 hover:underline"
              title="Apagar a marca selecionada (só quando vazia: sem lojas e sem atendimentos)"
              onClick={apagarMarcaAtual}
            >
              🗑 Apagar
            </button>
          </>
        )}
        {aviso && <span className="text-sm text-emerald-700">✅ {aviso}</span>}
      </div>

      {novaMarcaAberta && (
        <div className="card p-4 mb-4 border-brand-200 bg-brand-50/40">
          <div className="font-semibold text-sm mb-2">Nova marca</div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="label">Nome</label>
              <input className="input w-56" value={nmNome} onChange={(e) => setNmNome(e.target.value)} placeholder="Ex.: Vahrcav" />
            </div>
            <div>
              <label className="label">Sigla</label>
              <input className="input w-24 uppercase" maxLength={8} value={nmSigla}
                onChange={(e) => setNmSigla(e.target.value.toUpperCase())} placeholder="VV" />
            </div>
            <div>
              <label className="label">Endereço público (/f/…)</label>
              <input className="input w-40" value={nmSlug}
                onChange={(e) => setNmSlug(e.target.value.toLowerCase())} placeholder="vahrcav" />
            </div>
            <button className="btn-primary" disabled={nmBusy} onClick={criarMarcaNova}>
              {nmBusy ? "Criando…" : "Criar marca"}
            </button>
            <button className="btn-ghost" onClick={() => setNovaMarcaAberta(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {erro && <div className="card p-3 mb-3 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-4">
        {/* menu de seções */}
        <div className="card p-2 h-fit">
          {SECOES.map((s) => (
            <button key={s.id} onClick={() => setSecao(s.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                secao === s.id ? "bg-brand-50 text-brand-700 font-semibold" : "hover:bg-slate-50"
              }`}>
              {s.rotulo}
            </button>
          ))}
        </div>

        {/* conteúdo */}
        <div className="card p-5">
          {marca && secao === "aparencia" && (
            <SecaoAparencia marca={marca} onSalvo={(m) => { recarregarMarcas(m.id); flash("Salvo!"); }} onErro={setErro} />
          )}
          {marca && secao === "email" && (
            <SecaoEmail marca={marca} onSalvo={(m) => { recarregarMarcas(m.id); flash("Salvo!"); }} onErro={setErro} />
          )}
          {marca && secao === "modelos" && (
            <SecaoModelos marca={marca} onErro={setErro} onOk={() => flash("Salvo!")} />
          )}
          {marca && secao === "formulario" && (
            <SecaoFormulario marca={marca} onErro={setErro} onOk={() => flash("Salvo!")} />
          )}
          {marca && secao === "avaliacao" && (
            <SecaoAvaliacao marca={marca} onErro={setErro} onOk={() => flash("Salvo!")} />
          )}
          {marca && secao === "paginas" && <SecaoPaginas marca={marca} />}
          {marca && secao === "geral" && (
            <SecaoGeral marca={marca} onSalvo={(m) => { recarregarMarcas(m.id); flash("Salvo!"); }} onErro={setErro} />
          )}
          {marca && secao === "autoresposta" && (
            <SecaoAutoresposta marca={marca} onSalvo={(m) => { recarregarMarcas(m.id); flash("Salvo!"); }} onErro={setErro} onOk={() => flash("Salvo!")} />
          )}
          {marca && secao === "vitrine" && <SecaoVitrine marca={marca} />}
          {secao === "box" && <SecaoBox />}
          {!marca && <p className="text-sm text-slate-400">Carregando…</p>}
        </div>
      </div>
    </Shell>
  );
}

// ════════ 10. Box (anexos de atendimento) ════════
function SecaoBox() {
  const [st, setSt] = useState<{ configurado: boolean; conectado: boolean } | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try { setSt(await boxStatus()); }
    catch (e) { setErro(String((e as Error).message || e)); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("box");
    if (p === "conectado") { setOk("✅ Box conectado!"); carregar(); }
    else if (p === "erro") setErro("Não foi possível conectar ao Box. Tente de novo.");
  }, [carregar]);

  async function conectar() {
    setErro("");
    try {
      const r = await boxIniciar();
      window.location.href = r.url;
    } catch (e) { setErro(String((e as Error).message || e)); }
  }
  async function desconectar() {
    if (!confirm("Desconectar o Box? As fotos param de subir até reconectar.")) return;
    setErro(""); setOk("");
    try { await boxDesconectar(); carregar(); }
    catch (e) { setErro(String((e as Error).message || e)); }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="font-bold">Box — anexos de atendimento</h2>
      <p className="text-sm text-slate-500">
        Conecte UMA vez o app do Box do CRM. As fotos dos atendimentos sobem para a pasta
        “Contact Center” e o acesso renova sozinho.
      </p>
      {ok && <div className="card p-3 border-emerald-200 bg-emerald-50 text-sm text-emerald-700">{ok}</div>}
      {erro && <div className="card p-3 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}
      {carregando ? (
        <p className="text-sm text-slate-400">Carregando…</p>
      ) : !st?.configurado ? (
        <div className="card p-3 border-amber-200 bg-amber-50 text-sm text-amber-700">
          Faltam as credenciais no servidor (BOX_CLIENT_ID / BOX_CLIENT_SECRET + a pasta).
        </div>
      ) : st.conectado ? (
        <div className="space-y-3">
          <div className="card p-3 border-emerald-200 bg-emerald-50 text-sm text-emerald-700">
            ✅ Box conectado — as fotos já sobem.
          </div>
          <button className="text-sm text-red-600 hover:underline" onClick={desconectar}>
            Desconectar
          </button>
        </div>
      ) : (
        <button className="btn-primary" onClick={conectar}>Conectar Box</button>
      )}
    </div>
  );
}

// ════════ 9. Vitrine de avaliações ════════
function SecaoVitrine({ marca }: { marca: MarcaConfig }) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://contactcenter.com.br").replace(/\/$/, "");
  const [itens, setItens] = useState<VitrineCandidata[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState("");

  const urlPublica = `${base}/vitrine/${marca.slug}`;
  const codigoEmbed = `<iframe src="${base}/embed/avaliacoes/${marca.slug}" width="100%" height="640" style="border:0" loading="lazy" title="Avaliações ${marca.nome ?? marca.slug}"></iframe>`;

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      setItens(await vitrineCandidatas(marca.id, 4));
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setCarregando(false);
    }
  }, [marca.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function toggle(it: VitrineCandidata) {
    setErro("");
    try {
      const r = await definirVitrine(it.id, !it.vitrine);
      setItens((xs) => xs.map((x) => (x.id === it.id ? { ...x, vitrine: r.vitrine } : x)));
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }

  function copiar(texto: string, qual: string) {
    navigator.clipboard?.writeText(texto)
      .then(() => { setCopiado(qual); setTimeout(() => setCopiado(""), 1500); })
      .catch(() => {});
  }

  const publicadas = itens.filter((i) => i.vitrine).length;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="font-bold">Vitrine de avaliações de {marca.nome ?? marca.slug}</h2>
        <p className="text-sm text-slate-500">
          Escolha quais avaliações (notas altas + comentário) aparecem na página pública e no
          embed do site da loja. Nada aparece sem você publicar. O nome do cliente sai curto
          (ex.: “Maria S.”), por LGPD.
        </p>
      </div>

      {erro && <div className="card p-3 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}

      {/* Links + embed */}
      <div className="card p-4 space-y-3 bg-slate-50">
        <div>
          <div className="label">Página pública da vitrine</div>
          <div className="flex items-center gap-2">
            <input className="input font-mono text-xs" readOnly value={urlPublica} />
            <button className="btn-ghost text-xs shrink-0" onClick={() => copiar(urlPublica, "url")}>
              {copiado === "url" ? "copiado!" : "copiar"}
            </button>
            <a className="btn-ghost text-xs shrink-0" href={urlPublica} target="_blank" rel="noreferrer">abrir</a>
          </div>
        </div>
        <div>
          <div className="label">Código para embutir no site (iframe)</div>
          <textarea className="input font-mono text-xs" rows={2} readOnly value={codigoEmbed} />
          <button className="btn-ghost text-xs mt-1" onClick={() => copiar(codigoEmbed, "embed")}>
            {copiado === "embed" ? "copiado!" : "copiar código"}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          A página/embed ficam públicos quando o site for liberado. ⚠️ estrelas na busca do Google
          não são garantidas para avaliações no próprio site — garantia mesmo é via Google Meu Negócio.
        </p>
      </div>

      {/* Curadoria */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-slate-700">
            Candidatas (≥ 4★ com comentário) — {publicadas} publicada(s)
          </div>
          <button className="btn-ghost text-xs" onClick={carregar}>atualizar</button>
        </div>
        {carregando ? (
          <p className="text-sm text-slate-400 py-4 text-center">Carregando…</p>
        ) : itens.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">
            Nenhuma avaliação com comentário e nota alta ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {itens.map((it) => (
              <div key={it.id} className={`card p-3 ${it.vitrine ? "border-emerald-300 bg-emerald-50/40" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span style={{ color: "#f5a623" }}>{"★".repeat(Math.round(it.nota ?? 0))}</span>
                      <span className="text-xs text-slate-400 ml-1">{it.nota?.toFixed(1)}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">“{it.comentario}”</p>
                    <div className="text-xs text-slate-500 mt-1">
                      {it.cliente ?? "—"}{it.loja ? ` · ${it.loja}` : ""}
                    </div>
                  </div>
                  <label className="flex items-center gap-1 text-xs shrink-0 cursor-pointer">
                    <input type="checkbox" checked={it.vitrine} onChange={() => toggle(it)} />
                    publicar
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════ 1. Marca & Aparência ════════
function SecaoAparencia({ marca, onSalvo, onErro }: {
  marca: MarcaConfig; onSalvo: (m: MarcaConfig) => void; onErro: (e: string) => void;
}) {
  const [nome, setNome] = useState(marca.nome ?? "");
  const [sigla, setSigla] = useState(marca.sigla ?? "");
  const [slug, setSlug] = useState(marca.slug);
  const [cor, setCor] = useState(marca.tema?.cor ?? "#0f6bd7");
  const [titulo, setTitulo] = useState(marca.tema?.titulo ?? "");
  const [boasVindas, setBoasVindas] = useState(marca.tema?.boas_vindas ?? "");
  const [rodape, setRodape] = useState(marca.tema?.rodape ?? "");
  const [subtitulo, setSubtitulo] = useState(marca.tema?.subtitulo ?? "");
  const [consent, setConsent] = useState(marca.tema?.consent ?? "");
  const [phAssunto, setPhAssunto] = useState(marca.tema?.ph_assunto ?? "");
  const [phLoja, setPhLoja] = useState(marca.tema?.ph_loja ?? "");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setNome(marca.nome ?? ""); setSigla(marca.sigla ?? ""); setSlug(marca.slug);
    setCor(marca.tema?.cor ?? "#0f6bd7");
    setTitulo(marca.tema?.titulo ?? "");
    setBoasVindas(marca.tema?.boas_vindas ?? "");
    setRodape(marca.tema?.rodape ?? "");
    setSubtitulo(marca.tema?.subtitulo ?? "");
    setConsent(marca.tema?.consent ?? "");
    setPhAssunto(marca.tema?.ph_assunto ?? "");
    setPhLoja(marca.tema?.ph_loja ?? "");
  }, [marca]);

  async function salvar() {
    setSalvando(true); onErro("");
    try {
      const m = await configEditarMarca(marca.id, {
        nome: nome.trim() || undefined,
        sigla: sigla.trim().toUpperCase(),
        slug: slug.trim() || undefined,
        tema: {
          cor, titulo, boas_vindas: boasVindas, rodape,
          subtitulo, consent, ph_assunto: phAssunto, ph_loja: phLoja,
        },
      });
      onSalvo(m);
    } catch (e) {
      onErro(String((e as Error).message || e));
    } finally {
      setSalvando(false);
    }
  }

  async function subirLogo(f: File | null) {
    if (!f) return;
    onErro("");
    try {
      const m = await configSubirLogo(marca.id, f);
      onSalvo(m);
    } catch (e) {
      onErro(String((e as Error).message || e));
    }
  }

  // Favicon e logo quadrado: convertidos p/ PNG quadrado NO NAVEGADOR antes de subir.
  async function subirFavicon(f: File | null) {
    if (!f) return;
    onErro("");
    try {
      const png = await paraPngQuadrado(f, 180);
      onSalvo(await configSubirFavicon(marca.id, png));
    } catch (e) {
      onErro(String((e as Error).message || e));
    }
  }
  async function subirLogoQuadrado(f: File | null) {
    if (!f) return;
    onErro("");
    try {
      const png = await paraPngQuadrado(f, 512);
      onSalvo(await configSubirLogoQuadrado(marca.id, png));
    } catch (e) {
      onErro(String((e as Error).message || e));
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="font-bold">Marca & Aparência</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Nome da marca</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><label className="label">Sigla (WT, T1, VV…) — prefixa as lojas</label>
          <input className="input uppercase" maxLength={8} value={sigla}
            onChange={(e) => setSigla(e.target.value.toUpperCase())} /></div>
        <div><label className="label">Endereço público (/f/…)</label>
          <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
      </div>
      <div className="flex items-end gap-4">
        <div>
          <label className="label">Cor primária</label>
          <input type="color" className="h-10 w-20 rounded border border-slate-300" value={cor}
            onChange={(e) => setCor(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="label">Logo (PNG/JPG/WebP até 500KB)</label>
          <div className="flex items-center gap-3">
            {marca.logo_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/render/${marca.logo_path}?v=${Date.now()}`} alt="logo"
                className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200" />
            ) : (
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ background: cor }}>
                {(nome || slug).slice(0, 2).toUpperCase()}
              </div>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="text-sm"
              onChange={(e) => subirLogo(e.target.files?.[0] ?? null)} />
            {marca.tem_logo && (
              <button className="text-xs text-red-500 hover:underline"
                onClick={async () => { onErro(""); try { onSalvo(await configRemoverLogo(marca.id)); } catch (e) { onErro(String((e as Error).message || e)); } }}>
                remover
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Logo quadrado + Favicon — convertidos p/ PNG quadrado no navegador */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="label mb-0">Logo quadrado (avatar, app, redes)</label>
            {marca.tem_logo_quadrado && (
              <button className="text-xs text-red-500 hover:underline shrink-0"
                onClick={async () => { onErro(""); try { onSalvo(await configRemoverLogoQuadrado(marca.id)); } catch (e) { onErro(String((e as Error).message || e)); } }}>
                remover
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {marca.logo_quadrado_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/render/${marca.logo_quadrado_path}?v=${Date.now()}`} alt="logo quadrado"
                className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
                style={{ background: cor }}>
                {(nome || slug).slice(0, 2).toUpperCase()}
              </div>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="text-sm min-w-0 flex-1"
              onChange={(e) => subirLogoQuadrado(e.target.files?.[0] ?? null)} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Vira um PNG quadrado automaticamente. Pré-configurado p/ conexões futuras.
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="label mb-0">Favicon (ícone da aba do site)</label>
            {marca.tem_favicon && (
              <button className="text-xs text-red-500 hover:underline shrink-0"
                onClick={async () => { onErro(""); try { onSalvo(await configRemoverFavicon(marca.id)); } catch (e) { onErro(String((e as Error).message || e)); } }}>
                remover
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {marca.favicon_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/render/${marca.favicon_path}?v=${Date.now()}`} alt="favicon"
                className="w-8 h-8 rounded object-contain bg-white border border-slate-200 shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs shrink-0">
                —
              </div>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="text-sm min-w-0 flex-1"
              onChange={(e) => subirFavicon(e.target.files?.[0] ?? null)} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            JPG/PNG → vira o ícone da aba nas páginas públicas desta marca.
          </p>
        </div>
      </div>
      <div><label className="label">Título da página pública</label>
        <input className="input" placeholder="Fale com a gente" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
      <div><label className="label">Texto de boas-vindas</label>
        <input className="input" placeholder="Conte o que aconteceu e nossa equipe responde…" value={boasVindas} onChange={(e) => setBoasVindas(e.target.value)} /></div>
      <div><label className="label">Rodapé</label>
        <input className="input" placeholder="Seus dados são usados somente para este contato." value={rodape} onChange={(e) => setRodape(e.target.value)} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <div><label className="label">Subtítulo (sob o nome da marca)</label>
          <input className="input" placeholder="Atendimento ao cliente" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} /></div>
        <div><label className="label">Texto do aceite (LGPD)</label>
          <input className="input" placeholder="Aceito ser contatado sobre este atendimento (e-mail/WhatsApp) — LGPD." value={consent} onChange={(e) => setConsent(e.target.value)} /></div>
        <div><label className="label">Dica do campo &quot;Assunto&quot;</label>
          <input className="input" placeholder="Ex.: troca de produto, pedido nº…" value={phAssunto} onChange={(e) => setPhAssunto(e.target.value)} /></div>
        <div><label className="label">Dica da busca de loja</label>
          <input className="input" placeholder={'Digite para buscar… (ex.: "Iguatemi", "Loja Virtual")'} value={phLoja} onChange={(e) => setPhLoja(e.target.value)} /></div>
      </div>
      <button className="btn-primary" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar aparência"}
      </button>
    </div>
  );
}

// ════════ 2. E-mail da marca ════════
function SecaoEmail({ marca, onSalvo, onErro }: {
  marca: MarcaConfig; onSalvo: (m: MarcaConfig) => void; onErro: (e: string) => void;
}) {
  const env = marca.envio || {};
  const [fromNome, setFromNome] = useState(env.from_nome ?? "");
  const [fromEmail, setFromEmail] = useState(env.from_email ?? "");
  const [replyTo, setReplyTo] = useState(env.reply_to ?? "");
  const [assinatura, setAssinatura] = useState(env.assinatura ?? "");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const e = marca.envio || {};
    setFromNome(e.from_nome ?? "");
    setFromEmail(e.from_email ?? "");
    setReplyTo(e.reply_to ?? "");
    setAssinatura(e.assinatura ?? "");
  }, [marca]);

  async function salvar() {
    setSalvando(true);
    onErro("");
    try {
      const m = await configEditarMarca(marca.id, {
        envio: {
          from_nome: fromNome,
          from_email: fromEmail,
          reply_to: replyTo,
          assinatura: assinatura,
        },
      });
      onSalvo(m);
    } catch (e) {
      onErro(String((e as Error).message || e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="font-bold">E-mail da marca</h2>
      <p className="text-sm text-slate-500">
        Personalize os e-mails desta marca (confirmação de atendimento, convite de avaliação e respostas).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nome do remetente</label>
          <input className="input" placeholder="Atendimento WT" value={fromNome} onChange={(e) => setFromNome(e.target.value)} />
        </div>
        <div>
          <label className="label">E-mail do remetente (From)</label>
          <input className="input" placeholder="atendimento@suamarca.com.br" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Responder para (Reply-To)</label>
        <input className="input" placeholder="fale@suamarca.com.br" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
      </div>
      <div>
        <label className="label">Assinatura (vai no rodapé do e-mail)</label>
        <textarea
          className="input min-h-[80px]"
          placeholder={"Equipe WT\nwww.suamarca.com.br"}
          value={assinatura}
          onChange={(e) => setAssinatura(e.target.value)}
        />
      </div>
      <div className="text-xs text-slate-400">
        Obs.: o <b>From</b> só aparece com esse e-mail se ele estiver verificado como remetente no provedor
        (ex.: Google Workspace). O <b>Reply-To</b> e a <b>assinatura</b> sempre valem.
      </div>
      <button className="btn-primary" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar e-mail"}
      </button>
    </div>
  );
}

// ════════ 3. Modelos de e-mail ════════
function SecaoModelos({ marca, onErro, onOk }: {
  marca: MarcaConfig; onErro: (e: string) => void; onOk: () => void;
}) {
  const [tipos, setTipos] = useState<ModeloTipo[]>([]);
  const [placeholders, setPlaceholders] = useState<PlaceholderInfo[]>([]);
  const [itens, setItens] = useState<ModeloEmailItem[]>([]);
  const [sel, setSel] = useState<string>("");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  async function recarregar(tipoSel?: string) {
    setLoading(true);
    try {
      const [cat, lst] = await Promise.all([configModelosCatalogo(), configModelos(marca.id)]);
      setTipos(cat.tipos);
      setPlaceholders(cat.placeholders);
      setItens(lst);
      const alvo = tipoSel ?? lst[0]?.tipo ?? "";
      const it = lst.find((x) => x.tipo === alvo);
      if (it) {
        setSel(it.tipo);
        setAssunto(it.assunto);
        setCorpo(it.corpo);
      }
    } catch (e) {
      onErro(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca.id]);

  function selecionar(tipo: string) {
    const it = itens.find((x) => x.tipo === tipo);
    if (!it) return;
    setSel(tipo);
    setAssunto(it.assunto);
    setCorpo(it.corpo);
  }

  function inserir(ph: string) {
    const ta = corpoRef.current;
    if (!ta) {
      setCorpo((c) => c + ph);
      return;
    }
    const s = ta.selectionStart ?? corpo.length;
    const e = ta.selectionEnd ?? corpo.length;
    const novo = corpo.slice(0, s) + ph + corpo.slice(e);
    setCorpo(novo);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + ph.length;
    }, 0);
  }

  async function salvar() {
    if (!sel) return;
    setSalvando(true);
    onErro("");
    try {
      await configSalvarModelo(marca.id, sel, { assunto, corpo });
      await recarregar(sel);
      onOk();
    } catch (e) {
      onErro(String((e as Error).message || e));
    } finally {
      setSalvando(false);
    }
  }

  async function usarPadrao() {
    if (!sel) return;
    if (!confirm("Voltar este modelo ao padrão? A personalização desta marca será removida.")) return;
    setSalvando(true);
    onErro("");
    try {
      await configResetarModelo(marca.id, sel);
      await recarregar(sel);
      onOk();
    } catch (e) {
      onErro(String((e as Error).message || e));
    } finally {
      setSalvando(false);
    }
  }

  const atual = itens.find((x) => x.tipo === sel);

  return (
    <div className="space-y-4">
      <h2 className="font-bold">Modelos de e-mail</h2>
      <p className="text-sm text-slate-500">
        Personalize os e-mails desta marca. Sem personalizar, usa o padrão do sistema.
      </p>
      {loading ? (
        <div className="text-sm text-slate-400">Carregando…</div>
      ) : (
        <div className="grid md:grid-cols-[230px_1fr] gap-5 items-start">
          <div className="space-y-1">
            {tipos.map((t) => {
              const it = itens.find((x) => x.tipo === t.tipo);
              const active = sel === t.tipo;
              return (
                <button
                  key={t.tipo}
                  onClick={() => selecionar(t.tipo)}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${
                    active ? "bg-brand-50 text-brand-700 font-semibold" : "hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className="block">{t.rotulo}</span>
                  <span className="text-[11px] text-slate-400">
                    {t.destinatario === "loja" ? "→ loja" : "→ cliente"}
                    {it?.personalizado ? " · personalizado" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {atual ? (
            <div className="space-y-3 max-w-2xl">
              <div className="text-xs text-slate-500">{atual.descricao}</div>
              <div>
                <label className="label">Assunto</label>
                <input className="input" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
              </div>
              <div>
                <label className="label">Corpo</label>
                <textarea
                  ref={corpoRef}
                  className="input min-h-[260px] font-mono text-xs"
                  value={corpo}
                  onChange={(e) => setCorpo(e.target.value)}
                />
              </div>
              <div>
                <div className="label">Placeholders (clique para inserir)</div>
                <div className="flex flex-wrap gap-1.5">
                  {placeholders.map((p) => (
                    <button
                      key={p.ph}
                      type="button"
                      onClick={() => inserir(p.ph)}
                      title={p.desc}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded px-1.5 py-0.5 font-mono"
                    >
                      {p.ph}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-primary" onClick={salvar} disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
                {atual.personalizado && (
                  <button className="btn-ghost" onClick={usarPadrao} disabled={salvando}>
                    Usar padrão
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">Selecione um tipo de e-mail.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════ 2. Formulário (campos extras) ════════
function SecaoFormulario({ marca, onErro, onOk }: {
  marca: MarcaConfig; onErro: (e: string) => void; onOk: () => void;
}) {
  const [campos, setCampos] = useState<CampoConfig[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoObrig, setNovoObrig] = useState(false);
  const [novoLojaQ, setNovoLojaQ] = useState("");
  const [lojasSug, setLojasSug] = useState<{ id: number; nome: string }[]>([]);
  const [novaLoja, setNovaLoja] = useState<{ id: number; nome: string } | null>(null);

  const carregar = useCallback(() => {
    configCampos(marca.id).then(setCampos).catch((e) => onErro(String((e as Error).message || e)));
  }, [marca.id, onErro]);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!novoLojaQ.trim()) { setLojasSug([]); return; }
    const t = setTimeout(() => {
      listarLojas({ marcaId: marca.id, q: novoLojaQ, limit: 8 })
        .then((ls) => setLojasSug(ls.map((l) => ({ id: l.id, nome: l.nome }))))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [novoLojaQ, marca.id]);

  async function criar() {
    if (novoNome.trim().length < 2) { onErro("Dê um nome ao campo."); return; }
    onErro("");
    try {
      await configCriarCampo({
        marca_id: marca.id, loja_id: novaLoja?.id ?? null,
        nome: novoNome.trim(), obrigatorio: novoObrig,
      });
      setNovoNome(""); setNovoObrig(false); setNovaLoja(null); setNovoLojaQ("");
      carregar(); onOk();
    } catch (e) { onErro(String((e as Error).message || e)); }
  }

  async function alternar(c: CampoConfig, patch: Parameters<typeof configEditarCampo>[1]) {
    onErro("");
    try { await configEditarCampo(c.id, patch); carregar(); onOk(); }
    catch (e) { onErro(String((e as Error).message || e)); }
  }

  async function excluir(c: CampoConfig) {
    if (!confirm(`Excluir o campo "${c.nome}"?`)) return;
    onErro("");
    try { await configExcluirCampo(c.id); carregar(); onOk(); }
    catch (e) { onErro(String((e as Error).message || e)); }
  }

  async function desativarTodos() {
    if (!confirm(`Desativar TODOS os campos extras de ${marca.nome ?? marca.slug} (globais + de TODAS as lojas)? Isso resolve o caso de campos legados que insistem em aparecer.`)) return;
    onErro("");
    try {
      await configDesativarTodosCampos(marca.id);
      carregar();
      onOk();
    } catch (e) { onErro(String((e as Error).message || e)); }
  }

  const globais = campos.filter((c) => c.loja_id === null);
  const porLoja = campos.filter((c) => c.loja_id !== null);

  return (
    <div>
      <h2 className="font-bold mb-1">Campos extras do formulário</h2>
      <p className="text-sm text-slate-500 mb-4">
        Aparecem na página pública de abertura. <b>Toda a marca</b> = em todas as lojas;
        <b> loja específica</b> = só naquela loja (como no helpcenter antigo).
      </p>
      <button
        className="text-sm mb-4 rounded-lg border border-red-200 text-red-600 px-3 py-1.5 hover:bg-red-50"
        onClick={desativarTodos}
      >
        ✖ Desativar TODOS os campos extras desta marca (inclusive os por loja)
      </button>

      {/* novo campo */}
      <div className="border border-slate-200 rounded-lg p-3 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_auto] gap-3 items-end">
          <div><label className="label">Nome do campo</label>
            <input className="input" placeholder="Ex.: Número do pedido (delivery)" value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)} /></div>
          <div className="relative">
            <label className="label">Escopo</label>
            {novaLoja ? (
              <div className="flex items-center justify-between input">
                <span className="truncate text-xs">{novaLoja.nome}</span>
                <button className="text-xs text-slate-400 ml-1" onClick={() => { setNovaLoja(null); setNovoLojaQ(""); }}>✕</button>
              </div>
            ) : (
              <>
                <input className="input" placeholder="Toda a marca (ou busque a loja…)" value={novoLojaQ}
                  onChange={(e) => setNovoLojaQ(e.target.value)} />
                {lojasSug.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-44 overflow-y-auto">
                    {lojasSug.map((l) => (
                      <button key={l.id} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50"
                        onClick={() => setNovaLoja(l)}>{l.nome}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <button className="btn-primary" onClick={criar}>＋ Adicionar</button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 mt-2">
          <input type="checkbox" checked={novoObrig} onChange={(e) => setNovoObrig(e.target.checked)} />
          obrigatório
        </label>
      </div>

      {/* listas */}
      {[{ titulo: `Campos de TODA a marca (${globais.length})`, lista: globais },
        { titulo: `Campos por loja (${porLoja.length})`, lista: porLoja }].map((bloco) => (
        <div key={bloco.titulo} className="mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">{bloco.titulo}</p>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {bloco.lista.map((c) => (
              <div key={c.id} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${c.ativo ? "hover:bg-slate-50" : "opacity-50 bg-slate-50"}`}>
                <span className="truncate">
                  {c.nome}
                  {c.loja_nome && <span className="text-xs text-slate-400 ml-2">({c.loja_nome})</span>}
                </span>
                <span className="shrink-0 flex items-center gap-2 ml-2">
                  <button onClick={() => alternar(c, { obrigatorio: !c.obrigatorio })}
                    className={c.obrigatorio ? "badge-amber" : "badge-gray"}
                    title="Alternar obrigatório">
                    {c.obrigatorio ? "Obrigatório" : "Opcional"}
                  </button>
                  <button onClick={() => alternar(c, { ativo: !c.ativo })}
                    className="text-xs text-slate-500 hover:underline">
                    {c.ativo ? "desativar" : "ativar"}
                  </button>
                  <button onClick={() => excluir(c)} className="text-xs text-red-500 hover:underline">excluir</button>
                </span>
              </div>
            ))}
            {bloco.lista.length === 0 && <p className="text-xs text-slate-400 px-2">Nenhum campo.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════ 3. Avaliação (perguntas NPS) ════════
const TIPOS_PERGUNTA: { v: "nota" | "texto" | "checkbox"; r: string; ico: string }[] = [
  { v: "nota", r: "Nota (estrelas 1–5)", ico: "⭐" },
  { v: "texto", r: "Resposta escrita", ico: "✍️" },
  { v: "checkbox", r: "Caixa (sim/não)", ico: "☑️" },
];
const TIPO_ICO: Record<string, string> = { nota: "⭐", texto: "✍️", checkbox: "☑️" };

function SecaoAvaliacao({ marca, onErro, onOk }: {
  marca: MarcaConfig; onErro: (e: string) => void; onOk: () => void;
}) {
  const [perguntas, setPerguntas] = useState<PerguntaConfig[]>([]);
  const [usandoPadrao, setUsandoPadrao] = useState(false);
  const [padrao, setPadrao] = useState<string[]>([]);
  const [novoTexto, setNovoTexto] = useState("");
  const [novoTipo, setNovoTipo] = useState<"nota" | "texto" | "checkbox">("nota");
  const [novaSugestao, setNovaSugestao] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const [editSugestao, setEditSugestao] = useState("");
  // Texto do consentimento (checkbox de publicação na vitrine) — salvo no tema.
  const [consent, setConsent] = useState(marca.tema?.consent_avaliacao ?? "");
  const [salvandoConsent, setSalvandoConsent] = useState(false);

  const carregar = useCallback(() => {
    configPerguntas(marca.id)
      .then((r) => { setPerguntas(r.perguntas); setUsandoPadrao(r.usando_padrao); setPadrao(r.padrao); })
      .catch((e) => onErro(String((e as Error).message || e)));
  }, [marca.id, onErro]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { setConsent(marca.tema?.consent_avaliacao ?? ""); }, [marca]);

  async function importarPadrao() {
    onErro("");
    try { await configImportarPerguntasPadrao(marca.id); carregar(); onOk(); }
    catch (e) { onErro(String((e as Error).message || e)); }
  }
  async function criar() {
    if (novoTexto.trim().length < 3) { onErro("Escreva a pergunta."); return; }
    onErro("");
    try {
      await configCriarPergunta({
        marca_id: marca.id, texto: novoTexto.trim(), tipo: novoTipo,
        sugestao: novaSugestao.trim() || null, ordem: perguntas.length,
      });
      setNovoTexto(""); setNovaSugestao(""); setNovoTipo("nota"); carregar(); onOk();
    } catch (e) { onErro(String((e as Error).message || e)); }
  }
  async function patch(p: PerguntaConfig, body: Parameters<typeof configEditarPergunta>[1]) {
    onErro("");
    try { await configEditarPergunta(p.id, body); carregar(); onOk(); }
    catch (e) { onErro(String((e as Error).message || e)); }
  }
  async function excluir(p: PerguntaConfig) {
    if (!confirm(`Excluir a pergunta "${p.texto}"?`)) return;
    onErro("");
    try { await configExcluirPergunta(p.id); carregar(); onOk(); }
    catch (e) { onErro(String((e as Error).message || e)); }
  }
  async function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= perguntas.length) return;
    const nova = [...perguntas];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    setPerguntas(nova);  // otimista
    onErro("");
    try { await configReordenarPerguntas(marca.id, nova.map((p) => p.id)); onOk(); }
    catch (e) { onErro(String((e as Error).message || e)); carregar(); }
  }
  function abrirEdicao(p: PerguntaConfig) {
    setEditando(p.id); setEditTexto(p.texto); setEditSugestao(p.sugestao ?? "");
  }
  async function salvarEdicao(p: PerguntaConfig) {
    onErro("");
    try {
      await configEditarPergunta(p.id, { texto: editTexto.trim(), sugestao: editSugestao.trim() || null });
      setEditando(null); carregar(); onOk();
    } catch (e) { onErro(String((e as Error).message || e)); }
  }
  async function salvarConsent() {
    setSalvandoConsent(true); onErro("");
    try {
      const tema: Record<string, string> = {};
      for (const [k, v] of Object.entries(marca.tema || {})) if (v != null) tema[k] = String(v);
      tema.consent_avaliacao = consent;
      await configEditarMarca(marca.id, { tema });
      onOk();
    } catch (e) { onErro(String((e as Error).message || e)); }
    finally { setSalvandoConsent(false); }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-bold mb-1">Campos da avaliação</h2>
      <p className="text-sm text-slate-500 mb-4">
        Monte o formulário de avaliação da marca: <b>notas</b> (estrelas), <b>respostas escritas</b> e
        <b> caixas de seleção</b>. Arraste a ordem com as setas. Personalize por marca — ex.: campos de <b>delivery</b>.
      </p>

      {usandoPadrao && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 text-sm text-amber-800">
          Esta marca está usando as <b>10 perguntas padrão</b> (do sistema antigo):
          <ol className="list-decimal pl-5 mt-1 text-xs">
            {padrao.map((p) => <li key={p}>{p}</li>)}
          </ol>
          <button className="mt-2 text-sm font-semibold underline" onClick={importarPadrao}>
            Importar como editáveis (para personalizar)
          </button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 p-3 mb-4 space-y-2">
        <div className="flex gap-2">
          <input className="input" placeholder="Novo campo — ex.: O pedido chegou no prazo?"
            value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} />
          <select className="input w-44 shrink-0" value={novoTipo}
            onChange={(e) => setNovoTipo(e.target.value as "nota" | "texto" | "checkbox")}>
            {TIPOS_PERGUNTA.map((t) => <option key={t.v} value={t.v}>{t.ico} {t.r}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input className="input" placeholder="Sugestão/dica ao cliente (opcional) — ex.: Conte o que achou"
            value={novaSugestao} onChange={(e) => setNovaSugestao(e.target.value)} />
          <button className="btn-primary shrink-0" onClick={criar}>＋ Adicionar</button>
        </div>
      </div>

      <div className="space-y-1">
        {perguntas.map((p, i) => (
          <div key={p.id} className={`rounded-lg px-3 py-1.5 text-sm ${p.ativo ? "hover:bg-slate-50" : "opacity-50 bg-slate-50"}`}>
            {editando === p.id ? (
              <div className="space-y-2 py-1">
                <input className="input" value={editTexto} onChange={(e) => setEditTexto(e.target.value)} />
                <input className="input" placeholder="Sugestão/dica (opcional)"
                  value={editSugestao} onChange={(e) => setEditSugestao(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primary text-xs px-3 py-1" onClick={() => salvarEdicao(p)}>salvar</button>
                  <button className="btn-ghost text-xs px-3 py-1" onClick={() => setEditando(null)}>cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="flex flex-col leading-none">
                    <button className="text-slate-400 hover:text-slate-700 text-xs disabled:opacity-30"
                      disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
                    <button className="text-slate-400 hover:text-slate-700 text-xs disabled:opacity-30"
                      disabled={i === perguntas.length - 1} onClick={() => mover(i, 1)}>▼</button>
                  </span>
                  <span title={p.tipo} className="shrink-0">{TIPO_ICO[p.tipo] ?? "⭐"}</span>
                  <span className="truncate">
                    {i + 1}. {p.texto}
                    {p.sugestao && <span className="block text-xs text-slate-400 truncate">{p.sugestao}</span>}
                  </span>
                </span>
                <span className="shrink-0 flex items-center gap-2 ml-2">
                  <button onClick={() => abrirEdicao(p)} className="text-xs text-slate-500 hover:underline">editar</button>
                  <button onClick={() => patch(p, { ativo: !p.ativo })} className="text-xs text-slate-500 hover:underline">
                    {p.ativo ? "desativar" : "ativar"}
                  </button>
                  <button onClick={() => excluir(p)} className="text-xs text-red-500 hover:underline">excluir</button>
                </span>
              </div>
            )}
          </div>
        ))}
        {perguntas.length === 0 && !usandoPadrao && <p className="text-xs text-slate-400">Nenhum campo.</p>}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <h3 className="font-semibold text-sm mb-1">Texto do consentimento (publicação na vitrine)</h3>
        <p className="text-xs text-slate-500 mb-2">
          Aparece como caixa de marcação na avaliação. Marcando, o cliente autoriza publicar a avaliação
          no site, redes sociais e telas das lojas. Em branco, usamos um texto padrão.
        </p>
        <textarea className="input" rows={2} value={consent}
          placeholder="Ex.: Autorizo a publicação da minha avaliação (com meu primeiro nome) no site, nas redes sociais e nas telas das lojas."
          onChange={(e) => setConsent(e.target.value)} />
        <button className="btn-primary text-sm mt-2" onClick={salvarConsent} disabled={salvandoConsent}>
          {salvandoConsent ? "Salvando…" : "Salvar texto"}
        </button>
      </div>
    </div>
  );
}

// ════════ 4. Páginas (links prontos + QR codes) ════════
function LinkComQr({ rotulo, url, arquivo }: { rotulo: string; url: string; arquivo: string }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    let vivo = true;
    import("qrcode").then((QRCode) =>
      QRCode.toDataURL(url, { width: 512, margin: 1 })
        .then((d: string) => { if (vivo) setQr(d); })
        .catch(() => {})
    );
    return () => { vivo = false; };
  }, [url]);
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-slate-500 mb-1">{rotulo}</p>
      <div className="flex items-center gap-3">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code" className="w-24 h-24 rounded border border-slate-200 bg-white shrink-0" />
        ) : (
          <div className="w-24 h-24 rounded border border-slate-200 bg-slate-50 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <code className="block text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap mb-2">{url}</code>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs px-2 py-1.5"
              onClick={() => navigator.clipboard?.writeText(url)}>copiar link</button>
            {qr && (
              <a className="btn-ghost text-xs px-2 py-1.5" href={qr} download={`${arquivo}.png`}>
                ⬇ baixar QR (imprimir)
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecaoPaginas({ marca }: { marca: MarcaConfig }) {
  // Domínio CANÔNICO dos links/QR públicos — sempre o site público (não o domínio
  // em que o admin abriu o painel). Assim um QR impresso nunca "congela" uma URL
  // da Vercel. Configurável por NEXT_PUBLIC_SITE_URL; default contactcenter.com.br.
  const [base, setBase] = useState(
    (process.env.NEXT_PUBLIC_SITE_URL ?? "https://contactcenter.com.br").replace(/\/$/, ""),
  );
  const [qLoja, setQLoja] = useState("");
  const [lojas, setLojas] = useState<{ id: number; nome: string }[]>([]);
  const [loja, setLoja] = useState<{ id: number; nome: string } | null>(null);

  useEffect(() => {
    // Só cai no domínio atual em dev local (localhost) — em produção mantém o canônico.
    if (!process.env.NEXT_PUBLIC_SITE_URL && window.location.hostname === "localhost") {
      setBase(window.location.origin);
    }
  }, []);
  useEffect(() => {
    if (!qLoja.trim() || loja) { setLojas([]); return; }
    const t = setTimeout(() => {
      listarLojas({ marcaId: marca.id, q: qLoja, limit: 8 })
        .then((ls) => setLojas(ls.map((l) => ({ id: l.id, nome: l.nome }))))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [qLoja, loja, marca.id]);

  return (
    <div className="max-w-2xl">
      <h2 className="font-bold mb-1">Páginas públicas de {marca.nome ?? marca.slug}</h2>
      <p className="text-sm text-slate-500 mb-4">
        Links e QR codes prontos para o site, e-mail, bio do Instagram e para imprimir na loja.
      </p>
      <div className="space-y-3">
        <LinkComQr rotulo="Formulário público — abrir atendimento"
          url={`${base}/f/${marca.slug}`} arquivo={`qr-atendimento-${marca.slug}`} />
        <LinkComQr rotulo="Acompanhamento de atendimento"
          url={`${base}/acompanhar`} arquivo="qr-acompanhar" />
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">⭐ Avaliação do SITE (marca, com ou sem compra)</p>
          <QrAvaliacao url={`${base}/avaliar-site/${marca.slug}`} nome={marca.nome ?? marca.slug}
            arquivo={`qr-avaliacao-site-${marca.slug}`} />
        </div>

        {/* avaliação POR LOJA (QR pro balcão) */}
        <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-600 mb-2">
            ⭐ Avaliação POR LOJA (com ou sem compra) — gere o QR de cada loja para imprimir no balcão
          </p>
          <div className="relative">
            {loja ? (
              <div className="flex items-center justify-between input bg-white mb-3">
                <span className="truncate text-sm">{loja.nome}</span>
                <button className="text-xs text-slate-500 hover:underline ml-2"
                  onClick={() => { setLoja(null); setQLoja(""); }}>trocar</button>
              </div>
            ) : (
              <>
                <input className="input mb-2" placeholder="🔎 Buscar a loja…" value={qLoja}
                  onChange={(e) => setQLoja(e.target.value)} />
                {lojas.length > 0 && (
                  <div className="absolute left-0 right-0 top-full -mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-44 overflow-y-auto">
                    {lojas.map((l) => (
                      <button key={l.id} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50"
                        onClick={() => setLoja(l)}>{l.nome}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {loja && (
            <QrAvaliacao url={`${base}/avaliar-loja/${loja.id}`} nome={loja.nome}
              arquivo={`qr-avaliacao-loja-${loja.id}`} />
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-4">
        ⚠️ No piloto, as páginas ainda pedem a senha do portão. Quando você decidir publicar
        de verdade, liberamos só essas rotas para acesso aberto.
      </p>
    </div>
  );
}

// ════════ 7. Configurações gerais (espelha o General Settings do legado) ════════
function SecaoGeral({ marca, onSalvo, onErro }: {
  marca: MarcaConfig; onSalvo: (m: MarcaConfig) => void; onErro: (e: string) => void;
}) {
  const env0 = (marca.envio || {}) as Record<string, unknown>;
  const txt0 = (k: string) => (typeof env0[k] === "string" ? (env0[k] as string) : "");
  const lst0 = (k: string) =>
    Array.isArray(env0[k]) ? (env0[k] as string[]).join("\n")
      : typeof env0[k] === "string" ? (env0[k] as string) : "";

  // dados da marca (placeholders {marca.x})
  const [site, setSite] = useState(txt0("site"));
  const [tituloSac, setTituloSac] = useState(txt0("titulo_sac"));
  const [telefoneSac, setTelefoneSac] = useState(txt0("telefone_sac"));
  const [delivery, setDelivery] = useState(txt0("delivery"));
  const [header, setHeader] = useState(txt0("header"));
  const [footer, setFooter] = useState(txt0("footer"));
  // regras (config tipada)
  const [autoclose, setAutoclose] = useState(String(Number(env0.autoclose_dias ?? 0) || 0));
  const [flood, setFlood] = useState(Boolean(env0.flood));
  const [slaAmarelo, setSlaAmarelo] = useState(String(Number(env0.sla_amarelo_horas ?? 0) || 0));
  const [slaVermelho, setSlaVermelho] = useState(String(Number(env0.sla_vermelho_horas ?? 0) || 0));
  const [banEmails, setBanEmails] = useState(lst0("banidos_emails"));
  const [banIps, setBanIps] = useState(lst0("banidos_ips"));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const e = (marca.envio || {}) as Record<string, unknown>;
    const t = (k: string) => (typeof e[k] === "string" ? (e[k] as string) : "");
    const l = (k: string) =>
      Array.isArray(e[k]) ? (e[k] as string[]).join("\n")
        : typeof e[k] === "string" ? (e[k] as string) : "";
    setSite(t("site")); setTituloSac(t("titulo_sac")); setTelefoneSac(t("telefone_sac"));
    setDelivery(t("delivery")); setHeader(t("header")); setFooter(t("footer"));
    setAutoclose(String(Number(e.autoclose_dias ?? 0) || 0));
    setFlood(Boolean(e.flood));
    setSlaAmarelo(String(Number(e.sla_amarelo_horas ?? 0) || 0));
    setSlaVermelho(String(Number(e.sla_vermelho_horas ?? 0) || 0));
    setBanEmails(l("banidos_emails")); setBanIps(l("banidos_ips"));
  }, [marca]);

  function parseLista(s: string): string[] {
    return s.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  }

  async function salvar() {
    setSalvando(true); onErro("");
    try {
      const m = await configEditarMarca(marca.id, {
        envio: {
          site, titulo_sac: tituloSac, telefone_sac: telefoneSac,
          delivery, header, footer,
        },
        config: {
          autoclose_dias: Number(autoclose) || 0,
          flood,
          sla_amarelo_horas: Number(slaAmarelo) || 0,
          sla_vermelho_horas: Number(slaVermelho) || 0,
          banidos_emails: parseLista(banEmails),
          banidos_ips: parseLista(banIps),
        },
      });
      onSalvo(m);
    } catch (e) {
      onErro(String((e as Error).message || e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <h2 className="font-bold">Configurações gerais</h2>
      <p className="text-sm text-slate-500">
        Dados da marca usados nos e-mails (placeholders <code>{"{marca.site}"}</code>,{" "}
        <code>{"{marca.delivery}"}</code>…) e regras de operação.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Site da marca <span className="text-slate-300">{"{marca.site}"}</span></label>
          <input className="input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://suamarca.com.br" />
        </div>
        <div>
          <label className="label">Título do SAC <span className="text-slate-300">{"{marca.titulo_sac}"}</span></label>
          <input className="input" value={tituloSac} onChange={(e) => setTituloSac(e.target.value)} placeholder="SAC WT" />
        </div>
        <div>
          <label className="label">Telefone do SAC <span className="text-slate-300">{"{marca.telefone_sac}"}</span></label>
          <input className="input" value={telefoneSac} onChange={(e) => setTelefoneSac(e.target.value)} placeholder="0800 000 0000" />
        </div>
        <div>
          <label className="label">URL de delivery <span className="text-slate-300">{"{marca.delivery}"}</span></label>
          <input className="input" value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="https://pedido.suamarca.com.br" />
        </div>
      </div>
      <div>
        <label className="label">Cabeçalho dos e-mails <span className="text-slate-300">{"{marca.header}"}</span></label>
        <textarea className="input min-h-[60px]" value={header} onChange={(e) => setHeader(e.target.value)} />
      </div>
      <div>
        <label className="label">Rodapé dos e-mails <span className="text-slate-300">{"{marca.footer}"}</span></label>
        <textarea className="input min-h-[60px]" value={footer} onChange={(e) => setFooter(e.target.value)} />
      </div>

      <hr className="border-slate-200" />
      <h3 className="font-semibold text-sm">Gestão automática de atendimentos</h3>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="label mb-0">Encerrar atendimentos inativos após</label>
        <input type="number" min={0} className="input w-24" value={autoclose} onChange={(e) => setAutoclose(e.target.value)} />
        <span className="text-sm text-slate-500">dias (0 = nunca)</span>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={flood} onChange={(e) => setFlood(e.target.checked)} />
        Ativar controle de flood (evita aberturas duplicadas em sequência)
      </label>

      <hr className="border-slate-200" />
      <h3 className="font-semibold text-sm">Prazo de atendimento (SLA)</h3>
      <p className="text-xs text-slate-500 -mt-2">
        Conta da abertura do atendimento (horas corridas). O selo fica
        <b className="text-amber-600"> amarelo</b> após o 1º prazo e
        <b className="text-red-600"> vermelho</b> após o 2º. 0 = sem alerta.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="label mb-0">Amarelo após</label>
        <input type="number" min={0} className="input w-24" value={slaAmarelo} onChange={(e) => setSlaAmarelo(e.target.value)} />
        <span className="text-sm text-slate-500">horas · Vermelho após</span>
        <input type="number" min={0} className="input w-24" value={slaVermelho} onChange={(e) => setSlaVermelho(e.target.value)} />
        <span className="text-sm text-slate-500">horas</span>
      </div>

      <hr className="border-slate-200" />
      <h3 className="font-semibold text-sm">Banimentos (formulário público)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">E-mails banidos (1 por linha)</label>
          <textarea className="input min-h-[90px]" value={banEmails} onChange={(e) => setBanEmails(e.target.value)} placeholder={"spam@x.com\nabuso@y.com"} />
        </div>
        <div>
          <label className="label">IPs banidos (1 por linha)</label>
          <textarea className="input min-h-[90px]" value={banIps} onChange={(e) => setBanIps(e.target.value)} placeholder={"203.0.113.5"} />
        </div>
      </div>

      <div className="text-xs text-slate-400">
        O encerramento automático e o convite de avaliação por prazo dependem do
        agendador (cron) ligado no servidor.
      </div>
      <button className="btn-primary" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar configurações"}
      </button>
    </div>
  );
}

// ════════ 8. Auto-resposta (palavra-chave + IA) ════════
function SecaoAutoresposta({ marca, onSalvo, onErro, onOk }: {
  marca: MarcaConfig; onSalvo: (m: MarcaConfig) => void; onErro: (e: string) => void; onOk: () => void;
}) {
  const env = (marca.envio || {}) as Record<string, unknown>;
  const [iaAtiva, setIaAtiva] = useState(Boolean(env.autoresposta_ia));
  const [instrucoes, setInstrucoes] = useState(
    typeof env.autoresposta_ia_instrucoes === "string" ? (env.autoresposta_ia_instrucoes as string) : ""
  );
  const [salvandoIa, setSalvandoIa] = useState(false);

  const [lista, setLista] = useState<RespostaPronta[]>([]);
  const [frase, setFrase] = useState("");
  const [gatilhos, setGatilhos] = useState("");
  const [texto, setTexto] = useState("");
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setLista(await listarRespostas(marca.id));
    } catch (e) {
      onErro(String((e as Error).message || e));
    }
  }, [marca.id, onErro]);

  useEffect(() => {
    setIaAtiva(Boolean(env.autoresposta_ia));
    setInstrucoes(typeof env.autoresposta_ia_instrucoes === "string" ? (env.autoresposta_ia_instrucoes as string) : "");
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca.id]);

  async function salvarIa() {
    setSalvandoIa(true); onErro("");
    try {
      const m = await configEditarMarca(marca.id, {
        config: { autoresposta_ia: iaAtiva },
        envio: { autoresposta_ia_instrucoes: instrucoes },
      });
      onSalvo(m);
    } catch (e) {
      onErro(String((e as Error).message || e));
    } finally {
      setSalvandoIa(false);
    }
  }

  async function adicionar() {
    if (!frase.trim() || !texto.trim()) return;
    setCriando(true); onErro("");
    try {
      await criarResposta({
        marca_id: marca.id, frase: frase.trim(),
        texto: texto.trim(), gatilhos: gatilhos.trim() || undefined,
      });
      setFrase(""); setGatilhos(""); setTexto("");
      await carregar();
      onOk();
    } catch (e) {
      onErro(String((e as Error).message || e));
    } finally {
      setCriando(false);
    }
  }

  async function remover(id: number) {
    if (!confirm("Excluir esta resposta?")) return;
    try {
      await excluirResposta(id);
      await carregar();
    } catch (e) {
      onErro(String((e as Error).message || e));
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-bold">Auto-resposta</h2>
        <p className="text-sm text-slate-500">
          Quando o cliente abre um atendimento, o sistema pode responder na hora:
          primeiro por <b>palavra-chave</b> (resposta pronta); se nada casar e a IA
          estiver ligada, a <b>IA</b> responde direto — sempre avisando que é
          automática e que um atendente humano vai dar sequência.
        </p>
      </div>

      {/* IA */}
      <div className="card p-4 space-y-3 border-slate-200">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={iaAtiva} onChange={(e) => setIaAtiva(e.target.checked)} />
          Ativar resposta automática por IA (com aviso ao cliente)
        </label>
        <div>
          <label className="label">Orientação para a IA (opcional)</label>
          <textarea className="input min-h-[70px]" value={instrucoes}
            onChange={(e) => setInstrucoes(e.target.value)}
            placeholder="Ex.: seja cordial, mencione que o prazo de resposta é em horário comercial, não ofereça descontos." />
        </div>
        <div className="text-xs text-slate-400">
          A IA nunca promete prazos/preços específicos e sempre avisa que é automática.
          Requer a chave da IA configurada no servidor (ANTHROPIC_API_KEY).
        </div>
        <button className="btn-primary" onClick={salvarIa} disabled={salvandoIa}>
          {salvandoIa ? "Salvando…" : "Salvar IA"}
        </button>
      </div>

      {/* Palavra-chave → resposta pronta */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Respostas por palavra-chave</h3>
        <div className="space-y-2">
          {lista.length === 0 && <p className="text-sm text-slate-400">Nenhuma resposta cadastrada.</p>}
          {lista.map((r) => (
            <div key={r.id} className="card p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{r.frase}</div>
                {r.gatilhos
                  ? <div className="text-xs text-brand-700 mt-0.5">Gatilhos: {r.gatilhos}</div>
                  : <div className="text-xs text-slate-400 mt-0.5">Sem gatilho (só atalho manual)</div>}
                <div className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">{r.texto}</div>
              </div>
              <button onClick={() => remover(r.id)} className="text-xs text-red-500 hover:underline shrink-0">excluir</button>
            </div>
          ))}
        </div>

        {/* criar */}
        <div className="card p-4 space-y-3 border-slate-200">
          <div className="text-sm font-medium">Nova resposta</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Título (referência interna)</label>
              <input className="input" value={frase} onChange={(e) => setFrase(e.target.value)} placeholder="Ex.: Política de trocas" />
            </div>
            <div>
              <label className="label">Gatilhos (palavras-chave, separadas por vírgula)</label>
              <input className="input" value={gatilhos} onChange={(e) => setGatilhos(e.target.value)} placeholder="troca, devolução, trocar" />
            </div>
          </div>
          <div>
            <label className="label">Resposta (aceita placeholders, ex.: {"{cliente.primeiro_nome}"})</label>
            <textarea className="input min-h-[90px]" value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder={"Olá {cliente.primeiro_nome}! Sobre trocas: …"} />
          </div>
          <button className="btn-primary" onClick={adicionar} disabled={criando || !frase.trim() || !texto.trim()}>
            {criando ? "Salvando…" : "+ Adicionar resposta"}
          </button>
          <div className="text-xs text-slate-400">
            Sem gatilhos, a resposta fica só como atalho manual (não dispara sozinha).
          </div>
        </div>
      </div>
    </div>
  );
}
