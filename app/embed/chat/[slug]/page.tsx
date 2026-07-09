"use client";

import { useParams, useSearchParams } from "next/navigation";
import ChatWidget from "../../../chat/[slug]/ChatWidget";

/** Versao p/ IFRAME (widget nos sites / WordPress): sem moldura; aceita
 *  personalizacao via querystring (?cor=...&titulo=...&saudacao=...). */
export default function EmbedChatPage() {
  const params = useParams<{ slug: string }>();
  const q = useSearchParams();
  return (
    <div className="h-[100dvh]">
      <ChatWidget slug={params?.slug ?? ""}
                  cor={q?.get("cor") ?? undefined}
                  titulo={q?.get("titulo") ?? undefined}
                  saudacao={q?.get("saudacao") ?? undefined} />
    </div>
  );
}
