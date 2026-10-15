/**
 * X-Ray (personagens e termos): marca no texto as entidades que dá para
 * tocar e monta a ficha de cada uma SÓ com o que já foi lido — nada das
 * páginas seguintes (sem spoiler).
 */
import { properNouns } from './chapters';
import { norm } from './text';

export interface Segment { t: string; term?: string }

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/**
 * Divide o texto em pedaços, marcando as ocorrências (palavra inteira, sem
 * diferenciar acento e maiúsculas) dos termos. Termos mais longos primeiro
 * ("Dom Casmurro" antes de "Dom").
 */
export function segmentText(text: string, terms: string[]): Segment[] {
  const src = text.normalize('NFC');
  if (!terms.length) return [{ t: src }];
  const low = norm(src);
  // norm preserva o tamanho de texto NFC (só tira acentos e põe em minúsculas)
  const same = low.length === src.length;
  const sorted = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2))].sort((a, b) => b.length - a.length);
  const marks: { s: number; e: number; term: string }[] = [];
  for (const term of sorted) {
    const k = norm(term);
    let from = 0;
    for (;;) {
      const i = same ? low.indexOf(k, from) : src.indexOf(term, from);
      if (i < 0) break;
      const e = i + k.length;
      from = e;
      if (isWordChar(src[i - 1]) || isWordChar(src[e])) continue;
      if (marks.some((m) => i < m.e && e > m.s)) continue;
      marks.push({ s: i, e, term });
    }
  }
  if (!marks.length) return [{ t: src }];
  marks.sort((a, b) => a.s - b.s);
  const out: Segment[] = [];
  let pos = 0;
  for (const m of marks) {
    if (m.s > pos) out.push({ t: src.slice(pos, m.s) });
    out.push({ t: src.slice(m.s, m.e), term: m.term });
    pos = m.e;
  }
  if (pos < src.length) out.push({ t: src.slice(pos) });
  return out;
}

/** Entidades que aparecem no que já foi lido (até a página `idx`), as mais citadas primeiro. */
export function entitiesSoFar(pages: string[], idx: number, max = 30): string[] {
  const text = pages.slice(Math.max(0, idx - 300), idx + 1).join('\n');
  return properNouns(text.slice(-60_000), max);
}

export interface XrayInfo {
  term: string;
  /** página (índice) da primeira menção */
  firstPage: number;
  firstQuote: string;
  /** menção mais recente antes da página atual (se for outra) */
  lastQuote?: string;
  lastPage?: number;
  /** menções até a página atual */
  mentions: number;
}

const sentences = (p: string) => p.split(/(?<=[.!?…])\s+/);
const hasTerm = (s: string, k: string) => {
  const n = norm(s);
  let i = n.indexOf(k);
  while (i >= 0) {
    if (!isWordChar(n[i - 1]) && !isWordChar(n[i + k.length])) return true;
    i = n.indexOf(k, i + 1);
  }
  return false;
};
const quote = (s: string) => (s.length > 220 ? s.slice(0, 217).replace(/\s+\S*$/, '') + '…' : s);

/** Ficha sem spoiler: só olha as páginas 0..idx. */
export function xrayInfo(term: string, pages: string[], idx: number): XrayInfo | null {
  const k = norm(term);
  let first: { p: number; s: string } | null = null;
  let last: { p: number; s: string } | null = null;
  let mentions = 0;
  for (let p = 0; p <= Math.min(idx, pages.length - 1); p++) {
    for (const s of sentences(pages[p])) {
      if (!hasTerm(s, k)) continue;
      mentions++;
      if (!first) first = { p, s };
      last = { p, s };
    }
  }
  if (!first) return null;
  const info: XrayInfo = { term, firstPage: first.p, firstQuote: quote(first.s), mentions };
  if (last && (last.p !== first.p || last.s !== first.s)) { info.lastQuote = quote(last.s); info.lastPage = last.p; }
  return info;
}
