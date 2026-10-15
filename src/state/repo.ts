/**
 * Biblioteca local (SQLite). Guarda livros, texto, progresso, glossário e
 * os planos de som já recebidos da IA, para funcionar offline e não pagar
 * duas vezes pela mesma análise.
 *
 * A interface `SqlDb` é o subconjunto do expo-sqlite que usamos — nos
 * testes ela é implementada com outro SQLite.
 */
import type { Annotation } from '../core/annotations';
import type { BookKind, BookMeta, GlossaryEntry, ScenePlan } from '../core/types';
import { SAMPLE_BOOKS } from '../data/books';

export interface SqlDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, params?: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: (string | number | null)[]): Promise<T[]>;
  /** opcional: agrupa várias escritas numa transação (expo-sqlite nativo e a versão web têm) */
  withTransactionAsync?(task: () => Promise<void>): Promise<void>;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  sub TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '📚',
  n INTEGER NOT NULL DEFAULT 0,
  idx INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  gloss TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS texts (
  id TEXT PRIMARY KEY NOT NULL,
  pages TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  book_id TEXT NOT NULL,
  page INTEGER NOT NULL,
  plan TEXT NOT NULL,
  PRIMARY KEY (book_id, page)
);
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY NOT NULL,
  v TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  page INTEGER NOT NULL,
  start_at INTEGER NOT NULL DEFAULT 0,
  end_at INTEGER NOT NULL DEFAULT 0,
  quote TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS annotations_book ON annotations (book_id, page);
