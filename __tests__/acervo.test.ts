import { findInCatalog, type GutBook } from '../src/core/gutenberg';
import { chapterLinks, chapterTitle, decodeEntities, fetchWikisourceBook, htmlToText } from '../src/core/wikisource';
import { ACERVO, acervoId, isAcervoId } from '../src/data/acervo';

const gb = (id: number, title: string, author: string): GutBook => ({
  id, title, authors: [{ name: author, birth_year: null, death_year: null }], subjects: [], bookshelves: [], languages: ['pt'],
  copyright: false, media_type: 'Text', formats: {}, download_count: 0,
});

describe('acervo curado', () => {
  it('todas as obras em domínio público, com sinopse e fonte', () => {
    const slugs = new Set<string>();
    for (const a of ACERVO) {
      expect(slugs.has(a.slug)).toBe(false);
      slugs.add(a.slug);
      expect(a.died).toBeLessThanOrEqual(new Date().getFullYear() - 71);
      expect(a.synopsis.length).toBeGreaterThan(80);
      expect(a.find.gutenberg || a.find.wikisource).toBeTruthy();
      expect(isAcervoId(acervoId(a.slug))).toBe(true);
    }
    expect(ACERVO.length).toBeGreaterThanOrEqual(25);
  });

  it('acha no catálogo do Gutenberg pela grafia antiga, preferindo o título exato', () => {
    const books = [
      gb(1, 'O Guarany: romance brasileiro', 'Alencar, José Martiniano de'),
      gb(2, 'O Guarany, volume 2', 'Alencar, José Martiniano de'),
      gb(3, 'Dom Casmurro', 'Machado de Assis, Joaquim Maria'),
      gb(4, 'Dom Casmurro', 'Outro, Autor'),
    ];
    expect(findInCatalog(books, 'O Guarany', 'Alencar')?.id).toBe(1);
    expect(findInCatalog(books, 'Dom Casmurro', 'Machado')?.id).toBe(3);
    expect(findInCatalog(books, 'Iracema', 'Alencar')).toBeUndefined();
  });
});

describe('Wikisource', () => {
  const index = `<div class="mw-parser-output"><table class="headertemplate"><tr><td>Dom Casmurro</td></tr></table>
    <p>Romance de <a href="/wiki/Autor:Machado_de_Assis">Machado</a>.</p>
    <ul><li><a href="/wiki/Dom_Casmurro/I">I</a></li><li><a href="/wiki/Dom_Casmurro/Cap%C3%ADtulo_II">II</a></li>
    <li><a href="/wiki/Dom_Casmurro/I">I de novo</a></li><li><a href="/wiki/Outro_livro/I">x</a></li></ul></div>`;

  it('lista os capítulos na ordem, sem repetir', () => {
    expect(chapterLinks(index, 'Dom Casmurro')).toEqual(['Dom Casmurro/I', 'Dom Casmurro/Capítulo II']);
    expect(chapterTitle('Dom Casmurro/I')).toBe('Capítulo I');
    expect(chapterTitle('Dom Casmurro/Capítulo II')).toBe('Capítulo II');
  });

  it('extrai parágrafos e poemas, sem navegação nem notas', () => {
    const html = `<table><tr><td>navegação</td></tr></table><h2>Do título<span class="mw-editsection">[editar]</span></h2>
      <p>Uma noite destas, vindo da cidade<sup class="reference"><a>[1]</a></sup> para o Engenho Novo&nbsp;&mdash; encontrei&#46;</p>
      <div class="poem"><p>Stamos em pleno mar…<br>Doudo no espaço<br>\n<br>Brinca o luar</p></div>
      <ol class="references"><li>nota</li></ol>`;
    expect(htmlToText(html)).toBe('Do título\nUma noite destas, vindo da cidade para o Engenho Novo — encontrei.\nStamos em pleno mar…\nDoudo no espaço\nBrinca o luar');
    expect(decodeEntities('&laquo;a&raquo; &#x2014; &amp;')).toBe('«a» — &');
  });

  it('baixa a obra capítulo por capítulo', async () => {
    const pages: Record<string, string> = {
      'Dom Casmurro': index,
      'Dom Casmurro/I': `<p>${'Uma noite destas, vindo da cidade para o Engenho Novo. '.repeat(8)}</p>`,
      'Dom Casmurro/Capítulo II': `<p>Capítulo II</p><p>${'Agora que expliquei o título, passo a escrever o livro. '.repeat(8)}</p>`,
    };
    const f = async (url: string) => {
      const page = new URL(url).searchParams.get('page')!;
      return new Response(JSON.stringify(pages[page] ? { parse: { text: pages[page] } } : { error: { code: 'missingtitle' } }));
    };
    const steps: number[] = [];
    const text = await fetchWikisourceBook(f as never, 'Dom Casmurro', { step: (d) => steps.push(d) });
    const paras = text!.split('\n');
    expect(paras[0]).toBe('Capítulo I');
    expect(paras[2]).toBe('Capítulo II');
    expect(paras.filter((p) => p === 'Capítulo II')).toHaveLength(1);
    expect(steps.sort()).toEqual([1, 2]);
  });
});
