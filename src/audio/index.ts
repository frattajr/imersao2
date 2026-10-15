import { configureAudioSession, createAudioContext } from './context';
import { localSounds } from '../services/localSounds';
import { activeLibrary } from '../services/sounds';
import { supabase } from '../services/supabase';
import { AmbientEngine } from './engine';

/** Um único motor de som para o app inteiro. */
export const engine = new AmbientEngine(createAudioContext);

let ready = false;
export function bootAudio(): void {
  if (ready) return;
  ready = true;
  configureAudioSession();
  engine.setLibrary(activeLibrary);
  // sem servidor, o repositório é o do aparelho: quando um som novo fica pronto, já entra na cena
  if (!supabase) localSounds.subscribe(() => engine.retryMissing());
}
