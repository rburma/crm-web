"use client";
// 💼 Vagas — matriz cargos × lojas (franqueado/admin da loja). Wireframe v4:
// a pagina tem SO a matriz; marcar = vaga NO AR direto; candidatos caem em
// Oportunidades com assunto padrao "Vaga: <cargo> — <sigla>".
import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import VagasNav from "@/components/VagasNav";
import { vagasMatriz, vagasMarcar, type VagasMatriz } from "@/lib/api";

export default function VagasMatrizPage() {
  const [dados, setDados] = useState<VagasMatriz | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState<string>("");
  const [filtroMarca, setFiltroMarca] = useState<number>(0); // 0 = todas
  const [buscaLoja, setBuscaLoja] = useState("");

  useEffect(() => {
    vagasMatriz().then(setDados).catch((e: Error) => setErro(e.message));
  }, []);

  const abertas = useMemo(() => {
    const s = new Set<string>();
    for (const a of dados?.abertas ?? []) s.add(`${a.cargo_id}:${a.loja_id}`);
    return s;
  }, [dados]);

  async function alternar(cargoId: number, lojaId: number) {
    if (!dados) return;
    const chave = `${cargoId}:${lojaId}`;
    const nova = !abertas.has(chave);
    setSalvando(chave);
    try {
      await vagasMarcar(cargoId, lojaId, nova);
      setDados({
        ...dados,
        abertas: nova
          ? [...dados.abertas, { cargo_id: cargoId, loja_id: lojaId }]
          : dados.abertas.filter((a) => !(a.cargo_id === cargoId && a.loja_id === lojaId)),
      });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando("");
    }
  }

  const todasLojas = dados?.lojas ?? [];
  const todosCargos = dados?.cargos ?? [];
  // Chips de marca (30/07): admin multi-marca filtra a matriz por marca.
  const marcasDisp = [...new Map(
    todosCargos.map((c) => [c.marca_id, c.marca_sigla || `#${c.marca_id}`]),
  ).entries()];
  const cargos = filtroMarca
    ? todosCargos.filter((c) => c.marca_id === filtroMarca)
    : todosCargos;
  const normaliza = (s: string | null | undefined) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const termosLoja = normaliza(buscaLoja).split(/\s+/).filter(Boolean);
  const lojas = (filtroMarca
    ? todasLojas.filter((lj) => lj.marca_id === filtroMarca)
    : todasLojas
  ).filter((lj) =>
    termosLoja.length === 0 ||
    termosLoja.every((t) =>
      normaliza(`${lj.sigla || ""} ${lj.nome} ${lj.cidade || ""}`).includes(t),
    ),
  );

  return (
    <Shell>
      <div className="p-4 max-w-6xl mx-auto">
        <VagasNav atual="matriz" />
        <h1 className="text-xl font-bold mb-1">💼 Vagas — matriz de vagas abertas</h1>
        <p className="text-sm text-slate-500 mb-4">
          Marcou = a vaga entra NO AR na hora nas páginas públicas (e no Google).
          Desmarcou = sai do ar; quem se candidatar depois entra no banco de
          currículos. Os candidatos chegam em <b>Oportunidades</b> com assunto
          &quot;Vaga: cargo — loja&quot;.
        </p>
        {erro && <div className="mb-3 text-sm text-red-600">{erro}</div>}
        {!dados && !erro && <div className="text-sm text-slate-500">Carregando…</div>}
        {dados && todasLojas.length > 0 && (
          <input
            className="w-full sm:w-96 border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
            placeholder="🔎 Buscar loja (sigla, nome ou cidade)…"
            value={buscaLoja}
            onChange={(e) => setBuscaLoja(e.target.value)}
          />
        )}
        {marcasDisp.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button type="button" onClick={() => setFiltroMarca(0)}
              className={`text-xs rounded-lg px-2.5 py-1.5 border font-semibold ${filtroMarca === 0 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300"}`}>
              Todas as marcas
            </button>
            {marcasDisp.map(([id, sigla]) => (
              <button key={id} type="button" onClick={() => setFiltroMarca(id)}
                className={`text-xs rounded-lg px-2.5 py-1.5 border font-semibold ${filtroMarca === id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300"}`}>
                {sigla}
              </button>
            ))}
          </div>
        )}
        {dados && cargos.length === 0 && (
          <div className="panel p-4 text-sm text-slate-500">
            Nenhum cargo cadastrado ainda para as suas marcas — o administrador
            cadastra os cargos padrão em{" "}
            <a href="/vagas/admin" className="text-indigo-600 font-semibold underline">
              ⚙️ Vagas → Administração
            </a>.
          </div>
        )}
        {dados && cargos.length > 0 && (
          <div className="panel overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase">
                  <th className="text-left p-2 border border-slate-200">Cargo</th>
                  {lojas.map((lj) => (
                    <th key={lj.id} className="p-2 border border-slate-200 text-center">
                      {lj.sigla || lj.nome}
                      <div className="font-normal normal-case text-slate-400">{lj.cidade || ""}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cargos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-2 border border-slate-200 font-medium">
                      {c.titulo}
                      {c.marca_sigla && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[10px] font-bold">{c.marca_sigla}</span>
                      )}
                    </td>
                    {lojas.map((lj) => (
                      <td key={lj.id} className="p-2 border border-slate-200 text-center">
                        {lj.marca_id === c.marca_id ? (
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-indigo-600 cursor-pointer"
                            checked={abertas.has(`${c.id}:${lj.id}`)}
                            disabled={salvando === `${c.id}:${lj.id}`}
                            onChange={() => alternar(c.id, lj.id)}
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
