"use client";

import { useParams, useSearchParams } from "next/navigation";
import ChatWidget, { type ChatPre } from "./ChatWidget";

/** Pagina inteira do chat da marca (aceita ?cb=ID p/ usar um chatbox).
 * 31/07: aceita tambem dados PRE-preenchidos vindos do e-commerce (botao
 * comprar-na-loja): nome/email/tel/assunto/ctx(campos JSON)/loja_id — o
 * roteiro do bot pula o que ja sabe. */
export default function ChatPage() {
  const params = useParams<{ slug: string }>();
  const q = useSearchParams();
  const cbRaw = q?.get("cb");
  let campos: Record<string, string> | undefined;
  try {
    const ctx = q?.get("ctx");
    if (ctx) campos = JSON.parse(ctx) as Record<string, string>;
  } catch { campos = undefined; }
  const lojaRaw = q?.get("loja_id");
  const pre: ChatPre | undefined =
    (q?.get("nome") || q?.get("email") || q?.get("tel") || q?.get("assunto") || campos || lojaRaw)
      ? {
        nome: q?.get("nome") || undefined,
        email: q?.get("email") || undefined,
        telefone: q?.get("tel") || undefined,
        assunto: q?.get("assunto") || undefined,
        campos,
        lojaId: lojaRaw ? Number(lojaRaw) : undefined,
        faltaVariacao: q?.get("falta") === "1",
        cpf: q?.get("cpf") || undefined,
        cep: q?.get("cep") || undefined,
        cidade: q?.get("cidade") || undefined,
      }
      : undefined;
  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col shadow-lg">
      <ChatWidget slug={params?.slug ?? ""} cb={cbRaw ? Number(cbRaw) : undefined} pre={pre} />
    </div>
  );
}
