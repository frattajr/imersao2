import JSZip from 'jszip';
import { analyze } from '../src/core/analyze';
import { parseEpubBytes, resolvePath, sniff, xhtmlToParagraphs, decodeEntities } from '../src/core/epub';
import { entriesOnPage, removeEntry, upsertEntry } from '../src/core/glossary';
import { blendAmbience, sanitizePlan } from '../src/core/plan';
import { chunk, contentId, joinPdfPages, linesToParas, minutesLeft, norm, wordsRemaining } from '../src/core/text';

describe('texto', () => {
  it('normaliza acentos', () => {
    expect(norm('Ação Café')).toBe('acao cafe');
  });

  it('divide parágrafos longos em páginas sem perder texto', () => {
    const longo = Array.from({ length: 12 }, (_, i) => `Esta é a frase número ${i + 1} do parágrafo longo.`).join(' ');
    const pages = chunk(`Curto.\n\n${longo}`);
    expect(pages[0]).toBe('Curto.');
    expect(pages.length).toBeGreaterThan(2);
    pages.forEach((p) => expect(p.length).toBeLessThanOrEqual(330));
    expect(pages.slice(1).join(' ').replace(/\s+/g, ' ')).toBe(longo);
  });

  it('reconstrói parágrafos de PDF e une hifenização', () => {
    const lines = [
      'Era uma vez uma menina que mora-',
      'va perto do mar e gostava de ler todas as noites',
      'antes de dormir.',
      '12',
      'Outro parágrafo começa aqui e segue por toda a linha',
      'até terminar.',
    ];
    expect(linesToParas(lines)).toEqual([
      'Era uma vez uma menina que morava perto do mar e gostava de ler todas as noites antes de dormir.',
      'Outro parágrafo começa aqui e segue por toda a linha até terminar.',
    ]);
  });

  it('emenda frase cortada entre páginas do PDF', () => {
    const t = joinPdfPages([
      ['Uma frase que começa numa página muito longa de texto corrido e', 'continua'],
      ['na página seguinte até o ponto final.'],
    ]);
    expect(t).toBe('Uma frase que começa numa página muito longa de texto corrido e continua na página seguinte até o ponto final.');
  });

  it('calcula palavras restantes e minutos', () => {
    expect(wordsRemaining(['a b', 'c', 'd e f'])).toEqual([6, 4, 3]);
    expect(minutesLeft(421)).toBe(3);
  });

  it('gera o mesmo id para o mesmo conteúdo', () => {
    expect(contentId(['a', 'b'])).toBe(contentId(['a', 'b']));
    expect(contentId(['a', 'b'])).not.toBe(contentId(['ab']));
  });
});

