/**
 * Marcadores, grifos e notas. Ficam presos ao parágrafo (índice em
 * `pages`) e à posição dos caracteres dentro dele — assim continuam no lugar
 * certo em qualquer modo de leitura (páginas, página cheia, rolagem) e com
 * qualquer tamanho de letra.
 */
export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/** cor de fundo do grifo (translúcida, funciona em tema claro e escuro) */
export const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 214, 10, 0.32)', green: 'rgba(52, 199, 89, 0.28)', blue: 'rgba(10, 132, 255, 0.26)', pink: 'rgba(255, 55, 135, 0.24)',
};
export const HIGHLIGHT_LABEL: Record<HighlightColor, string> = { yellow: 'Amarelo', green: 'Verde', blue: 'Azul', pink: 'Rosa' };

export interface Annotation {
  id: string;
  bookId: string;
  kind: 'bookmark' | 'highlight';
  /** parágrafo (índice em pages) */
  page: number;
  /** caracteres dentro do parágrafo (grifo); marcador usa 0..0 */
  start: number;
  end: number;
  /** trecho grifado (ou começo do parágrafo, no marcador) */
  quote: string;
  note: string;
  color?: HighlightColor;
  createdAt: number;
}

export const newId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Segmento de texto pronto para desenhar: termo do X-Ray e/ou grifo. */
export interface Span { t: string; term?: string; hl?: HighlightColor; note?: boolean; hlId?: string }

/**
 * Aplica os grifos (intervalos de caracteres) sobre segmentos já existentes
 * (ex.: os termos do X-Ray), cortando onde for preciso. Grifos que se
 * sobrepõem: vale o mais recente.
 */
export function applyHighlights(segs: { t: string; term?: string }[], hls: Annotation[]): Span[] {
  if (!hls.length) return segs;
  const ordered = [...hls].sort((a, b) => a.createdAt - b.createdAt);
  // pontos de corte = limites dos segmentos + limites dos grifos
  const cuts = new Set<number>([0]);
  let pos = 0;
  for (const s of segs) { pos += s.t.length; cuts.add(pos); }
  const total = pos;
  for (const h of ordered) { cuts.add(Math.max(0, Math.min(total, h.start))); cuts.add(Math.max(0, Math.min(total, h.end))); }
  const points = [...cuts].sort((a, b) => a - b);
  const text = segs.map((s) => s.t).join('');
  const segAt = (i: number) => {
    let p = 0;
    for (const s of segs) { if (i < p + s.t.length) return s; p += s.t.length; }
    return segs[segs.length - 1];
  };
  const out: Span[] = [];
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k], b = points[k + 1];
    if (b <= a) continue;
    const seg = segAt(a);
    let hl: Annotation | undefined;
    for (const h of ordered) if (h.start <= a && h.end >= b) hl = h;
    const span: Span = { t: text.slice(a, b) };
    if (seg.term) span.term = seg.term;
    if (hl) { span.hl = hl.color ?? 'yellow'; span.hlId = hl.id; if (hl.note) span.note = true; }
    // junta com o anterior se for igual (menos nós de texto)
    const prev = out[out.length - 1];
    if (prev && prev.term === span.term && prev.hlId === span.hlId && !span.term) prev.t += span.t;
    else out.push(span);
  }
  return out;
}

/** Frases de um parágrafo com a posição de cada uma (para selecionar trechos). */
export function sentencesOf(p: string): { t: string; start: number; end: number }[] {
  const out: { t: string; start: number; end: number }[] = [];
  const re = /[^.!?…]+(?:[.!?…]+["'”»)]*|$)\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p)) && m[0]) {
    const raw = m[0];
    const t = raw.trimEnd();
    if (t.trim()) out.push({ t: t.trimStart(), start: m.index + (raw.length - raw.trimStart().length), end: m.index + t.length });
    if (re.lastIndex >= p.length) break;
  }
  return out;
}

/** Grifos e notas do livro em Markdown (para exportar/compartilhar). */
export function exportMarkdown(title: string, author: string, items: Annotation[], chapterOf: (page: number) => string): string {
  const hls = items.filter((a) => a.kind === 'highlight').sort((a, b) => a.page - b.page || a.start - b.start);
  const lines = [`# ${title}`, author ? `*${author}*` : '', '', `${hls.length} ${hls.length === 1 ? 'grifo' : 'grifos'} · exportado do Imersão`, ''];
  let last = '';
  for (const h of hls) {
    const ch = chapterOf(h.page);
    if (ch !== last) { lines.push(`## ${ch}`, ''); last = ch; }
    lines.push(`> ${h.quote.replace(/\n+/g, ' ')}`);
    if (h.note) lines.push('', `**Nota:** ${h.note}`);
    lines.push(`<sub>parágrafo ${h.page + 1}</sub>`, '');
  }
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim() + '\n';
}

/** Busca no livro (sem acento e sem diferenciar maiúsculas); devolve trechos com contexto. */
export function searchBook(pages: string[], query: string, max = 200, norm: (s: string) => string): { page: number; at: number; before: string; match: string; after: string }[] {
  const q = norm(query.trim());
  if (q.length < 2) return [];
  const out: { page: number; at: number; before: string; match: string; after: string }[] = [];
  for (let p = 0; p < pages.length && out.length < max; p++) {
    const src = pages[p].normalize('NFC');
    const low = norm(src);
    let i = low.indexOf(q);
    while (i >= 0 && out.length < max) {
      const s = Math.max(0, i - 50), e = Math.min(src.length, i + q.length + 70);
      out.push({ page: p, at: i, before: (s > 0 ? '…' : '') + src.slice(s, i), match: src.slice(i, i + q.length), after: src.slice(i + q.length, e) + (e < src.length ? '…' : '') });
      i = low.indexOf(q, i + q.length);
    }
  }
  return out;
}
