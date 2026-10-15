/**
 * Leitor imersivo.
 *
 * - Dois modos: PÁGINAS (uma por vez; toque nas laterais ou deslize) e
 *   ROLAGEM (texto contínuo; o som acompanha o parágrafo que está na tela,
 *   depois de ~0,7 s parado nele, para não trocar a cada rolada).
 * - Modo Zen: barras e botões somem após 3 s sem toque; um toque no centro
 *   da tela traz de volta. Fica sempre um indicador mínimo do capítulo com o
 *   tempo restante, calculado no ritmo de leitura da própria pessoa (WPM).
 * - X-Ray: nomes e termos do texto são tocáveis e abrem uma ficha sem spoiler.
 * - Recapitulação quando a pessoa volta depois de mais de 48 h.
 * - O som é uma matriz de mixagem (stems com ganho, low-pass e prioridade)
 *   suavizada quando a cena muda muito.
 */
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, FlatList, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View,
  type LayoutChangeEvent, type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { engine } from '../../src/audio';
import { analyze, LAYER_LABEL, SPOT_LABEL, TINT } from '../../src/core/analyze';
import { chapterAt, detectChapters } from '../../src/core/chapters';
import { readSoFar, upsertEntry } from '../../src/core/glossary';
import { DEFAULT_WPM, formatMinutes, minutesFor, recordPage, wordCount, type PaceState } from '../../src/core/pace';
import { blendAmbience, mixFromSmoothed } from '../../src/core/plan';
import { needsRecap, recapLocal, recapWindow } from '../../src/core/recap';
import { bookProfile, enrichPlan, type BookProfile } from '../../src/core/scenery';
import { SceneSmoother } from '../../src/core/smooth';
import { planDescs, spotDesc } from '../../src/core/sound';
import type { Ambience, BookMeta, GlossaryEntry, Layer, MixStem, Mood, ScenePlan } from '../../src/core/types';
import { entitiesSoFar, xrayInfo } from '../../src/core/xray';
import { bundledPlans, isPublicBook } from '../../src/data/books';
import { AudioSheet } from '../../src/reader/AudioSheet';
import { PageText, type TypeStyle } from '../../src/reader/PageText';
import { TypeSheet } from '../../src/reader/TypeSheet';
import { XraySheet } from '../../src/reader/XraySheet';
import { aiAvailable, explainTerm, fetchRecap } from '../../src/services/ai';
import { activeLibrary } from '../../src/services/sounds';
import { syncSoon } from '../../src/services/sync';
import { getRepo } from '../../src/state/db';
import { onJump } from '../../src/state/jump';
import { SceneDirector } from '../../src/state/scene';
import { ProgressBar, RoundButton } from '../../src/ui/components';
import { FONTS, LINE_HEIGHTS, MARGINS, PARA_SPACING, READING_FONTS, SIZES, usePrefs } from '../../src/ui/prefs';

const BASE_FONT = 21;
const ZEN_AFTER_MS = 3000;
/** tempo parado num parágrafo (modo rolagem) antes de o som acompanhar */
const DWELL_MS = 700;

/* ---------- Uma página (modo páginas): entra subindo, sai subindo ---------- */
function Page({ children, dir, leaving, onGone, reduceMotion, maxH, onFit }: {
  children: React.ReactNode; dir: number; leaving: boolean; onGone: () => void; reduceMotion: boolean; maxH: number; onFit: (tooBig: boolean) => void;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const gone = useRef(onGone);
  gone.current = onGone;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: reduceMotion ? 1 : 850, easing: Easing.bezier(0.22, 0.61, 0.36, 1), useNativeDriver: true }).start();
  }, [t, reduceMotion]);
  useEffect(() => {
    if (!leaving) return;
    Animated.timing(out, { toValue: 1, duration: reduceMotion ? 1 : 650, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }).start(() => gone.current());
  }, [leaving, out, reduceMotion]);
  const dy = dir >= 0 ? 34 : -34;
  const style = {
    opacity: Animated.multiply(t, Animated.subtract(1, out)),
    transform: [
      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
      { translateY: out.interpolate({ inputRange: [0, 1], outputRange: [0, -dy * 1.4] }) },
    ],
  };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.pageWrap, style]} pointerEvents={leaving ? 'none' : 'box-none'}>
      <View onLayout={(e: LayoutChangeEvent) => onFit(maxH > 0 && e.nativeEvent.layout.height > maxH)} style={{ width: '100%', alignItems: 'center' }}>
        {children}
      </View>
    </Animated.View>
  );
}

