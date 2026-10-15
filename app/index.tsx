import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TINT } from '../src/core/analyze';
import type { BookMeta } from '../src/core/types';
import { SAMPLE_BOOKS } from '../src/data/books';
import { aiAvailable } from '../src/services/ai';
import { pickAndImport } from '../src/services/importer';
import { deleteRemote, downloadText, onSynced, syncSoon } from '../src/services/sync';
import { getRepo } from '../src/state/db';
import { BookCard, ProgressBar, RoundButton, SectionTitle } from '../src/ui/components';
import { FONTS, usePrefs } from '../src/ui/prefs';

const pctOf = (b?: BookMeta | null) => (!b ? 0 : b.done ? 100 : b.n && b.idx > 0 ? Math.round(((b.idx + 1) / b.n) * 100) : 0);
const subOf = (b: BookMeta | null | undefined, fallback: string) => {
  if (!b) return fallback;
  if (b.done) return `Concluído ✓ · ${b.n} páginas`;
  const p = pctOf(b);
  return p ? `${p}% lido · página ${b.idx + 1} de ${b.n}` : fallback;
};

export default function Library() {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [busy, setBusy] = useState<{ msg: string; pct: number | null; error?: boolean } | null>(null);

  const load = useCallback(async () => setBooks(await (await getRepo()).listBooks()), []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => onSynced(() => void load()), [load]);

  const byId = new Map(books.map((b) => [b.id, b]));
  const mine = books.filter((b) => b.kind !== 'builtin');

  const open = async (b: BookMeta) => {
    const repo = await getRepo();
    if (b.kind !== 'builtin' && !(await repo.hasText(b.id))) {
      setBusy({ msg: `Baixando “${b.title}”…`, pct: null });
      const pages = await downloadText(b.id);
      if (!pages) { setBusy({ msg: 'Não consegui baixar este livro agora. Verifique a conexão.', pct: null, error: true }); return; }
      setBusy(null);
    }
    router.push(`/read/${encodeURIComponent(b.id)}`);
  };

  const openSample = async (id: string) => {
    const s = SAMPLE_BOOKS.find((x) => x.id === id)!;
    const repo = await getRepo();
    await repo.addBook({ id: s.id, title: s.title, kind: 'builtin', sub: s.sub, emoji: s.emoji });
    router.push(`/read/${encodeURIComponent(id)}`);
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

  const remove = (b: BookMeta) =>
    Alert.alert('Remover da biblioteca?', `“${b.title}” e o progresso serão apagados deste aparelho e da nuvem.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await (await getRepo()).deleteBook(b.id); void deleteRemote(b.id); syncSoon(); void load(); } },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.ov }}>
      <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 36 }]}>
        <Text style={[st.h1, { color: c.fg }]}>Biblioteca</Text>
        <Text style={[st.lead, { color: c.mut }]}>
          {aiAvailable()
            ? 'A IA lê cada cena e escolhe o ambiente e os sons que acontecem nela: passos, lareira, café, floresta…'
            : 'Um ambiente sonoro suave acompanha a cena que você está lendo.'}
        </Text>

        {mine.length > 0 && <SectionTitle>Meus livros</SectionTitle>}
        {mine.map((b) => (
          <BookCard
            key={b.id}
            emoji={b.emoji}
            title={b.title}
            sub={subOf(b, b.sub)}
            pct={pctOf(b)}
            onPress={() => void open(b)}
            onLongPress={() => remove(b)}
            right={<RoundButton label="✕" accessibilityLabel={`Remover ${b.title}`} onPress={() => remove(b)} />}
          />
        ))}

        <SectionTitle>Adicionar</SectionTitle>
        <BookCard emoji="📚" title="Abrir PDF ou EPUB" sub="Um livro do seu aparelho" onPress={() => void importBook()} />
        <BookCard emoji="✍️" title="Colar meu texto" sub="Qualquer história ou capítulo" onPress={() => router.push('/paste')} />

        <SectionTitle>Histórias</SectionTitle>
        {SAMPLE_BOOKS.map((s) => {
          const m = byId.get(s.id);
          return (
            <BookCard key={s.id} emoji={s.emoji} tint={TINT[s.mood] + '44'} title={s.title}
              sub={subOf(m, `${s.sub} · ${s.pages.length} páginas`)} pct={pctOf(m)} onPress={() => void openSample(s.id)} />
          );
        })}
      </ScrollView>

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
  wrap: { paddingHorizontal: 20, gap: 12, alignItems: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 40, lineHeight: 48 },
  h2: { fontFamily: FONTS.serifMedium, fontSize: 28 },
  lead: { fontFamily: FONTS.ui, fontSize: 16.5, lineHeight: 25, textAlign: 'center', maxWidth: 440 },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 30 },
});

