/**
 * Prévia sonora na ficha do livro: toca baixinho, por ~12 s, o clima que
 * domina a obra (as mesmas camadas de ambiente do leitor). Devolve a função
 * que para a prévia (ao fechar a ficha ou abrir o livro).
 */
import type { Layer, MixStem, StemPriority } from '../core/types';
import { engine } from './index';

const GAINS = [0.5, 0.32, 0.22];

export function previewClimate(layers: Layer[], seconds = 12): () => void {
  engine.start();
  engine.setDetails([]);
  engine.clearSpots();
  const mix: MixStem[] = layers.slice(0, 3).map((s, i) => ({ s, gain: GAINS[i], priority: (i + 1) as StemPriority }));
  engine.setMix(mix, undefined, { entrance: 2.5 });
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    clearTimeout(t);
    engine.setMix([]);
  };
  const t = setTimeout(stop, seconds * 1000);
  return stop;
}

/** Algum som da prévia está tocando de fato (o arquivo existe no repositório)? */
export const previewHasSound = () => engine.libraryIdsPlaying().length > 0;
