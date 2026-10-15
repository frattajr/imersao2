/**
 * Busca única da biblioteca: acervo curado, contos sonorizados, clássicos
 * em domínio público e os livros da pessoa, sem acento e também pela grafia
 * antiga. Filtros por duração (no ritmo da pessoa), origem, época e clima
 * sonoro. Só mostra o que abre agora.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CLIMATES, DURATIONS, ERAS, recommend, searchCatalog, type Filters } from '../src/core/catalog';
import { BookSheet, BusyModal, Poster, useBookActions, useLibrary, type Item } from '../src/ui/library';
import { Icon } from '../src/ui/Icon';
import { IconButton, RoundButton } from '../src/ui/components';
import { FONTS, usePrefs } from '../src/ui/prefs';

const PAGE = 48;

function ChipRow<T extends string>({ label, value, options, onChange }: {
  label: string; value: T | undefined; options: { key: T; label: string }[]; onChange: (v: T | undefined) => void;
}) {
  const { c } = usePrefs();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[st.fLabel, { color: c.mut }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
        {options.map((o) => {
          const on = value === o.key;
          return (
            <Pressable key={o.key} onPress={() => onChange(on ? undefined : o.key)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={[st.chip, { backgroundColor: on ? c.accentSoft : 'transparent', borderColor: on ? c.accent : c.line }]}>
              <Text style={[st.chipText, { color: on ? c.accent : c.fg }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function Search() {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const lib = useLibrary({ fullGut: true });
  const { busy, setBusy, read, glossary, remove } = useBookActions(lib.reload);
  // ?d=curto (atalho da Jornada: leituras curtas para fechar o dia)
  const { d } = useLocalSearchParams<{ d?: string }>();
  const [f, setF] = useState<Filters>(() => (d ? { duration: d as Filters['duration'] } : {}));
  const [shown, setShown] = useState(PAGE);
  const [detail, setDetail] = useState<Item | null>(null);

  const results = useMemo(() => searchCatalog(lib.everything, f, lib.wpm) as Item[], [lib.everything, f, lib.wpm]);
  const related = useMemo(() => (detail ? recommend(lib.catalog, [detail], new Set([detail.id]), 8) as Item[] : []), [detail, lib.catalog]);
  const set = (p: Partial<Filters>) => { setF((cur) => ({ ...cur, ...p })); setShown(PAGE); };
  const any = !!(f.q || f.duration || f.origin || f.era || f.climate);

  const cols = width > 900 ? 6 : width > 600 ? 4 : 3;
  const w = Math.floor((Math.min(width, 1100) - 40 - (cols - 1) * 12) / cols);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={st.head}>
          <IconButton icon="back" label="Voltar" onPress={() => router.back()} />
          <Text style={[st.h1, { color: c.fg }]}>Buscar</Text>
        </View>
        <View style={[st.inputBox, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="search" size={18} color={c.mut} />
          <TextInput value={f.q ?? ''} onChangeText={(q) => set({ q })} placeholder="Título, autor ou tema"
            placeholderTextColor={c.mut} style={[st.input, { color: c.fg }]} autoCorrect={false} returnKeyType="search"
            accessibilityLabel="Buscar livros" />
          {f.q ? <IconButton icon="close" label="Apagar a busca" size={16} plain onPress={() => set({ q: '' })} /> : null}
        </View>
        <ChipRow label="DURAÇÃO NO SEU RITMO" value={f.duration} onChange={(duration) => set({ duration })}
          options={DURATIONS.map((d) => ({ key: d.key as string, label: d.label }))} />
        <ChipRow label="ORIGEM" value={f.origin} onChange={(origin) => set({ origin })}
          options={[{ key: 'BR' as const, label: 'Brasil' }, { key: 'PT' as const, label: 'Portugal' }]} />
        <ChipRow label="ÉPOCA" value={f.era} onChange={(era) => set({ era })} options={ERAS.map((e) => ({ key: e.key as string, label: e.label }))} />
        <ChipRow label="SOM DA HISTÓRIA" value={f.climate} onChange={(climate) => set({ climate })} options={CLIMATES.map((x) => ({ key: x.key, label: x.label }))} />

        <View style={st.countRow}>
          <Text style={[st.count, { color: c.mut }]}>
            {results.length.toLocaleString('pt-BR')} {results.length === 1 ? 'livro' : 'livros'}{lib.gutState === 'loading' ? ' · carregando mais clássicos…' : ''}
          </Text>
          {any ? <Text style={[st.clear, { color: c.accent }]} onPress={() => { setF({}); setShown(PAGE); }} accessibilityRole="button">Limpar filtros</Text> : null}
        </View>

        <View style={st.grid}>
          {results.slice(0, shown).map((it) => <Poster key={it.id} it={it} w={w} wpm={lib.wpm} onPress={setDetail} />)}
        </View>
        {!results.length && (
          <Text style={[st.empty, { color: c.mut }]}>
            Nada encontrado{f.duration ? '. A duração só é conhecida para os livros já preparados — tente sem esse filtro' : ''}.
          </Text>
        )}
        {results.length > shown && (
          <View style={{ alignItems: 'center' }}>
            <RoundButton label={`Mostrar mais (${(results.length - shown).toLocaleString('pt-BR')})`} onPress={() => setShown((s) => s + PAGE)} />
          </View>
        )}
        <Text style={[st.link, { color: c.mut }]} onPress={() => router.push('/catalog')} accessibilityRole="link">
          Ver o catálogo completo de clássicos em domínio público
        </Text>
      </ScrollView>

      <BookSheet item={detail} wpm={lib.wpm} wished={!!detail && lib.wish.includes(detail.id)} related={related}
        onClose={() => setDetail(null)}
        onRead={(it) => { setDetail(null); read(it); }}
        onGlossary={(it) => { setDetail(null); void glossary(it); }}
        onRemove={(it) => remove(it, () => setDetail(null))}
        onWish={(it) => void lib.flipWish(it.id)}
        onPick={setDetail} />
      <BusyModal busy={busy} onClose={() => setBusy(null)} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 16, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 27 },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderRadius: 14, paddingLeft: 14, paddingRight: 6, borderWidth: 1 },
  input: { flex: 1, fontFamily: FONTS.ui, fontSize: 16, minHeight: 48, outlineStyle: 'none' } as object,
  fLabel: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1.1 },
  chips: { gap: 8 },
  chip: { minHeight: 34, paddingHorizontal: 14, borderRadius: 99, justifyContent: 'center', borderWidth: 1 },
  chipText: { fontFamily: FONTS.uiBold, fontSize: 13.5 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  count: { fontFamily: FONTS.ui, fontSize: 13.5 },
  clear: { fontFamily: FONTS.uiBold, fontSize: 13.5 },
  link: { fontFamily: FONTS.ui, fontSize: 13.5, textAlign: 'center', textDecorationLine: 'underline', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  empty: { fontFamily: FONTS.ui, fontSize: 15, lineHeight: 22 },
});
