/**
 * Importação de livros: o seletor de arquivos do sistema (que funciona
 * também pelo "Abrir com…" do iPhone e Android), EPUB lido no aparelho e
 * PDF lido no servidor.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { parseEpubBytes, sniff } from '../core/epub';
import { chunk, contentId, joinPdfPages } from '../core/text';
import type { BookMeta } from '../core/types';
import { getRepo } from '../state/db';
import { extractPdf } from './ai';
import { syncSoon } from './sync';

export type ImportStep = (msg: string, progress: number | null) => void;

async function readBytes(uri: string): Promise<Uint8Array> {
  try {
    return await new File(uri).bytes();
  } catch {
    const r = await fetch(uri);
    return new Uint8Array(await r.arrayBuffer());
  }
}

/** Abre o seletor; devolve `null` se a pessoa cancelar. */
export async function pickAndImport(step: ImportStep): Promise<BookMeta | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'application/epub+zip', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return importFile(a.uri, a.name ?? 'livro', step);
}

export async function importFile(uri: string, name: string, step: ImportStep): Promise<BookMeta> {
  step(`Lendo “${name}”…`, 0);
  const bytes = await readBytes(uri);
  const kind = sniff(bytes) ?? (name.toLowerCase().endsWith('.epub') ? 'epub' : name.toLowerCase().endsWith('.pdf') ? 'pdf' : null);
  let title = '';
  let text = '';
  if (kind === 'epub') {
    const b = await parseEpubBytes(bytes, (p) => step(`Lendo “${name}”…`, p));
    title = b.title;
    text = b.text;
  } else if (kind === 'pdf') {
    step('Extraindo o texto do PDF…', null);
    const r = await extractPdf(bytes);
    title = r.title;
    text = joinPdfPages(r.pages);
  } else {
    throw new Error('Formato não suportado. Use um arquivo PDF ou EPUB.');
  }
  const pages = chunk(text);
  if (pages.length < 3) {
    throw new Error('Não encontrei texto neste arquivo. PDFs digitalizados (só imagens) e EPUBs protegidos não funcionam.');
  }
  return saveImported(pages, (title || name.replace(/\.[^.]+$/, '')).trim().slice(0, 80), kind === 'epub' ? 'EPUB' : 'PDF');
}

export async function saveImported(pages: string[], title: string, label: string, kind: 'file' | 'pasted' = 'file'): Promise<BookMeta> {
  const repo = await getRepo();
  const meta = await repo.addBook(
    { id: contentId(pages), title, kind, sub: kind === 'pasted' ? 'Texto colado' : `${label} importado`, emoji: '📚' },
    pages,
  );
  syncSoon();
  return meta;
}
