"use client";

// Modal de CADASTRO da loja: e-mail (notificações) + campos extensíveis
// (endereço, WhatsApp, redes, delivery, links de avaliação…). Cada campo é um
// CampoLojaDef e vira placeholder {loja.<chave>} nos e-mails. Salva os campos
// fixos (PATCH /dados) e a gaveta de atributos (PATCH /atributos) numa tacada.

import { useCallback, useEffect, useState } from "react";
import QrAvaliacao from "@/components/QrAvaliacao";
import {
  franqueadoGerarLink,
  lojaCampos,
  lojaCriarCampo,
  lojaDetalhe,
  lojaSalvarAtributos,
  lojaSalvarDados,
  reputacaoLoja,
  reputacaoUpsert,
  type LojaCampoDef,
  type LojaDados,
  type ReputacaoLoja,
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
  const [nome, setNome] = useState(lojaNome);
  const [ativo, setAtivo] = useState(true);
  const [email, setEmail] = useState("");
  const [sigla, setSigla] = useState("");
  // Endereço/identificação estruturado (cadastro canônico + busca de roteamento)
  const [end, setEnd] = useState<LojaDados>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // criar campo novo (operação define como trabalhar)
  const [novoRotulo, setNovoRotulo] = useState("");
  const [novoGrupo, setNovoGrupo] = useState("contato");
  // link do franqueado (preenche o cadastro da loja por link, com aprovação)
  const [linkFranq, setLinkFranq] = useState("");
  const [gerandoLink, setGerandoLink] = useState(false);

  // reputacao online da loja
  const [rep, setRep] = useState<ReputacaoLoja | null>(null);
  const [repVeic, setRepVeic] = useState("");
  const [repNota, setRepNota] = useState("");
  const [repQtd, setRepQtd] = useState("");
  const [repPeso, setRepPeso] = useState("");
  const [repBusy, setRepBusy] = useState(false);

  async function gerarLink() {
    setGerandoLink(true); setErro("");
    try {
      const r = await franqueadoGerarLink(lojaId);
      setLinkFranq(`${window.location.origin}/minha-loja/${r.token}`);
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setGerandoLink(false);
    }
  }

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [cs, det, rp] = await Promise.all([
        lojaCampos(),
        lojaDetalhe(lojaId),
        reputacaoLoja(lojaId).catch(() => null),
      ]);
      setCampos(cs);
      setRep(rp);
      setNome(det.nome ?? lojaNome);
      setAtivo(det.ativo);
      setEmail(det.email ?? "");
      setSigla(det.sigla ?? "");
      setEnd({
        endereco: det.endereco ?? "", numero: det.numero ?? "",
        complemento: det.complemento ?? "", bairro: det.bairro ?? "",
        cidade: det.cidade ?? "", uf: det.uf ?? "", cep: det.cep ?? "",
        shopping: det.shopping ?? "", shopping_piso: det.shopping_piso ?? "",
        shopping_loja: det.shopping_loja ?? "", apelidos: det.apelidos ?? "",
        tipo: det.tipo ?? "fisica",
      });
      setValores({ ...(det.atributos ?? {}) });
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setCarregando(false);
    }
  }, [lojaId, lojaNome]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarVeiculo() {
    const v = repVeic.trim();
    if (!v) return;
    setRepBusy(true);
    setErro("");
    try {
      await reputacaoUpsert({
        loja_id: lojaId,
        veiculo: v,
        nota: Number(repNota) || 0,
        qtd_avaliacoes: Number(repQtd) || 0,
        peso: Number(repPeso) || 1,
      });
      setRep(await reputacaoLoja(lojaId));
      setRepVeic(""); setRepNota(""); setRepQtd(""); setRepPeso("");
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setRepBusy(false);
    }
  }

  function setVal(chave: string, v: string) {
    setValores((m) => ({ ...m, [chave]: v }));
  }
  function setE(campo: keyof LojaDados, v: string) {
    setEnd((m) => ({ ...m, [campo]: v }) as LojaDados);
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    setOkMsg("");
    if (nome.trim().length < 1) { setErro("O nome do departamento não pode ficar vazio."); setSalvando(false); return; }
    try {
      await lojaSalvarDados(lojaId, {
        nome: nome.trim(), email, sigla: sigla.trim().toUpperCase(), ativo, ...end,
      });
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
              {/* Nome do departamento + ativo/inativo */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <label className="label">Nome do departamento / loja</label>
                  <input
                    className="input"
                    placeholder="Ex.: WT Iguatemi, Delivery SP…"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                  Ativo
                </label>
              </div>

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

              {/* Link do franqueado: ele preenche o cadastro e você aprova */}
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-700">Deixar o franqueado preencher</div>
                <p className="text-xs text-slate-400 mb-2">
                  Gere um link e mande pro franqueado. Ele revisa/preenche o cadastro da loja;
                  as alterações chegam em <b>Aprovações</b> pra você aprovar (tudo ou parcial).
                </p>
                {linkFranq ? (
                  <div className="flex items-center gap-2">
                    <input className="input text-xs font-mono" readOnly value={linkFranq}
                      onFocus={(e) => e.currentTarget.select()} />
                    <button type="button" className="btn-ghost text-xs px-3 py-1.5 shrink-0"
                      onClick={() => navigator.clipboard?.writeText(linkFranq)}>copiar</button>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost text-sm" onClick={gerarLink} disabled={gerandoLink}>
                    {gerandoLink ? "Gerando…" : "🔗 Gerar link do franqueado"}
                  </button>
                )}
              </div>

              {/* QR de avaliação da loja: imprimir no balcão / salvar PDF / link p/ e-mail */}
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-700">QR de avaliação da loja</div>
                <p className="text-xs text-slate-400 mb-2">
                  Cole no balcão pro cliente avaliar o atendimento (com ou sem compra). Escolha o
                  tamanho e <b>imprima ou salve o PDF</b>. O mesmo link vai por e-mail com o
                  placeholder <code>{"{loja.link_avaliacao}"}</code>.
                </p>
                <QrAvaliacao
                  url={`${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://contactcenter.com.br").replace(/\/$/, "")}/avaliar-loja/${lojaId}`}
                  nome={nome}
                  arquivo={`qr-avaliacao-loja-${lojaId}`}
                />
              </div>

              {/* Reputacao online da loja (score ponderado + notas por veiculo) */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-semibold text-slate-700">Reputação online</div>
                  <div className="text-xs text-slate-500">
                    {rep && rep.score != null
                      ? `Score ${rep.score.toFixed(2)} · ${rep.qtd_veiculos} veículo(s) · ${rep.qtd_avaliacoes} avaliações`
                      : "sem notas ainda"}
                  </div>
                </div>
                {rep && rep.veiculos.length > 0 && (
                  <table className="w-full text-sm mt-2">
                    <thead>
                      <tr className="text-left text-xs text-slate-400">
                        <th className="py-1">Veículo</th>
                        <th>Nota</th>
                        <th>Qtd</th>
                        <th>Peso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rep.veiculos.map((v) => (
                        <tr key={v.veiculo} className="border-t border-slate-100">
                          <td className="py-1">{v.veiculo}</td>
                          <td>{v.nota}</td>
                          <td>{v.qtd_avaliacoes}</td>
                          <td>{v.peso}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                  <input className="input sm:col-span-2" placeholder="Veículo (ex.: Google)" value={repVeic} onChange={(e) => setRepVeic(e.target.value)} />
                  <input className="input" type="number" step="0.1" placeholder="Nota" value={repNota} onChange={(e) => setRepNota(e.target.value)} />
                  <input className="input" type="number" placeholder="Qtd" value={repQtd} onChange={(e) => setRepQtd(e.target.value)} />
                  <input className="input" type="number" step="0.1" placeholder="Peso" value={repPeso} onChange={(e) => setRepPeso(e.target.value)} />
                </div>
                <button type="button" className="btn-ghost text-sm mt-2" onClick={salvarVeiculo} disabled={repBusy || !repVeic.trim()}>
                  {repBusy ? "Salvando…" : "Salvar veículo"}
                </button>
              </div>

              {/* Endereço e identificação (cadastro canônico + busca de roteamento) */}
              <div className="border-t border-slate-200 pt-4">
                <div className="text-sm font-semibold text-slate-700 mb-1">Endereço e identificação</div>
                <p className="text-xs text-slate-400 mb-2">
                  É por aqui que o cliente acha a loja na abertura do atendimento (cidade, rua, bairro,
                  CEP, shopping, apelido). Preencha bem — é o que roteia pra loja certa.
                </p>

                <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
                  <input type="checkbox" checked={end.tipo === "virtual"}
                    onChange={(e) => setEnd((m) => ({ ...m, tipo: e.target.checked ? "virtual" : "fisica" }))} />
                  É a <b>loja virtual</b> da marca (recebe os pedidos do site e dos marketplaces)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                  <div className="sm:col-span-4">
                    <label className="label">Rua / logradouro</label>
                    <input className="input" value={end.endereco ?? ""} onChange={(e) => setE("endereco", e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Número</label>
                    <input className="input" value={end.numero ?? ""} onChange={(e) => setE("numero", e.target.value)} />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="label">Complemento</label>
                    <input className="input" value={end.complemento ?? ""} onChange={(e) => setE("complemento", e.target.value)} />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="label">Bairro</label>
                    <input className="input" value={end.bairro ?? ""} onChange={(e) => setE("bairro", e.target.value)} />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="label">Cidade</label>
                    <input className="input" value={end.cidade ?? ""} onChange={(e) => setE("cidade", e.target.value)} />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="label">UF</label>
                    <input className="input uppercase" maxLength={2} value={end.uf ?? ""} onChange={(e) => setE("uf", e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">CEP</label>
                    <input className="input" placeholder="00000-000" value={end.cep ?? ""} onChange={(e) => setE("cep", e.target.value)} />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="label">Shopping (se houver)</label>
                    <input className="input" value={end.shopping ?? ""} onChange={(e) => setE("shopping", e.target.value)} />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="label">Piso</label>
                    <input className="input" value={end.shopping_piso ?? ""} onChange={(e) => setE("shopping_piso", e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Nº da loja no shopping</label>
                    <input className="input" value={end.shopping_loja ?? ""} onChange={(e) => setE("shopping_loja", e.target.value)} />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="label">Apelidos / como também é conhecida (1 por linha ou separados por vírgula)</label>
                    <textarea className="input" rows={2} placeholder="Ex.: Pedreira (shopping de Nova Iguaçu), Iguatemi SP"
                      value={end.apelidos ?? ""} onChange={(e) => setE("apelidos", e.target.value)} />
                  </div>
                </div>
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
