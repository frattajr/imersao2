import { findInCatalog, type GutBook } from '../src/core/gutenberg';
import { chapterLinks, chapterTitle, decodeEntities, disambiguationLinks, fetchWikisourceBook, htmlToText } from '../src/core/wikisource';
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

  it('desambiguação: "Senhora" leva a "Senhora (José de Alencar)"', async () => {
    const dis = '<p>Senhora pode referir-se a:</p><ul><li><a href="/wiki/Senhora_(Jos%C3%A9_de_Alencar)">Senhora (José de Alencar)</a></li><li><a href="/wiki/Senhora_(poema)">poema</a></li></ul>';
    expect(disambiguationLinks(dis, 'Senhora')).toEqual(['Senhora (José de Alencar)', 'Senhora (poema)']);
    const pages: Record<string, string> = {
      Senhora: dis,
      'Senhora (José de Alencar)': `<p>${'Há anos raiou no céu fluminense uma nova estrela. '.repeat(40)}</p>`,
    };
    const f = async (url: string) => {
      const u = new URL(url).searchParams;
      if (u.get('list') === 'search') return new Response(JSON.stringify({ query: { search: [] } }));
      const page = u.get('page')!;
      return new Response(JSON.stringify(pages[page] ? { parse: { text: pages[page] } } : { error: { code: 'missingtitle' } }));
    };
    const text = await fetchWikisourceBook(f as never, 'Senhora', { author: 'Alencar' });
    expect(text?.startsWith('Há anos raiou')).toBe(true);
  });

  it('obra em dois níveis: edição → partes → capítulos', async () => {
    const big = (t: string) => `<p>${(t + ' ').repeat(30)}</p>`;
    const pages: Record<string, string> = {
      'Os Sertões': '<p>Edições:</p><ul><li><a href="/wiki/Os_Sert%C3%B5es/1902">1902</a></li></ul>',
      'Os Sertões/1902': '<ul><li><a href="/wiki/Os_Sert%C3%B5es/1902/A_Terra">A Terra</a></li><li><a href="/wiki/Os_Sert%C3%B5es/1902/O_Homem">O Homem</a></li></ul>',
      'Os Sertões/1902/A Terra': '<ul><li><a href="/wiki/Os_Sert%C3%B5es/1902/A_Terra/I">I</a></li><li><a href="/wiki/Os_Sert%C3%B5es/1902/A_Terra/II">II</a></li></ul>',
      'Os Sertões/1902/A Terra/I': big('O planalto central do Brasil desce, nos litorais do Sul, em escarpas inteiriças.'),
      'Os Sertões/1902/A Terra/II': big('Do alto da serra de Monte Santo atufa-se o olhar em horizontes vastos.'),
      'Os Sertões/1902/O Homem': big('A gênese das raças mestiças do Brasil é problema que por muito tempo ainda desafiará o esforço dos melhores espíritos.'),
    };
    const f = async (url: string) => {
      const u = new URL(url).searchParams;
      if (u.get('list') === 'search') return new Response(JSON.stringify({ query: { search: [] } }));
      const page = u.get('page')!;
      return new Response(JSON.stringify(pages[page] ? { parse: { text: pages[page] } } : { error: { code: 'missingtitle' } }));
    };
    const text = (await fetchWikisourceBook(f as never, 'Os Sertões'))!;
    expect(text).toContain('O planalto central');
    expect(text).toContain('Do alto da serra');
    expect(text).toContain('A gênese das raças');
    expect(text.indexOf('O planalto')).toBeLessThan(text.indexOf('A gênese'));
  });
});
