/**
 * Repositório de sons no próprio aparelho — a mesma lógica do servidor
 * (sound-resolve), para quando o Supabase não está configurado (ex.: a
 * preview web): reaproveita o som mais parecido já guardado; se nada serve e
 * há chave da ElevenLabs no aparelho, gera em segundo plano e guarda para as
 * próximas vezes. O Laboratório de som e o leitor usam o mesmo repositório.
 *
 * A chave fica só neste aparelho. No app publicado, use o servidor: lá a
 * chave fica em segredo no Supabase.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bestMatch, descKey, generationRequest, type LibrarySound, type SoundDesc } from '../../supabase/functions/_shared/sound-library';
import { blobUrl, deleteBlob, putBlob } from './blobStore';

const INDEX_KEY = 'imersao.sounds.index';
const API_KEY = 'imersao.lab.elevenlabs';
const DAILY_LIMIT = 30;          // gerações por dia neste aparelho
const FAIL_COOLDOWN_MS = 30 * 60_000;
const MODEL = 'eleven_text_to_sound_v2';

export interface LocalSound extends LibrarySound { uses: number; createdAt: number }

export class GenerationError extends Error {}

/** Pede o som à ElevenLabs e devolve os bytes (MP3). */
export async function generateSound(apiKey: string, d: SoundDesc): Promise<Uint8Array> {
  const req = generationRequest(d);
  let r: Response;
  try {
    r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey.trim(), 'content-type': 'application/json' },
      body: JSON.stringify({ text: req.text, duration_seconds: req.seconds, prompt_influence: 0.4, loop: req.loop, model_id: MODEL }),
    });
  } catch {
    throw new GenerationError('Não consegui falar com a ElevenLabs (rede ou bloqueio do navegador).');
  }
  if (!r.ok) {
    const body = (await r.text().catch(() => '')).slice(0, 200);
    throw new GenerationError(r.status === 401 ? 'Chave da ElevenLabs recusada (401). Confira a chave.' : `ElevenLabs respondeu ${r.status}: ${body}`);
  }
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length < 2000) throw new GenerationError('A ElevenLabs devolveu um arquivo vazio.');
  return bytes;
}

class LocalSoundLibrary {
  private index: LocalSound[] | null = null;
  private apiKey: string | null = null;
  private loaded: Promise<void> | null = null;
  private generating = new Map<string, Promise<LocalSound>>();
  private failedAt = new Map<string, number>();
  private listeners = new Set<() => void>();

  private load(): Promise<void> {
    if (!this.loaded) {
      this.loaded = (async () => {
        try {
          const [idx, key] = await Promise.all([AsyncStorage.getItem(INDEX_KEY), AsyncStorage.getItem(API_KEY)]);
          this.index = idx ? (JSON.parse(idx) as LocalSound[]) : [];
          this.apiKey = key;
        } catch {
          this.index = [];
        }
      })();
    }
    return this.loaded;
  }

  private async save(): Promise<void> {
    try { await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(this.index ?? [])); } catch { /* sem armazenamento: segue em memória */ }
    this.listeners.forEach((f) => f());
  }

  /** Avisa quando o repositório muda (o laboratório atualiza a lista). */
  subscribe(f: () => void): () => void {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }

  async getKey(): Promise<string> {
    await this.load();
    return this.apiKey ?? '';
  }

  async setKey(k: string): Promise<void> {
    await this.load();
    this.apiKey = k.trim() || null;
    try {
      if (this.apiKey) await AsyncStorage.setItem(API_KEY, this.apiKey);
      else await AsyncStorage.removeItem(API_KEY);
    } catch { /* */ }
    this.failedAt.clear();
  }

  async list(): Promise<LocalSound[]> {
    await this.load();
    return [...(this.index ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  }

  async urlOf(id: string): Promise<string | null> {
    return blobUrl(id);
  }

  private generatedToday(): number {
    const since = Date.now() - 24 * 3600_000;
    return (this.index ?? []).filter((s) => s.createdAt > since).length;
  }

  private async match(d: SoundDesc): Promise<{ sound: LocalSound; score: number; url: string } | null> {
    await this.load();
    let pool = this.index ?? [];
    // um arquivo pode ter sumido (limpeza do navegador): tira do índice e tenta o próximo
    for (let tries = 0; tries < 3; tries++) {
      const m = bestMatch(d, pool);
      if (!m) return null;
      const url = await blobUrl(m.sound.id);
      if (url) return { ...m, url };
      pool = pool.filter((s) => s.id !== m.sound.id);
      this.index = (this.index ?? []).filter((s) => s.id !== m.sound.id);
      void this.save();
    }
    return null;
  }

  private bumpUse(id: string): void {
    const s = this.index?.find((x) => x.id === id);
    if (s) { s.uses++; void this.save(); }
  }

  /** Gera (uma vez por chave, mesmo com pedidos simultâneos) e guarda. */
  private generate(d: SoundDesc): Promise<LocalSound> {
    const key = descKey(d) + '|' + (d.detail ?? '');
    const running = this.generating.get(key);
    if (running) return running;
    const job = (async () => {
      if (!this.apiKey) throw new GenerationError('Sem chave da ElevenLabs neste aparelho.');
      if (this.generatedToday() >= DAILY_LIMIT) throw new GenerationError(`Limite de ${DAILY_LIMIT} sons gerados por dia neste aparelho.`);
      try {
        const bytes = await generateSound(this.apiKey, d);
        const id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        await putBlob(id, bytes);
        const s: LocalSound = { ...d, id, key: descKey(d), path: '', uses: 1, createdAt: Date.now() };
        this.index = [...(this.index ?? []), s];
        await this.save();
        return s;
      } catch (e) {
        this.failedAt.set(key, Date.now());
        throw e;
      }
    })();
    this.generating.set(key, job);
    void job.catch(() => undefined).finally(() => this.generating.delete(key));
    return job;
  }

  /**
   * Para o leitor: arquivo do som mais parecido, ou null (toca a síntese).
   * Se nada serve e há chave, começa a gerar em segundo plano.
   */
  async resolve(d: SoundDesc): Promise<{ id: string; url: string } | null> {
    const m = await this.match(d);
    if (m) { this.bumpUse(m.sound.id); return { id: m.sound.id, url: m.url }; }
    const key = descKey(d) + '|' + (d.detail ?? '');
    if (this.apiKey && Date.now() - (this.failedAt.get(key) ?? 0) > FAIL_COOLDOWN_MS) {
      void this.generate(d).catch(() => undefined);
    }
    return null;
  }

  /** Para o laboratório: reaproveita ou espera a geração terminar. */
  async findOrGenerate(d: SoundDesc): Promise<{ sound: LocalSound; url: string; reused: boolean; score: number }> {
    const m = await this.match(d);
    if (m) { this.bumpUse(m.sound.id); return { sound: m.sound, url: m.url, reused: true, score: m.score }; }
    const s = await this.generate(d);
    const url = await blobUrl(s.id);
    if (!url) throw new GenerationError('Não consegui guardar o som gerado.');
    return { sound: s, url, reused: false, score: 1 };
  }

  /** "Som ruim" no aparelho: apaga o som; o próximo pedido gera outro. */
  async report(id: string): Promise<void> {
    await this.load();
    this.index = (this.index ?? []).filter((s) => s.id !== id);
    await deleteBlob(id);
    await this.save();
  }
}

export const localSounds = new LocalSoundLibrary();
