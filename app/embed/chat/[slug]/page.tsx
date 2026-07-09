"use client";

import { useParams, useSearchParams } from "next/navigation";
import ChatWidget from "../../../chat/[slug]/ChatWidget";

/** Versao p/ IFRAME (widget nos sites / WordPress): sem moldura; aceita
 *  ?cb=ID (chatbox/roteiro) e ?cor=&titulo=&saudacao= (personalizacao). */
export default function EmbedChatPage() {
  const params = useParams<{ slug: string }>();
  const q = useSearchParams();
  const cbRaw = q?.get("cb");
  return (
    <div className="h-[100dvh]">
      <ChatWidget slug={params?.slug ?? ""}
                  cb={cbRaw ? Number(cbRaw) : undefined}
                  cor={q?.get("cor") ?? undefined}
                  titulo={q?.get("titulo") ?? undefined}
                  saudacao={q?.get("saudacao") ?? undefined}
                  pag={q?.get("pag") ?? undefined} />
    </div>
  );
}
