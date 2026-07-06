"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import {
  franqueadoPropostas,
  franqueadoAplicar,
  type Proposta,
  type PropostaMudanca,
} from "@/lib/api";

const ROTULOS: Record<string, string> = {
  nome: "Nome da loja", endereco: "Rua / logradouro", numero: "Número",
  complemento: "Complemento", bairro: "Bairro", cidade: "Cidade", uf: "UF",
  cep: "CEP", shopping: "Shopping", shopping_piso: "Piso",
  shopping_loja: "Nº no shopping", apelidos: "Apelidos", email: "E-mail",
  tipo: "Tipo (física/virtual)", ativo: "Ativa/inativa",
};
function rotuloCampo(c: string): string {
  if (c.startsWith("attr:")) return c.slice(5);
  return ROTULOS[c] ?? c;
}
function txt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vazio)";
  return String(v);
}

export default function AprovacoesPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  // Selecao p/ acoes EM LOTE (Renato 07/07): aprovar/reprovar varias de uma vez.
  const [selIds, setSelIds] = useState<Set<number>>(new Set());
  const [loteBusy, setLoteBusy] = useState(false);
  const [loteMsg, setLoteMsg] = useState("");

  function toggleSel(id: number) {
    setSelIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function aplicarLote(aprovar: boolean) {
    const alvos = propostas.filter((p) => selIds.has(p.id));
    if (!alvos.length) return;
    const rotulo = aprovar ? "APROVAR" : "REPROVAR";
    if (!confirm(`${rotulo} ${alvos.length} proposta(s) de uma vez?`)) return;
    setLoteBusy(true); setErro(""); setLoteMsg("");
    let ok = 0;
    let falhas = 0;
    for (const p of alvos) {
      try {
        await franqueadoAplicar(
          p.id,
          aprovar ? p.mudancas.map((m) => m.campo) : [],
          aprovar ? "aprovada em lote" : "reprovada em lote",
        );
        ok++;
      } catch {
        falhas++;
      }
    }
    setLoteMsg(`${ok} proposta(s) ${aprovar ? "aprovada(s)" : "reprovada(s)"}.` + (falhas ? ` ${falhas} falharam.` : ""));
    setSelIds(new Set());
    setLoteBusy(false);
    carregar();
  }

  const carregar = useCallback(() => {
    setCarregando(true);
    franqueadoPropostas("pendente")
      .then(setPropostas)
      .catch((e) => setErro(String((e as Error).message || e)))
      .finally(() => setCarregando(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <Shell title="Aprovações de cadastro (franqueados)">
      <div className="max-w-3xl space-y-4">
        <p className="text-sm text-slate-500">
          Alterações que os franqueados enviaram pelo link da loja. Aprove tudo, aprove só
          alguns campos, ou reprove. Só entra no cadastro o que você aprovar.
        </p>
        {erro && <div className="card p-3 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}
        {loteMsg && <div className="card p-3 border-green-200 bg-green-50 text-sm text-green-700">{loteMsg}</div>}
        {!carregando && propostas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={selIds.size === propostas.length && propostas.length > 0}
                onChange={(e) =>
                  setSelIds(e.target.checked ? new Set(propostas.map((p) => p.id)) : new Set())
                }
              />
              marcar todas
            </label>
            <span className="text-blue-800 font-medium">{selIds.size} selecionada(s)</span>
            <button
              className="btn-primary text-sm"
              disabled={loteBusy || selIds.size === 0}
              onClick={() => aplicarLote(true)}
            >
              {loteBusy ? "…" : `✔ Aprovar selecionadas (${selIds.size})`}
            </button>
            <button
              className="btn-ghost text-sm text-red-600"
              disabled={loteBusy || selIds.size === 0}
              onClick={() => aplicarLote(false)}
            >
              ✖ Reprovar selecionadas ({selIds.size})
            </button>
          </div>
        )}
        {carregando ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : propostas.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            Nenhuma alteração aguardando aprovação. 🎉
          </div>
        ) : (
          propostas.map((p) => (
            <PropostaCard
              key={p.id}
              p={p}
              onFeito={carregar}
              selecionada={selIds.has(p.id)}
              onToggleSel={() => toggleSel(p.id)}
            />
          ))
        )}
      </div>
    </Shell>
  );
}

function PropostaCard({ p, onFeito, selecionada, onToggleSel }: {
  p: Proposta; onFeito: () => void; selecionada: boolean; onToggleSel: () => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(p.mudancas.map((m) => m.campo)));
  const [motivo, setMotivo] = useState("");
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState("");

  function toggle(campo: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(campo)) n.delete(campo); else n.add(campo);
      return n;
    });
  }

  async function aplicar(campos: string[]) {
    setTrabalhando(true); setErro("");
    try {
      await franqueadoAplicar(p.id, campos, motivo.trim() || undefined);
      onFeito();
    } catch (e) {
      setErro(String((e as Error).message || e));
      setTrabalhando(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-start gap-2">
          <input type="checkbox" className="h-4 w-4 mt-0.5" checked={selecionada} onChange={onToggleSel}
            title="Selecionar p/ aprovar/reprovar em lote" />
          <div>
          <div className="font-semibold text-sm">{p.loja_nome}</div>
          <div className="text-xs text-slate-400">
            por {p.autor_nome || p.autor_email || "franqueado"}
            {p.criado_em ? ` · ${new Date(p.criado_em).toLocaleString("pt-BR")}` : ""}
          </div>
          </div>
        </div>
        <div className="flex gap-1 text-xs">
          <button className="hover:underline text-slate-500" onClick={() => setSel(new Set(p.mudancas.map((m) => m.campo)))}>marcar tudo</button>
          <span className="text-slate-300">·</span>
          <button className="hover:underline text-slate-500" onClick={() => setSel(new Set())}>nada</button>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        {p.mudancas.map((m: PropostaMudanca) => (
          <label key={m.campo} className="flex items-start gap-2 text-sm cursor-pointer rounded-lg hover:bg-slate-50 px-2 py-1">
            <input type="checkbox" className="mt-1" checked={sel.has(m.campo)} onChange={() => toggle(m.campo)} />
            <span className="min-w-0">
              <span className="font-medium">{rotuloCampo(m.campo)}: </span>
              <span className="text-slate-400 line-through">{txt(m.antes)}</span>
              <span className="mx-1 text-slate-400">→</span>
              <span className="text-emerald-700">{txt(m.depois)}</span>
            </span>
          </label>
        ))}
      </div>

      {erro && <div className="text-xs text-red-600 mb-2">{erro}</div>}

      <div className="flex items-center gap-2 flex-wrap">
        <input className="input flex-1 min-w-[160px] text-sm" placeholder="Observação (opcional, vai pra auditoria)"
          value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <button className="btn-primary text-sm" disabled={trabalhando || sel.size === 0}
          onClick={() => aplicar([...sel])}>
          {trabalhando ? "…" : `Aprovar ${sel.size}`}
        </button>
        <button className="btn-ghost text-sm text-red-600" disabled={trabalhando}
          onClick={() => { if (confirm("Reprovar todas as alterações desta proposta?")) aplicar([]); }}>
          Reprovar tudo
        </button>
      </div>
    </div>
  );
}
