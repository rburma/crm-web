// Estado de LISTA persistido na aba (Renato 07/07): ao ir p/ um item e voltar,
// a listagem restaura busca, filtros e PAGINACAO. sessionStorage = por aba,
// morre ao fechar (nao vira estado velho amanha). Fail-soft em SSR/erros.

export function lerEstadoLista<T>(chave: string): Partial<T> {
  if (typeof window === "undefined") return {};
  try {
    const bruto = window.sessionStorage.getItem("lista:" + chave);
    return bruto ? (JSON.parse(bruto) as Partial<T>) : {};
  } catch {
    return {};
  }
}

export function salvarEstadoLista(chave: string, estado: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem("lista:" + chave, JSON.stringify(estado));
  } catch {
    /* cheio/bloqueado: ignora */
  }
}
