/**
 * Leitor imersivo.
 *
 * - Três modos: PÁGINA CHEIA (vários parágrafos por tela, como um livro),
 *   UM PARÁGRAFO por tela (mais cinematográfico) e ROLAGEM (texto contínuo;
 *   o som acompanha o parágrafo que está na tela).
 * - Virar a página: toque nas laterais, deslize para o lado (ou para cima),
 *   ou use as setas / PageUp / PageDown / espaço no teclado (web).
 * - Na página cheia o som acompanha a leitura: cada parágrafo da tela entra
 *   no tempo em que a pessoa deve chegar nele, pelo ritmo dela (WPM).
 * - Toque longo num parágrafo: grifar (4 cores), anotar, copiar, compartilhar,
 *   dicionário e tradução. Toque num grifo para editar.
 * - 🔖 marca a página; ☰ abre sumário, barra de progresso arrastável,
 *   marcadores, grifos e notas (com exportação); 🔍 busca no livro.
 * - Modo Zen: barras e botões somem após 3 s sem toque; um toque no centro
 *   da tela traz de volta. Fica sempre um indicador mínimo do capítulo com o
 *   tempo restante, calculado no ritmo de leitura da própria pessoa.
 * - X-Ray: nomes e termos do texto são tocáveis e abrem uma ficha sem spoiler.
 * - Recapitulação quando a pessoa volta depois de mais de 48 h.
 * - O som é uma matriz de mixagem (stems com ganho, low-pass e prioridade)
 *   suavizada quando a cena muda muito.
 */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, FlatList, PanResponder, Platform, Pressable, Share, StyleSheet, Text, View,
  type LayoutChangeEvent, type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { engine, soundSource } from '../../src/audio';
import { analyze, LAYER_LABEL, SPOT_LABEL, TINT } from '../../src/core/analyze';
import { exportMarkdown, newId, type Annotation } from '../../src/core/annotations';
import { chapterAt, detectChapters } from '../../src/core/chapters';
import { readSoFar, upsertEntry } from '../../src/core/glossary';
import { DEFAULT_WPM, formatMinutes, minutesFor, recordPage, wordCount, type PaceState } from '../../src/core/pace';
import { onePerScreen, paginate, screenOf, type PageBox, type Screen } from '../../src/core/paginate';
import { blendAmbience, mixFromSmoothed } from '../../src/core/plan';
import { needsRecap, recapLocal, recapWindow } from '../../src/core/recap';
import { bookProfile, enrichPlan, type BookProfile } from '../../src/core/scenery';
import { SceneSmoother } from '../../src/core/smooth';
import { planDescs, spotDesc } from '../../src/core/sound';
import type { Ambience, BookMeta, GlossaryEntry, Layer, MixStem, Mood, ScenePlan } from '../../src/core/types';
import { entitiesSoFar, xrayInfo } from '../../src/core/xray';
import { bundledPlans, isPublicBook } from '../../src/data/books';
import { AudioSheet } from '../../src/reader/AudioSheet';
import { NavSheet } from '../../src/reader/NavSheet';
import { PageText, type TypeStyle } from '../../src/reader/PageText';
import { SearchSheet } from '../../src/reader/SearchSheet';
import { SelectionSheet, type SelectionTarget } from '../../src/reader/SelectionSheet';
import { TypeSheet } from '../../src/reader/TypeSheet';
import { XraySheet } from '../../src/reader/XraySheet';
import { aiAvailable, explainTerm, fetchRecap } from '../../src/services/ai';
import { downloadChapter } from '../../src/services/offline';
import { activeLibrary } from '../../src/services/sounds';
import { syncSoon } from '../../src/services/sync';
import { getRepo } from '../../src/state/db';
import { onJump } from '../../src/state/jump';
import { SceneDirector } from '../../src/state/scene';
import { ProgressBar, RoundButton } from '../../src/ui/components';
import { FONTS, LINE_HEIGHTS, MARGINS, PARA_SPACING, READING_FONTS, SIZES, usePrefs } from '../../src/ui/prefs';