describe('EPUB', () => {
  it('extrai parágrafos de XHTML', () => {
    const html = '<html><head><title>x</title><style>p{}</style></head><body><h1>Capítulo&nbsp;1</h1><p>Olá <em>mundo</em> &amp; mar<sup>1</sup>.</p><div><p>Segundo&#8230;</p></div></body></html>';
    expect(xhtmlToParagraphs(html)).toEqual(['Capítulo 1', 'Olá mundo & mar.', 'Segundo…']);
    expect(decodeEntities('&#x2014;&laquo;')).toBe('—«');
  });

  it('resolve caminhos relativos', () => {
    expect(resolvePath('OEBPS/', 'text/cap%201.xhtml#x')).toBe('OEBPS/text/cap 1.xhtml');
    expect(resolvePath('OEBPS/text/', '../img/a.png')).toBe('OEBPS/img/a.png');
  });

  it('lê um EPUB completo pela ordem de leitura e ignora o sumário', async () => {
    const z = new JSZip();
    z.file('mimetype', 'application/epub+zip');
    z.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    z.file('OEBPS/content.opf', `<package><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>O Farol &amp; o Mar</dc:title></metadata>
      <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
      <item id="c2" href="Text/c2.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="Text/c1.xhtml" media-type="application/xhtml+xml"/></manifest>
      <spine><itemref idref="nav"/><itemref idref="c1"/><itemref idref="c2"/></spine></package>`);
    z.file('OEBPS/nav.xhtml', '<html><body><nav epub:type="toc"><ol><li>Cap 1</li></ol></nav></body></html>');
    z.file('OEBPS/Text/c1.xhtml', '<html><body><p>Primeiro capítulo.</p></body></html>');
    z.file('OEBPS/Text/c2.xhtml', '<html><body><p>Segundo capítulo.</p></body></html>');
    const bytes = await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    expect(sniff(bytes)).toBe('epub');
    const book = await parseEpubBytes(bytes);
    expect(book.title).toBe('O Farol & o Mar');
    expect(book.text).toBe('Primeiro capítulo.\nSegundo capítulo.');
  });

  it('detecta PDF pelo conteúdo', () => {
    expect(sniff(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe('pdf');
    expect(sniff(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe('plano de som', () => {
  it('descarta nomes desconhecidos e limita números', () => {
    const p = sanitizePlan({
      mood: 'fire',
      ambience: { fire: 0.6, rain: 3, bogus: 1, wind: 0.05, sea: 0.3, cafe: 0.2 },
      spots: [{ s: 'steps', surface: 'metal', at: 99, w: -1, n: 50 }, { s: 'explosao', at: 1 }, { s: 'roar', at: 2, w: 0.5 }, { s: 'owl' }],
    })!;
    expect(p.mood).toBe('fire');
    expect(Object.keys(p.ambience)).toEqual(['rain', 'fire', 'sea']);
    expect(p.ambience.rain).toBe(1);
    expect(p.spots).toEqual([{ s: 'steps', surface: 'metal', at: 10, w: 0.15, n: 16 }, { s: 'roar', at: 2, w: 0.5 }]);
    expect(sanitizePlan('lixo')).toBeNull();
  });

  it('suaviza a troca de cena', () => {
    const m = blendAmbience({ rain: 0.6, thunder: 1, sea: 0.5 }, { fire: 0.5, sea: 0.55 }, true);
    expect(m).toEqual({ fire: 0.5, sea: 0.5, rain: 0.33 });
  });

  it('escolhe ambiente e sons por palavras-chave', () => {
    const a = analyze('Passos na escada de ferro. A chuva batia no telhado e o trovão rugia longe.');
    expect(a.mood).toBe('rain');
    expect(a.ambience.rain).toBeDefined();
    expect(a.spots[0]).toMatchObject({ s: 'steps', surface: 'metal' });
    expect(analyze('Uma noite escura e silenciosa.').ambience.cricket).toBeUndefined();
  });
});

describe('glossário', () => {
  it('adiciona, atualiza e remove sem duplicar', () => {
    let g = upsertEntry([], ' Marina ', 'guardiã do farol');
    g = upsertEntry(g, 'marina', 'protagonista');
    expect(g).toEqual([{ term: 'Marina', desc: 'protagonista' }]);
    g = upsertEntry(g, '', 'x');
    expect(g.length).toBe(1);
    expect(removeEntry(g, 'MARINA')).toEqual([]);
  });

  it('acha termos na página só como palavra inteira', () => {
    const g = [{ term: 'Orm', desc: '' }, { term: 'mar', desc: '' }, { term: 'Ação', desc: '' }];
    expect(entriesOnPage(g, 'O velho Orm olhou a maré e a acao.').map((x) => x.term)).toEqual(['Orm', 'Ação']);
  });
});

import { chapterAt, detectChapters, headingOf, properNouns } from '../src/core/chapters';
import { SAMPLE_BOOKS } from '../src/data/books';

describe('capítulos', () => {
  it('reconhece títulos de capítulo', () => {
    expect(headingOf('Capítulo 1 — A nevasca')).toBe('Capítulo 1 — A nevasca');
    expect(headingOf('CAPÍTULO III')).toBe('CAPÍTULO III');
    expect(headingOf('Parte dois: o retorno.')).toBe('Parte dois: o retorno');
    expect(headingOf('XII')).toBe('Capítulo XII');
    expect(headingOf('Chapter 4')).toBe('Chapter 4');
    expect(headingOf('O capítulo mais difícil da vida dela começou naquela manhã de chuva.')).toBeNull();
  });

  it('divide o livro pelos títulos', () => {
    const cabana = SAMPLE_BOOKS.find((b) => b.id === 'sample-cabana')!;
    const chs = detectChapters(cabana.pages);
    expect(chs.map((c) => c.title)).toEqual(['Capítulo 1 — A nevasca', 'Capítulo 2 — O visitante', 'Capítulo 3 — Manhã branca']);
    expect(chs[0].start).toBe(0);
    expect(chs[2].end).toBe(cabana.pages.length);
    expect(chapterAt(chs, 7)).toBe(1);
  });

  it('livro sem títulos: partes de tamanho parecido, nomeadas pelo começo', () => {
    const farol = SAMPLE_BOOKS.find((b) => b.id === 'sample-farol')!;
    const chs = detectChapters(farol.pages);
    expect(chs.length).toBeGreaterThan(1);
    expect(chs[0].title).toMatch(/^Parte 1 · Marina chegou/);
    expect(chs.reduce((n, c) => n + (c.end - c.start), 0)).toBe(farol.pages.length);
  });

  it('sugere nomes próprios do capítulo, não palavras comuns', () => {
    const t = 'Ela abriu a porta. Bento sorriu. — Meu nome é Bento — disse ele, e o cachorro Farol deitou perto do fogo. Lá fora, Júlia ouviu o sino.';
    const names = properNouns(t);
    expect(names).toEqual(expect.arrayContaining(['Bento', 'Farol', 'Júlia']));
    expect(names).not.toContain('Ela');
    expect(names).not.toContain('Meu');
  });
});
