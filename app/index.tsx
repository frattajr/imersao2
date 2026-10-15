/**
 * Biblioteca no estilo das plataformas de streaming: destaque no topo,
 * filtro por tema, fileiras horizontais de capas (continuar lendo, meus
 * livros, cada tema, cada ambiente sonoro) e uma ficha com detalhes do livro.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyze, LAYER_LABEL } from '../src/core/analyze';
import { detectChapters } from '../src/core/chapters';
import { norm } from '../src/core/text';
import type { BookMeta, Layer, Mood } from '../src/core/types';
import { ACERVO, ACERVO_KINDS, acervoId, isAcervoId, type AcervoEntry } from '../src/data/acervo';
import { GENRES, SAMPLE_BOOKS, type Genre } from '../src/data/books';
import { acervoCover, loadAcervo, openAcervoBook, type AcervoReady } from '../src/services/acervo';
import {
  authorName, bookId, category, CATEGORY_MOOD, coverUrl, displayTitle, GUT_CATEGORIES, isGutId, openGutenbergBook, popularPortuguese,
  savedGutInfo, synopsisOf, type GutBook,
} from '../src/services/gutenberg';
import { pickAndImport } from '../src/services/importer';
import { deleteRemote, downloadText, onSynced, syncSoon } from '../src/services/sync';
import { getRepo } from '../src/state/db';
import { Cover } from '../src/ui/Cover';
import { ProgressBar, RoundButton } from '../src/ui/components';
import { FONTS, usePrefs } from '../src/ui/prefs';

const MINE = 'Meus livros';
const CLASSICS = 'Clássicos';
type Shelf = Genre | typeof MINE | typeof CLASSICS;

interface Item {
  id: string;
  title: string;
  author: string;
  emoji: string;
  mood: Mood;
  genre: Shelf;
  synopsis: string;
  pages: number;
  chapters: number;
  layers: Layer[];
  meta?: BookMeta;
  sample: boolean;
  /** capa real (Project Gutenberg) */
  image?: string;
  /** livro do catálogo do Project Gutenberg */
  gut?: GutBook;
  /** crédito (obras em domínio público traduzidas) */
  credit?: string;
  /** obra do acervo curado em português */
  acervo?: AcervoEntry;
}

function acervoItem(a: AcervoEntry, ready?: AcervoReady, meta?: BookMeta): Item {
  return {
    id: acervoId(a.slug), title: a.title, author: a.author, emoji: a.emoji, mood: a.mood, genre: CLASSICS, synopsis: a.synopsis,
    pages: meta?.n ?? 0, chapters: 0, layers: [], meta, sample: false, image: acervoCover(ready), acervo: a,
    credit: `${a.origin === 'BR' ? '🇧🇷 Brasil' : '🇵🇹 Portugal'} · ${a.year} · domínio público${ready?.modernized ? ' · grafia atualizada' : ''}`,
  };
}

const titleKey = (t: string) => norm(displayTitle(t)).replace(/[^a-z0-9]/g, '');
const ACERVO_TITLES = new Set(ACERVO.map((a) => titleKey(a.title)));

function gutItem(b: GutBook, meta?: BookMeta): Item {
  const cat = category(b);
  return {
    id: bookId(b), title: displayTitle(b.title), author: authorName(b), emoji: '📜', mood: CATEGORY_MOOD[cat], genre: CLASSICS,
    synopsis: synopsisOf(b), pages: meta?.n ?? 0, chapters: 0, layers: [], meta, sample: false, image: coverUrl(b), gut: b,
  };
}

const pctOf = (b?: BookMeta | null) => (!b ? 0 : b.done ? 100 : b.n && b.idx > 0 ? Math.round(((b.idx + 1) / b.n) * 100) : 0);

/** Camadas que mais aparecem no livro (para "Ao som do mar", etiquetas da ficha). */
function topLayers(pages: string[]): Layer[] {
  const count = new Map<Layer, number>();
  pages.forEach((p) => (Object.keys(analyze(p).ambience) as Layer[]).forEach((L) => count.set(L, (count.get(L) ?? 0) + 1)));
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([L]) => L);
}

const LAYER_MOOD: Partial<Record<Layer, Mood>> = { sea: 'sea', rain: 'rain', fire: 'fire', leaves: 'forest', birds: 'forest', night: 'night', city: 'city', train: 'tension', cafe: 'warm' };

