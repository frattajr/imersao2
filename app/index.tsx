/**
 * Biblioteca no estilo das plataformas de streaming, feita para descobrir
 * leituras com som:
 *
 * - destaque no topo; sequência de dias e meta diária;
 * - fileiras pessoais (continuar lendo, Quero ler, Para você, "porque você
 *   leu…") e editoriais (coleção do mês, clássicos brasileiros e
 *   portugueses, som calibrado, leituras curtas, vestibular, climas);
 * - capas com selos (som calibrado, duração no ritmo da pessoa, baixado);
 * - ficha com prévia do som; busca única com filtros (🔍);
 * - só aparecem livros que abrem agora, fileiras com pelo menos 3 livros.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CLIMATES, dayKey, forYou, minutesToRead, recommend, streakOf } from '../src/core/catalog';
import { monthlyCollection, VESTIBULAR } from '../src/data/collections';
import { pickAndImport } from '../src/services/importer';
import {
  BookSheet, BusyModal, pctOf, Poster, TastesModal, useBookActions, useLibrary, type Item,
} from '../src/ui/library';
import { Cover } from '../src/ui/Cover';
import { ProgressBar, RoundButton } from '../src/ui/components';
import { FONTS, usePrefs } from '../src/ui/prefs';

type Shelf = 'Todos' | 'Quero ler' | 'Brasil' | 'Portugal' | 'Curtos' | 'Meus livros';
const SHELVES: Shelf[] = ['Todos', 'Quero ler', 'Brasil', 'Portugal', 'Curtos', 'Meus livros'];
/** fileira editorial só aparece com pelo menos isso */
const MIN_ROW = 3;

