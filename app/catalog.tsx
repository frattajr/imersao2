/**
 * Catálogo completo do Project Gutenberg em português (via Gutendex):
 * busca por título ou autor, capas reais e "carregar mais".
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  authorName, bookId, category, CATEGORY_MOOD, displayTitle as cleanTitle, coverUrl, fetchCatalog, openGutenbergBook, synopsisOf, type GutBook,
} from '../src/services/gutenberg';
import { Cover } from '../src/ui/Cover';
import { ProgressBar, RoundButton } from '../src/ui/components';
import { FONTS, usePrefs } from '../src/ui/prefs';

export default function Catalog() {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<GutBook[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [pick, setPick] = useState<GutBook | null>(null);
  const [busy, setBusy] = useState<{ msg: string; pct: number | null; error?: boolean } | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (q: string, p: number) => {
    const my = ++reqId.current;
    setState('loading');
    try {
      const r = await fetchCatalog({ page: p, search: q.trim() || undefined });
      if (my !== reqId.current) return; // chegou uma busca mais nova
      setBooks((cur) => (p === 1 ? r.results : [...cur, ...r.results]));
      setHasMore(!!r.next);
      setTotal(r.count);
      setPage(p);
      setState('ok');
    } catch {
      if (my === reqId.current) setState('error');
    }
  }, []);

  // busca enquanto digita (espera a pessoa parar de digitar)
  useEffect(() => {
    const t = setTimeout(() => void load(query, 1), query ? 450 : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  const read = async (b: GutBook) => {
    setPick(null);
    try {
      setBusy({ msg: `Baixando “${cleanTitle(b.title)}”…`, pct: null });
      await openGutenbergBook(b, (msg, pct) => setBusy({ msg, pct }));
      setBusy(null);
      router.push(`/read/${encodeURIComponent(bookId(b))}`);
    } catch (e) {
      setBusy({ msg: e instanceof Error ? e.message : 'Não consegui baixar este livro.', pct: null, error: true });
    }
  };

  const cols = width > 900 ? 6 : width > 600 ? 4 : 3;
  const w = Math.floor((Math.min(width, 1100) - 32 - (cols - 1) * 12) / cols);

  return (
    <View style={{ flex: 1, backgroundColor: c.ov }}>
      <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
        <View style={st.head}>
          <RoundButton label="←" accessibilityLabel="Voltar" onPress={() => router.back()} />
          <View style={{ flex: 1 }}>
            <Text style={[st.h1, { color: c.fg }]}>Clássicos</Text>
            <Text style={[st.sub, { color: c.mut }]}>Project Gutenberg · livros em português em domínio público</Text>
          </View>
        </View>
        <TextInput value={query} onChangeText={setQuery} placeholder="Buscar por título ou autor (ex.: Machado, Eça, Camões)"
          placeholderTextColor={c.mut} style={[st.input, { color: c.fg, backgroundColor: c.card }]} autoCorrect={false} returnKeyType="search" />
        {state === 'ok' && <Text style={[st.sub, { color: c.mut }]}>{total.toLocaleString('pt-BR')} {total === 1 ? 'livro' : 'livros'}</Text>}
        {state === 'error' && <Text style={[st.sub, { color: c.mut }]}>Não consegui falar com o catálogo agora. Verifique a conexão.</Text>}

        <View style={st.grid}>
          {books.map((b) => (
            <Pressable key={b.id} onPress={() => setPick(b)} accessibilityRole="button" accessibilityLabel={`${cleanTitle(b.title)}, ${authorName(b)}`}
              style={({ pressed }) => ({ width: w, gap: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <Cover id={bookId(b)} title={cleanTitle(b.title)} author={authorName(b)} emoji="📜" mood={CATEGORY_MOOD[category(b)]} width={w} image={coverUrl(b)} />
              <Text style={[st.cap, { color: c.fg }]} numberOfLines={2}>{cleanTitle(b.title)}</Text>
              <Text style={[st.capSub, { color: c.mut }]} numberOfLines={1}>{authorName(b)}</Text>
            </Pressable>
          ))}
        </View>
        {state === 'loading' && <ActivityIndicator color={c.fg} style={{ marginTop: 16 }} />}
        {state === 'ok' && hasMore && <RoundButton label="Carregar mais" onPress={() => void load(query, page + 1)} style={{ alignSelf: 'center' }} />}
      </ScrollView>

      <Modal visible={!!pick} transparent animationType="fade" onRequestClose={() => setPick(null)}>
        <Pressable style={st.backdrop} onPress={() => setPick(null)} accessibilityLabel="Fechar" />
        {pick && (
          <View style={[st.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + 20 }]}>
            <ScrollView contentContainerStyle={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Cover id={bookId(pick)} title={cleanTitle(pick.title)} emoji="📜" mood={CATEGORY_MOOD[category(pick)]} width={110} image={coverUrl(pick)} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[st.dTitle, { color: c.fg }]}>{cleanTitle(pick.title)}</Text>
                  <Text style={[st.sub, { color: c.mut }]}>{authorName(pick)}</Text>
                  <Text style={[st.sub, { color: c.mut }]}>{category(pick)} · {pick.download_count.toLocaleString('pt-BR')} downloads</Text>
                </View>
              </View>
              <Text style={[st.syn, { color: c.fg }]}>{synopsisOf(pick)}</Text>
              <RoundButton big label="▶ Baixar e ler" onPress={() => void read(pick)} />
            </ScrollView>
          </View>
        )}
      </Modal>

      <Modal visible={!!busy} transparent animationType="fade" onRequestClose={() => setBusy(null)}>
        <View style={[st.modal, { backgroundColor: c.ov }]}>
          <Text style={[st.dTitle, { color: c.fg }]}>{busy?.error ? 'Não deu certo' : 'Preparando o livro'}</Text>
          <Text style={[st.syn, { color: c.mut, textAlign: 'center' }]}>{busy?.msg}</Text>
          {!busy?.error && (busy?.pct == null ? <ActivityIndicator color={c.fg} /> : <View style={{ width: 280 }}><ProgressBar pct={busy.pct * 100} height={6} /></View>)}
          {busy?.error && <RoundButton label="Voltar" onPress={() => setBusy(null)} />}
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 14, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 30 },
  sub: { fontFamily: FONTS.ui, fontSize: 14 },
  input: { fontFamily: FONTS.ui, fontSize: 16, minHeight: 48, borderRadius: 14, paddingHorizontal: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cap: { fontFamily: FONTS.uiBold, fontSize: 13, lineHeight: 17 },
  capSub: { fontFamily: FONTS.ui, fontSize: 12 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxWidth: 640, alignSelf: 'center', width: '100%' },
  dTitle: { fontFamily: FONTS.serifMedium, fontSize: 22, lineHeight: 27 },
  syn: { fontFamily: FONTS.serif, fontSize: 16, lineHeight: 24 },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 30 },
});
