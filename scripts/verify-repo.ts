/**
 * Verifica o SQL da biblioteca local com o SQLite do Bun (fora do celular).
 * Uso: bun scripts/verify-repo.ts
 */
import { Database } from 'bun:sqlite';
import { Repo, type SqlDb } from '../src/state/repo';

const raw = new Database(':memory:');
const db: SqlDb = {
  async execAsync(sql) { raw.exec(sql); },
  async runAsync(sql, p = []) { return raw.query(sql).run(...(p as never[])); },
  async getFirstAsync<T>(sql: string, p: (string | number | null)[] = []) { return (raw.query(sql).get(...(p as never[])) as T) ?? null; },
  async getAllAsync<T>(sql: string, p: (string | number | null)[] = []) { return raw.query(sql).all(...(p as never[])) as T[]; },
};

let t = 1000;
const repo = new Repo(db, () => ++t);
const ok = (c: unknown, m: string) => { if (!c) { console.error('FALHOU:', m); process.exit(1); } console.log('ok -', m); };

await repo.init();
await repo.init(); // idempotente
await repo.addBook({ id: 'b1', title: 'Livro', kind: 'file', sub: 'EPUB importado', emoji: '📚' }, ['p1', 'p2', 'p3']);
ok((await repo.getPages('b1'))?.length === 3, 'salva e lê o texto');
await repo.saveProgress('b1', 2, false);
await repo.addBook({ id: 'b1', title: 'Livro', kind: 'file', sub: 'EPUB importado', emoji: '📚' }, ['p1', 'p2', 'p3']);
ok((await repo.getBook('b1'))?.idx === 2, 'reimportar não zera o progresso');
await repo.addBook({ id: 'sample-farol', title: 'A Guardiã do Farol', kind: 'builtin', sub: '', emoji: '🏮' });
ok((await repo.getBook('sample-farol'))?.n === 14 && !(await repo.hasText('sample-farol')), 'histórias de exemplo não duplicam texto');
ok((await repo.getPages('sample-farol'))?.length === 14, 'lê texto das histórias de exemplo');
await repo.setGloss('b1', [{ term: 'Marina', desc: 'protagonista' }]);
ok((await repo.getGloss('b1'))[0].term === 'Marina', 'glossário salvo');
await repo.savePlans('b1', 0, [{ mood: 'sea', ambience: { sea: 0.5 }, spots: [] }, null]);
ok((await repo.getPlan('b1', 0))?.mood === 'sea' && (await repo.getPlan('b1', 1)) === null, 'cache de planos de som');
const dirty = await repo.dirtyBooks();
ok(dirty.length === 2, 'lista livros pendentes de sincronizar');
await repo.markSynced('b1', t + 10);
ok((await repo.dirtyBooks()).length === 1, 'marca como sincronizado');
ok((await repo.mergeRemote({ id: 'b1', title: 'Livro', kind: 'file', sub: '', emoji: '📚', n: 3, idx: 0, done: false, gloss: [], updatedAt: 5 })) === 'kept', 'versão remota antiga não sobrescreve');
ok((await repo.mergeRemote({ id: 'b1', title: 'Livro', kind: 'file', sub: '', emoji: '📚', n: 3, idx: 1, done: true, gloss: [], updatedAt: t + 100 })) === 'updated', 'versão remota nova atualiza');
ok((await repo.getBook('b1'))?.done === true, 'progresso remoto aplicado');
ok((await repo.mergeRemote({ id: 'b9', title: 'Outro', kind: 'cloud', sub: '', emoji: '📘', n: 9, idx: 4, done: false, gloss: [], updatedAt: 7 })) === 'inserted', 'livro de outro aparelho entra na lista');
ok((await repo.listBooks())[0].id === 'b1', 'ordena pelo mais recente');
await repo.deleteBook('b1');
ok(!(await repo.getBook('b1')) && !(await repo.getPages('b1')) && !(await repo.getPlan('b1', 0)), 'remover apaga livro, texto e planos');
await repo.kvSet('a', '1');
ok((await repo.kvGet('a')) === '1', 'chave-valor');
console.log('\nBiblioteca local: tudo certo.');
