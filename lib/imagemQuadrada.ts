// Converte um JPG/PNG/WebP escolhido pelo usuário num PNG QUADRADO, no próprio
// NAVEGADOR (sem depender de biblioteca de imagem no servidor). A imagem é
// desenhada "contida" e centralizada num canvas quadrado transparente — nada é
// cortado, sobra fica transparente. Usado pro FAVICON (ícone da aba, 180px) e
// pro LOGO QUADRADO da marca (avatar/app/redes, 512px).
//
// Só roda no cliente (usa Image/canvas/FileReader) — chamar dentro de handlers.

export async function paraPngQuadrado(file: File, tamanho: number): Promise<File> {
  const dataUrl = await lerComoDataUrl(file);
  const img = await carregarImagem(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = tamanho;
  canvas.height = tamanho;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // "contém": escala mantendo a proporção, centraliza; o resto fica transparente.
  const escala = Math.min(tamanho / img.width, tamanho / img.height) || 1;
  const w = Math.max(1, Math.round(img.width * escala));
  const h = Math.max(1, Math.round(img.height * escala));
  const x = Math.round((tamanho - w) / 2);
  const y = Math.round((tamanho - h) / 2);
  ctx.drawImage(img, x, y, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("Não foi possível converter a imagem.");
  const base = file.name.replace(/\.[^.]+$/, "").trim() || "imagem";
  return new File([blob], `${base}-${tamanho}.png`, { type: "image/png" });
}

function lerComoDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(file);
  });
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Imagem inválida ou corrompida."));
    img.src = src;
  });
}
