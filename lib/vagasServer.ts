// Fetch SERVIDOR->motor para as paginas PUBLICAS de vagas/franquias (SEO).
// Roda só no servidor (Server Components/route handlers); usa ISR (revalidate)
// para as paginas serem estaticas/rapidas e indexaveis. Sem segredos: as rotas
// /publico/* do motor sao abertas por design.

const API = (process.env.RENDER_API_URL ?? "https://crm-motor.onrender.com").replace(/\/$/, "");
const REVAL = 600; // 10 min — a matriz do franqueado reflete no ar em ate 10 min

async function pub<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}/publico/vagas${path}`, {
      next: { revalidate: REVAL },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export type MarcaPub = {
  id: number; slug: string; nome: string; sigla: string | null;
  tema: { cor?: string; titulo?: string } & Record<string, unknown>;
};
export type LojaPub = {
  id: number; nome: string; cidade: string | null; uf: string | null;
  bairro: string | null; cep: string | null; endereco: string | null;
  numero: string | null; shopping: string | null;
  slug: string; cidade_slug: string; cargos_abertos?: number[];
};
export type CargoPub = {
  id: number; titulo: string; slug: string; descricao: string | null;
  requisitos: string | null; texto_seo: string | null;
  aberta?: boolean; aberta_em?: string | null;
};

export type BlocoPub = { escopo: string; titulo: string | null; texto: string | null };
export function hubGeral() {
  return pub<{ vagas: MarcaPub[]; franquias: MarcaPub[]; blocos?: BlocoPub[] }>("");
}
export function hubMarca(slug: string) {
  return pub<{ marca: MarcaPub; cargos: CargoPub[]; lojas: LojaPub[] }>(`/${slug}`);
}
export function paginaLoja(slug: string, lojaId: number) {
  return pub<{ marca: MarcaPub; loja: LojaPub; cargos: CargoPub[]; outras_lojas: LojaPub[] }>(
    `/${slug}/loja/${lojaId}`,
  );
}
export function paginaFranquia(slug: string) {
  return pub<{
    marca: MarcaPub; cargo: CargoPub | null;
    cidades_prioritarias: { nome: string; uf: string; slug: string }[];
  }>(`/${slug}/franquia`);
}
export function sitemapDados() {
  return pub<{ marcas: { slug: string; vagas: boolean; franquia: boolean;
    lojas: { id: number; slug: string; cidade_slug: string }[]; cidades: string[] }[] }>(
    "/sitemap",
  );
}

export function logoUrl(marcaId: number): string {
  return `${API}/publico/logo/${marcaId}`;
}
