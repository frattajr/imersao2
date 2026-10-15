/**
 * Arquivos de som guardados no navegador (IndexedDB), servidos como blob:
 * URL. Sem IndexedDB (aba privada), ficam só na memória da sessão.
 */
const DB = 'imersao-sounds';
const STORE = 'blobs';
const memory = new Map<string, Uint8Array>();
const urls = new Map<string, string>();

function open(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((res) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(undefined);
  });
}

export async function putBlob(id: string, bytes: Uint8Array): Promise<void> {
  memory.set(id, bytes);
  await tx('readwrite', (s) => s.put(bytes, id));
}

export async function blobUrl(id: string): Promise<string | null> {
  const cached = urls.get(id);
  if (cached) return cached;
  const bytes = memory.get(id) ?? (await tx<Uint8Array>('readonly', (s) => s.get(id)));
  if (!bytes) return null;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  urls.set(id, url);
  return url;
}

export async function deleteBlob(id: string): Promise<void> {
  memory.delete(id);
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
  await tx('readwrite', (s) => s.delete(id));
}
