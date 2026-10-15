/**
 * Leitura offline (offline-first): baixa o pacote completo de um capítulo
 * para o aparelho — o texto (já fica no SQLite local), os planos de som de
 * cada página (tabela `plans`) e os arquivos de áudio dos stems e efeitos
 * (blobStore: IndexedDB no navegador, pasta do app no celular). Depois disso
 * o capítulo toca igual sem internet.
 *
 * Também guarda um índice "descrição do som → arquivo", porque sem internet
 * o repositório do servidor não responde qual arquivo usar.
 */
import type { SoundDesc } from '../../supabase/functions/_shared/sound-library';
import { descKey } from '../../supabase/functions/_shared/sound-library';
import type { OfflineStore, SoundSource } from '../audio/engine';
import { analyze } from '../core/analyze';
import type { Chapter } from '../core/chapters';
import { bookProfile, enrichPlan } from '../core/scenery';
import { planDescs, spotDesc } from '../core/sound';
import { contentId } from '../core/text';
import type { ScenePlan } from '../core/types';
import { bundledPlans, isPublicBook } from '../data/books';
import { getRepo } from '../state/db';
import { aiAvailable, fetchScenePlans } from './ai';
import { getBlob, putBlob } from './blobStore';

const INDEX_KEY = 'offline:index';
const BATCH = 8;

/** Nome do arquivo guardado para um endereço de som. */
const blobId = (url: string) => 'o' + contentId([url]);
const keyOf = (d: SoundDesc) => descKey(d) + '|' + (d.detail ?? '');

let index: Record<string, { id: string; url: string }> | null = null;
async function loadIndex() {
  if (index) return index;
  try { index = JSON.parse((await (await getRepo()).kvGet(INDEX_KEY)) ?? '{}'); } catch { index = {}; }
  return index!;
}
async function saveIndex() {
  await (await getRepo()).kvSet(INDEX_KEY, JSON.stringify(index ?? {}));
}

/** Arquivos baixados: o motor de som consulta aqui antes da rede. */
export const offlineStore: OfflineStore = {
  async get(url) {
    const b = await getBlob(blobId(url));
    return b ? (b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer) : null;
  },
};

/**
 * Repositório que funciona sem internet: pergunta ao repositório normal e,
 * se ele não responder (offline) ou demorar, usa o índice dos sons baixados.
 */
export function offlineAware(lib: SoundSource): SoundSource {
  return {
    async resolve(d) {
      const live = await Promise.race([
        lib.resolve(d).catch(() => null),
        new Promise<null>((r) => setTimeout(() => r(null), 1500)),
      ]);
      if (live) return live;
      return (await loadIndex())[keyOf(d)] ?? null;
    },
  };
}

export interface OfflineReport { pages: number; plans: number; sounds: number; missing: number }

/**
 * Baixa o capítulo: planos (do livro, do aparelho ou do servidor) e todos
 * os sons que ele usa. `progress` vai de 0 a 1.
 */
export async function downloadChapter(
  bookId: string, title: string, pages: string[], ch: Chapter, lib: SoundSource, progress: (p: number, msg: string) => void,
): Promise<OfflineReport> {
  const repo = await getRepo();
  const range = pages.slice(ch.start, ch.end);
  const bundled = bundledPlans(bookId);
  progress(0, 'Preparando os planos de som…');

  // 1) planos de som de cada página (guardados na tabela `plans`)
  const plans: (ScenePlan | null)[] = await Promise.all(range.map((_, k) => repo.getPlan(bookId, ch.start + k)));
  let fetched = 0;
  if (!bundled && aiAvailable()) {
    for (let from = 0; from < range.length; from += BATCH) {
      if (plans.slice(from, from + BATCH).every(Boolean)) continue;
      try {
        const got = await fetchScenePlans(title, range.slice(from, from + BATCH), null, isPublicBook(bookId));
        await repo.savePlans(bookId, ch.start + from, got);
        got.forEach((p, k) => { if (p) { plans[from + k] = p; fetched++; } });
      } catch { /* sem IA agora: fica com as palavras-chave, que funcionam offline */ }
      progress(0.3 * Math.min(1, (from + BATCH) / range.length), 'Preparando os planos de som…');
    }
  }

  // 2) sons que o capítulo usa (mesma descrição que o leitor vai pedir)
  const profile = bookProfile(pages, analyze, title);
  const descs = new Map<string, SoundDesc>();
  range.forEach((text, k) => {
    const base = bundled?.[ch.start + k] ?? plans[k] ?? analyze(text);
    const rich = enrichPlan(base, text, profile);
    [...planDescs(rich), ...rich.details.map((d) => spotDesc({ s: d.s, at: 0, w: d.w, v: d.v }))].forEach((d) => descs.set(keyOf(d), d));
  });

  const idx = await loadIndex();
  let sounds = 0, missing = 0, done = 0;
  for (const [key, d] of descs) {
    done++;
    progress(0.3 + 0.7 * (done / descs.size), `Baixando sons (${done}/${descs.size})…`);
    const hit = await lib.resolve(d).catch(() => null);
    if (!hit) { missing++; continue; }
    try {
      if (!(await getBlob(blobId(hit.url)))) {
        const r = await fetch(hit.url);
        if (!r.ok) { missing++; continue; }
        await putBlob(blobId(hit.url), new Uint8Array(await r.arrayBuffer()));
      }
      idx[key] = hit;
      sounds++;
    } catch {
      missing++;
    }
  }
  await saveIndex();
  const report: OfflineReport = { pages: range.length, plans: plans.filter(Boolean).length + (bundled ? range.length : 0), sounds, missing };
  await repo.kvSet(`offline:${bookId}:${ch.start}`, JSON.stringify({ at: Date.now(), ...report }));
  progress(1, missing ? `Pronto — ${sounds} sons guardados (${missing} ainda não existem)` : `Pronto — ${sounds} sons guardados`);
  void fetched;
  return report;
}

/** Quando o capítulo foi baixado (ou null). */
export async function chapterOfflineInfo(bookId: string, start: number): Promise<(OfflineReport & { at: number }) | null> {
  try {
    const s = await (await getRepo()).kvGet(`offline:${bookId}:${start}`);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
