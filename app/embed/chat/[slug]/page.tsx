"use client";

import { useParams } from "next/navigation";
import ChatWidget from "../../../chat/[slug]/ChatWidget";

/** Versao p/ IFRAME (widget nos sites das marcas / WordPress): sem moldura. */
export default function EmbedChatPage() {
  const params = useParams<{ slug: string }>();
  return (
    <div className="h-[100dvh]">
      <ChatWidget slug={params?.slug ?? ""} />
    </div>
  );
}
