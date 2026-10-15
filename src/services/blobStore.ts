/**
 * Arquivos de som guardados no aparelho (celular): pasta "sounds" nos
 * documentos do app. A versão do navegador está em blobStore.web.ts.
 */
import { Directory, File, Paths } from 'expo-file-system';

const dir = () => {
  const d = new Directory(Paths.document, 'sounds');
  if (!d.exists) d.create({ idempotent: true });
  return d;
};

export async function putBlob(id: string, bytes: Uint8Array): Promise<void> {
  const f = new File(dir(), id + '.bin');
  if (f.exists) f.delete();
  f.create();
  f.write(bytes);
}

/** Endereço que o fetch do app consegue ler, ou null se o arquivo sumiu. */
export async function blobUrl(id: string): Promise<string | null> {
  const f = new File(dir(), id + '.bin');
  return f.exists ? f.uri : null;
}

export async function deleteBlob(id: string): Promise<void> {
  const f = new File(dir(), id + '.bin');
  if (f.exists) f.delete();
}
