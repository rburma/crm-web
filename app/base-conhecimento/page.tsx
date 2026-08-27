"use client";

// Base de Conhecimento — upload em LOTE: o lote define o público (marca +
// nível + classes) e todos os arquivos escolhidos herdam esses campos.
// Uploads seguem em paralelo, DIRETO ao Render (proxy limita 4,5MB).

import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import {
  BaseConteudoItem, BaseDuplicados, BaseMarkdownRelatorio, BaseExtracaoEstado, BaseMedicao, BaseOpcoes,
  BasePanorama, BaseProgresso, BaseVetores, baseContarOnboarding, baseConteudos,
  baseConverterMarkdown, baseDuplicados, baseDuplicidadeIndice,
  baseLimparDuplicidadeIndice, baseExtrairColher, baseExtrairEnviar, baseExtrairEstado,
  baseExtrairPublicar, baseLote, baseMoverModulo, baseOpcoes,
  basePanoramaOnboarding, basePreparar, baseProgresso, baseProjetarOnboarding,
  baseRelatorioMarkdown, baseRemoverDuplicados, baseTicket, baseUploadDireto, baseVetoresLote,
  baseVetoresProgresso,
  baseCorrigirNomes,
} from "@/lib/api";

type ItemFila = {
  arquivo: File;
  estado: "aguardando" | "subindo" | "ok" | "erro";
  msg?: string;
  link?: string;
};

/** Uma ferramenta de manutenção: o que ela faz vem escrito do lado.
 *  Link solto sem explicação vira "salada de links que ninguém sabe para
 *  que serve" — foi o que a tela virou em um dia. */
function Ferramenta({ onClick, rotulo, ajuda, perigo }: {
  onClick: () => void; rotulo: string; ajuda: string; perigo?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <button onClick={onClick}
        className={`shrink-0 rounded border px-2 py-0.5 text-xs hover:bg-gray-50 ${
          perigo ? "border-red-300 text-red-700" : "text-gray-700"}`}>
        {rotulo}
      </button>
      <span className="text-xs text-gray-500">{ajuda}</span>
    </div>
  );
}

