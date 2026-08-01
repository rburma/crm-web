"use client";

// COMPRAR NA LOJA MAIS PRÓXIMA (31/07) — ponte e-commerce (Magento) -> CRM.
// O widget comprar-widget.js abre esta página com o produto/cor/tamanho e os
// dados do cliente logado na URL. Aqui: mínimo de digitação — confere os
// dados, escolhe a loja (mesma busca da abertura de atendimento) e:
//  · modo=atendimento -> abre atendimento (ou vai pro CHAT, 2ª opção)
//  · modo=whatsapp    -> abre o WhatsApp da loja com a mensagem pronta
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  publicoAbrir, publicoForm, publicoLojas,
  type LojaPublica, type PublicoMarca,
} from "@/lib/api";

const LS_CHAVE = "crm_comprar_cliente"; // lembra nome/email/tel após 1º uso

// CPF vindo do cadastro do e-commerce: o motor rejeita CPF inválido (422),
// então só anexamos se os dígitos verificadores baterem (senão descarta).
function cpfValidoOuNada(v?: string | null): string | undefined {
  const dig = (v || "").replace(/\D/g, "");
  if (dig.length !== 11 || /^(\d)\1{10}$/.test(dig)) return undefined;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(dig[i]) * (n + 1 - i);
    return ((soma * 10) % 11) % 10;
  };
  return dv(9) === Number(dig[9]) && dv(10) === Number(dig[10]) ? dig : undefined;
}

