import {
  addReading, dayKey, dedupeVolumes, formatDuration, forYou, looksEnglish, minutesToRead, openingExcerpt, recommend, searchCatalog,
  soundProfile, streakOf, volumeKey, type CatalogEntry,
} from '../src/core/catalog';
import { ACERVO, acervoId } from '../src/data/acervo';
import { SAMPLE_BOOKS } from '../src/data/books';
import { MONTHLY, VESTIBULAR, monthlyCollection } from '../src/data/collections';

const E = (o: Partial<CatalogEntry> & { id: string; title: string }): CatalogEntry => ({
  author: 'Autor', source: 'acervo', layers: [], tags: [], calibrated: false, openable: true, ...o,
});

describe('catálogo', () => {
  it('duração no ritmo da pessoa', () => {
    expect(minutesToRead(2300, 230)).toBe(10);
    expect(formatDuration(8)).toBe('8 min');
    expect(formatDuration(80)).toBe('1 h 20');
    expect(formatDuration(300)).toBe('5 h');
  });

  it('busca sem acento, pela grafia antiga, com filtros', () => {
    const list = [
      E({ id: 'a', title: 'O Guarany', author: 'José de Alencar', origin: 'BR', year: 1857, words: 90000, layers: ['leaves'] }),
      E({ id: 'b', title: 'Os Maias', author: 'Eça de Queirós', origin: 'PT', year: 1888, words: 200000 }),
      E({ id: 'c', title: 'O Coração Delator', author: 'Edgar Allan Poe', words: 2300, layers: ['night'], calibrated: true, source: 'sample' }),
    ];
    expect(searchCatalog(list, { q: 'guarani' }, 230).map((e) => e.id)).toEqual(['a']);
    expect(searchCatalog(list, { q: 'eca' }, 230).map((e) => e.id)).toEqual(['b']);
    expect(searchCatalog(list, { origin: 'BR' }, 230).map((e) => e.id)).toEqual(['a']);
    expect(searchCatalog(list, { duration: 'curto' }, 230).map((e) => e.id)).toEqual(['c']);
    expect(searchCatalog(list, { era: 'xix', climate: 'natureza' }, 230).map((e) => e.id)).toEqual(['a']);
  });

  it('volumes repetidos viram uma obra só', () => {
    expect(volumeKey('O Guarany: romance brasileiro (Vol. 2 de 2)')).toBe('o guarani');
    expect(volumeKey('Os Lusiadas, Tomo II')).toBe(volumeKey('Os Lusíadas'));
    const xs = [{ t: 'O Guarany, vol. 1', a: 'Alencar' }, { t: 'O Guarany, vol. 2', a: 'Alencar' }, { t: 'Iracema', a: 'Alencar' }];
    expect(dedupeVolumes(xs, (x) => x.t, (x) => x.a)).toHaveLength(2);
  });

  it('reconhece resumo em inglês e tira um trecho de abertura em português', () => {
    expect(looksEnglish('"Dom Casmurro" by Machado de Assis is a novel written in the late 19th century. The story revolves around')).toBe(true);
    expect(looksEnglish('Já velho, Bento Santiago tenta atar as duas pontas da vida e conta a própria história.')).toBe(false);
    const t = 'CAPÍTULO I\nDo título\n' + 'Uma noite destas, vindo da cidade para o Engenho Novo, encontrei num trem da Central um rapaz aqui do bairro. '.repeat(4);
    const ex = openingExcerpt(t);
    expect(ex.startsWith('Uma noite destas')).toBe(true);
    expect(ex.length).toBeLessThanOrEqual(241);
  });

  it('perfil sonoro do livro: climas que dominam e tamanho', () => {
    const t = Array.from({ length: 40 }, (_, i) => (i % 3 ? 'A chuva batia na janela e o vento assobiava a noite inteira, sem parar.' : 'Ela sorriu e serviu o café quente na mesa da cozinha.')).join('\n');
    const p = soundProfile(t);
    expect(p.layers).toContain('rain');
    expect(p.words).toBeGreaterThan(400);
  });

  it('recomenda pelo autor, temas e clima; "para você" pelos gostos', () => {
    const lido = E({ id: 'x', title: 'Dom Casmurro', author: 'Machado de Assis', tags: ['amor', 'ciúme', 'Rio de Janeiro'] });
    const list = [
      lido,
      E({ id: 'y', title: 'Quincas Borba', author: 'Machado de Assis', tags: ['dinheiro', 'Rio de Janeiro'] }),
      E({ id: 'z', title: 'Iracema', author: 'José de Alencar', tags: ['amor', 'natureza'] }),
      E({ id: 'w', title: 'Os Sertões', author: 'Euclides da Cunha', tags: ['guerra'] }),
    ];
    const r = recommend(list, [lido], new Set(['x']));
    expect(r[0].id).toBe('y');
    expect(r.map((e) => e.id)).not.toContain('w');
    expect(forYou(list, ['natureza'], [], new Set()).map((e) => e.id)).toEqual(['z']);
  });

  it('sequência de dias e minutos do dia', () => {
    const d = (s: string) => new Date(`${s}T12:00:00`);
    let days = addReading({}, d('2026-10-13'), 5);
    days = addReading(days, d('2026-10-14'), 12);
    days = addReading(days, d('2026-10-15'), 3);
    days = addReading(days, d('2026-10-15'), 4);
    expect(days[dayKey(d('2026-10-15'))]).toBe(7);
    expect(streakOf(days, d('2026-10-15'))).toBe(3);
    // hoje ainda não leu: conta até ontem
    expect(streakOf(days, d('2026-10-16'))).toBe(3);
    expect(streakOf(days, d('2026-10-18'))).toBe(0);
  });

  it('coleções só apontam para obras que existem', () => {
    const ids = new Set([...SAMPLE_BOOKS.map((b) => b.id), ...ACERVO.map((a) => acervoId(a.slug))]);
    for (const c of [...MONTHLY, VESTIBULAR]) for (const id of c.ids) expect(ids.has(id) ? id : `faltando: ${id}`).toBe(id);
    expect(monthlyCollection(new Date('2026-10-15')).id).toBe(MONTHLY[(2026 * 12 + 9) % MONTHLY.length].id);
  });
});
