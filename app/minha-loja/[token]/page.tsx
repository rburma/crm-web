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
    dica: 'Use o padrão simples — ex.: "Shopping Iguatemi - São Paulo, SP" ou "R. Augusta, 1200 - São Paulo, SP".',
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
const CONTATOS: { chave: string; rotulo: string; area?: boolean; dica?: string }[] = [
  { chave: "telefone", rotulo: "Telefone da loja" },
  { chave: "whatsapp", rotulo: "WhatsApp de atendimento da loja" },
  { chave: "site_loja", rotulo: "Link da página da loja no site da marca" },
  { chave: "google_meu_negocio", rotulo: "Link da página no Google Meu Negócio" },
  { chave: "instagram", rotulo: "Link do Instagram da loja", dica: "Ex.: @sualoja ou instagram.com/sualoja" },
  { chave: "facebook", rotulo: "Link do Facebook da loja", dica: "Use a PAGINA (facebook.com/nomedapagina) — perfil pessoal nao vale" },
  { chave: "tiktok", rotulo: "Link do TikTok da loja", dica: "Ex.: @sualoja ou tiktok.com/@sualoja" },
  { chave: "tripadvisor", rotulo: "Link no TripAdvisor" },
  { chave: "reclame_aqui", rotulo: "Link no Reclame Aqui" },
  { chave: "trustpilot", rotulo: "Link no Trustpilot" },
  { chave: "ifood", rotulo: "Link no iFood", dica: "Abra a SUA loja no iFood e copie o endereco (ifood.com.br/delivery/...)" },
  { chave: "hashtags", rotulo: "Hashtags pra achar a loja nas redes e buscas (1 por linha)", area: true },
];

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
        for (const c of CONTATOS) f[`attr:${c.chave}`] = String(atrs[c.chave] ?? "");
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
          achar sua loja no atendimento — capriche. <b>Suas alterações vão para a aprovação da
          franqueadora</b> antes de entrar no ar.
        </p>

        {data.ja_tem_pendente && (
          <div className="card p-3 mb-4 border-amber-200 bg-amber-50 text-sm text-amber-800">
            Já existe um envio seu aguardando aprovação. Pode enviar de novo se quiser corrigir algo.
          </div>
        )}
        {erro && <div className="card p-3 mb-4 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}

        <div className="card p-5 space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Loja <b>{ativo ? "ativa" : "inativa"}</b> (inativa não aparece para os clientes)
          </label>

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
            <div className="text-sm font-semibold text-slate-700 mb-1">🔎 Google da loja</div>
            <p className="text-xs text-slate-400 mb-2">
              Preencha o endereço acima e clique — <b>nós achamos sua loja no Google</b> e você só
              confirma. Isso conecta as avaliações do Google à sua loja.
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
            <div className="text-sm font-semibold text-slate-700 mb-1">Contato e links da loja</div>
            <p className="text-xs text-slate-400 mb-2">
              O atendimento é feito pelo sistema — não exibimos e-mail da loja. Telefone/WhatsApp e
              os links abaixo ajudam o cliente e a busca. <b>Deixe EM BRANCO as redes que a loja
              não tem</b> — link errado é recusado na hora do envio.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONTATOS.map((c) => (
                <div key={c.chave} className={c.area ? "sm:col-span-2" : ""}>
                  <label className="label">{c.rotulo}</label>
                  {c.area ? (
                    <textarea className="input" rows={2} value={form[`attr:${c.chave}`] ?? ""}
                      onChange={(e) => set(`attr:${c.chave}`, e.target.value)} />
                  ) : (
                    <input className="input" value={form[`attr:${c.chave}`] ?? ""}
                      onChange={(e) => set(`attr:${c.chave}`, e.target.value)} />
                  )}
                  {c.dica && <p className="text-[11px] text-slate-400 mt-0.5">{c.dica}</p>}
                </div>
              ))}
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
            {enviando ? "Enviando…" : "Enviar para aprovação"}
          </button>
        </div>
      </div>
    </div>
  );
}
