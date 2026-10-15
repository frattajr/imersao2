import { looksArchaic, modernize, modernizeWord } from '../src/core/orthography';

describe('grafia antiga → atual', () => {
  it('palavras comuns e regras de letras', () => {
    const cases: [string, string][] = [
      ['elle', 'ele'], ['Ella', 'Ela'], ['aquelle', 'aquele'], ['hontem', 'ontem'], ['pharmacia', 'farmácia'], ['theatro', 'teatro'],
      ['systema', 'sistema'], ['effeito', 'efeito'], ['attenção', 'atenção'], ['approximar', 'aproximar'], ['accusar', 'acusar'],
      ['comprehender', 'compreender'], ['Christo', 'Cristo'], ['portuguez', 'português'], ['THEATRO', 'TEATRO'], ['Thomaz', 'Tomás'],
      ['abysmo', 'abismo'], ['rhetorica', 'retorica'], ['anno', 'ano'], ['Anna', 'Ana'], ['escripto', 'escrito'], ['acção', 'ação'],
    ];
    for (const [a, b] of cases) expect(modernizeWord(a)).toBe(b);
  });

  it('não mexe no que já é atual', () => {
    for (const w of ['carro', 'pássaro', 'chave', 'filho', 'ninho', 'Bahia', 'ficção', 'convicção', 'aspecto', 'connosco', 'esse', 'ela', 'cousa'.replace('ou', 'oi')]) {
      expect(modernizeWord(w)).toBe(w);
    }
  });

  it('frase inteira: contrações, crase antiga e acentos da lista', () => {
    const t = 'Elle sahiu hontem á noite d\'aquella casa, e n\'um instante tambem ella comprehendeu tudo.';
    expect(modernize(t, true)).toBe('Ele saiu ontem à noite daquela casa, e num instante também ela compreendeu tudo.');
  });

  it('só atualiza textos que parecem antigos', () => {
    const modern = 'Ela saiu ontem à noite e ninguém percebeu. Arthur ficou na sala, olhando a chuva. '.repeat(20);
    expect(looksArchaic(modern)).toBe(false);
    expect(modernize(modern)).toBe(modern);
    const old = 'Elle disse que ella não viria. Hontem, á tarde, aquelle homem sahiu do theatro. '.repeat(10);
    expect(looksArchaic(old)).toBe(true);
    expect(modernize(old)).toContain('Ele disse que ela não viria. Ontem, à tarde, aquele homem saiu do teatro.');
  });
});

describe('grafia de 1943–1971', () => {
  it('tira os acentos diferenciais que caíram', () => {
    const t = 'Êle pôs o livro sôbre a mesa e disse que êste era o melhor. '.repeat(10);
    expect(looksArchaic(t)).toBe(true);
    expect(modernize(t)).toContain('Ele pôs o livro sobre a mesa e disse que este era o melhor.');
  });
});
