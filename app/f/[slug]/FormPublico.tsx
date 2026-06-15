"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  publicoAbrir,
  publicoCampos,
  publicoForm,
  publicoLojas,
  type CampoForm,
  type PublicoMarca,
} from "@/lib/api";

/** Página PÚBLICA "Fale com a gente" — abre atendimento sem login.
 *  Tema (cor/logo) vem do cadastro da marca; campos extras por marca/loja.
 *  (Corpo client; a metadata por marca — título/OG/favicon — fica no page.tsx server.) */
export default function FormPublico() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const [marca, setMarca] = useState<PublicoMarca | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ numero: string; repetido: boolean } | null>(null);

  // loja
  const [qLoja, setQLoja] = useState("");
  const [lojas, setLojas] = useState<{ id: number; nome: string }[]>([]);
  const [loja, setLoja] = useState<{ id: number; nome: string } | null>(null);

  // campos custom da loja escolhida
  const [campos, setCampos] = useState<CampoForm[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});

  // dados fixos
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [aceite, setAceite] = useState(false);

  const cor = marca?.tema?.cor || "#0f6bd7";

  useEffect(() => {
    if (!slug) return;
    publicoForm(slug)
      .then((r) => setMarca(r.marca))
      .catch(() => setErro("Página não encontrada. Confira o endereço."));
  }, [slug]);

  useEffect(() => {
    if (!slug || loja) return;
    const t = setTimeout(() => {
      publicoLojas(slug, qLoja).then(setLojas).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [slug, qLoja, loja]);

  useEffect(() => {
    if (!slug || !loja) { setCampos([]); return; }
    publicoCampos(slug, loja.id).then(setCampos).catch(() => setCampos([]));
  }, [slug, loja]);

  async function enviar() {
    setErro("");
    if (!loja) { setErro("Escolha a loja."); return; }
    if (nome.trim().length < 2) { setErro("Preencha seu nome."); return; }
    if (!email.includes("@")) { setErro("Preencha um e-mail válido."); return; }
    if (assunto.trim().length < 2) { setErro("Preencha o assunto."); return; }
    if (!mensagem.trim()) { setErro("Escreva sua mensagem."); return; }
    const faltando = campos.filter((c) => c.obrigatorio && !(valores[c.nome] || "").trim());
    if (faltando.length > 0) { setErro(`Preencha: ${faltando.map((c) => c.nome).join(", ")}`); return; }
    if (!aceite) { setErro("Confirme que aceita ser contatado sobre este atendimento."); return; }
    setEnviando(true);
    try {
      const r = await publicoAbrir({
        marca_slug: slug, loja_id: loja.id,
        nome: nome.trim(), email: email.trim(), telefone: telefone.trim() || undefined,
        cpf: cpf.trim() || undefined,
        assunto: assunto.trim(), mensagem: mensagem.trim(),
        campos: valores, aceita_contato: aceite,
      });
      setResultado({ numero: r.numero, repetido: r.repetido });
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setEnviando(false);
    }
  }

  if (erro && !marca) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">{erro}</div>;
  }
  if (!marca) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando…</div>;
  }

  // ── confirmação ──
  if (resultado) {
    return (
      <PubLayout marca={marca} cor={cor}>
        <div className="text-center py-10">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-2">
            {resultado.repetido ? "Já recebemos este atendimento!" : "Atendimento criado!"}
          </h2>
          <p className="text-slate-600 mb-1">Seu número de acompanhamento:</p>
          <p className="text-3xl font-bold tracking-wide mb-6" style={{ color: cor }}>
            #{resultado.numero}
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Guarde este número. Para ver as respostas da nossa equipe, acesse o
            acompanhamento com o número + seu e-mail.
          </p>
          <Link
            href={`/acompanhar?n=${encodeURIComponent(resultado.numero)}&e=${encodeURIComponent(email.trim())}`}
            className="inline-block text-white font-semibold rounded-lg px-5 py-2.5"
            style={{ background: cor }}
          >
            Acompanhar meu atendimento
          </Link>
        </div>
      </PubLayout>
    );
  }

  // ── formulário ──
  return (
    <PubLayout marca={marca} cor={cor}>
      <h2 className="text-lg font-bold mb-1">{marca.tema?.titulo || "Fale com a gente"}</h2>
      <p className="text-sm text-slate-500 mb-5">
        {marca.tema?.boas_vindas || "Conte o que aconteceu e nossa equipe responde por aqui e por e-mail."}
      </p>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{erro}</div>}

      <label className="label">Loja / Departamento *</label>
      {loja ? (
        <div className="flex items-center justify-between input mb-3" style={{ borderColor: cor }}>
          <span className="truncate text-sm">{loja.nome}</span>
          <button className="text-xs text-slate-500 hover:underline ml-2" onClick={() => { setLoja(null); setQLoja(""); }}>
            trocar
          </button>
        </div>
      ) : (
        <div className="relative mb-3">
          <input className="input" placeholder={marca.tema?.ph_loja || '🔎 Digite para buscar… (ex.: "Iguatemi", "Loja Virtual")'}
            value={qLoja} onChange={(e) => setQLoja(e.target.value)} />
          {lojas.length > 0 && qLoja.trim() !== "" && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
              {lojas.map((l) => (
                <button key={l.id} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => setLoja(l)}>
                  {l.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Seu nome *</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><label className="label">E-mail *</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div><label className="label">Telefone / WhatsApp</label>
          <input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
        <div><label className="label">CPF (ajuda a localizar seu cadastro)</label>
          <input className="input" value={cpf} onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00" /></div>
      </div>
      <div className="mt-3">
        <label className="label">Assunto *</label>
        <input className="input" value={assunto} onChange={(e) => setAssunto(e.target.value)}
          placeholder={marca.tema?.ph_assunto || "Ex.: troca de produto, pedido nº…"} />
      </div>
      <div className="mt-3">
        <label className="label">Mensagem *</label>
        <textarea className="input" rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value)}
          placeholder="Conte o que aconteceu…" />
      </div>

      {campos.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Mais informações</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campos.map((c) => (
              <div key={c.id}>
                <label className="label">{c.nome}{c.obrigatorio ? " *" : ""}</label>
                <input className="input" value={valores[c.nome] ?? ""}
                  onChange={(e) => setValores({ ...valores, [c.nome]: e.target.value })} />
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-slate-600 mt-4">
        <input type="checkbox" className="mt-0.5" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
        {marca.tema?.consent || "Aceito ser contatado sobre este atendimento (e-mail/WhatsApp) — LGPD."}
      </label>

      <div className="mt-5">
        <button onClick={enviar} disabled={enviando}
          className="text-white font-semibold rounded-lg px-6 py-2.5 disabled:opacity-50"
          style={{ background: cor }}>
          {enviando ? "Enviando…" : "Enviar atendimento"}
        </button>
        <Link href="/acompanhar" className="ml-4 text-sm text-slate-500 hover:underline">
          Já abri — quero acompanhar
        </Link>
      </div>
    </PubLayout>
  );
}

function PubLayout({ marca, cor, children }: {
  marca: PublicoMarca; cor: string; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen py-8 px-4"
      style={{ background: `linear-gradient(180deg, ${cor}26 0%, ${cor}0d 180px, #f3f5f9 420px)` }}>
      <div className="fixed top-0 left-0 right-0 h-1.5 z-10" style={{ background: cor }} />
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          {marca.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/render/${marca.logo_path}`} alt={marca.nome ?? marca.slug}
              className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200" />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-lg"
              style={{ background: cor }}>
              {(marca.nome ?? marca.slug).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-lg leading-tight">{marca.nome ?? marca.slug}</div>
            <div className="text-xs text-slate-500">{marca.tema?.subtitulo || "Atendimento ao cliente"}</div>
          </div>
        </div>
        <div className="card p-6">{children}</div>
        <p className="text-center text-xs text-slate-400 mt-4">
          {marca.tema?.rodape || `Atendimento ${marca.nome ?? ""} · seus dados são usados somente para este contato.`}
        </p>
      </div>
    </div>
  );
}
