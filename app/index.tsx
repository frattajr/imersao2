/**
 * Biblioteca no estilo das plataformas de streaming, feita para descobrir
 * leituras com som:
 *
 * - visual limpo: cabeçalho simples, destaque num cartão, meta do dia numa
 *   linha, capas tipográficas e nenhum livro repetido entre as fileiras;
 * - destaque no topo; sequência de dias e meta diária;
 * - fileiras pessoais (continuar lendo, Quero ler, Para você, "porque você
 *   leu…") e editoriais (coleção do mês, clássicos brasileiros e
 *   portugueses, som calibrado, leituras curtas, vestibular, climas);
 * - capas com selos (som calibrado, duração no ritmo da pessoa, baixado);
 * - ficha com prévia do som; busca única com filtros (🔍);
 * - só aparecem livros que abrem agora, fileiras com pelo menos 3 livros.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CLIMATES, dayKey, forYou, minutesToRead, recommend, shelfRows, streakOf, type ShelfRow } from '../src/core/catalog';
import { monthlyCollection, VESTIBULAR } from '../src/data/collections';
import { pickAndImport } from '../src/services/importer';
import {
  BookSheet, BusyModal, pctOf, Poster, TastesModal, useBookActions, useLibrary, type Item,
} from '../src/ui/library';
import { Cover } from '../src/ui/Cover';
import { Icon } from '../src/ui/Icon';
import { IconButton, ProgressBar, RoundButton } from '../src/ui/components';
import { FONTS, usePrefs } from '../src/ui/prefs';

type Shelf = 'Todos' | 'Quero ler' | 'Brasil' | 'Portugal' | 'Curtos' | 'Meus livros';
const SHELVES: Shelf[] = ['Todos', 'Quero ler', 'Brasil', 'Portugal', 'Curtos', 'Meus livros'];
/** fileira editorial só aparece com pelo menos isso (sem contar livros que já apareceram acima) */
const MIN_ROW = 3;
/** no máximo tantas fileiras de clima (chuva, mar, noite…) */
const MAX_CLIMATE_ROWS = 2;

