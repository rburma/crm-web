// Sitemap do módulo Vagas/Franquias — /vagas/sitemap.xml (route handler puro,
// compatível com o Next 14). Inclui hubs, marcas, lojas e cidades de franquia.
import { NextResponse } from "next/server";
import { sitemapDados } from "@/lib/vagasServer";

export const revalidate = 3600;

const SITE = (process.env.SITE_URL ?? "https://contactcenter.com.br").replace(/\/$/, "");

export async function GET() {
  const dados = await sitemapDados();
  const urls: string[] = [`${SITE}/vagas`, `${SITE}/franquias`];
  for (const m of dados?.marcas ?? []) {
    if (m.vagas) {
      urls.push(`${SITE}/vagas/${m.slug}`);
      for (const lj of m.lojas) {
        urls.push(`${SITE}/vagas/${m.slug}/${lj.cidade_slug}/${lj.slug}-${lj.id}`);
      }
    }
    if (m.franquia) {
      urls.push(`${SITE}/franquias/${m.slug}`);
      for (const c of m.cidades) {
        urls.push(`${SITE}/franquias/${m.slug}/${c}`);
      }
    }
  }
  const corpo =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>`;
  return new NextResponse(corpo, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
