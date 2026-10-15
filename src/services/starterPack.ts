/**
 * Pacote inicial de stems publicado junto com o app (scripts/build-stems.ts):
 * sons já gerados pela ElevenLabs para os stems genéricos e para as obras
 * iniciais. É a última fonte consultada — garante som na primeira
 * experiência sem chave de API nem servidor.
 */
import { Platform } from 'react-native';
import { bestMatch, type SoundDesc } from '../../supabase/functions/_shared/sound-library';
import type { SoundSource } from '../audio/engine';

const DEFAULT_STEMS = 'https://frattajr.github.io/imersao2/stems';

export function stemsBase(): string {
  const env = process.env.EXPO_PUBLIC_STEMS_URL;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/stems`;
  }
  return DEFAULT_STEMS;
}

type Entry = SoundDesc & { file: string };
let manifest: Promise<Entry[]> | null = null;

function load(): Promise<Entry[]> {
  if (!manifest) {
    manifest = fetch(`${stemsBase()}/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ sounds?: Entry[] }>) : { sounds: [] }))
      .then((m) => (Array.isArray(m.sounds) ? m.sounds : []))
      .catch(() => []);
    void manifest.then((s) => { if (!s.length) manifest = null; }); // tenta de novo depois
  }
  return manifest;
}

export const starterPack: SoundSource = {
  async resolve(d) {
    const m = bestMatch(d, await load());
    return m ? { id: 'starter:' + m.sound.file, url: `${stemsBase()}/${m.sound.file}` } : null;
  },
};

/** Primeiro o repositório principal; se ele não tiver o som, o pacote inicial. */
export function withFallback(primary: SoundSource, fallback: SoundSource): SoundSource {
  return {
    async resolve(d) {
      return (await primary.resolve(d).catch(() => null)) ?? fallback.resolve(d);
    },
  };
}
