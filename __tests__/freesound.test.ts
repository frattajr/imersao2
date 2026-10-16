/** Pacote de sons do Freesound: buscas, duração e escolha só de sons CC0. */
import { bestHit, durationFilter, QUERY, queriesFor } from '../src/core/freesound';
import { LAYERS, SPOTS } from '../src/core/types';

const hit = (id: number, license: string, rating: number, dl: number) =>
  ({ id, name: 'x', username: 'u', license, duration: 30, avg_rating: rating, num_downloads: dl, previews: {} });

describe('pacote do Freesound', () => {
  it('tem busca para todo ambiente e todo efeito', () => {
    [...LAYERS, ...SPOTS].forEach((n) => expect(QUERY[n]).toBeTruthy());
  });
  it('detalhe afina a busca, com a busca simples de reserva', () => {
    expect(queriesFor({ cat: 'spot', name: 'steps', material: 'wood' })).toEqual(['footsteps wood', 'footsteps']);
    expect(queriesFor({ cat: 'layer', name: 'rain' })).toEqual(['rain ambience']);
  });
  it('ambiente longo para virar loop; efeito curto', () => {
    expect(durationFilter({ cat: 'layer', name: 'rain' })).toContain('20 TO 180');
    expect(durationFilter({ cat: 'spot', name: 'bark' })).toContain('0.5 TO 8');
  });
  it('só CC0, melhor avaliado, sem repetir arquivo', () => {
    const hits = [
      hit(1, 'http://creativecommons.org/licenses/by/4.0/', 5, 9999),
      hit(2, 'http://creativecommons.org/publicdomain/zero/1.0/', 4, 100),
      hit(3, 'http://creativecommons.org/publicdomain/zero/1.0/', 4.5, 5000),
    ];
    expect(bestHit(hits, new Set())?.id).toBe(3);
    expect(bestHit(hits, new Set([3]))?.id).toBe(2);
  });
});
