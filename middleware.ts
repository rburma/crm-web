import { NextRequest, NextResponse } from "next/server";

/**
 * Portao do PROPRIO site (perimetro). Se APP_USER e APP_PASS existirem no
 * ambiente da Vercel, TODA pagina exige HTTP Basic Auth. Sem as env vars, o
 * portao fica desligado (dev). E a mesma tranca simples do motor — o login por
 * pessoa vira camada interna depois.
 */
const USER = process.env.APP_USER;
const PASS = process.env.APP_PASS;

export function middleware(req: NextRequest) {
  if (!USER || !PASS) return NextResponse.next();

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
