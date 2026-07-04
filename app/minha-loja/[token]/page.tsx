"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  franqueadoLoja,
  franqueadoEnviarProposta,
  franqueadoSugerirGoogle,
  franqueadoConfirmarGoogle,
  type FranqueadoLoja,
  type GoogleCandidato,
} from "@/lib/api";

// Campos do endereço/identificação (colunas da loja). A SIGLA não entra (é da franqueadora).
const CAMPOS: { campo: string; rotulo: string; cols?: string; area?: boolean; dica?: string }[] = [
  {
    campo: "nome", rotulo: "Nome de exibição da loja", cols: "sm:col-span-6",
    dica: 'Use o padrão simples — ex.: "Itaú Power Shopping - Contagem, MG 32210-110" ou "R. Augusta, 1200 - São Paulo, SP".',
  },
  { campo: "endereco", rotulo: "Rua / logradouro", cols: "sm:col-span-4" },
  { campo: "numero", rotulo: "Número", cols: "sm:col-span-2" },
  { campo: "complemento", rotulo: "Complemento", cols: "sm:col-span-3" },
  { campo: "bairro", rotulo: "Bairro", cols: "sm:col-span-3" },
  { campo: "cidade", rotulo: "Cidade", cols: "sm:col-span-4" },
  { campo: "uf", rotulo: "UF", cols: "sm:col-span-1" },
  { campo: "cep", rotulo: "CEP", cols: "sm:col-span-1" },
  { campo: "shopping", rotulo: "Shopping (se houver)", cols: "sm:col-span-3" },
  { campo: "shopping_piso", rotulo: "Piso", cols: "sm:col-span-1" },
  { campo: "shopping_loja", rotulo: "Nº da loja no shopping", cols: "sm:col-span-2" },
  {
    campo: "apelidos", area: true, cols: "sm:col-span-6",
    rotulo: "Apelidos / como o shopping ou a rua também é conhecido (1 por linha)",
    dica: 'Facilita o cliente achar a loja na busca. Ex.: "Pedreira" (shopping de Nova Iguaçu).',
  },
];

// Contato e links (gaveta da loja → attr:<chave>). Labels conforme pedido.
// Contato basico (2 colunas). Links das REDES ficam na secao propria abaixo.
const CONTATOS: { chave: string; rotulo: string; placeholder?: string }[] = [
  { chave: "telefone", rotulo: "Telefone da loja", placeholder: "(11) 3333-0000" },
  { chave: "whatsapp", rotulo: "WhatsApp de atendimento da loja", placeholder: "(11) 99999-0000" },
  { chave: "site_loja", rotulo: "Link da página da loja no site da marca", placeholder: "https://..." },
];

// REDES/DELIVERY: 1 por LINHA, campo + botão "Buscar no X" à DIREITA. O botão abre a
// BUSCA DO PRÓPRIO SITE (sem busca automática — só o Google é automático, no bloco
// acima): o franqueado acha a página da loja lá, copia o link e cola no campo.
// O placeholder mostra o FORMATO esperado (link, não @).
const REDES: {
  chave: string; rotulo: string; placeholder: string;
  buscaRotulo: string; buscaUrl: (q: string) => string; dica?: string;
}[] = [
  {
    chave: "ifood", rotulo: "Link no iFood",
    placeholder: "https://www.ifood.com.br/delivery/cidade/sua-loja/...",
    buscaRotulo: "Buscar no iFood",
    buscaUrl: (q) => "https://www.ifood.com.br/busca?q=" + encodeURIComponent(q),
    dica: "Abra sua loja no iFood e copie o endereço da página.",
  },
  {
    chave: "instagram", rotulo: "Link do Instagram da loja",
    placeholder: "https://www.instagram.com/sualoja",
    buscaRotulo: "Buscar no Instagram",
    buscaUrl: (q) => "https://www.instagram.com/explore/search/keyword/?q=" + encodeURIComponent(q),
    dica: "Cole o LINK do perfil (não o @).",
  },
  {
    chave: "tripadvisor", rotulo: "Link no TripAdvisor",
    placeholder: "https://www.tripadvisor.com.br/Restaurant_Review-...",
    buscaRotulo: "Buscar no TripAdvisor",
    buscaUrl: (q) => "https://www.tripadvisor.com.br/Search?q=" + encodeURIComponent(q),
  },
  {
    chave: "tiktok", rotulo: "Link do TikTok da loja",
    placeholder: "https://www.tiktok.com/@sualoja",
    buscaRotulo: "Buscar no TikTok",
    buscaUrl: (q) => "https://www.tiktok.com/search?q=" + encodeURIComponent(q),
  },
  {
    chave: "facebook", rotulo: "Link do Facebook da loja",
    placeholder: "https://www.facebook.com/nomedapagina",
    buscaRotulo: "Buscar no Facebook",
    buscaUrl: (q) => "https://www.facebook.com/search/pages/?q=" + encodeURIComponent(q),
    dica: "Use a PÁGINA da loja (facebook.com/nomedapagina) — perfil pessoal não vale.",
  },
];

