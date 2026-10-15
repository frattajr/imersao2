/**
 * Catálogo completo dos clássicos em português em domínio público (cópia do
 * deploy ou consulta ao vivo): busca por título ou autor, capas e "carregar
 * mais". Mostra só o que abre agora (no navegador sem servidor, os livros
 * copiados no deploy). A busca da biblioteca junta tudo com filtros.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  authorName, bookId, canOpenNow, category, CATEGORY_MOOD, displayTitle as cleanTitle, coverUrl, fetchCatalog, gutMeta, openGutenbergBook, synopsisOf, type GutBook,
} from '../src/services/gutenberg';
import { Cover } from '../src/ui/Cover';
import { Icon } from '../src/ui/Icon';
import { IconButton, ProgressBar, RoundButton } from '../src/ui/components';
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
  /** neste navegador (sem servidor) só abrem os livros copiados no deploy */
  const limited = !canOpenNow(-1);
  const [busy, setBusy] = useState<{ msg: string; pct: number | null; error?: boolean } | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (q: string, p: number) => {
    const my = ++reqId.current;
    setState('loading');
    try {
      const r = await fetchCatalog({ page: p, search: q.trim() || undefined, openOnly: true });
      if (my !== reqId.current) return; // chegou uma busca mais nova
      const open = r.results.filter((b) => canOpenNow(b.id));
      setBooks((cur) => (p === 1 ? open : [...cur, ...open]));
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
  const w = Math.floor((Math.min(width, 1100) - 40 - (cols - 1) * 12) / cols);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}>
        <View style={st.head}>
          <IconButton icon="back" label="Voltar" onPress={() => router.back()} />
          <View style={{ flex: 1 }}>
            <Text style={[st.h1, { color: c.fg }]}>Clássicos</Text>
            <Text style={[st.sub, { color: c.mut }]}>Livros em português em domínio público, na grafia atual</Text>
          </View>
        </View>
        <View style={[st.inputBox, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="search" size={18} color={c.mut} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Título ou autor (ex.: Machado, Eça)"
            placeholderTextColor={c.mut} style={[st.input, { color: c.fg }]} autoCorrect={false} returnKeyType="search" accessibilityLabel="Buscar no catálogo" />
        </View>
        {state === 'ok' && <Text style={[st.sub, { color: c.mut }]}>{total.toLocaleString('pt-BR')} {total === 1 ? 'livro' : 'livros'}</Text>}
        {limited && (
          <Text style={[st.sub, { color: c.mut }]}>
            No navegador aparecem só os livros já preparados para abrir na hora. No app do celular, todos abrem.
          </Text>
        )}
        {state === 'error' && <Text style={[st.sub, { color: c.mut }]}>Não consegui falar com o catálogo agora. Verifique a conexão.</Text>}

        <View style={st.grid}>
          {books.map((b) => (
            <Pressable key={b.id} onPress={() => setPick(b)} accessibilityRole="button" accessibilityLabel={`${cleanTitle(b.title)}, ${authorName(b)}`}
              style={({ pressed }) => ({ width: w, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <Cover id={bookId(b)} title={cleanTitle(b.title)} author={authorName(b)} mood={CATEGORY_MOOD[category(b)]} width={w} image={coverUrl(b)} />
            </Pressable>
          ))}
        </View>
        {state === 'loading' && <ActivityIndicator color={c.fg} style={{ marginTop: 16 }} />}
        {state === 'ok' && hasMore && <RoundButton label="Carregar mais" onPress={() => void load(query, page + 1)} style={{ alignSelf: 'center' }} />}
      </ScrollView>

      <Modal visible={!!pick} transparent animationType="fade" onRequestClose={() => setPick(null)}>
        <Pressable style={st.backdrop} onPress={() => setPick(null)} accessibilityLabel="Fechar" />
        {pick && (
          <View style={[st.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 20 }]}>
            <View style={[st.grip, { backgroundColor: c.mut }]} />
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Cover id={bookId(pick)} title={cleanTitle(pick.title)} author={authorName(pick)} mood={CATEGORY_MOOD[category(pick)]} width={104} image={coverUrl(pick)} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[st.dTitle, { color: c.fg }]}>{cleanTitle(pick.title)}</Text>
                  <Text style={[st.sub, { color: c.mut }]}>{authorName(pick)}</Text>
                  <Text style={[st.sub, { color: c.mut }]}>{category(pick)} · domínio público</Text>
                </View>
              </View>
              <Text style={[st.syn, { color: c.fg }]}>{synopsisOf(pick, gutMeta(pick.id)?.excerpt)}</Text>
              <RoundButton big icon="play" label="Baixar e ler" onPress={() => void read(pick)} style={{ alignSelf: 'stretch' }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      <Modal visible={!!busy} transparent animationType="fade" onRequestClose={() => setBusy(null)}>
        <View style={[st.modal, { backgroundColor: c.bg }]}>
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
  wrap: { paddingHorizontal: 20, gap: 16, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 27 },
  sub: { fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 19 },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1 },
  input: { flex: 1, fontFamily: FONTS.ui, fontSize: 16, minHeight: 48, outlineStyle: 'none' } as object,
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grip: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, opacity: 0.35, marginBottom: 10 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 10, maxWidth: 640, alignSelf: 'center', width: '100%' },
  dTitle: { fontFamily: FONTS.serifMedium, fontSize: 22, lineHeight: 27 },
  syn: { fontFamily: FONTS.serif, fontSize: 16, lineHeight: 24 },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 30 },
});
