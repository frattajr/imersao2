/**
 * Biblioteca compartilhada (tela inicial e busca): o formato único dos
 * livros (exemplos, acervo curado, clássicos em domínio público e os da
 * pessoa), o carregamento de tudo, a abertura de um livro, a capa com selos,
 * a ficha com prévia do som e "Quero ler", e o painel de gostos.
 */
import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { previewClimate, previewHasSound } from '../audio/preview';
import { analyze, LAYER_LABEL } from '../core/analyze';
import { dedupeVolumes, formatDuration, minutesToRead, THEMES, type CatalogEntry, type Origin, type ReadingDays } from '../core/catalog';
import { detectChapters } from '../core/chapters';
import { DEFAULT_WPM, type PaceState } from '../core/pace';
import { norm } from '../core/text';
import type { BookMeta, Layer, Mood } from '../core/types';
import { ACERVO, acervoId, isAcervoId, type AcervoEntry } from '../data/acervo';
import { SAMPLE_BOOKS } from '../data/books';
import { acervoCover, loadAcervo, openAcervoBook, type AcervoReady } from '../services/acervo';
import {
  allPortuguese, authorName, bookId, canOpenNow, category, CATEGORY_MOOD, coverUrl, displayTitle, gutMeta, isGutId, openGutenbergBook,
  popularPortuguese, savedGutInfo, synopsisOf, type GutBook,
} from '../services/gutenberg';
import { deleteRemote, downloadText, onSynced, syncSoon } from '../services/sync';
import { getRepo } from '../state/db';
import { getGoal, getReadingDays, getTastes, getWishlist, setTastes, toggleWish, type Tastes } from '../state/userLists';
import { Cover } from './Cover';
import { ProgressBar, RoundButton } from './components';
import { FONTS, usePrefs } from './prefs';

export interface Item extends CatalogEntry {
  emoji: string;
  mood: Mood;
  synopsis: string;
  /** rótulo curto (gênero ou forma) */
  label: string;
  pages: number;
  chapters: number;
  meta?: BookMeta;
  sample: boolean;
  /** capa real */
  image?: string;
  gut?: GutBook;
  acervo?: AcervoEntry;
  /** crédito (traduções, fonte, grafia) */
  credit?: string;
}

export const pctOf = (b?: BookMeta | null) => (!b ? 0 : b.done ? 100 : b.n && b.idx > 0 ? Math.round(((b.idx + 1) / b.n) * 100) : 0);

/** Camadas que mais aparecem no livro (para fileiras de clima e etiquetas da ficha). */
export function topLayers(pages: string[]): Layer[] {
  const count = new Map<Layer, number>();
  pages.forEach((p) => (Object.keys(analyze(p).ambience) as Layer[]).forEach((L) => count.set(L, (count.get(L) ?? 0) + 1)));
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([L]) => L);
}
const wordsOf = (pages: string[]) => pages.reduce((n, p) => n + p.split(/\s+/).filter(Boolean).length, 0);
const LAYER_MOOD: Partial<Record<Layer, Mood>> = { sea: 'sea', rain: 'rain', fire: 'fire', leaves: 'forest', birds: 'forest', night: 'night', city: 'city', train: 'tension', cafe: 'warm' };
const KIND_OF: Record<string, string> = { Romances: 'Romance', Contos: 'Contos', Poesia: 'Poesia', Teatro: 'Teatro', 'História e viagens': 'História', Outros: 'Outros' };

const SAMPLE_ITEMS: Item[] = SAMPLE_BOOKS.map((s) => ({
  id: s.id, title: s.title, author: s.author, source: 'sample', kind: s.plans?.length ? 'Conto' : 'Conto curto', label: s.genre,
  words: wordsOf(s.pages), layers: topLayers(s.pages), tags: [s.genre.toLowerCase(), ...(s.plans?.length ? ['gótico', 'terror'] : [])],
  calibrated: !!s.plans?.length, openable: true, emoji: s.emoji, mood: s.mood, synopsis: s.synopsis, pages: s.pages.length,
  chapters: detectChapters(s.pages).length, sample: true, credit: s.credit,
}));

