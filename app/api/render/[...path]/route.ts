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
// Go-live: definir RENDER_SEND_USER_ID=0 (para de mandar a identidade-admin de
// compatibilidade) e PROXY_SECRET (segredo do perímetro, casado com o do motor).
const SEND_USER_ID = (process.env.RENDER_SEND_USER_ID ?? "1") === "1";
const PROXY_SECRET = process.env.PROXY_SECRET ?? "";

export const dynamic = "force-dynamic";

async function forward(req: NextRequest, path: string[]) {
  const { search } = new URL(req.url);
  const target = `${API}/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers: Record<string, string> = {};
  // Identidade de compatibilidade do piloto (admin). No go-live, RENDER_SEND_USER_ID=0
  // desliga isto e o motor (ALLOW_USER_ID_HEADER=0) passa a exigir token de login.
  if (SEND_USER_ID) headers["X-Usuario-Id"] = USER_ID;
  // Login real: se o navegador tem o cookie de sessao, repassamos como X-CRM-Token
  // (o motor resolve o usuario do token).
  const token = req.cookies.get("crm_token")?.value;
  if (token) headers["X-CRM-Token"] = token;
  // Segredo de perímetro (se configurado): prova ao motor que o request veio do proxy.
  if (PROXY_SECRET) headers["X-Proxy-Secret"] = PROXY_SECRET;
  // IP REAL do navegador -> p/ o rate limit do motor contar por usuario (e nao
  // tratar todo o trafego como vindo do proxy/Vercel). 1o IP da cadeia.
  const ipCliente =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    (req.headers.get("x-real-ip") ?? "");
  if (ipCliente) headers["X-Forwarded-For"] = ipCliente;
  if (GATE_USER && GATE_PASS) {
    headers["Authorization"] =
      "Basic " + Buffer.from(`${GATE_USER}:${GATE_PASS}`).toString("base64");
  }

  const init: RequestInit = { method: req.method, headers, cache: "no-store" };
  if (!["GET", "HEAD"].includes(req.method)) {
    // Preserva o Content-Type original (inclui o boundary do multipart) e
    // repassa o corpo como BYTES — binario-seguro (ler como texto corromperia
    // um upload .xlsx). Vale tanto p/ JSON quanto p/ multipart/form-data.
    const ct = req.headers.get("content-type");
    if (ct) headers["Content-Type"] = ct;
    init.body = Buffer.from(await req.arrayBuffer());
  }

  try {
    const r = await fetch(target, init);
    // Resposta como BYTES — binário-seguro (ler como texto corrompia imagens,
    // ex.: o logo da marca servido em /publico/logo/{id}). JSON passa igual.
    const body = Buffer.from(await r.arrayBuffer());
    const outHeaders: Record<string, string> = {
      "Content-Type": r.headers.get("content-type") ?? "application/json",
    };
    // Repassa o total da paginação (clientes usa o header p/ "Página X de Y").
    const totalCount = r.headers.get("x-total-count");
    if (totalCount) outHeaders["X-Total-Count"] = totalCount;
    const cache = r.headers.get("cache-control");
    if (cache) outHeaders["Cache-Control"] = cache;
    return new NextResponse(body, { status: r.status, headers: outHeaders });
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