const BASE_FONT = 21;
const ZEN_AFTER_MS = 3000;
/** tempo parado num parágrafo/página antes de o som acompanhar */
const DWELL_MS = 700;
/** altura reservada para o título do livro na primeira página */
const HEADING_H = 52;
const NO_ANN: Annotation[] = [];

type SheetName = 'audio' | 'type' | 'nav' | 'search' | null;

/* ---------- Uma tela (página cheia ou um parágrafo): entra pelo lado, sai pelo outro ---------- */
function Page({ children, dir, leaving, onGone, reduceMotion, maxH, onFit, top }: {
  children: React.ReactNode; dir: number; leaving: boolean; onGone: () => void; reduceMotion: boolean; maxH: number;
  onFit: (tooBig: boolean) => void; top: boolean;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const gone = useRef(onGone);
  gone.current = onGone;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: reduceMotion ? 1 : 600, easing: Easing.bezier(0.22, 0.61, 0.36, 1), useNativeDriver: true }).start();
  }, [t, reduceMotion]);
  useEffect(() => {
    if (!leaving) return;
    Animated.timing(out, { toValue: 1, duration: reduceMotion ? 1 : 420, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }).start(() => gone.current());
  }, [leaving, out, reduceMotion]);
  const dx = dir >= 0 ? 46 : -46;
  const style = {
    opacity: Animated.multiply(t, Animated.subtract(1, out)),
    transform: [
      { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) },
      { translateX: out.interpolate({ inputRange: [0, 1], outputRange: [0, -dx * 1.4] }) },
    ],
  };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.pageWrap, top && st.pageTop, style]} pointerEvents={leaving ? 'none' : 'box-none'}>
      <View onLayout={(e: LayoutChangeEvent) => onFit(maxH > 0 && e.nativeEvent.layout.height > maxH + 2)} style={{ width: '100%', alignItems: 'center' }}>
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

  const [book, setBook] = useState<BookMeta | null>(null);
  const [pages, setPages] = useState<string[] | null>(null);
  const [gloss, setGloss] = useState<GlossaryEntry[]>([]);
  const [idx, setIdx] = useState(0);
  /** telas em animação; `start` é o primeiro parágrafo da tela */
  const [layers, setLayers] = useState<{ key: number; start: number; dir: number; leaving: boolean }[]>([]);
  const [playing, setPlaying] = useState<string[]>([]);
  const [moods, setMoods] = useState<{ a: Mood; b: Mood; showB: boolean }>({ a: 'calm', b: 'calm', showB: false });
  const [finished, setFinished] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [fit, setFit] = useState(1);
  /** página cheia: aperta a estimativa se uma tela passou do espaço */
  const [squeeze, setSqueeze] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [xray, setXray] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [recap, setRecap] = useState<{ text: string; ai: boolean } | null>(null);
  const [pace, setPace] = useState<PaceState>({ wpm: DEFAULT_WPM, samples: 0 });
  /** download do capítulo para ler offline */
  const [dl, setDl] = useState<{ p: number; msg: string } | null>(null);
  const [anns, setAnns] = useState<Annotation[]>([]);
  const [sel, setSel] = useState<SelectionTarget | null>(null);
  /** resultado da busca: destaque passageiro no trecho encontrado */
  const [flash, setFlash] = useState<{ page: number; at: number; len: number } | null>(null);
  const [toast, setToast] = useState('');
  const [locked, setLocked] = useState(false);

  const idxRef = useRef(0);
  /** parágrafo que o som está tocando (na página cheia avança sozinho pela tela) */
  const soundRef = useRef(-1);
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
  const audioTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const zenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSince = useRef(Date.now());
  const chromeAnim = useRef(new Animated.Value(1)).current;
  const tintAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); }, []);

  const say = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

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
  const busyUi = !!(sheet || xray || recap || sel || (dl && dl.p < 1));
  useEffect(() => {
    // painel aberto: mantém as barras; fechou: volta a contar
    if (busyUi) { if (zenTimer.current) clearTimeout(zenTimer.current); showChrome(true); } else armZen();
    return () => { if (zenTimer.current) clearTimeout(zenTimer.current); };
  }, [busyUi, armZen, showChrome]);

  /* ---------- carrega o livro ---------- */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const repo = await getRepo();
      const [b, p, g, paceRaw, last, a] = await Promise.all([
        repo.getBook(id), repo.getPages(id), repo.getGloss(id), repo.kvGet('pace'), repo.kvGet('session:' + id), repo.listAnnotations(id),
      ]);
      if (!alive || !b || !p?.length) { router.back(); return; }
      const start = b.done ? 0 : Math.min(b.idx, p.length - 1);
      pagesRef.current = p;
      profile.current = bookProfile(p, analyze, b.title);
      try { if (paceRaw) setPace(JSON.parse(paceRaw) as PaceState); } catch { /* ritmo corrompido: padrão */ }
      setBook(b); setPages(p); setGloss(g); setAnns(a); setIdx(start); idxRef.current = start;
      setLayers([{ key: ++keyRef.current, start, dir: 1, leaving: false }]);
      director.current = new SceneDirector(id, b.title, p, (page) => { if (page === soundRef.current) void applyAudio(page); },
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
  const clearAudioTimers = () => { audioTimers.current.forEach(clearTimeout); audioTimers.current = []; };
  useEffect(() => {
    engine.start();
    // navegador bloqueou o som (falta um toque): mostra o aviso
    const t = setInterval(() => setLocked(engine.needsUnlock), 1000);
    return () => {
      clearInterval(t);
      clearAudioTimers();
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
    soundRef.current = i;
    const r = await d.planFor(i);
    if (i !== soundRef.current) return;
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
    // já busca (ou manda gerar) os sons do próximo parágrafo
    const next = pagesRef.current[i + 1];
    if (next) {
      const nx = enrichPlan(analyze(next), next, profile.current);
      [...planDescs(nx), ...nx.details.map((x) => spotDesc({ s: x.s, at: 0, w: x.w, v: x.v }))]
        .forEach((x) => void activeLibrary.resolve(x).catch(() => null));
    }
  }, [tintTo]);

  /* ---------- telas: página cheia agrupa parágrafos; os outros modos, um por tela ---------- */
  const typeStyle: TypeStyle = useMemo(() => {
    const size = BASE_FONT * SIZES[sizeI] * (layout === 'pages' ? fit : 1);
    return {
      fontFamily: READING_FONTS[type.font].regular, fontSize: size, lineHeight: size * LINE_HEIGHTS[type.lineI],
      color: c.fg, textAlign: type.justify ? 'justify' : 'left',
    };
  }, [sizeI, fit, layout, type, c.fg]);
  const paraGap = typeStyle.lineHeight * PARA_SPACING[type.paraI];
  const margin = MARGINS[type.marginI];

  useEffect(() => { setSqueeze(1); }, [layout, sizeI, type, stage.w, stage.h]);
  const box: PageBox | null = useMemo(() => {
    if (layout !== 'full' || stage.h <= 0) return null;
    return {
      width: Math.min(680, stage.w - margin * 2), height: (stage.h - HEADING_H) * squeeze,
      fontSize: typeStyle.fontSize, lineHeight: typeStyle.lineHeight, paraGap,
    };
  }, [layout, stage, margin, squeeze, typeStyle.fontSize, typeStyle.lineHeight, paraGap]);
  const screens: Screen[] = useMemo(() => {
    if (!pages) return [];
    return layout === 'full' && box ? paginate(pages, box) : onePerScreen(pages.length);
  }, [pages, layout, box]);
  const screensRef = useRef(screens);
  screensRef.current = screens;
  const screenAt = useCallback((p: number): Screen => {
    const s = screensRef.current;
    return layout === 'scroll' || !s.length ? { start: p, end: p + 1 } : s[screenOf(s, p)];
  }, [layout]);
  const cur = pages ? screenAt(idx) : { start: 0, end: 1 };
  const words = useMemo(() => (pages ? pages.map(wordCount) : []), [pages]);

  /* ---------- a cada tela/parágrafo: ritmo, progresso e som ---------- */
  const lastIdx = useRef(-1);
  const wpmRef = useRef(pace.wpm);
  wpmRef.current = pace.wpm;
  useEffect(() => {
    if (!pages || !book) return;
    // ritmo de leitura: só conta avanço de uma tela por vez
    const prev = lastIdx.current;
    const prevScr = prev >= 0 ? screenAt(prev) : null;
    if (prevScr && idx > prev && idx === prevScr.end) {
      const w = words.slice(prevScr.start, prevScr.end).reduce((a, b) => a + b, 0);
      setPace((p) => {
        const n = recordPage(p, w, Date.now() - pageSince.current);
        if (n !== p) void getRepo().then((r) => r.kvSet('pace', JSON.stringify(n)));
        return n;
      });
    }
    lastIdx.current = idx;
    pageSince.current = Date.now();
    engine.clearSpots();
    clearAudioTimers();
    // som de cada parágrafo da tela no tempo em que a pessoa deve chegar nele
    const scr = screenAt(idx);
    let at = DWELL_MS;
    for (let i = scr.start; i < scr.end; i++) {
      const p = i;
      audioTimers.current.push(setTimeout(() => void applyAudio(p), at));
      at += ((words[i] ?? 0) / Math.max(80, wpmRef.current)) * 60_000 * 0.9;
    }
    void getRepo().then((r) => r.saveProgress(id, idx, false)).then(() => syncSoon(8000));
  }, [idx, pages, book, id, applyAudio, screenAt, words]);

  /** Vai direto a um parágrafo (sumário, busca, marcador, glossário). */
  const jumpTo = useCallback((page: number) => {
    if (!pages) return;
    const p = Math.max(0, Math.min(pages.length - 1, page));
    const ni = layout === 'scroll' ? p : screenAt(p).start;
    setFinished(false);
    setFit(1);
    idxRef.current = ni;
    setIdx(ni);
    setLayers((ls) => [...ls.map((l) => ({ ...l, leaving: true })), { key: ++keyRef.current, start: ni, dir: 1, leaving: false }]);
    if (layout === 'scroll') setTimeout(() => listRef.current?.scrollToIndex({ index: p, animated: false, viewPosition: 0.1 }), 50);
  }, [pages, layout, screenAt]);

  /* capítulo escolhido no glossário: volta à leitura já nele */
  useEffect(() => onJump((bookId, page) => { if (bookId === id) jumpTo(page); }), [id, jumpTo]);

  const finish = useCallback(() => {
    if (!pages) return;
    setFinished(true);
    clearAudioTimers();
    engine.clearSpots();
    engine.setMix([]);
    engine.setDetails([]);
    void getRepo().then((r) => r.saveProgress(id, pages.length - 1, true)).then(() => syncSoon(1000));
  }, [pages, id]);

  const go = useCallback((d: number) => {
    if (!pages || busyRef.current || finished) return;
    const s = screensRef.current;
    const si = screenOf(s, idxRef.current) + d;
    if (si < 0) return;
    busyRef.current = true;
    setTimeout(() => (busyRef.current = false), 380);
    void Haptics.selectionAsync();
    if (si >= s.length) { finish(); return; }
    const ni = s[si].start;
    idxRef.current = ni;
    setIdx(ni);
    setFit(1);
    setLayers((ls) => [...ls.map((l) => ({ ...l, leaving: true })), { key: ++keyRef.current, start: ni, dir: d, leaving: false }]);
  }, [pages, finished, finish]);

  const removeLayer = useCallback((key: number) => setLayers((ls) => ls.filter((l) => l.key !== key)), []);

  /* toque na lateral esquerda volta, direita avança, centro mostra/esconde as barras */
  const onStageTap = useCallback((pageX: number) => {
    const x = pageX / Math.max(1, stage.w);
    if (x < 0.3) go(-1);
    else if (x > 0.7) go(1);
    else if (chrome) showChrome(false); else poke();
  }, [stage.w, go, chrome, showChrome, poke]);
  /* deslizar para o lado (ou para cima/baixo) vira a página; toques vão para o texto */
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.max(Math.abs(g.dx), Math.abs(g.dy)) > 24,
    onPanResponderRelease: (_e, g) => {
      if (Math.abs(g.dx) > Math.abs(g.dy)) { if (g.dx < -40) go(1); else if (g.dx > 40) go(-1); }
      else if (g.dy < -40) go(1); else if (g.dy > 40) go(-1);
    },
  }), [go]);

  /* teclado (web): setas, PageUp/PageDown e espaço viram a página */
  const keyOk = useRef(true);
  keyOk.current = !busyUi && !finished && layout !== 'scroll';
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (!keyOk.current || tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

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
  /* mudou de modo: a tela atual passa a ser a que contém o parágrafo */
  useEffect(() => {
    if (!pages || layout === 'scroll') return;
    setLayers([{ key: ++keyRef.current, start: idxRef.current, dir: 1, leaving: false }]);
  }, [layout, pages]);

  /* ---------- marcadores, grifos e notas ---------- */
  const hlByPage = useMemo(() => {
    const m = new Map<number, Annotation[]>();
    anns.forEach((a) => { if (a.kind === 'highlight') m.set(a.page, [...(m.get(a.page) ?? []), a]); });
    if (flash) {
      const f: Annotation = { id: 'flash', bookId: id, kind: 'highlight', page: flash.page, start: flash.at, end: flash.at + flash.len, quote: '', note: '', color: 'yellow', createdAt: 0 };
      m.set(flash.page, [...(m.get(flash.page) ?? []), f]);
    }
    return m;
  }, [anns, flash, id]);
  const marked = anns.find((a) => a.kind === 'bookmark' && a.page >= cur.start && a.page < cur.end);

  const toggleBookmark = useCallback(() => {
    if (!pages) return;
    void Haptics.selectionAsync();
    if (marked) {
      setAnns((as) => as.filter((a) => a.id !== marked.id));
      void getRepo().then((r) => r.deleteAnnotation(marked.id));
      say('Marcador removido');
      return;
    }
    const a: Annotation = {
      id: newId(), bookId: id, kind: 'bookmark', page: cur.start, start: 0, end: 0,
      quote: pages[cur.start].slice(0, 160), note: '', createdAt: Date.now(),
    };
    setAnns((as) => [...as, a].sort((x, y) => x.page - y.page || x.start - y.start));
    void getRepo().then((r) => r.saveAnnotation(a));
    say('🔖 Página marcada');
  }, [pages, marked, id, cur.start, say]);

  const onHighlight = useCallback((hid: string) => {
    const a = anns.find((x) => x.id === hid);
    if (a && pages) setSel({ page: a.page, text: pages[a.page], edit: a });
  }, [anns, pages]);
  const select = useCallback((page: number) => {
    if (!pages) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSel({ page, text: pages[page] });
  }, [pages]);

  /* ---------- dados derivados ---------- */
  const chapters = useMemo(() => (pages ? detectChapters(pages) : []), [pages]);
  const chapterLabel = useCallback((p: number) => chapters[chapterAt(chapters, p)]?.title ?? book?.title ?? '', [chapters, book]);
  const terms = useMemo(() => {
    if (!pages) return [];
    const g = gloss.map((x) => x.term);
    return [...new Set([...g, ...entitiesSoFar(pages, idx, 24)])];
  }, [pages, gloss, idx]);
  const xinfo = useMemo(() => (xray && pages ? xrayInfo(xray, pages, idx) : null), [xray, pages, idx]);

  const onTerm = useCallback((t: string) => setXray(t), []);

  const exportNotes = useCallback(async () => {
    if (!book) return;
    const md = exportMarkdown(book.title, book.sub, anns, chapterLabel);
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        if (nav?.share) { await nav.share({ title: book.title, text: md }); return; }
        await Clipboard.setStringAsync(md);
        say('Grifos copiados (Markdown)');
        return;
      }
      await Share.share({ title: book.title, message: md });
    } catch {
      await Clipboard.setStringAsync(md).catch(() => undefined);
      say('Grifos copiados (Markdown)');
    }
  }, [book, anns, chapterLabel, say]);

  if (!book || !pages) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const n = pages.length;
  const ch = chapters[chapterAt(chapters, idx)];
  const chPct = ch ? Math.round(((cur.end - ch.start) / Math.max(1, ch.end - ch.start)) * 100) : 0;
  const chWords = ch ? words.slice(cur.end, ch.end).reduce((a, b) => a + b, 0) + Math.round(words.slice(cur.start, cur.end).reduce((a, b) => a + b, 0) / 2) : 0;
  const bookWords = words.slice(cur.end).reduce((a, b) => a + b, 0);
  const chLeft = formatMinutes(minutesFor(chWords, pace.wpm));
  const chTitle = ch && chapters.length > 1 ? ch.title.replace(/^Parte (\d+) ·.*/, 'Parte $1') : book.title;
  const glossDesc = xray ? gloss.find((g) => g.term.toLowerCase() === xray.toLowerCase())?.desc : undefined;
  const fade = { opacity: chromeAnim };
  const full = layout === 'full';
  const screenNo = layout === 'scroll' ? idx + 1 : screenOf(screens, idx) + 1;
  const screenCount = layout === 'scroll' ? n : screens.length;

  const para = (p: number, leaving: boolean) => (
    <Pressable key={p} onPress={(e) => (layout === 'scroll' ? (chrome ? showChrome(false) : poke()) : onStageTap(e.nativeEvent.pageX))}
      onLongPress={leaving ? undefined : () => select(p)} delayLongPress={420}
      style={{ width: '100%', alignItems: 'center', marginBottom: paraGap }} accessible={false}>
      <PageText text={pages[p]} terms={terms} style={typeStyle} mut={c.mut} onTerm={leaving ? undefined : onTerm}
        highlights={hlByPage.get(p) ?? NO_ANN} onHighlight={leaving ? undefined : onHighlight} />
    </Pressable>
  );

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
          onScroll={() => { if (chrome && !busyUi) showChrome(false); }}
          scrollEventThrottle={250}
          contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 120, paddingHorizontal: margin, alignItems: 'center' }}
          ListHeaderComponent={<Text style={[st.heading, { color: c.mut, marginBottom: 26 }]}>{book.title}</Text>}
          ListFooterComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <RoundButton big label="Terminei ✓" onPress={finish} />
            </View>
          }
          renderItem={({ index }) => para(index, false)}
        />
      ) : (
        <View
          style={[st.stage, full ? { top: insets.top + 86, bottom: insets.bottom + 44 } : { top: insets.top + 56, bottom: insets.bottom + 56 }]}
          onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          {...pan.panHandlers}
          accessibilityLabel={pages.slice(cur.start, cur.end).join('\n')}
          accessibilityActions={[{ name: 'increment', label: 'Próxima página' }, { name: 'decrement', label: 'Página anterior' }]}
          onAccessibilityAction={(e) => go(e.nativeEvent.actionName === 'decrement' ? -1 : 1)}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={(e) => onStageTap(e.nativeEvent.pageX)} accessible={false} />
          {stage.h > 0 && layers.map((l) => {
            const scr = screenAt(l.start);
            const ps: number[] = [];
            for (let p = scr.start; p < scr.end; p++) ps.push(p);
            return (
              <Page key={l.key} dir={l.dir} leaving={l.leaving} onGone={() => removeLayer(l.key)} reduceMotion={reduceMotion}
                maxH={stage.h} top={full}
                onFit={(big) => {
                  if (!big || l.leaving) return;
                  if (full) { if (squeeze > 0.6) setSqueeze((q) => Math.max(0.6, q - 0.06)); }
                  else if (fit > 0.62) setFit((f) => Math.max(0.62, f - 0.06));
                }}>
                <View style={{ width: '100%', alignItems: 'center', paddingHorizontal: margin }}>
                  {scr.start === 0 ? <Text style={[st.heading, { color: c.mut }]}>{book.title}</Text> : null}
                  {ps.map((p) => para(p, l.leaving))}
                </View>
              </Page>
            );
          })}
        </View>
      )}

      {/* fita do marcador no Modo Zen (com as barras, o botão já mostra 🔖) */}
      {marked && !chrome ? <Text style={[st.ribbon, { top: insets.top + 4 }]} pointerEvents="none" accessibilityLabel="Página marcada">🔖</Text> : null}

      {/* ---------- indicador mínimo (fica no Modo Zen) ---------- */}
      <View style={[st.mini, { bottom: insets.bottom + 10, left: margin, right: margin }]} pointerEvents="none"
        accessibilityLabel={`${chTitle}, ${chPct}% do capítulo, cerca de ${chLeft} restantes`}>
        <View style={[st.miniBar, { backgroundColor: c.btn }]}><View style={{ width: `${chPct}%`, height: '100%', backgroundColor: c.mut, opacity: 0.7 }} /></View>
        <Text style={[st.miniText, { color: c.mut }]} numberOfLines={1}>
          {chTitle} · {chLeft} {chapters.length > 1 ? 'no capítulo' : 'restantes'} · {screenNo}/{screenCount}
        </Text>
      </View>

      {/* ---------- barras (somem no Modo Zen) ---------- */}
      <Animated.View style={[st.top, fade, { paddingTop: insets.top + 8, backgroundColor: c.bg + 'ee' }]} pointerEvents={chrome ? 'box-none' : 'none'}>
        <View style={st.row}>
          <RoundButton label="←" accessibilityLabel="Voltar à biblioteca" onPress={() => router.back()} style={st.small} />
          <Pressable style={{ flex: 1, gap: 5 }} onPress={() => setSheet('nav')} accessibilityRole="button" accessibilityLabel="Sumário e progresso">
            <Text style={[st.topTitle, { color: c.fg }]} numberOfLines={1}>{book.title}</Text>
            <ProgressBar pct={Math.round((cur.end / n) * 100)} height={3} />
          </Pressable>
          <RoundButton label={marked ? '🔖' : '🏷'} accessibilityLabel={marked ? 'Remover marcador' : 'Marcar esta página'} onPress={toggleBookmark} style={st.small} />
        </View>
        <Text style={[st.topSub, { color: c.mut }]} numberOfLines={1}>
          {playing.length ? playing.slice(0, 3).join('  ') : '🎧 silêncio'}   ·   {formatMinutes(minutesFor(bookWords, pace.wpm))} no livro · {pace.wpm} ppm
        </Text>
      </Animated.View>

      <Animated.View style={[st.bottom, fade, { paddingBottom: insets.bottom + 34, backgroundColor: c.bg + 'ee' }]} pointerEvents={chrome ? 'box-none' : 'none'}>
        <View style={st.controls}>
          <RoundButton label="Aa" accessibilityLabel="Tipografia, tema e modo de leitura" onPress={() => setSheet('type')} />
          <RoundButton label={sound.focus ? '🎯' : '🎧'} accessibilityLabel="Som" onPress={() => setSheet('audio')} />
          <RoundButton label="☰" accessibilityLabel="Sumário, marcadores e grifos" onPress={() => setSheet('nav')} />
          <RoundButton label="🔍" accessibilityLabel="Buscar no livro" onPress={() => setSheet('search')} />
          <RoundButton label="📝" accessibilityLabel="Glossário e capítulos" onPress={() => router.push({ pathname: '/glossary/[id]', params: { id, from: 'reader', at: String(idx) } })} />
        </View>
        {dl ? <Text style={[st.foot, { color: c.fg }]} accessibilityLiveRegion="polite">⬇ {dl.msg}</Text> : null}
        <Text style={[st.foot, { color: c.mut }]}>
          {layout === 'scroll' ? 'Toque longo num parágrafo para grifar · nomes sublinhados mostram quem é'
            : 'Deslize ou toque nas laterais · toque longo para grifar · nomes sublinhados mostram quem é'}
        </Text>
      </Animated.View>

      {/* ---------- som bloqueado pelo navegador ---------- */}
      {locked && !finished ? (
        <Pressable style={[st.unlock, { top: insets.top + 96, backgroundColor: c.fg }]} accessibilityRole="button"
          onPress={() => { engine.start(); setTimeout(() => setLocked(engine.needsUnlock), 300); }}>
          <Text style={[st.unlockText, { color: c.bg }]}>🔇 Toque para ativar o som</Text>
        </Pressable>
      ) : null}

      {toast ? (
        <View style={[st.toast, { bottom: insets.bottom + 130, backgroundColor: c.fg }]} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={[st.unlockText, { color: c.bg }]}>{toast}</Text>
        </View>
      ) : null}

      {/* ---------- recapitulação ---------- */}
      {recap && recap.text ? (
        <View style={[StyleSheet.absoluteFill, st.recapWrap]} pointerEvents="box-none">
          <View style={[st.recap, { backgroundColor: c.bg, borderColor: c.btn }]} accessibilityViewIsModal>
            <Text style={[st.recapKicker, { color: c.mut }]}>O QUE ACONTECEU ATÉ AQUI</Text>
            <Text style={{ fontFamily: READING_FONTS[type.font].regular, fontSize: 17, lineHeight: 26, color: c.fg }}>{recap.text}</Text>
            <Text style={[st.foot, { color: c.mut, textAlign: 'left' }]}>{recap.ai ? '✦ resumo da IA, só com o que você já leu' : 'trechos das últimas páginas que você leu'}</Text>
            <RoundButton big label="Continuar lendo" onPress={() => { engine.start(); setRecap(null); }} />
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
      <NavSheet visible={sheet === 'nav'} onClose={() => setSheet(null)} n={n} idx={idx} chapters={chapters} annotations={anns}
        chapterLabel={chapterLabel}
        onJump={(p) => { setSheet(null); jumpTo(p); }}
        onExport={() => void exportNotes()}
        download={dl ? dl.msg : null}
        onDownload={() => {
          if (!ch || (dl && dl.p < 1)) return;
          setDl({ p: 0, msg: 'Preparando…' });
          downloadChapter(id, book.title, pages, ch, soundSource, (p, msg) => setDl({ p, msg }))
            .then(() => setTimeout(() => setDl(null), 4000))
            .catch(() => { setDl({ p: 1, msg: 'Não consegui baixar agora.' }); setTimeout(() => setDl(null), 4000); });
        }} />
      <SearchSheet visible={sheet === 'search'} onClose={() => setSheet(null)} pages={pages} chapterLabel={chapterLabel}
        onPick={(p, at, len) => {
          setSheet(null);
          jumpTo(p);
          setFlash({ page: p, at, len });
          setTimeout(() => setFlash((f) => (f && f.page === p && f.at === at ? null : f)), 3200);
        }} />
      <SelectionSheet target={sel} title={book.title} onClose={() => setSel(null)}
        onSave={(s) => {
          const prev = s.id ? anns.find((a) => a.id === s.id) : undefined;
          const a: Annotation = {
            id: s.id ?? newId(), bookId: id, kind: 'highlight', page: s.page, start: s.start, end: s.end,
            quote: s.quote, note: s.note, color: s.color, createdAt: prev?.createdAt ?? Date.now(),
          };
          setAnns((as) => [...as.filter((x) => x.id !== a.id), a].sort((x, y) => x.page - y.page || x.start - y.start));
          void getRepo().then((r) => r.saveAnnotation(a));
          setSel(null);
          say(a.note ? '✎ Nota salva' : 'Trecho grifado');
        }}
        onDelete={(hid) => {
          setAnns((as) => as.filter((x) => x.id !== hid));
          void getRepo().then((r) => r.deleteAnnotation(hid));
          setSel(null);
          say('Grifo removido');
        }} />
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
              setLayers([{ key: ++keyRef.current, start: 0, dir: 1, leaving: false }]);
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
  pageTop: { justifyContent: 'flex-start', paddingTop: 8 },
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
  ribbon: { position: 'absolute', right: 14, fontSize: 22, zIndex: 2 },
  unlock: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 99, zIndex: 6, opacity: 0.92 },
  unlockText: { fontFamily: FONTS.uiBold, fontSize: 14 },
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 99, zIndex: 7, opacity: 0.9 },
  recapWrap: { justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 20 },
  recap: { width: '100%', maxWidth: 520, borderRadius: 20, padding: 22, gap: 14, borderWidth: 1 },
  recapKicker: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1.4 },
  end: { alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 10 },
  endTitle: { fontFamily: FONTS.serifMedium, fontSize: 48 },
});
