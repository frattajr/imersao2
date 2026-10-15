import { detectChapters } from '../src/core/chapters';
import { chunk } from '../src/core/text';
import { authorName, category, cleanGutenbergText, cleanTitle, synopsisOf, type GutBook } from '../src/services/gutenberg';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../src/state/db', () => ({ getRepo: jest.fn() }));
jest.mock('../src/services/supabase', () => ({ supabase: null }));
jest.mock('../src/services/sync', () => ({ syncSoon: jest.fn() }));

const RAW = `The Project Gutenberg eBook of Dom Casmurro\r
\r
This ebook is for the use of anyone anywhere...\r
\r
*** START OF THE PROJECT GUTENBERG EBOOK DOM CASMURRO ***\r
\r
Produced by Fulano de Tal\r
\r
DOM CASMURRO\r
\r
CAPITULO PRIMEIRO\r
\r
DO TITULO\r
\r
Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no\r
trem da Central um rapaz aqui do bairro, que eu conheço de vista e de\r
chapéu. Cumprimentou-me, sentou-se ao pé de mim, falou da lua e dos\r
ministros, e acabou recitando-me versos.\r
\r
CAPITULO II\r
\r
DO LIVRO\r
\r
Agora que expliquei o titulo, passo a escrever o livro. _Antes disso_, porém,\r
digamos os motivos que me põem a pena na mão.\r
\r
*** END OF THE PROJECT GUTENBERG EBOOK DOM CASMURRO ***\r
\r
Licença e mais licença...`;

const book = (o: Partial<GutBook>): GutBook => ({
  id: 55752, title: 'Dom Casmurro', authors: [{ name: 'Machado de Assis, Joaquim Maria', birth_year: 1839, death_year: 1908 }],
  subjects: ['Brazilian fiction -- 19th century'], bookshelves: [], languages: ['pt'], copyright: false, media_type: 'Text',
  formats: {}, download_count: 1234, ...o,
});

describe('Project Gutenberg', () => {
  it('tira cabeçalho, rodapé e créditos e remonta os parágrafos', () => {
    const t = cleanGutenbergText(RAW);
    expect(t).not.toMatch(/Project Gutenberg|Licença|Produced by/);
    const paras = t.split('\n');
    expect(paras[0]).toBe('DOM CASMURRO');
    expect(paras).toContain('Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me, sentou-se ao pé de mim, falou da lua e dos ministros, e acabou recitando-me versos.');
    expect(t).toContain('Antes disso, porém'); // itálico _assim_ vira texto normal
  });

  it('os capítulos do livro baixado aparecem no glossário', () => {
    const chs = detectChapters(chunk(cleanGutenbergText(RAW)));
    expect(chs.map((c) => c.title)).toEqual(['Início', 'CAPITULO PRIMEIRO', 'CAPITULO II']);
  });

  it('formata autor, título e categoria', () => {
    expect(authorName(book({}))).toBe('Joaquim Maria Machado de Assis');
    expect(authorName(book({ authors: [{ name: 'Camões, Luís de', birth_year: 1524, death_year: 1580 }] }))).toBe('Luís de Camões');
    expect(authorName(book({ authors: [] }))).toBe('Autor desconhecido');
    expect(cleanTitle('Os Lusíadas: poema épico')).toBe('Os Lusíadas');
    expect(category(book({}))).toBe('Romances');
    expect(category(book({ subjects: ['Portuguese poetry'] }))).toBe('Poesia');
    expect(category(book({ subjects: ['Portuguese drama'] }))).toBe('Teatro');
    expect(category(book({ subjects: ['Short stories, Brazilian'] }))).toBe('Contos');
  });

  it('usa o resumo do catálogo quando existe; senão, os assuntos', () => {
    expect(synopsisOf(book({ summaries: ['"Dom Casmurro" é um romance... (This is an automatically generated summary.)'] }))).toBe('"Dom Casmurro" é um romance...');
    expect(synopsisOf(book({}))).toMatch(/domínio público.*1908.*Ficção brasileira/);
  });
});
