// Busca a VITRINE pública de uma marca no SERVIDOR (Vercel), com as credenciais
// do portão — nunca expostas ao navegador (igual ao proxy /api/render e ao
// lib/metadataMarca). Usado pela página /vitrine/[slug] e pelo /embed (server
// components), pra o conteúdo já vir renderizado (SEO + schema.org).

const API = (process.env.RENDER_API_URL ?? "https://crm-motor.onrender.com").replace(/\/$/, "");
const GATE_USER = process.env.RENDER_GATE_USER ?? "";
const GATE_PASS = process.env.RENDER_GATE_PASS ?? "";

export type VitrineItem = {
  nome: string;
  nota: number;
  comentario: string;
  loja: string | null;
  data: string | null;
};
export type VitrineMarca = {
  id: number;
  slug: string;
  nome: string | null;
  tema: { cor?: string } | null;
  logo_path?: string | null;
  favicon_path?: string | null;
};
export type Vitrine = {
  marca: VitrineMarca;
  agregado: { media: number | null; total: number };
  itens: VitrineItem[];
};

export async function buscarVitrine(slug: string): Promise<Vitrine | null> {
  try {
    const headers: Record<string, string> = {};
    if (GATE_USER && GATE_PASS) {
      headers.Authorization =
        "Basic " + Buffer.from(`${GATE_USER}:${GATE_PASS}`).toString("base64");
    }
    const r = await fetch(`${API}/publico/vitrine/${encodeURIComponent(slug)}`, {
      headers,
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as Vitrine;
  } catch {
    return null;
  }
}
