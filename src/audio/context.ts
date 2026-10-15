/**
 * Contexto de áudio nativo (iOS/Android) via react-native-audio-api, que
 * implementa a API Web Audio no celular e continua tocando com a tela
 * bloqueada (modo de áudio em segundo plano configurado no app.json).
 */
import { AudioContext, AudioManager } from 'react-native-audio-api';
import type { CtxLike } from './engine';

export function createAudioContext(): CtxLike {
  return new AudioContext() as unknown as CtxLike;
}

/**
 * Sessão de áudio: categoria "playback" (toca com a chave de silêncio
 * ligada e em segundo plano) e mistura com outros apps, para não cortar a
 * música que a pessoa já esteja ouvindo.
 */
export function configureAudioSession(): void {
  try {
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: ['mixWithOthers'],
    });
  } catch {
    // versões diferentes da biblioteca podem nomear essas opções de outro jeito; o app segue sem elas
  }
}
