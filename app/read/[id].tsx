import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { engine } from '../../src/audio';
import { LAYER_LABEL, SPOT_LABEL, TINT } from '../../src/core/analyze';
import { entriesOnPage } from '../../src/core/glossary';
import { blendAmbience } from '../../src/core/plan';
import { minutesLeft, wordsRemaining } from '../../src/core/text';
import type { Ambience, BookMeta, GlossaryEntry, Layer, Mood, ScenePlan } from '../../src/core/types';
import { soundLibrary } from '../../src/services/sounds';
import { syncSoon } from '../../src/services/sync';
import { getRepo } from '../../src/state/db';
import { SceneDirector } from '../../src/state/scene';
import { ProgressBar, RoundButton } from '../../src/ui/components';
import { FONTS, SIZES, usePrefs, VOLUME_ICON, VOLUMES } from '../../src/ui/prefs';

const BASE_FONT = 23;

/* ---------- Uma página: entra subindo, sai subindo ---------- */
function Page({ text, heading, dir, leaving, onGone, scale, color, mut, maxH, reduceMotion }: {
  text: string; heading?: string; dir: number; leaving: boolean; onGone: () => void; scale: number;
  color: string; mut: string; maxH: number; reduceMotion: boolean;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const [fit, setFit] = useState(1);
  const gone = useRef(onGone);
  gone.current = onGone;

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: reduceMotion ? 1 : 950, easing: Easing.bezier(0.22, 0.61, 0.36, 1), useNativeDriver: true }).start();
  }, [t, reduceMotion]);

  useEffect(() => {
    if (!leaving) return;
    Animated.timing(out, { toValue: 1, duration: reduceMotion ? 1 : 800, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }).start(() => gone.current());
  }, [leaving, out, reduceMotion]);

  useEffect(() => setFit(1), [text, scale]);

  // reduz a letra só o necessário para a página caber na tela
  const onLayout = (e: LayoutChangeEvent) => {
    if (maxH > 0 && e.nativeEvent.layout.height > maxH && fit > 0.62) setFit((f) => Math.max(0.62, f - 0.06));
  };

  const size = BASE_FONT * scale * fit;
  const dy = dir >= 0 ? 40 : -40;
  const style = {
    opacity: Animated.multiply(t, Animated.subtract(1, out)),
    transform: [
      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
      { translateY: out.interpolate({ inputRange: [0, 1], outputRange: [0, -dy * 1.5] }) },
    ],
  };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.pageWrap, style]} pointerEvents="none">
      <View onLayout={onLayout}>
        {heading ? <Text style={[st.heading, { color: mut }]}>{heading}</Text> : null}
        <Text
          style={[st.body, { color, fontSize: size, lineHeight: size * 1.68 }]}
          android_hyphenationFrequency="full"
          textBreakStrategy="highQuality"
          accessibilityRole="text"
        >
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

