/**
 * Chamadas à IA pelo backend. O app nunca fala direto com a API da
 * Anthropic: a chave fica no servidor, que também guarda as respostas para
 * reaproveitar entre leitores do mesmo livro.
 */
import { sanitizePlan } from '../core/plan';
import type { Ambience, GlossaryEntry, ScenePlan } from '../core/types';
import { ensureSession, supabase } from './supabase';

export const aiAvailable = () => !!supabase;

export class AiError extends Error {
  constructor(public code: 'offline' | 'limit' | 'failed', msg: string) { super(msg); }
}

async function invoke<T>(fn: string, body: unknown): Promise<T> {
  if (!supabase) throw new AiError('offline', 'IA não configurada.');
  await ensureSession();
  const { data, error } = await supabase.functions.invoke(fn, { body: body as Record<string, unknown> });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    throw new AiError(status === 429 ? 'limit' : 'failed', error.message);
  }
  return data as T;
}

/**
 * Planos de som para um lote de páginas consecutivas.
 * `cacheOnly`: livros públicos — só planos já pré-calculados no servidor, sem chamar a IA.
 */
export async function fetchScenePlans(title: string, pages: string[], prev: Ambience | null, cacheOnly = false): Promise<(ScenePlan | null)[]> {
  const r = await invoke<{ plans: unknown[] }>('sound-plan', { title, pages, prev, cacheOnly });
  const plans = Array.isArray(r?.plans) ? r.plans : [];
  return pages.map((_, i) => sanitizePlan(plans[i]));
}

/** Entradas de glossário a partir do que já foi lido (sem spoilers). */
export async function fetchGlossary(title: string, text: string, known: string[]): Promise<GlossaryEntry[]> {
  const r = await invoke<{ entries: unknown[] }>('glossary', { title, text, known });
  return (Array.isArray(r?.entries) ? r.entries : [])
    .filter((x): x is GlossaryEntry => !!x && typeof (x as GlossaryEntry).term === 'string')
    .slice(0, 12);
}

/**
 * X-Ray: explica um termo/personagem só com o que já foi lido (sem spoiler).
 * `cacheOnly` para livros públicos: só respostas já pré-calculadas.
 */
export async function explainTerm(title: string, term: string, textSoFar: string, cacheOnly = false): Promise<string> {
  const r = await invoke<{ entries: unknown[] }>('glossary', { title, text: textSoFar, known: [], focus: term, cacheOnly });
  const e = (Array.isArray(r?.entries) ? r.entries : []).find((x): x is GlossaryEntry => !!x && typeof (x as GlossaryEntry).desc === 'string');
  return e?.desc?.trim() ?? '';
}

/** "O que aconteceu até aqui?" — 2 frases sobre as páginas antes do ponto de parada. */
export async function fetchRecap(title: string, text: string, cacheOnly = false): Promise<string> {
  const r = await invoke<{ summary?: string }>('recap', { title, text, cacheOnly });
  return typeof r?.summary === 'string' ? r.summary.trim() : '';
}

/**
 * Extrai o texto de um PDF no servidor (devolve as linhas de cada página).
 * O arquivo sobe para uma pasta privada do leitor; o servidor lê e apaga.
 */
export async function extractPdf(bytes: Uint8Array): Promise<{ title: string; pages: string[][] }> {
  if (!supabase) throw new AiError('offline', 'Para abrir PDF é preciso configurar o servidor.');
  const uid = await ensureSession();
  if (!uid) throw new AiError('offline', 'Sem conexão com o servidor.');
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const up = await supabase.storage.from('imports').upload(path, body, { contentType: 'application/pdf' });
  if (up.error) throw new AiError('failed', 'Não foi possível enviar o PDF. Verifique a conexão.');
  const { data, error } = await supabase.functions.invoke('extract-pdf', { body: { path } });
  if (error) {
    let msg = 'Não foi possível ler o PDF.';
    try { msg = ((await (error as { context?: Response }).context?.json()) as { error?: string })?.error ?? msg; } catch { /* corpo sem JSON */ }
    throw new AiError('failed', msg);
  }
  const d = data as { title?: string; pages?: string[][]; error?: string };
  if (d.error) throw new AiError('failed', d.error);
  return { title: d.title ?? '', pages: Array.isArray(d.pages) ? d.pages : [] };
}
