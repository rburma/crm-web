"use client";

// Modal de CADASTRO da loja: e-mail (notificações) + campos extensíveis
// (endereço, WhatsApp, redes, delivery, links de avaliação…). Cada campo é um
// CampoLojaDef e vira placeholder {loja.<chave>} nos e-mails. Salva os campos
// fixos (PATCH /dados) e a gaveta de atributos (PATCH /atributos) numa tacada.

import { useCallback, useEffect, useState } from "react";
import {
  lojaCampos,
  lojaCriarCampo,
  lojaDetalhe,
  lojaSalvarAtributos,
  lojaSalvarDados,
  type LojaCampoDef,
} from "@/lib/api";

const GRUPOS: { chave: string; titulo: string }[] = [
  { chave: "contato", titulo: "Contato" },
  { chave: "endereco", titulo: "Endereço" },
  { chave: "redes", titulo: "Redes sociais" },
  { chave: "delivery", titulo: "Delivery" },
  { chave: "reputacao", titulo: "Avaliação / reputação" },
];

export default function LojaCadastro({
  lojaId,
  lojaNome,
  onClose,
  onSalvo,
}: {
  lojaId: number;
  lojaNome: string;
  onClose: () => void;
  onSalvo?: () => void;
}) {
  const [campos, setCampos] = useState<LojaCampoDef[]>([]);
  const [email, setEmail] = useState("");
  const [sigla, setSigla] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // criar campo novo (operação define como trabalhar)
  const [novoRotulo, setNovoRotulo] = useState("");
  const [novoGrupo, setNovoGrupo] = useState("contato");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [cs, det] = await Promise.all([lojaCampos(), lojaDetalhe(lojaId)]);
      setCampos(cs);
      setEmail(det.email ?? "");
      setSigla(det.sigla ?? "");
      setValores({ ...(det.atributos ?? {}) });
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setCarregando(false);
    }
  }, [lojaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function setVal(chave: string, v: string) {
    setValores((m) => ({ ...m, [chave]: v }));
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    setOkMsg("");
    try {
      await lojaSalvarDados(lojaId, { email, sigla: sigla.trim().toUpperCase() });
      await lojaSalvarAtributos(lojaId, valores);
      setOkMsg("Cadastro salvo.");
      onSalvo?.();
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setSalvando(false);
    }
  }

  async function criarCampo() {
    const rotulo = novoRotulo.trim();
    if (!rotulo) return;
    // chave = slug simples do rótulo (a-z0-9_), sem acento.
    const chave = rotulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);
    if (!chave) {
      setErro("Dê um nome válido ao campo.");
      return;
    }
    setErro("");
    try {
      const c = await lojaCriarCampo({ chave, rotulo, categoria: novoGrupo });
      setCampos((cs) => [...cs, c]);
      setNovoRotulo("");
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }

  // agrupa campos por categoria (categorias desconhecidas caem em "Outros").
  const porGrupo = new Map<string, LojaCampoDef[]>();
  for (const c of campos) {
    const g =
      c.categoria && GRUPOS.some((x) => x.chave === c.categoria) ? c.categoria : "outros";
    const arr = porGrupo.get(g) ?? [];
    arr.push(c);
    porGrupo.set(g, arr);
  }
  const ordemGrupos = [...GRUPOS.map((g) => g.chave), "outros"];

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold">Cadastro da loja</h2>
            <p className="text-xs text-slate-500">{lojaNome}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {erro && (
            <div className="card p-3 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>
          )}
          {okMsg && (
            <div className="card p-3 border-emerald-200 bg-emerald-50 text-sm text-emerald-700">
              {okMsg}
            </div>
          )}

          {carregando ? (
            <p className="text-sm text-slate-400 py-6 text-center">Carregando…</p>
          ) : (
            <>
              {/* E-mail oficial da loja (notificações) */}
              <div>
                <label className="label">
                  E-mail da loja (recebe as notificações de atendimento)
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="loja@marca.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Além deste e-mail, também recebem os usuários vinculados à loja com a
                  opção de notificação ligada (na aba Equipe).
                </p>
              </div>

              {/* SIGLA — chave que liga a loja ao sistema de cobrança */}
              <div>
                <label className="label">Sigla da loja (liga com o cobrança)</label>
                <input
                  className="input font-mono"
                  placeholder="Ex.: WTRIBE, RPSORO…"
                  value={sigla}
                  onChange={(e) => setSigla(e.target.value.toUpperCase())}
                />
                <p className="text-xs text-slate-400 mt-1">
                  É a sigla (rede + loja) que identifica esta loja no sistema de cobrança.
                  As obrigações e boletos puxados pra cá vêm desta sigla — edite se a loja
                  for uma dark kitchen ou mudar de operação/sigla.
                </p>
              </div>

              {/* Campos extensíveis por grupo */}
              {ordemGrupos.map((g) => {
                const lista = porGrupo.get(g);
                if (!lista || lista.length === 0) return null;
                const titulo =
                  GRUPOS.find((x) => x.chave === g)?.titulo ?? "Outros campos";
                return (
                  <div key={g}>
                    <div className="text-sm font-semibold text-slate-700 mb-2">{titulo}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {lista
                        .slice()
                        .sort((a, b) => a.ordem - b.ordem)
                        .map((c) => (
                          <div key={c.id}>
                            <label className="label">
                              {c.rotulo}{" "}
                              <span className="text-slate-300">{`{${c.placeholder}}`}</span>
                            </label>
                            <input
                              className="input"
                              value={valores[c.chave] ?? ""}
                              onChange={(e) => setVal(c.chave, e.target.value)}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}

              {/* Criar um campo novo */}
              <div className="border-t border-slate-200 pt-4">
                <div className="label">Criar um campo novo (vira placeholder nos e-mails)</div>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="input flex-1 min-w-[180px]"
                    placeholder="Ex.: Cupom do mês, Tripadvisor…"
                    value={novoRotulo}
                    onChange={(e) => setNovoRotulo(e.target.value)}
                  />
                  <select
                    className="input w-auto"
                    value={novoGrupo}
                    onChange={(e) => setNovoGrupo(e.target.value)}
                  >
                    {GRUPOS.map((g) => (
                      <option key={g.chave} value={g.chave}>
                        {g.titulo}
                      </option>
                    ))}
                  </select>
                  <button className="btn-ghost" onClick={criarCampo} disabled={!novoRotulo.trim()}>
                    + Adicionar campo
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 sticky bottom-0 bg-white rounded-b-xl">
          <button className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
          <button className="btn-primary" onClick={salvar} disabled={salvando || carregando}>
            {salvando ? "Salvando…" : "Salvar cadastro"}
          </button>
        </div>
      </div>
    </div>
  );
}
