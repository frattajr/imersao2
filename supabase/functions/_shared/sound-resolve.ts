/**
 * Decide, para cada descrição, entre reaproveitar um som do repositório ou
 * gerar um novo. Sem acesso direto a banco ou rede: tudo entra pelo `Store`
 * e pelo `Generator`, para dar para testar sem Supabase.
 */
import { bestMatch, descKey, generationRequest, type LibrarySound, type SoundDesc } from './sound-library.ts';

export interface Store {
  /** Sons prontos com a mesma categoria e nome. */
  candidates(cat: string, name: string): Promise<LibrarySound[]>;
  /** Reserva a geração desta chave; null se outra requisição já está gerando. */
  claim(d: SoundDesc, key: string): Promise<string | null>;
  finish(id: string, path: string, bytes: number): Promise<void>;
  fail(id: string): Promise<void>;
  bumpUses(ids: string[]): Promise<void>;
  upload(path: string, data: Uint8Array): Promise<boolean>;
  publicUrl(path: string): string;
  /** Limite diário de gerações (para todo o app, não por leitor). */
  withinGenLimit(): Promise<boolean>;
}

export interface GenRequest { text: string; seconds: number; loop: boolean }
export type Generator = (r: GenRequest) => Promise<Uint8Array | null>;

export type Resolved =
  | { status: 'hit'; id: string; url: string; score: number }
  | { status: 'pending' }
  | { status: 'none' };

/** Confere o mínimo do arquivo gerado: tamanho plausível e cabeçalho de MP3. */
export function looksLikeMp3(b: Uint8Array): boolean {
  if (b.length < 4000 || b.length > 8_000_000) return false;
  const id3 = b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33;
  const sync = b[0] === 0xff && (b[1] & 0xe0) === 0xe0;
  return id3 || sync;
}

async function generate(d: SoundDesc, id: string, store: Store, gen: Generator): Promise<void> {
  try {
    const audio = await gen(generationRequest(d));
    if (!audio || !looksLikeMp3(audio)) return await store.fail(id);
    const path = `lib/${d.cat}/${d.name}/${id}.mp3`;
    if (!(await store.upload(path, audio))) return await store.fail(id);
    await store.finish(id, path, audio.length);
  } catch {
    await store.fail(id);
  }
}

/**
 * @param defer roda a geração depois de responder (EdgeRuntime.waitUntil):
 *   o leitor não espera; o som novo fica pronto para a próxima vez.
 */
export async function resolveDescs(
  descs: SoundDesc[], store: Store, gen: Generator | null, defer: (p: Promise<unknown>) => void,
): Promise<Resolved[]> {
  const byName = new Map<string, Promise<LibrarySound[]>>();
  const used: string[] = [];
  const out: Resolved[] = [];
  for (const d of descs) {
    const k = d.cat + ':' + d.name;
    if (!byName.has(k)) byName.set(k, store.candidates(d.cat, d.name));
    const m = bestMatch(d, await byName.get(k)!);
    if (m) {
      used.push(m.sound.id);
      out.push({ status: 'hit', id: m.sound.id, url: store.publicUrl(m.sound.path), score: m.score });
      continue;
    }
    if (!gen) { out.push({ status: 'none' }); continue; }
    if (!(await store.withinGenLimit())) { out.push({ status: 'none' }); continue; }
    const id = await store.claim(d, descKey(d));
    if (!id) { out.push({ status: 'pending' }); continue; } // já está sendo gerado (ou falhou há pouco)
    defer(generate(d, id, store, gen));
    out.push({ status: 'pending' });
  }
  if (used.length) defer(store.bumpUses(used));
  return out;
}
