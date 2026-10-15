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

async function api(f: Fetch, params: Record<string, string>, timeoutMs = 30_000): Promise<unknown> {
  const q = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await f(`${API}?${q.toString()}`, { signal: ctl.signal, headers: HEADERS });
    if (!r.ok) throw new Error(`Wikisource ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** HTML renderizado de uma página (null se não existir). */
export async function parsePage(f: Fetch, page: string): Promise<string | null> {
  const j = (await api(f, { action: 'parse', page, prop: 'text', redirects: '1' })) as { parse?: { text?: string }; error?: unknown };
  return j.parse?.text ?? null;
}

/** Título exato da página procurando pelo nome da obra (e autor, se vier). */
export async function searchTitle(f: Fetch, title: string, author = ''): Promise<string | null> {
  const j = (await api(f, { action: 'query', list: 'search', srsearch: `intitle:"${title}" ${author}`.trim(), srnamespace: '0', srlimit: '10' })) as
    { query?: { search?: { title: string }[] } };
  const hits = (j.query?.search ?? []).map((h) => h.title);
  const n = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // a página principal da obra (sem "/capítulo"), de preferência com o título igual
  return hits.find((h) => n(h) === n(title)) ?? hits.find((h) => !h.includes('/') && n(h).startsWith(n(title))) ?? null;
}

/**
 * Texto completo de uma obra. Se a página principal for um índice de
 * capítulos, baixa cada capítulo (com o título como parágrafo próprio, para
 * o sumário do leitor). `step` informa o progresso.
 */
export async function fetchWikisourceBook(
  f: Fetch, page: string, opts: { maxChapters?: number; author?: string; step?: (done: number, total: number) => void } = {},
): Promise<string | null> {
  let html = await parsePage(f, page);
  if (!html) {
    // título um pouco diferente no Wikisource: procura
    const found = await searchTitle(f, page, opts.author);
    if (found) { page = found; html = await parsePage(f, page); }
  }
  if (!html) return null;
  const links = chapterLinks(html, page).slice(0, opts.maxChapters ?? 150);
  const own = htmlToText(html);
  if (links.length < 2) return own.length > 500 ? own : null;
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
  return all.length > 500 ? all : own.length > 500 ? own : null;
}
