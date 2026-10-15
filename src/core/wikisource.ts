/**
 * Wikisource em português (pt.wikisource.org): textos em domínio público,
 * muitos já transcritos com revisão. A API do MediaWiki aceita pedidos de
 * qualquer site (`origin=*`), então funciona no app, no navegador e no
 * script do deploy. O `fetch` é passado de fora (testável sem rede).
 *
 * Livros longos ficam divididos em subpáginas ("Dom Casmurro/I",
 * "Dom Casmurro/Capítulo II"…): a página principal tem os links, na ordem.
 */
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const API = 'https://pt.wikisource.org/w/api.php';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' };
export const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const stripTags = (s: string) => decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t ]+/g, ' ');

/**
 * Texto de leitura de uma página renderizada: títulos (h2–h4), parágrafos
 * e poemas, na ordem. Ignora navegação, notas de rodapé e índices.
 */
export function htmlToText(html: string): string {
  const body = html
    .replace(/<(style|script|table)[\s\S]*?<\/\1>/gi, '')
    .replace(/<sup[^>]*class="[^"]*reference[^"]*"[\s\S]*?<\/sup>/gi, '')
    .replace(/<span[^>]*class="[^"]*(?:mw-editsection|pagenum|ws-pagenum)[^"]*"[\s\S]*?<\/span>/gi, '')
    .replace(/<ol[^>]*class="[^"]*references[^"]*"[\s\S]*?<\/ol>/gi, '');
  const out: string[] = [];
  const re = /<(h[2-4]|p|div class="poem"|dd)[^>]*>([\s\S]*?)<\/(?:h[2-4]|p|div|dd)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase();
    const raw = stripTags(m[2]);
    if (tag.startsWith('div') || tag === 'dd' || /<br/i.test(m[2])) {
      // poema: cada estrofe vira um parágrafo, versos separados por quebra de linha
      raw.split(/\n\s*\n/).map((st) => st.split('\n').map((l) => l.trim()).filter(Boolean).join('\n')).filter(Boolean).forEach((st) => out.push(st));
    } else {
      const t = raw.replace(/\s*\n\s*/g, ' ').trim();
      if (t) out.push(t);
    }
  }
  return out.filter((p) => !/^\[?\s*(editar|índice|sumário|nota do editor)\s*\]?$/i.test(p)).join('\n');
}

/** Subpáginas do livro (capítulos), na ordem em que aparecem na página principal. */
export function chapterLinks(html: string, page: string): string[] {
  const prefix = page.replace(/ /g, '_') + '/';
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /href="\/wiki\/([^"#?]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let t: string;
    try { t = decodeURIComponent(m[1]); } catch { continue; }
    if (!t.startsWith(prefix) || seen.has(t)) continue;
    seen.add(t);
    out.push(t.replace(/_/g, ' '));
  }
  return out;
}

/** "Dom Casmurro/Capítulo I" → "Capítulo I"; "Os Maias/III" → "Capítulo III". */
export function chapterTitle(sub: string): string {
  const last = sub.split('/').pop()!.trim();
  return /^[IVXLC]+$|^\d+$/.test(last) ? `Capítulo ${last}` : last;
}

/**
 * Fora do navegador (script do deploy) a Wikimedia exige um User-Agent que
 * identifique o programa; no navegador o próprio navegador manda o dele
 * (e cabeçalhos extras forçariam uma verificação de CORS a mais).
 */
const inBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const HEADERS: Record<string, string> = inBrowser ? {} : { 'User-Agent': 'imersao-app/1.0 (https://github.com/frattajr/imersao2; leitura com som ambiente)' };

/**
 * Gentileza com a Wikimedia: um pedido de cada vez com intervalo mínimo
 * (`setWikisourcePace`; o script do deploy usa ~250 ms) e novas tentativas,
 * com espera crescente, quando o servidor pede calma (429) ou falha (5xx).
 */
let gapMs = 0;
let nextAt = 0;
export const setWikisourcePace = (ms: number) => { gapMs = ms; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(f: Fetch, params: Record<string, string>, timeoutMs = 30_000): Promise<unknown> {
  const q = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', maxlag: '5', ...params });
  for (let attempt = 0; ; attempt++) {
    if (gapMs) {
      const wait = nextAt - Date.now();
      nextAt = Math.max(Date.now(), nextAt) + gapMs;
      if (wait > 0) await sleep(wait);
    }
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await f(`${API}?${q.toString()}`, { signal: ctl.signal, headers: HEADERS });
      if ((r.status === 429 || r.status >= 500) && attempt < 4) {
        const ra = Number(r.headers?.get?.('retry-after'));
        await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500 * 2 ** attempt);
        continue;
      }
      if (!r.ok) throw new Error(`Wikisource ${r.status}`);
      const j = (await r.json()) as { error?: { code?: string } };
      // servidor sobrecarregado (maxlag): espera e tenta de novo
      if (j?.error?.code === 'maxlag' && attempt < 4) { await sleep(2000 * 2 ** attempt); continue; }
      return j;
    } finally {
      clearTimeout(t);
    }
  }
}