export default function BaseConhecimentoPage() {
  const [opcoes, setOpcoes] = useState<BaseOpcoes | null>(null);
  const [marca, setMarca] = useState("Todas as marcas");
  const [nivel, setNivel] = useState("Lojas");
  const [receituario, setReceituario] = useState(false);
  const [soFranqueados, setSoFranqueados] = useState(false);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [historico, setHistorico] = useState<BaseConteudoItem[]>([]);
  const [erro, setErro] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    baseOpcoes().then(setOpcoes).catch((e) => setErro(String(e.message || e)));
    baseConteudos().then(setHistorico).catch(() => {});
  }, []);

  function escolher(files: FileList | null) {
    if (!files || !files.length) return;
    const novos = Array.from(files).map((f) => ({
      arquivo: f, estado: "aguardando" as const,
    }));
    setFila((q) => [...q, ...novos]);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Sobe os arquivos indicados. LIMITE de 3 por vez + 3 tentativas com espera
  // crescente: mandar tudo de uma vez derrubava o servidor ("Failed to fetch").
  async function enviar(indices: number[]) {
    if (indices.length === 0 || subindo) return;
    setSubindo(true);
    setErro("");
    try {
      const { ticket } = await baseTicket();
      const classes = [
        receituario ? "receituario" : "",
        soFranqueados ? "so_franqueados" : "",
      ].filter(Boolean).join(",");
      const pendentes = [...indices];

      async function trabalhador() {
        for (;;) {
          const idx = pendentes.shift();
          if (idx === undefined) return;
          const item = fila[idx];
          if (!item) continue;
          setFila((q) => q.map((x, i) => (i === idx ? { ...x, estado: "subindo", msg: undefined } : x)));
          let ultimoErro = "";
          for (let tentativa = 1; tentativa <= 3; tentativa++) {
            try {
              const r = await baseUploadDireto(ticket, item.arquivo, marca, nivel, classes);
              setFila((q) => q.map((x, i) =>
                (i === idx ? { ...x, estado: "ok", link: r.box_link, msg: undefined } : x)));
              ultimoErro = "";
              break;
            } catch (e: unknown) {
              ultimoErro = e instanceof Error ? e.message : String(e);
              if (tentativa < 3) {
                setFila((q) => q.map((x, i) => (i === idx
                  ? { ...x, msg: `tentativa ${tentativa} falhou, repetindo...` } : x)));
                await new Promise((r) => setTimeout(r, tentativa * 2500));
              }
            }
          }
          if (ultimoErro) {
            setFila((q) => q.map((x, i) =>
              (i === idx ? { ...x, estado: "erro", msg: ultimoErro } : x)));
          }
        }
      }
      await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
      baseConteudos().then(setHistorico).catch(() => {});
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSubindo(false);
    }
  }

  function enviarLote() {
    const idx = fila.map((i, n) => (i.estado === "aguardando" ? n : -1)).filter((n) => n >= 0);
    return enviar(idx);
  }

  function repetirFalhas() {
    const idx = fila.map((i, n) => (i.estado === "erro" ? n : -1)).filter((n) => n >= 0);
    return enviar(idx);
  }

  const aguardando = fila.filter((i) => i.estado === "aguardando").length;
  const falhas = fila.filter((i) => i.estado === "erro").length;
  const maxMb = opcoes?.max_mb ?? 45;
  const [statusIdx, setStatusIdx] = useState("");
  const [medicao, setMedicao] = useState<BaseMedicao | null>(null);
  const [idiomas, setIdiomas] = useState<Record<string, number>>({});
  const [medindo, setMedindo] = useState("");
  const [extr, setExtr] = useState<BaseExtracaoEstado | null>(null);
  const [extrMsg, setExtrMsg] = useState("");
  const [panorama, setPanorama] = useState<string>("");
  const [pan, setPan] = useState<BasePanorama | null>(null);
  const [dup, setDup] = useState<string>("");
  const [md, setMd] = useState<string>("");
  // Regra 11: a tela juntou 15 controles em um dia. O que se usa no
  // dia a dia fica a vista; o resto e ferramenta de manutencao e so
  // aparece quando pedida.
  const [ferramentas, setFerramentas] = useState(false);
  // Gavetas (26/08/2026): o que virou automatico sai da cara. Fechadas por
  // padrao — quem abre e' quem sabe que precisa.
  const [manut, setManut] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const [nomesMsg, setNomesMsg] = useState("");

  // Conserta os nomes de envio gravados com encoding errado (26/08). Repete
  // em lote ate' zerar, como as outras rotinas da tela.
  async function corrigirNomes() {
    setNomesMsg("Conferindo cada envio com o Box...");
    try {
      let cursor: number | undefined = undefined;
      let vistos = 0, total = 0;
      let amostra = "";
      for (let i = 0; i < 40; i++) {
        const r = await baseCorrigirNomes(25, cursor);
        vistos += r.verificados;
        total += r.corrigidos;
        if (!amostra && r.exemplos.length) amostra = r.exemplos[0].banco;
        setNomesMsg(`conferidos ${vistos} · corrigidos ${total}`);
        if (r.acabou || !r.proximo_cursor) break;
        cursor = r.proximo_cursor;
      }
      // Diagnostico honesto: "0 corrigidos" sem dizer o que foi visto nao
      // ajuda ninguem (foi o que aconteceu na 1a tentativa, em 26/08).
      setNomesMsg(total
        ? `Pronto: ${total} nome(s) corrigido(s) de ${vistos} conferidos.`
        : `Conferi ${vistos} envio(s) e o Box devolveu o mesmo nome em todos`
          + (amostra ? ` (ex.: ${amostra})` : "")
          + ". Ou seja: o nome torto está no próprio Box, não só aqui.");
      baseConteudos().then(setHistorico).catch(() => {});
    } catch (e: unknown) {
      setNomesMsg(e instanceof Error ? e.message : String(e));
    }
  }

  const [ondb, setOndb] = useState(false);
  const [dupARemover, setDupARemover] = useState(0);
  const [movDe, setMovDe] = useState("");
  const [movPara, setMovPara] = useState("");

  const [prog, setProg] = useState<BaseProgresso | null>(null);
  const pararRef = useRef(false);

  // Onboarding: so CONTA os tokens das transcricoes e mostra o preco.
  // Nao gera texto nem grava nada — e seguro clicar. Em lotes, igual a
  // indexacao: cada volta e uma requisicao curta.
  async function medirCusto() {
    setMedicao(null);
    setIdiomas({});
    setMedindo("Contando os tokens das transcrições...");
    try {
      let inicio = 0;
      let tokens = 0;
      let arquivos = 0;
      let documentos = 0;
      const idi: Record<string, number> = {};
      for (;;) {
        const c = await baseContarOnboarding(inicio);
        if (c.erro) { setMedindo(c.erro); return; }
        tokens += c.tokens;
        arquivos += c.arquivos_medidos;
        documentos += c.documentos || 0;
        for (const [k, v] of Object.entries(c.por_idioma)) {
          idi[k] = (idi[k] || 0) + v;
        }
        setMedindo(`Contando ${arquivos} de ${c.arquivos} transcrições...`);
        if (c.proximo === null) break;
        inicio = c.proximo;
      }
      setIdiomas(idi);
      setMedicao(await baseProjetarOnboarding(tokens, arquivos, documentos));
      setMedindo("");
    } catch (e) {
      setMedindo("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Onboarding etapa 2. UM botao que faz "o proximo passo que der para fazer
  // agora": envia o que falta, colhe o que voltou, publica no Box. Como o lote
  // da Anthropic leva ate 1h, o normal e clicar hoje e clicar de novo depois —
  // e ele se acerta sozinho a partir do que ja esta gravado.
  async function resumosOnboarding() {
    setExtrMsg("Verificando...");
    try {
      // Repete o ciclo enquanto houver o que fazer. Um lote pode TERMINAR na
      // Anthropic durante a propria colheita: na versao anterior isso ficava
      // para o clique seguinte e o Renato via a tela parada em 100 de 288 sem
      // saber que faltava clicar. Quem descobre lote terminado e' a consulta
      // de estado, entao ela abre e fecha cada volta.
      let st = await baseExtrairEstado();
      for (let volta = 0; volta < 12; volta++) {
        for (;;) {
          const r = await baseExtrairEnviar();
          if (!r.enviados) break;
          setExtrMsg(`Enviado para a Anthropic — faltam ${r.faltam} transcrições`);
        }
        for (;;) {
          const c = await baseExtrairColher();
          if (!c.colhidos && !c.falhas) break;
          setExtrMsg(`Gravando resumos... (${c.colhidos} neste lote)`);
        }
        for (;;) {
          const p = await baseExtrairPublicar();
          if (!p.publicados) break;
          setExtrMsg(`Publicando no Box... faltam ${p.faltam}`);
        }
        st = await baseExtrairEstado();
        setExtr(st);
        if (st.faltam_enviar === 0 && st.a_colher === 0 && st.a_publicar === 0) {
          break;   // so resta esperar a Anthropic, ou acabou mesmo
        }
      }
      setExtrMsg(st.rodando > 0
        ? `${st.rodando} lote(s) ainda na fila da Anthropic. Costuma levar `
          + `menos de 1 hora (limite 24h). Volte e clique de novo.`
        : "");
    } catch (e) {
      setExtrMsg("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Reprocessa o acervo inteiro com o prompt novo. Este GASTA — por isso e o
  // unico ponto da tela com confirmacao. Apaga os resumos e reenvia tudo.
  async function reprocessarTudo() {
    if (!confirm(
      "Isto apaga os 288 resumos e gera todos de novo, com o prompt novo "
      + "(módulos e marcas em lista fechada, pode/não pode só para regra, "
      + "3 a 5 perguntas).\n\nCusta cerca de US$ 4,95 e leva até 1 hora.\n\n"
      + "Confirma?")) return;
    setExtrMsg("Apagando os resumos antigos e reenviando...");
    try {
      let primeira = true;   // só a primeira chamada apaga
      for (;;) {
        const r = await baseExtrairEnviar(50, primeira);
        primeira = false;
        if (!r.enviados) break;
        setExtrMsg(`Reenviado — faltam ${r.faltam} transcrições`);
      }
      setExtr(await baseExtrairEstado());
      setExtrMsg("Reenviado. Volte em cerca de 1 hora e clique em "
        + "“resumos do onboarding” para colher.");
    } catch (e) {
      setExtrMsg("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Converte os documentos (PDF/Word/PPT/Excel) em .md ao lado do original.
  // Mecanico: sem modelo, sem custo, sem risco de inventar conteudo. Nao
  // apaga e nao move nada — o Renato tira os originais depois, ele mesmo.
  async function converterMarkdown() {
    setMd("Convertendo...");
    try {
      let total = 0;
      for (;;) {
        const r = await baseConverterMarkdown();
        if (!r.convertidos && !r.avisos?.length) break;
        total += r.convertidos;
        setMd(`Convertidos ${total} — faltam ${r.faltam}`);
        if (r.faltam === 0) break;
      }
      await verRelatorioMd();
    } catch (e) {
      setMd("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function verRelatorioMd() {
    try {
      const r: BaseMarkdownRelatorio = await baseRelatorioMarkdown();
      setMd([
        `${r.convertidos} documento(s) convertidos · faltam ${r.faltam}`,
        "",
        // Encolher é o único jeito de a troca piorar a busca: o Q&A passa a
        // consultar o .md, e o que não veio junto some para quem pergunta.
        `ENCOLHERAM — NÃO trocar sem olhar (${r.encolheram.length})`,
        ...r.encolheram.map((e) =>
          `  -${e.perdeu_pct}%  ${e.arquivo}  (${e.antes} → ${e.depois})`),
        "",
        `SEM TEXTO — provável PDF escaneado, precisa de OCR `
          + `(${r.sem_texto_provavel_ocr.length})`,
        ...r.sem_texto_provavel_ocr.map((a) => `  - ${a}`),
        "",
        `FALHAS (${r.falhas.length})`,
        ...r.falhas.map((a) => `  - ${a}`),
        "",
        `INDEXADOS MAIS DE UMA VEZ (${r.duplicados_no_indice.length})`,
        ...r.duplicados_no_indice.map((d) =>
          `  ${d.vezes_no_indice}x  ${d.arquivo}  `
          + `(texto real: ${d.letras_reais})`),
      ].join("\n"));
    } catch (e) {
      setMd("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Trecho repetido no indice: a mesma passagem volta 2 ou 3 vezes na busca
  // e empurra resultado bom para baixo. Some junto o vetor da linha apagada,
  // por isso a copia que FICA e' de preferencia uma que ja tem vetor.
  async function limparIndice() {
    const d = await baseDuplicidadeIndice();
    if (!d.duplicados) { setMd("Nenhum trecho repetido no índice."); return; }
    if (!confirm(`O índice tem ${d.trechos} trechos, dos quais `
      + `${d.duplicados} são cópia (${d.duplicados_ja_vetorizados} já `
      + `vetorizados).

Apagar as cópias, mantendo uma de cada?`)) return;
    setMd("Limpando...");
    try {
      const r = await baseLimparDuplicidadeIndice();
      setMd(`${r.removidos} trecho(s) repetidos removidos. `
        + `O índice ficou com ${r.depois.trechos}.`);
    } catch (e) {
      setMd("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Duplicados: detecta pelo TEXTO. Titulo parecido nao prova nada.
  async function verDuplicados() {
    setDup("procurando...");
    try {
      const d = await baseDuplicados();
      const grupo = (g: BaseDuplicados["identicos"][number]) =>
        g.arquivos.map((a) => `    - ${a.titulo || a.arquivo} `
          + `(${a.letras} letras)`).join("\n");
      setDup([
        `A REMOVER: ${d.a_remover} resumo(s) · A MARCAR como ignorados: `
          + `${d.a_marcar} (já apagados antes; marcar impede o reenvio)`,
        "",
        `IDENTICOS — mesmo texto (${d.identicos.length} grupos)`,
        ...d.identicos.map((g) => `  grupo de ${g.quantos}:\n${grupo(g)}`),
        "",
        `PRATICAMENTE IDENTICOS — mesma gravação transcrita 2x `
          + `(${d.praticamente_identicos.length} grupos)`,
        ...d.praticamente_identicos.map((g) =>
          `  grupo de ${g.quantos} — semelhança `
          + `${g.semelhanca_pct.join("%, ")}%:\n${grupo(g)}`),
        "",
        `PARECIDOS — NAO entram na remoção, alguém precisa olhar `
          + `(${d.parecidos.length} grupos)`,
        ...d.parecidos.map((g) =>
          `  grupo de ${g.quantos} — semelhança `
          + `${g.semelhanca_pct.join("%, ")}%:\n${grupo(g)}`),
      ].join("\n"));
      setDupARemover(d.a_remover + d.a_marcar);
    } catch (e) {
      setDup("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function apagarDuplicados() {
    if (!confirm(`Apaga ${dupARemover} resumo(s) redundantes: os grupos `
      + "idênticos e os de 95% ou mais (mesma gravação transcrita duas vezes). "
      + "Mantém o primeiro de cada grupo.\n\n"
      + "Os grupos abaixo de 95% NÃO são tocados.\n"
      + "Não mexe nos vídeos do Box.\n\nConfirma?")) return;
    setDup("apagando...");
    try {
      const r = await baseRemoverDuplicados();
      setExtr(await baseExtrairEstado());
      setDup(`${r.removidos} removido(s) e ${r.marcados} marcado(s) como `
        + `ignorados — estes não voltam mais para a fila. ${r.aviso}`);
    } catch (e) {
      setDup("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Reatribui modulo sem repagar extracao: quando so o rotulo esta errado.
  async function moverModulo() {
    if (!movDe || !movPara || movDe === movPara) return;
    setDup("movendo...");
    try {
      const r = await baseMoverModulo(movDe, movPara);
      setDup(r.erro ? r.erro
        : `${r.movidos} vídeo(s) movidos de “${movDe}” para “${movPara}”. `
          + `${r.nota || ""}`);
      await verPanorama();
    } catch (e) {
      setDup("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Refaz SO o que ficou errado: os classificados como "Fora do escopo" (a
  // lista de modulos tinha um buraco, e o modelo jogou tudo la) e os que
  // sairam com menos de 3 perguntas. Sao ~23 arquivos, centavos.
  async function corrigirClassificacao() {
    if (!confirm(
      "Isto refaz apenas os vídeos classificados como “Fora do escopo” e os "
      + "que ficaram com menos de 3 perguntas — cerca de 23 arquivos.\n\n"
      + "Custa uns US$ 0,40 e leva até 1 hora.\n\nConfirma?")) return;
    setExtrMsg("Apagando os resumos errados e reenviando...");
    try {
      let primeira = true;   // só a primeira chamada apaga
      for (;;) {
        const r = await baseExtrairEnviar(
          50, false, primeira ? "Fora do escopo" : undefined, primeira);
        primeira = false;
        if (!r.enviados) break;
        setExtrMsg(`Reenviado — faltam ${r.faltam}`);
      }
      setExtr(await baseExtrairEstado());
      setExtrMsg("Reenviado. Volte em cerca de 1 hora e clique em "
        + "“resumos do onboarding”.");
    } catch (e) {
      setExtrMsg("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Panorama em TEXTO PURO, nao em tabela: a serventia dele e ser copiado e
  // colado inteiro numa conversa para decidir a arvore da trilha.
  async function verPanorama() {
    setPanorama("carregando...");
    try {
      const p: BasePanorama = await basePanoramaOnboarding();
      setPan(p);
      const bloco = (titulo: string, itens: { nome: string; videos: number }[]) =>
        [`${titulo} (${itens.length})`,
          ...itens.map((i) => `  ${String(i.videos).padStart(4)}  ${i.nome}`),
          ""].join("\n");
      setPanorama([
        `PANORAMA DO ONBOARDING — ${p.total} videos resumidos`,
        "",
        bloco("MODULOS", p.modulos),
        bloco("MARCAS", p.marcas),
        bloco("PUBLICOS", p.publicos),
        bloco("PERGUNTAS POR VIDEO", p.perguntas_por_video),
        `SEM REGRA (pode/nao pode vazios): `
          + `${p.videos_sem_pode_nem_nao_pode} de ${p.total}`,
        ...p.sem_regra_por_modulo.map(
          (i) => `  ${String(i.videos).padStart(4)}  ${i.nome}`),
        "",
        `FORA DO ESCOPO (${p.fora_do_escopo.length})`,
        ...p.fora_do_escopo.map((t) => `  - ${t}`),
        "",
        `COM MENOS DE 3 PERGUNTAS (${p.com_menos_de_3_perguntas.length})`,
        ...p.com_menos_de_3_perguntas.map((t) => `  - ${t}`),
        "",
        "TITULOS POR MODULO",
        ...p.titulos_por_modulo.flatMap((m) => [
          "", `${m.modulo} (${m.titulos.length})`,
          ...m.titulos.map((t) => `  - ${t}`),
        ]),
      ].join("\n"));
    } catch (e) {
      setPanorama("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Reescreve no Box tudo o que ja foi publicado. Necessario quando o
  // conteudo mudou depois da publicacao — prompt novo, reprocessamento, ou
  // conserto (em 14/08 os 288 subiram em branco por causa de um filtro).
  async function republicarTudo() {
    setExtrMsg("Reescrevendo os resumos no Box...");
    try {
      let primeira = true;   // so a primeira chamada zera o que ja foi publicado
      let total = 0;
      for (;;) {
        const p = await baseExtrairPublicar(8, primeira);
        primeira = false;
        if (!p.publicados) break;
        total += p.publicados;
        setExtrMsg(`Reescrevendo no Box... faltam ${p.faltam}`);
      }
      setExtr(await baseExtrairEstado());
      // O numero importa: "0 reescritos" e um diagnostico, nao um sucesso.
      setExtrMsg(total > 0
        ? `${total} arquivo(s) reescritos no Box.`
        : "Nenhum arquivo foi reescrito — não há resumo com conteúdo gravado.");
    } catch (e) {
      setExtrMsg("Falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Indexa em lotes pequenos: cada volta e uma requisicao CURTA. Se o
  // servidor reiniciar, e so clicar de novo — a fila fica no banco.
  async function indexar(completo = false) {
    if (completo && !window.confirm(
      "Refazer a indexação do ZERO? Leva bem mais tempo.")) return;
    pararRef.current = false;
    setStatusIdx("Montando a fila de arquivos...");
    try {
      let p = await basePreparar(completo);
      setProg(p);
      while (p.pendentes > 0 && !pararRef.current) {
        setStatusIdx(`Indexando ${p.feitos} de ${p.total} (${p.percentual}%)`);
        try {
          p = await baseLote(4);
        } catch {
          // erro de rede/reinício: espera e tenta de novo do ponto atual
          await new Promise((r) => setTimeout(r, 5000));
          try { p = await baseProgresso(); } catch { break; }
        }
        setProg(p);
      }
      setStatusIdx(pararRef.current
        ? `Pausado em ${p.feitos} de ${p.total}`
        : `Concluída: ${p.ok} indexados, ${p.vazios} sem texto, ` +
          `${p.erros} com erro, ${p.grandes} grandes demais — ` +
          `${p.trechos} trechos no índice`);
    } catch (e: unknown) {
      setStatusIdx(e instanceof Error ? e.message : String(e));
    }
  }

  const [vet, setVet] = useState<BaseVetores | null>(null);

  // Gera os vetores de significado em lotes (busca semantica).
  async function gerarVetores() {
    pararRef.current = false;
    try {
      let v = await baseVetoresProgresso();
      setVet(v);
      if (!v.configurado) {
        setStatusIdx("Falta a chave VOYAGE_API_KEY no servidor.");
        return;
      }
      let seguidas = 0;  // falhas em sequencia: nao girar em falso
      while (v.faltam > 0 && !pararRef.current) {
        setStatusIdx(`Entendendo o conteúdo: ${v.com_vetor} de ${v.total} (${v.percentual}%)`);
        try {
          const antes = v.com_vetor;
          // 32 por requisição (o servidor divide em chamadas de 8 à Voyage):
          // menos idas e vindas, mesma folga de memória.
          v = await baseVetoresLote(32);
          seguidas = v.com_vetor > antes ? 0 : seguidas + 1;
        } catch (e: unknown) {
          seguidas += 1;
          const msg = e instanceof Error ? e.message : String(e);
          setStatusIdx(`Erro ao gerar vetores: ${msg}`);
          if (seguidas >= 3) return;   // mostra o erro e para
          await new Promise((r) => setTimeout(r, 4000));
          try { v = await baseVetoresProgresso(); } catch { return; }
        }
        if (seguidas >= 3) {
          setStatusIdx("Parou sem avançar — veja o motivo em /base/diagnostico");
          return;
        }
        setVet(v);
      }
      setStatusIdx(pararRef.current
        ? `Pausado: ${v.com_vetor} de ${v.total}`
        : `Busca semântica pronta: ${v.com_vetor} trechos (${v.modelo})`);
    } catch (e: unknown) {
      setStatusIdx(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    baseProgresso().then((p) => {
      setProg(p);
      if (p.total) setStatusIdx(`${p.feitos} de ${p.total} indexados`);
    }).catch(() => {});
    baseVetoresProgresso().then(setVet).catch(() => {});
    baseExtrairEstado().then(setExtr).catch(() => {});
  }, []);

  return (
    <Shell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">📚 Base de Conhecimento</h1>
          <p className="text-sm text-gray-500">
            Escolha o público, jogue os arquivos e pronto: eles sobem para o
            Box e <b>já ficam buscáveis</b> — indexados e entendidos, sem mais
            nenhum passo. Áudio e vídeo vão para a fila de transcrição.
            Acima de {maxMb} MB: suba direto na pasta do Box.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 space-y-3">
          <div className="font-semibold">➕ Adicionar material</div>
          <div className="text-xs text-gray-500 -mt-2">
            Passo 1 de 2 — para quem é este lote
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-sm">
              Marca{" "}
              <select value={marca} onChange={(e) => setMarca(e.target.value)}
                disabled={nivel === "Interno"}
                className="border rounded px-2 py-1">
                {(opcoes?.marcas ?? [marca]).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Nível{" "}
              <select value={nivel} onChange={(e) => setNivel(e.target.value)}
                className="border rounded px-2 py-1">
                {(opcoes?.niveis ?? [nivel]).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="text-sm flex items-center gap-1">
              <input type="checkbox" checked={receituario}
                onChange={(e) => setReceituario(e.target.checked)} />
              Receituário (proteção anti-extração)
            </label>
            <label className="text-sm flex items-center gap-1">
              <input type="checkbox" checked={soFranqueados}
                onChange={(e) => setSoFranqueados(e.target.checked)} />
              Só franqueados (nem callcenter)
            </label>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 space-y-3">
          <div className="text-xs text-gray-500">
            Passo 2 de 2 — os arquivos
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="cursor-pointer inline-block bg-blue-600 text-white rounded px-4 py-2 text-sm">
              Escolher arquivos
              <input ref={inputRef} type="file" multiple className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.mp3,.m4a,.wav,.mp4,.mov,.wmv,.avi"
                onChange={(e) => escolher(e.target.files)} />
            </label>
            <button onClick={enviarLote}
              disabled={subindo || aguardando === 0}
              className="rounded px-4 py-2 text-sm bg-green-600 text-white disabled:opacity-40">
              {subindo ? "Enviando..." : `Enviar lote (${aguardando})`}
            </button>
            {falhas > 0 && (
              <button onClick={repetirFalhas} disabled={subindo}
                className="rounded px-4 py-2 text-sm bg-amber-600 text-white disabled:opacity-40">
                🔄 Tentar novamente as {falhas} que falharam
              </button>
            )}
            {fila.length > 0 && !subindo && (
              <button onClick={() => setFila((q) => q.filter((i) => i.estado !== "ok"))}
                className="rounded border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                limpar concluídos
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Os arquivos sobem 3 por vez, com 3 tentativas automáticas cada —
            falhas de rede se resolvem sozinhas na maioria das vezes.
          </p>
          {erro && <div className="text-sm text-red-600">{erro}</div>}
          {fila.length > 0 && (
            <ul className="text-sm divide-y">
              {fila.map((i, idx) => (
                <li key={idx} className="py-1 flex items-center gap-2">
                  <span>
                    {i.estado === "ok" ? "✅" : i.estado === "erro" ? "❌"
                      : i.estado === "subindo" ? "⏳" : "•"}
                  </span>
                  <span className="flex-1 truncate">{i.arquivo.name}</span>
                  <span className="text-gray-400">
                    {(i.arquivo.size / 1048576).toFixed(1)} MB
                  </span>
                  {i.link && (
                    <a href={i.link} target="_blank" rel="noreferrer"
                      className="text-blue-600 underline">Box</a>
                  )}
                  {i.msg && (
                    <span className={i.estado === "erro" ? "text-red-600" : "text-gray-500"}>
                      {i.msg}
                    </span>
                  )}
                  {i.estado === "erro" && !subindo && (
                    <button onClick={() => enviar([idx])}
                      className="rounded border border-amber-400 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-50">
                      tentar de novo
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="font-semibold text-sm mb-1">💚 Saúde da base</div>
          <div className="text-sm text-gray-700">
            {prog ? `${prog.feitos} de ${prog.total} arquivos · ${prog.trechos} trechos` : "carregando..."}
            {vet && vet.total > 0 && (
              <> · {vet.faltam === 0
                ? `busca por significado pronta (${vet.com_vetor} trechos)`
                : `entendendo conteúdo: ${vet.com_vetor} de ${vet.total}`}</>
            )}
          </div>
          {prog && prog.total > 0 && (
            <div className="mt-1 h-2 w-full rounded bg-gray-200">
              <div className="h-2 rounded bg-green-600 transition-all"
                style={{ width: `${prog.percentual}%` }} />
            </div>
          )}
          {statusIdx && (
            <div className="mt-1 text-xs text-gray-600">{statusIdx}</div>
          )}
          {prog && prog.pendentes > 0 && (
            <div className="mt-1 text-xs text-amber-700">
              {prog.pendentes} arquivo(s) na fila — a base termina sozinha.
              {" "}<button onClick={() => indexar(false)} className="underline">
                terminar agora
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm">Últimos envios</div>
            {historico.length > 5 && (
              <button onClick={() => setVerTodos(!verTodos)}
                className="text-xs text-gray-500 underline hover:text-gray-800">
                {verTodos ? "mostrar menos" : `ver todos (${historico.length})`}
              </button>
            )}
          </div>
          {historico.length === 0 ? (
            <div className="text-sm text-gray-400">Nada enviado ainda.</div>
          ) : (
            <ul className="text-sm divide-y">
              {(verTodos ? historico : historico.slice(0, 5)).map((h) => (
                <li key={h.id} className="py-1 flex items-center gap-2 flex-wrap">
                  <span className="flex-1 truncate">{h.nome}</span>
                  {h.criado_em && (
                    <span className="text-gray-400 whitespace-nowrap">
                      {new Date(h.criado_em).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {h.status === "indexado" && (
                    <span className="text-green-700">indexado</span>
                  )}
                  {h.status === "sem_texto" && (
                    <span className="text-amber-700">sem texto (OCR?)</span>
                  )}
                  {h.status === "aguarda_transcricao" && (
                    <span className="text-blue-700">transcrevendo</span>
                  )}
                  <span className="text-gray-500">{h.marca} · {h.nivel}</span>
                  {h.classes && (
                    <span className="text-amber-600">{h.classes}</span>
                  )}
                  <span className="text-gray-400">{h.tamanho_mb} MB</span>
                  {h.link && (
                    <a href={h.link} target="_blank" rel="noreferrer"
                      className="text-blue-600 underline">Box</a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>


        <div className="rounded-xl border bg-white p-4">
          <button onClick={() => setManut(!manut)}
            className="text-sm font-semibold text-gray-600 hover:text-gray-900">
            {manut ? "▾" : "▸"} ⚙ Manutenção avançada
          </button>
          {manut && (
            <div className="mt-2 space-y-2">
              <div className="text-xs text-gray-500">
                Nada aqui é rotina: subir arquivo pela tela já faz tudo. Isto é
                para o que entrou direto na pasta do Box ou para consertar algo.
              </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => indexar(false)}
              disabled={!!prog && prog.pendentes > 0 && !pararRef.current}
              className="text-sm border rounded px-3 py-1 bg-white hover:bg-gray-50 disabled:opacity-40">
              ▶️ Indexar / continuar
            </button>
            <button onClick={() => indexar(true)}
              className="text-sm border rounded px-3 py-1 text-gray-500 hover:bg-gray-50">
              🔄 refazer do zero
            </button>
            <button onClick={gerarVetores}
              className="text-sm border rounded px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100">
              🧠 entender conteúdo{vet && vet.faltam > 0 ? ` (${vet.faltam})` : ""}
            </button>
            <button onClick={corrigirNomes}
              className="text-sm border rounded px-3 py-1 text-gray-600 hover:bg-gray-50">
              ✍️ corrigir nomes dos envios antigos
            </button>
            <button onClick={() => { pararRef.current = true; }}
              className="text-sm border rounded px-3 py-1 text-amber-700 hover:bg-amber-50">
              ⏸ pausar
            </button>
            {statusIdx && (
              <span className="text-xs text-gray-600">{statusIdx}</span>
            )}
            {nomesMsg && (
              <span className="text-xs text-gray-600">{nomesMsg}</span>
            )}
          </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <button onClick={() => setOndb(!ondb)}
            className="text-sm font-semibold text-gray-600 hover:text-gray-900">
            {ondb ? "▾" : "▸"} 🎓 Onboarding (outro assunto)
            {extr && extr.faltam_enviar > 0 ? ` — ${extr.faltam_enviar} a enviar` : ""}
          </button>
          {ondb && (
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-2">
                Resumos dos vídeos do acervo. Vive aqui por enquanto; merece
                tela própria.
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
            <button onClick={medirCusto} disabled={!!medindo}
              className="text-sm border rounded px-3 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              💲 medir custo do onboarding
            </button>
            <button onClick={resumosOnboarding}
              className="text-sm border rounded px-3 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100">
              🧾 resumos do onboarding
              {extr && extr.faltam_enviar > 0 ? ` (${extr.faltam_enviar})` : ""}
            </button>
              </div>
          {medindo && (
            <div className="mt-2 text-xs text-gray-600">{medindo}</div>
          )}
          {medicao && (
            <div className="mt-2 rounded border bg-gray-50 p-3 text-sm">
              <div className="font-semibold">
                Custo de resumir {medicao.arquivos} arquivos
                {medicao.documentos > 0 && (
                  <span className="font-normal">
                    {" "}({medicao.videos} vídeos + {medicao.documentos} documentos)
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {medicao.tokens_entrada_total.toLocaleString("pt-BR")} tokens de
                entrada (medidos) +{" "}
                {medicao.tokens_saida_estimados.toLocaleString("pt-BR")} de saída
                (estimados)
                {Object.keys(idiomas).length > 0 && (
                  <>. Idiomas:{" "}
                    {Object.entries(idiomas)
                      .map(([k, v]) => `${k}: ${v}`).join(", ")}</>
                )}
              </div>
              <table className="mt-2 text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pr-6">modelo</th>
                    <th className="pr-6">normal</th>
                    <th>em lote (-50%)</th>
                  </tr>
                </thead>
                <tbody>
                  {medicao.custos.map((c) => (
                    <tr key={c.modelo}>
                      <td className="pr-6">{c.rotulo}</td>
                      <td className="pr-6">US$ {c.normal_usd.toFixed(2)}</td>
                      <td className="font-semibold">
                        US$ {c.lote_usd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-xs text-gray-500">{medicao.nota}</div>
            </div>
          )}
          {extrMsg && (
            <div className="mt-2 text-xs text-gray-600">{extrMsg}</div>
          )}
          {extr && (extr.resumos > 0 || extr.rodando > 0
                    || extr.faltam_enviar < extr.acervo) && (
            <div className="mt-2 rounded border bg-amber-50 p-3 text-sm">
              <div className="font-semibold">
                Resumos do onboarding — {extr.resumos} de {extr.acervo} prontos
              </div>
              {/* Contador nao diz o que fazer. Esta linha diz. */}
              {(extr.a_colher > 0 || extr.a_publicar > 0
                || extr.faltam_enviar > 0) && (
                <div className="mt-1 rounded bg-amber-200 px-2 py-1 text-amber-900">
                  Tem trabalho pronto esperando — clique em
                  {" "}<strong>🧾 resumos do onboarding</strong> aí em cima.
                </div>
              )}
              {extr.a_colher === 0 && extr.a_publicar === 0
                && extr.faltam_enviar === 0 && extr.rodando > 0 && (
                <div className="mt-1 text-gray-700">
                  Nada a fazer agora: {extr.rodando} lote(s) ainda sendo
                  processados na Anthropic. Volte mais tarde.
                </div>
              )}
              <div className="text-xs text-gray-700 mt-1">
                {extr.faltam_enviar > 0 && (
                  <>{extr.faltam_enviar} a enviar. </>
                )}
                {extr.rodando > 0 && (
                  <>{extr.rodando} lote(s) rodando na Anthropic. </>
                )}
                {extr.a_colher > 0 && (
                  <>{extr.a_colher} lote(s) prontos para gravar. </>
                )}
                {extr.a_publicar > 0 && (
                  <>{extr.a_publicar} a publicar no Box. </>
                )}
                {extr.publicados_no_box > 0 && (
                  <>{extr.publicados_no_box} já em <code>_resumos/</code>. </>
                )}
                Modelo: {extr.modelo}.
              </div>
              {extr.amostra && (
                <div className="mt-2 rounded border bg-white p-2 text-xs">
                  <div className="font-semibold">O que está gravado (1ª linha)</div>
                  <div className="text-gray-700">
                    {extr.amostra.arquivo}
                  </div>
                  <div className={extr.amostra.campos.length === 0
                    ? "text-red-700 font-semibold" : "text-gray-700"}>
                    {extr.amostra.campos.length} campo(s)
                    {extr.amostra.campos.length > 0
                      && `: ${extr.amostra.campos.join(", ")}`}
                    {" · "}resumo com {extr.amostra.letras_no_resumo} letras
                    {" · "}tipo {extr.amostra.tipo_gravado}
                    {" · "}{extr.amostra.publicado ? "publicado" : "não publicado"}
                  </div>
                  {extr.amostra.titulo && (
                    <div className="text-gray-700">
                      Título: {extr.amostra.titulo}
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => setFerramentas(!ferramentas)}
                className="mt-2 text-xs text-gray-500 underline hover:text-gray-800">
                {ferramentas ? "▾ esconder" : "▸ mostrar"} ferramentas de manutenção
              </button>
              {ferramentas && extr.resumos > 0 && (
                <div className="mt-2 space-y-2 rounded border bg-white p-2">
                  <div className="text-xs text-gray-500">
                    Cada uma faz uma coisa só. As de custo dizem quanto custam.
                  </div>
                  <Ferramenta onClick={verPanorama} rotulo="ver panorama"
                    ajuda="Conta quantos vídeos há em cada módulo, marca e público. Só lê." />
                  <Ferramenta onClick={verDuplicados} rotulo="procurar duplicados"
                    ajuda="Acha arquivos com o mesmo conteúdo. A lista nunca esvazia: os arquivos continuam no acervo." />
                  <Ferramenta onClick={limparIndice} rotulo="limpar trechos repetidos no índice"
                    ajuda="Apaga a cópia do mesmo trecho, que hoje aparece 2 ou 3 vezes na busca." perigo />
                  <Ferramenta onClick={converterMarkdown} rotulo="converter documentos em Markdown"
                    ajuda="PDF/Word/PPT viram .md ao lado do original. Grátis, não move nem apaga nada." />
                  <Ferramenta onClick={republicarTudo}
                    rotulo={`reescrever os ${extr.resumos} arquivos no Box`}
                    ajuda="Regrava os .md de _resumos/ com o conteúdo atual do banco." />
                  <Ferramenta onClick={corrigirClassificacao}
                    rotulo="corrigir “fora do escopo” e testes incompletos"
                    ajuda="Refaz só os vídeos mal classificados. Custa ~US$ 0,40." perigo />
                  <Ferramenta onClick={reprocessarTudo}
                    rotulo="reprocessar TUDO com o prompt novo"
                    ajuda="Apaga os 283 resumos e gera todos de novo. Custa ~US$ 4,95 e leva 1 hora." perigo />
                </div>
              )}
              {panorama && (
                <pre className="mt-2 max-h-96 overflow-auto rounded border bg-white p-2 text-xs whitespace-pre">
                  {panorama}
                </pre>
              )}
              {ferramentas && pan && (
                <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                  <span className="text-gray-600">mover módulo:</span>
                  <select value={movDe} onChange={(e) => setMovDe(e.target.value)}
                    className="border rounded px-1 py-0.5">
                    <option value="">de...</option>
                    {pan.titulos_por_modulo.map((m) => (
                      <option key={m.modulo} value={m.modulo}>
                        {m.modulo} ({m.titulos.length})
                      </option>
                    ))}
                  </select>
                  <select value={movPara} onChange={(e) => setMovPara(e.target.value)}
                    className="border rounded px-1 py-0.5">
                    <option value="">para...</option>
                    {pan.titulos_por_modulo.map((m) => (
                      <option key={m.modulo} value={m.modulo}>{m.modulo}</option>
                    ))}
                  </select>
                  <button onClick={moverModulo}
                    disabled={!movDe || !movPara || movDe === movPara}
                    className="border rounded px-2 py-0.5 disabled:opacity-40">
                    mover
                  </button>
                </div>
              )}
              {md && (
                <pre className="mt-1 max-h-72 overflow-auto rounded border bg-white p-2 text-xs whitespace-pre">
                  {md}
                </pre>
              )}
              {dup && (
                <>
                  <pre className="mt-1 max-h-72 overflow-auto rounded border bg-white p-2 text-xs whitespace-pre">
                    {dup}
                  </pre>
                  <button onClick={apagarDuplicados}
                    className="mt-1 block text-xs text-red-700 underline hover:text-red-900">
                    apagar os {dupARemover} resumos redundantes
                  </button>
                </>
              )}
              {extr.lotes.some((l) => l.falhas > 0) && (
                <div className="mt-1 text-xs text-amber-800">
                  {extr.lotes.reduce((s, l) => s + l.falhas, 0)} transcrição(ões)
                  falharam — clicar de novo tenta só as que faltam.
                </div>
              )}
              {extr.orfaos && extr.orfaos.length > 0 && (
                <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs">
                  <div className="font-semibold text-red-800">
                    {extr.orfaos.length} lote(s) existem na Anthropic e não aqui
                    — foram pagos sem ficar registrados.
                  </div>
                  {extr.orfaos.map((o) => (
                    <div key={o.batch_id} className="text-red-700 font-mono">
                      {o.batch_id} · {o.status} · {o.pedidos} pedidos · {o.criado_em}
                    </div>
                  ))}
                </div>
              )}
              {extr.lotes.length > 0 && (
                <table className="mt-2 text-xs">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pr-4">lote</th>
                      <th className="pr-4">estado</th>
                      <th className="pr-4">arquivos</th>
                      <th className="pr-4">colhidos</th>
                      <th>identificação na Anthropic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extr.lotes.map((l) => (
                      <tr key={l.id} className={l.estado === "enviado"
                        ? "text-amber-800" : "text-gray-600"}>
                        <td className="pr-4">{l.id}</td>
                        <td className="pr-4">{l.estado}</td>
                        <td className="pr-4">{l.total}</td>
                        <td className="pr-4">{l.colhidos}</td>
                        <td className="font-mono">{l.batch_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}