"use client";

import { useParams } from "next/navigation";
import ChatWidget from "./ChatWidget";

/** Pagina inteira do chat da marca (tambem serve de destino do widget). */
export default function ChatPage() {
  const params = useParams<{ slug: string }>();
  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col shadow-lg">
      <ChatWidget slug={params?.slug ?? ""} />
    </div>
  );
}