`;

interface BookRow {
  id: string; title: string; kind: string; sub: string; emoji: string; n: number; idx: number;
  done: number; gloss: string; updated_at: number; synced_at: number;
}

const toMeta = (r: BookRow): BookMeta => ({
  id: r.id, title: r.title, kind: r.kind as BookKind, sub: r.sub, emoji: r.emoji, n: r.n,
  idx: r.idx, done: !!r.done, updatedAt: r.updated_at,
});

const parseJson = <T,>(s: string | null | undefined, d: T): T => {
  try { return s ? (JSON.parse(s) as T) : d; } catch { return d; }
};

export class Repo {
  constructor(private db: SqlDb, private now: () => number = Date.now) {}

  async init(): Promise<void> {
    await this.db.execAsync(SCHEMA);
  }

  async listBooks(): Promise<BookMeta[]> {
    const rows = await this.db.getAllAsync<BookRow>('SELECT * FROM books ORDER BY updated_at DESC');
    return rows.map(toMeta);
  }

  async getBook(id: string): Promise<BookMeta | null> {
    const r = await this.db.getFirstAsync<BookRow>('SELECT * FROM books WHERE id = ?', [id]);
    return r ? toMeta(r) : null;
  }

  /** Cria o livro se não existir (o progresso existente é preservado). */
  async addBook(b: { id: string; title: string; kind: BookKind; sub: string; emoji: string }, pages?: string[], gloss?: GlossaryEntry[]): Promise<BookMeta> {
    const n = pages ? pages.length : SAMPLE_BOOKS.find((x) => x.id === b.id)?.pages.length ?? 0;
    await this.db.runAsync(
      `INSERT INTO books (id, title, kind, sub, emoji, n, gloss, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at`,
      [b.id, b.title, b.kind, b.sub, b.emoji, n, JSON.stringify(gloss ?? []), this.now()],
    );
    if (pages && b.kind !== 'builtin') {
      await this.db.runAsync('INSERT OR IGNORE INTO texts (id, pages) VALUES (?, ?)', [b.id, JSON.stringify(pages)]);
    }
    return (await this.getBook(b.id))!;
  }

  async getPages(id: string): Promise<string[] | null> {
    const sample = SAMPLE_BOOKS.find((x) => x.id === id);
    if (sample) return sample.pages;
    const r = await this.db.getFirstAsync<{ pages: string }>('SELECT pages FROM texts WHERE id = ?', [id]);
    return r ? parseJson<string[] | null>(r.pages, null) : null;
  }

  async hasText(id: string): Promise<boolean> {
    return !!(await this.db.getFirstAsync<{ id: string }>('SELECT id FROM texts WHERE id = ?', [id]));
  }

  async saveProgress(id: string, idx: number, done: boolean): Promise<void> {
    await this.db.runAsync('UPDATE books SET idx = ?, done = ?, updated_at = ? WHERE id = ?', [idx, done ? 1 : 0, this.now(), id]);
  }

  async getGloss(id: string): Promise<GlossaryEntry[]> {
    const r = await this.db.getFirstAsync<{ gloss: string }>('SELECT gloss FROM books WHERE id = ?', [id]);
    return parseJson<GlossaryEntry[]>(r?.gloss, []);
  }

  async setGloss(id: string, gloss: GlossaryEntry[]): Promise<void> {
    await this.db.runAsync('UPDATE books SET gloss = ?, updated_at = ? WHERE id = ?', [JSON.stringify(gloss), this.now(), id]);
  }

  async deleteBook(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM books WHERE id = ?', [id]);
    await this.db.runAsync('DELETE FROM texts WHERE id = ?', [id]);
    await this.db.runAsync('DELETE FROM plans WHERE book_id = ?', [id]);
    await this.db.runAsync('DELETE FROM annotations WHERE book_id = ?', [id]);
  }

  /* ---------- marcadores, grifos e notas ---------- */

  async listAnnotations(bookId: string): Promise<Annotation[]> {
    const rows = await this.db.getAllAsync<{
      id: string; book_id: string; kind: string; page: number; start_at: number; end_at: number; quote: string; note: string; color: string; created_at: number;
    }>('SELECT * FROM annotations WHERE book_id = ? ORDER BY page, start_at', [bookId]);
    return rows.map((r) => ({
      id: r.id, bookId: r.book_id, kind: r.kind as Annotation['kind'], page: r.page, start: r.start_at, end: r.end_at,
      quote: r.quote, note: r.note, color: r.color as Annotation['color'], createdAt: r.created_at,
    }));
  }

  async saveAnnotation(a: Annotation): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO annotations (id, book_id, kind, page, start_at, end_at, quote, note, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [a.id, a.bookId, a.kind, a.page, a.start, a.end, a.quote, a.note, a.color ?? '', a.createdAt],
    );
  }

  async deleteAnnotation(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM annotations WHERE id = ?', [id]);
  }

  async getPlan(bookId: string, page: number): Promise<ScenePlan | null> {
    const r = await this.db.getFirstAsync<{ plan: string }>('SELECT plan FROM plans WHERE book_id = ? AND page = ?', [bookId, page]);
    return r ? parseJson<ScenePlan | null>(r.plan, null) : null;
  }

  async savePlans(bookId: string, from: number, plans: (ScenePlan | null)[]): Promise<void> {
    const write = async () => {
      for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        if (p) await this.db.runAsync('INSERT OR REPLACE INTO plans (book_id, page, plan) VALUES (?, ?, ?)', [bookId, from + i, JSON.stringify(p)]);
      }
    };
    // um lote inteiro numa transação: uma escrita no disco em vez de oito
    if (this.db.withTransactionAsync) await this.db.withTransactionAsync(write);
    else await write();
  }

  /** Livros alterados desde a última sincronização. */
  async dirtyBooks(): Promise<(BookMeta & { gloss: GlossaryEntry[] })[]> {
    const rows = await this.db.getAllAsync<BookRow>("SELECT * FROM books WHERE updated_at > synced_at");
    return rows.map((r) => ({ ...toMeta(r), gloss: parseJson<GlossaryEntry[]>(r.gloss, []) }));
  }

  async markSynced(id: string, at: number): Promise<void> {
    await this.db.runAsync('UPDATE books SET synced_at = ? WHERE id = ?', [at, id]);
  }

  /** Aplica uma versão vinda da nuvem se ela for mais nova que a local. */
  async mergeRemote(r: { id: string; title: string; kind: BookKind; sub: string; emoji: string; n: number; idx: number; done: boolean; gloss: GlossaryEntry[]; updatedAt: number }): Promise<'inserted' | 'updated' | 'kept'> {
    const local = await this.getBook(r.id);
    if (!local) {
      await this.db.runAsync(
        'INSERT INTO books (id, title, kind, sub, emoji, n, idx, done, gloss, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [r.id, r.title, r.kind, r.sub, r.emoji, r.n, r.idx, r.done ? 1 : 0, JSON.stringify(r.gloss), r.updatedAt, r.updatedAt],
      );
      return 'inserted';
    }
    if (r.updatedAt > local.updatedAt) {
      await this.db.runAsync('UPDATE books SET idx = ?, done = ?, gloss = ?, updated_at = ?, synced_at = ? WHERE id = ?',
        [r.idx, r.done ? 1 : 0, JSON.stringify(r.gloss), r.updatedAt, r.updatedAt, r.id]);
      return 'updated';
    }
    return 'kept';
  }

  async putText(id: string, pages: string[]): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO texts (id, pages) VALUES (?, ?)', [id, JSON.stringify(pages)]);
  }

  async kvGet(k: string): Promise<string | null> {
    return (await this.db.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', [k]))?.v ?? null;
  }

  async kvSet(k: string, v: string): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', [k, v]);
  }
}