const greeting = (d = new Date()) => (d.getHours() < 5 ? 'Boa noite' : d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite');

interface RowSpec extends ShelfRow<Item> { title: string; sub?: string; lead?: React.ReactNode; more?: React.ReactNode }

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

  const posterW = Math.min(140, Math.max(104, (width - 32) / 3.3));

  const AddCards = (
    <>
      <Pressable onPress={() => void importBook()} accessibilityRole="button" style={[st.add, { width: posterW, height: posterW * 1.5, borderColor: c.line }]}>
        <Icon name="upload" size={26} color={c.mut} />
        <Text style={[st.addText, { color: c.fg }]}>Abrir PDF ou EPUB</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/paste')} accessibilityRole="button" style={[st.add, { width: posterW, height: posterW * 1.5, borderColor: c.line }]}>
        <Icon name="write" size={26} color={c.mut} />
        <Text style={[st.addText, { color: c.fg }]}>Colar meu texto</Text>
      </Pressable>
    </>
  );
  const SeeAll = (
    <Pressable onPress={() => router.push('/search')} accessibilityRole="button" style={[st.add, { width: posterW, height: posterW * 1.5, borderColor: c.line }]}>
      <Icon name="search" size={26} color={c.mut} />
      <Text style={[st.addText, { color: c.fg }]}>Buscar em todos os clássicos</Text>
    </Pressable>
  );

  const grid: Item[] = shelf === 'Quero ler' ? wishItems
    : shelf === 'Brasil' ? catalog.filter((i) => i.origin === 'BR')
    : shelf === 'Portugal' ? catalog.filter((i) => i.origin === 'PT')
    : shelf === 'Curtos' ? catalog.filter(isShort)
    : shelf === 'Meus livros' ? mine : [];

  const related = useMemo(() => (detail ? recommend(catalog, [detail], new Set([detail.id]), 8) as Item[] : []), [detail, catalog]);

  /* fileiras: as pessoais primeiro; nas editoriais, cada livro aparece uma vez só */
  const specs: RowSpec[] = [
    { key: 'reading', title: 'Continuar lendo', items: reading.filter((i) => i.id !== hero?.id), min: 1, personal: true },
    { key: 'wish', title: 'Quero ler', items: wishItems, min: 1, personal: true },
    ...(mine.length ? [{ key: 'mine', title: 'Meus livros', items: mine, personal: true, always: true, lead: AddCards }] : []),
    { key: 'calibrated', title: 'Com som calibrado', sub: 'Cada cena com a mixagem ajustada à mão', items: calibrated, min: 1 },
    { key: 'foryou', title: 'Para você', sub: 'Pelos seus gostos e pelo que você leu', items: forMe },
    ...(because ? [{ key: 'because', title: `Porque você leu “${because.ref.title}”`, items: because.items }] : []),
    { key: 'month', title: month.title, sub: month.subtitle, items: monthItems },
    { key: 'br', title: 'Clássicos brasileiros', sub: 'Texto revisado e na grafia atual', items: acervo.filter((i) => i.origin === 'BR') },
    { key: 'short', title: 'Leituras de até 15 minutos', sub: 'No seu ritmo de leitura', items: shorts },
    { key: 'vest', title: VESTIBULAR.title, sub: VESTIBULAR.subtitle, items: vestItems },
    { key: 'pt', title: 'Clássicos portugueses', items: acervo.filter((i) => i.origin === 'PT') },
    ...CLIMATES.map((cl) => ({ key: cl.key, title: cl.row, items: catalog.filter((i) => i.layers.some((L) => cl.layers.includes(L))), climate: true })),
    { key: 'try', title: 'Experimente o som em 1 minuto', sub: 'Contos curtos escritos para o app', items: tryouts, min: 2 },
    { key: 'more', title: 'Mais clássicos em domínio público', items: literature.slice(0, 20), more: SeeAll },
    { key: 'done', title: 'Lidos', items: finished, min: 1, personal: true },
  ];
  const rows = shelfRows(specs, { hero: hero?.id, maxClimate: MAX_CLIMATE_ROWS, min: MIN_ROW });

  const Row = ({ r }: { r: RowSpec }) => (
    <View style={{ gap: 10 }}>
      <View style={{ paddingHorizontal: 20, gap: 2 }}>
        <Text style={[st.rowTitle, { color: c.fg }]}>{r.title}</Text>
        {r.sub ? <Text style={[st.rowSub, { color: c.mut }]}>{r.sub}</Text> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.rowList}>
        {r.lead}
        {r.items.map((it) => <Poster key={it.id} it={it} w={posterW} wpm={wpm} onPress={setDetail} />)}
        {r.more}
      </ScrollView>
    </View>
  );

  const heroPct = pctOf(hero?.meta);
  const goalPct = Math.min(100, (today / lib.goal) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 48 }}>
        <View style={[st.body, { maxWidth: 1100 }]}>
          {/* cabeçalho */}
          <View style={st.top}>
            <View style={{ gap: 2 }}>
              <Text style={[st.hello, { color: c.mut }]}>{greeting()}</Text>
              <Text style={[st.brand, { color: c.fg }]}>Imersão</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton icon="search" label="Buscar livros" onPress={() => router.push('/search')} />
              <IconButton icon="settings" label="Configurações" onPress={() => router.push('/settings')} />
            </View>
          </View>

          {/* meta diária e sequência de dias, numa linha */}
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button"
            accessibilityLabel={`${streak} dias seguidos de leitura; hoje ${Math.round(today)} de ${lib.goal} minutos`}
            style={st.goal}>
            <Icon name={streak > 0 ? 'flame' : 'clock'} size={16} color={streak > 0 ? c.accent : c.mut} />
            <Text style={[st.goalText, { color: c.mut }]}>
              {streak > 0 ? `${streak} ${streak === 1 ? 'dia' : 'dias'} seguidos · ` : ''}hoje {Math.round(today)} de {lib.goal} min
            </Text>
            <View style={{ width: 64 }}><ProgressBar pct={goalPct} height={3} /></View>
          </Pressable>

          {/* destaque */}
          {hero && (
            <Pressable onPress={() => setDetail(hero)} accessibilityRole="button" accessibilityLabel={`${hero.title}: ver detalhes`}
              style={[st.hero, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Cover id={hero.id} title={hero.title} author={hero.author} mood={hero.mood} width={Math.min(120, width * 0.27)} image={hero.image} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[st.kicker, { color: c.accent }]}>{reading[0] ? 'CONTINUAR LENDO' : 'EM DESTAQUE'}</Text>
                <Text style={[st.heroTitle, { color: c.fg }]} numberOfLines={2}>{hero.title}</Text>
                {hero.calibrated && heroPct === 0 ? (
                  <View style={st.heroTag}>
                    <Icon name="headphones" size={13} color={c.mut} strokeWidth={2} />
                    <Text style={[st.heroSyn, { color: c.mut }]}>Som calibrado cena a cena</Text>
                  </View>
                ) : null}
                <Text style={[st.heroSyn, { color: c.mut }]} numberOfLines={2}>{hero.synopsis}</Text>
                {heroPct > 0 ? <View style={{ marginTop: 2 }}><ProgressBar pct={heroPct} height={3} /></View> : null}
                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                  <RoundButton big icon="play" label={heroPct > 0 ? 'Continuar' : 'Ler agora'} onPress={() => read(hero)} style={st.play} />
                </View>
              </View>
            </Pressable>
          )}

          {/* estantes */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
            {SHELVES.map((g) => {
              const on = shelf === g;
              return (
                <Pressable key={g} onPress={() => setShelf(g)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={[st.chip, { backgroundColor: on ? c.accentSoft : 'transparent', borderColor: on ? c.accent : c.line }]}>
                  <Text style={[st.chipText, { color: on ? c.accent : c.fg }]}>{g}{g === 'Quero ler' && wish.length ? ` (${wish.length})` : ''}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {shelf === 'Todos' ? (
            <>
              {rows.map((r) => <Row key={r.key} r={r} />)}
              {lib.gutState === 'loading' && <Text style={[st.note, { color: c.mut }]}>Carregando mais clássicos…</Text>}
              {lib.gutState === 'error' && (
                <View style={{ paddingHorizontal: 20, gap: 8, alignItems: 'flex-start' }}>
                  <Text style={[st.note, { color: c.mut, paddingHorizontal: 0 }]}>Não consegui carregar mais clássicos agora.</Text>
                  <RoundButton icon="retry" label="Tentar de novo" onPress={lib.loadGut} />
                </View>
              )}
              {mine.length === 0 && <Row r={{ key: 'mine0', title: 'Meus livros', sub: 'Leia seus próprios textos com som', items: [], lead: AddCards }} />}
            </>
          ) : (
            <View style={st.grid}>
              {shelf === 'Meus livros' && AddCards}
              {grid.map((it) => <Poster key={it.id} it={it} w={posterW} wpm={wpm} onPress={setDetail} />)}
              {!grid.length && shelf !== 'Meus livros' && (
                <Text style={[st.empty, { color: c.mut }]}>
                  {shelf === 'Quero ler' ? 'Toque em “Quero ler” na ficha de um livro para guardar aqui.' : 'Nenhum livro aqui ainda.'}
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
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  hello: { fontFamily: FONTS.ui, fontSize: 13.5 },
  brand: { fontFamily: FONTS.serifMedium, fontSize: 27, lineHeight: 32 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: -8 },
  goalText: { fontFamily: FONTS.ui, fontSize: 13, flexShrink: 1 },
  hero: { marginHorizontal: 16, borderRadius: 20, padding: 14, flexDirection: 'row', gap: 16, borderWidth: 1, alignItems: 'center' },
  kicker: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1.3 },
  heroTitle: { fontFamily: FONTS.serifMedium, fontSize: 22, lineHeight: 27 },
  heroSyn: { fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 19 },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  play: { height: 44, paddingHorizontal: 18 },
  body: { width: '100%', alignSelf: 'center', gap: 26 },
  chips: { gap: 8, paddingHorizontal: 20 },
  chip: { minHeight: 34, paddingHorizontal: 14, borderRadius: 99, justifyContent: 'center', borderWidth: 1 },
  chipText: { fontFamily: FONTS.uiBold, fontSize: 13.5 },
  note: { fontFamily: FONTS.ui, fontSize: 14, paddingHorizontal: 20 },
  rowTitle: { fontFamily: FONTS.serifMedium, fontSize: 19, lineHeight: 24 },
  rowSub: { fontFamily: FONTS.ui, fontSize: 13 },
  rowList: { gap: 12, paddingHorizontal: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 20 },
  empty: { fontFamily: FONTS.ui, fontSize: 15, lineHeight: 22 },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 10 },
  addText: { fontFamily: FONTS.uiBold, fontSize: 13, textAlign: 'center' },
});
