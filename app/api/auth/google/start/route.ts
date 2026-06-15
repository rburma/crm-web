import { NextResponse } from "next/server";

// Início do "Entrar com Google": redireciona pro consentimento do Google.
// O e-mail verificado volta no /callback. NÃO há senha em lugar nenhum.
export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const SITE_BASE = (
  process.env.SITE_BASE ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://contactcenter.com.br"
).replace(/\/$/, "");

export function GET() {
  if (!CLIENT_ID) {
    return NextResponse.redirect(`${SITE_BASE}/login?erro=google-nao-configurado`);
  }
  const state = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", `${SITE_BASE}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  const res = NextResponse.redirect(url.toString());
  // state anti-CSRF (conferido no callback).
  res.cookies.set("g_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });
  return res;
}
