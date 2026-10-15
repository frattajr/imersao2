import { analyze } from '../src/core/analyze';
import { narration } from '../src/core/narration';
import { bedFor, buildSceneMap, establishedLocale, scenePlan, tensionOf } from '../src/core/narrative';

describe('leitura pelo sentido', () => {
  it('tira falas e deixa a narração entre travessões', () => {
    expect(narration('— Vem cá — disse ele, abrindo a porta. — E feche a janela.')).toBe('disse ele, abrindo a porta.');
    expect(narration('Ela disse “o mar está bravo” e sorriu.')).toBe('ela disse e sorriu.');
  });

  it('tira lembranças, metáforas e nomes próprios', () => {
    expect(narration('Lembrou do mar da infância.')).toBe('');
    expect(narration('Havia um mar de gente na missa.')).not.toMatch(/\bmar\b/);
    expect(narration('Nasci no Rio de Janeiro.')).toMatch(/cidade/);
    expect(narration('Nasci no Rio de Janeiro.')).not.toMatch(/\brio\b/);
    expect(narration('Subiram a Serra da Mantiqueira.')).not.toMatch(/serra/);
  });

  it('nenhum som por palavra solta', () => {
    for (const f of [
      'Ele se chamava Bento e chamou o criado para servir o jantar.',
      'Tinha uns olhos escuros e uma conversa mansa.',
      'Uma onda de ciúme me subiu ao rosto.',
      'A fonte de renda da família era pequena.',
      'Capitu riu e continuou a conversa com minha mãe na sala.',
      'O relógio da sala marcava nove horas.',
      'Tive medo, um medo de criança, e calei.',
      '— Ouviu o cachorro latir lá fora? — perguntou ela.',
      'Escreveu numa folha de papel e guardou.',
    ]) {
      const a = analyze(f);
      expect({ f, amb: a.ambience, spots: a.spots }).toEqual({ f, amb: {}, spots: [] });
    }
  });

  it('o sentido certo ainda toca', () => {
    expect(analyze('As chamas da lareira estalavam.').ambience.fire).toBeDefined();
    expect(analyze('Chovia sem parar sobre o telhado.').ambience.rain).toBeDefined();
    expect(analyze('O relógio da parede batia devagar, tique-taque.').ambience.clock).toBeDefined();
  });
});

describe('mapa de cenas', () => {
  const pages = [
    'CAPÍTULO I',
    'Naquela noite chovia muito. Entrei na sala e sentei-me junto à lareira, onde as brasas ainda estalavam.',
    '— Lembra do mar de Copacabana, das ondas na praia? — perguntou Capitu, rindo.',
    'Falamos de tudo um pouco; uma onda de ciúme me subiu ao rosto quando ela falou de Escobar.',
    'Fiquei calado. O fogo diminuía; lá fora a chuva continuava.',
    'No dia seguinte saí para a rua cedo. O sol batia nas calçadas e os cocheiros gritavam.',
    'Caminhei sem pressa, olhando as lojas e as carruagens que passavam.',
    'Ao meio-dia cheguei à praia. O mar estava calmo e o vento era fresco.',
    'Sentei-me na areia e fiquei ouvindo as ondas.',
    'CAPÍTULO II',
    'Mais tarde, já em casa, ouvi passos no corredor. Gritei! Ninguém respondeu! Corri, tremendo de medo, com o punhal na mão!',
  ];
  const map = buildSceneMap(pages, { year: 1899 });
  const plan = (i: number) => scenePlan(map, pages, i);
  const layers = (i: number) => (plan(i).mix ?? []).map((m) => m.s).sort();

  it('lugar estabelecido pela narração, não citado', () => {
    expect(establishedLocale(narration('Entrei na sala e sentei-me.'))).toBe('interior');
    expect(establishedLocale(narration('Ao meio-dia cheguei à praia.'))).toBe('mar');
    expect(establishedLocale(narration('Pensou na praia de sua infância.'))).toBeUndefined();
  });

  it('a cena persiste: fala sobre o mar e metáfora não mudam o som; a lareira continua', () => {
    expect(plan(1).scene).toBe(plan(4).scene);
    expect(layers(2)).toEqual(['fire', 'rain']);
    expect(layers(4)).toEqual(['fire', 'rain']);
    // chuva lá fora chega abafada dentro de casa
    expect(plan(1).mix!.find((m) => m.s === 'rain')!.lowpass).toBe(900);
  });

  it('salto de tempo e mudança de lugar abrem cenas novas', () => {
    expect(plan(5).scene).not.toBe(plan(4).scene);
    expect(layers(5)).toEqual(['city']);
    expect(plan(7).scene).not.toBe(plan(5).scene);
    expect(layers(8)).toEqual(['sea', 'wind']);
  });

  it('abertura de capítulo e época do livro', () => {
    expect(plan(0).chapterStart).toBe(true);
    expect(plan(9).chapterStart).toBe(true);
    expect(plan(5).looks?.city?.detail).toMatch(/horse carriages no cars/);
    expect(plan(5).looks?.crowd?.detail).toMatch(/no words/);
  });

  it('tensão pelo ritmo do texto (sem drone por palavra)', () => {
    expect(tensionOf('Era uma tarde tranquila de domingo, e a família conversava calmamente na varanda depois do almoço.', 'era uma tarde tranquila')).toBeLessThan(0.2);
    expect(map.tension[10]).toBeGreaterThan(map.tension[8]);
    expect(plan(10).night).toBe(false);
  });

  it('o ambiente da cena sai do estado: quarto em noite de tempestade', () => {
    const mix = bedFor({ locale: 'interior', time: 'noite', weather: 'tempestade', fire: false });
    expect(mix.map((m) => m.s).sort()).toEqual(['rain', 'thunder']);
    expect(mix.every((m) => (m.lowpass ?? 99999) <= 900)).toBe(true);
    expect(bedFor({ locale: 'natureza', time: 'noite', fire: false }).map((m) => m.s)).toContain('cricket');
    expect(bedFor({ locale: 'natureza', time: 'dia', fire: false }).map((m) => m.s)).toContain('birds');
  });
});