// ── Formatacao do NOME DE EXIBICAO ───────────────────────────────
// O legado gravou nomes TODOS EM MAIUSCULAS ("ITAU POWER SHOPPING - CONTAGEM - MG
// - 32210-110"). Se detectamos caixa-alta pura, ja mostramos formatado
// ("Itaú Power Shopping - Contagem, MG 32210-110"): UF entra com virgula e o CEP
// so com espaco (menos hifens). O franqueado confere/ajusta e o salvar leva a
// versao nova (via aprovacao). Nome ja com minusculas = nao mexemos.
const UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);
const CONECTORES = new Set(["de", "da", "do", "das", "dos", "e", "em", "no", "na"]);
const PALAVRAS: Record<string, string> = {
  itau: "Itaú", sao: "São", grao: "Grão", jose: "José", goiania: "Goiânia",
  brasilia: "Brasília", florianopolis: "Florianópolis", maceio: "Maceió",
  cuiaba: "Cuiabá", vitoria: "Vitória", ribeirao: "Ribeirão", sabara: "Sabará",
  niteroi: "Niterói", taubate: "Taubaté", uberlandia: "Uberlândia",
};

function tituloPalavra(w: string, primeira: boolean): string {
  const lw = w.toLowerCase();
  if (UFS.has(w.toUpperCase()) && w.length === 2) return w.toUpperCase();
  if (PALAVRAS[lw]) return PALAVRAS[lw];
  if (!primeira && CONECTORES.has(lw)) return lw;
  if (/^\d/.test(w)) return w; // numeros/CEP ficam como estao
  return lw.charAt(0).toUpperCase() + lw.slice(1);
}

function formatarNomeExibicao(bruto: string): string {
  const s = (bruto || "").trim();
  if (!s || /[a-zà-ú]/.test(s)) return s; // ja tem minusculas: respeita como esta
  const partes = s.split(/\s*-\s*/);
  // "... - UF - CEP" vira ", UF CEP"
  let sufixo = "";
  while (partes.length >= 2) {
    const ult = partes[partes.length - 1];
    if (/^\d{5}-?\d{3}$/.test(ult)) { sufixo = " " + ult + sufixo; partes.pop(); continue; }
    if (UFS.has(ult.toUpperCase()) && ult.trim().length === 2) {
      sufixo = ", " + ult.toUpperCase() + sufixo; partes.pop(); continue;
    }
    break;
  }
  const corpo = partes
    .map((seg) => seg.split(/\s+/).map((w, i) => tituloPalavra(w, i === 0)).join(" "))
    .join(" - ");
  return (corpo + sufixo).trim();
}

