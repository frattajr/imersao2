import { applyHighlights, exportMarkdown, searchBook, sentencesOf, type Annotation } from '../src/core/annotations';
import { linesFor, onePerScreen, paginate, screenOf, type PageBox } from '../src/core/paginate';
import { norm } from '../src/core/text';

const hl = (start: number, end: number, extra: Partial<Annotation> = {}): Annotation => ({
  id: 'h' + start, bookId: 'b', kind: 'highlight', page: 0, start, end, quote: '', note: '', color: 'yellow', createdAt: start, ...extra,
});

describe('grifos', () => {
  it('corta os segmentos nos limites do grifo e preserva o texto', () => {
    const segs = [{ t: 'Capitu', term: 'Capitu' }, { t: ' tinha olhos de ressaca.' }];
    const out = applyHighlights(segs, [hl(3, 18)]);
    expect(out.map((s) => s.t).join('')).toBe('Capitu tinha olhos de ressaca.');
    expect(out.filter((s) => s.hl).map((s) => s.t).join('')).toBe('itu tinha olhos');
    expect(out.find((s) => s.t === 'itu')).toMatchObject({ term: 'Capitu', hl: 'yellow' }); // termo continua tocável
  });

  it('sobreposição: vale o grifo mais recente; nota fica marcada', () => {
    const out = applyHighlights([{ t: 'abcdefghij' }], [hl(0, 6, { color: 'blue' }), hl(4, 10, { color: 'pink', note: 'oi', createdAt: 99 })]);
    expect(out.map((s) => [s.t, s.hl, !!s.note])).toEqual([['abcd', 'blue', false], ['efghij', 'pink', true]]);
  });

  it('sem grifos devolve os mesmos segmentos', () => {
    const segs = [{ t: 'nada' }];
    expect(applyHighlights(segs, [])).toBe(segs);
  });

  it('frases do parágrafo com posições exatas', () => {
    const p = 'Era noite. O vento uivava! Ninguém sabia… Por quê?';
    const s = sentencesOf(p);
    expect(s.map((x) => x.t)).toEqual(['Era noite.', 'O vento uivava!', 'Ninguém sabia…', 'Por quê?']);
    s.forEach((x) => expect(p.slice(x.start, x.end)).toBe(x.t));
  });

  it('exporta em Markdown agrupado por capítulo', () => {
    const md = exportMarkdown('Dom Casmurro', 'Machado de Assis', [
      hl(0, 5, { page: 3, quote: 'olhos de ressaca', note: 'imagem famosa' }),
      { ...hl(0, 0), kind: 'bookmark', page: 1 },
      hl(0, 5, { page: 9, quote: 'Capitu sorriu' }),
    ], (p) => (p < 5 ? 'Capítulo I' : 'Capítulo II'));
    expect(md).toContain('2 grifos');
    expect(md).toMatch(/## Capítulo I\n\n> olhos de ressaca\n\n\*\*Nota:\*\* imagem famosa/);
    expect(md).toContain('## Capítulo II');
    expect(md).not.toContain('bookmark');
  });
});

describe('busca no livro', () => {
  it('acha sem acento e sem maiúsculas, com contexto', () => {
    const r = searchBook(['A Capitú olhou.', 'Nada aqui.', 'capitu e capitu'], 'CAPITU', 10, norm);
    expect(r.map((x) => [x.page, x.match])).toEqual([[0, 'Capitú'], [2, 'capitu'], [2, 'capitu']]);
    expect(r[0].before).toBe('A ');
    expect(searchBook(['x'], 'a', 10, norm)).toEqual([]); // busca curta demais
  });
});

describe('página cheia', () => {
  const box: PageBox = { width: 340, height: 900, fontSize: 20, lineHeight: 34, paraGap: 20 };
  const para = 'palavra '.repeat(30).trim(); // ~240 caracteres

  it('estima linhas pela largura', () => {
    expect(linesFor(para, box)).toBe(Math.ceil(para.length / Math.floor((340 / 10) * 0.86)));
  });

  it('agrupa parágrafos até encher a tela, sem cortar nenhum', () => {
    const pages = Array.from({ length: 20 }, () => para);
    const screens = paginate(pages, box);
    expect(screens.length).toBeGreaterThan(3);
    expect(screens.length).toBeLessThan(20);
    expect(screens[0].start).toBe(0);
    expect(screens.at(-1)!.end).toBe(20);
    screens.slice(1).forEach((s, i) => expect(s.start).toBe(screens[i].end)); // contínuo
    screens.forEach((s) => {
      const h = pages.slice(s.start, s.end).reduce((t, p, k) => t + linesFor(p, box) * box.lineHeight + (k ? box.paraGap : 0), 0);
      if (s.end - s.start > 1) expect(h).toBeLessThanOrEqual(box.height);
    });
  });

  it('título de capítulo começa tela nova', () => {
    const screens = paginate(['curto.', 'Capítulo 2 — A volta', 'outro.'], box);
    expect(screens.map((s) => s.start)).toEqual([0, 1]);
  });

  it('sem medida: um parágrafo por tela; acha a tela de um parágrafo', () => {
    expect(paginate(['a', 'b'], null)).toEqual(onePerScreen(2));
    const s = [{ start: 0, end: 3 }, { start: 3, end: 5 }, { start: 5, end: 9 }];
    expect([0, 2, 3, 4, 8].map((p) => screenOf(s, p))).toEqual([0, 0, 1, 1, 2]);
  });
});
