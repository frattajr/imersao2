import * as SQLite from 'expo-sqlite';
import { Repo } from './repo';

let repoPromise: Promise<Repo> | null = null;

/** Abre (uma vez) o banco local do aparelho. */
export function getRepo(): Promise<Repo> {
  if (!repoPromise) {
    repoPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('imersao.db');
      const repo = new Repo(db);
      await repo.init();
      return repo;
    })();
  }
  return repoPromise;
}
