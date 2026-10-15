/** Versão para navegador (expo start --web): usa o AudioContext nativo. */
import type { CtxLike } from './engine';

export function createAudioContext(): CtxLike {
  const C = (globalThis as unknown as { AudioContext: new () => CtxLike; webkitAudioContext?: new () => CtxLike });
  return new (C.AudioContext ?? C.webkitAudioContext!)();
}

export function configureAudioSession(): void {}
