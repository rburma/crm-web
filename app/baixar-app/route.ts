// Download do instalador do app de balcão (WT Balcão), servido pelo PRÓPRIO site.
//
// O instalador mora numa Release do repositório PRIVADO rburma/crm-app (tag
// "app-latest"). Esta rota, NO SERVIDOR, usa um token só-de-leitura
// (GITHUB_RELEASE_TOKEN) para achar o asset .exe e redirecionar o navegador para
// a URL temporária do GitHub — assim o arquivo grande baixa direto do CDN do
// GitHub, o token nunca chega ao navegador, e o repositório segue privado.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO = process.env.GITHUB_RELEASE_REPO || "rburma/crm-app";
const TAG = process.env.GITHUB_RELEASE_TAG || "app-latest";
const TOKEN = process.env.GITHUB_RELEASE_TOKEN || "";

function gh(path: string, accept: string, redirect: RequestRedirect = "follow") {
  return fetch(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "wt-balcao-download",
    },
    redirect,
    cache: "no-store",
    signal: AbortSignal.timeout(15000), // não pendurar a função se o GitHub travar
  });
}

export async function GET() {
  if (!TOKEN) {
    // Diagnóstico só no LOG do servidor (rota é pública — nunca listar nomes de
    // variáveis de ambiente no corpo da resposta).
    const nomes = Object.keys(process.env)
      .filter((k) => /GITHUB|RELEASE/i.test(k))
      .sort();
    console.warn(
      "[baixar-app] GITHUB_RELEASE_TOKEN ausente. Env com GITHUB/RELEASE:",
      nomes.length ? nomes.join(", ") : "(nenhuma)",
    );
    return new NextResponse("Download indisponível no momento.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 1) acha a release pela tag fixa "app-latest".
  const relResp = await gh(`repos/${REPO}/releases/tags/${TAG}`, "application/vnd.github+json");
  if (!relResp.ok) {
    return new NextResponse(
      `Não foi possível localizar a versão do app (HTTP ${relResp.status}). ` +
        "Rode o build no GitHub para gerar o instalador.",
      { status: 502 },
    );
  }
  const rel = (await relResp.json()) as { assets?: { id: number; name: string }[] };
  const asset = (rel.assets || []).find((a) => a.name.toLowerCase().endsWith(".exe"));
  if (!asset) {
    return new NextResponse("Instalador (.exe) ainda não publicado nesta versão.", { status: 404 });
  }

  // 2) pega o asset. Com Accept octet-stream o GitHub responde 302 para a URL
  //    temporária do CDN; redirecionamos o navegador para lá (sem passar os
  //    bytes pela função). Fallback: se vier o conteúdo direto, repassamos.
  const assetResp = await gh(
    `repos/${REPO}/releases/assets/${asset.id}`,
    "application/octet-stream",
    "manual",
  );
  const loc = assetResp.headers.get("location");
  if (assetResp.status >= 300 && assetResp.status < 400 && loc) {
    return NextResponse.redirect(loc, 302);
  }
  if (assetResp.ok && assetResp.body) {
    return new NextResponse(assetResp.body, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="WT-Balcao-Setup.exe"',
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(`Falha ao baixar o instalador (HTTP ${assetResp.status}).`, {
    status: 502,
  });
}
