/**
 * Utilidades de texto: normalização, divisão em páginas e reconstrução de
 * parágrafos a partir de linhas de PDF. Sem dependências — roda no app,
 * nos testes e pode ser copiado para as funções do servidor.
 */

/** Minúsculas e sem acentos, para comparar palavras. */
export const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SENTENCE_RE = /[^.!?…]+(?:[.!?…]+["”'»)]*)?\s*/g;

/** Divide um parágrafo em frases (mantém a pontuação e os espaços). */
export function sentences(par: string): string[] {
  const m = par.match(SENTENCE_RE);
  return m && m.length ? m : [par];
}

/**
 * Transforma um texto longo em páginas de leitura: cada parágrafo vira uma
 * página; parágrafos longos são quebrados em grupos de frases.
 */
export function chunk(text: string, maxLen = 330, target = 300): string[] {
  const out: string[] = [];
  text
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .forEach((par) => {
      if (par.length <= maxLen) {
        out.push(par);
        return;
      }
      let cur = '';
      for (const s of sentences(par)) {
        if ((cur + s).length > target && cur) {
          out.push(cur.trim());
          cur = s;
        } else cur += s;
      }
      if (cur.trim()) out.push(cur.trim());
    });
  return out;
}

const ENDS = /[.!?…"”»)]$/;
const LOWER_START = /^[a-zà-ú]/;

/**
 * Junta linhas de uma página de PDF em parágrafos: une hifenização no fim
 * da linha, descarta números de página soltos e fecha o parágrafo quando a
 * linha termina em pontuação e é bem mais curta que a linha mais longa.
 */
export function linesToParas(lines: string[]): string[] {
  const L = lines.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s && !/^\d{1,4}$/.test(s));
  if (!L.length) return [];
  const mx = Math.max(...L.map((s) => s.length));
  const out: string[] = [];
  let c = '';
  for (const s of L) {
    if (c) {
      if (/-$/.test(c) && LOWER_START.test(s)) c = c.slice(0, -1) + s;
      else c += ' ' + s;
    } else c = s;
    if (ENDS.test(s) && s.length < mx * 0.62) {
      out.push(c);
      c = '';
    }
  }
  if (c) out.push(c);
  return out;
}

/** Junta os parágrafos de várias páginas de PDF, emendando frases cortadas. */
export function joinPdfPages(pages: string[][]): string {
  const out: string[] = [];
  for (const lines of pages) {
    const np = linesToParas(lines);
    if (out.length && np.length && !ENDS.test(out[out.length - 1]) && LOWER_START.test(np[0])) {
      out[out.length - 1] += ' ' + np.shift();
    }
    out.push(...np);
  }
  return out.join('\n');
}

/** Palavras restantes a partir de cada página (para o tempo estimado). */
export function wordsRemaining(pages: string[]): number[] {
  const r = new Array<number>(pages.length);
  let t = 0;
  for (let i = pages.length - 1; i >= 0; i--) {
    t += pages[i].split(/\s+/).filter(Boolean).length;
    r[i] = t;
  }
  return r;
}

/** Minutos estimados de leitura (210 palavras por minuto). */
export const minutesLeft = (words: number): number => Math.max(1, Math.ceil(words / 210));

/**
 * Hash estável (cyrb53) para identificar um livro pelo conteúdo. O mesmo
 * livro gera o mesmo id em qualquer aparelho, o que permite sincronizar.
 */
export function contentId(pages: string[]): string {
  let h1 = 0xdeadbeef ^ pages.length;
  let h2 = 0x41c6ce57 ^ pages.length;
  for (const p of pages) {
    for (let i = 0; i < p.length; i++) {
      const ch = p.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ 10, 2654435761);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'b' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
