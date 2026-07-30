"use client";
// Formulário público de candidatura — decisões 29/07 (wireframe v4):
// experiência CONDICIONAL (só se já trabalhou), redes sociais opcionais,
// até 2 lojas de interesse, LGPD prazo indeterminado, trava CPF 12 meses.
import { useEffect, useState } from "react";
import {
  vagasCandidatar,
  type CandidatarPayload,
  type CandidatarResp,
} from "@/lib/api";

type Exp = {
  empresa: string; cargo: string; entrada: string; saida: string;
  descricao: string; telefone_ref: string; superior: string;
};
const EXP_VAZIA: Exp = {
  empresa: "", cargo: "", entrada: "", saida: "",
  descricao: "", telefone_ref: "", superior: "",
};

type Props = {
  marca: string; lojaId: number; cargoId: number;
  tipo: "vaga" | "franquia"; cidade: string; uf: string;
  franquiaTipo: "loja" | "popup";
};

type HubMarca = {
  marca: { nome: string; tema?: { cor?: string } };
  cargos: { id: number; titulo: string }[];
  lojas: { id: number; nome: string; cidade: string | null; cargos_abertos?: number[] }[];
};

export default function CandidatarForm(p: Props) {
  const [hub, setHub] = useState<HubMarca | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [jaTrabalhou, setJaTrabalhou] = useState<null | boolean>(null);
  const [exps, setExps] = useState<Exp[]>([{ ...EXP_VAZIA }]);
  const [interesse, setInteresse] = useState<number[]>([]);
  const [cidade, setCidade] = useState(p.cidade);
  const [uf, setUf] = useState(p.uf);
  const [capital, setCapital] = useState("");
  const [consent, setConsent] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [fim, setFim] = useState<CandidatarResp | null>(null);

  useEffect(() => {
    if (!p.marca) return;
    fetch(`/api/render/publico/vagas/${encodeURIComponent(p.marca)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: HubMarca | null) => setHub(j))
      .catch(() => setHub(null));
  }, [p.marca]);

  const cor = hub?.marca?.tema?.cor || "#4f46e5";
  const cargoTitulo = hub?.cargos?.find((c) => c.id === p.cargoId)?.titulo || "";
  const lojaNome = hub?.lojas?.find((l) => l.id === p.lojaId)?.nome || "";
  const outrasLojas = (hub?.lojas ?? []).filter((l) => l.id !== p.lojaId);

  function setExp(i: number, campo: keyof Exp, v: string) {
    setExps((atual) => atual.map((e, j) => (j === i ? { ...e, [campo]: v } : e)));
  }

  async function enviar() {
    setErro("");
    if (!nome.trim() || !cpf.trim() || !email.trim() || !nascimento) {
      setErro("Preencha nome, CPF, data de nascimento e e-mail.");
      return;
    }
    if (p.tipo === "franquia" && !cidade.trim()) {
      setErro("Informe a cidade de interesse.");
      return;
    }
    if (!consent) {
      setErro("É preciso autorizar o uso dos dados (LGPD).");
      return;
    }
    setEnviando(true);
    try {
      const redes: Record<string, string> = {};
      if (instagram.trim()) redes.instagram = instagram.trim();
      if (linkedin.trim()) redes.linkedin = linkedin.trim();
      const payload: CandidatarPayload = {
        marca_slug: p.marca, tipo: p.tipo,
        cargo_id: p.tipo === "vaga" ? p.cargoId : undefined,
        loja_id: p.tipo === "vaga" ? p.lojaId : undefined,
        lojas_interesse: interesse.slice(0, 2),
        cidade: cidade.trim(), uf: uf.trim().toUpperCase(),
        capital: capital.trim(), franquia_tipo: p.franquiaTipo,
        nome: nome.trim(), cpf: cpf.trim(), nascimento,
        telefone: telefone.trim(),
        email: email.trim(), redes,
        ja_trabalhou: jaTrabalhou === true,
        experiencia:
          jaTrabalhou === true
            ? exps.filter((e) => e.empresa.trim() || e.cargo.trim())
            : [],
        consent,
      };
      const r = await vagasCandidatar(payload);
      setFim(r);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const inputCls =
    "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";
  const labelCls = "block text-[11px] font-bold uppercase text-slate-500 mb-1 mt-3";

  if (fim) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md text-center">
          <div className="text-4xl mb-2">{fim.travado ? "⚠️" : "✅"}</div>
          <h1 className="font-bold text-lg mb-2">
            {fim.travado ? "Você já está em um processo" : fim.banco ? "Perfil cadastrado!" : "Candidatura enviada!"}
          </h1>
          <p className="text-sm text-slate-600">{fim.mensagem}</p>
          {!fim.travado && (
            <p className="text-xs text-slate-400 mt-3">
              Enviamos um link de acompanhamento para o seu e-mail — toda a
              comunicação do processo será por lá.
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      <header className="text-white px-4 py-5" style={{ background: cor }}>
        <div className="max-w-md mx-auto">
          <h1 className="font-extrabold text-lg">
            📝 {p.tipo === "franquia"
              ? `Quero ser franqueado${p.franquiaTipo === "popup" ? " (Pop-Up)" : ""}`
              : `Candidatura${cargoTitulo ? ` — ${cargoTitulo}` : ""}`}
          </h1>
          {p.tipo === "vaga" && lojaNome && (
            <p className="text-xs opacity-90">{hub?.marca?.nome} · {lojaNome}</p>
          )}
        </div>
      </header>
      <section className="max-w-md mx-auto px-4">
        {erro && <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-2">{erro}</div>}
        <label className={labelCls}>Nome completo *</label>
        <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>CPF *</label>
            <input className={inputCls} inputMode="numeric" placeholder="000.000.000-00"
              value={cpf} onChange={(e) => setCpf(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Telefone/WhatsApp</label>
            <input className={inputCls} inputMode="tel" placeholder="(11) 90000-0000"
              value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Data de nascimento *</label>
            <input className={inputCls} type="date" value={nascimento}
              onChange={(e) => setNascimento(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>E-mail *</label>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        {p.tipo === "franquia" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Cidade de interesse *</label>
                <input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>UF *</label>
                <input className={inputCls} maxLength={2} value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())} />
              </div>
            </div>
            <label className={labelCls}>Capital disponível para investir</label>
            <select className={inputCls} value={capital} onChange={(e) => setCapital(e.target.value)}>
              <option value="">Prefiro não informar</option>
              <option>Até R$ 50 mil</option>
              <option>R$ 50–150 mil</option>
              <option>R$ 150–300 mil</option>
              <option>Acima de R$ 300 mil</option>
            </select>
          </>
        )}

        {p.tipo === "vaga" && outrasLojas.length > 0 && (
          <>
            <label className={labelCls}>Também tenho interesse em (até 2 lojas — opcional)</label>
            <div className="flex flex-wrap gap-2">
              {outrasLojas.slice(0, 12).map((l) => {
                const on = interesse.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() =>
                      setInteresse((atual) =>
                        on ? atual.filter((i) => i !== l.id)
                          : atual.length < 2 ? [...atual, l.id] : atual,
                      )
                    }
                    className={`text-xs rounded-lg px-2 py-1 border ${on ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300"}`}
                  >
                    {l.nome}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <label className={labelCls}>Redes sociais (opcional)</label>
        <input className={inputCls} placeholder="Instagram (link ou @usuario)"
          value={instagram} onChange={(e) => setInstagram(e.target.value)} />
        <input className={`${inputCls} mt-2`} placeholder="LinkedIn (link)"
          value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />

        <label className={labelCls}>Você já trabalhou antes? {p.tipo === "vaga" ? "*" : ""}</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setJaTrabalhou(true)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm border ${jaTrabalhou === true ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300"}`}>
            Sim
          </button>
          <button type="button" onClick={() => setJaTrabalhou(false)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm border ${jaTrabalhou === false ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300"}`}>
            Não
          </button>
        </div>

        {jaTrabalhou === true && (
          <div className="mt-3">
            {exps.map((e, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 mb-3">
                <div className="text-xs font-bold text-slate-500 mb-2">Emprego {i + 1}</div>
                <input className={inputCls} placeholder="Empresa"
                  value={e.empresa} onChange={(ev) => setExp(i, "empresa", ev.target.value)} />
                <input className={`${inputCls} mt-2`} placeholder="Cargo"
                  value={e.cargo} onChange={(ev) => setExp(i, "cargo", ev.target.value)} />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input className={inputCls} placeholder="Entrada (mm/aaaa)"
                    value={e.entrada} onChange={(ev) => setExp(i, "entrada", ev.target.value)} />
                  <input className={inputCls} placeholder="Saída (mm/aaaa)"
                    value={e.saida} onChange={(ev) => setExp(i, "saida", ev.target.value)} />
                </div>
                <textarea className={`${inputCls} mt-2`} rows={2} placeholder="O que você fazia"
                  value={e.descricao} onChange={(ev) => setExp(i, "descricao", ev.target.value)} />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input className={inputCls} placeholder="Telefone p/ informações"
                    value={e.telefone_ref} onChange={(ev) => setExp(i, "telefone_ref", ev.target.value)} />
                  <input className={inputCls} placeholder="Nome do superior"
                    value={e.superior} onChange={(ev) => setExp(i, "superior", ev.target.value)} />
                </div>
              </div>
            ))}
            {exps.length < 3 && (
              <button type="button" onClick={() => setExps((a) => [...a, { ...EXP_VAZIA }])}
                className="text-sm text-indigo-600 font-semibold">
                + adicionar outro emprego
              </button>
            )}
          </div>
        )}

        <label className="flex items-start gap-2 mt-4 text-xs text-slate-600">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-indigo-600"
            checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Autorizo o uso dos meus dados neste processo seletivo e a permanência
            do meu perfil no banco de talentos por prazo indeterminado, até que eu
            peça a exclusão (LGPD).
          </span>
        </label>

        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          className="w-full mt-4 text-white font-bold rounded-xl px-4 py-3 disabled:opacity-60"
          style={{ background: cor }}
        >
          {enviando ? "Enviando…" : "Enviar candidatura →"}
        </button>
      </section>
    </main>
  );
}
