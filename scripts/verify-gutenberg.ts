/**
 * Testa a montagem da cópia do Gutenberg com Gutendex e gutenberg.org
 * simulados: Gutendex com 2 páginas, catálogo CSV completando, textos limpos,
 * falhas (página que não responde, livro sem texto) sem derrubar nada.
 * Uso: bun scripts/verify-gutenberg.ts
 */
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildMirror } from './build-gutenberg';

let fails = 0;
const ok = (c: unknown, m: string) => { console.log((c ? 'ok   ' : 'FALHOU ') + '- ' + m); if (!c) fails++; };
const book = (id: number, title: string, dl: number) => ({
  id, title, authors: [{ name: 'Assis, Machado de', birth_year: 1839, death_year: 1908 }], summaries: ['Resumo.'], subjects: ['Brazilian fiction'],
  bookshelves: [], languages: ['pt'], copyright: false, media_type: 'Text', download_count: dl,
  formats: { 'text/plain; charset=utf-8': `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`, 'text/html': 'x', 'image/jpeg': `https://img/${id}.jpg` },
});
const TXT = (t: string) => `blah\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\n\nCAPITULO I\n\n${('Era uma vez ' + t + ', uma linha\nquebrada no meio. ').repeat(40)}\n\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nlicença`;
const CSVTXT = 'Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves\n' +
  '55752,Text,2017-10-01,Dom Casmurro,pt,"Machado de Assis, 1839-1908",Brazilian fiction,PQ,\n' +
  '3333,Text,2002-01-01,"Os Lusíadas",pt,"Camões, Luís de, 1524?-1580",Epic poetry,PQ,Poetry\n' +
  '9999,Text,2002-01-01,English Book,en,"Someone, 1900-1950",,PR,\n' +
  '7777,Sound,2002-01-01,Audio pt,pt,,,,\n';

const hits: string[] = [];
const fake = async (url: string): Promise<Response> => {
  hits.push(url);
  if (url === 'https://gutendex.com/books/?languages=pt') return Response.json({ count: 3, next: 'https://gutendex.com/books/?languages=pt&page=2', previous: null, results: [book(55752, 'Dom Casmurro', 900), book(54829, 'Braz Cubas', 800)] });
  if (url.includes('page=2')) return Response.json({ count: 3, next: null, previous: null, results: [{ ...book(1, 'Audiolivro', 5), media_type: 'Sound' }, book(16384, 'Contos Fluminenses', 100)] });
  if (url.endsWith('pg_catalog.csv')) return new Response(CSVTXT);
  if (url.includes('/cache/epub/54829/')) return new Response('nope', { status: 500 }); // cai para o formato do catálogo
  if (url.includes('16384')) return new Response('', { status: 404 }); // livro sem texto: pula
  const id = /(\d+)/.exec(url.split('/').slice(-2).join('/'))?.[1] ?? '?';
  return new Response(TXT('livro ' + id));
};

const out = await mkdtemp(join(tmpdir(), 'gut-'));
const cat = await buildMirror(fake as typeof fetch, out, { texts: 4, log: () => undefined });
const saved = JSON.parse(await readFile(join(out, 'catalog.json'), 'utf8'));
ok(cat && saved.books.length === 4, 'catálogo: 3 do Gutendex (sem o audiolivro) + 1 só do CSV (sem livro em inglês nem áudio)');
ok(saved.books[0].id === 55752 && saved.books.at(-1).id === 3333, 'ordenado por downloads (os do CSV, sem contagem, por último)');
ok(!('text/html' in saved.books[0].formats) && saved.books[0].formats['image/jpeg'], 'guarda só os formatos que o app usa');
const lus = saved.books.find((b: { id: number }) => b.id === 3333);
ok(lus.authors[0].name === 'Camões, Luís de' && lus.authors[0].death_year === 1580, 'autor do CSV com anos (inclusive "1524?")');
ok(saved.source.includes('gutendex (2 páginas)') && saved.source.includes('catálogo oficial (+1)'), 'registra as fontes');
const files = await readdir(join(out, 'books'));
ok(saved.texts.join() === '3333,54829,55752' && files.length === 3, 'textos copiados (livro sem texto é pulado; outro formato quando o cache falha)');
const t = await readFile(join(out, 'books', '55752.txt'), 'utf8');
ok(t.startsWith('CAPITULO I\nEra uma vez livro 55752, uma linha quebrada no meio.') && !/licença|START OF/.test(t), 'texto limpo: sem cabeçalho/rodapé, linhas juntas');

// Gutendex fora do ar: o catálogo oficial salva o deploy
const out2 = await mkdtemp(join(tmpdir(), 'gut-'));
const down = async (url: string) => (url.includes('gutendex') ? Promise.reject(new Error('timeout')) : fake(url));
const origSetTimeout = globalThis.setTimeout;
(globalThis as { setTimeout: unknown }).setTimeout = ((fn: () => void, _ms?: number) => origSetTimeout(fn, 0)) as typeof setTimeout; // sem esperar os intervalos entre tentativas
const cat2 = await buildMirror(down as typeof fetch, out2, { texts: 1, log: () => undefined });
ok(cat2 && cat2.books.length === 2 && cat2.source.startsWith('catálogo oficial'), 'Gutendex fora do ar: usa só o catálogo oficial');

// tudo fora do ar: não escreve catálogo (o app consulta ao vivo) e não lança erro
const out3 = await mkdtemp(join(tmpdir(), 'gut-'));
const cat3 = await buildMirror((async () => { throw new Error('offline'); }) as typeof fetch, out3, { log: () => undefined });
ok(cat3 === null && !(await readdir(out3)).includes('catalog.json'), 'sem rede: não escreve catálogo e não derruba o deploy');
globalThis.setTimeout = origSetTimeout;

if (fails) { console.error(`\n${fails} falha(s).`); process.exit(1); }
console.log('\nCópia do Gutenberg: tudo certo.');
