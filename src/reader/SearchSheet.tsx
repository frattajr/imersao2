/** Busca no livro: digite e toque num resultado para ir até ele. */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { searchBook } from '../core/annotations';
import { norm } from '../core/text';
import { FONTS, usePrefs } from '../ui/prefs';
import { Sheet } from './Sheet';

export function SearchSheet({ visible, onClose, pages, onPick, chapterLabel }: {
  visible: boolean; onClose: () => void; pages: string[];
  onPick: (page: number, at: number, len: number) => void; chapterLabel: (page: number) => string;
}) {
  const { c } = usePrefs();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t); }, [q]);
  const results = useMemo(() => searchBook(pages, debounced, 200, norm), [pages, debounced]);
  return (
    <Sheet visible={visible} title="Buscar no livro" onClose={onClose}>
      <TextInput value={q} onChangeText={setQ} placeholder="Palavra ou trecho" placeholderTextColor={c.mut} autoFocus autoCorrect={false}
        returnKeyType="search" style={[st.input, { color: c.fg, backgroundColor: c.card }]} accessibilityLabel="Buscar no livro" />
      {debounced.trim().length >= 2 && (
        <Text style={[st.meta, { color: c.mut }]}>{results.length >= 200 ? '200+ resultados' : `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`}</Text>
      )}
      {results.map((r, i) => (
        <Pressable key={`${r.page}-${r.at}-${i}`} onPress={() => { onPick(r.page, r.at, r.match.length); onClose(); }}
          style={[st.row, { backgroundColor: c.card }]} accessibilityRole="button">
          <Text style={[st.text, { color: c.fg }]}>
            {r.before}<Text style={[st.match, { color: c.fg }]}>{r.match}</Text>{r.after}
          </Text>
          <Text style={[st.meta, { color: c.mut }]}>{chapterLabel(r.page)} · {Math.round(((r.page + 1) / pages.length) * 100)}%</Text>
        </Pressable>
      ))}
    </Sheet>
  );
}

const st = StyleSheet.create({
  input: { fontFamily: FONTS.ui, fontSize: 16, minHeight: 48, borderRadius: 14, paddingHorizontal: 14 },
  row: { borderRadius: 14, padding: 12, gap: 4 },
  text: { fontFamily: FONTS.serif, fontSize: 15, lineHeight: 22 },
  match: { fontFamily: FONTS.serifMedium, backgroundColor: 'rgba(255, 214, 10, 0.4)' },
  meta: { fontFamily: FONTS.ui, fontSize: 12.5 },
});
