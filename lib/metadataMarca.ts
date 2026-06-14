import type { Metadata } from "next";

// Metadata POR MARCA das páginas públicas (consumidor): título, descrição,
// Open Graph (prévia bonita no WhatsApp/Google) e FAVICON da marca.
//
// Roda no SERVIDOR (Vercel). Busca a marca no motor com as credenciais do portão
// — que nunca chegam ao navegador, igual ao proxy /api/render. Marca não achada
// (ou motor fora) → metadata genérico, sem quebrar a página.

const API = (process.env.RENDER_API_URL ?? "https://crm-motor.onrender.com").replace(/\/$/, "");
const GATE_USER = process.env.RENDER_GATE_USER ?? "";
const GATE_PASS = process.env.RENDER_GATE_PASS ?? "";
// Domínio público do site (p/ o Open Graph montar URLs absolutas das imagens).
const SITE_BASE = (
  process.env.SITE_BASE ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://contactcenter.com.br"
).replace(/\/$/, "");

type MarcaPub = {
  id: number;
  slug: string;
  nome: string | null;
  tema?: { titulo?: string; boas_vindas?: string } | null;
  logo_path?: string | null;
  logo_quadrado_path?: string | null;
  favicon_path?: string | null;
};

async function buscarMarca(slug: string): Promise<MarcaPub | null> {
  try {
    const headers: Record<string, string> = {};
    if (GATE_USER && GATE_PASS) {
      headers.Authorization =
        "Basic " + Buffer.from(`${GATE_USER}:${GATE_PASS}`).toString("base64");
    }
    const r = await fetch(`${API}/publico/form/${encodeURIComponent(slug)}`, {
      headers,
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { marca?: MarcaPub };
    return j.marca ?? null;
  } catch {
    return null;
  }
}

export async function metadataMarca(slug: string, sufixo = ""): Promise<Metadata> {
  const m = await buscarMarca(slug);
  const nome = (m?.nome || m?.slug || "Atendimento").trim();
  const titulo = sufixo ? `${nome} · ${sufixo}` : nome;
  const descricao =
    m?.tema?.boas_vindas?.trim() ||
    `Fale com a ${nome}. Atendimento rápido e acompanhamento on-line.`;

  // OG usa o logo quadrado (melhor p/ prévia); cai p/ logo normal, depois favicon.
  const ogImg = m?.logo_quadrado_path || m?.logo_path || m?.favicon_path;
  const favico = m?.favicon_path;

  const md: Metadata = {
    metadataBase: new URL(SITE_BASE),
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      siteName: nome,
      ...(ogImg ? { images: [{ url: `/api/render/${ogImg}` }] } : {}),
    },
    // Páginas de atendimento ao consumidor PODEM ser indexadas (SEO do frontend).
    robots: { index: true, follow: true },
  };
  if (favico) {
    const href = `/api/render/${favico}`;
    md.icons = { icon: href, shortcut: href, apple: href };
  }
  return md;
}
