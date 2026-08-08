"use client";

// Encerrar a lista de ligações. Decisão do Renato (06/08/2026): ao encerrar,
// a loja escolhe quais contatos importados que AINDA não estão no CRM devem
// virar cadastro — os demais são descartados junto com a fila.

import { useState } from "react";
import Shell from "@/components/Shell";
import LojaDoDiscador from "@/components/LojaDoDiscador";
import {
  DiscadorEncerrarPrevia, discadorEncerrar, discadorEncerrarPrevia,
} from "@/lib/api";

export default function EncerrarListaPage() {
  const [previa, setPrevia] = useState<DiscadorEncerrarPrevia | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [limparTudo, setLimparTudo] = useState(false);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lojaId, setLojaId] = useState<number | undefined>(undefined);
  const [souGlobal, setSouGlobal] = useState(false);

  function carregar(lid?: number) {
    discadorEncerrarPrevia(lid)
      .then((p) => {
        setPrevia(p);
        setMsg("");
        // quem foi atendido merece cadastro: já vem marcado
        setMarcados(new Set(p.sem_cadastro
          .filter((i) => i.desfecho && i.tentativas > 0).map((i) => i.id)));
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : String(e)));
  }

  // O seletor avisa a loja ao montar (e a cada troca).
  function trocarLoja(id: number | undefined, global: boolean) {
    setLojaId(id);
    setSouGlobal(global);
    if (id || !global) carregar(id);
    else setPrevia(null);
  }

  function alternar(id: number) {
    setMarcados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  async function encerrar() {
    const quantos = previa?.total_fila ?? 0;
    if (!window.confirm(
      `Encerrar a lista?\n\n${marcados.size} contato(s) irão para o cadastro de ` +
      `clientes.\n${limparTudo
        ? `Toda a fila (${quantos} contatos) será limpa.`
        : "Os contatos já concluídos saem da fila; os pendentes continuam."}`
    )) return;
    setOcupado(true);
    try {
      const r = await discadorEncerrar({
        loja_id: lojaId, cadastrar_ids: [...marcados],
        limpar_concluidos: true, limpar_tudo: limparTudo,
      });
      setMsg(r.mensagem);
      setPrevia(await discadorEncerrarPrevia(lojaId));
      setMarcados(new Set());
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  const semCadastro = previa?.sem_cadastro ?? [];

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <a href="/discador" className="text-sm text-gray-500 hover:underline">
            ← voltar ao discador
          </a>
          <h1 className="text-2xl font-bold">Encerrar lista de ligações</h1>
          <p className="text-sm text-gray-500">
            {previa ? `${previa.total_fila} contatos na fila`
                    : souGlobal && !lojaId ? "escolha a loja" : "carregando..."}
          </p>
        </div>

        <div className={souGlobal ? "rounded-xl border bg-white p-4" : ""}>
          <LojaDoDiscador onTrocar={trocarLoja} />
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold">
            Contatos que ainda não estão no cadastro ({semCadastro.length})
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Marque quem deve virar cliente da loja. Quem ficar desmarcado é
            descartado com a lista — o telefone não fica guardado em lugar nenhum.
          </p>
          {semCadastro.length === 0 ? (
            <div className="mt-3 text-sm text-gray-400">
              Nenhum contato solto — todos já estão no CRM.
            </div>
          ) : (
            <div className="mt-3 max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                  <tr><th className="p-2 w-8"></th>
                      <th className="p-2 text-left">Nome</th>
                      <th className="p-2 text-left">Telefone</th>
                      <th className="p-2 text-left">Como terminou</th>
                      <th className="p-2 text-left">Origem</th></tr>
                </thead>
                <tbody>
                  {semCadastro.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="p-2">
                        <input type="checkbox" checked={marcados.has(i.id)}
                          onChange={() => alternar(i.id)} />
                      </td>
                      <td className="p-2">{i.nome || "—"}</td>
                      <td className="p-2">{i.telefone}</td>
                      <td className="p-2 text-gray-500">
                        {i.desfecho || (i.tentativas ? "tentado" : "não ligado")}
                      </td>
                      <td className="p-2 text-xs text-gray-400">{i.origem || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={limparTudo} className="mt-1"
              onChange={(e) => setLimparTudo(e.target.checked)} />
            <span>
              Limpar <b>toda</b> a fila, inclusive quem ainda não foi ligado
              <span className="block text-xs text-gray-500">
                Desmarcado, saem só os concluídos e a lista continua com os
                pendentes (retornos, não atendeu, telefone a corrigir).
              </span>
            </span>
          </label>
          <div className="mt-3 flex gap-2">
            <button onClick={encerrar} disabled={ocupado}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40">
              {ocupado ? "Encerrando..." : "Encerrar lista"}
            </button>
            <a href="/discador" className="rounded border px-4 py-2 text-sm">
              cancelar
            </a>
          </div>
        </div>

        {msg && <div className="rounded-lg border bg-white p-3 text-sm">{msg}</div>}
      </div>
    </Shell>
  );
}