/* ---------- Leitor ---------- */
export default function Reader() {
  useKeepAwake();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(String(rawId));
  const { c, sizeI, type, layout, sound } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  const [book, setBook] = useState<BookMeta | null>(null);
  const [pages, setPages] = useState<string[] | null>(null);
  const [gloss, setGloss] = useState<GlossaryEntry[]>([]);
  const [idx, setIdx] = useState(0);
  const [layers, setLayers] = useState<{ key: number; idx: number; dir: number; leaving: boolean }[]>([]);
  const [playing, setPlaying] = useState<string[]>([]);
  const [moods, setMoods] = useState<{ a: Mood; b: Mood; showB: boolean }>({ a: 'calm', b: 'calm', showB: false });
  const [finished, setFinished] = useState(false);
  const [stageH, setStageH] = useState(0);
  const [fit, setFit] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [sheet, setSheet] = useState<'audio' | 'type' | null>(null);
  const [xray, setXray] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [recap, setRecap] = useState<{ text: string; ai: boolean } | null>(null);
  const [pace, setPace] = useState<PaceState>({ wpm: DEFAULT_WPM, samples: 0 });

  const idxRef = useRef(0);
  const keyRef = useRef(0);
  const busyRef = useRef(false);
  const prevAmb = useRef<Ambience>({});
  const played = useRef(new Set<number>());
  const director = useRef<SceneDirector | null>(null);
  const pagesRef = useRef<string[]>([]);
  const profile = useRef<BookProfile>({ looks: {}, tags: [] });
  const smoother = useRef(new SceneSmoother());
  const autoSmooth = useRef(true);
  autoSmooth.current = sound.auto;
  const audioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSince = useRef(Date.now());
  const chromeAnim = useRef(new Animated.Value(1)).current;
  const tintAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); }, []);

  /* ---------- Modo Zen: barras somem após 3 s sem toque ---------- */
  const showChrome = useCallback((v: boolean) => {
    setChrome(v);
    Animated.timing(chromeAnim, { toValue: v ? 1 : 0, duration: 260, useNativeDriver: true }).start();
  }, [chromeAnim]);
  const armZen = useCallback(() => {
    if (zenTimer.current) clearTimeout(zenTimer.current);
    zenTimer.current = setTimeout(() => showChrome(false), ZEN_AFTER_MS);
  }, [showChrome]);
  const poke = useCallback(() => { showChrome(true); armZen(); }, [showChrome, armZen]);
  useEffect(() => {
    // painel aberto: mantém as barras; fechou: volta a contar
    if (sheet || xray || recap) { if (zenTimer.current) clearTimeout(zenTimer.current); showChrome(true); } else armZen();
    return () => { if (zenTimer.current) clearTimeout(zenTimer.current); };
  }, [sheet, xray, recap, armZen, showChrome]);

  /* ---------- carrega o livro ---------- */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const repo = await getRepo();
      const [b, p, g, paceRaw, last] = await Promise.all([repo.getBook(id), repo.getPages(id), repo.getGloss(id), repo.kvGet('pace'), repo.kvGet('session:' + id)]);
      if (!alive || !b || !p?.length) { router.back(); return; }
      const start = b.done ? 0 : Math.min(b.idx, p.length - 1);
      pagesRef.current = p;
      profile.current = bookProfile(p, analyze, b.title);
      try { if (paceRaw) setPace(JSON.parse(paceRaw) as PaceState); } catch { /* ritmo corrompido: padrão */ }
      setBook(b); setPages(p); setGloss(g); setIdx(start); idxRef.current = start;
      setLayers([{ key: ++keyRef.current, idx: start, dir: 1, leaving: false }]);
      director.current = new SceneDirector(id, b.title, p, (page) => { if (page === idxRef.current) void applyAudio(page); },
        { publicBook: isPublicBook(id), bundled: bundledPlans(id) });
      // voltou depois de 48 h: "o que aconteceu até aqui?"
      if (needsRecap(last ? Number(last) : null, Date.now(), start)) {
        setRecap({ text: recapLocal(p, start - 1), ai: false });
        if (aiAvailable()) {
          fetchRecap(b.title, recapWindow(p, start - 1), isPublicBook(id))
            .then((t) => { if (alive && t) setRecap((r) => (r ? { text: t, ai: true } : r)); }).catch(() => undefined);
        }
      }
    })();
    return () => { alive = false; void getRepo().then((r) => r.kvSet('session:' + id, String(Date.now()))); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useFocusEffect(useCallback(() => { void getRepo().then((r) => r.getGloss(id)).then(setGloss); }, [id]));

  /* ---------- áudio: liga ao entrar, desliga com fade ao sair ---------- */
  useEffect(() => {
    engine.start();
    return () => {
      if (audioTimer.current) clearTimeout(audioTimer.current);
      engine.clearSpots();
      engine.setMix([]);
      engine.setDetails([]);
    };
  }, []);

  const tintTo = useCallback((m: Mood) => {
    setMoods((cur) => {
      const showing = cur.showB ? cur.b : cur.a;
      if (showing === m) return cur;
      const next = cur.showB ? { a: m, b: cur.b, showB: false } : { a: cur.a, b: m, showB: true };
      Animated.timing(tintAnim, { toValue: next.showB ? 1 : 0, duration: 2400, useNativeDriver: true }).start();
      return next;
    });
  }, [tintAnim]);

  const applyAudio = useCallback(async (i: number) => {
    const d = director.current;
    if (!d) return;
    const r = await d.planFor(i);
    if (i !== idxRef.current) return;
    const rich = enrichPlan(r.plan, pagesRef.current[i] ?? '', profile.current);
    const blended = blendAmbience(prevAmb.current, rich.ambience, !r.fromAi);
    prevAmb.current = blended;
    const auto = smoother.current.next(blended);
    const sm = autoSmooth.current ? auto : { amb: blended, fade: 1, gain: 1, busy: 0 };
    const mix: MixStem[] = mixFromSmoothed(rich.mix, sm.amb);
    engine.setMix(mix, rich.looks, { fade: sm.fade, gain: sm.gain });
    engine.setDetails(rich.details);
    if (!played.current.has(i)) {
      played.current.add(i);
      engine.playSpots(sm.busy > 0.6 ? rich.spots.slice(0, 1) : rich.spots);
    }
    tintTo(rich.mood ?? 'calm');
    setPlaying(nowPlaying(mix, rich));
    // já busca (ou manda gerar) os sons da próxima página
    const next = pagesRef.current[i + 1];
    if (next) {
      const nx = enrichPlan(analyze(next), next, profile.current);
      [...planDescs(nx), ...nx.details.map((x) => spotDesc({ s: x.s, at: 0, w: x.w, v: x.v }))]
        .forEach((x) => void activeLibrary.resolve(x).catch(() => null));
    }
  }, [tintTo]);

  /* ---------- a cada página/parágrafo: ritmo, progresso e som ---------- */
  const lastIdx = useRef(-1);
  useEffect(() => {
    if (!pages || !book) return;
    // ritmo de leitura: só conta avanço de uma página por vez
    const prev = lastIdx.current;
    if (prev >= 0 && idx === prev + 1) {
      setPace((p) => {
        const n = recordPage(p, wordCount(pages[prev] ?? ''), Date.now() - pageSince.current);
        if (n !== p) void getRepo().then((r) => r.kvSet('pace', JSON.stringify(n)));
        return n;
      });
    }
    lastIdx.current = idx;
    pageSince.current = Date.now();
    engine.clearSpots();
    if (audioTimer.current) clearTimeout(audioTimer.current);
    audioTimer.current = setTimeout(() => void applyAudio(idx), DWELL_MS);
    void getRepo().then((r) => r.saveProgress(id, idx, false)).then(() => syncSoon(8000));
  }, [idx, pages, book, id, applyAudio]);

  /* capítulo escolhido no glossário: volta à leitura já nele */
  useEffect(() => onJump((bookId, page) => {
    if (bookId !== id || !pages) return;
    const ni = Math.max(0, Math.min(pages.length - 1, page));
    setFinished(false);
    idxRef.current = ni;
    setIdx(ni);
    setLayers((ls) => [...ls.map((l) => ({ ...l, leaving: true })), { key: ++keyRef.current, idx: ni, dir: 1, leaving: false }]);
    if (layout === 'scroll') setTimeout(() => listRef.current?.scrollToIndex({ index: ni, animated: false }), 50);
  }), [id, pages, layout]);

  const finish = useCallback(() => {
    if (!pages) return;
    setFinished(true);
    engine.clearSpots();
    engine.setMix([]);
    engine.setDetails([]);
    void getRepo().then((r) => r.saveProgress(id, pages.length - 1, true)).then(() => syncSoon(1000));
  }, [pages, id]);

  const go = useCallback((d: number) => {
    if (!pages || busyRef.current || finished) return;
    const ni = idxRef.current + d;
    if (ni < 0) return;
    busyRef.current = true;
    setTimeout(() => (busyRef.current = false), 420);
    void Haptics.selectionAsync();
    if (ni >= pages.length) { finish(); return; }
    idxRef.current = ni;
    setIdx(ni);
    setFit(1);
    setLayers((ls) => [...ls.map((l) => ({ ...l, leaving: true })), { key: ++keyRef.current, idx: ni, dir: d, leaving: false }]);
  }, [pages, finished, finish]);

  const removeLayer = useCallback((key: number) => setLayers((ls) => ls.filter((l) => l.key !== key)), []);

  /* modo páginas: toque na lateral esquerda volta, direita avança, centro mostra/esconde as barras */
  const onStageTap = useCallback((pageX: number) => {
    const x = pageX / Math.max(1, winW);
    if (x < 0.3) go(-1);
    else if (x > 0.7) go(1);
    else if (chrome) showChrome(false); else poke();
  }, [winW, go, chrome, showChrome, poke]);
  /* deslizar para cima/baixo também vira a página (só arrasto; toques vão para o texto) */
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 24 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_e, g) => { if (g.dy < -40) go(1); else if (g.dy > 40) go(-1); },
  }), [go]);

  /* modo rolagem: o parágrafo mais visível manda no som */
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.filter((v) => v.isViewable && v.index != null).sort((a, b) => a.index! - b.index!)[0];
    if (first?.index == null || first.index === idxRef.current) return;
    idxRef.current = first.index;
    setIdx(first.index);
  }).current;
  const viewCfg = useRef({ itemVisiblePercentThreshold: 55, minimumViewTime: 250 }).current;
  useEffect(() => {
    if (layout !== 'scroll' || !pages) return;
    const i = idxRef.current;
    const t = setTimeout(() => { if (i > 0) listRef.current?.scrollToIndex({ index: i, animated: false, viewPosition: 0.1 }); }, 60);
    return () => clearTimeout(t);
  }, [layout, pages]);

  /* ---------- dados derivados ---------- */
  const chapters = useMemo(() => (pages ? detectChapters(pages) : []), [pages]);
  const words = useMemo(() => (pages ? pages.map(wordCount) : []), [pages]);
  const terms = useMemo(() => {
    if (!pages) return [];
    const g = gloss.map((x) => x.term);
    return [...new Set([...g, ...entitiesSoFar(pages, idx, 24)])];
  }, [pages, gloss, idx]);
  const xinfo = useMemo(() => (xray && pages ? xrayInfo(xray, pages, idx) : null), [xray, pages, idx]);

  const typeStyle: TypeStyle = useMemo(() => {
    const size = BASE_FONT * SIZES[sizeI] * (layout === 'pages' ? fit : 1);
    return {
      fontFamily: READING_FONTS[type.font].regular, fontSize: size, lineHeight: size * LINE_HEIGHTS[type.lineI],
      color: c.fg, textAlign: type.justify ? 'justify' : 'left',
    };
  }, [sizeI, fit, layout, type, c.fg]);
  const paraGap = typeStyle.lineHeight * PARA_SPACING[type.paraI];
  const margin = MARGINS[type.marginI];

  const onTerm = useCallback((t: string) => setXray(t), []);

  if (!book || !pages) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const n = pages.length;
  const ch = chapters[chapterAt(chapters, idx)];
  const chPct = ch ? Math.round(((idx - ch.start + 1) / Math.max(1, ch.end - ch.start)) * 100) : 0;
  const chWords = ch ? words.slice(idx + 1, ch.end).reduce((a, b) => a + b, 0) + Math.round((words[idx] ?? 0) / 2) : 0;
  const bookWords = words.slice(idx + 1).reduce((a, b) => a + b, 0);
  const chLeft = formatMinutes(minutesFor(chWords, pace.wpm));
  const chTitle = ch && chapters.length > 1 ? ch.title.replace(/^Parte (\d+) ·.*/, 'Parte $1') : book.title;
  const glossDesc = xray ? gloss.find((g) => g.term.toLowerCase() === xray.toLowerCase())?.desc : undefined;
  const fade = { opacity: chromeAnim };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar hidden={!chrome} style={c.status} animated />
      {/* névoa de cor bem leve, conforme o clima da cena */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, tintAnim) }]} pointerEvents="none">
        <LinearGradient colors={[TINT[moods.a] + '26', 'transparent']} locations={[0, 0.7]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: tintAnim }]} pointerEvents="none">
        <LinearGradient colors={[TINT[moods.b] + '26', 'transparent']} locations={[0, 0.7]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* ---------- texto ---------- */}
      {layout === 'scroll' ? (
        <FlatList
          ref={listRef}
          data={pages}
          keyExtractor={(_, i) => String(i)}
          initialNumToRender={Math.min(n, idx + 8)}
          windowSize={9}
          maxToRenderPerBatch={8}
          removeClippedSubviews
          onScrollToIndexFailed={(e) => setTimeout(() => listRef.current?.scrollToIndex({ index: e.index, animated: false }), 120)}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewCfg}
          onScrollBeginDrag={() => { if (chrome) showChrome(false); }}
          onScroll={() => { if (chrome && !sheet) showChrome(false); }}
          scrollEventThrottle={250}
          contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 120, paddingHorizontal: margin, alignItems: 'center' }}
          ListHeaderComponent={<Text style={[st.heading, { color: c.mut, marginBottom: 26 }]}>{book.title}</Text>}
          ListFooterComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <RoundButton big label="Terminei ✓" onPress={finish} />
            </View>
          }
          renderItem={({ item, index }) => (
            <Pressable onPress={() => (chrome ? showChrome(false) : poke())} style={{ width: '100%', alignItems: 'center', marginBottom: paraGap }}
              accessible={false}>
              <PageText text={item} terms={terms} style={typeStyle} mut={c.mut} onTerm={index <= idx + 2 ? onTerm : undefined} />
            </Pressable>
          )}
        />
      ) : (
        <View
          style={[st.stage, { top: insets.top + 56, bottom: insets.bottom + 56 }]}
          onLayout={(e) => setStageH(e.nativeEvent.layout.height)}
          {...pan.panHandlers}
          accessibilityLabel={pages[idx]}
          accessibilityActions={[{ name: 'increment', label: 'Próxima página' }, { name: 'decrement', label: 'Página anterior' }]}
          onAccessibilityAction={(e) => go(e.nativeEvent.actionName === 'decrement' ? -1 : 1)}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={(e) => onStageTap(e.nativeEvent.pageX)} accessible={false} />
          {layers.map((l) => (
            <Page key={l.key} dir={l.dir} leaving={l.leaving} onGone={() => removeLayer(l.key)} reduceMotion={reduceMotion} maxH={stageH}
              onFit={(big) => { if (big && !l.leaving && fit > 0.62) setFit((f) => Math.max(0.62, f - 0.06)); }}>
              <Pressable onPress={(e) => onStageTap(e.nativeEvent.pageX)} style={{ width: '100%', alignItems: 'center', paddingHorizontal: margin }} accessible={false}>
                {l.idx === 0 ? <Text style={[st.heading, { color: c.mut }]}>{book.title}</Text> : null}
                <PageText text={pages[l.idx]} terms={terms} style={typeStyle} mut={c.mut} onTerm={l.leaving ? undefined : onTerm} />
              </Pressable>
            </Page>
          ))}
        </View>
      )}

      {/* ---------- indicador mínimo (fica no Modo Zen) ---------- */}
      <View style={[st.mini, { bottom: insets.bottom + 10, left: margin, right: margin }]} pointerEvents="none"
        accessibilityLabel={`${chTitle}, ${chPct}% do capítulo, cerca de ${chLeft} restantes`}>
        <View style={[st.miniBar, { backgroundColor: c.btn }]}><View style={{ width: `${chPct}%`, height: '100%', backgroundColor: c.mut, opacity: 0.7 }} /></View>
        <Text style={[st.miniText, { color: c.mut }]} numberOfLines={1}>{chTitle} · {chLeft} {chapters.length > 1 ? 'no capítulo' : 'restantes'}</Text>
      </View>

      {/* ---------- barras (somem no Modo Zen) ---------- */}
      <Animated.View style={[st.top, fade, { paddingTop: insets.top + 8, backgroundColor: c.bg + 'ee' }]} pointerEvents={chrome ? 'box-none' : 'none'}>
        <View style={st.row}>
          <RoundButton label="←" accessibilityLabel="Voltar à biblioteca" onPress={() => router.back()} style={st.small} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={[st.topTitle, { color: c.fg }]} numberOfLines={1}>{book.title}</Text>
            <ProgressBar pct={Math.round(((idx + 1) / n) * 100)} height={3} />
          </View>
          <RoundButton label="🎧" accessibilityLabel="Som" onPress={() => setSheet('audio')} style={st.small} />
        </View>
        <Text style={[st.topSub, { color: c.mut }]} numberOfLines={1}>
          {playing.length ? playing.slice(0, 3).join('  ') : '🎧 silêncio'}   ·   {formatMinutes(minutesFor(bookWords, pace.wpm))} no livro · {pace.wpm} ppm
        </Text>
      </Animated.View>

      <Animated.View style={[st.bottom, fade, { paddingBottom: insets.bottom + 34, backgroundColor: c.bg + 'ee' }]} pointerEvents={chrome ? 'box-none' : 'none'}>
        <View style={st.controls}>
          <RoundButton label="Aa" accessibilityLabel="Tipografia e tema" onPress={() => setSheet('type')} />
          <RoundButton label={sound.focus ? '🎯' : '🎧'} accessibilityLabel="Som" onPress={() => setSheet('audio')} />
          <RoundButton label="📝" accessibilityLabel="Glossário e capítulos" onPress={() => router.push({ pathname: '/glossary/[id]', params: { id, from: 'reader', at: String(idx) } })} />
          <RoundButton label="⚙" accessibilityLabel="Configurações" onPress={() => router.push('/settings')} />
        </View>
        <Text style={[st.foot, { color: c.mut }]}>Toque no centro para esconder · laterais viram a página · nomes sublinhados mostram quem é</Text>
      </Animated.View>

      {/* ---------- recapitulação ---------- */}
      {recap && recap.text ? (
        <View style={[StyleSheet.absoluteFill, st.recapWrap]} pointerEvents="box-none">
          <View style={[st.recap, { backgroundColor: c.bg, borderColor: c.btn }]} accessibilityViewIsModal>
            <Text style={[st.recapKicker, { color: c.mut }]}>O QUE ACONTECEU ATÉ AQUI</Text>
            <Text style={{ fontFamily: READING_FONTS[type.font].regular, fontSize: 17, lineHeight: 26, color: c.fg }}>{recap.text}</Text>
            <Text style={[st.foot, { color: c.mut, textAlign: 'left' }]}>{recap.ai ? '✦ resumo da IA, só com o que você já leu' : 'trechos das últimas páginas que você leu'}</Text>
            <RoundButton big label="Continuar lendo" onPress={() => setRecap(null)} />
          </View>
        </View>
      ) : null}

      <AudioSheet visible={sheet === 'audio'} onClose={() => setSheet(null)} playing={playing} reported={reported}
        onReport={engine.libraryIdsPlaying().length ? () => {
          engine.libraryIdsPlaying().forEach((sid) => void activeLibrary.report(sid).catch(() => undefined));
          setReported(true);
          setTimeout(() => setReported(false), 4000);
        } : undefined} />
      <TypeSheet visible={sheet === 'type'} onClose={() => setSheet(null)} />
      <XraySheet term={xray} info={xinfo} glossDesc={glossDesc} canExplain={aiAvailable()} onClose={() => setXray(null)}
        explain={(t) => explainTerm(book.title, t, readSoFar(pages, idx), isPublicBook(id))}
        onAdd={(t, d) => {
          const next = upsertEntry(gloss, t, d);
          setGloss(next);
          void getRepo().then((r) => r.setGloss(id, next)).then(() => syncSoon());
          setXray(null);
        }} />

      {finished && (
        <View style={[StyleSheet.absoluteFill, st.end, { backgroundColor: c.ov }]}>
          <Text style={[st.endTitle, { color: c.fg }]}>Fim</Text>
          <Text style={[st.topSub, { color: c.mut, fontSize: 17 }]}>Você concluiu “{book.title}”.</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
            <RoundButton big label="Ler de novo" onPress={() => {
              setFinished(false); played.current.clear(); idxRef.current = 0; setIdx(0); setFit(1);
              setLayers([{ key: ++keyRef.current, idx: 0, dir: 1, leaving: false }]);
              listRef.current?.scrollToOffset({ offset: 0, animated: false });
            }} />
            <RoundButton label="Biblioteca" onPress={() => router.back()} />
          </View>
        </View>
      )}
    </View>
  );
}