function acervoItem(a: AcervoEntry, ready: Map<string, AcervoReady>, meta?: BookMeta): Item {
  const r = ready.get(a.slug);
  return {
    id: acervoId(a.slug), title: a.title, author: a.author, source: 'acervo', kind: a.kind, label: a.kind, origin: a.origin, year: a.year,
    words: r?.words, layers: r?.layers ?? [], tags: a.tags, calibrated: false, openable: !ready.size || !!r,
    emoji: a.emoji, mood: a.mood, synopsis: a.synopsis, pages: meta?.n ?? 0, chapters: 0, meta, sample: false, image: acervoCover(r), acervo: a,
    credit: `${a.origin === 'BR' ? '🇧🇷 Brasil' : '🇵🇹 Portugal'} · ${a.year} · domínio público${r?.modernized ? ' · grafia atualizada' : ''}`,
  };
}

function originOf(b: GutBook): Origin | undefined {
  const s = [...b.subjects, ...b.bookshelves].join(' ');
  return /brazil/i.test(s) ? 'BR' : /portug/i.test(s) ? 'PT' : undefined;
}

function gutItem(b: GutBook, meta?: BookMeta): Item {
  const cat = category(b);
  const m = gutMeta(b.id);
  return {
    id: bookId(b), title: displayTitle(b.title), author: authorName(b), source: 'gut', kind: KIND_OF[cat], label: KIND_OF[cat], origin: originOf(b),
    year: b.authors[0]?.death_year ?? undefined, words: m?.words, layers: m?.layers ?? [], tags: [KIND_OF[cat].toLowerCase()],
    calibrated: false, openable: canOpenNow(b.id), emoji: '📜', mood: CATEGORY_MOOD[cat], synopsis: synopsisOf(b, m?.excerpt),
    pages: meta?.n ?? 0, chapters: 0, meta, sample: false, image: coverUrl(b), gut: b, credit: 'Domínio público · grafia atualizada',
  };
}

const LITERATURE = new Set(['Romance', 'Contos', 'Poesia', 'Teatro']);
const ACERVO_TITLES = new Set(ACERVO.map((a) => norm(displayTitle(a.title)).replace(/[^a-z0-9]/g, '')));

/**
 * Carrega tudo que a biblioteca mostra. `fullGut`: todos os clássicos em
 * domínio público (busca); sem ele, só os mais lidos (vitrine).
 */