/** HTML renderizado de uma página (null se não existir). */
export async function parsePage(f: Fetch, page: string): Promise<string | null> {
  const j = (await api(f, { action: 'parse', page, prop: 'text', redirects: '1' })) as { parse?: { text?: string }; error?: unknown };
  return j.parse?.text ?? null;
}

/** Páginas da obra procurando pelo nome (e autor, se vier): a principal (sem "/capítulo") primeiro. */
export async function searchTitles(f: Fetch, title: string, author = ''): Promise<string[]> {
  const j = (await api(f, { action: 'query', list: 'search', srsearch: `intitle:"${title}" ${author}`.trim(), srnamespace: '0', srlimit: '10' })) as
    { query?: { search?: { title: string }[] } };
  const hits = (j.query?.search ?? []).map((h) => h.title).filter((h) => !h.includes('/'));
  const n = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return hits.filter((h) => n(h).startsWith(n(title))).sort((a, b) => Number(n(b) === n(title)) - Number(n(a) === n(title)));
}

/** Título exato da página procurando pelo nome da obra (e autor, se vier). */
export async function searchTitle(f: Fetch, title: string, author = ''): Promise<string | null> {
  return (await searchTitles(f, title, author))[0] ?? null;
}

/**
 * Página de desambiguação ("Senhora" → várias obras com esse nome): links
 * do tipo "Senhora (José de Alencar)". Exportada para teste.
 */
export function disambiguationLinks(html: string, page: string): string[] {
  const out: string[] = [];
  const re = /href="\/wiki\/([^"#?]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let t: string;
    try { t = decodeURIComponent(m[1]).replace(/_/g, ' '); } catch { continue; }
    if (t.startsWith(`${page} (`) && !t.includes('/') && !out.includes(t)) out.push(t);
  }
  return out;
}

export async function fetchWikisourceBook(
  f: Fetch, page: string,
  opts: { maxChapters?: number; author?: string; authorFull?: string; step?: (done: number, total: number) => void; log?: (m: string) => void } = {},
): Promise<string | null> {
  // candidatos: o título dado, "Título (Autor)", os da desambiguação e os da busca
  const cands: string[] = [page];
  if (opts.authorFull) cands.push(`${page} (${opts.authorFull})`);
  const tried = new Set<string>();
  let searched = false;
  for (let k = 0; k < cands.length && tried.size < 8; k++) {
    const p = cands[k];
    if (tried.has(p)) continue;
    tried.add(p);
    const html = await parsePage(f, p).catch((e: unknown) => { opts.log?.(`Wikisource "${p}": ${e instanceof Error ? e.message : String(e)}`); return null; });
    if (html) {
      const text = await readWork(f, p, html, opts);
      if (text) return text;
      disambiguationLinks(html, page).forEach((x) => { if (!cands.includes(x)) cands.push(x); });
    }
    if (k === cands.length - 1 && !searched) {
      searched = true;
      const hits = await searchTitles(f, page, opts.author).catch(() => [] as string[]);
      hits.forEach((x) => { if (!cands.includes(x)) cands.push(x); });
    }
  }
  opts.log?.(`Wikisource: nada aproveitável em ${[...tried].map((t) => `"${t}"`).join(', ')}`);
  return null;
}

/** Texto de uma página de obra: os capítulos (subpáginas) ou o próprio texto. */
async function readWork(
  f: Fetch, page: string, html: string,
  opts: { maxChapters?: number; step?: (done: number, total: number) => void; log?: (m: string) => void },
): Promise<string | null> {
  const links = chapterLinks(html, page).slice(0, opts.maxChapters ?? 150);
  const own = htmlToText(html);
  opts.log?.(`Wikisource "${page}": ${links.length} capítulos, ${own.length} caracteres na página`);
  if (links.length < 2) return own.length > 1500 ? own : null;
  const parts: string[] = new Array(links.length).fill('');
  let next = 0, done = 0;
  const worker = async () => {
    while (next < links.length) {
      const i = next++;
      const sub = await parsePage(f, links[i]).catch(() => null);
      const text = sub ? htmlToText(sub) : '';
      if (text) {
        const title = chapterTitle(links[i]);
        // não repete o título se o capítulo já começa com ele
        parts[i] = text.toLowerCase().startsWith(title.toLowerCase()) ? text : `${title}\n${text}`;
      }
      opts.step?.(++done, links.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const all = parts.filter(Boolean).join('\n');
  return all.length > 500 ? all : own.length > 1500 ? own : null;
}