/** Rótulos do que está tocando (stems por prioridade + efeito da página). */
function nowPlaying(mix: MixStem[], plan: ScenePlan): string[] {
  const a = mix.slice(0, 3).map((m) => LAYER_LABEL[m.s as Layer]);
  const s = plan.spots.slice(0, 1).map((x) => SPOT_LABEL[x.s]);
  return [...a, ...s];
}

const st = StyleSheet.create({
  stage: { position: 'absolute', left: 0, right: 0 },
  pageWrap: { justifyContent: 'center', alignItems: 'center' },
  heading: { fontFamily: FONTS.serifMedium, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 22 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12, paddingBottom: 10, gap: 6, zIndex: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  small: { height: 40, minWidth: 40, paddingHorizontal: 10 },
  topTitle: { fontFamily: FONTS.uiBold, fontSize: 14 },
  topSub: { fontFamily: FONTS.ui, fontSize: 12.5, paddingHorizontal: 4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 8, paddingTop: 12, zIndex: 4 },
  controls: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  foot: { fontFamily: FONTS.ui, fontSize: 11.5, letterSpacing: 0.2, textAlign: 'center', paddingHorizontal: 16 },
  mini: { position: 'absolute', gap: 5, zIndex: 2 },
  miniBar: { height: 2, borderRadius: 1, overflow: 'hidden' },
  miniText: { fontFamily: FONTS.ui, fontSize: 11.5, textAlign: 'center' },
  recapWrap: { justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 20 },
  recap: { width: '100%', maxWidth: 520, borderRadius: 20, padding: 22, gap: 14, borderWidth: 1 },
  recapKicker: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1.4 },
  end: { alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 10 },
  endTitle: { fontFamily: FONTS.serifMedium, fontSize: 48 },
});
