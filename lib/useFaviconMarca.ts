import { useEffect } from "react";

// Define o FAVICON da aba pela marca, no cliente. Usado nas páginas públicas que
// já buscam a marca no client (avaliação por QR/site, acompanhamento). A /f/[slug]
// NÃO precisa disto — lá o favicon vem da metadata server-side (lib/metadataMarca).
//
// `path` é o caminho relativo do motor (ex.: "publico/favicon/5"); servimos pelo
// proxy /api/render. Restaura o ícone anterior ao desmontar, p/ não "vazar" o
// favicon de uma marca para outra página na navegação SPA.
export function useFaviconMarca(path?: string | null): void {
  useEffect(() => {
    if (!path) return;
    const href = `/api/render/${path}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const criado = !link;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const anterior = link.getAttribute("href");
    link.setAttribute("href", href);
    return () => {
      if (criado) link?.remove();
      else if (anterior) link?.setAttribute("href", anterior);
    };
  }, [path]);
}