export function useLibrary(opts: { fullGut?: boolean } = {}) {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [mine, setMine] = useState<Item[]>([]);
  const [ready, setReady] = useState<Map<string, AcervoReady>>(new Map());
  const [gut, setGut] = useState<GutBook[]>([]);
  const [gutState, setGutState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [wish, setWish] = useState<string[]>([]);
  const [tastes, setTastesS] = useState<Tastes | null>(null);
  const [days, setDays] = useState<ReadingDays>({});
  const [goal, setGoalS] = useState(15);

  const loadGut = useCallback(() => {
    setGutState('loading');
    (opts.fullGut ? allPortuguese() : popularPortuguese())
      .then((b) => { setGut(b); setGutState(b.length ? 'ok' : 'error'); })
      .catch(() => setGutState('error'));
  }, [opts.fullGut]);
  useEffect(() => { loadGut(); }, [loadGut]);
  useEffect(() => { void loadAcervo().then(setReady); }, []);

  const load = useCallback(async () => {
    const repo = await getRepo();
    const [list, paceRaw, w, t, d, g] = await Promise.all([repo.listBooks(), repo.kvGet('pace'), getWishlist(), getTastes(), getReadingDays(), getGoal()]);
    setBooks(list);
    try { if (paceRaw) setWpm((JSON.parse(paceRaw) as PaceState).wpm || DEFAULT_WPM); } catch { /* padrão */ }
    setWish(w); setTastesS(t); setDays(d); setGoalS(g);
    // livros da pessoa: clima e sons calculados do próprio texto
    const own = list.filter((b) => b.kind !== 'builtin');
    const items = await Promise.all(own.map(async (b): Promise<Item> => {
      const pages = (await repo.getPages(b.id)) ?? [];
      const sample = pages.slice(0, 60);
      const layers = topLayers(sample);
      const extra = { pages: b.n || pages.length, chapters: pages.length ? detectChapters(pages).length : 0, layers, words: wordsOf(pages), meta: b, openable: true };
      const a = isAcervoId(b.id) ? ACERVO.find((x) => acervoId(x.slug) === b.id) : undefined;
      if (a) return { ...acervoItem(a, new Map(), b), ...extra, source: 'mine' };
      const g = isGutId(b.id) ? await savedGutInfo(b.id) : null;
      return {
        id: b.id, title: b.title, author: b.sub || 'Meu livro', source: 'mine', label: 'Meu livro', tags: [], calibrated: false,
        emoji: b.emoji, sample: false, image: isGutId(b.id) ? coverUrl(Number(b.id.slice(4))) : undefined, gut: g ?? undefined,
        mood: analyze(sample.join('\n')).mood ?? LAYER_MOOD[layers[0]] ?? 'calm',
        synopsis: (pages.find((p) => p.length > 80) ?? pages[0] ?? '').slice(0, 220), ...extra,
      };
    }));
    setMine(items);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => onSynced(() => void load()), [load]);

  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const samples = useMemo((): Item[] => SAMPLE_ITEMS.map((s) => ({ ...s, meta: byId.get(s.id) })), [byId]);
  const acervo = useMemo(() => ACERVO.map((a) => acervoItem(a, ready, byId.get(acervoId(a.slug))))
    .filter((i) => i.openable)
    .sort((x, y) => Number(ready.has(y.acervo!.slug)) - Number(ready.has(x.acervo!.slug))), [ready, byId]);
  /** domínio público: só o que abre agora, sem repetir o acervo nem volumes */
  const classics = useMemo(() => dedupeVolumes(
    gut.filter((b) => !ACERVO_TITLES.has(norm(displayTitle(b.title)).replace(/[^a-z0-9]/g, ''))).map((b) => gutItem(b, byId.get(bookId(b)))).filter((i) => i.openable),
    (i) => i.title, (i) => i.author,
  ), [gut, byId]);
  /** a capa e os dados do acervo valem também para quem já baixou */
  const mineView = useMemo(() => mine.map((m) => {
    if (!m.acervo) return m;
    const r = ready.get(m.acervo.slug);
    return { ...m, image: acervoCover(r), layers: m.layers.length ? m.layers : r?.layers ?? [] };
  }), [mine, ready]);
  const literature = useMemo(() => classics.filter((i) => LITERATURE.has(i.kind ?? '')), [classics]);
  /** vitrine e recomendações: só literatura (gramáticas e livros de história ficam para a busca) */
  const catalog = useMemo(() => [...samples, ...acervo, ...literature], [samples, acervo, literature]);
  /** busca: tudo, inclusive os livros da pessoa (sem repetir os que vieram do catálogo) */
  const everything = useMemo(() => {
    const all = [...samples, ...acervo, ...classics];
    const ids = new Set(all.map((i) => i.id));
    return [...all, ...mineView.filter((m) => !ids.has(m.id))];
  }, [samples, acervo, classics, mineView]);

  const flipWish = useCallback(async (id: string) => {
    const on = await toggleWish(id);
    setWish((w) => (on ? [id, ...w] : w.filter((x) => x !== id)));
    return on;
  }, []);
  const saveTastes = useCallback(async (themes: string[]) => {
    await setTastes(themes);
    setTastesS({ themes, asked: true });
  }, []);

  return {
    books, byId, mine: mineView, samples, acervo, classics, literature, catalog, everything, gutState, loadGut,
    wpm, wish, flipWish, tastes, saveTastes, days, goal, reload: load,
  };
}

/** Abre um livro (baixa antes, se precisar). `busy` mostra o progresso. */
export async function openItem(it: Item, busy: (b: Busy | null) => void, reload?: () => void): Promise<void> {
  const repo = await getRepo();
  if (it.sample) {
    const s = SAMPLE_BOOKS.find((x) => x.id === it.id)!;
    await repo.addBook({ id: s.id, title: s.title, kind: 'builtin', sub: s.sub, emoji: s.emoji });
  } else if (!(await repo.hasText(it.id))) {
    try {
      busy({ msg: `Baixando “${it.title}”…`, pct: null });
      if (it.acervo) await openAcervoBook(it.acervo, (msg, pct) => busy({ msg, pct }));
      else if (it.gut) await openGutenbergBook(it.gut, (msg, pct) => busy({ msg, pct }));
      else if (!(await downloadText(it.id))) throw new Error('Não consegui baixar este livro agora. Verifique a conexão.');
      busy(null);
      reload?.();
    } catch (e) {
      busy({ msg: e instanceof Error ? e.message : 'Não consegui baixar este livro.', pct: null, error: true });
      return;
    }
  }
  router.push(`/read/${encodeURIComponent(it.id)}`);
}

export interface Busy { msg: string; pct: number | null; error?: boolean }

export function BusyModal({ busy, onClose }: { busy: Busy | null; onClose: () => void }) {
  const { c } = usePrefs();
  return (
    <Modal visible={!!busy} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[st.modal, { backgroundColor: c.ov }]}>
        <Text style={[st.h2, { color: c.fg }]}>{busy?.error ? 'Não deu certo' : 'Abrindo livro'}</Text>
        <Text style={[st.lead, { color: c.mut }]}>{busy?.msg}</Text>
        {!busy?.error && (busy?.pct == null
          ? <ActivityIndicator color={c.fg} />
          : <View style={{ width: 280 }}><ProgressBar pct={busy.pct * 100} height={6} /></View>)}
        {busy?.error && <RoundButton label="Voltar" onPress={onClose} />}
      </View>
    </Modal>
  );
}

/** Capa com selos: som calibrado, duração no ritmo da pessoa e "baixado". */
export const Poster = memo(function Poster({ it, w, wpm, onPress }: { it: Item; w: number; wpm: number; onPress: (it: Item) => void }) {
  const { c } = usePrefs();
  const pct = pctOf(it.meta);
  const downloaded = !!it.meta && (it.source === 'acervo' || it.source === 'gut');
  const dur = it.words ? formatDuration(minutesToRead(it.words, wpm)) : null;
  const a11y = [it.title, it.label, it.calibrated ? 'som calibrado' : '', dur ? `cerca de ${dur}` : '', downloaded ? 'baixado' : ''].filter(Boolean).join(', ');
  return (
    <Pressable onPress={() => onPress(it)} accessibilityRole="button" accessibilityLabel={a11y}
      style={({ pressed }) => ({ width: w, gap: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View>
        <Cover id={it.id} title={it.title} author={it.author} emoji={it.emoji} mood={it.mood} width={w} image={it.image} />
        {/* selos no alto da capa (o título fica embaixo) */}
        <View style={st.badges} pointerEvents="none">
          <View style={st.badgeGroup}>
            {it.calibrated ? <Text style={st.badge}>🎧</Text> : null}
            {downloaded ? <Text style={st.badge}>✓</Text> : null}
          </View>
          {dur ? <Text style={st.badge}>{dur}</Text> : null}
        </View>
      </View>
      {pct > 0 && pct < 100 ? <ProgressBar pct={pct} height={3} /> : null}
      {pct >= 100 ? <Text style={[st.done, { color: c.mut }]}>✓ lido</Text> : null}
    </Pressable>
  );
});

/** Ficha do livro: sinopse, duração, som (com prévia), "Quero ler", parecidos. */
export function BookSheet({ item, wpm, wished, related, onClose, onRead, onGlossary, onRemove, onWish, onPick }: {
  item: Item | null; wpm: number; wished: boolean; related: Item[];
  onClose: () => void; onRead: (it: Item) => void; onGlossary: (it: Item) => void; onRemove: (it: Item) => void;
  onWish: (it: Item) => void; onPick: (it: Item) => void;
}) {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const stopRef = useRef<(() => void) | null>(null);
  const [preview, setPreview] = useState<'off' | 'on' | 'silent'>('off');
  const stop = useCallback(() => { stopRef.current?.(); stopRef.current = null; setPreview('off'); }, []);
  useEffect(() => stop, [item, stop]);
  if (!item) return null;
  const pct = pctOf(item.meta);
  const dur = item.words ? formatDuration(minutesToRead(item.words, wpm)) : null;
  const notYet = (item.gut || item.acervo) && !item.meta;
  const play = () => {
    if (preview === 'on') { stop(); return; }
    stopRef.current = previewClimate(item.layers);
    setPreview('on');
    setTimeout(() => setPreview((p) => (p === 'on' && !previewHasSound() ? 'silent' : p)), 3500);
    setTimeout(() => setPreview((p) => (p === 'on' || p === 'silent' ? 'off' : p)), 12_000);
  };
  const close = () => { stop(); onClose(); };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={st.backdrop} onPress={close} accessibilityLabel="Fechar" />
      <View style={[st.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + 20 }]}>
        <ScrollView contentContainerStyle={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Cover id={item.id} title={item.title} author={item.author} emoji={item.emoji} mood={item.mood} width={124} image={item.image} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[st.dTitle, { color: c.fg }]}>{item.title}</Text>
              <Text style={[st.dMeta, { color: c.mut }]}>{item.author}</Text>
              <Text style={[st.dMeta, { color: c.mut }]}>
                {[item.label, item.year && item.source === 'acervo' ? String(item.year) : '', item.pages && !notYet ? `${item.pages} páginas` : ''].filter(Boolean).join(' · ')}
              </Text>
              {dur ? <Text style={[st.dMeta, { color: c.fg }]}>⏱ cerca de {dur} no seu ritmo</Text> : null}
              {pct > 0 && <Text style={[st.dMeta, { color: c.fg }]}>{item.meta?.done ? 'Concluído ✓' : `${pct}% lido`}</Text>}
            </View>
          </View>
          <Text style={[st.dSyn, { color: c.fg }]}>{item.synopsis}</Text>
          {item.credit ? <Text style={[st.dMeta, { color: c.mut }]}>{item.credit}</Text> : null}

          <View style={[st.soundBox, { backgroundColor: c.card }]}>
            <Text style={[st.soundTitle, { color: c.fg }]}>{item.calibrated ? '🎧 Som calibrado cena a cena' : '🎧 Som automático pelo texto'}</Text>
            <Text style={[st.dMeta, { color: c.mut }]}>
              {item.calibrated ? 'Cada trecho tem a mixagem ajustada à mão.' : 'O ambiente acompanha o lugar da história enquanto você lê.'}
            </Text>
            {item.layers.length > 0 && (
              <View style={st.tags}>
                {item.layers.map((L) => (
                  <View key={L} style={[st.tag, { backgroundColor: c.btn }]}><Text style={[st.tagText, { color: c.fg }]}>{LAYER_LABEL[L]}</Text></View>
                ))}
              </View>
            )}
            {item.layers.length > 0 && (
              <View style={{ alignItems: 'flex-start' }}>
                <RoundButton label={preview === 'on' ? '■ Parar a prévia' : preview === 'silent' ? 'Os sons deste clima ainda estão sendo preparados' : '▶ Ouvir o clima (10 s)'}
                  onPress={play} disabled={preview === 'silent'} />
              </View>
            )}
          </View>

          {item.tags.length > 0 && item.source === 'acervo' && (
            <View style={st.tags}>
              {item.tags.map((t) => (
                <View key={t} style={[st.tag, { backgroundColor: c.btn }]}><Text style={[st.tagText, { color: c.fg }]}>{t}</Text></View>
              ))}
            </View>
          )}

          <View style={st.dBtns}>
            <RoundButton big label={`▶ ${pct > 0 && !item.meta?.done ? 'Continuar' : notYet ? 'Baixar e ler' : 'Ler'}`} onPress={() => { stop(); onRead(item); }} />
            <RoundButton label={wished ? '✓ Na lista' : '＋ Quero ler'} accessibilityLabel={wished ? 'Tirar da lista Quero ler' : 'Pôr na lista Quero ler'} onPress={() => onWish(item)} />
            {!notYet && <RoundButton label="📝 Glossário e capítulos" onPress={() => { stop(); onGlossary(item); }} />}
            {item.source !== 'sample' && !!item.meta && <RoundButton label="Remover" onPress={() => { stop(); onRemove(item); }} />}
          </View>

          {related.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={[st.soundTitle, { color: c.fg }]}>Parecidos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {related.map((r) => <Poster key={r.id} it={r} w={96} wpm={wpm} onPress={(x) => { stop(); onPick(x); }} />)}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Ações comuns da ficha (ler, glossário, remover). */
export function useBookActions(reload: () => void) {
  const [busy, setBusy] = useState<Busy | null>(null);
  const read = useCallback((it: Item) => void openItem(it, setBusy, reload), [reload]);
  const glossary = useCallback(async (it: Item) => {
    if (it.sample) {
      const s = SAMPLE_BOOKS.find((x) => x.id === it.id)!;
      await (await getRepo()).addBook({ id: s.id, title: s.title, kind: 'builtin', sub: s.sub, emoji: s.emoji });
    }
    router.push({ pathname: '/glossary/[id]', params: { id: it.id, at: String(it.meta?.idx ?? 0) } });
  }, []);
  const remove = useCallback((it: Item, after?: () => void) => {
    const go = async () => { await (await getRepo()).deleteBook(it.id); void deleteRemote(it.id); syncSoon(); after?.(); reload(); };
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`Remover “${it.title}” da biblioteca?`)) void go(); return; }
    Alert.alert('Remover da biblioteca?', `“${it.title}” e o progresso serão apagados deste aparelho e da nuvem.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void go() },
    ]);
  }, [reload]);
  return { busy, setBusy, read, glossary, remove };
}

/** Primeira abertura: "O que você gosta de ler?" (monta a fileira "Para você"). */
export function TastesModal({ visible, onDone }: { visible: boolean; onDone: (themes: string[]) => void }) {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const [sel, setSel] = useState<string[]>([]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onDone(sel)}>
      <View style={st.backdrop} />
      <View style={[st.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + 20, gap: 14 }]}>
        <Text style={[st.dTitle, { color: c.fg }]}>O que você gosta de ler?</Text>
        <Text style={[st.dMeta, { color: c.mut }]}>Escolha quantos quiser. A fileira “Para você” começa por aí.</Text>
        <View style={st.tags}>
          {THEMES.map((t) => {
            const on = sel.includes(t.key);
            return (
              <Pressable key={t.key} onPress={() => setSel((s) => (on ? s.filter((x) => x !== t.key) : [...s, t.key]))} accessibilityRole="checkbox"
                accessibilityState={{ checked: on }} style={[st.chip, { backgroundColor: on ? c.fg : c.btn }]}>
                <Text style={[st.chipText, { color: on ? c.bg : c.fg }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={st.dBtns}>
          <RoundButton big label={sel.length ? 'Pronto' : 'Pular'} onPress={() => onDone(sel)} />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  badges: { position: 'absolute', top: 6, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  badgeGroup: { flexDirection: 'row', gap: 4 },
  badge: { fontFamily: FONTS.uiBold, fontSize: 10.5, color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  done: { fontFamily: FONTS.ui, fontSize: 12 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxWidth: 640, alignSelf: 'center', width: '100%' },
  dTitle: { fontFamily: FONTS.serifMedium, fontSize: 24, lineHeight: 29 },
  dMeta: { fontFamily: FONTS.ui, fontSize: 14, lineHeight: 19 },
  dSyn: { fontFamily: FONTS.serif, fontSize: 16.5, lineHeight: 25 },
  soundBox: { borderRadius: 16, padding: 14, gap: 8 },
  soundTitle: { fontFamily: FONTS.uiBold, fontSize: 15.5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  tagText: { fontFamily: FONTS.ui, fontSize: 13 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 99, justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiBold, fontSize: 14 },
  dBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 30 },
  h2: { fontFamily: FONTS.serifMedium, fontSize: 28 },
  lead: { fontFamily: FONTS.ui, fontSize: 16.5, lineHeight: 25, textAlign: 'center', maxWidth: 440 },
});

