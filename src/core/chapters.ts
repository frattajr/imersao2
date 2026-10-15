/**
 * Capítulos do livro: procura títulos como "Capítulo 3", "CAPÍTULO III —
 * O porto", "Parte 2", "Chapter 1" ou "1." no começo de uma página. Se o
 * livro não tem títulos (textos curtos, texto colado), divide em partes de
 * tamanho parecido, nomeadas pelo começo do texto.
 *
 * Também sugere nomes próprios do capítulo (personagens e lugares) para o
 * glossário, sem precisar de IA.
 */
import { norm } from './text';

export interface Chapter {
  title: string;
  /** primeira página (índice) */
  start: number;
  /** página depois da última */
  end: number;
}

const NUM_WORDS = 'um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|primeiro|segundo|terceiro|quarto|quinto|sexto|setimo|oitavo|nono|decimo|one|two|three|four|five|six|seven|eight|nine|ten';
const HEADING = new RegExp(`^(capitulo|chapter|parte|part|livro|book|prologo|prologue|epilogo|epilogue)\\b(\\s+([0-9]+|[ivxlc]+|${NUM_WORDS})\\b)?`, 'i');
const BARE_NUMBER = /^(?:[0-9]{1,3}|[IVXLC]{1,6})\.?$/;

/** Título de capítulo no começo da página, ou null. */
export function headingOf(page: string): string | null {
  const first = page.trim().split(/\n|(?<=[.!?…])\s/)[0]?.trim() ?? '';
  if (!first || first.length > 90) return null;
  const n = norm(first);
  if (HEADING.test(n)) {
    // "Capítulo 1 — A tempestade" → mantém o título inteiro, sem pontuação no fim
    return first.replace(/[.:\s]+$/, '');
  }
  if (BARE_NUMBER.test(first)) return `Capítulo ${first.replace(/\.$/, '')}`;
  return null;
}

const excerpt = (s: string, n = 34) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + '…';
};

export function detectChapters(pages: string[]): Chapter[] {
  const starts: { i: number; title: string }[] = [];
  pages.forEach((p, i) => {
    const h = headingOf(p);
    if (h) starts.push({ i, title: h });
  });
  if (starts.length >= 2) {
    // texto antes do primeiro título vira "Início"
    if (starts[0].i > 0) starts.unshift({ i: 0, title: 'Início' });
    return starts.map((s, k) => ({ title: s.title, start: s.i, end: starts[k + 1]?.i ?? pages.length }));
  }
  // sem títulos: partes de tamanho parecido (até 8 partes, pelo menos 3 páginas cada)
  if (!pages.length) return [];
  const parts = Math.max(1, Math.min(8, Math.floor(pages.length / 3)));
  const size = Math.ceil(pages.length / parts);
  const out: Chapter[] = [];
  for (let s = 0, k = 1; s < pages.length; s += size, k++) {
    out.push({ title: `Parte ${k} · ${excerpt(pages[s])}`, start: s, end: Math.min(pages.length, s + size) });
  }
  return out;
}

/** Capítulo que contém a página. */
export const chapterAt = (chs: Chapter[], page: number) => Math.max(0, chs.findIndex((c) => page >= c.start && page < c.end));

const STOP = new Set(('a o as os um uma uns umas e ou mas se de do da dos das em no na nos nas por para com sem sob sobre ' +
  'ele ela eles elas eu tu voce nos vos lhe lhes me te se meu minha seu sua nosso nossa este esta esse essa aquele aquela isto isso aquilo ' +
  'que quem qual quando onde como porque pois entao depois antes ainda ja nao sim so muito pouco mais menos tudo nada todo toda todos todas ' +
  'la ali aqui ai foi era sao estava havia tinha ha deus senhor senhora capitulo parte chapter ate desde pela pelo lá então quando ' +
  'ao aos um dia noite manha tarde horas juntos dentro fora alguns algumas cada outro outra outros outras foi era')
  .split(/\s+/));

/**
 * Nomes próprios do trecho (palavras com maiúscula que não começam frase),
 * do mais citado para o menos. Sugestões para o glossário.
 */
export function properNouns(text: string, max = 8): string[] {
  const count = new Map<string, { name: string; n: number }>();
  const sentences = text.split(/(?<=[.!?…—:;])\s+|\n+/);
  for (const sent of sentences) {
    const words = sent.replace(/[“”"«»()]/g, ' ').split(/\s+/).filter(Boolean);
    words.forEach((w, i) => {
      const clean = w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      if (clean.length < 3 || !/^\p{Lu}\p{Ll}+$/u.test(clean)) return;
      if (STOP.has(norm(clean))) return;
      const start = i === 0 || /^[—–-]$/.test(words[i - 1] ?? '');
      const k = norm(clean);
      const cur = count.get(k) ?? { name: clean, n: 0 };
      // começo de frase conta pouco (pode ser só a primeira palavra); no meio, é nome com certeza.
      // Precisa de uma citação no meio de frase ou duas no começo.
      cur.n += start ? 0.4 : 1;
      count.set(k, cur);
    });
  }
  return [...count.values()].filter((x) => x.n >= 0.8).sort((a, b) => b.n - a.n).slice(0, max).map((x) => x.name);
}
