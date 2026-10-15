/**
 * Limpeza de documentos para o texto fluir no celular (reflow):
 * - cabeçalhos e rodapés que se repetem (título do livro, nome do autor,
 *   "Capítulo 3" no alto de cada página) — detectados por frequência entre
 *   as páginas, com os números trocados por "#";
 * - paginação impressa ("12", "- 12 -", "Página 12 de 300", "xiv");
 * - ligaduras tipográficas (ﬁ, ﬂ), hífens invisíveis e espaços estranhos.
 * A junção de linhas em parágrafos (hifenização e quebras duras) fica em
 * text.ts (linesToParas / joinPdfPages), que chama isto antes.
 */

/** Paginação impressa sozinha numa linha. */
export const PAGE_NUMBER = /^(?:[-–—·•]?\s*)(?:p(?:á|a)g(?:ina)?\.?\s*)?(?:\d{1,4}|[ivxlcdm]{1,7})(?:\s*(?:de|of|\/)\s*\d{1,4})?(?:\s*[-–—·•]?)$/i;

const LIGATURES: Record<string, string> = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };

/** Normaliza caracteres que atrapalham a leitura e a busca. */
export function cleanChars(s: string): string {
  return s
    .replace(/[ﬀﬁﬂﬃﬄﬅﬆ]/g, (m) => LIGATURES[m])
    .replace(/­/g, '') // hífen invisível (soft hyphen)
    .replace(/[​-‍﻿]/g, '') // espaços de largura zero
    .replace(/[  -   ]/g, ' ');
}

/** Forma de comparação de cabeçalhos: sem números, sem caixa, sem espaços extras. */
const shape = (s: string) => s.toLowerCase().replace(/\d+/g, '#').replace(/[ivxlcdm]+\b/g, (r) => (r.length <= 7 ? '#' : r)).replace(/\s+/g, ' ').trim();

/**
 * Tira de cada página as linhas de cabeçalho/rodapé que se repetem e a
 * paginação impressa. Só olha as 2 primeiras e as 2 últimas linhas de cada
 * página (o miolo nunca é tocado).
 */
export function stripRunningHeads(pages: string[][]): string[][] {
  const clean = pages.map((lines) => lines.map((l) => cleanChars(l).replace(/\s+/g, ' ').trim()).filter(Boolean));
  const edges = (lines: string[]) => [...new Set([...lines.slice(0, 2), ...lines.slice(-2)])];
  const count = new Map<string, number>();
  for (const lines of clean) for (const l of new Set(edges(lines).map(shape))) count.set(l, (count.get(l) ?? 0) + 1);
  // repete em pelo menos 30% das páginas (mínimo 3) e é curta: é cabeçalho/rodapé
  const min = Math.max(3, Math.ceil(clean.length * 0.3));
  const running = new Set([...count].filter(([k, n]) => n >= min && k.length <= 90).map(([k]) => k));
  return clean.map((lines) => {
    const top = new Set([0, 1]), bottom = new Set([lines.length - 1, lines.length - 2]);
    // cabeçalho/rodapé é bem mais curto que uma linha cheia do miolo
    const full = Math.max(...lines.map((l) => l.length));
    return lines.filter((l, i) => {
      if (!top.has(i) && !bottom.has(i)) return true;
      if (PAGE_NUMBER.test(l)) return false;
      return !(running.has(shape(l)) && l.length < full * 0.75);
    });
  });
}
