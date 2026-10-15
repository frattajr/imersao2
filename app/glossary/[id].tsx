import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { norm } from '../../src/core/text';
import { readSoFar, removeEntry, sortEntries, upsertEntry } from '../../src/core/glossary';
import type { GlossaryEntry } from '../../src/core/types';
import { AiError, aiAvailable, fetchGlossary } from '../../src/services/ai';
import { syncSoon } from '../../src/services/sync';
import { getRepo } from '../../src/state/db';
import { RoundButton } from '../../src/ui/components';
import { FONTS, usePrefs } from '../../src/ui/prefs';

export default function Glossary() {
  const params = useLocalSearchParams<{ id: string; at?: string; focus?: string }>();
  const id = decodeURIComponent(String(params.id));
  const at = Number(params.at ?? 0);
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [list, setList] = useState<GlossaryEntry[]>([]);
  const [term, setTerm] = useState('');
  const [desc, setDesc] = useState('');
  const [aiLabel, setAiLabel] = useState('✦ Gerar do que li até aqui');
  const [aiBusy, setAiBusy] = useState(false);
  const listRef = useRef<FlatList<GlossaryEntry>>(null);

  useEffect(() => {
    void (async () => {
      const repo = await getRepo();
      setTitle((await repo.getBook(id))?.title ?? '');
      setList(await repo.getGloss(id));
    })();
  }, [id]);

  const save = async (next: GlossaryEntry[]) => {
    setList(next);
    await (await getRepo()).setGloss(id, next);
    syncSoon();
  };

  const sorted = sortEntries(list);
  const focusIndex = params.focus ? sorted.findIndex((g) => norm(g.term) === norm(params.focus!)) : -1;

  useEffect(() => {
    if (focusIndex > 0) setTimeout(() => listRef.current?.scrollToIndex({ index: focusIndex, viewPosition: 0.3 }), 300);
  }, [focusIndex]);

  const generate = async () => {
    setAiBusy(true);
    setAiLabel('Lendo e anotando…');
    try {
      const repo = await getRepo();
      const pages = (await repo.getPages(id)) ?? [];
      const entries = await fetchGlossary(title, readSoFar(pages, at), list.map((g) => g.term));
      let next = list, added = 0;
      for (const e of entries) {
        const before = next.length;
        next = upsertEntry(next, e.term, e.desc);
        if (next.length > before) added++;
      }
      await save(next);
      setAiLabel(added ? `✦ ${added} novas entradas` : 'Nada novo por enquanto');
    } catch (e) {
      setAiLabel(e instanceof AiError && e.code === 'limit' ? 'Limite de hoje atingido' : 'Não consegui gerar agora');
    }
    setTimeout(() => { setAiBusy(false); setAiLabel('✦ Gerar do que li até aqui'); }, 2500);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.ov }}>
      <FlatList
        ref={listRef}
        data={sorted}
        keyExtractor={(g) => g.term}
        onScrollToIndexFailed={() => {}}
        contentContainerStyle={[st.wrap, { paddingTop: insets.top + 24, paddingBottom: 20 }]}
        ListHeaderComponent={
          <View style={{ alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Text style={[st.h1, { color: c.fg }]}>Glossário</Text>
            <Text style={[st.lead, { color: c.mut }]}>{title} · {list.length} {list.length === 1 ? 'entrada' : 'entradas'}</Text>
            {aiAvailable() && <RoundButton label={aiLabel} onPress={() => void generate()} disabled={aiBusy} />}
          </View>
        }
        ListEmptyComponent={
          <Text style={[st.lead, { color: c.mut, marginTop: 8 }]}>
            Nada por aqui ainda. Adicione termos abaixo{aiAvailable() ? ' ou peça para a IA montar a partir do que você já leu.' : '.'}
          </Text>
        }
        renderItem={({ item, index }) => (
          <View style={[st.item, { backgroundColor: c.card, borderColor: index === focusIndex ? c.mut : 'transparent' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[st.term, { color: c.fg }]}>{item.term}</Text>
              {item.desc ? <Text style={[st.desc, { color: c.mut }]}>{item.desc}</Text> : null}
            </View>
            <RoundButton label="✕" accessibilityLabel={`Remover ${item.term}`} style={{ height: 36, minWidth: 36, paddingHorizontal: 0 }}
              onPress={() => void save(removeEntry(list, item.term))} />
          </View>
        )}
      />
      <View style={[st.form, { paddingBottom: insets.bottom + 14, borderTopColor: c.btn }]}>
        <TextInput value={term} onChangeText={setTerm} placeholder="Termo ou personagem" placeholderTextColor={c.mut}
          style={[st.input, { color: c.fg, backgroundColor: c.card, borderColor: c.btn }]} />
        <TextInput value={desc} onChangeText={setDesc} placeholder="Descrição curta" placeholderTextColor={c.mut}
          style={[st.input, { color: c.fg, backgroundColor: c.card, borderColor: c.btn }]} />
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
          <RoundButton label="Adicionar" onPress={() => { if (term.trim()) { void save(upsertEntry(list, term, desc)); setTerm(''); setDesc(''); } }} />
          <RoundButton big label="Voltar à leitura" onPress={() => router.back()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 30 },
  lead: { fontFamily: FONTS.ui, fontSize: 15, textAlign: 'center' },
  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 16, borderWidth: 2 },
  term: { fontFamily: FONTS.serifMedium, fontSize: 17 },
  desc: { fontFamily: FONTS.ui, fontSize: 15, lineHeight: 21, marginTop: 2 },
  form: { gap: 8, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1, maxWidth: 560, width: '100%', alignSelf: 'center' },
  input: { height: 46, borderRadius: 14, borderWidth: 2, paddingHorizontal: 14, fontFamily: FONTS.ui, fontSize: 16 },
});