export default function Library() {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const lib = useLibrary();
  const { busy, setBusy, read, glossary, remove } = useBookActions(lib.reload);
  const [shelf, setShelf] = useState<Shelf>('Todos');
  const [detail, setDetail] = useState<Item | null>(null);

  const { wpm, catalog, everything, mine, samples, acervo, literature, wish } = lib;
  const byItemId = useMemo(() => new Map(everything.map((i) => [i.id, i])), [everything]);
  const wishItems = useMemo(() => wish.map((id) => byItemId.get(id)).filter((x): x is Item => !!x), [wish, byItemId]);
  const reading = useMemo(() => everything.filter((i) => i.meta && !i.meta.done && pctOf(i.meta) > 0)
    .sort((a, b) => (b.meta!.updatedAt ?? 0) - (a.meta!.updatedAt ?? 0)), [everything]);
  const finished = useMemo(() => everything.filter((i) => i.meta?.done), [everything]);
  const isShort = (i: Item) => !!i.words && minutesToRead(i.words, wpm) <= 15;

  /* recomendações: pelo que leu (ou está lendo) e pelos gostos */
  const seeds = useMemo(() => [...reading.slice(0, 3), ...finished.slice(0, 3), ...wishItems.slice(0, 3)], [reading, finished, wishItems]);
  const exclude = useMemo(() => new Set([...seeds.map((s) => s.id), ...finished.map((f) => f.id)]), [seeds, finished]);
  const forMe = useMemo(() => forYou(catalog, lib.tastes?.themes ?? [], seeds, exclude) as Item[], [catalog, lib.tastes, seeds, exclude]);
  const because = useMemo(() => {
    const ref = finished[0] ?? reading[0];
    return ref ? { ref, items: recommend(catalog, [ref], new Set([ref.id, ...exclude])) as Item[] } : null;
  }, [finished, reading, catalog, exclude]);

  /* fileiras editoriais */
  const month = monthlyCollection();
  const pick = (ids: string[]) => ids.map((id) => byItemId.get(id)).filter((x): x is Item => !!x && x.openable);
  const monthItems = useMemo(() => pick(month.ids), [byItemId]); // eslint-disable-line react-hooks/exhaustive-deps
  const vestItems = useMemo(() => pick(VESTIBULAR.ids), [byItemId]); // eslint-disable-line react-hooks/exhaustive-deps
  const calibrated = samples.filter((s) => s.calibrated);
  const tryouts = samples.filter((s) => !s.calibrated);
  // curtos que não são os contos de teste; os sem som calibrado primeiro (os calibrados já têm fileira)
  const shorts = useMemo(() => catalog.filter((i) => isShort(i) && !tryouts.includes(i))
    .sort((a, b) => Number(a.calibrated) - Number(b.calibrated)), [catalog, tryouts, wpm]); // eslint-disable-line react-hooks/exhaustive-deps

  /* destaque: o que está lendo; senão o primeiro da coleção do mês com som calibrado */
  const hero = reading[0] ?? monthItems.find((i) => i.calibrated) ?? calibrated[0] ?? catalog[0];

  /* meta diária e sequência */
  const today = lib.days[dayKey(new Date())] ?? 0;
  const streak = streakOf(lib.days, new Date());

  const importBook = async () => {
    try {
      const meta = await pickAndImport((msg, pct) => setBusy({ msg, pct }));
      setBusy(null);
      if (meta) router.push(`/read/${encodeURIComponent(meta.id)}`);
    } catch (e) {
      setBusy({ msg: e instanceof Error ? e.message : 'Não foi possível abrir o arquivo.', pct: null, error: true });
    }
  };

  const posterW = Math.min(150, Math.max(112, (width - 32) / 3.2));
  const wide = Math.min(width, 900);

  const Row = ({ title, sub, items, lead, min = MIN_ROW, more }: { title: string; sub?: string; items: Item[]; lead?: React.ReactNode; min?: number; more?: React.ReactNode }) =>
    items.length >= min || lead ? (
      <View style={{ gap: 8 }}>
        <View style={{ paddingHorizontal: 16, gap: 2 }}>
          <Text style={[st.rowTitle, { color: c.fg }]}>{title}</Text>
          {sub ? <Text style={[st.rowSub, { color: c.mut }]}>{sub}</Text> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.rowList}>
          {lead}
          {items.map((it) => <Poster key={it.id} it={it} w={posterW} wpm={wpm} onPress={setDetail} />)}
          {more}
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
  const SeeAll = (
    <Pressable onPress={() => router.push('/search')} accessibilityRole="button" style={[st.add, { width: posterW, height: posterW * 1.5, borderColor: c.btn }]}>
      <Text style={{ fontSize: 30 }}>🔎</Text>
      <Text style={[st.addText, { color: c.fg }]}>Buscar em todos os clássicos</Text>
    </Pressable>
  );

  const grid: Item[] = shelf === 'Quero ler' ? wishItems
    : shelf === 'Brasil' ? catalog.filter((i) => i.origin === 'BR')
    : shelf === 'Portugal' ? catalog.filter((i) => i.origin === 'PT')
    : shelf === 'Curtos' ? catalog.filter(isShort)
    : shelf === 'Meus livros' ? mine : [];

  const related = useMemo(() => (detail ? recommend(catalog, [detail], new Set([detail.id]), 8) as Item[] : []), [detail, catalog]);

  return (
    <View style={{ flex: 1, backgroundColor: c.ov }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* destaque */}
        {hero && (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <View style={{ width: wide, height: Math.min(500, wide * 1.1) }}>
              <Cover id={hero.id} title={hero.title} emoji={hero.emoji} mood={hero.mood} width={wide} aspect={Math.min(500, wide * 1.1) / wide} showTitle={false} />
              <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', 'transparent', c.ov]} locations={[0, 0.22, 0.45, 1]} style={StyleSheet.absoluteFill} />
              <View style={[st.top, { paddingTop: insets.top + 12 }]}>
                <Text style={st.brand}>Imersão</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <RoundButton label="🔍" accessibilityLabel="Buscar livros" onPress={() => router.push('/search')} style={st.gear} />
                  <RoundButton label="⚙" accessibilityLabel="Configurações" onPress={() => router.push('/settings')} style={st.gear} />
                </View>
              </View>
              <View style={st.heroText}>
                <Text style={st.heroKicker}>{reading[0] ? 'CONTINUAR LENDO' : hero.calibrated ? 'EM DESTAQUE · 🎧 SOM CALIBRADO' : 'EM DESTAQUE'}</Text>
                <Text style={st.heroTitle} numberOfLines={2}>{hero.title}</Text>
                <Text style={st.heroSyn} numberOfLines={3}>{hero.synopsis}</Text>
                <View style={st.heroBtns}>
                  <Pressable onPress={() => read(hero)} accessibilityRole="button" style={({ pressed }) => [st.play, { opacity: pressed ? 0.85 : 1 }]}>
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
          {/* meta diária e sequência de dias */}
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button"
            accessibilityLabel={`${streak} dias seguidos de leitura; hoje ${Math.round(today)} de ${lib.goal} minutos`}
            style={[st.goal, { backgroundColor: c.card }]}>
            <Text style={[st.goalTitle, { color: c.fg }]}>
              {streak > 0 ? `🔥 ${streak} ${streak === 1 ? 'dia' : 'dias'} seguidos` : '📖 Comece uma sequência hoje'}
            </Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[st.goalSub, { color: c.mut }]}>Hoje: {Math.round(today)} de {lib.goal} min</Text>
              <ProgressBar pct={Math.min(100, (today / lib.goal) * 100)} height={4} />
            </View>
          </Pressable>

          {/* estantes */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
            {SHELVES.map((g) => (
              <Pressable key={g} onPress={() => setShelf(g)} accessibilityRole="button" accessibilityState={{ selected: shelf === g }}
                style={[st.chip, { backgroundColor: shelf === g ? c.fg : c.btn }]}>
                <Text style={[st.chipText, { color: shelf === g ? c.bg : c.fg }]}>{g}{g === 'Quero ler' && wish.length ? ` (${wish.length})` : ''}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {shelf === 'Todos' ? (
            <>
              <Row title="Continuar lendo" items={reading} min={1} />
              {mine.length > 0 && <Row title="Meus livros" items={mine} lead={AddCards} />}
              <Row title="Quero ler" items={wishItems} min={1} />
              <Row title="Para você" sub="Pelos seus gostos e pelo que você leu" items={forMe} />
              {because && <Row title={`Porque você leu “${because.ref.title}”`} items={because.items} />}
              <Row title={month.title} sub={month.subtitle} items={monthItems} />
              <Row title="🇧🇷 Clássicos brasileiros" sub="Texto revisado e na grafia atual" items={acervo.filter((i) => i.origin === 'BR')} />
              <Row title="🎧 Com som calibrado" sub="Cada cena com a mixagem ajustada à mão" items={calibrated} min={1} />
              <Row title="⏱ Leituras de até 15 minutos" sub="No seu ritmo de leitura" items={shorts} />
              <Row title={VESTIBULAR.title} sub={VESTIBULAR.subtitle} items={vestItems} />
              <Row title="🇵🇹 Clássicos portugueses" items={acervo.filter((i) => i.origin === 'PT')} />
              {CLIMATES.map((cl) => (
                <Row key={cl.key} title={cl.row} items={catalog.filter((i) => i.layers.some((L) => cl.layers.includes(L)))} />
              ))}
              <Row title="✨ Experimente o som em 1 minuto" sub="Contos curtos escritos para o app" items={tryouts} />
              <Row title="📜 Mais clássicos em domínio público" items={literature.slice(0, 20)} more={SeeAll} />
              {lib.gutState === 'loading' && <Text style={[st.note, { color: c.mut }]}>Carregando mais clássicos…</Text>}
              {lib.gutState === 'error' && (
                <View style={{ paddingHorizontal: 16, gap: 8, alignItems: 'flex-start' }}>
                  <Text style={[st.note, { color: c.mut, paddingHorizontal: 0 }]}>Não consegui carregar mais clássicos agora.</Text>
                  <RoundButton label="↻ Tentar de novo" onPress={lib.loadGut} />
                </View>
              )}
              <Row title="✓ Lidos" items={finished} min={1} />
              {mine.length === 0 && <Row title="Meus livros" items={[]} lead={AddCards} />}
            </>
          ) : (
            <View style={st.grid}>
              {shelf === 'Meus livros' && AddCards}
              {grid.map((it) => <Poster key={it.id} it={it} w={posterW} wpm={wpm} onPress={setDetail} />)}
              {!grid.length && shelf !== 'Meus livros' && (
                <Text style={[st.empty, { color: c.mut }]}>
                  {shelf === 'Quero ler' ? 'Toque em “＋ Quero ler” na ficha de um livro para guardar aqui.' : 'Nenhum livro aqui ainda.'}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <BookSheet item={detail} wpm={wpm} wished={!!detail && wish.includes(detail.id)} related={related}
        onClose={() => setDetail(null)}
        onRead={(it) => { setDetail(null); read(it); }}
        onGlossary={(it) => { setDetail(null); void glossary(it); }}
        onRemove={(it) => remove(it, () => setDetail(null))}
        onWish={(it) => void lib.flipWish(it.id)}
        onPick={setDetail} />
      <TastesModal visible={!!lib.tastes && !lib.tastes.asked && !detail && !busy} onDone={(t) => void lib.saveTastes(t)} />
      <BusyModal busy={busy} onClose={() => setBusy(null)} />
    </View>
  );
}

const st = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  brand: { fontFamily: FONTS.serifMedium, fontSize: 26, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  gear: { backgroundColor: 'rgba(0,0,0,0.35)' },
  heroText: { position: 'absolute', left: 16, right: 16, bottom: 20, gap: 8 },
  heroKicker: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1.5, color: 'rgba(255,255,255,0.85)' },
  heroTitle: { fontFamily: FONTS.serifMedium, fontSize: 36, lineHeight: 42, color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 10 },
  heroSyn: { fontFamily: FONTS.ui, fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.9)', maxWidth: 520, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  heroBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  play: { backgroundColor: '#fff', height: 46, paddingHorizontal: 22, borderRadius: 8, justifyContent: 'center' },
  playText: { fontFamily: FONTS.uiBold, fontSize: 16, color: '#111' },
  info: { backgroundColor: 'rgba(255,255,255,0.22)', height: 46, paddingHorizontal: 18, borderRadius: 8, justifyContent: 'center' },
  infoText: { fontFamily: FONTS.uiBold, fontSize: 16, color: '#fff' },
  body: { width: '100%', alignSelf: 'center', gap: 22, paddingTop: 14 },
  goal: { marginHorizontal: 16, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  goalTitle: { fontFamily: FONTS.uiBold, fontSize: 15 },
  goalSub: { fontFamily: FONTS.ui, fontSize: 13 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: { minHeight: 36, paddingHorizontal: 16, borderRadius: 99, justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiBold, fontSize: 14 },
  note: { fontFamily: FONTS.ui, fontSize: 14, paddingHorizontal: 16 },
  rowTitle: { fontFamily: FONTS.uiBold, fontSize: 18 },
  rowSub: { fontFamily: FONTS.ui, fontSize: 13 },
  rowList: { gap: 10, paddingHorizontal: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  empty: { fontFamily: FONTS.ui, fontSize: 15, lineHeight: 22 },
  add: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 },
  addText: { fontFamily: FONTS.uiBold, fontSize: 13.5, textAlign: 'center' },
});
