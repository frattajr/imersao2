/**
 * Página cheia: agrupa parágrafos em telas, como a página de um livro.
 * Estima quanto texto cabe na tela (linhas × caracteres por linha, com uma
 * folga) e vai empilhando parágrafos até encher. Um parágrafo nunca é
 * cortado ao meio — se não cabe, vai inteiro para a próxima tela.
 *
 * No modo "um parágrafo por tela" cada tela tem um parágrafo só; assim o
 * leitor trata os dois modos da mesma forma.
 */
export interface Screen { start: number; end: number }

export interface PageBox {
  /** área útil do texto, em pontos */
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  /** espaço entre parágrafos, em pontos */
  paraGap: number;
}

/** Largura média de um caractere em fonte serifada de leitura, em múltiplos do tamanho. */
const CHAR_W = 0.5;
/** Folga para palavras que quebram linha antes do fim e para a justificação. */
const SAFETY = 0.86;

/** Quantas linhas cada parágrafo ocupa, estimado. */
export function linesFor(text: string, box: PageBox): number {
  const perLine = Math.max(10, Math.floor((box.width / (box.fontSize * CHAR_W)) * SAFETY));
  return text.split('\n').reduce((n, part) => n + Math.max(1, Math.ceil(part.length / perLine)), 0);
}

export function paginate(pages: string[], box: PageBox | null): Screen[] {
  if (!box || box.height <= 0 || box.width <= 0) return pages.map((_, i) => ({ start: i, end: i + 1 }));
  const out: Screen[] = [];
  let start = 0, used = 0;
  for (let i = 0; i < pages.length; i++) {
    const h = linesFor(pages[i], box) * box.lineHeight;
    const gap = i > start ? box.paraGap : 0;
    if (i > start && used + gap + h > box.height) {
      out.push({ start, end: i });
      start = i;
      used = h;
    } else {
      used += gap + h;
    }
    // títulos de capítulo começam tela nova (eles ficam sozinhos na própria página)
    if (/^(cap[ií]tulo|parte|chapter|livro)\b/i.test(pages[i + 1] ?? '') && i + 1 < pages.length) {
      out.push({ start, end: i + 1 });
      start = i + 1;
      used = 0;
    }
  }
  if (start < pages.length) out.push({ start, end: pages.length });
  return out;
}

export const onePerScreen = (n: number): Screen[] => Array.from({ length: n }, (_, i) => ({ start: i, end: i + 1 }));

/** Tela que contém o parágrafo. */
export function screenOf(screens: Screen[], page: number): number {
  let lo = 0, hi = screens.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (screens[mid].start <= page) lo = mid; else hi = mid - 1;
  }
  return Math.max(0, lo);
}
