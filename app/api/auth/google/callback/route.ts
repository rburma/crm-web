import { NextRequest, NextResponse } from "next/server";

// Retorno do Google: troca o code por tokens, pega o e-mail VERIFICADO e pede ao
// motor uma sessão (POST /auth/google, provando ser o proxy via X-Proxy-Secret).
// O motor só libera se o e-mail bater com um USUÁRIO ativo do CRM (não por domínio).
export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const API = (process.env.RENDER_API_URL ?? "https://crm-motor.onrender.com").replace(/\/$/, "");
const GATE_USER = process.env.RENDER_GATE_USER ?? "";
const GATE_PASS = process.env.RENDER_GATE_PASS ?? "";
const PROXY_SECRET = process.env.PROXY_SECRET ?? "";
const SITE_BASE = (
  process.env.SITE_BASE ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://contactcenter.com.br"
).replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const fail = (m: string) =>
    NextResponse.redirect(`${SITE_BASE}/login?erro=${encodeURIComponent(m)}`);

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const stateCookie = req.cookies.get("g_state")?.value;
  if (!code || !state || !stateCookie || state !== stateCookie) return fail("google-falhou");
  if (!CLIENT_ID || !CLIENT_SECRET) return fail("google-nao-configurado");

  try {
    // 1) code -> tokens (direto com o Google, sobre TLS)
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: `${SITE_BASE}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail("google-token");
    const tok = await tokenRes.json();

    // 2) e-mail verificado
    const uiRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!uiRes.ok) return fail("google-userinfo");
    const ui = await uiRes.json();
    if (!ui.email || ui.email_verified === false) return fail("email-nao-verificado");

    // 3) troca por sessão no motor (gating pela lista de usuários do CRM)
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (GATE_USER && GATE_PASS) {
      headers.Authorization = "Basic " + Buffer.from(`${GATE_USER}:${GATE_PASS}`).toString("base64");
    }
    if (PROXY_SECRET) headers["X-Proxy-Secret"] = PROXY_SECRET;
    const r = await fetch(`${API}/auth/google`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({ email: ui.email, nome: ui.name }),
    });
    if (r.status === 403) return fail("sem-acesso");
    if (!r.ok) return fail("motor-falhou");
    const data = await r.json();

    const res = NextResponse.redirect(`${SITE_BASE}/entrar`);
    // crm_token NÃO httpOnly: o logout limpa via JS e o proxy lê server-side.
    res.cookies.set("crm_token", data.token, {
      httpOnly: false, secure: true, sameSite: "lax", maxAge: 7 * 86400, path: "/",
    });
    res.cookies.delete("g_state");
    return res;
  } catch {
    return fail("google-erro");
  }
}