function Conteudo() {
  const p = useSearchParams();
  const slug = p.get("m") || "wt";
  const modo = p.get("modo") === "whatsapp" ? "whatsapp" : "atendimento";
  const produto = (p.get("produto") || "").slice(0, 160);
  const marcaProd = (p.get("marca") || "").slice(0, 40);
  const preco = (p.get("preco") || "").slice(0, 20);
  const urlProd = (p.get("url") || "").slice(0, 500);
  const opcsCor = (p.get("cores") || "").split("|").map((s) => s.trim()).filter(Boolean);
  const opcsTam = (p.get("tamanhos") || "").split("|").map((s) => s.trim()).filter(Boolean);

  const [marca, setMarca] = useState<PublicoMarca | null>(null);
  const [cor, setCor] = useState((p.get("cor") || "").slice(0, 60));
  const [tam, setTam] = useState((p.get("tam") || "").slice(0, 20));
  const [nome, setNome] = useState((p.get("nome") || "").slice(0, 160));
  const [email, setEmail] = useState((p.get("email") || "").slice(0, 255));
  const [tel, setTel] = useState((p.get("tel") || "").slice(0, 20));
  const [busca, setBusca] = useState("");
  const [lojas, setLojas] = useState<LojaPublica[]>([]);
  const [lojaSel, setLojaSel] = useState<LojaPublica | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState<{ numero: string } | null>(null);
  const buscaRef = useRef<number | null>(null);

  useEffect(() => {
    publicoForm(slug).then((r) => setMarca(r.marca)).catch(() => setErro("Marca não encontrada."));
    // lembra o cliente do 1º uso (reforço do preenchimento vindo do site)
    try {
      const s = JSON.parse(localStorage.getItem(LS_CHAVE) || "null") as
        { nome?: string; email?: string; tel?: string } | null;
      if (s) {
        setNome((v) => v || s.nome || "");
        setEmail((v) => v || s.email || "");
        setTel((v) => v || s.tel || "");
      }
    } catch { /* sem storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // busca de lojas — mesma da abertura de atendimento (cidade/CEP/bairro/shopping)
  useEffect(() => {
    if (buscaRef.current) window.clearTimeout(buscaRef.current);
    if (busca.trim().length < 2) { setLojas([]); return; }
    buscaRef.current = window.setTimeout(async () => {
      try {
        setLojas((await publicoLojas(slug, busca.trim())).filter((l) => l.tipo === "fisica").slice(0, 8));
      } catch { setLojas([]); }
    }, 300);
  }, [busca, slug]);

  const corTema = marca?.tema?.cor || "#0f172a";
  const resumo = [produto, cor && "Cor " + cor, tam && "Tam " + tam].filter(Boolean).join(" — ");
  const assunto = ("Comprar produto: " + resumo).slice(0, 255);

  function camposProduto(): Record<string, string> {
    const c: Record<string, string> = {};
    if (produto) c["Produto"] = produto;
    if (marcaProd) c["Marca do produto"] = marcaProd;
    if (cor) c["Cor"] = cor;
    if (tam) c["Tamanho"] = tam;
    if (preco) c["Preço no site"] = preco;
    if (urlProd) c["Link do produto"] = urlProd;
    c["Origem"] = "Loja virtual (botão comprar na loja)";
    return c;
  }

  function lembrar() {
    try { localStorage.setItem(LS_CHAVE, JSON.stringify({ nome, email, tel })); } catch { /* */ }
  }

  function validar(): string | null {
    if (!lojaSel) return "Escolha a loja mais próxima de você.";
    if (nome.trim().length < 2) return "Digite seu nome.";
    if (!/^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(email.trim())) return "E-mail inválido.";
    if (tel.replace(/\D/g, "").length < 10) return "Celular com DDD (10 ou 11 números).";
    return null;
  }

  async function abrirAtendimento() {
    const prob = validar();
    if (prob) { setErro(prob); return; }
    setEnviando(true); setErro("");
    try {
      const msg =
        "Olá! Vi este produto no site e quero comprar na loja:\n" +
        resumo + (preco ? "\nPreço no site: " + preco : "") + (urlProd ? "\n" + urlProd : "");
      const r = await publicoAbrir({
        marca_slug: slug, loja_id: lojaSel ? lojaSel.id : undefined,
        nome: nome.trim(), email: email.trim(), telefone: tel.trim(),
        cpf: cpfValidoOuNada(p.get("cpf")),
        assunto, mensagem: msg, campos: camposProduto(),
        aceita_contato: true, canal: "ecommerce",
      });
      lembrar();
      setOk({ numero: r.numero });
    } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui enviar — tente de novo."); }
    finally { setEnviando(false); }
  }

  function irParaChat() {
    lembrar();
    const q = new URLSearchParams();
    if (nome.trim()) q.set("nome", nome.trim());
    if (email.trim()) q.set("email", email.trim());
    if (tel.trim()) q.set("tel", tel.trim());
    q.set("assunto", assunto);
    q.set("ctx", JSON.stringify(camposProduto()).slice(0, 1500));
    if (lojaSel) q.set("loja_id", String(lojaSel.id));
    window.location.href = "/chat/" + encodeURIComponent(slug) + "?" + q.toString();
  }

  function abrirWhats(l: LojaPublica) {
    const txt =
      "Olá! Vi este produto no site da " + (marca?.nome || "loja") + " e quero comprar aí na loja:\n" +
      resumo + (preco ? "\nPreço no site: " + preco : "") + (urlProd ? "\n" + urlProd : "");
    const num = (l.whatsapp || "").replace(/\D/g, "");
    const ddi = num.length <= 11 ? "55" + num : num;
    window.open("https://wa.me/" + ddi + "?text=" + encodeURIComponent(txt), "_blank");
  }

  const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm";

  if (ok) {
    return (
      <main className="min-h-screen bg-slate-50">
        <header className="px-4 py-5 text-center text-white" style={{ background: corTema }}>
          <h1 className="text-lg font-extrabold">🛍 {marca?.nome || "Loja"}</h1>
        </header>
        <section className="mx-auto max-w-md p-4">
          <div className="rounded-2xl border border-emerald-300 bg-white p-5 text-center">
            <div className="text-3xl">✅</div>
            <p className="mt-2 text-sm font-bold text-emerald-700">
              Pedido enviado à loja {lojaSel?.nome}!
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Atendimento nº {ok.numero}. A loja vai te responder — as respostas
              chegam no e-mail {email} e você pode acompanhar por aqui:
            </p>
            <a className="mt-3 block w-full rounded-xl px-4 py-3 font-bold text-white"
              style={{ background: corTema }}
              href={"/acompanhar?n=" + ok.numero + "&e=" + encodeURIComponent(email)}>
              Acompanhar minha solicitação →
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <header className="px-4 py-5 text-center text-white" style={{ background: corTema }}>
        <h1 className="text-lg font-extrabold">
          {modo === "whatsapp" ? "💬 Comprar pelo WhatsApp da loja" : "🛍 Comprar na loja mais próxima"}
        </h1>
        {marca && <p className="mt-1 text-xs opacity-90">{marca.nome}</p>}
      </header>
      <section className="mx-auto max-w-md p-4">
        {erro && <div className="mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">{erro}</div>}

        <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase text-slate-400">Você quer comprar</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{produto || "Produto do site"}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {opcsCor.length > 0 && !p.get("cor") ? (
              <select className={inputCls} value={cor} onChange={(e) => setCor(e.target.value)}>
                <option value="">Cor…</option>
                {opcsCor.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : cor ? <div className="text-xs text-slate-600">Cor: <b>{cor}</b></div> : null}
            {opcsTam.length > 0 && !p.get("tam") ? (
              <select className={inputCls} value={tam} onChange={(e) => setTam(e.target.value)}>
                <option value="">Tamanho…</option>
                {opcsTam.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : tam ? <div className="text-xs text-slate-600">Tamanho: <b>{tam}</b></div> : null}
          </div>
          {preco && <p className="mt-1 text-xs text-slate-500">Preço no site: {preco}</p>}
        </div>

        <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-sm font-bold">📍 Loja mais próxima de você</p>
          {lojaSel ? (
            <div className="flex items-start justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
              <div>
                <p className="text-sm font-semibold">{lojaSel.nome}</p>
                {lojaSel.endereco && <p className="text-xs text-slate-500">{lojaSel.endereco}</p>}
              </div>
              <button className="text-xs text-slate-400 underline" onClick={() => setLojaSel(null)}>trocar</button>
            </div>
          ) : (
            <>
              <input className={inputCls} placeholder="Digite cidade, CEP, bairro ou shopping…"
                value={busca} onChange={(e) => setBusca(e.target.value)} />
              {lojas.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                  {lojas.map((l) => (
                    <button key={l.id} type="button"
                      onClick={() => { setLojaSel(l); setLojas([]); setBusca(""); }}
                      className="block w-full border-b border-slate-100 bg-white px-3 py-2.5 text-left text-sm last:border-0 hover:bg-slate-50">
                      <span className="font-semibold">{l.nome}</span>
                      {l.endereco && <span className="block text-xs text-slate-500">{l.endereco}</span>}
                      {modo === "whatsapp" && !l.whatsapp && (
                        <span className="block text-[11px] text-amber-600">sem WhatsApp cadastrado — atendimento pelo site</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {modo === "whatsapp" ? (
          lojaSel && (
            lojaSel.whatsapp ? (
              <button type="button" onClick={() => abrirWhats(lojaSel)}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 font-bold text-white">
                💬 Chamar a {lojaSel.nome} no WhatsApp →
              </button>
            ) : (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                Esta loja ainda não tem WhatsApp cadastrado. Você pode abrir um
                atendimento — a loja responde por e-mail e pelo site:
                <button type="button"
                  onClick={() => {
                    const q = new URLSearchParams(window.location.search);
                    q.set("modo", "atendimento");
                    window.location.search = q.toString();
                  }}
                  className="mt-2 block w-full rounded-xl bg-slate-900 px-4 py-3 text-center font-bold text-white">
                  Abrir atendimento com a loja →
                </button>
              </div>
            )
          )
        ) : (
          <>
            <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-sm font-bold">🙋 Seus dados</p>
              <label className="text-xs font-semibold text-slate-600">Nome</label>
              <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
              <label className="mt-2 block text-xs font-semibold text-slate-600">E-mail</label>
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label className="mt-2 block text-xs font-semibold text-slate-600">Celular (com DDD)</label>
              <input className={inputCls} inputMode="numeric" value={tel} onChange={(e) => setTel(e.target.value)} />
            </div>
            <button type="button" disabled={enviando} onClick={abrirAtendimento}
              className="w-full rounded-xl px-4 py-3.5 font-bold text-white disabled:opacity-60"
              style={{ background: corTema }}>
              {enviando ? "Enviando…" : "✔ Falar com a loja (abrir atendimento)"}
            </button>
            <button type="button" disabled={enviando} onClick={irParaChat}
              className="mt-2 w-full rounded-xl border-2 bg-white px-4 py-3 font-bold"
              style={{ borderColor: corTema, color: corTema }}>
              💬 Prefiro conversar pelo chat agora
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-400">
              Seus dados e esta solicitação ficam registrados no nosso sistema de
              atendimento (LGPD) para a loja falar com você.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

export default function ComprarPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Carregando…</div>}>
      <Conteudo />
    </Suspense>
  );
}
