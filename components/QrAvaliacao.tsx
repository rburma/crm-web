"use client";

import { useEffect, useState } from "react";

// QR de avaliação reutilizável: prévia + escolher TAMANHO + Imprimir/Salvar PDF +
// baixar PNG + copiar link. Usa a lib `qrcode` (já no projeto). O "Imprimir" abre
// uma janela só com o QR no tamanho escolhido e dispara a impressão (o navegador
// permite "Salvar como PDF"). Sem dependência nova.
export default function QrAvaliacao({
  url, nome, arquivo,
}: { url: string; nome?: string; arquivo: string }) {
  const [qr, setQr] = useState("");
  const [cm, setCm] = useState(5);

  useEffect(() => {
    let vivo = true;
    import("qrcode").then((QRCode) =>
      QRCode.toDataURL(url, { width: 1024, margin: 1 })
        .then((d: string) => { if (vivo) setQr(d); })
        .catch(() => {}),
    );
    return () => { vivo = false; };
  }, [url]);

  function imprimir() {
    if (!qr) return;
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) { alert("Permita pop-ups deste site para imprimir/gerar o PDF."); return; }
    const titulo = nome ? `Avaliação — ${nome}` : "Avaliação";
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${arquivo}</title>` +
      `<style>@page{margin:12mm}` +
      `body{font-family:Arial,Helvetica,sans-serif;text-align:center;color:#111}` +
      `h1{font-size:18px;margin:0 0 4px}p{font-size:13px;color:#444;margin:4px 0 14px}` +
      `img{width:${cm}cm;height:${cm}cm}` +
      `.rod{font-size:11px;color:#666;margin-top:12px;word-break:break-all}</style></head>` +
      `<body><h1>${titulo}</h1>` +
      `<p>Aponte a câmera do celular e avalie nosso atendimento 💬</p>` +
      `<img src="${qr}" alt="QR code" />` +
      `<div class="rod">${url}</div>` +
      `<script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script>` +
      `</body></html>`,
    );
    w.document.close();
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="flex items-start gap-3">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR de avaliação" className="w-28 h-28 rounded border border-slate-200 bg-white shrink-0" />
        ) : (
          <div className="w-28 h-28 rounded border border-slate-200 bg-slate-50 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <code className="block text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap mb-2">{url}</code>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">Tamanho:</label>
            <select className="input w-auto py-1 text-xs" value={cm}
              onChange={(e) => setCm(Number(e.target.value))}>
              {[3, 4, 5, 6, 8, 10, 15].map((v) => <option key={v} value={v}>{v} cm</option>)}
            </select>
            <button className="btn-ghost text-xs px-2 py-1.5" disabled={!qr} onClick={imprimir}>
              🖨️ Imprimir / Salvar PDF
            </button>
            {qr && (
              <a className="btn-ghost text-xs px-2 py-1.5" href={qr} download={`${arquivo}.png`}>
                ⬇ Baixar PNG
              </a>
            )}
            <button className="btn-ghost text-xs px-2 py-1.5"
              onClick={() => navigator.clipboard?.writeText(url)}>copiar link</button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            No "Imprimir", escolha a impressora ou "Salvar como PDF". O QR sai no tamanho selecionado.
          </p>
        </div>
      </div>
    </div>
  );
}
