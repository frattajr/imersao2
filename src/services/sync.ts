/**
 * Sincronização com a nuvem (Supabase), local primeiro: o app sempre lê e
 * grava no SQLite do aparelho; a nuvem recebe as mudanças em segundo plano
 * e devolve o que veio de outros aparelhos. Em conflito, vale a versão
 * alterada por último.
 */
import type { BookKind, GlossaryEntry } from '../core/types';
import { getRepo } from '../state/db';
import { ensureSession, supabase } from './supabase';

interface RemoteRow {
  book_id: string; title: string; kind: BookKind; sub: string; emoji: string; n: number;
  idx: number; done: boolean; gloss: GlossaryEntry[]; updated_at: string;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Avisa quando chegou algo novo da nuvem (a biblioteca se atualiza). */
export function onSynced(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Agenda uma sincronização (agrupa várias mudanças seguidas). */
export function syncSoon(delay = 4000): void {
  if (!supabase) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

export function syncNow(): Promise<void> {
  if (!supabase) return Promise.resolve();
  if (!running) running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync(): Promise<void> {
  const uid = await ensureSession();
  if (!uid || !supabase) return;
  const repo = await getRepo();
  let changed = false;

  // 1. envia o que mudou aqui
  for (const b of await repo.dirtyBooks()) {
    if (b.kind !== 'builtin' && (await repo.hasText(b.id))) {
      const path = `${uid}/${b.id}.json`;
      const pages = await repo.getPages(b.id);
      const flag = `uploaded:${b.id}`;
      if (pages && !(await repo.kvGet(flag))) {
        const { error } = await supabase.storage.from('books').upload(path, JSON.stringify(pages), { contentType: 'application/json', upsert: true });
        if (!error) await repo.kvSet(flag, '1');
      }
    }
    const { error } = await supabase.from('library').upsert({
      owner: uid, book_id: b.id, title: b.title, kind: b.kind, sub: b.sub, emoji: b.emoji, n: b.n,
      idx: b.idx, done: b.done, gloss: b.gloss, updated_at: new Date(b.updatedAt).toISOString(),
    }, { onConflict: 'owner,book_id' });
    if (!error) await repo.markSynced(b.id, b.updatedAt);
  }

  // 2. recebe o que mudou em outros aparelhos
  const since = Number((await repo.kvGet('pulled_at')) ?? 0);
  const { data, error } = await supabase
    .from('library').select('*').gt('updated_at', new Date(since).toISOString()).order('updated_at');
  if (error || !data) return;
  let newest = since;
  for (const r of data as RemoteRow[]) {
    const at = Date.parse(r.updated_at);
    newest = Math.max(newest, at);
    const res = await repo.mergeRemote({
      id: r.book_id, title: r.title, kind: r.kind === 'builtin' ? 'builtin' : r.kind, sub: r.sub, emoji: r.emoji,
      n: r.n, idx: r.idx, done: r.done, gloss: Array.isArray(r.gloss) ? r.gloss : [], updatedAt: at,
    });
    if (res !== 'kept') changed = true;
  }
  await repo.kvSet('pulled_at', String(newest));
  if (changed) listeners.forEach((f) => f());
}

/** Baixa o texto de um livro que veio de outro aparelho. */
export async function downloadText(bookId: string): Promise<string[] | null> {
  const uid = await ensureSession();
  if (!uid || !supabase) return null;
  const { data, error } = await supabase.storage.from('books').download(`${uid}/${bookId}.json`);
  if (error || !data) return null;
  try {
    const pages = JSON.parse(await data.text()) as string[];
    const repo = await getRepo();
    await repo.putText(bookId, pages);
    await repo.kvSet(`uploaded:${bookId}`, '1');
    return pages;
  } catch {
    return null;
  }
}

/** Apaga o livro também na nuvem. */
export async function deleteRemote(bookId: string): Promise<void> {
  const uid = await ensureSession();
  if (!uid || !supabase) return;
  await supabase.from('library').delete().eq('owner', uid).eq('book_id', bookId);
  await supabase.storage.from('books').remove([`${uid}/${bookId}.json`]);
}
