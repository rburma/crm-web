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
const PUBLICAS = ["/f/", "/acompanhar", "/avaliar", "/vitrine", "/embed", "/api/render/publico/"];

export function middleware(req: NextRequest) {
  if (!USER || !PASS) return NextResponse.next();

  const path = req.nextUrl.pathname;
  // Download do instalador do app de balcão: SEMPRE público (arquivo sem segredo;
  // usar o app exige um código de ativação). Não fica atrás do portão do piloto.
  if (path === "/baixar-app" || path.startsWith("/baixar-app/")) {
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
