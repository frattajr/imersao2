import { configureAudioSession, createAudioContext } from './context';
import { AmbientEngine } from './engine';

/** Um único motor de som para o app inteiro. */
export const engine = new AmbientEngine(createAudioContext);

let ready = false;
export function bootAudio(packUrl?: string): void {
  if (ready) return;
  ready = true;
  configureAudioSession();
  void engine.loadPack(packUrl);
}
