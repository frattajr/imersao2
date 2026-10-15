/**
 * Banco local no celular (iOS/Android): expo-sqlite com o SQLite nativo do
 * sistema (JSI na nova arquitetura), modo WAL para leituras e escritas
 * concorrentes sem travar a interface. A versão do navegador está em
 * db.web.ts (sql.js/WebAssembly) — o Metro escolhe o arquivo pela
 * plataforma, então o .wasm nunca entra no app nativo.
 */
import * as SQLite from 'expo-sqlite';
import { Repo, type SqlDb } from './repo';

let repoPromise: Promise<Repo> | null = null;

/** Abre (uma vez) o banco local do aparelho. */
export function getRepo(): Promise<Repo> {
  if (!repoPromise) {
    repoPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('imersao.db');
      // WAL: leitores não esperam o escritor; NORMAL: seguro com WAL e bem mais rápido; espera até 3 s se ocupado
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 3000; PRAGMA temp_store = MEMORY;');
      const repo = new Repo(db as unknown as SqlDb);
      await repo.init();
      return repo;
    })();
  }
  return repoPromise;
}
