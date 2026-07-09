"use client";

import { useParams, useSearchParams } from "next/navigation";
import ChatWidget from "./ChatWidget";

/** Pagina inteira do chat da marca (aceita ?cb=ID p/ usar um chatbox). */
export default function ChatPage() {
  const params = useParams<{ slug: string }>();
  const q = useSearchParams();
  const cbRaw = q?.get("cb");
  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col shadow-lg">
      <ChatWidget slug={params?.slug ?? ""} cb={cbRaw ? Number(cbRaw) : undefined} />
    </div>
  );
}
