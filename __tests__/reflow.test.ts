import { xhtmlToParagraphs } from '../src/core/epub';
import { cleanGutenbergText } from '../src/core/gutenberg';
import { cleanChars, PAGE_NUMBER, stripRunningHeads } from '../src/core/reflow';
import { joinPdfPages } from '../src/core/text';

const body = (n: number) => [
  `Linha de texto corrido número ${n}, longa o bastante para ser do miolo da página e`,
  `continuar na linha seguinte (página ${n}) sem ponto final, como num livro impresso.`,
];

describe('reflow de PDF', () => {
  it('reconhece paginação impressa', () => {
    ['12', '- 12 -', 'Página 12', 'pág. 3 de 200', 'xiv', '— 7 —'].forEach((s) => expect(PAGE_NUMBER.test(s)).toBe(true));
    ['12 de outubro de 1890 foi um dia comum.', 'Capítulo 12'].forEach((s) => expect(PAGE_NUMBER.test(s)).toBe(false));
  });

  it('tira cabeçalhos e rodapés que se repetem, sem tocar no miolo', () => {
    const pages = [1, 2, 3, 4, 5].map((n) => ['DOM CASMURRO', `Machado de Assis — ${n}`, ...body(n), String(n + 10)]);
    pages[2].splice(2, 0, 'DOM CASMURRO'); // repetição no miolo: fica
    const out = stripRunningHeads(pages);
    out.forEach((lines, i) => {
      expect(lines).not.toContain(String(i + 11));
      expect(lines.join(' ')).not.toMatch(/Machado de Assis —/);
      expect(lines.filter((l) => l.startsWith('Linha') || l.startsWith('continuar'))).toHaveLength(2); // miolo intacto
    });
    expect(out[0]).not.toContain('DOM CASMURRO');
    expect(out[2].filter((l) => l === 'DOM CASMURRO')).toHaveLength(1); // a do miolo fica
  });

  it('livro todo: parágrafos contínuos, sem cabeçalho, número de página nem hifenização', () => {
    const pages = [
      ['O ALIENISTA', 'Era uma vez um médico muito estudioso que mora-', 'va em Itaguaí e estudava a mente humana.', 'Ele tinha uma ideia que mudaria a vi-', '1'],
      ['O ALIENISTA', 'da da vila inteira para sempre, sem que ninguém', 'soubesse.', '2'],
      ['O ALIENISTA', 'Outro dia começou cedo na vila de Itaguaí, com sol.', '3'],
    ];
    const text = joinPdfPages(pages);
    expect(text).not.toMatch(/O ALIENISTA|\b[123]\b$/m);
    expect(text).toContain('Era uma vez um médico muito estudioso que morava em Itaguaí');
    expect(text).toContain('mudaria a vida da vila inteira para sempre');
  });

  it('ligaduras, hífen invisível e espaços estranhos', () => {
    expect(cleanChars('ﬁm do ﬂuxo, com­pu­ta­dor e​espaço')).toBe('fim do fluxo, computador eespaço');
  });
});

describe('EPUB e Gutenberg', () => {
  it('EPUB: tira marcadores de página, chamadas e blocos de nota', () => {
    const html = `<html><body>
      <p>Era uma vez<span epub:type="pagebreak" id="p12" title="12"/> uma menina<a epub:type="noteref" href="#n1">1</a>.</p>
      <span role="doc-pagebreak" aria-label="13">13</span>
      <p>Segundo parágrafo com hí­fen invisível.</p>
      <aside epub:type="footnote" id="n1"><p>Nota de rodapé que não deve aparecer.</p></aside>
    </body></html>`;
    expect(xhtmlToParagraphs(html)).toEqual(['Era uma vez uma menina.', 'Segundo parágrafo com hífen invisível.']);
  });

  it('Gutenberg: tira marcadores [Pg 12], {12} e [Ilustração]', () => {
    const raw = '*** START OF THE PROJECT GUTENBERG EBOOK X ***\n\nTexto [Pg 12] continua {13} aqui.\n\n[Illustration: um farol]\n\nFim.\n\n*** END OF THE PROJECT GUTENBERG EBOOK X ***';
    expect(cleanGutenbergText(raw)).toBe('Texto continua aqui.\nFim.');
  });
});
