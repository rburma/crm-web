"use client";

// Chat da MARCA (widget embutivel): o bot coleta loja -> nome -> e-mail -> LGPD
// -> mensagem, cria o atendimento (canal "chat") e vira conversa ao vivo com a
// loja (polling). Reusa TODA a mecanica publica do form/acompanhar (identity,
// flood, LGPD). Usado por /chat/{slug} e /embed/chat/{slug} (iframe do site).
import { useEffect, useRef, useState } from "react";
import {
  publicoAbrir,
  publicoAcompanhar,
  publicoForm,
  publicoLojas,
  publicoResponder,
  type LojaPublica,
  type PublicoMarca,
} from "@/lib/api";

type Msg = { autor: "bot" | "cliente" | "loja"; texto: string; hora?: string };
type Etapa = "loja" | "nome" | "email" | "lgpd" | "mensagem" | "conversa";

function agora(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatWidget({ slug, cor: corProp, titulo, saudacao }: { slug: string; cor?: string; titulo?: string; saudacao?: string }) {
  const [marca, setMarca] = useState<PublicoMarca | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("loja");
  const [balões, setBaloes] = useState<Msg[]>([]);
  const [entrada, setEntrada] = useState("");
  const [lojas, setLojas] = useState<LojaPublica[]>([]);
  const [lojaSel, setLojaSel] = useState<LojaPublica | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [numero, setNumero] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement | null>(null);
  const buscaRef = useRef<number | null>(null);
  const chave = "chat_" + slug;

  function bot(texto: string) {
    setBaloes((b) => [...b, { autor: "bot", texto, hora: agora() }]);
  }
  function eu(texto: string) {
    setBaloes((b) => [...b, { autor: "cliente", texto, hora: agora() }]);
  }

  useEffect(() => {
    (async () => {
      try { setMarca((await publicoForm(slug)).marca); } catch { setErro("Marca não encontrada."); return; }
      // conversa anterior deste navegador? retoma direto.
      try {
        const salvo = JSON.parse(localStorage.getItem(chave) || "null");
        if (salvo && salvo.numero && salvo.email) {
          setNumero(salvo.numero); setEmail(salvo.email);
          setEtapa("conversa");
          return;
        }
      } catch { /* começa do zero */ }
      bot(saudacao || "Olá! 👋 Que bom te ver por aqui. Para falar com a loja mais próxima, me diga a sua cidade, o shopping ou o nome da loja:");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [balões, lojas]);

  // autocomplete de lojas enquanto digita (etapa loja)
  useEffect(() => {
    if (etapa !== "loja") return;
    if (buscaRef.current) window.clearTimeout(buscaRef.current);
    if (entrada.trim().length < 2) { setLojas([]); return; }
    buscaRef.current = window.setTimeout(async () => {
      try { setLojas((await publicoLojas(slug, entrada.trim())).filter((l) => l.tipo === "fisica").slice(0, 6)); }
      catch { setLojas([]); }
    }, 300);
  }, [entrada, etapa, slug]);

  // polling da conversa (etapa conversa)
  useEffect(() => {
    if (etapa !== "conversa" || !numero || !email) return;
    let vivo = true;
    async function puxar() {
      try {
        const c = await publicoAcompanhar(numero, email);
        if (!vivo) return;
        const msgs: Msg[] = (c.mensagens || []).map((m) => ({
          autor: m.autor === "voce" ? "cliente" : "loja",
          texto: m.texto,
          hora: m.criado_em ? new Date(m.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined,
        }));
        setBaloes(msgs);
      } catch { /* rede oscilou; tenta no proximo tick */ }
    }
    puxar();
    const timer = window.setInterval(puxar, 4000);
    return () => { vivo = false; window.clearInterval(timer); };
  }, [etapa, numero, email]);

  function escolherLoja(l: LojaPublica) {
    setLojaSel(l); setLojas([]); setEntrada("");
    eu(l.nome + (l.cidade ? " — " + l.cidade + (l.uf ? "/" + l.uf : "") : ""));
    bot("Perfeito! E qual é o seu nome?");
    setEtapa("nome");
  }

  async function enviar() {
    const txt = entrada.trim();
    if (!txt || enviando) return;
    setErro("");
    if (etapa === "nome") {
      if (txt.length < 2) { setErro("Digite seu nome completo."); return; }
      setNome(txt); eu(txt); setEntrada("");
      bot("Prazer, " + txt.split(" ")[0] + "! Qual o seu e-mail? (é por ele que você recebe as respostas se sair desta página)");
      setEtapa("email");
      return;
    }
    if (etapa === "email") {
      if (!/^[^@ ]+@[^@ ]+.[^@ ]+$/.test(txt)) { setErro("E-mail inválido — confere pra mim?"); return; }
      setEmail(txt.toLowerCase()); eu(txt); setEntrada("");
      bot("Para te atender, registramos seus dados e esta conversa no nosso sistema (LGPD). Pode ser?");
      setEtapa("lgpd");
      return;
    }
    if (etapa === "mensagem") {
      setEnviando(true);
      try {
        const r = await publicoAbrir({
          marca_slug: slug, loja_id: lojaSel ? lojaSel.id : undefined,
          nome, email, assunto: "Chat com a loja", mensagem: txt,
          aceita_contato: true, canal: "chat",
        });
        localStorage.setItem(chave, JSON.stringify({ numero: r.numero, email }));
        setNumero(r.numero); setEntrada("");
        setEtapa("conversa");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não consegui enviar — tente de novo.");
      }
      setEnviando(false);
      return;
    }
    if (etapa === "conversa") {
      setEnviando(true);
      try {
        await publicoResponder(numero, email, txt);
        setBaloes((b) => [...b, { autor: "cliente", texto: txt, hora: agora() }]);
        setEntrada("");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não consegui enviar — tente de novo.");
      }
      setEnviando(false);
    }
  }

  function aceitarLgpd() {
    eu("Aceito ✓");
    bot("Ótimo! Pode escrever sua mensagem que eu já chamo a loja 😊");
    setEtapa("mensagem");
  }

  const cor = corProp || marca?.tema?.cor || "#0f172a";
  const podeDigitar = etapa === "loja" || etapa === "nome" || etapa === "email" || etapa === "mensagem" || etapa === "conversa";

  return (
    <div className="flex h-full min-h-[420px] flex-col bg-white">
      <div className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: cor }}>
        <span className="text-lg">💬</span>
        <div className="grow">
          <div className="text-sm font-semibold">{titulo || marca?.nome || marca?.slug || "Atendimento"}</div>
          <div className="text-[11px] opacity-80">
            {lojaSel ? "Você fala com: " + lojaSel.nome : etapa === "conversa" ? "Conversa nº " + numero : "Fale com a sua loja"}
          </div>
        </div>
        {etapa === "conversa" ? (
          <button className="rounded px-2 py-0.5 text-[10px] opacity-80 hover:opacity-100"
                  title="Começar uma nova conversa"
                  onClick={() => { localStorage.removeItem(chave); window.location.reload(); }}>
            nova conversa
          </button>
        ) : null}
      </div>

      <div className="grow space-y-2 overflow-y-auto bg-slate-50 p-3">
        {balões.map((m, i) => (
          <div key={i} className={"flex " + (m.autor === "cliente" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[85%] rounded-2xl px-3 py-1.5 text-sm shadow-sm " +
                            (m.autor === "cliente" ? "rounded-br-sm text-white" : "rounded-bl-sm border border-slate-200 bg-white text-slate-800")}
                 style={m.autor === "cliente" ? { background: cor } : undefined}>
              {m.autor === "loja" ? <div className="text-[10px] font-semibold opacity-60">Loja</div> : null}
              <div className="whitespace-pre-wrap">{m.texto}</div>
              {m.hora ? <div className="text-right text-[9px] opacity-50">{m.hora}</div> : null}
            </div>
          </div>
        ))}
        {etapa === "loja" && lojas.length ? (
          <div className="space-y-1">
            {lojas.map((l) => (
              <button key={l.id} onClick={() => escolherLoja(l)}
                      className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-xs hover:border-slate-400">
                <span className="font-medium text-slate-800">{l.nome}</span>
                <span className="text-slate-500"> {l.shopping ? "· " + l.shopping : ""} {l.cidade ? "· " + l.cidade + (l.uf ? "/" + l.uf : "") : ""}</span>
              </button>
            ))}
          </div>
        ) : null}
        {etapa === "lgpd" ? (
          <button onClick={aceitarLgpd}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow" style={{ background: cor }}>
            Aceito continuar ✓
          </button>
        ) : null}
        {etapa === "conversa" && !balões.some((m) => m.autor === "loja") ? (
          <div className="text-center text-[11px] text-slate-400">Sua mensagem chegou na loja 🛎 — se você sair, a resposta também vai para o seu e-mail.</div>
        ) : null}
        <div ref={fimRef} />
      </div>

      {erro ? <div className="bg-red-50 px-3 py-1 text-xs text-red-700">{erro}</div> : null}
      {podeDigitar ? (
        <div className="flex gap-2 border-t border-slate-200 p-2">
          <input value={entrada} onChange={(e) => setEntrada(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
                 placeholder={etapa === "loja" ? "cidade, shopping ou loja…" : etapa === "nome" ? "seu nome…" : etapa === "email" ? "seu e-mail…" : "escreva sua mensagem…"}
                 className="grow rounded-full border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500" />
          <button onClick={enviar} disabled={enviando}
                  className="rounded-full px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: cor }}>
            {enviando ? "…" : "Enviar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