/* ---------- Leitor ---------- */
export default function Reader() {
  useKeepAwake();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(String(rawId));
  const { c, sizeI, setSize, volI, setVol, theme, setTheme } = usePrefs();
  const insets = useSafeAreaInsets();

  const [book, setBook] = useState<BookMeta | null>(null);
  const [pages, setPages] = useState<string[] | null>(null);
  const [gloss, setGloss] = useState<GlossaryEntry[]>([]);
  const [idx, setIdx] = useState(0);
  const [layers, setLayers] = useState<{ key: number; idx: number; dir: number; leaving: boolean }[]>([]);
  const [chip, setChip] = useState('');
  /** toque no rótulo do som: oferece marcar como ruim os sons do repositório que estão tocando */
  const [report, setReport] = useState<'idle' | 'ask' | 'thanks'>('idle');
  const onChipPress = useCallback(() => {
    if (report === 'ask') {
      engine.libraryIdsPlaying().forEach((sid) => void soundLibrary.report(sid).catch(() => undefined));
      setReport('thanks');
      setTimeout(() => setReport('idle'), 3000);
    } else if (report === 'idle' && engine.libraryIdsPlaying().length) {
      setReport('ask');
      setTimeout(() => setReport((r) => (r === 'ask' ? 'idle' : r)), 5000);
    }
  }, [report]);
  const [moods, setMoods] = useState<{ a: Mood; b: Mood; showB: boolean }>({ a: 'calm', b: 'calm', showB: false });
  const [finished, setFinished] = useState(false);
  const [stageH, setStageH] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const idxRef = useRef(0);
  const keyRef = useRef(0);
  const busyRef = useRef(false);
  const prevAmb = useRef<Ambience>({});
  const played = useRef(new Set<number>());
  const director = useRef<SceneDirector | null>(null);
  const audioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tintAnim = useRef(new Animated.Value(0)).current;

  const remaining = useMemo(() => (pages ? wordsRemaining(pages) : []), [pages]);

  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); }, []);

  /* carrega o livro */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const repo = await getRepo();
      const [b, p, g] = await Promise.all([repo.getBook(id), repo.getPages(id), repo.getGloss(id)]);
      if (!alive || !b || !p?.length) { router.back(); return; }
      const start = b.done ? 0 : Math.min(b.idx, p.length - 1);
      setBook(b); setPages(p); setGloss(g); setIdx(start); idxRef.current = start;
      setLayers([{ key: ++keyRef.current, idx: start, dir: 1, leaving: false }]);
      director.current = new SceneDirector(id, b.title, p, (page) => { if (page === idxRef.current) void applyAudio(page); });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* glossário pode ter mudado na tela de glossário */
  useFocusEffect(useCallback(() => { void getRepo().then((r) => r.getGloss(id)).then(setGloss); }, [id]));

  /* áudio: liga ao entrar, desliga com fade ao sair */
  useEffect(() => {
    engine.start();
    return () => {
      if (audioTimer.current) clearTimeout(audioTimer.current);
      engine.clearSpots();
      engine.setScene({});
    };
  }, []);
  useEffect(() => { engine.setVolume(VOLUMES[volI]); }, [volI]);

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
    const amb = blendAmbience(prevAmb.current, r.plan.ambience, !r.fromAi);
    prevAmb.current = amb;
    engine.setScene(amb, r.plan.looks);
    // cada página toca seus sons pontuais uma vez (se a IA chegar depois, só o ambiente é atualizado)
    if (!played.current.has(i)) {
      played.current.add(i);
      engine.playSpots(r.plan.spots);
    }
    tintTo(r.plan.mood ?? 'calm');
    setChip(chipText(amb, r.plan, r.pending));
  }, [tintTo]);

  /* a cada página: salva progresso e agenda o som (0,7 s depois, junto com a leitura) */
  useEffect(() => {
    if (!pages || !book) return;
    engine.clearSpots();
    if (audioTimer.current) clearTimeout(audioTimer.current);
    audioTimer.current = setTimeout(() => void applyAudio(idx), 700);
    void getRepo().then((r) => r.saveProgress(id, idx, false)).then(() => syncSoon(8000));
  }, [idx, pages, book, id, applyAudio]);

  const go = useCallback((d: number) => {
    if (!pages || busyRef.current || finished) return;
    const ni = idxRef.current + d;
    if (ni < 0) return;
    busyRef.current = true;
    setTimeout(() => (busyRef.current = false), 520);
    void Haptics.selectionAsync();
    if (ni >= pages.length) {
      setFinished(true);
      engine.clearSpots();
      engine.setScene({});
      void getRepo().then((r) => r.saveProgress(id, pages.length - 1, true)).then(() => syncSoon(1000));
      return;
    }
    idxRef.current = ni;
    setIdx(ni);
    setLayers((ls) => [...ls.map((l) => ({ ...l, leaving: true })), { key: ++keyRef.current, idx: ni, dir: d, leaving: false }]);
  }, [pages, finished, id]);

  const removeLayer = useCallback((key: number) => setLayers((ls) => ls.filter((l) => l.key !== key)), []);

  /* toque: terço esquerdo volta, resto avança; deslizar para cima avança */
  const layoutW = useRef(400);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderRelease: (_e, g) => {
      if (g.dy < -40 && Math.abs(g.dy) > Math.abs(g.dx)) go(1);
      else if (g.dy > 40 && Math.abs(g.dy) > Math.abs(g.dx)) go(-1);
      else if (Math.abs(g.dx) < 14 && Math.abs(g.dy) < 14) go(g.x0 < layoutW.current * 0.28 ? -1 : 1);
    },
  }), [go]);

  if (!book || !pages) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const n = pages.length;
  const pct = Math.round(((idx + 1) / n) * 100);
  const mins = minutesLeft(remaining[idx] ?? 0);
  const chips = entriesOnPage(gloss, pages[idx] ?? '');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }} onLayout={(e) => (layoutW.current = e.nativeEvent.layout.width)}>
      {/* névoa de cor bem leve, conforme o clima da cena */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, tintAnim) }]} pointerEvents="none">
        <LinearGradient colors={[TINT[moods.a] + '30', 'transparent']} locations={[0, 0.7]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: tintAnim }]} pointerEvents="none">
        <LinearGradient colors={[TINT[moods.b] + '30', 'transparent']} locations={[0, 0.7]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* topo: barra de progresso, som tocando, % e tempo restante */}
      <View style={[st.top, { paddingTop: insets.top + 12 }]} pointerEvents="none">
        <ProgressBar pct={pct} />
        <View style={st.row}>
          <Pressable style={{ flex: 1 }} onPress={onChipPress} accessibilityRole="button"
            accessibilityLabel={report === 'ask' ? 'Confirmar: este som está ruim' : `Som da cena: ${chip}`}>
            <Text style={[st.small, { color: c.mut }]} numberOfLines={1}>
              {report === 'ask' ? '👎 Som ruim? Toque para avisar' : report === 'thanks' ? 'Obrigado! Vamos trocar esse som.' : chip}
            </Text>
          </Pressable>
          <Text style={[st.small, { color: c.mut }]}>{pct}% · {mins <= 1 ? '< 1' : `~${mins}`} min</Text>
        </View>
      </View>

      {/* área do texto */}
      <View
        style={[st.stage, { top: insets.top + 70, bottom: insets.bottom + 140 }]}
        onLayout={(e) => setStageH(e.nativeEvent.layout.height)}
        accessibilityLabel={pages[idx]}
        accessibilityActions={[{ name: 'increment', label: 'Próxima página' }, { name: 'decrement', label: 'Página anterior' }]}
        onAccessibilityAction={(e) => go(e.nativeEvent.actionName === 'decrement' ? -1 : 1)}
        accessible
      >
        {layers.map((l) => (
          <Page key={l.key} text={pages[l.idx]} heading={l.idx === 0 ? book.title : undefined} dir={l.dir} leaving={l.leaving}
            onGone={() => removeLayer(l.key)} scale={SIZES[sizeI]} color={c.fg} mut={c.mut} maxH={stageH} reduceMotion={reduceMotion} />
        ))}
      </View>
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />

      {/* rodapé */}
      <View style={[st.bottom, { paddingBottom: insets.bottom + 14 }]} pointerEvents="box-none">
        {chips.length > 0 && (
          <View style={st.chips}>
            {chips.map((g) => (
              <Pressable key={g.term} onPress={() => router.push({ pathname: '/glossary/[id]', params: { id, at: String(idx), focus: g.term } })}
                style={[st.chip, { backgroundColor: c.btn }]} accessibilityRole="button" accessibilityLabel={`Glossário: ${g.term}`}>
                <Text style={[st.chipText, { color: c.fg }]}>📝 {g.term}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={[st.foot, { color: c.mut }]} numberOfLines={1}>{book.title} · {idx + 1} de {n}</Text>
        <View style={st.controls}>
          <RoundButton label="☰" accessibilityLabel="Biblioteca" onPress={() => router.back()} />
          <RoundButton label={VOLUME_ICON[volI]} accessibilityLabel="Volume do som ambiente" onPress={() => setVol((volI + 1) % VOLUMES.length)} />
          <RoundButton label={theme === 'sepia' ? '☀' : '☾'} accessibilityLabel="Tema" onPress={() => setTheme(theme === 'sepia' ? 'dark' : 'sepia')} />
          <RoundButton label="📝" accessibilityLabel="Glossário" onPress={() => router.push({ pathname: '/glossary/[id]', params: { id, at: String(idx) } })} />
          <RoundButton label="A−" accessibilityLabel="Diminuir letra" onPress={() => setSize(sizeI - 1)} />
          <RoundButton label="A+" accessibilityLabel="Aumentar letra" onPress={() => setSize(sizeI + 1)} />
        </View>
      </View>

      {finished && (
        <View style={[StyleSheet.absoluteFill, st.end, { backgroundColor: c.ov }]}>
          <Text style={[st.endTitle, { color: c.fg }]}>Fim</Text>
          <Text style={[st.small, { color: c.mut, fontSize: 17 }]}>Você concluiu “{book.title}”.</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
            <RoundButton big label="Ler de novo" onPress={() => {
              setFinished(false); played.current.clear(); idxRef.current = 0; setIdx(0);
              setLayers([{ key: ++keyRef.current, idx: 0, dir: 1, leaving: false }]);
            }} />
            <RoundButton label="Biblioteca" onPress={() => router.back()} />
          </View>
        </View>
      )}
    </View>
  );
}

function chipText(amb: Ambience, plan: ScenePlan, pending: boolean): string {
  if (pending) return '✦ ouvindo a cena…';
  const a = (Object.keys(amb) as Layer[]).sort((x, y) => (amb[y] ?? 0) - (amb[x] ?? 0)).slice(0, 2).map((k) => LAYER_LABEL[k]);
  const s = plan.spots.slice(0, 1).map((x) => SPOT_LABEL[x.s]);
  return [...a, ...s].join('   ') || '🎧 ambiente leve';
}

const st = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 18, zIndex: 3 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 9, gap: 10 },
  small: { fontFamily: FONTS.ui, fontSize: 13 },
  stage: { position: 'absolute', left: 0, right: 0 },
  pageWrap: { justifyContent: 'center', paddingHorizontal: 26, alignItems: 'center' },
  heading: { fontFamily: FONTS.serifMedium, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 22 },
  body: { fontFamily: FONTS.serif, textAlign: 'justify', maxWidth: 620 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 10, paddingHorizontal: 12, zIndex: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: 99, justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiBold, fontSize: 13 },
  foot: { fontFamily: FONTS.ui, fontSize: 12.5, letterSpacing: 0.4 },
  controls: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  end: { alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 10 },
  endTitle: { fontFamily: FONTS.serifMedium, fontSize: 48 },
});
