import { configureAudioSession, createAudioContext } from './context';
import { localSounds } from '../services/localSounds';
import { offlineAware, offlineStore } from '../services/offline';
import { activeLibrary } from '../services/sounds';
import { starterPack, withFallback } from '../services/starterPack';
import { supabase } from '../services/supabase';
import { AmbientEngine } from './engine';

/** Fontes de som em ordem: repositório (servidor ou aparelho) → pacote inicial publicado com o app. */
export const soundSource = withFallback(activeLibrary, starterPack);

/** Um único motor de som para o app inteiro. */
export const engine = new AmbientEngine(createAudioContext);

let ready = false;
export function bootAudio(): void {
  if (ready) return;
  ready = true;
  configureAudioSession();
  // repositório que também funciona sem internet (capítulos baixados) + arquivos guardados
  // ordem: repositório (servidor ou aparelho) → pacote inicial publicado com o app; tudo também offline
  engine.setLibrary(offlineAware(soundSource));
  engine.setOfflineStore(offlineStore);
  // sem servidor, o repositório é o do aparelho: quando um som novo fica pronto, já entra na cena
  if (!supabase) localSounds.subscribe(() => engine.retryMissing());
}
