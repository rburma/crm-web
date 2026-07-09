"use client";

// Chat da MARCA (widget embutivel). Roteiro do bot (ordem Renato 10/07):
// loja -> NOME -> TELEFONE/WhatsApp -> ASSUNTO -> E-MAIL -> perguntas EXTRAS
// (do chatbox da landing page) -> LGPD -> mensagem -> conversa ao vivo.
// Chatbox (?cb=ID) personaliza saudacao/titulo/cor/assunto fixo/extras.
// Ao "Resolvido", encerra no CRM e o convite de avaliacao sai por e-mail.
import { useEffect, useRef, useState } from "react";
import {
  publicoAbrir,
  publicoAcompanhar,
  publicoChatbox,
  publicoEncerrar,
  publicoForm,
  publicoLojas,
  publicoResponder,
  type ChatboxConfig,
  type LojaPublica,
  type PublicoMarca,
} from "@/lib/api";

type Msg = { autor: "bot" | "cliente" | "loja"; texto: string; hora?: string };

function agora(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatWidget({ slug, cb, cor: corProp, titulo, saudacao, pag }:
  { slug: string; cb?: number; cor?: string; titulo?: string; saudacao?: string; pag?: string }) {
  const [marca, setMarca] = useState<PublicoMarca | null>(null);
  const [box, setBox] = useState<ChatboxConfig | null>(null);
  const [balões, setBaloes] = useState<Msg[]>([]);
  const [entrada, setEntrada] = useState("");
  const [lojas, setLojas] = useState<LojaPublica[]>([]);
  const [lojaSel, setLojaSel] = useState<LojaPublica | null>(null);
  const [passo, setPasso] = useState(0);      // indice no roteiro
  const [roteiro, setRoteiro] = useState<string[]>(["loja"]);
  const [resp, setResp] = useState<Record<string, string>>({});
  const [numero, setNumero] = useState("");
  const [encerrada, setEncerrada] = useState(false);
  // pergunta de RETORNO (telefone/WhatsApp) enquanto a loja nao responde
  const [perguntaRetorno, setPerguntaRetorno] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement | null>(null);
  const buscaRef = useRef<number | null>(null);
  const chave = "chat_" + slug + (cb ? "_" + cb : "");

  const etapa = roteiro[passo] || "conversa";
  const extras: { rotulo: string; obrigatorio?: boolean }[] = box?.extras ?? [];

  const [digitandoBot, setDigitandoBot] = useState(false);
  // Bot "pensa" antes de responder (pedido Renato 10/07): mostra os 3 pontinhos
  // balançando por ~1-2s (proporcional ao tamanho da resposta) e só então fala.
  function bot(texto: string) {
    setDigitandoBot(true);
    const espera = Math.min(1400 + texto.length * 22, 3200);
    window.setTimeout(() => {
      setBaloes((b) => [...b, { autor: "bot", texto, hora: agora() }]);
      setDigitandoBot(false);
    }, espera);
  }
  function eu(texto: string) { setBaloes((b) => [...b, { autor: "cliente", texto, hora: agora() }]); }

  useEffect(() => {
    (async () => {
      let cfg: ChatboxConfig | null = null;
      try { setMarca((await publicoForm(slug)).marca); } catch { setErro("Marca não encontrada."); return; }
      if (cb) {
        try { cfg = (await publicoChatbox(slug, cb)).config; setBox(cfg); } catch { /* roteiro padrão */ }
      }
      // monta o ROTEIRO: loja -> nome -> telefone -> assunto? -> email -> extras -> lgpd -> mensagem
      const r: string[] = ["loja", "nome", "telefone"];
      if (!(cfg?.assunto_fixo) && cfg?.perguntar_assunto !== false) r.push("assunto");
      r.push("email");
      (cfg?.extras ?? []).forEach((_x, i) => r.push("extra:" + i));
      r.push("lgpd", "mensagem", "conversa");
      setRoteiro(r);
      try {
        const salvo = JSON.parse(localStorage.getItem(chave) || "null");
        if (salvo && salvo.numero && salvo.email) {
          setNumero(salvo.numero); setResp((x) => ({ ...x, email: salvo.email }));
          setPasso(r.length - 1);  // direto p/ conversa
          return;
        }
      } catch { /* zera */ }
      bot((cfg?.saudacao || saudacao) || "Olá! 👋 Que bom te ver por aqui. Para falar com a loja mais próxima, me diga a sua cidade, o shopping ou o nome da loja:");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, cb]);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [balões, lojas, digitandoBot]);

  // autocomplete de lojas (etapa loja)
  useEffect(() => {
    if (etapa !== "loja") return;
    if (buscaRef.current) window.clearTimeout(buscaRef.current);
    if (entrada.trim().length < 2) { setLojas([]); return; }
    buscaRef.current = window.setTimeout(async () => {
      try { setLojas((await publicoLojas(slug, entrada.trim())).filter((l) => l.tipo === "fisica").slice(0, 6)); }
      catch { setLojas([]); }
    }, 300);
  }, [entrada, etapa, slug]);

  // polling da conversa
  useEffect(() => {
    if (etapa !== "conversa" || !numero || !resp.email) return;
    let vivo = true;
    async function puxar() {
      try {
        const c = await publicoAcompanhar(numero, resp.email);
        if (!vivo) return;
        setBaloes((c.mensagens || []).map((m) => ({
          autor: m.autor === "voce" ? "cliente" : "loja",
          texto: m.texto,
          hora: m.criado_em ? new Date(m.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined,
        })));
      } catch { /* proximo tick */ }
    }
    puxar();
    const timer = window.setInterval(puxar, 4000);
    return () => { vivo = false; window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, numero, resp.email]);

  function avancar(prox?: number) { setPasso((p2) => prox ?? p2 + 1); }

  // Loja demorando? Oferece RETORNO por telefone/WhatsApp (grava no atendimento).
  useEffect(() => {
    if (etapa !== "conversa" || !numero || encerrada) return;
    if (localStorage.getItem(chave + "_ret")) return;      // ja perguntou nesta conversa
    if (balões.some((m) => m.autor === "loja")) return;     // loja ja respondeu
    const t2 = window.setTimeout(() => {
      if (!balões.some((m) => m.autor === "loja")) setPerguntaRetorno(true);
    }, 45000);
    return () => window.clearTimeout(t2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, numero, balões, encerrada]);

  async function escolherRetorno(como: "telefone" | "whatsapp" | "aqui") {
    setPerguntaRetorno(false);
    localStorage.setItem(chave + "_ret", "1");
    if (como === "aqui") return;
    const fone = resp.telefone ? " no número " + resp.telefone : "";
    const txt = como === "telefone"
      ? "📞 Prefiro que a loja me LIGUE de volta" + fone + "."
      : "💬 Prefiro retorno pelo WHATSAPP" + fone + ".";
    try { await publicoResponder(numero, resp.email, txt); } catch { /* fica so local */ }
    setBaloes((b) => [...b, { autor: "cliente", texto: txt, hora: agora() }]);
  }

  function perguntaDe(et: string): string {
    const nome1 = (resp.nome || "").split(" ")[0];
    if (et === "nome") return "Perfeito! Qual é o seu nome?";
    if (et === "telefone") return "Prazer" + (nome1 ? ", " + nome1 : "") + "! Qual o seu telefone/WhatsApp com DDD?";
    if (et === "assunto") return "Sobre o que você quer falar? (assunto em poucas palavras)";
    if (et === "email") return "E o seu e-mail? (é por ele que você recebe as respostas se sair da página)";
    if (et.startsWith("extra:")) {
      const ex = extras[Number(et.slice(6))];
      return ex ? ex.rotulo + (ex.obrigatorio ? "" : " (se preferir, responda \"pular\")") : "";
    }
    if (et === "lgpd") return "Para te atender, registramos seus dados e esta conversa no nosso sistema (LGPD). Pode ser?";
    if (et === "mensagem") return "Pode escrever sua mensagem que eu já chamo a loja 😊";
    return "";
  }

  function escolherLoja(l: LojaPublica) {
    setLojaSel(l); setLojas([]); setEntrada("");
    eu(l.nome + (l.cidade ? " — " + l.cidade + (l.uf ? "/" + l.uf : "") : ""));
    bot(perguntaDe("nome"));
    avancar();
  }

  function validar(et: string, txt: string): string | null {
    if (et === "nome" && txt.length < 2) return "Digite seu nome completo.";
    if (et === "telefone" && txt.replace(/[^0-9]/g, "").length < 10) return "Telefone com DDD, por favor (10 ou 11 números).";
    if (et === "assunto" && txt.length < 2) return "Me diga o assunto em poucas palavras.";
    if (et === "email" && !/^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(txt)) return "E-mail inválido — confere pra mim?";
    if (et.startsWith("extra:")) {
      const ex = extras[Number(et.slice(6))];
      if (ex?.obrigatorio && txt.length < 1) return "Preciso dessa informação para a loja te atender.";
    }
    return null;
  }

  async function enviar() {
    const txt = entrada.trim();
    if (!txt || enviando) return;
    setErro("");
    if (etapa === "conversa") {
      setEnviando(true);
      try {
        await publicoResponder(numero, resp.email, txt);
        setBaloes((b) => [...b, { autor: "cliente", texto: txt, hora: agora() }]);
        setEntrada(""); setEncerrada(false);
      } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui enviar — tente de novo."); }
      setEnviando(false);
      return;
    }
    if (etapa === "mensagem") {
      setEnviando(true);
      try {
        const campos: Record<string, string> = {};
        extras.forEach((ex, i) => { const v = resp["extra:" + i]; if (v && v.toLowerCase() !== "pular") campos[ex.rotulo.slice(0, 60)] = v; });
        const origem = pag || (typeof document !== "undefined" ? document.referrer : "");
        if (origem) campos["Página de origem"] = origem.slice(0, 255);
        const r = await publicoAbrir({
          marca_slug: slug, loja_id: lojaSel ? lojaSel.id : undefined,
          nome: resp.nome, email: resp.email, telefone: resp.telefone,
          assunto: (box?.assunto_fixo || resp.assunto || "Chat com a loja").slice(0, 255),
          mensagem: txt, campos, aceita_contato: true, canal: "chat",
        });
        localStorage.setItem(chave, JSON.stringify({ numero: r.numero, email: resp.email }));
        setNumero(r.numero); setEntrada("");
        avancar();
      } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui enviar — tente de novo."); }
      setEnviando(false);
      return;
    }
    // etapas de coleta (nome/telefone/assunto/email/extras)
    const problema = validar(etapa, txt);
    if (problema) { setErro(problema); return; }
    setResp((x) => ({ ...x, [etapa]: txt }));
    eu(txt); setEntrada("");
    const prox = roteiro[passo + 1];
    bot(perguntaDe(prox));
    avancar();
  }

  function aceitarLgpd() {
    eu("Aceito ✓");
    bot(perguntaDe("mensagem"));
    avancar();
  }

  async function resolvido() {
    if (!numero || !resp.email) return;
    try {
      await publicoEncerrar(numero, resp.email);
      setEncerrada(true);
      setBaloes((b) => [...b, { autor: "bot", texto: "Que bom que resolvemos! ✅ Enviamos um e-mail para você avaliar o atendimento. Se precisar de novo, é só escrever aqui que a conversa reabre.", hora: agora() }]);
    } catch { setErro("Não consegui encerrar — tente de novo."); }
  }

  const cor = box?.cor || corProp || marca?.tema?.cor || "#0f172a";
  const cab = box?.titulo || titulo || marca?.nome || marca?.slug || "Atendimento";
  const podeDigitar = etapa !== "lgpd";
  const placeholder =
    etapa === "loja" ? "cidade, shopping ou loja…" :
    etapa === "nome" ? "seu nome…" :
    etapa === "telefone" ? "DDD + número (WhatsApp)…" :
    etapa === "assunto" ? "assunto…" :
    etapa === "email" ? "seu e-mail…" :
    etapa.startsWith("extra:") ? "sua resposta…" : "escreva sua mensagem…";

  return (
    <div className="flex h-full min-h-[420px] flex-col bg-white">
      <div className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: cor }}>
        <span className="text-lg">💬</span>
        <div className="grow">
          <div className="text-sm font-semibold">{cab}</div>
          <div className="text-[11px] opacity-80">
            {lojaSel ? "Você fala com: " + lojaSel.nome : etapa === "conversa" ? "Conversa nº " + numero : "Fale com a sua loja"}
          </div>
        </div>
        {etapa === "conversa" && !encerrada ? (
          <button className="rounded bg-white/15 px-2 py-1 text-[10px] font-semibold hover:bg-white/25"
                  title="Encerra o atendimento e envia o convite de avaliação" onClick={resolvido}>
            ✔ Resolvido
          </button>
        ) : null}
        {etapa === "conversa" ? (
          <button className="rounded px-2 py-0.5 text-[10px] opacity-80 hover:opacity-100" title="Começar uma nova conversa"
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
          <button onClick={aceitarLgpd} className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow" style={{ background: cor }}>
            Aceito continuar ✓
          </button>
        ) : null}
        {etapa === "conversa" && !balões.some((m) => m.autor === "loja") ? (
          <div className="text-center text-[11px] text-slate-400">Sua mensagem chegou na loja 🛎 — se você sair, a resposta também vai para o seu e-mail.</div>
        ) : null}
        {perguntaRetorno ? (
          <div className="flex justify-start">
            <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
              <div>A loja vai te atender em breve 😊 Enquanto isso: se preferir, ela pode te retornar. Como fica melhor para você?</div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => escolherRetorno("telefone")} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-50">📞 Me liguem</button>
                <button onClick={() => escolherRetorno("whatsapp")} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-50">💬 WhatsApp</button>
                <button onClick={() => escolherRetorno("aqui")} className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50">Espero aqui</button>
              </div>
            </div>
          </div>
        ) : null}
        {digitandoBot ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="inline-flex items-center gap-[4px]">
                {[0, 1, 2].map((d) => (
                  <i key={d} className="inline-block h-[7px] w-[7px] animate-bounce rounded-full bg-slate-400"
                     style={{ animationDelay: d * 0.15 + "s", animationDuration: "1.1s" }} />
                ))}
              </span>
            </div>
          </div>
        ) : null}
        <div ref={fimRef} />
      </div>

      {erro ? <div className="bg-red-50 px-3 py-1 text-xs text-red-700">{erro}</div> : null}
      {podeDigitar ? (
        <div className="flex gap-2 border-t border-slate-200 p-2">
          <input value={entrada} onChange={(e) => setEntrada(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
                 placeholder={placeholder}
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
