"use client";

/**
 * Treinamento (trilha de onboarding) — a tela do FUNCIONÁRIO.
 *
 * Regras do Renato (13/08/2026) que moldam esta tela e não são estética:
 * - CARIMBO com nome/login/loja/IP/hora por cima do conteúdo, sempre.
 * - Sem impressão, sem seleção de texto, sem layout mobile. O conteúdo não
 *   pode sair daqui: "se abrirmos, vai para a concorrência em um minuto".
 * - O PC do balcão é compartilhado: se a última atividade na máquina foi de
 *   outra pessoa, reconfirmar quem está usando antes de mostrar qualquer coisa.
 * - Tópico = auto-declaração ("li e entendi"). O que vale é o teste do módulo.
 * - Reprovou: refaz 1 dia depois E os tópicos reabrem.
 */

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import {
  MinhaTrilha, TrilhaCarimbo, TrilhaConteudo, TrilhaResultado, TrilhaTeste,
  trilhaDefinirCargo, trilhaMinha, trilhaModulo, trilhaResponder, trilhaTeste,
  trilhaVisto,
} from "@/lib/api";

/** Marca d'água diagonal. Não impede foto de tela — identifica quem vazou. */
function Carimbo({ c }: { c: TrilhaCarimbo }) {
  const texto = `${c.nome} · ${c.login} · ${c.loja} · ${c.ip} · `
    + new Date(c.hora).toLocaleString("pt-BR");
  return (
    <div aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden select-none">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}
          className="absolute whitespace-nowrap text-[11px] text-gray-400/25"
          style={{ top: `${i * 13 + 4}%`, left: "-10%", width: "130%",
                   transform: "rotate(-18deg)" }}>
          {`${texto}   ${texto}   ${texto}`}
        </div>
      ))}
    </div>
  );
}