const SAMPLE_ITEMS: Item[] = SAMPLE_BOOKS.map((s) => ({
  id: s.id, title: s.title, author: s.author, emoji: s.emoji, mood: s.mood, genre: s.genre, synopsis: s.synopsis,
  pages: s.pages.length, chapters: detectChapters(s.pages).length, layers: topLayers(s.pages), sample: true, credit: s.credit,
}));

/** Fileiras por ambiente sonoro: só aparecem se tiverem pelo menos 2 livros. */
const SOUND_ROWS: { title: string; has: Layer[] }[] = [
  { title: '🌧 Para ler ao som da chuva', has: ['rain', 'thunder'] },
  { title: '🌊 Ao som do mar', has: ['sea'] },
  { title: '🔥 Junto à lareira', has: ['fire'] },
  { title: '🌲 Na natureza', has: ['leaves', 'birds', 'water', 'cricket'] },
  { title: '🌙 Histórias da noite', has: ['night', 'cricket'] },
];

export default function Library() {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [mine, setMine] = useState<Item[]>([]);
  const [shelf, setShelf] = useState<Shelf | 'Todos'>('Todos');
  const [detail, setDetail] = useState<Item | null>(null);
  const [busy, setBusy] = useState<{ msg: string; pct: number | null; error?: boolean } | null>(null);
  const [gut, setGut] = useState<GutBook[]>([]);
  const [gutState, setGutState] = useState<'loading' | 'ok' | 'error'>('loading');

  const loadClassics = useCallback(() => {
    setGutState('loading');
    popularPortuguese().then((b) => { setGut(b); setGutState(b.length ? 'ok' : 'error'); }).catch(() => setGutState('error'));
  }, []);
  useEffect(() => { loadClassics(); }, [loadClassics]);
  /** acervo curado: o que o deploy já deixou pronto (texto e capa) */
  const [ready, setReady] = useState<Map<string, AcervoReady>>(new Map());
  useEffect(() => { void loadAcervo().then(setReady); }, []);

  const load = useCallback(async () => {
    const repo = await getRepo();
    const list = await repo.listBooks();
    setBooks(list);
    // livros da pessoa: clima e sons calculados do próprio texto
    const own = list.filter((b) => b.kind !== 'builtin');
    const items = await Promise.all(own.map(async (b): Promise<Item> => {
      const pages = (await repo.getPages(b.id)) ?? [];
      const sample = pages.slice(0, 40);
      const layers = topLayers(sample);
      const g = isGutId(b.id) ? await savedGutInfo(b.id) : null;
      const a = isAcervoId(b.id) ? ACERVO.find((x) => acervoId(x.slug) === b.id) : undefined;
      if (a) return { ...acervoItem(a, undefined, b), genre: MINE, pages: b.n || pages.length, chapters: pages.length ? detectChapters(pages).length : 0, layers };
      return {
        id: b.id, title: b.title, author: b.sub || 'Meu livro', emoji: b.emoji, genre: MINE, meta: b, sample: false,
        image: isGutId(b.id) ? coverUrl(Number(b.id.slice(4))) : undefined, gut: g ?? undefined,
        mood: analyze(sample.join('\n')).mood ?? LAYER_MOOD[layers[0]] ?? 'calm',
        synopsis: (pages.find((p) => p.length > 80) ?? pages[0] ?? '').slice(0, 220),
        pages: b.n || pages.length, chapters: pages.length ? detectChapters(pages).length : 0, layers,
      };
    }));
    setMine(items);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => onSynced(() => void load()), [load]);

  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  // Gutenberg sem repetir o que já está no acervo curado
  const classics = useMemo(() => gut.filter((b) => !ACERVO_TITLES.has(titleKey(b.title))).map((b) => gutItem(b, byId.get(bookId(b)))), [gut, byId]);
  const acervo = useMemo(() => ACERVO.map((a) => acervoItem(a, ready.get(a.slug), byId.get(acervoId(a.slug))))
    // prontos no deploy primeiro (abrem na hora)
    .sort((x, y) => Number(ready.has(y.acervo!.slug)) - Number(ready.has(x.acervo!.slug))), [ready, byId]);
  // a capa vem do acervo também para quem já baixou
  const mineView = useMemo(() => mine.map((m) => (m.acervo ? { ...m, image: acervoCover(ready.get(m.acervo.slug)) } : m)), [mine, ready]);
  const all = useMemo(() => [...mineView, ...SAMPLE_ITEMS.map((s) => ({ ...s, meta: byId.get(s.id) }))], [mineView, byId]);
  const reading = useMemo(() => all.filter((i) => i.meta && !i.meta.done && pctOf(i.meta) > 0)
    .sort((a, b) => (b.meta!.updatedAt ?? 0) - (a.meta!.updatedAt ?? 0)), [all]);
  // primeira vez: abre com um clássico já sonorizado (não precisa de chave nem upload)
  const hero = reading[0] ?? all.find((i) => i.id === 'sample-poe-coracao') ?? all[0];

  const open = async (it: Item) => {
    setDetail(null);
    const repo = await getRepo();
    if (it.sample) {
      const s = SAMPLE_BOOKS.find((x) => x.id === it.id)!;
      await repo.addBook({ id: s.id, title: s.title, kind: 'builtin', sub: s.sub, emoji: s.emoji });
    } else if (it.acervo && !(await repo.hasText(it.id))) {
      // acervo curado: texto da cópia do deploy (ou do Wikisource), na grafia atual
      try {
        setBusy({ msg: `Baixando “${it.title}”…`, pct: null });
        await openAcervoBook(it.acervo, (msg, pct) => setBusy({ msg, pct }));
        setBusy(null);
        void load();
      } catch (e) {
        setBusy({ msg: e instanceof Error ? e.message : 'Não consegui baixar este livro.', pct: null, error: true });
        return;
      }
    } else if (it.gut && !(await repo.hasText(it.id))) {
      // clássico do Project Gutenberg: baixa uma vez e guarda na biblioteca
      try {
        setBusy({ msg: `Baixando “${it.title}”…`, pct: null });
        await openGutenbergBook(it.gut, (msg, pct) => setBusy({ msg, pct }));
        setBusy(null);
        void load();
      } catch (e) {
        setBusy({ msg: e instanceof Error ? e.message : 'Não consegui baixar este livro.', pct: null, error: true });
        return;
      }
    } else if (!(await repo.hasText(it.id))) {
      setBusy({ msg: `Baixando “${it.title}”…`, pct: null });
      const pages = await downloadText(it.id);
      if (!pages) { setBusy({ msg: 'Não consegui baixar este livro agora. Verifique a conexão.', pct: null, error: true }); return; }
      setBusy(null);
    }
    router.push(`/read/${encodeURIComponent(it.id)}`);
  };

  const openGlossary = async (it: Item) => {
    if ((it.gut || it.acervo) && !it.meta) return void open(it); // ainda não baixado: baixa e abre a leitura
    setDetail(null);
    if (it.sample) {
      const s = SAMPLE_BOOKS.find((x) => x.id === it.id)!;
      await (await getRepo()).addBook({ id: s.id, title: s.title, kind: 'builtin', sub: s.sub, emoji: s.emoji });
    }
    router.push({ pathname: '/glossary/[id]', params: { id: it.id, at: String(it.meta?.idx ?? 0) } });
  };

  const importBook = async () => {
    try {
      const meta = await pickAndImport((msg, pct) => setBusy({ msg, pct }));
      setBusy(null);
      if (meta) router.push(`/read/${encodeURIComponent(meta.id)}`);
    } catch (e) {
      setBusy({ msg: e instanceof Error ? e.message : 'Não foi possível abrir o arquivo.', pct: null, error: true });
    }
  };

  const remove = (it: Item) => {
    const go = async () => { setDetail(null); await (await getRepo()).deleteBook(it.id); void deleteRemote(it.id); syncSoon(); void load(); };
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`Remover “${it.title}” da biblioteca?`)) void go(); return; }
    Alert.alert('Remover da biblioteca?', `“${it.title}” e o progresso serão apagados deste aparelho e da nuvem.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void go() },
    ]);
  };

  const posterW = Math.min(150, Math.max(112, (width - 32) / 3.2));
  const wide = Math.min(width, 900);

  const Poster = ({ it, w = posterW }: { it: Item; w?: number }) => (
    <Pressable onPress={() => setDetail(it)} accessibilityRole="button" accessibilityLabel={`${it.title}, ${it.genre}`}
      style={({ pressed }) => ({ width: w, gap: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Cover id={it.id} title={it.title} author={it.author} emoji={it.emoji} mood={it.mood} width={w} image={it.image} />
      {pctOf(it.meta) > 0 && pctOf(it.meta) < 100 ? <ProgressBar pct={pctOf(it.meta)} height={3} /> : null}
    </Pressable>
  );

  const Row = ({ title, items, lead }: { title: string; items: Item[]; lead?: React.ReactNode }) =>
    items.length || lead ? (
      <View style={{ gap: 10 }}>
        <Text style={[st.rowTitle, { color: c.fg }]}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.rowList}>
          {lead}
          {items.map((it) => <Poster key={it.id} it={it} />)}
        </ScrollView>
      </View>
    ) : null;

  const AddCards = (
    <>
      <Pressable onPress={() => void importBook()} accessibilityRole="button" style={[st.add, { width: posterW, height: posterW * 1.5, borderColor: c.btn }]}>
        <Text style={{ fontSize: 30 }}>📚</Text>
        <Text style={[st.addText, { color: c.fg }]}>Abrir PDF ou EPUB</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/paste')} accessibilityRole="button" style={[st.add, { width: posterW, height: posterW * 1.5, borderColor: c.btn }]}>
        <Text style={{ fontSize: 30 }}>✍️</Text>
        <Text style={[st.addText, { color: c.fg }]}>Colar meu texto</Text>
      </Pressable>
    </>
  );

  const shelves: (Shelf | 'Todos')[] = ['Todos', CLASSICS, ...GENRES, MINE];
  const filtered = shelf === 'Todos' ? [] : shelf === CLASSICS ? [...acervo, ...classics] : shelf === MINE ? mineView : all.filter((i) => i.genre === shelf);
  const SeeAll = (
    <Pressable onPress={() => router.push('/catalog')} accessibilityRole="button" style={[st.add, { width: posterW, height: posterW * 1.5, borderColor: c.btn }]}>
      <Text style={{ fontSize: 30 }}>🔎</Text>
      <Text style={[st.addText, { color: c.fg }]}>Ver o catálogo completo</Text>
    </Pressable>
  );
  const gutNote = gutState === 'loading'
    ? <Text style={[st.note, { color: c.mut }]}>Carregando clássicos do Project Gutenberg…</Text>
    : gutState === 'error' ? (
      <View style={{ paddingHorizontal: 16, gap: 8, alignItems: 'flex-start' }}>
        <Text style={[st.empty, { color: c.mut }]}>Não consegui carregar os clássicos do Project Gutenberg agora.</Text>
        <RoundButton label="↻ Tentar de novo" onPress={loadClassics} />
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.ov }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* destaque */}
        {hero && (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <View style={{ width: wide, height: Math.min(520, wide * 1.15) }}>
              <Cover id={hero.id} title={hero.title} emoji={hero.emoji} mood={hero.mood} width={wide} aspect={Math.min(520, wide * 1.15) / wide} showTitle={false} />
              <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', 'transparent', c.ov]} locations={[0, 0.22, 0.45, 1]} style={StyleSheet.absoluteFill} />
              <View style={[st.top, { paddingTop: insets.top + 12 }]}>
                <Text style={st.brand}>Imersão</Text>
                <RoundButton label="⚙" accessibilityLabel="Configurações" onPress={() => router.push('/settings')} style={st.gear} />
              </View>
              <View style={st.heroText}>
                <Text style={st.heroKicker}>{reading[0] ? 'CONTINUAR LENDO' : 'EM DESTAQUE'} · {hero.genre.toUpperCase()}</Text>
                <Text style={st.heroTitle} numberOfLines={2}>{hero.title}</Text>
                <Text style={st.heroSyn} numberOfLines={3}>{hero.synopsis}</Text>
                <View style={st.heroBtns}>
                  <Pressable onPress={() => void open(hero)} accessibilityRole="button" style={({ pressed }) => [st.play, { opacity: pressed ? 0.85 : 1 }]}>
                    <Text style={st.playText}>▶ {pctOf(hero.meta) > 0 ? 'Continuar' : 'Ler agora'}</Text>
                  </Pressable>
                  <Pressable onPress={() => setDetail(hero)} accessibilityRole="button" style={({ pressed }) => [st.info, { opacity: pressed ? 0.85 : 1 }]}>
                    <Text style={st.infoText}>ⓘ Detalhes</Text>
                  </Pressable>
                </View>
                {pctOf(hero.meta) > 0 ? <View style={{ width: 200 }}><ProgressBar pct={pctOf(hero.meta)} height={3} /></View> : null}
              </View>
            </View>
          </View>
        )}

        <View style={[st.body, { maxWidth: 1100 }]}>
          {/* temas */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
            {shelves.map((g) => (
              <Pressable key={g} onPress={() => setShelf(g)} accessibilityRole="button" accessibilityState={{ selected: shelf === g }}
                style={[st.chip, { backgroundColor: shelf === g ? c.fg : c.btn }]}>
                <Text style={[st.chipText, { color: shelf === g ? c.bg : c.fg }]}>{g}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {shelf === 'Todos' ? (
            <>
              <Row title="Continuar lendo" items={reading} />
              <Row title="Meus livros" items={mineView} lead={AddCards} />
              <Row title="🇧🇷 Clássicos brasileiros" items={acervo.filter((i) => i.acervo!.origin === 'BR')} />
              <Row title="🇵🇹 Clássicos portugueses" items={acervo.filter((i) => i.acervo!.origin === 'PT')} />
              {ACERVO_KINDS.filter((k) => k !== 'Romance').map((k) => {
                const items = acervo.filter((i) => i.acervo!.kind === k);
                return items.length >= 2 ? <Row key={k} title={`Em português · ${k}`} items={items} /> : null;
              })}
              {gutNote}
              <Row title="📜 Mais clássicos (Project Gutenberg)" items={classics.slice(0, 20)} lead={undefined} />
              {GUT_CATEGORIES.filter((g) => g !== 'Outros').map((g) => {
                const items = classics.filter((i) => i.gut && category(i.gut) === g);
                return items.length >= 2 ? <Row key={g} title={`Clássicos · ${g}`} items={items} /> : null;
              })}
              {classics.length > 0 && (
                <Pressable onPress={() => router.push('/catalog')} accessibilityRole="button" style={[st.more, { backgroundColor: c.btn }]}>
                  <Text style={[st.chipText, { color: c.fg }]}>🔎 Buscar no catálogo do Project Gutenberg</Text>
                </Pressable>
              )}
              {GENRES.map((g) => <Row key={g} title={g} items={all.filter((i) => i.genre === g)} />)}
              {SOUND_ROWS.map((r) => {
                const items = all.filter((i) => i.layers.some((L) => r.has.includes(L)));
                return items.length >= 2 ? <Row key={r.title} title={r.title} items={items} /> : null;
              })}
            </>
          ) : (
            <View style={st.grid}>
              {shelf === MINE && AddCards}
              {shelf === CLASSICS && gutNote}
              {filtered.map((it) => <Poster key={it.id} it={it} />)}
              {shelf === CLASSICS && classics.length > 0 && SeeAll}
              {!filtered.length && shelf !== MINE && shelf !== CLASSICS && <Text style={[st.empty, { color: c.mut }]}>Nenhum livro neste tema ainda.</Text>}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ficha do livro */}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <Pressable style={st.backdrop} onPress={() => setDetail(null)} accessibilityLabel="Fechar" />
        {detail && (
          <View style={[st.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + 20 }]}>
            <ScrollView contentContainerStyle={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Cover id={detail.id} title={detail.title} author={detail.author} emoji={detail.emoji} mood={detail.mood} width={124} image={detail.image} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[st.dTitle, { color: c.fg }]}>{detail.title}</Text>
                  <Text style={[st.dMeta, { color: c.mut }]}>{detail.author}</Text>
                  <Text style={[st.dMeta, { color: c.mut }]}>
                    {detail.acervo && !detail.pages
                      ? `${detail.acervo.kind} · ${detail.acervo.year}`
                      : detail.gut && !detail.pages
                      ? `${category(detail.gut)} · Project Gutenberg · domínio público`
                      : `${detail.genre} · ${detail.pages} páginas${detail.chapters > 1 ? ` · ${detail.chapters} capítulos` : ''}`}
                  </Text>
                  {detail.gut ? <Text style={[st.dMeta, { color: c.mut }]}>{detail.gut.download_count.toLocaleString('pt-BR')} downloads</Text> : null}
                  {pctOf(detail.meta) > 0 && <Text style={[st.dMeta, { color: c.fg }]}>{detail.meta?.done ? 'Concluído ✓' : `${pctOf(detail.meta)}% lido`}</Text>}
                </View>
              </View>
              <Text style={[st.dSyn, { color: c.fg }]}>{detail.synopsis}</Text>
              {detail.credit ? <Text style={[st.dMeta, { color: c.mut }]}>{detail.credit}{SAMPLE_BOOKS.find((b) => b.id === detail.id)?.plans ? ' · 🎧 sonorização calibrada' : ''}</Text> : null}
              {detail.acervo ? (
                <View style={st.tags}>
                  {detail.acervo.tags.map((t) => (
                    <View key={t} style={[st.tag, { backgroundColor: c.btn }]}><Text style={[st.tagText, { color: c.fg }]}>{t}</Text></View>
                  ))}
                </View>
              ) : null}
              {detail.layers.length > 0 && (
                <View style={st.tags}>
                  <Text style={[st.dMeta, { color: c.mut }]}>Ambiente sonoro:</Text>
                  {detail.layers.map((L) => (
                    <View key={L} style={[st.tag, { backgroundColor: c.btn }]}><Text style={[st.tagText, { color: c.fg }]}>{LAYER_LABEL[L]}</Text></View>
                  ))}
                </View>
              )}
              <View style={st.dBtns}>
                <RoundButton big label={`▶ ${pctOf(detail.meta) > 0 && !detail.meta?.done ? 'Continuar' : (detail.gut || detail.acervo) && !detail.meta ? 'Baixar e ler' : 'Ler'}`} onPress={() => void open(detail)} />
                {((!detail.gut && !detail.acervo) || detail.meta) && <RoundButton label="📝 Glossário e capítulos" onPress={() => void openGlossary(detail)} />}
                {!detail.sample && ((!detail.gut && !detail.acervo) || detail.meta) && <RoundButton label="Remover" onPress={() => remove(detail)} />}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      <Modal visible={!!busy} transparent animationType="fade" onRequestClose={() => setBusy(null)}>
        <View style={[st.modal, { backgroundColor: c.ov }]}>
          <Text style={[st.h2, { color: c.fg }]}>{busy?.error ? 'Não deu certo' : 'Abrindo livro'}</Text>
          <Text style={[st.lead, { color: c.mut }]}>{busy?.msg}</Text>
          {!busy?.error && (busy?.pct == null
            ? <ActivityIndicator color={c.fg} />
            : <View style={{ width: 280 }}><ProgressBar pct={busy.pct * 100} height={6} /></View>)}
          {busy?.error && <RoundButton label="Voltar" onPress={() => setBusy(null)} />}
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  brand: { fontFamily: FONTS.serifMedium, fontSize: 26, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  gear: { backgroundColor: 'rgba(0,0,0,0.35)' },
  heroText: { position: 'absolute', left: 16, right: 16, bottom: 20, gap: 8 },
  heroKicker: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1.5, color: 'rgba(255,255,255,0.8)' },
  heroTitle: { fontFamily: FONTS.serifMedium, fontSize: 36, lineHeight: 42, color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 10 },
  heroSyn: { fontFamily: FONTS.ui, fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.88)', maxWidth: 520, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  heroBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  play: { backgroundColor: '#fff', height: 46, paddingHorizontal: 22, borderRadius: 8, justifyContent: 'center' },
  playText: { fontFamily: FONTS.uiBold, fontSize: 16, color: '#111' },
  info: { backgroundColor: 'rgba(255,255,255,0.22)', height: 46, paddingHorizontal: 18, borderRadius: 8, justifyContent: 'center' },
  infoText: { fontFamily: FONTS.uiBold, fontSize: 16, color: '#fff' },
  body: { width: '100%', alignSelf: 'center', gap: 22, paddingTop: 14 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: { minHeight: 36, paddingHorizontal: 16, borderRadius: 99, justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiBold, fontSize: 14 },
  note: { fontFamily: FONTS.ui, fontSize: 14, paddingHorizontal: 16 },
  more: { marginHorizontal: 16, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  rowTitle: { fontFamily: FONTS.uiBold, fontSize: 18, paddingHorizontal: 16 },
  rowList: { gap: 10, paddingHorizontal: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  empty: { fontFamily: FONTS.ui, fontSize: 15 },
  add: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 },
  addText: { fontFamily: FONTS.uiBold, fontSize: 13.5, textAlign: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxWidth: 640, alignSelf: 'center', width: '100%' },
  dTitle: { fontFamily: FONTS.serifMedium, fontSize: 24, lineHeight: 29 },
  dMeta: { fontFamily: FONTS.ui, fontSize: 14 },
  dSyn: { fontFamily: FONTS.serif, fontSize: 16.5, lineHeight: 25 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  tagText: { fontFamily: FONTS.ui, fontSize: 13 },
  dBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 30 },
  h2: { fontFamily: FONTS.serifMedium, fontSize: 28 },
  lead: { fontFamily: FONTS.ui, fontSize: 16.5, lineHeight: 25, textAlign: 'center', maxWidth: 440 },
});
