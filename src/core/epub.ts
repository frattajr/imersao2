/**
 * Leitor de EPUB sem DOM: funciona no React Native (que não tem DOMParser).
 * Recebe uma função `read(caminho)` que devolve o texto de um arquivo do ZIP,
 * assim o mesmo código roda com JSZip no app e nos testes.
 */
import JSZip from 'jszip';

export interface ParsedBook {
  title: string;
  text: string;
}

type Reader = (path: string) => Promise<string | null>;

const ENT: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–',
  hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  shy: '', copy: '©', reg: '®', deg: '°', middot: '·', bull: '•', iexcl: '¡', iquest: '¿',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    const v = ENT[e.toLowerCase()];
    return v !== undefined ? v : m;
  });
}

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3] ?? null) : null;
};

/** Resolve `href` relativo à pasta `base` dentro do ZIP. */
export function resolvePath(base: string, href: string): string {
  const clean = decodeURIComponent(href.split('#')[0]);
  const parts = (base + clean).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

const BLOCK = /<\/?(p|h[1-6]|li|div|blockquote|section|article|tr|dd|dt|pre|figcaption|br|hr)\b[^>]*>/gi;

/** Extrai parágrafos de um capítulo XHTML. */
export function xhtmlToParagraphs(html: string): string[] {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head\b[\s\S]*?<\/head>/i, ' ')
    .replace(/<(script|style|svg|math)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(sup|rt)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(BLOCK, '\n').replace(/<[^>]+>/g, '');
  return decodeEntities(s)
    .split('\n')
    .map((t) => t.replace(/[\s ]+/g, ' ').trim())
    .filter((t) => t.length > 1);
}

export async function parseEpub(read: Reader, onProgress?: (p: number) => void): Promise<ParsedBook> {
  const container = await read('META-INF/container.xml');
  if (!container) throw new Error('Este EPUB parece inválido (falta o container.xml).');
  const opfPath = attr(container.match(/<rootfile\b[^>]*>/i)?.[0] ?? '', 'full-path');
  if (!opfPath) throw new Error('Este EPUB parece inválido (sem arquivo de conteúdo).');
  const opf = await read(opfPath);
  if (!opf) throw new Error('Este EPUB parece inválido (arquivo de conteúdo ausente).');
  if (/<encryption\b/i.test((await read('META-INF/encryption.xml')) ?? '')) {
    throw new Error('Este EPUB tem proteção contra cópia (DRM) e não pode ser aberto.');
  }
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  const manifest: Record<string, { href: string; props: string; type: string }> = {};
  for (const tag of opf.match(/<(?:opf:)?item\b[^>]*>/gi) ?? []) {
    const id = attr(tag, 'id');
    const href = attr(tag, 'href');
    if (id && href) manifest[id] = { href, props: attr(tag, 'properties') ?? '', type: attr(tag, 'media-type') ?? '' };
  }
  const spine = (opf.match(/<(?:opf:)?itemref\b[^>]*>/gi) ?? [])
    .filter((t) => attr(t, 'linear') !== 'no')
    .map((t) => attr(t, 'idref'))
    .filter((x): x is string => !!x);

  const titleM = opf.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i);
  const title = titleM ? decodeEntities(titleM[1].replace(/<[^>]+>/g, '')).trim() : '';

  const out: string[] = [];
  for (let k = 0; k < spine.length; k++) {
    onProgress?.((k + 1) / spine.length);
    const item = manifest[spine[k]];
    if (!item || item.props.includes('nav')) continue;
    if (item.type && !/html|xml/.test(item.type)) continue;
    const html = await read(resolvePath(base, item.href));
    if (!html || /epub:type\s*=\s*["'][^"']*\btoc\b/.test(html)) continue;
    out.push(...xhtmlToParagraphs(html));
  }
  return { title, text: out.join('\n') };
}

/** Abre os bytes de um .epub com JSZip (puro JavaScript, roda no React Native). */
export async function parseEpubBytes(bytes: Uint8Array, onProgress?: (p: number) => void): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(bytes);
  const lower: Record<string, string> = {};
  Object.keys(zip.files).forEach((n) => (lower[n.toLowerCase()] = n));
  const read: Reader = async (p) => {
    const f = zip.file(p) ?? zip.file(lower[p.toLowerCase()] ?? '');
    return f ? f.async('string') : null;
  };
  return parseEpub(read, onProgress);
}

/** Detecta o tipo pelo conteúdo (não pela extensão). */
export function sniff(bytes: Uint8Array): 'pdf' | 'epub' | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'epub';
  return null;
}