export default function MinhaLojaPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [data, setData] = useState<FranqueadoLoja | null>(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [ativo, setAtivo] = useState(true);
  const [autorNome, setAutorNome] = useState("");
  const [autorEmail, setAutorEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!token) return;
    franqueadoLoja(token)
      .then((d) => {
        setData(d);
        const atrs = (d.atual.atributos ?? {}) as Record<string, string>;
        const f: Record<string, string> = {};
        for (const c of CAMPOS) f[c.campo] = String((d.atual[c.campo] ?? "") as string);
        // Nome legado TODO EM MAIUSCULAS: ja mostramos formatado pro franqueado so conferir.
        f["nome"] = formatarNomeExibicao(f["nome"]);
        for (const c of CONTATOS) f[`attr:${c.chave}`] = String(atrs[c.chave] ?? "");
        for (const c of REDES) f[`attr:${c.chave}`] = String(atrs[c.chave] ?? "");
        f["attr:hashtags"] = String(atrs["hashtags"] ?? "");
        f["attr:google_meu_negocio"] = String(atrs["google_meu_negocio"] ?? "");
        setForm(f);
        setAtivo(Boolean(d.atual.ativo));
      })
      .catch(() => setErro("Link inválido ou expirado. Peça um novo à franqueadora."));
  }, [token]);

  function set(k: string, v: string) { setForm((m) => ({ ...m, [k]: v })); }

  // ── Google: o SISTEMA busca, o franqueado CONFIRMA (combinado com a rede) ──
  const [gCands, setGCands] = useState<GoogleCandidato[] | null>(null);
  const [gBusy, setGBusy] = useState(false);
  const [gOk, setGOk] = useState("");
  const [gErro, setGErro] = useState("");

  async function buscarGoogle() {
    setGBusy(true); setGErro(""); setGOk(""); setGCands(null);
    try {
      const endereco = [
        form["endereco"], form["numero"], form["bairro"],
        form["cidade"], form["uf"], form["shopping"],
      ].filter(Boolean).join(", ");
      const r = await franqueadoSugerirGoogle(token, endereco);
      if (r.erro) setGErro(r.erro);
      setGCands(r.candidatos ?? []);
    } catch (e) {
      setGErro(String((e as Error).message || e));
    } finally {
      setGBusy(false);
    }
  }
  async function confirmarGoogle(c: GoogleCandidato) {
    if (!c.place_id) return;
    setGBusy(true); setGErro("");
    try {
      await franqueadoConfirmarGoogle(token, c.place_id);
      if (c.link) set("attr:google_meu_negocio", c.link);
      setGOk(`Conectado: ${c.nome ?? "loja"}${c.nota ? ` (nota ${c.nota} · ${c.qtd ?? 0} avaliações)` : ""}`);
      setGCands(null);
    } catch (e) {
      setGErro(String((e as Error).message || e));
    } finally {
      setGBusy(false);
    }
  }

  async function enviar() {
    setErro("");
    setEnviando(true);
    try {
      await franqueadoEnviarProposta(token, {
        autor_nome: autorNome.trim() || undefined,
        autor_email: autorEmail.trim() || undefined,
        valores: { ...form }, ativo,
      });
      setEnviado(true);
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setEnviando(false);
    }
  }

  if (erro && !data) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 px-6 text-center">{erro}</div>;
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando…</div>;
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="card p-8 max-w-md text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold mb-1">Enviado para revisão!</h2>
          <p className="text-sm text-slate-500">
            A franqueadora vai revisar suas informações e aprovar. Obrigado por manter o
            cadastro de <b>{data.nome}</b> em dia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold">Cadastro da minha loja</h1>
        <p className="text-sm text-slate-500 mb-1">
          <b>{data.nome}</b>{data.sigla ? <> · <span className="font-mono text-xs">{data.sigla}</span></> : null}
        </p>
        <p className="text-xs text-slate-400 mb-5">
          Revise e corrija os dados. O endereço completo e os apelidos são o que fazem o cliente
          achar sua loja no atendimento — capriche. <b>Escreva com maiúsculas e minúsculas
          normais</b> (ex.: “Avenida Brasil, 100”) — evite TUDO EM MAIÚSCULAS.
        </p>

        {data.ja_tem_pendente && (
          <div className="card p-3 mb-4 border-amber-200 bg-amber-50 text-sm text-amber-800">
            Já existe um envio seu aguardando aprovação. Pode enviar de novo se quiser corrigir algo.
          </div>
        )}
        {erro && <div className="card p-3 mb-4 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}

        <div className={"card p-4 mb-4 border-2 " + (ativo ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50")}>
          <div className="text-sm font-bold mb-2">Esta loja está ativa?</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAtivo(true)}
              className={"px-6 py-2 rounded-lg text-sm font-bold border-2 " +
                (ativo ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-500 border-slate-300")}>
              SIM
            </button>
            <button type="button" onClick={() => setAtivo(false)}
              className={"px-6 py-2 rounded-lg text-sm font-bold border-2 " +
                (!ativo ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-500 border-slate-300")}>
              NÃO
            </button>
          </div>
          {!ativo && (
            <p className="text-xs text-red-700 mt-2">Loja inativa não aparece para os clientes.</p>
          )}
        </div>

        {ativo && (
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            {CAMPOS.map((c) => (
              <div key={c.campo} className={c.cols}>
                <label className="label">{c.rotulo}</label>
                {c.area ? (
                  <textarea className="input" rows={2} value={form[c.campo] ?? ""}
                    onChange={(e) => set(c.campo, e.target.value)} />
                ) : (
                  <input className={`input ${c.campo === "uf" ? "uppercase" : ""}`}
                    maxLength={c.campo === "uf" ? 2 : undefined}
                    value={form[c.campo] ?? ""} onChange={(e) => set(c.campo, e.target.value)} />
                )}
                {c.dica && <p className="text-xs text-slate-400 mt-1">{c.dica}</p>}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-3">
            <div className="text-sm font-semibold text-slate-700 mb-1">🔎 Buscar no Google Meu Negócio</div>
            <p className="text-xs text-slate-400 mb-2">
              Preencha o endereço acima e clique — <b>nós achamos sua loja no Google</b> e você só
              confirma. Isso conecta as avaliações do Google (Google Meu Negócio) à sua loja —
              não precisa colar link nenhum.
            </p>
            <button type="button" className="btn-secondary text-sm" onClick={buscarGoogle} disabled={gBusy}>
              {gBusy ? "Buscando…" : "Buscar minha loja no Google"}
            </button>
            {gOk && <div className="mt-2 text-sm text-green-700 font-medium">✓ {gOk}</div>}
            {gErro && <div className="mt-2 text-sm text-red-600">{gErro}</div>}
            {gCands && gCands.length === 0 && (
              <div className="mt-2 text-sm text-slate-500">
                Nenhum resultado — confira o endereço/cidade acima e tente de novo.
              </div>
            )}
            {gCands && gCands.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="text-xs text-slate-500">Qual destas é a sua loja?</div>
                {gCands.map((c, ci) => (
                  <div key={c.place_id ?? ci} className="card p-3 flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-medium">{c.nome}</div>
                      <div className="text-xs text-slate-500">{c.endereco}</div>
                      {c.nota != null && (
                        <div className="text-xs text-amber-600">★ {c.nota} · {c.qtd ?? 0} avaliações</div>
                      )}
                    </div>
                    <button type="button" className="btn-primary text-xs whitespace-nowrap"
                      disabled={gBusy} onClick={() => confirmarGoogle(c)}>
                      É esta
                    </button>
                  </div>
                ))}
                <div className="text-xs text-slate-400">Nenhuma é a sua? Ajuste o endereço acima e busque de novo.</div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-3">
            <div className="text-sm font-semibold text-slate-700 mb-1">Contato da loja</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONTATOS.map((c) => (
                <div key={c.chave}>
                  <label className="label">{c.rotulo}</label>
                  <input className="input" placeholder={c.placeholder}
                    value={form[`attr:${c.chave}`] ?? ""}
                    onChange={(e) => set(`attr:${c.chave}`, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <div className="text-sm font-semibold text-slate-700 mb-1">Páginas da loja nas redes e delivery</div>
            <p className="text-xs text-slate-400 mb-2">
              Clique em <b>Buscar</b> (à direita) para abrir a busca do próprio site, ache a página
              da <b>sua</b> loja, copie o link e cole no campo. O campo mostra um exemplo do formato.
              <b> Deixe EM BRANCO as redes que a loja não tem</b> — link errado é recusado no salvar.
            </p>
            <div className="space-y-3">
              {REDES.map((c) => (
                <div key={c.chave}>
                  <label className="label">{c.rotulo}</label>
                  <div className="flex gap-2">
                    <input className="input flex-1" placeholder={c.placeholder}
                      value={form[`attr:${c.chave}`] ?? ""}
                      onChange={(e) => set(`attr:${c.chave}`, e.target.value)} />
                    <a className="btn-secondary text-xs whitespace-nowrap self-center"
                      target="_blank" rel="noreferrer"
                      href={c.buscaUrl([data?.marca, data?.nome].filter(Boolean).join(" "))}>
                      {c.buscaRotulo} ↗
                    </a>
                  </div>
                  {c.dica && <p className="text-[11px] text-slate-400 mt-0.5">{c.dica}</p>}
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="label">Hashtags pra achar a loja nas redes e buscas (1 por linha)</label>
              <textarea className="input" rows={2} value={form["attr:hashtags"] ?? ""}
                onChange={(e) => set("attr:hashtags", e.target.value)} />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pode escrever com ou sem o símbolo # — os dois valem (ex.: minhaloja ou #minhaloja).
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Seu nome (quem preencheu)</label>
              <input className="input" value={autorNome} onChange={(e) => setAutorNome(e.target.value)} />
            </div>
            <div>
              <label className="label">Seu e-mail (opcional)</label>
              <input className="input" type="email" value={autorEmail} onChange={(e) => setAutorEmail(e.target.value)} />
            </div>
          </div>

          <button className="btn-primary" onClick={enviar} disabled={enviando}>
            {enviando ? "Salvando…" : "Salvar"}
          </button>
          <p className="text-[11px] text-slate-400 -mt-2">
            O que você salvar passa pela conferência da franqueadora antes de entrar no ar.
          </p>
        </div>
        )}

        {!ativo && (
        <div className="card p-5 space-y-4 border-red-200">
          <p className="text-sm text-red-800">
            Você marcou que esta loja <b>não está ativa</b>. Não precisa preencher o restante do
            cadastro — clique em <b>Salvar</b> para informar o encerramento à franqueadora
            (a loja sai do ar para os clientes após a conferência).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Seu nome (quem está informando)</label>
              <input className="input" value={autorNome} onChange={(e) => setAutorNome(e.target.value)} />
            </div>
            <div>
              <label className="label">Seu e-mail (opcional)</label>
              <input className="input" type="email" value={autorEmail} onChange={(e) => setAutorEmail(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary" onClick={enviar} disabled={enviando}>
            {enviando ? "Salvando…" : "Salvar"}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
