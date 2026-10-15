/**
 * Pedido para o leitor aberto pular para uma página (ex.: escolher um
 * capítulo no glossário e voltar à leitura já nele).
 */
type Listener = (bookId: string, page: number) => void;
const listeners = new Set<Listener>();

export function requestJump(bookId: string, page: number): void {
  listeners.forEach((f) => f(bookId, page));
}

export function onJump(f: Listener): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
