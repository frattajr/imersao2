import { norm } from './text';
import type { GlossaryEntry } from './types';

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Adiciona ou atualiza um termo (sem diferenciar maiúsculas e acentos). */
export function upsertEntry(list: GlossaryEntry[], term: unknown, desc: unknown): GlossaryEntry[] {
  const t = clean(term, 60);
  const d = clean(desc, 200);
  if (!t) return list;
  const k = norm(t);
  const i = list.findIndex((x) => norm(x.term) === k);
  if (i >= 0) {
    if (!d) return list;
    const copy = list.slice();
    copy[i] = { term: list[i].term, desc: d };
    return copy;
  }
  return [...list, { term: t, desc: d }];
}

export const removeEntry = (list: GlossaryEntry[], term: string) =>
  list.filter((x) => norm(x.term) !== norm(term));

export const sortEntries = (list: GlossaryEntry[]) =>
  list.slice().sort((a, b) => a.term.localeCompare(b.term, 'pt'));

/** Termos do glossário que aparecem no texto da página (no máximo 3). */
export function entriesOnPage(list: GlossaryEntry[], page: string): GlossaryEntry[] {
  const n = norm(page);
  return list
    .filter((g) => {
      const t = norm(g.term);
      if (!t) return false;
      const i = n.indexOf(t);
      if (i < 0) return false;
      const before = i === 0 ? ' ' : n[i - 1];
      const after = n[i + t.length] ?? ' ';
      return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
    })
    .slice(0, 3);
}

/** Trecho lido até a página atual, limitado para caber no pedido à IA. */
export function readSoFar(pages: string[], idx: number, maxChars = 14000): string {
  let txt = pages.slice(Math.max(0, idx - 80), idx + 1).join('\n');
  if (txt.length > maxChars) txt = txt.slice(-maxChars);
  return txt;
}

/** Termos do glossário que aparecem no trecho (todos, na ordem alfabética). */
export function entriesIn(list: GlossaryEntry[], text: string): GlossaryEntry[] {
  return sortEntries(list.filter((g) => entriesOnPage([g], text).length > 0));
}
