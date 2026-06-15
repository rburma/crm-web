// Reduz uma foto pra um JPEG leve NO NAVEGADOR, antes do upload — pra não entupir
// a armazenagem do Box. Mantém a proporção; o lado maior fica <= maxLado. Fundo
// branco (JPEG não tem transparência). Só roda no cliente (usa Image/canvas).
export async function paraJpegReduzido(
  file: File,
  maxLado = 1600,
  qualidade = 0.82,
): Promise<File> {
  const dataUrl = await lerDataUrl(file);
  const img = await carregar(dataUrl);
  const escala = Math.min(1, maxLado / Math.max(img.width, img.height) || 1);
  const w = Math.max(1, Math.round(img.width * escala));
  const h = Math.max(1, Math.round(img.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", qualidade),
  );
  if (!blob) throw new Error("Não foi possível processar a imagem.");
  const base = file.name.replace(/\.[^.]+$/, "").trim() || "foto";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

function lerDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(file);
  });
}

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Imagem inválida ou corrompida."));
    img.src = src;
  });
}
