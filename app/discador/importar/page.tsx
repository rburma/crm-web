"use client";

// Importar lista externa para o discador — com a barreira da LGPD que o
// Renato pediu (06/08/2026): o operador precisa declarar de onde vieram os
// contatos ANTES de importar, e essa origem vai para o cadastro do cliente.

import { useState } from "react";
import Shell from "@/components/Shell";
import LojaDoDiscador from "@/components/LojaDoDiscador";
import {
  DiscadorPrevia, discadorImportar, discadorImportarPrevia,
} from "@/lib/api";

type Contato = { nome: string; telefone: string };

// Lê CSV, vCard ou texto colado. Detecta nome e telefone sozinho.
function extrairContatos(texto: string): Contato[] {
  const saida: Contato[] = [];
  if (/BEGIN:VCARD/i.test(texto)) {
    for (const cartao of texto.split(/END:VCARD/i)) {
      const nome = (cartao.match(/^FN[^:]*:(.+)$/im)?.[1] || "").trim();
      for (const m of cartao.matchAll(/^TEL[^:]*:(.+)$/gim)) {
        const tel = m[1].replace(/\D/g, "");
        if (tel.length >= 10) saida.push({ nome, telefone: tel });
      }
    }
    return saida;
  }
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  const sep = (linhas[0]?.match(/;/g)?.length ?? 0) >
              (linhas[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
  for (const [i, linha] of linhas.entries()) {
    const campos = linha.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
    // pula cabeçalho
    if (i === 0 && /nome|name|telefone|phone|celular/i.test(linha)
        && !/\d{8}/.test(linha)) continue;
    let nome = "", telefone = "";
    for (const c of campos) {
      const d = c.replace(/\D/g, "");
      if (!telefone && d.length >= 10 && d.length <= 13) telefone = d;
      else if (!nome && /[a-zA-ZÀ-ÿ]{3}/.test(c)) nome = c;
    }
    if (telefone) saida.push({ nome: nome.slice(0, 160), telefone });
  }
  return saida;
}

export default function ImportarDiscadorPage() {
  const [origem, setOrigem] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const [cadastrar, setCadastrar] = useState(true);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [previa, setPrevia] = useState<DiscadorPrevia | null>(null);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // Papel global (admin/rede/matriz) precisa dizer para qual loja é a lista.
  const [lojaId, setLojaId] = useState<number | undefined>(undefined);
  const [souGlobal, setSouGlobal] = useState(false);
  const faltaLoja = souGlobal && !lojaId;
  const liberado = origem.trim().length >= 10 && confirmo && !faltaLoja;

  function trocarLoja(id: number | undefined, global: boolean) {
    setLojaId(id);
    setSouGlobal(global);
  }

  async function lerArquivo(f: File | null) {
    if (!f) return;
    const texto = await f.text();
    const achados = extrairContatos(texto);
    setContatos(achados);
    setPrevia(null);
    setMsg(achados.length ? `${achados.length} contatos lidos do arquivo.`
                          : "Não encontrei telefones nesse arquivo.");
  }

  function lerColado(texto: string) {
    const achados = extrairContatos(texto);
    setContatos(achados);
    setPrevia(null);
    if (texto.trim()) {
      setMsg(achados.length ? `${achados.length} contatos reconhecidos.`
                            : "Não reconheci telefones no texto colado.");
    }
  }

  async function verPrevia() {
    if (!contatos.length) return;
    setOcupado(true);
    setMsg("");
    try {
      setPrevia(await discadorImportarPrevia({ loja_id: lojaId, origem, contatos }));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function importar() {
    setOcupado(true);
    setMsg("");
    try {
      const r = await discadorImportar({
        loja_id: lojaId, origem, confirmo, contatos,
        cadastrar_no_crm: cadastrar,
      });
      setMsg(r.mensagem + " — abra o discador para começar a ligar.");
      setContatos([]);
      setPrevia(null);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  const cor: Record<string, string> = {
    novo: "text-blue-700", ja_cliente: "text-green-700",
    invalido: "text-red-600", repetido: "text-gray-400",
  };

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <a href="/discador" className="text-sm text-gray-500 hover:underline">
            ← voltar ao discador
          </a>
          <h1 className="text-2xl font-bold">Importar lista de contatos</h1>
        </div>

        <div className={souGlobal ? "rounded-xl border bg-white p-4" : ""}>
          <LojaDoDiscador onTrocar={trocarLoja} />
          {faltaLoja && (
            <div className="mt-2 text-sm text-amber-800">
              Você enxerga todas as lojas — escolha para qual delas vai esta
              lista antes de continuar.
            </div>
          )}
        </div>

        {/* ── Barreira da LGPD ── */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="font-semibold text-red-800">
            ⚠ Antes de importar: responsabilidade sobre a origem
          </div>
          <p className="mt-1 text-sm text-red-900">
            A Lei Geral de Proteção de Dados exige base legal para contatar
            pessoas. Só importe contatos que tenham relação legítima com a
            loja — clientes, indicações, quem deixou o telefone
            espontaneamente. <b>Listas compradas ou coletadas sem consentimento
            não podem ser usadas.</b> O que você escrever abaixo fica gravado no
            cadastro de cada contato, com seu nome e a data.
          </p>
          <label className="mt-3 block text-sm font-medium text-red-900">
            De onde vieram estes contatos? (obrigatório)
          </label>
          <input value={origem} onChange={(e) => setOrigem(e.target.value)}
            placeholder="ex.: fichas preenchidas na loja no lançamento Asics, julho/2026"
            className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          <label className="mt-3 flex items-start gap-2 text-sm text-red-900">
            <input type="checkbox" checked={confirmo} className="mt-1"
              onChange={(e) => setConfirmo(e.target.checked)} />
            <span>
              Confirmo que estes contatos têm relação legítima com a loja e que
              a origem informada é verdadeira.
            </span>
          </label>
        </div>

        {/* ── Arquivo ── */}
        <div className={`rounded-xl border bg-white p-4 ${liberado ? "" : "opacity-50"}`}>
          <div className="mb-2 text-sm font-semibold">Arquivo ou lista</div>
          <div className="flex flex-wrap items-center gap-3">
            <label className={`rounded bg-blue-600 px-4 py-2 text-sm text-white
              ${liberado ? "cursor-pointer" : "pointer-events-none"}`}>
              Escolher arquivo (CSV, vCard, TXT)
              <input type="file" className="hidden" accept=".csv,.vcf,.txt"
                disabled={!liberado}
                onChange={(e) => lerArquivo(e.target.files?.[0] ?? null)} />
            </label>
            <span className="text-xs text-gray-500">
              detecta nome e telefone sozinho
            </span>
          </div>
          <textarea rows={4} disabled={!liberado}
            onChange={(e) => lerColado(e.target.value)}
            placeholder="ou cole aqui a lista (um contato por linha)"
            className="mt-3 w-full rounded border px-3 py-2 text-sm" />
          {contatos.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm">{contatos.length} contatos lidos</span>
              <button onClick={verPrevia} disabled={ocupado}
                className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
                Conferir antes de importar
              </button>
            </div>
          )}
        </div>

        {/* ── Prévia ── */}
        {previa && (
          <div className="rounded-xl border bg-white p-4">
            <div className="mb-2 text-sm font-semibold">
              Prévia — {previa.validos} de {previa.total} serão importados
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                  <tr><th className="p-2 text-left">Nome</th>
                      <th className="p-2 text-left">Telefone</th>
                      <th className="p-2 text-left">Situação</th></tr>
                </thead>
                <tbody>
                  {previa.itens.map((i, n) => (
                    <tr key={n} className="border-t">
                      <td className="p-2">{i.nome || "—"}</td>
                      <td className="p-2">{i.telefone}</td>
                      <td className={`p-2 ${cor[i.situacao] || ""}`}>{i.detalhe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={cadastrar} className="mt-1"
                onChange={(e) => setCadastrar(e.target.checked)} />
              <span>
                <b>Cadastrar no CRM</b> como clientes da loja, com a origem
                informada acima.
                <span className="block text-xs text-gray-500">
                  Se desmarcar, os contatos entram só na fila de ligações —
                  e no fim da lista você escolhe quais vão para o cadastro.
                </span>
              </span>
            </label>
            <div className="mt-3 flex gap-2">
              <button onClick={importar} disabled={ocupado || !liberado}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40">
                {ocupado ? "Importando..." : `Importar ${previa.validos} contatos`}
              </button>
              <a href="/discador" className="rounded border px-4 py-2 text-sm">
                cancelar
              </a>
            </div>
          </div>
        )}

        {msg && <div className="rounded-lg border bg-white p-3 text-sm">{msg}</div>}
      </div>
    </Shell>
  );
}
