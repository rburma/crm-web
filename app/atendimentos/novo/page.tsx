"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import {
  buscarClientes,
  criarAtendimento,
  listarLojas,
  listarMarcas,
  type ClienteResumo,
  type LojaItem,
  type MarcaItem,
} from "@/lib/api";

const CANAIS: Record<string, string> = {
  telefone: "Telefone", balcao: "Balcão", whatsapp: "WhatsApp",
  email: "E-mail", chat: "Chat", form: "Formulário",
};

export default function NovoAtendimentoPage() {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // marca + loja
  const [marcas, setMarcas] = useState<MarcaItem[]>([]);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [qLoja, setQLoja] = useState("");
  const [lojas, setLojas] = useState<LojaItem[]>([]);
  const [loja, setLoja] = useState<LojaItem | null>(null);

  // cliente: busca OU novo
  const [qCliente, setQCliente] = useState("");
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [cliente, setCliente] = useState<ClienteResumo | null>(null);
  const [novoCliente, setNovoCliente] = useState(false);
  const [nc, setNc] = useState({ nome: "", telefone: "", email: "", cpf: "" });

  // atendimento
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [canal, setCanal] = useState("telefone");
  const [resposta, setResposta] = useState("");
  const [encerrar, setEncerrar] = useState(false);

  useEffect(() => {
    listarMarcas().then((ms) => {
      setMarcas(ms);
      if (ms.length > 0) setMarcaId(ms[0].id);
    }).catch((e) => setErro(String((e as Error).message || e)));
  }, []);

  // busca de lojas (debounce)
  useEffect(() => {
    if (marcaId === null) return;
    const t = setTimeout(() => {
      listarLojas({ marcaId, q: qLoja, limit: 30 }).then(setLojas).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [marcaId, qLoja]);

  // busca de clientes (debounce)
  useEffect(() => {
    if (!qCliente.trim() || novoCliente) { setClientes([]); return; }
    const t = setTimeout(() => {
      buscarClientes(qCliente.trim(), 8, 0).then((r) => setClientes(r.items)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [qCliente, novoCliente]);

  async function salvar() {
    setErro("");
    if (!loja) { setErro("Escolha a loja/departamento."); return; }
    if (!novoCliente && !cliente) { setErro("Escolha o cliente (ou cadastre um novo)."); return; }
    if (novoCliente && nc.nome.trim().length < 2) { setErro("Nome do novo cliente é obrigatório."); return; }
    if (novoCliente && !nc.telefone.trim() && !nc.email.trim() && !nc.cpf.trim()) {
      setErro("Novo cliente precisa de telefone, e-mail OU CPF."); return;
    }
    if (assunto.trim().length < 2) { setErro("Preencha o assunto."); return; }
    if (!mensagem.trim()) { setErro("Preencha a mensagem do cliente."); return; }
    setSalvando(true);
    try {
      const r = await criarAtendimento({
        loja_id: loja.id,
        ...(novoCliente
          ? { novo_cliente: {
              nome: nc.nome.trim(),
              telefone: nc.telefone.trim() || undefined,
              email: nc.email.trim() || undefined,
              cpf: nc.cpf.trim() || undefined,
            } }
          : { consumidor_id: cliente!.id }),
        assunto: assunto.trim(),
        mensagem: mensagem.trim(),
        prioridade,
        canal_origem: canal,
        resposta_imediata: resposta.trim() || undefined,
        encerrar,
      });
      if (novoCliente && r.cliente_status === "existente") {
        alert(
          `Este contato já existia na base: o atendimento foi vinculado a ` +
          `"${r.cliente_nome ?? "cliente existente"}" (não duplicamos o cadastro).` +
          (r.nome_divergente
            ? `\n\n⚠️ ATENÇÃO: o nome digitado difere do cadastro — o conflito foi registrado para revisão.`
            : "")
        );
      }
      router.push(`/atendimentos/${r.id}`);
    } catch (e) {
      setErro(String((e as Error).message || e));
      setSalvando(false);
    }
  }

  return (
    <Shell title="Novo atendimento (interno)">
      <div className="max-w-3xl space-y-4">
        {erro && <div className="card p-3 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}

        {/* marca + loja */}
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Marca *</label>
              <select className="input" value={marcaId ?? ""}
                onChange={(e) => { setMarcaId(Number(e.target.value)); setLoja(null); setQLoja(""); }}>
                {marcas.map((m) => <option key={m.id} value={m.id}>{m.nome ?? m.slug}</option>)}
              </select>
            </div>
            <div className="relative">
              <label className="label">Loja / Departamento *</label>
              {loja ? (
                <div className="flex items-center justify-between input bg-brand-50 border-brand-500">
                  <span className="truncate text-sm">{loja.nome}</span>
                  <button className="text-xs text-slate-500 hover:underline ml-2" onClick={() => setLoja(null)}>trocar</button>
                </div>
              ) : (
                <>
                  <input className="input" placeholder="🔎 Buscar loja…" value={qLoja}
                    onChange={(e) => setQLoja(e.target.value)} />
                  {lojas.length > 0 && qLoja.trim() !== "" && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                      {lojas.map((l) => (
                        <button key={l.id} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                          onClick={() => { setLoja(l); }}>
                          {l.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* cliente */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Cliente *</label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={novoCliente}
                onChange={(e) => { setNovoCliente(e.target.checked); setCliente(null); }} />
              cliente novo (não está na base)
            </label>
          </div>
          {!novoCliente && (
            <div className="relative">
              {cliente ? (
                <div className="flex items-center justify-between input bg-brand-50 border-brand-500">
                  <span className="truncate text-sm">
                    {cliente.nome ?? "(sem nome)"} <span className="text-xs text-slate-500">{cliente.email ?? cliente.telefone ?? ""}</span>
                  </span>
                  <button className="text-xs text-slate-500 hover:underline ml-2" onClick={() => setCliente(null)}>trocar</button>
                </div>
              ) : (
                <>
                  <input className="input" placeholder="🔎 Nome, CPF, telefone ou e-mail…" value={qCliente}
                    onChange={(e) => setQCliente(e.target.value)} />
                  {clientes.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                      {clientes.map((c) => (
                        <button key={c.id} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                          onClick={() => setCliente(c)}>
                          <span className="font-medium">{c.nome ?? "(sem nome)"}</span>
                          <span className="text-xs text-slate-400 ml-2">{c.email ?? ""} {c.telefone ?? ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {novoCliente && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <div><label className="label">Nome *</label><input className="input" value={nc.nome} onChange={(e) => setNc({ ...nc, nome: e.target.value })} /></div>
              <div><label className="label">Telefone/WhatsApp</label><input className="input" value={nc.telefone} onChange={(e) => setNc({ ...nc, telefone: e.target.value })} /></div>
              <div><label className="label">E-mail</label><input className="input" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></div>
              <div><label className="label">CPF</label><input className="input" value={nc.cpf} onChange={(e) => setNc({ ...nc, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
              <p className="sm:col-span-2 text-[11px] text-slate-400">
                Busca profunda: se telefone, e-mail OU CPF já existirem na base, o sistema usa o cliente existente (não duplica).
              </p>
            </div>
          )}
        </div>

        {/* atendimento */}
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="label">Canal</label>
              <select className="input" value={canal} onChange={(e) => setCanal(e.target.value)}>
                {Object.entries(CANAIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="label">Prioridade</label>
              <select className="input" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="label">Assunto *</label>
              <input className="input" value={assunto} onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex.: troca — pedido 200511847" />
            </div>
          </div>
          <div>
            <label className="label">Mensagem do cliente *</label>
            <textarea className="input" rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)}
              placeholder="Relato do cliente…" />
          </div>
          <div>
            <label className="label">Resposta imediata (opcional)</label>
            <textarea className="input" rows={2} value={resposta} onChange={(e) => setResposta(e.target.value)}
              placeholder="O que foi respondido/resolvido na hora…" />
            <label className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
              <input type="checkbox" checked={encerrar} onChange={(e) => setEncerrar(e.target.checked)} />
              resolvido na hora — já encerrar o atendimento
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => router.push("/atendimentos")}>Cancelar</button>
            <button className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Criando…" : "Criar atendimento"}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
