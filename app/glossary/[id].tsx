import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { norm } from '../../src/core/text';
import { chapterAt, detectChapters, properNouns, type Chapter } from '../../src/core/chapters';
import { entriesIn, readSoFar, removeEntry, sortEntries, upsertEntry } from '../../src/core/glossary';
import type { GlossaryEntry } from '../../src/core/types';
import { AiError, aiAvailable, fetchGlossary } from '../../src/services/ai';
import { syncSoon } from '../../src/services/sync';
import { getRepo } from '../../src/state/db';
import { requestJump } from '../../src/state/jump';
import { IconButton, RoundButton } from '../../src/ui/components';
import { FONTS, usePrefs } from '../../src/ui/prefs';

export default function Glossary() {
  const params = useLocalSearchParams<{ id: string; at?: string; focus?: string; from?: string }>();
  const id = decodeURIComponent(String(params.id));
  const at = Number(params.at ?? 0);
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [list, setList] = useState<GlossaryEntry[]>([]);
  const [term, setTerm] = useState('');
  const [desc, setDesc] = useState('');
  const [aiLabel, setAiLabel] = useState('Gerar do que li até aqui');
  const [aiBusy, setAiBusy] = useState(false);
  const listRef = useRef<FlatList<GlossaryEntry>>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  /** capítulo escolhido (-1 = livro todo) */
  const [ch, setCh] = useState(-1);

  useEffect(() => {
    void (async () => {
      const repo = await getRepo();
      setTitle((await repo.getBook(id))?.title ?? '');
      setList(await repo.getGloss(id));
      const p = (await repo.getPages(id)) ?? [];
      const chs = detectChapters(p);
      setPages(p);
      setChapters(chs);
      if (chs.length > 1) setCh(chapterAt(chs, at)); // abre no capítulo que a pessoa está lendo
    })();
  }, [id, at]);

  const chapter = ch >= 0 ? chapters[ch] : null;
  const chapterText = useMemo(() => (chapter ? pages.slice(chapter.start, chapter.end).join('\n') : ''), [chapter, pages]);
  /** só sugere e gera a partir do que já foi lido (sem spoiler) */
  const chapterRead = !!chapter && chapter.start <= at;
  const suggestions = useMemo(() => {
    if (!chapter || !chapterRead) return [];
    const known = new Set(list.map((g) => norm(g.term)));
    const text = pages.slice(chapter.start, Math.min(chapter.end, at + 1)).join('\n');
    return properNouns(text, 10).filter((n) => !known.has(norm(n))).slice(0, 8);
  }, [chapter, chapterRead, list, pages, at]);

  const save = async (next: GlossaryEntry[]) => {
    setList(next);
    await (await getRepo()).setGloss(id, next);
    syncSoon();
  };

  /** vindo do leitor: volta já no capítulo; vindo da biblioteca: abre o leitor nele */
  const readChapter = async (page: number) => {
    if (params.from === 'reader') { requestJump(id, page); router.back(); return; }
    await (await getRepo()).saveProgress(id, page, false);
    router.replace(`/read/${encodeURIComponent(id)}`);
  };

  const sorted = chapter ? entriesIn(list, chapterText) : sortEntries(list);
  const focusIndex = params.focus ? sorted.findIndex((g) => norm(g.term) === norm(params.focus!)) : -1;

  useEffect(() => {
    if (focusIndex > 0) setTimeout(() => listRef.current?.scrollToIndex({ index: focusIndex, viewPosition: 0.3 }), 300);
  }, [focusIndex]);

  const generate = async () => {
    setAiBusy(true);
    setAiLabel('Lendo e anotando…');
    try {
      // capítulo escolhido: só o trecho dele que já foi lido; senão, tudo o que foi lido até aqui
      const text = chapter ? pages.slice(chapter.start, Math.min(chapter.end, at + 1)).join('\n') : readSoFar(pages, at);
      const entries = await fetchGlossary(title, text, list.map((g) => g.term));
      let next = list, added = 0;
      for (const e of entries) {
        const before = next.length;
        next = upsertEntry(next, e.term, e.desc);
        if (next.length > before) added++;
      }
      await save(next);
      setAiLabel(added ? `${added} novas entradas` : 'Nada novo por enquanto');
    } catch (e) {
      setAiLabel(e instanceof AiError && e.code === 'limit' ? 'Limite de hoje atingido' : 'Não consegui gerar agora');
    }
    setTimeout(() => { setAiBusy(false); setAiLabel('Gerar do que li até aqui'); }, 2500);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
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
            {chapters.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chs} style={{ alignSelf: 'stretch' }}>
                {[{ title: 'Livro todo', start: 0, end: 0 }, ...chapters].map((chp, k) => {
                  const i = k - 1;
                  const on = i === ch;
                  const unread = i >= 0 && chp.start > at;
                  return (
                    <Pressable key={k} onPress={() => setCh(i)} accessibilityRole="button" accessibilityState={{ selected: on }}
                      style={[st.chChip, { backgroundColor: on ? c.accentSoft : 'transparent', borderColor: on ? c.accent : c.line, opacity: unread && !on ? 0.6 : 1 }]}>
                      <Text style={[st.chText, { color: on ? c.accent : c.fg }]} numberOfLines={1}>{unread ? '○ ' : ''}{chp.title}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {chapter && (
              <View style={[st.chBox, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Text style={[st.chTitle, { color: c.fg }]}>{chapter.title}</Text>
                <Text style={[st.small, { color: c.mut }]}>
                  Páginas {chapter.start + 1}–{chapter.end} · {chapterRead ? (at >= chapter.end - 1 ? 'lido' : 'lendo agora') : 'ainda não lido'}
                </Text>
                <View style={st.row}>
                  <RoundButton icon="play" label="Ler este capítulo" onPress={() => void readChapter(chapter.start)} />
                </View>
                {suggestions.length > 0 && (
                  <>
                    <Text style={[st.small, { color: c.mut }]}>Personagens e lugares deste capítulo — toque para adicionar:</Text>
                    <View style={st.row}>
                      {suggestions.map((n) => (
                        <Pressable key={n} onPress={() => void save(upsertEntry(list, n, ''))} accessibilityRole="button" accessibilityLabel={`Adicionar ${n}`}
                          style={[st.chChip, { backgroundColor: c.btn, borderColor: 'transparent' }]}>
                          <Text style={[st.chText, { color: c.fg }]}>+ {n}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
                {!chapterRead && <Text style={[st.small, { color: c.mut }]}>Sem sugestões para não estragar a surpresa: leia até aqui primeiro.</Text>}
              </View>
            )}
            {aiAvailable() && (!chapter || chapterRead) && (
              <RoundButton icon="sparkle" label={chapter && aiLabel.startsWith('Gerar do') ? 'Gerar deste capítulo' : aiLabel} onPress={() => void generate()} disabled={aiBusy} />
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={[st.lead, { color: c.mut, marginTop: 8 }]}>
            {chapter ? 'Nenhum termo do glossário aparece neste capítulo ainda. ' : 'Nada por aqui ainda. '}Adicione termos abaixo{aiAvailable() ? ' ou peça para a IA montar a partir do que você já leu.' : '.'}
          </Text>
        }
        renderItem={({ item, index }) => (
          <View style={[st.item, { backgroundColor: c.surface, borderColor: index === focusIndex ? c.accent : c.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[st.term, { color: c.fg }]}>{item.term}</Text>
              {item.desc ? <Text style={[st.desc, { color: c.mut }]}>{item.desc}</Text> : null}
            </View>
            <IconButton icon="close" label={`Remover ${item.term}`} size={16} onPress={() => void save(removeEntry(list, item.term))} />
          </View>
        )}
      />
      <View style={[st.form, { paddingBottom: insets.bottom + 14, borderTopColor: c.line, backgroundColor: c.bg }]}>
        <TextInput value={term} onChangeText={setTerm} placeholder="Termo ou personagem" placeholderTextColor={c.mut}
          style={[st.input, { color: c.fg, backgroundColor: c.surface, borderColor: c.line }]} accessibilityLabel="Termo ou personagem" />
        <TextInput value={desc} onChangeText={setDesc} placeholder="Descrição curta" placeholderTextColor={c.mut}
          style={[st.input, { color: c.fg, backgroundColor: c.surface, borderColor: c.line }]} accessibilityLabel="Descrição curta" />
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
          <RoundButton icon="plus" label="Adicionar" onPress={() => { if (term.trim()) { void save(upsertEntry(list, term, desc)); setTerm(''); setDesc(''); } }} />
          <RoundButton big label="Voltar à leitura" onPress={() => router.back()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 27 },
  lead: { fontFamily: FONTS.ui, fontSize: 15, textAlign: 'center' },
  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 16, borderWidth: 1 },
  term: { fontFamily: FONTS.serifMedium, fontSize: 17 },
  desc: { fontFamily: FONTS.ui, fontSize: 15, lineHeight: 21, marginTop: 2 },
  chs: { gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  chChip: { minHeight: 34, maxWidth: 260, paddingHorizontal: 14, borderRadius: 99, justifyContent: 'center', borderWidth: 1 },
  chText: { fontFamily: FONTS.uiBold, fontSize: 14 },
  chBox: { alignSelf: 'stretch', borderRadius: 16, padding: 14, gap: 8, borderWidth: 1 },
  chTitle: { fontFamily: FONTS.serifMedium, fontSize: 18 },
  small: { fontFamily: FONTS.ui, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  form: { gap: 8, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1, maxWidth: 560, width: '100%', alignSelf: 'center' },
  input: { height: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontFamily: FONTS.ui, fontSize: 16 },
});
