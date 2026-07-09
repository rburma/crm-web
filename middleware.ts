import { NextRequest, NextResponse } from "next/server";

/**
 * Portao do PROPRIO site (perimetro). Se APP_USER e APP_PASS existirem no
 * ambiente da Vercel, as paginas INTERNAS (admin) exigem HTTP Basic Auth. Sem as
 * env vars, o portao fica desligado (dev). E a mesma tranca simples do motor — o
 * login por pessoa vira camada interna depois.
 *
 * EXCECAO: as paginas PUBLICAS dos clientes (formulario, acompanhar, avaliar,
 * QR de loja/site) e o proxy publico (/api/render/publico/*) NAO sao trancados —
 * sao o site voltado ao cliente no dominio. Essas rotas tem anti-flood no motor.
 */
const USER = process.env.APP_USER;
const PASS = process.env.APP_PASS;
// Interruptor de LANÇAMENTO: enquanto != "1", o site inteiro (inclusive as
// paginas publicas dos clientes) fica atras da senha do piloto — "fechado".
// Quando a programacao estiver pronta, definir PUBLICO_ABERTO=1 na Vercel para
// abrir SO as paginas dos clientes (o admin continua protegido). Sem mexer em codigo.
const PUBLICO_ABERTO = process.env.PUBLICO_ABERTO === "1";

// Prefixos das paginas do cliente final. startsWith cobre /avaliar, /avaliar-loja,
// /avaliar-site, /f/<slug>, /acompanhar e o proxy das rotas publicas do motor.
const PUBLICAS = ["/f/", "/acompanhar", "/avaliar", "/vitrine", "/embed", "/chat/", "/chat-widget.js", "/api/render/publico/"];
// Entradas de AUTENTICAÇÃO sempre acessíveis (login por pessoa / Google) — senão o
// fluxo OAuth (Google -> /api/auth/google/callback) bateria no portão do piloto.
const AUTH_LIVRE = ["/login", "/entrar", "/api/auth/"];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ── Camada 1: rotas SEMPRE publicas (clientes finais / franqueado por token) ──
  const publica =
    path === "/baixar-app" || path.startsWith("/baixar-app/") ||
    path.startsWith("/minha-loja") ||
    path.startsWith("/api/render/franqueado/loja/") ||
    path.startsWith("/api/render/franqueado/por-sigla/") ||
    AUTH_LIVRE.some((pp) => path === pp || path.startsWith(pp)) ||
    PUBLICAS.some((pp) => path === pp || path.startsWith(pp));

  // ── Camada 2 (03/07): SEM portao, o site exige LOGIN em tudo que nao e publico.
  // Deslogado: qualquer pagina interna -> /login; a RAIZ vira a pagina
  // institucional minima /bemvindo (clientes finais que digitarem o dominio
  // nao veem conteudo do sistema). Logado: segue normal. A SEGURANCA real e o
  // backend (fail-closed); aqui e a experiencia/curtina.
  if (!USER || !PASS) {
    if (publica) return NextResponse.next();
    if (path === "/bemvindo") return NextResponse.next();
    const tok = req.cookies.get("crm_token")?.value;
    if (!tok) {
      if (path === "/") {
        return NextResponse.rewrite(new URL("/bemvindo", req.url));
      }
      if (path.startsWith("/api/")) return NextResponse.next(); // API: o motor responde 401
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }
  // Download do instalador do app de balcão: SEMPRE público (arquivo sem segredo;
  // usar o app exige um código de ativação). Não fica atrás do portão do piloto.
  if (path === "/baixar-app" || path.startsWith("/baixar-app/")) {
    return NextResponse.next();
  }
  // Portal do franqueado: a página e o proxy de DADOS são protegidos pelo TOKEN do
  // link (capability-URL), não pela senha do portão. (O lado admin —/aprovacoes e
  // /api/render/franqueado/admin/— continua atrás do portão.)
  if (
    path.startsWith("/minha-loja") ||
    path.startsWith("/api/render/franqueado/loja/") ||
    path.startsWith("/api/render/franqueado/por-sigla/")
  ) {
    return NextResponse.next();
  }
  if (AUTH_LIVRE.some((p) => path === p || path.startsWith(p))) {
    return NextResponse.next();
  }
  if (PUBLICO_ABERTO && PUBLICAS.some((p) => path === p || path.startsWith(p))) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Basic ")) {
    try {
      const [u, p] = atob(auth.slice(6)).split(":");
      if (u === USER && p === PASS) return NextResponse.next();
    } catch {
      /* cai no 401 */
    }
  }
  return new NextResponse("Autenticacao necessaria.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CRM (piloto)"' },
  });
}

export const config = {
  // Protege tudo, menos os assets estaticos do Next e o favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