export default function TrilhaPage() {
  const [t, setT] = useState<MinhaTrilha | null>(null);
  const [erro, setErro] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [aberto, setAberto] = useState<TrilhaConteudo | null>(null);
  const [teste, setTeste] = useState<TrilhaTeste | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<TrilhaResultado | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await trilhaMinha();
      setT(r);
      if (!r.reconfirmar_identidade) setConfirmado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Bloqueia a impressão do conteúdo (Ctrl+P e o menu do navegador).
  useEffect(() => {
    const bloquear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        alert("O conteúdo do treinamento não pode ser impresso.");
      }
    };
    window.addEventListener("keydown", bloquear);
    return () => window.removeEventListener("keydown", bloquear);
  }, []);

  async function escolherCargo(c: string) {
    await trilhaDefinirCargo(c);
    await carregar();
  }

  async function abrir(modulo: string) {
    setResultado(null); setTeste(null);
    setAberto(await trilhaModulo(modulo));
  }

  async function marcarVisto(boxFileId: string, modulo: string) {
    setOcupado(true);
    try {
      await trilhaVisto(boxFileId, modulo);
      setAberto(await trilhaModulo(modulo));
      await carregar();
    } finally { setOcupado(false); }
  }

  async function abrirTeste(modulo: string) {
    setAberto(null); setResultado(null); setRespostas({});
    setTeste(await trilhaTeste(modulo));
  }

  async function enviarTeste(modulo: string) {
    setOcupado(true);
    try {
      setResultado(await trilhaResponder(modulo, respostas));
      setTeste(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setOcupado(false); }
  }

  if (erro) {
    return <Shell><div className="p-4 text-red-600">{erro}</div></Shell>;
  }
  if (!t) {
    return <Shell><div className="p-4 text-gray-500">Carregando...</div></Shell>;
  }

  // Primeiro acesso: a própria pessoa diz o cargo. Exigir cadastro prévio
  // travaria a rede inteira no dia 1; franqueado e admin corrigem depois.
  if (t.precisa_escolher_cargo) {
    return (
      <Shell>
        <div className="max-w-xl p-4">
          <h1 className="text-lg font-semibold">Qual é a sua função?</h1>
          <p className="mt-1 text-sm text-gray-600">
            É o que define o seu treinamento. Se errar, o franqueado corrige.
          </p>
          <div className="mt-3 space-y-2">
            {Object.entries(t.cargos || {}).map(([k, nome]) => (
              <button key={k} onClick={() => escolherCargo(k)}
                className="block w-full rounded border px-3 py-2 text-left hover:bg-gray-50">
                {nome}
              </button>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  // PC compartilhado: a última atividade nesta máquina foi de outra pessoa.
  if (t.reconfirmar_identidade && !confirmado) {
    return (
      <Shell>
        <div className="max-w-xl p-4">
          <h1 className="text-lg font-semibold">Confirme que é você</h1>
          <p className="mt-1 text-sm text-gray-600">
            Este computador foi usado por outra pessoa há pouco. O treinamento
            e o teste ficam registrados no seu nome.
          </p>
          <div className="mt-3 rounded border bg-gray-50 p-3 text-sm">
            <div><strong>{t.carimbo?.nome}</strong></div>
            <div className="text-gray-600">{t.carimbo?.login}</div>
            <div className="text-gray-600">{t.carimbo?.loja}</div>
          </div>
          <button onClick={() => setConfirmado(true)}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Sou eu, continuar
          </button>
          <p className="mt-2 text-xs text-gray-500">
            Não é você? Saia da conta e entre com o seu login.
          </p>
        </div>
      </Shell>
    );
  }

  const mods = t.modulos || [];

  return (
    <Shell>
      {/* O atalho Ctrl+P é só metade: o menu do navegador imprime igual.
          Isto some com o conteúdo na impressão e deixa um aviso no papel. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #aviso-nao-imprime, #aviso-nao-imprime * {
            visibility: visible !important;
          }
          #aviso-nao-imprime {
            position: fixed; top: 40%; left: 0; width: 100%;
            text-align: center; font-size: 16pt;
          }
        }
      `}</style>
      <div id="aviso-nao-imprime" className="hidden print:block">
        O conteúdo do treinamento não pode ser impresso.
      </div>
      {t.carimbo && <Carimbo c={t.carimbo} />}
      {/* select-none: o conteúdo não sai daqui por copiar e colar */}
      <div className="relative z-10 max-w-3xl select-none p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">Treinamento</h1>
          <span className="text-sm text-gray-600">
            {t.concluidos} de {t.total_modulos} módulos
          </span>
        </div>
        <p className="text-sm text-gray-600">
          {t.cargo_nome} · {t.marca}
        </p>

        {/* Lista dos módulos, na ordem. Abre um por vez. */}
        {!aberto && !teste && !resultado && (
          <div className="mt-4 space-y-2">
            {mods.length === 0 && (
              <div className="rounded border bg-gray-50 p-3 text-sm text-gray-600">
                Ainda não há conteúdo publicado para a sua função e marca.
              </div>
            )}
            {mods.map((m) => (
              <div key={m.modulo}
                className={`rounded border p-3 ${m.liberado ? "" : "opacity-50"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {m.aprovado ? "✅ " : ""}{m.modulo}
                    </div>
                    <div className="text-xs text-gray-600">
                      {m.vistos} de {m.videos} tópicos lidos
                      {m.aprovado && m.total_perguntas
                        ? ` · teste ${m.acertos}/${m.total_perguntas}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {m.liberado && (
                      <button onClick={() => abrir(m.modulo)}
                        className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
                        {m.vistos ? "continuar" : "começar"}
                      </button>
                    )}
                    {m.pode_fazer_teste && (
                      <button onClick={() => abrirTeste(m.modulo)}
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
                        fazer o teste
                      </button>
                    )}
                  </div>
                </div>
                {m.espera_ate && !m.aprovado && (
                  <div className="mt-1 text-xs text-amber-800">
                    Você pode refazer o teste a partir de{" "}
                    {new Date(m.espera_ate).toLocaleString("pt-BR")}. Os tópicos
                    foram reabertos — leia de novo antes de tentar.
                  </div>
                )}
                {!m.liberado && (
                  <div className="mt-1 text-xs text-gray-500">
                    Abre quando você passar no módulo anterior.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Conteúdo do módulo */}
        {aberto && (
          <div className="mt-4">
            <button onClick={() => setAberto(null)}
              className="text-sm text-blue-700 underline">← voltar</button>
            <h2 className="mt-2 text-base font-semibold">{aberto.modulo}</h2>
            <div className="mt-2 space-y-3">
              {aberto.itens.map((it) => (
                <div key={it.box_file_id} className="rounded border p-3">
                  <div className="font-medium">
                    {it.visto ? "✅ " : ""}{it.titulo}
                  </div>
                  {it.resumo && (
                    <p className="mt-1 whitespace-pre-line text-sm">{it.resumo}</p>
                  )}
                  {it.pontos_chave.length > 0 && (
                    <>
                      <div className="mt-2 text-xs font-semibold text-gray-700">
                        Pontos-chave
                      </div>
                      <ul className="list-disc pl-5 text-sm">
                        {it.pontos_chave.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </>
                  )}
                  {it.nao_pode.length > 0 && (
                    <>
                      <div className="mt-2 text-xs font-semibold text-red-700">
                        Não pode
                      </div>
                      <ul className="list-disc pl-5 text-sm text-red-800">
                        {it.nao_pode.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </>
                  )}
                  {it.pode.length > 0 && (
                    <>
                      <div className="mt-2 text-xs font-semibold text-green-800">
                        Pode
                      </div>
                      <ul className="list-disc pl-5 text-sm">
                        {it.pode.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </>
                  )}
                  {it.passo_a_passo.length > 0 && (
                    <>
                      <div className="mt-2 text-xs font-semibold text-gray-700">
                        Passo a passo
                      </div>
                      <ol className="list-decimal pl-5 text-sm">
                        {it.passo_a_passo.map((p, i) => <li key={i}>{p}</li>)}
                      </ol>
                    </>
                  )}
                  {!it.visto && (
                    <button disabled={ocupado}
                      onClick={() => marcarVisto(it.box_file_id, aberto.modulo)}
                      className="mt-3 rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-40">
                      li e entendi
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Teste do módulo */}
        {teste && (
          <div className="mt-4">
            <button onClick={() => setTeste(null)}
              className="text-sm text-blue-700 underline">← voltar</button>
            <h2 className="mt-2 text-base font-semibold">
              Teste — {teste.modulo}
            </h2>
            {teste.ja_aprovado && (
              <p className="mt-2 text-sm text-green-800">
                Você já passou neste módulo.
              </p>
            )}
            {teste.bloqueado_ate && (
              <p className="mt-2 text-sm text-amber-800">
                Você pode refazer a partir de{" "}
                {new Date(teste.bloqueado_ate).toLocaleString("pt-BR")}.
              </p>
            )}
            {teste.perguntas?.map((p) => (
              <div key={p.n} className="mt-3">
                <div className="text-sm font-medium">{p.n + 1}. {p.pergunta}</div>
                <textarea rows={2}
                  value={respostas[String(p.n)] || ""}
                  onChange={(e) => setRespostas(
                    { ...respostas, [String(p.n)]: e.target.value })}
                  className="mt-1 w-full rounded border p-2 text-sm" />
              </div>
            ))}
            {teste.perguntas && teste.perguntas.length > 0 && (
              <button disabled={ocupado}
                onClick={() => enviarTeste(teste.modulo)}
                className="mt-3 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-40">
                {ocupado ? "corrigindo..." : "entregar o teste"}
              </button>
            )}
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className="mt-4">
            <h2 className="text-base font-semibold">
              {resultado.aprovado ? "✅ Aprovado" : "Não passou desta vez"} —{" "}
              {resultado.modulo}
            </h2>
            <p className="text-sm text-gray-700">
              {resultado.acertos} de {resultado.total} certas.
              {!resultado.aprovado && (
                <> Os tópicos foram reabertos; você pode refazer o teste em{" "}
                  {resultado.refazer_em_horas} horas.</>
              )}
            </p>
            <div className="mt-3 space-y-2">
              {resultado.itens.map((i, n) => (
                <div key={n} className={`rounded border p-2 text-sm ${
                  i.certo ? "bg-green-50" : "bg-red-50"}`}>
                  <div className="font-medium">{i.certo ? "✅" : "❌"} {i.pergunta}</div>
                  <div className="text-gray-700">Você: {i.sua_resposta || "—"}</div>
                  {!i.certo && (
                    <>
                      <div className="text-gray-700">{i.comentario}</div>
                      <div className="mt-1 text-gray-600">
                        Resposta certa: {i.gabarito}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => { setResultado(null); carregar(); }}
              className="mt-3 rounded border px-3 py-1 text-sm hover:bg-gray-50">
              voltar ao treinamento
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
