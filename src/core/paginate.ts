/**
 * Página cheia: agrupa parágrafos em telas, como a página de um livro.
 * Estima quanto texto cabe na tela (linhas × caracteres por linha, com uma
 * folga) e vai empilhando parágrafos até encher. Um pedaço de parágrafo
 * nunca é cortado ao meio — se não cabe, vai inteiro para a próxima tela;
 * como os parágrafos longos já vêm divididos em pedaços (src/core/text.ts),
 * o parágrafo "continua na próxima página" como num livro.
 *
 * A estimativa de caracteres por linha é calibrada pelo leitor com a medida
 * real do texto na tela (`charW`), então a página fica bem preenchida.
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
  /** largura média de um caractere em múltiplos do tamanho da letra (calibrada pelo leitor) */
  charW?: number;
  /** folga para quebras de linha antes do fim (1 = nenhuma) */
  safety?: number;
}

export interface PageOpts {
  /** o parágrafo é título de capítulo (ocupa mais espaço e abre tela nova) */
  isHeading?: (i: number) => boolean;
  /** o parágrafo continua o anterior (sem espaço entre eles) */
  isCont?: (i: number) => boolean;
  /** linhas que um título de capítulo ocupa, com o respiro em volta */
  headingLines?: number;
}

/** Largura média de um caractere em fonte serifada de leitura, em múltiplos do tamanho. */
export const CHAR_W = 0.5;
/** Folga padrão para palavras que quebram linha antes do fim (sem calibração). */
export const SAFETY = 0.86;

/** Caracteres por linha estimados. */
export const perLineOf = (box: PageBox) =>
  Math.max(10, Math.floor((box.width / (box.fontSize * (box.charW ?? CHAR_W))) * (box.safety ?? SAFETY)));

/** Quantas linhas cada parágrafo ocupa, estimado. */
export function linesFor(text: string, box: PageBox): number {
  const perLine = perLineOf(box);
  return text.split('\n').reduce((n, part) => n + Math.max(1, Math.ceil(part.length / perLine)), 0);
}

const HEADING_RE = /^(cap[ií]tulo|parte|chapter|livro)\b/i;

export function paginate(pages: string[], box: PageBox | null, opts: PageOpts = {}): Screen[] {
  if (!box || box.height <= 0 || box.width <= 0) return pages.map((_, i) => ({ start: i, end: i + 1 }));
  const isHeading = opts.isHeading ?? ((i: number) => HEADING_RE.test(pages[i] ?? ''));
  const isCont = opts.isCont ?? (() => false);
  const out: Screen[] = [];
  let start = 0, used = 0;
  for (let i = 0; i < pages.length; i++) {
    const h = (isHeading(i) ? (opts.headingLines ?? 1) : linesFor(pages[i], box)) * box.lineHeight;
    const gap = i > start && !isCont(i) ? box.paraGap : 0;
    if (i > start && used + gap + h > box.height) {
      out.push({ start, end: i });
      start = i;
      used = h;
    } else {
      used += gap + h;
    }
    // títulos de capítulo começam tela nova (a abertura do capítulo)
    if (i + 1 < pages.length && isHeading(i + 1) && i + 1 > start) {
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

/**
 * Calibração: compara as linhas reais (altura medida ÷ altura da linha) com
 * as estimadas e devolve a largura média de caractere corrigida. Só usa
 * parágrafos de 3 linhas ou mais (os curtos não dizem nada) e ignora
 * diferenças pequenas (< 3%), para não repaginar à toa.
 */
export function calibrateCharW(box: PageBox, measured: { text: string; height: number }[]): number | null {
  const cur = box.charW ?? CHAR_W;
  let est = 0, real = 0;
  for (const m of measured) {
    const e = linesFor(m.text, box);
    if (e < 3 || m.height <= 0) continue;
    est += e;
    real += m.height / box.lineHeight;
  }
  if (est < 6) return null;
  const k = real / est;
  if (Math.abs(k - 1) < 0.03) return null;
  return Math.max(0.38, Math.min(0.7, cur * k));
}
