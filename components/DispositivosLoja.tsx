"use client";

// Painel de DISPOSITIVOS de uma loja (app de balcão): lista online/offline,
// cria um novo (mostra o CÓDIGO de uso único 1 vez) e revoga (force-logout).

import { useCallback, useEffect, useState } from "react";
import {
  criarDispositivo,
  excluirDispositivo,
  listarDispositivos,
  revogarDispositivo,
  type Dispositivo,
  type DispositivoCriado,
} from "@/lib/api";

// Download servido pelo próprio site (rota /baixar-app), que busca o instalador
// na Release privada usando o token do servidor. Link estável no nosso domínio.
const APP_DOWNLOAD_URL = "/baixar-app";

function statusBadge(d: Dispositivo): { txt: string; cls: string } {
  if (d.status === "revogado") return { txt: "Revogado", cls: "badge-gray" };
  if (d.status === "pendente") return { txt: "Aguardando ativação", cls: "badge-amber" };
  return d.online
    ? { txt: "● Online", cls: "badge-green" }
    : { txt: "○ Offline", cls: "badge-gray" };
}

function quando(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function DispositivosLoja({
  lojaId,
  lojaNome,
  onClose,
}: {
  lojaId: number;
  lojaNome: string;
  onClose: () => void;
}) {
  const [lista, setLista] = useState<Dispositivo[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const [nome, setNome] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState<DispositivoCriado | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLista(await listarDispositivos(lojaId));
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setCarregando(false);
    }
  }, [lojaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criar() {
    if (!nome.trim()) return;
    setCriando(true);
    setErro("");
    try {
      const d = await criarDispositivo({
        loja_id: lojaId, nome: nome.trim(), pessoa: pessoa.trim() || undefined,
      });
      setNovo(d);
      setNome("");
      setPessoa("");
      await carregar();
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setCriando(false);
    }
  }

  async function revogar(d: Dispositivo) {
    if (!confirm(`Revogar "${d.nome}"? O app deste dispositivo será desconectado.`)) return;
    try {
      await revogarDispositivo(d.id);
      await carregar();
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }

  async function remover(d: Dispositivo) {
    if (!confirm(`Excluir "${d.nome}" da lista?`)) return;
    try {
      await excluirDispositivo(d.id);
      await carregar();
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold">Dispositivos da loja</h2>
            <p className="text-xs text-slate-500">{lojaNome} · app de balcão</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {erro && <div className="card p-3 border-red-200 bg-red-50 text-sm text-red-700">{erro}</div>}

          {/* baixar o instalador do app (mesmo .exe para todas as lojas) */}
          <div className="card p-4 border-slate-200 flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">1. Instale o app no PC da loja</div>
              <div className="text-xs text-slate-500">
                Baixe e instale; depois ative com o código abaixo.
              </div>
            </div>
            {APP_DOWNLOAD_URL ? (
              <a className="btn-primary" href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                ⬇ Baixar instalador
              </a>
            ) : (
              <span className="text-xs text-slate-400">instalador ainda não publicado</span>
            )}
          </div>

          {/* código recém-gerado (aparece 1 vez) */}
          {novo && (
            <div className="card p-4 border-emerald-200 bg-emerald-50">
              <div className="text-sm font-semibold text-emerald-800 mb-1">
                Dispositivo criado — código de ativação (anote agora, aparece só desta vez):
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono font-bold tracking-widest">{novo.codigo}</span>
                <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(novo.codigo)}>
                  copiar
                </button>
              </div>
              <div className="text-xs text-emerald-700 mt-1">
                Digite este código no app instalado no PC da loja. Validade: {quando(novo.codigo_expira_em)}.
              </div>
            </div>
          )}

          {/* criar novo */}
          <div className="card p-4 space-y-3 border-slate-200">
            <div className="text-sm font-medium">2. Gere o código de ativação</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Nome do dispositivo</label>
                <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="PC do caixa" />
              </div>
              <div>
                <label className="label">Pessoa / responsável (opcional)</label>
                <input className="input" value={pessoa} onChange={(e) => setPessoa(e.target.value)} placeholder="Maria (gerente)" />
              </div>
            </div>
            <button className="btn-primary" onClick={criar} disabled={criando || !nome.trim()}>
              {criando ? "Gerando…" : "Gerar código de ativação"}
            </button>
          </div>

          {/* lista */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Dispositivos cadastrados</div>
            {carregando ? (
              <p className="text-sm text-slate-400">Carregando…</p>
            ) : lista.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum dispositivo ainda.</p>
            ) : (
              lista.map((d) => {
                const b = statusBadge(d);
                return (
                  <div key={d.id} className="card p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {d.nome} {d.pessoa && <span className="text-slate-400">· {d.pessoa}</span>}
                      </div>
                      <div className="text-xs text-slate-400">
                        Visto por último: {quando(d.ultimo_visto_em)}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={b.cls}>{b.txt}</span>
                      {d.status === "ativo" && (
                        <button onClick={() => revogar(d)} className="text-xs text-red-500 hover:underline">revogar</button>
                      )}
                      {d.status !== "ativo" && (
                        <button onClick={() => remover(d)} className="text-xs text-slate-400 hover:underline">excluir</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
