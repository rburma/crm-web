import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy servidor->servidor para a API do motor (Render).
 *
 * O navegador chama SEMPRE este proxy (mesma origem, atras do portao do site).
 * Aqui, no servidor da Vercel, anexamos os SEGREDOS — o portao Basic Auth do
 * motor e a identidade `X-Usuario-Id` — que NUNCA chegam ao navegador.
 */
const API = (process.env.RENDER_API_URL ?? "https://crm-motor.onrender.com").replace(/\/$/, "");
const GATE_USER = process.env.RENDER_GATE_USER ?? "";
const GATE_PASS = process.env.RENDER_GATE_PASS ?? "";
const USER_ID = process.env.RENDER_USER_ID ?? "1";

export const dynamic = "force-dynamic";

async function forward(req: NextRequest, path: string[]) {
  const { search } = new URL(req.url);
  const target = `${API}/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers: Record<string, string> = { "X-Usuario-Id": USER_ID };
  // Login real: se o navegador tem o cookie de sessao, repassamos como X-CRM-Token
  // (o motor resolve o usuario do token). Sem cookie, vale o X-Usuario-Id (admin) —
  // ADITIVO: o piloto segue funcionando sem login enquanto nao ativarmos.
  const token = req.cookies.get("crm_token")?.value;
  if (token) headers["X-CRM-Token"] = token;
  if (GATE_USER && GATE_PASS) {
    headers["Authorization"] =
      "Basic " + Buffer.from(`${GATE_USER}:${GATE_PASS}`).toString("base64");
  }

  const init: RequestInit = { method: req.method, headers, cache: "no-store" };
  if (!["GET", "HEAD"].includes(req.method)) {
    headers["Content-Type"] = req.headers.get("content-type") ?? "application/json";
    init.body = await req.text();
  }

  try {
    const r = await fetch(target, init);
    const body = await r.text();
    return new NextResponse(body, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { detail: "Falha ao falar com o motor.", erro: String(e) },
      { status: 502 },
    );
  }
}

type Ctx = { params: { path: string[] } };
export const GET = (req: NextRequest, { params }: Ctx) => forward(req, params.path);
export const POST = (req: NextRequest, { params }: Ctx) => forward(req, params.path);
export const PATCH = (req: NextRequest, { params }: Ctx) => forward(req, params.path);
export const PUT = (req: NextRequest, { params }: Ctx) => forward(req, params.path);
export const DELETE = (req: NextRequest, { params }: Ctx) => forward(req, params.path);
