/**
 * Versão para navegador (preview web): o mesmo banco SQLite, via sql.js
 * (WebAssembly), salvo no localStorage para manter biblioteca e progresso
 * entre visitas. O expo-sqlite no navegador exige cabeçalhos COOP/COEP que
 * hospedagens estáticas (GitHub Pages) não enviam.
 */
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import { Repo, type SqlDb } from './repo';

const KEY = 'imersao.db';
type Params = (string | number | null)[] | undefined;

function save(db: Database) {
  try {
    const bytes = db.export();
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    localStorage.setItem(KEY, btoa(s));
  } catch {
    // sem localStorage (aba privada, cota cheia): segue só em memória
  }
}

function load(): Uint8Array | undefined {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return undefined;
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return undefined;
  }
}

function wrap(db: Database): SqlDb {
  const all = <T,>(sql: string, params: Params): T[] => {
    const st = db.prepare(sql);
    try {
      if (params) st.bind(params as SqlValue[]);
      const rows: T[] = [];
      while (st.step()) rows.push(st.getAsObject() as T);
      return rows;
    } finally {
      st.free();
    }
  };
  return {
    async execAsync(sql) {
      db.exec(sql.replace(/PRAGMA journal_mode\s*=\s*WAL;/i, ''));
      save(db);
    },
    async runAsync(sql, params) {
      db.run(sql, params as SqlValue[] | undefined);
      save(db);
      return undefined;
    },
    async getFirstAsync<T>(sql: string, params?: Params) {
      return all<T>(sql, params)[0] ?? null;
    },
    async getAllAsync<T>(sql: string, params?: Params) {
      return all<T>(sql, params);
    },
  };
}

let repoPromise: Promise<Repo> | null = null;

/** Abre (uma vez) o banco local do navegador. */
export function getRepo(): Promise<Repo> {
  if (!repoPromise) {
    repoPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: (f) => `${process.env.EXPO_BASE_URL ?? ''}/${f}` });
      const repo = new Repo(wrap(new SQL.Database(load())));
      await repo.init();
      return repo;
    })();
  }
  return repoPromise;
}
