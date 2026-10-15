/**
 * Leitor imersivo.
 *
 * - Três modos: UM PARÁGRAFO por tela (o padrão: foco total, o parágrafo no
 *   centro óptico da tela), PÁGINA CHEIA (como um livro) e ROLAGEM.
 * - Estilo livro: recuo na primeira linha, parágrafo inteiro mesmo quando
 *   foi dividido em páginas, abertura de capítulo com título e versalete.
 *   A paginação é calibrada com a medida real do texto na tela.
 * - Virar a página: a página acompanha o dedo; toque nas laterais; setas,
 *   PageUp/PageDown e espaço no teclado (web).
 * - Som: um único ambiente por tela, aplicado na virada de página (nunca
 *   adianta o que a pessoa ainda vai ler); a cena base fica pelo menos
 *   ~90 s / 3 telas; no máximo um efeito pontual por tela. Entra devagar ao
 *   abrir o livro e desce quase ao silêncio se a pessoa parar de ler.
 * - Toque longo num parágrafo: grifar, anotar, copiar, compartilhar,
 *   dicionário e tradução. Toque num grifo para editar.
 * - Barras com ícones e rótulos: marcador, texto, som, sumário, busca e
 *   glossário. A dica de como virar a página aparece só nas primeiras vezes.
 * - Modo Zen: as barras aparecem por cima do texto com um toque no centro e
 *   somem sozinhas; ficam só um cabeçalho e um rodapé finos.
 * - X-Ray sem spoiler; recapitulação depois de 48 h; estilo de som na
 *   primeira leitura.
 * - Jornada do leitor: cada tela lida, capítulo, livro terminado, grifo e
 *   termo do glossário contam; meta do dia, conquistas e desafio da semana
 *   aparecem num aviso discreto (nunca interrompem a leitura).
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
  type LayoutChangeEvent, type TextStyle, type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { engine, soundSource } from '../../src/audio';
import { analyze, LAYER_NAME, SPOT_NAME, TINT } from '../../src/core/analyze';
import { exportMarkdown, newId, type Annotation } from '../../src/core/annotations';
import { chapterAt, detectChapters, headingOf } from '../../src/core/chapters';
import { readSoFar, upsertEntry } from '../../src/core/glossary';
import { DEFAULT_WPM, formatMinutes, minutesFor, recordPage, wordCount, type PaceState } from '../../src/core/pace';
import { calibrateCharW, onePerScreen, paginate, screenOf, type PageBox, type Screen } from '../../src/core/paginate';
import { blendAmbience, mergeScreen, mixFromSmoothed } from '../../src/core/plan';
import { needsRecap, recapLocal, recapWindow } from '../../src/core/recap';
import { bookProfile, enrichPlan, type AmbientDetail, type BookProfile } from '../../src/core/scenery';
import { buildSceneMap, scenePlan, type SceneMap } from '../../src/core/narrative';
import { SceneHold, SceneSmoother } from '../../src/core/smooth';
import { planDescs, spotDesc } from '../../src/core/sound';
import { continues, plain } from '../../src/core/text';
import type { Ambience, BookMeta, GlossaryEntry, Layer, MixStem, Mood, ScenePlan } from '../../src/core/types';
import { entitiesSoFar, xrayInfo } from '../../src/core/xray';
import { ACERVO, acervoId, isAcervoId } from '../../src/data/acervo';
import { bundledPlans, isPublicBook } from '../../src/data/books';
import { AudioSheet } from '../../src/reader/AudioSheet';
import { NavSheet } from '../../src/reader/NavSheet';
import { ParaBlock, pressProps, type PressHandlers, type TypeStyle } from '../../src/reader/PageText';
import { PresetSheet } from '../../src/reader/PresetSheet';
import { SearchSheet } from '../../src/reader/SearchSheet';
import { SelectionSheet, type SelectionTarget } from '../../src/reader/SelectionSheet';
import { TypeSheet } from '../../src/reader/TypeSheet';
import { XraySheet } from '../../src/reader/XraySheet';
import { aiAvailable, explainTerm, fetchRecap } from '../../src/services/ai';
import { downloadChapter } from '../../src/services/offline';
import { isGutId, savedGutInfo } from '../../src/services/gutenberg';
import { activeLibrary } from '../../src/services/sounds';
import { syncSoon } from '../../src/services/sync';
import { getRepo } from '../../src/state/db';
import { onJump } from '../../src/state/jump';
import { BADGES, levelOf, MAX_READ_MS, streakOf, type JourneyResult } from '../../src/core/journey';
import { flushJourney, loadJourney, track } from '../../src/state/journey';
import { syncReminders } from '../../src/services/reminders';
import { SceneDirector } from '../../src/state/scene';
import { IconButton, ProgressBar, RoundButton } from '../../src/ui/components';
import { Icon } from '../../src/ui/Icon';
import { BASE_FONT, FONTS, LINE_HEIGHTS, MARGINS, PARA_SPACING, READING_FONTS, SIZES, usePrefs } from '../../src/ui/prefs';

const ZEN_AFTER_MS = 3000;
/** tempo parado numa tela antes de o som acompanhar */
const DWELL_MS = 600;
/** ao abrir o livro o ambiente entra devagar (segundos) */
const ENTRANCE_SEC = 9;
/** cabeçalho e rodapé finos da página cheia (pontos) */
const HEADER_H = 30;
const FOOTER_H = 34;
/** parada sem virar a página: no mínimo 90 s ou 2,5× o tempo esperado da tela */
const IDLE_MIN_MS = 90_000;
const NO_ANN: Annotation[] = [];

type SheetName = 'audio' | 'type' | 'nav' | 'search' | null;
interface Layer2 { key: number; start: number; dir: number; leaving: boolean; offset: number }

/* ---------- Uma tela: entra pelo lado, sai pelo outro; a atual acompanha o dedo ---------- */
function Page({ children, dir, leaving, offset, onGone, still, maxH, onFit, top, drag, width, lift = 0 }: {
  children: React.ReactNode; dir: number; leaving: boolean; offset: number; onGone: () => void; still: boolean; maxH: number;
  onFit: (tooBig: boolean) => void; top: boolean; drag: Animated.Value | null; width: number;
  /** sobe o texto centralizado um pouco (centro óptico fica acima do centro da tela) */
  lift?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const gone = useRef(onGone);
  gone.current = onGone;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: still ? 1 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [t, still]);
  useEffect(() => {
    if (!leaving) return;
    Animated.timing(out, { toValue: 1, duration: still ? 1 : 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => gone.current());
  }, [leaving, out, still]);
  const enterX = still ? 0 : dir >= 0 ? 60 : -60;
  const leaveX = still ? 0 : (dir >= 0 ? -1 : 1) * Math.max(80, width * 0.35);
  const transform: { translateX: Animated.AnimatedInterpolation<number> | Animated.Value | number }[] = [
    { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [enterX, 0] }) },
    { translateX: out.interpolate({ inputRange: [0, 1], outputRange: [offset, offset + leaveX] }) },
  ];
  if (drag && !leaving) transform.push({ translateX: drag });
  const style = { opacity: Animated.multiply(t, Animated.subtract(1, out)), transform };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.pageWrap, top ? st.pageTop : { paddingBottom: lift }, style]} pointerEvents={leaving ? 'none' : 'box-none'}>
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
  const { c, sizeI, type, layout, sound, volI } = usePrefs();
  const insets = useSafeAreaInsets();

  const [book, setBook] = useState<BookMeta | null>(null);
  const [pages, setPages] = useState<string[] | null>(null);
  const [gloss, setGloss] = useState<GlossaryEntry[]>([]);
  const [idx, setIdx] = useState(0);
  const [layers, setLayers] = useState<Layer2[]>([]);
  const [playing, setPlaying] = useState<string[]>([]);
  const [moods, setMoods] = useState<{ a: Mood; b: Mood; showB: boolean }>({ a: 'calm', b: 'calm', showB: false });
  const [finished, setFinished] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [fit, setFit] = useState(1);
  /** página cheia: aperta a estimativa se uma tela passou do espaço */
  const [squeeze, setSqueeze] = useState(1);
  /** calibração da largura média de caractere (medida real do texto) */
  const [cal, setCal] = useState<{ key: string; charW: number; rounds: number } | null>(null);
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
  /** primeira leitura: escolher o estilo de som */
  const [askPreset, setAskPreset] = useState(false);
  /** dica de como virar a página e grifar: só nas primeiras leituras */
  const [hint, setHint] = useState(false);

  const idxRef = useRef(0);
  const keyRef = useRef(0);
  const busyRef = useRef(false);
  const prevAmb = useRef<Ambience>({});
  const lastMix = useRef<MixStem[]>([]);
  const played = useRef(new Set<number>());
  const director = useRef<SceneDirector | null>(null);
  const pagesRef = useRef<string[]>([]);
  const profile = useRef<BookProfile>({ looks: {}, tags: [] });
  const smoother = useRef(new SceneSmoother());
  const hold = useRef(new SceneHold());
  const sceneMap = useRef<SceneMap | null>(null);
  /** cena que está tocando (mapa de cenas) */
  const lastScene = useRef<number | null>(null);
  const autoSmooth = useRef(true);
  autoSmooth.current = sound.auto;
  /** tela que o som está tocando agora e se já entrou a primeira vez */
  const soundScr = useRef<Screen | null>(null);
  const entered = useRef(false);
  const audioToken = useRef(0);
  const audioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSince = useRef(Date.now());
  const lastAct = useRef(Date.now());
  const chromeAnim = useRef(new Animated.Value(1)).current;
  const tintAnim = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const dragX = useRef(0);
  const listRef = useRef<FlatList<number[]>>(null);
  const measured = useRef(new Map<number, { text: string; height: number }>());
  const calTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); }, []);
  const still = reduceMotion || !type.anim;

  const say = useCallback((m: string, ms = 2600) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), ms);
  }, []);
  /** tempo lido nesta abertura do livro (para sugerir uma pausa depois de 45 min) */
  const readMs = useRef(0);
  const pauseHinted = useRef(false);
  /** som ligado (para as conquistas de imersão) e se o livro é um clássico */
  const soundOn = useRef(true);
  soundOn.current = volI !== 3 && sound.preset !== 'silencio';
  const classic = isAcervoId(id) || isGutId(id);
  /** livro terminado: o tempo na tela "Fim" não conta como leitura */
  const finishedRef = useRef(false);
  /** resumo mostrado na tela "Fim" */
  const [endInfo, setEndInfo] = useState<{ points: number; badges: string[]; streak: number; level: string } | null>(null);

  /** Celebra sem atrapalhar: avisos curtos, um depois do outro. */
  const celebrate = useCallback((r: JourneyResult) => {
    const msgs: string[] = [];
    const streak = streakOf(r.days, r.state.rest, new Date());
    if (r.comeback) msgs.push('Que bom te ver de volta!');
    if (r.goalReached) msgs.push(`Meta do dia cumprida · ${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'}`);
    if (r.stepsCompleted) msgs.push('Primeiros passos concluídos! Você ganhou um dia de descanso');
    if (r.challenge) msgs.push(`Desafio da semana concluído: ${r.challenge.title}`);
    if (r.weekReached) msgs.push('Meta da semana cumprida');
    const skip = new Set(['goal', 'steps', 'comeback']);
    const names = r.unlocked.filter((b) => !skip.has(b.id)).map((b) => b.title);
    if (names.length) msgs.push(`Conquista: ${names.join(' · ')}`);
    msgs.forEach((m, i) => setTimeout(() => say(m, 3200), i * 3500));
    // meta cumprida: o lembrete de hoje não precisa mais tocar
    if (r.goalReached) void loadJourney().then((j) => syncReminders({ goal: j.goal, minutesToday: j.goal, book: j.state.session?.title })).catch(() => undefined);
  }, [say]);
  /** Tela lida: tempo (parada longa não conta), palavras e o som que tocava. */
  const logRead = useCallback((ms: number, words = 0) => {
    if (!(ms > 500)) return Promise.resolve(null);
    return track({
      type: 'read', ms, words, bookId: id, classic, sound: soundOn.current,
      layers: lastMix.current.filter((m) => m.gain > 0).map((m) => m.s as Layer),
    }).catch(() => null);
  }, [id, classic]);

  /** a pessoa está lendo (virou página, tocou, rolou): o som volta se tinha descido */
  const act = useCallback(() => { lastAct.current = Date.now(); engine.setIdle(false); }, []);

  /* ---------- Modo Zen: barras somem após 3 s sem toque ---------- */
  const showChrome = useCallback((v: boolean) => {
    setChrome(v);
    Animated.timing(chromeAnim, { toValue: v ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [chromeAnim]);
  const armZen = useCallback(() => {
    if (zenTimer.current) clearTimeout(zenTimer.current);
    zenTimer.current = setTimeout(() => showChrome(false), ZEN_AFTER_MS);
  }, [showChrome]);
  const poke = useCallback(() => { showChrome(true); armZen(); }, [showChrome, armZen]);
  const busyUi = !!(sheet || xray || recap || sel || askPreset || (dl && dl.p < 1));
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
      const [b, p, g, paceRaw, last, a, asked, hints] = await Promise.all([
        repo.getBook(id), repo.getPages(id), repo.getGloss(id), repo.kvGet('pace'), repo.kvGet('session:' + id), repo.listAnnotations(id), repo.kvGet('sound:asked'),
        repo.kvGet('reader:hints'),
      ]);
      if (!alive || !b || !p?.length) { router.back(); return; }
      const start = b.done ? 0 : Math.min(b.idx, p.length - 1);
      pagesRef.current = p;
      profile.current = bookProfile(p, analyze, b.title);
      try { if (paceRaw) setPace(JSON.parse(paceRaw) as PaceState); } catch { /* ritmo corrompido: padrão */ }
      setBook(b); setPages(p); setGloss(g); setAnns(a); setIdx(start); idxRef.current = start;
      setLayers([{ key: ++keyRef.current, start, dir: 1, leaving: false, offset: 0 }]);
      // mapa de cenas do livro: o som acompanha a história (lugar, hora, tempo, tensão), não palavras soltas
      const year = ACERVO.find((x) => acervoId(x.slug) === id)?.year
        ?? (isGutId(id) ? (await savedGutInfo(id))?.authors[0]?.death_year ?? undefined : undefined);
      sceneMap.current = buildSceneMap(p, { year: year ?? undefined });
      director.current = new SceneDirector(id, b.title, p, (page) => {
        const s = soundScr.current;
        if (s && page >= s.start && page < s.end) void applyScreen(s);
      }, { publicBook: isPublicBook(id), bundled: bundledPlans(id), fallback: (i) => scenePlan(sceneMap.current!, pagesRef.current, i) });
      if (!asked) setAskPreset(true);
      void track({ type: 'session-start', bookId: id, title: b.title }).catch(() => undefined);
      const seen = Number(hints ?? 0);
      if (seen < 3) { setHint(true); void repo.kvSet('reader:hints', String(seen + 1)); }
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
    // navegador bloqueou o som (falta um toque): mostra o aviso
    const t = setInterval(() => setLocked(engine.needsUnlock), 1000);
    return () => {
      clearInterval(t);
      void logRead(finishedRef.current ? 0 : Date.now() - pageSince.current)
        .then(() => track({ type: 'session-end' })).then(() => flushJourney()).catch(() => undefined);
      if (audioTimer.current) clearTimeout(audioTimer.current);
      engine.setIdle(false);
      engine.clearSpots();
      engine.setMix([]);
      engine.setDetails([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * Som da tela inteira: junta os planos dos parágrafos (a cena que domina a
   * página), segura a cena base por um tempo mínimo, suaviza e toca no
   * máximo um efeito — na virada, nunca antes de a pessoa ler.
   */
  const applyScreen = useCallback(async (scr: Screen) => {
    const d = director.current;
    if (!d) return;
    soundScr.current = scr;
    const token = ++audioToken.current;
    const range: number[] = [];
    for (let i = scr.start; i < scr.end; i++) range.push(i);
    const results = await Promise.all(range.map((i) => d.planFor(i)));
    if (token !== audioToken.current) return;
    const P = pagesRef.current;
    const parts = results.map((r, k) => {
      const text = P[range[k]] ?? '';
      return { plan: enrichPlan(r.plan, text, profile.current), words: wordCount(text), fromAi: r.fromAi };
    });
    // mapa de cenas: a tela toca UMA cena — a que ocupa mais texto (sem misturar duas)
    const byScene = parts.every((p) => p.plan.scene != null);
    let use = parts;
    if (byScene) {
      const words = new Map<number, number>();
      parts.forEach((p) => words.set(p.plan.scene!, (words.get(p.plan.scene!) ?? 0) + p.words));
      const top = [...words.entries()].sort((a, b) => b[1] - a[1])[0][0];
      use = parts.filter((p) => p.plan.scene === top);
    }
    const merged = mergeScreen(use);
    merged.spots = mergeScreen(parts).spots;
    const details: AmbientDetail[] = [];
    use.forEach((p) => p.plan.details.forEach((x) => { if (!details.some((y) => y.s === x.s)) details.push(x); }));
    const scene = byScene ? use[0].plan.scene! : null;
    const newScene = scene !== null && scene !== lastScene.current;
    if (newScene) {
      // cena nova: troca limpa (sem carregar camadas da anterior) e o arco da cena recomeça;
      // abertura de capítulo ganha um respiro de quase silêncio antes
      hold.current.reset();
      engine.markScene({ chapter: lastScene.current !== null && parts.some((p) => p.plan.chapterStart) });
      lastScene.current = scene;
    }
    const tension = use.reduce((a, p) => a + (p.plan.tension ?? 0), 0) / use.length;
    engine.setTone({ night: !!use[0].plan.night, tension });
    const held = byScene ? { amb: merged.ambience } : hold.current.next(merged.ambience);
    const blended = blendAmbience(prevAmb.current, held.amb, !byScene && !parts.some((p) => p.fromAi));
    prevAmb.current = blended;
    const auto = smoother.current.next(blended);
    const sm = autoSmooth.current ? auto : { amb: blended, fade: 1, gain: 1, busy: 0 };
    // prioridades: as da tela; as camadas seguradas mantêm as que já tinham
    const mix = mixFromSmoothed([...lastMix.current, ...(merged.mix ?? [])], sm.amb);
    lastMix.current = mix;
    engine.setMix(mix, merged.looks, { fade: sm.fade, gain: sm.gain, entrance: entered.current ? undefined : ENTRANCE_SEC });
    entered.current = true;
    engine.setDetails(details.slice(0, 3));
    if (!played.current.has(scr.start)) {
      played.current.add(scr.start);
      if (sm.busy < 0.6) engine.playSpots(merged.spots);
    }
    tintTo(merged.mood ?? 'calm');
    setPlaying(nowPlaying(mix, merged));
    // já busca (ou manda gerar) os sons da próxima tela
    const next = P[scr.end];
    if (next) {
      const nx = enrichPlan(sceneMap.current ? scenePlan(sceneMap.current, P, scr.end) : analyze(next), next, profile.current);
      [...planDescs(nx), ...nx.details.map((x) => spotDesc({ s: x.s, at: 0, w: x.w, v: x.v }))]
        .forEach((x) => void activeLibrary.resolve(x).catch(() => null));
    }
  }, [tintTo]);

  /* ---------- tipografia ---------- */
  const typeStyle: TypeStyle = useMemo(() => {
    const size = BASE_FONT * SIZES[sizeI] * (layout === 'pages' ? fit : 1);
    return {
      fontFamily: READING_FONTS[type.font].regular, fontSize: size, lineHeight: size * LINE_HEIGHTS[type.lineI],
      color: c.fg, textAlign: type.justify ? 'justify' : 'left',
    };
  }, [sizeI, fit, layout, type, c.fg]);
  const lh = typeStyle.lineHeight;
  const paraGap = type.book ? 0 : lh * PARA_SPACING[type.paraI];
  const margin = MARGINS[type.marginI];
  const full = layout === 'full';
  const lead: TextStyle = useMemo(() => ({ textTransform: 'uppercase', letterSpacing: 1.1, fontSize: typeStyle.fontSize * 0.84 }), [typeStyle.fontSize]);
  const headingStyle: TextStyle = useMemo(() => ({
    fontFamily: READING_FONTS[type.font].bold, fontSize: typeStyle.fontSize * 1.32, lineHeight: typeStyle.fontSize * 1.32 * 1.3,
    color: c.fg, textAlign: 'center', marginBottom: lh * 1.2,
  }), [type.font, typeStyle.fontSize, c.fg, lh]);
  /** respiro no alto da página que abre um capítulo */
  const chapterTop = full && type.book ? Math.round(stage.h * 0.12) : 0;

  /* ---------- telas: página cheia agrupa parágrafos; os outros modos, um por tela ---------- */
  const heads = useMemo(() => (pages ? pages.map((p) => p.length < 90 && !!headingOf(p)) : []), [pages]);
  const calKey = `${type.font}|${typeStyle.fontSize}|${Math.round(stage.w)}|${type.marginI}`;
  useEffect(() => { setSqueeze(1); }, [layout, sizeI, type, stage.w, stage.h]);
  const box: PageBox | null = useMemo(() => {
    if (!full || stage.h <= 0) return null;
    const charW = cal?.key === calKey ? cal.charW : undefined;
    return {
      width: Math.min(680, stage.w - margin * 2), height: stage.h * squeeze,
      fontSize: typeStyle.fontSize, lineHeight: lh, paraGap, charW, safety: charW ? 0.97 : 0.9,
    };
  }, [full, stage, margin, squeeze, typeStyle.fontSize, lh, paraGap, cal, calKey]);
  const screens: Screen[] = useMemo(() => {
    if (!pages) return [];
    if (!full || !box) return onePerScreen(pages.length);
    const headingLines = (chapterTop + headingStyle.fontSize! * 1.3 * 2 + lh * 1.2) / lh;
    return paginate(pages, box, { isHeading: (i) => heads[i], isCont: (i) => i > 0 && continues(pages[i - 1]), headingLines });
  }, [pages, full, box, heads, chapterTop, headingStyle.fontSize, lh]);
  const screensRef = useRef(screens);
  screensRef.current = screens;
  const screenAt = useCallback((p: number): Screen => {
    const s = screensRef.current;
    return layout === 'scroll' || !s.length ? { start: p, end: p + 1 } : s[screenOf(s, p)];
  }, [layout]);
  const cur = pages ? screenAt(idx) : { start: 0, end: 1 };
  /** parágrafos inteiros do livro (pedaços juntos): os itens do modo rolagem */
  const paraGroups = useMemo(() => {
    const gs: number[][] = [];
    (pages ?? []).forEach((_, p) => {
      if (p > 0 && continues(pages![p - 1]) && !heads[p]) gs[gs.length - 1].push(p);
      else gs.push([p]);
    });
    return gs;
  }, [pages, heads]);
  const groupsRef = useRef(paraGroups);
  groupsRef.current = paraGroups;
  /** item da rolagem que contém o parágrafo */
  const groupIndexOf = useCallback((p: number) => {
    const gs = groupsRef.current;
    let lo = 0, hi = gs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (gs[mid][0] <= p) lo = mid; else hi = mid - 1; }
    return Math.max(0, lo);
  }, []);
  const words = useMemo(() => (pages ? pages.map(wordCount) : []), [pages]);

  /* calibração: compara as linhas medidas na tela com as estimadas e repagina uma ou duas vezes */
  const onMeasure = useCallback((page: number, text: string, height: number) => {
    if (!full || !box) return;
    measured.current.set(page, { text, height });
    if (calTimer.current) clearTimeout(calTimer.current);
    calTimer.current = setTimeout(() => {
      if (cal?.key === calKey && cal.rounds >= 2) return;
      const k = calibrateCharW(box, [...measured.current.values()]);
      measured.current.clear();
      if (k) setCal((c0) => ({ key: calKey, charW: k, rounds: c0?.key === calKey ? c0.rounds + 1 : 1 }));
      else if (cal?.key !== calKey) setCal({ key: calKey, charW: box.charW ?? 0.5, rounds: 2 });
    }, 350);
  }, [full, box, cal, calKey]);
  useEffect(() => { measured.current.clear(); }, [calKey]);

  const chapters = useMemo(() => (pages ? detectChapters(pages) : []), [pages]);

  /* ---------- a cada tela: ritmo, progresso, jornada e som ---------- */
  const lastIdx = useRef(-1);
  useEffect(() => {
    if (!pages || !book) return;
    // ritmo de leitura: só conta avanço de uma tela por vez
    const prev = lastIdx.current;
    const prevScr = prev >= 0 ? screenAt(prev) : null;
    const forward = !!prevScr && idx > prev && idx === prevScr.end;
    const w = forward ? words.slice(prevScr!.start, prevScr!.end).reduce((a, b) => a + b, 0) : 0;
    if (forward) {
      setPace((p) => {
        const n = recordPage(p, w, Date.now() - pageSince.current);
        if (n !== p) void getRepo().then((r) => r.kvSet('pace', JSON.stringify(n)));
        return n;
      });
    }
    lastIdx.current = idx;
    // tempo lido na tela anterior (para a meta diária; pausas longas não contam)
    if (prev >= 0) {
      const ms = Math.min(Date.now() - pageSince.current, MAX_READ_MS);
      // jornada: a tela lida e, se acabou de passar de um capítulo para o outro, o capítulo
      const doneChapter = forward && chapters.length > 1 && chapterAt(chapters, prev) < chapterAt(chapters, idx);
      void logRead(ms, w).then(async (r) => {
        if (r) celebrate(r);
        if (doneChapter) celebrate(await track({ type: 'chapter' }));
      }).catch(() => undefined);
      readMs.current += ms;
      if (readMs.current > 45 * 60_000 && !pauseHinted.current) {
        pauseHinted.current = true;
        say('Você está lendo há uns 45 minutos. Que tal descansar os olhos um pouquinho?', 7000);
      }
    }
    pageSince.current = Date.now();
    act();
    engine.clearSpots();
    if (audioTimer.current) clearTimeout(audioTimer.current);
    const scr = screenAt(idx);
    audioTimer.current = setTimeout(() => void applyScreen(scr), DWELL_MS);
    void getRepo().then((r) => r.saveProgress(id, idx, false)).then(() => syncSoon(8000));
  }, [idx, pages, book, id, applyScreen, screenAt, words, act, say, chapters, logRead, celebrate]);

  /* parou de ler: sem virar a página por bem mais que o esperado, o som desce quase ao silêncio */
  const paceRef = useRef(pace.wpm);
  paceRef.current = pace.wpm;
  useEffect(() => {
    if (!pages) return;
    const t = setInterval(() => {
      const s = soundScr.current;
      const w = s ? words.slice(s.start, s.end).reduce((a, b) => a + b, 0) : 0;
      const expected = (w / Math.max(80, paceRef.current)) * 60_000;
      engine.setIdle(Date.now() - lastAct.current > Math.max(IDLE_MIN_MS, expected * 2.5));
    }, 5000);
    return () => clearInterval(t);
  }, [pages, words]);

  /** Vai direto a um parágrafo (sumário, busca, marcador, glossário). */
  const jumpTo = useCallback((page: number) => {
    if (!pages) return;
    const p = Math.max(0, Math.min(pages.length - 1, page));
    const ni = layout === 'scroll' ? p : screenAt(p).start;
    setFinished(false);
    setFit(1);
    idxRef.current = ni;
    setIdx(ni);
    setLayers((ls) => [...ls.map((l) => ({ ...l, leaving: true })), { key: ++keyRef.current, start: ni, dir: 1, leaving: false, offset: 0 }]);
    if (layout === 'scroll') setTimeout(() => listRef.current?.scrollToIndex({ index: groupIndexOf(p), animated: false, viewPosition: 0.1 }), 50);
  }, [pages, layout, screenAt, groupIndexOf]);

  /* capítulo escolhido no glossário: volta à leitura já nele */
  useEffect(() => onJump((bookId, page) => { if (bookId === id) jumpTo(page); }), [id, jumpTo]);

  const finish = useCallback(() => {
    if (!pages) return;
    setFinished(true);
    finishedRef.current = true;
    // a última tela e o livro terminado contam na jornada; o resumo aparece na tela "Fim"
    const scr = screenAt(idxRef.current);
    const w = words.slice(scr.start, scr.end).reduce((a, b) => a + b, 0);
    const ms = Date.now() - pageSince.current;
    pageSince.current = Date.now();
    void (async () => {
      const r1 = await logRead(ms, w);
      const r2 = await track({ type: 'finish', bookId: id, classic });
      const badges = [...(r1?.unlocked ?? []), ...r2.unlocked].map((b) => b.id);
      setEndInfo({
        points: Math.round(r2.state.session?.points ?? (r1?.pointsGained ?? 0) + r2.pointsGained), badges: [...new Set([...(r2.state.session?.badges ?? []), ...badges])],
        streak: streakOf(r2.days, r2.state.rest, new Date()), level: levelOf(r2.state.points).name,
      });
      if (r1) celebrate(r1);
    })().catch(() => undefined);
    if (audioTimer.current) clearTimeout(audioTimer.current);
    engine.clearSpots();
    engine.setMix([]);
    engine.setDetails([]);
    void getRepo().then((r) => r.saveProgress(id, pages.length - 1, true)).then(() => syncSoon(1000));
  }, [pages, id, screenAt, words, logRead, classic, celebrate]);

  const go = useCallback((d: number, offset = 0) => {
    if (!pages || busyRef.current || finished) return;
    const s = screensRef.current;
    const si = screenOf(s, idxRef.current) + d;
    if (si < 0) return;
    busyRef.current = true;
    setTimeout(() => (busyRef.current = false), 300);
    void Haptics.selectionAsync();
    if (si >= s.length) { finish(); return; }
    const ni = s[si].start;
    idxRef.current = ni;
    setIdx(ni);
    setFit(1);
    setLayers((ls) => [...ls.map((l) => (l.leaving ? l : { ...l, leaving: true, offset })), { key: ++keyRef.current, start: ni, dir: d, leaving: false, offset: 0 }]);
  }, [pages, finished, finish]);

  const removeLayer = useCallback((key: number) => setLayers((ls) => ls.filter((l) => l.key !== key)), []);

  /* toque na lateral esquerda volta, direita avança, centro mostra/esconde as barras */
  const onStageTap = useCallback((pageX: number) => {
    act();
    const x = pageX / Math.max(1, stage.w);
    if (x < 0.28) go(-1);
    else if (x > 0.72) go(1);
    else if (chrome) showChrome(false); else poke();
  }, [stage.w, go, chrome, showChrome, poke, act]);

  /* a página acompanha o dedo; soltou longe o bastante (ou rápido), vira */
  const goRef = useRef(go);
  goRef.current = go;
  const stillRef = useRef(still);
  stillRef.current = still;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.max(Math.abs(g.dx), Math.abs(g.dy)) > 12,
    onPanResponderMove: (_e, g) => {
      if (stillRef.current || Math.abs(g.dx) < Math.abs(g.dy)) return;
      dragX.current = g.dx * 0.85;
      drag.setValue(dragX.current);
    },
    onPanResponderRelease: (_e, g) => {
      const horiz = Math.abs(g.dx) > Math.abs(g.dy);
      const off = dragX.current;
      dragX.current = 0;
      drag.setValue(0);
      if (horiz) {
        // longe o bastante, ou um "peteleco" rápido que já andou um pouco
        if (g.dx < -50 || (g.vx < -0.45 && g.dx < -20)) goRef.current(1, off);
        else if (g.dx > 50 || (g.vx > 0.45 && g.dx > 20)) goRef.current(-1, off);
        else if (off) { drag.setValue(off); Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start(); }
      } else if (g.dy < -50) goRef.current(1);
      else if (g.dy > 50) goRef.current(-1);
    },
    onPanResponderTerminate: () => { dragX.current = 0; Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(); },
  }), [drag]);

  /* teclado (web): setas, PageUp/PageDown e espaço viram a página */
  const keyOk = useRef(true);
  keyOk.current = !busyUi && !finished && layout !== 'scroll';
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (!keyOk.current || tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); act(); goRef.current(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') { e.preventDefault(); act(); goRef.current(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  /* modo rolagem: o parágrafo mais visível manda no som */
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.filter((v) => v.isViewable && v.index != null).sort((a, b) => a.index! - b.index!)[0];
    const page = first?.index != null ? groupsRef.current[first.index]?.[0] : undefined;
    if (page == null || page === idxRef.current) return;
    idxRef.current = page;
    setIdx(page);
  }).current;
  const viewCfg = useRef({ itemVisiblePercentThreshold: 55, minimumViewTime: 250 }).current;
  useEffect(() => {
    if (layout !== 'scroll' || !pages) return;
    const i = idxRef.current;
    const t = setTimeout(() => { if (i > 0) listRef.current?.scrollToIndex({ index: groupIndexOf(i), animated: false, viewPosition: 0.1 }); }, 60);
    return () => clearTimeout(t);
  }, [layout, pages, groupIndexOf]);
  /* mudou de modo ou de paginação: a tela atual passa a ser a que contém o parágrafo */
  useEffect(() => {
    if (!pages || layout === 'scroll') return;
    setLayers([{ key: ++keyRef.current, start: idxRef.current, dir: 1, leaving: false, offset: 0 }]);
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
      quote: plain(pages[cur.start]).slice(0, 160), note: '', createdAt: Date.now(),
    };
    setAnns((as) => [...as, a].sort((x, y) => x.page - y.page || x.start - y.start));
    void getRepo().then((r) => r.saveAnnotation(a));
    say('Página marcada');
  }, [pages, marked, id, cur.start, say]);

  const onHighlight = useCallback((hid: string) => {
    const a = anns.find((x) => x.id === hid);
    if (a && pages) setSel({ page: a.page, text: plain(pages[a.page]), edit: a });
  }, [anns, pages]);
  const select = useCallback((page: number) => {
    if (!pages) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSel({ page, text: plain(pages[page]) });
  }, [pages]);

  /* ---------- dados derivados ---------- */
  const chapterLabel = useCallback((p: number) => chapters[chapterAt(chapters, p)]?.title ?? book?.title ?? '', [chapters, book]);
  const terms = useMemo(() => {
    if (!pages) return [];
    const g = gloss.map((x) => x.term);
    return [...new Set([...g, ...entitiesSoFar(pages, idx, 24)])];
  }, [pages, gloss, idx]);
  const xinfo = useMemo(() => (xray && pages ? xrayInfo(xray, pages, idx) : null), [xray, pages, idx]);

  const onTerm = useCallback((t: string) => setXray(t), []);
  const onScrollTap = useCallback(() => { act(); if (chrome) showChrome(false); else poke(); }, [act, chrome, showChrome, poke]);
  const pressFor = useCallback((page: number): PressHandlers => ({
    onTap: layout === 'scroll' ? onScrollTap : onStageTap,
    onLong: () => select(page),
  }), [layout, onScrollTap, onStageTap, select]);

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
  const chLeft = formatMinutes(minutesFor(chWords, pace.wpm));
  const chTitle = ch && chapters.length > 1 ? ch.title.replace(/^Parte (\d+) ·.*/, 'Parte $1') : book.title;
  const bookPct = Math.round((cur.end / n) * 100);
  const glossDesc = xray ? gloss.find((g) => g.term.toLowerCase() === xray.toLowerCase())?.desc : undefined;
  const fade = { opacity: chromeAnim };
  const screenNo = layout === 'scroll' ? idx + 1 : screenOf(screens, idx) + 1;
  const screenCount = layout === 'scroll' ? n : screens.length;
  const tintAlpha = type.tint ? '1a' : '00';

  /**
   * Um parágrafo (um ou mais pedaços) ou um título de capítulo. `first`
   * = primeira coisa da tela; `measure` = mede para calibrar a paginação.
   */
  const block = (ps: number[], leaving: boolean, first: boolean, measure: boolean) => {
    const p0 = ps[0];
    if (heads[p0]) {
      return (
        <Text key={p0} style={[st.bodyW, headingStyle, { marginTop: first ? chapterTop : lh }]} accessibilityRole="header"
          {...(leaving ? {} : pressProps({ onTap: layout === 'scroll' ? onScrollTap : onStageTap }))}>
          {plain(pages[p0])}
        </Text>
      );
    }
    const afterHeading = p0 > 0 && heads[p0 - 1];
    const isCont = p0 > 0 && continues(pages[p0 - 1]);
    const indent = type.book && p0 > 0 && !isCont && !afterHeading;
    const last = ps[ps.length - 1];
    return (
      <View key={p0} style={{ width: '100%', alignItems: 'center', marginBottom: continues(pages[last]) ? 0 : paraGap }}
        onLayout={measure ? (e) => onMeasure(p0, ps.map((p) => plain(pages[p])).join(' '), e.nativeEvent.layout.height) : undefined}>
        <ParaBlock pieces={ps.map((p) => ({ page: p, text: pages[p], highlights: hlByPage.get(p) ?? NO_ANN }))} style={typeStyle} mut={c.mut} terms={terms}
          onTerm={leaving ? undefined : onTerm} onHighlight={leaving ? undefined : onHighlight} indent={indent}
          lead={type.book && afterHeading ? lead : undefined} pressFor={leaving ? undefined : pressFor} />
      </View>
    );
  };
  /** Parágrafos de uma tela, juntando os pedaços de um mesmo parágrafo. */
  const groupsOf = (scr: Screen): number[][] => {
    const gs: number[][] = [];
    for (let p = scr.start; p < scr.end; p++) {
      if (p > scr.start && continues(pages[p - 1]) && !heads[p]) gs[gs.length - 1].push(p);
      else gs.push([p]);
    }
    return gs;
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar hidden={!chrome} style={c.status} animated />
      {/* névoa de cor bem leve, conforme o clima da cena (opcional) */}
      {type.tint ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, tintAnim) }]} pointerEvents="none">
            <LinearGradient colors={[TINT[moods.a] + tintAlpha, 'transparent']} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: tintAnim }]} pointerEvents="none">
            <LinearGradient colors={[TINT[moods.b] + tintAlpha, 'transparent']} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </>
      ) : null}

      {/* ---------- texto ---------- */}
      {layout === 'scroll' ? (
        <FlatList
          ref={listRef}
          data={paraGroups}
          keyExtractor={(g) => String(g[0])}
          initialNumToRender={Math.min(paraGroups.length, groupIndexOf(idx) + 8)}
          windowSize={9}
          maxToRenderPerBatch={8}
          removeClippedSubviews
          onScrollToIndexFailed={(e) => setTimeout(() => listRef.current?.scrollToIndex({ index: e.index, animated: false }), 120)}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewCfg}
          onScrollBeginDrag={() => { act(); if (chrome) showChrome(false); }}
          onScroll={() => { lastAct.current = Date.now(); if (chrome && !busyUi) showChrome(false); }}
          scrollEventThrottle={250}
          contentContainerStyle={{ paddingTop: insets.top + HEADER_H + 8, paddingBottom: insets.bottom + 120, paddingHorizontal: margin, alignItems: 'center' }}
          ListHeaderComponent={<Text style={[st.heading, { color: c.mut, marginBottom: 26 }]}>{book.title}</Text>}
          ListFooterComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <RoundButton big icon="check" label="Terminei" onPress={finish} />
            </View>
          }
          renderItem={({ item }) => block(item, false, false, false)}
        />
      ) : (
        <View
          style={[st.stage, full ? { top: insets.top + HEADER_H, bottom: insets.bottom + FOOTER_H } : { top: insets.top + 56, bottom: insets.bottom + 56 }]}
          onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          {...pan.panHandlers}
          accessibilityLabel={pages.slice(cur.start, cur.end).map(plain).join('\n')}
          accessibilityActions={[{ name: 'increment', label: 'Próxima página' }, { name: 'decrement', label: 'Página anterior' }]}
          onAccessibilityAction={(e) => go(e.nativeEvent.actionName === 'decrement' ? -1 : 1)}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={(e) => onStageTap(e.nativeEvent.pageX)} accessible={false} />
          {stage.h > 0 && layers.map((l) => {
            const scr = screenAt(l.start);
            const gs = groupsOf(scr);
            return (
              <Page key={l.key} dir={l.dir} leaving={l.leaving} offset={l.offset} onGone={() => removeLayer(l.key)} still={still}
                maxH={stage.h} top={full} drag={l.leaving ? null : drag} width={stage.w} lift={Math.round(stage.h * 0.06)}
                onFit={(big) => {
                  if (!big || l.leaving) return;
                  if (full) { if (squeeze > 0.6) setSqueeze((q) => Math.max(0.6, q - 0.05)); }
                  else if (fit > 0.62) setFit((f) => Math.max(0.62, f - 0.06));
                }}>
                <Pressable onPress={l.leaving ? undefined : (e) => onStageTap(e.nativeEvent.pageX)} accessible={false}
                  style={{ width: '100%', alignItems: 'center', paddingHorizontal: margin, cursor: 'auto' } as object}>
                  {!full && scr.start === 0 ? <Text style={[st.heading, { color: c.mut }]}>{book.title}</Text> : null}
                  {gs.map((g, k) => block(g, l.leaving, k === 0, full && !l.leaving))}
                </Pressable>
              </Page>
            );
          })}
        </View>
      )}

      {/* ---------- cabeçalho fino (fica no Modo Zen) ---------- */}
      <View style={[st.header, { top: insets.top + 8, left: margin, right: margin }]} pointerEvents="none">
        <Text style={[st.headerText, { color: c.mut }]} numberOfLines={1}>{chTitle}</Text>
      </View>
      {marked && !chrome ? (
        <View style={[st.ribbonAbs, { top: insets.top + 4 }]} accessibilityLabel="Página marcada" pointerEvents="none">
          <Icon name="bookmark" size={18} color={c.accent} filled />
        </View>
      ) : null}

      {/* ---------- rodapé fino (fica no Modo Zen) ---------- */}
      <View style={[st.mini, { bottom: insets.bottom + 8, left: margin, right: margin }]} pointerEvents="none"
        accessibilityLabel={`${chTitle}, ${chPct}% do capítulo, cerca de ${chLeft} restantes`}>
        <View style={[st.miniBar, { backgroundColor: c.btn }]}><View style={{ width: `${chPct}%`, height: '100%', backgroundColor: c.mut, opacity: 0.7 }} /></View>
        <Text style={[st.miniText, { color: c.mut }]} numberOfLines={1}>
          {chLeft} {chapters.length > 1 ? 'no capítulo' : 'restantes'} · {screenNo}/{screenCount}
        </Text>
      </View>

      {/* ---------- barras (por cima do texto; somem no Modo Zen) ---------- */}
      <Animated.View style={[st.top, fade, { paddingTop: insets.top + 8, backgroundColor: c.bg, borderBottomColor: c.line }]} pointerEvents={chrome ? 'box-none' : 'none'}>
        <View style={st.row}>
          <IconButton icon="back" label="Voltar à biblioteca" onPress={() => router.back()} plain />
          <Pressable style={{ flex: 1, gap: 6 }} onPress={() => setSheet('nav')} accessibilityRole="button" accessibilityLabel="Sumário e progresso">
            <Text style={[st.topTitle, { color: c.fg }]} numberOfLines={1}>{book.title}</Text>
            <Text style={[st.topSub, { color: c.mut }]} numberOfLines={1}>
              {chLeft} {chapters.length > 1 ? 'no capítulo' : 'restantes'} · {bookPct}% do livro
            </Text>
          </Pressable>
          <IconButton icon="bookmark" label={marked ? 'Remover marcador' : 'Marcar esta página'} onPress={toggleBookmark} plain
            active={!!marked} filled={!!marked} />
        </View>
        <ProgressBar pct={bookPct} height={2} />
      </Animated.View>

      <Animated.View style={[st.bottom, fade, { paddingBottom: insets.bottom + 14, backgroundColor: c.bg, borderTopColor: c.line }]} pointerEvents={chrome ? 'box-none' : 'none'}>
        {hint ? (
          <Text style={[st.foot, { color: c.mut }]}>
            {layout === 'scroll' ? 'Toque longo num parágrafo para grifar · nomes sublinhados mostram quem é'
              : 'Deslize para virar · toque longo para grifar'}
          </Text>
        ) : null}
        {dl ? <Text style={[st.foot, { color: c.fg }]} accessibilityLiveRegion="polite">{dl.msg}</Text> : null}
        <View style={st.controls}>
          <IconButton caption icon="type" label="Texto" onPress={() => setSheet('type')} />
          <IconButton caption icon={sound.focus ? 'target' : 'headphones'} label="Som" onPress={() => setSheet('audio')} />
          <IconButton caption icon="list" label="Sumário" onPress={() => setSheet('nav')} />
          <IconButton caption icon="search" label="Buscar" onPress={() => setSheet('search')} />
          <IconButton caption icon="notebook" label="Glossário" onPress={() => router.push({ pathname: '/glossary/[id]', params: { id, from: 'reader', at: String(idx) } })} />
        </View>
      </Animated.View>

      {/* ---------- som bloqueado pelo navegador ---------- */}
      {locked && !finished ? (
        <Pressable style={[st.unlock, { top: insets.top + 96, backgroundColor: c.accent }]} accessibilityRole="button"
          onPress={() => { engine.start(); setTimeout(() => setLocked(engine.needsUnlock), 300); }}>
          <Icon name="volume" size={17} color={c.onAccent} />
          <Text style={[st.unlockText, { color: c.onAccent }]}>Toque para ativar o som</Text>
        </Pressable>
      ) : null}

      {toast ? (
        <View style={[st.toast, { bottom: insets.bottom + 130, backgroundColor: c.surface, borderColor: c.line }]} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={[st.toastText, { color: c.fg }]}>{toast}</Text>
        </View>
      ) : null}

      {/* ---------- recapitulação ---------- */}
      {recap && recap.text ? (
        <View style={[StyleSheet.absoluteFill, st.recapWrap]} pointerEvents="box-none">
          <View style={[st.recap, { backgroundColor: c.surface, borderColor: c.line }]} accessibilityViewIsModal>
            <Text style={[st.recapKicker, { color: c.accent }]}>O QUE ACONTECEU ATÉ AQUI</Text>
            <Text style={{ fontFamily: READING_FONTS[type.font].regular, fontSize: 17, lineHeight: 26, color: c.fg }}>{recap.text}</Text>
            <Text style={[st.foot, { color: c.mut, textAlign: 'left' }]}>{recap.ai ? 'Resumo da IA, só com o que você já leu' : 'Trechos das últimas páginas que você leu'}</Text>
            <RoundButton big label="Continuar lendo" onPress={() => { engine.start(); act(); setRecap(null); }} />
          </View>
        </View>
      ) : null}

      <PresetSheet visible={askPreset && !recap} onDone={() => {
        setAskPreset(false);
        void track({ type: 'preset' }).catch(() => undefined);
        engine.start();
        act();
        void getRepo().then((r) => r.kvSet('sound:asked', '1'));
      }} />
      <AudioSheet visible={sheet === 'audio'} onClose={() => setSheet(null)} playing={playing} reported={reported}
        onReport={engine.libraryIdsPlaying().length ? () => {
          engine.libraryIdsPlaying().forEach((sid) => void activeLibrary.report(sid).catch(() => undefined));
          setReported(true);
          setTimeout(() => setReported(false), 4000);
        } : undefined} />
      <TypeSheet visible={sheet === 'type'} onClose={() => setSheet(null)} />
      <NavSheet visible={sheet === 'nav'} onClose={() => setSheet(null)} n={n} idx={idx} chapters={chapters} annotations={anns}
        chapterLabel={chapterLabel}
        onJump={(p) => { setSheet(null); act(); jumpTo(p); }}
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
          act();
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
          if (!prev) void track({ type: 'highlight', note: !!a.note }).then((r) => setTimeout(() => celebrate(r), 2800)).catch(() => undefined);
          say(a.note ? 'Nota salva' : 'Trecho grifado');
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
          void track({ type: 'glossary' }).then(celebrate).catch(() => undefined);
        }} />

      {finished && (
        <View style={[StyleSheet.absoluteFill, st.end, { backgroundColor: c.bg }]}>
          <Text style={[st.endTitle, { color: c.fg }]}>Fim</Text>
          <Text style={[st.topSub, { color: c.mut, fontSize: 17, textAlign: 'center' }]}>Você concluiu “{book.title}”.</Text>
          {endInfo ? (
            <View style={[st.endCard, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[st.endPts, { color: c.accent }]}>+{endInfo.points} pontos de leitura</Text>
              <Text style={[st.endLine, { color: c.mut }]}>
                {endInfo.level}{endInfo.streak > 0 ? ` · ${endInfo.streak} ${endInfo.streak === 1 ? 'dia seguido' : 'dias seguidos'}` : ''}
              </Text>
              {endInfo.badges.map((bid) => {
                const b = BADGES.find((x) => x.id === bid);
                return b ? (
                  <View key={bid} style={st.endBadge}>
                    <Icon name={b.icon as never} size={16} color={c.accent} />
                    <Text style={[st.endLine, { color: c.fg }]}>{b.title}</Text>
                  </View>
                ) : null;
              })}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
            <RoundButton big icon="retry" label="Ler de novo" onPress={() => {
              setFinished(false); finishedRef.current = false; pageSince.current = Date.now(); played.current.clear(); hold.current.reset(); idxRef.current = 0; setIdx(0); setFit(1);
              setLayers([{ key: ++keyRef.current, start: 0, dir: 1, leaving: false, offset: 0 }]);
              listRef.current?.scrollToOffset({ offset: 0, animated: false });
            }} />
            <RoundButton label="Biblioteca" onPress={() => router.back()} />
          </View>
        </View>
      )}
    </View>
  );
}

/** Rótulos do que está tocando (stems por prioridade + efeito da tela) — só no painel de som. */
function nowPlaying(mix: MixStem[], plan: ScenePlan): string[] {
  const a = mix.slice(0, 3).map((m) => LAYER_NAME[m.s as Layer]);
  const s = plan.spots.slice(0, 1).map((x) => SPOT_NAME[x.s]);
  return [...a, ...s];
}

const st = StyleSheet.create({
  stage: { position: 'absolute', left: 0, right: 0 },
  pageWrap: { justifyContent: 'center', alignItems: 'center' },
  pageTop: { justifyContent: 'flex-start' },
  bodyW: { maxWidth: 680, width: '100%' },
  heading: { fontFamily: FONTS.serifMedium, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 22 },
  header: { position: 'absolute', height: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  headerText: { fontFamily: FONTS.ui, fontSize: 11.5, letterSpacing: 0.4, textAlign: 'center', flexShrink: 1, opacity: 0.85 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 8, paddingBottom: 0, gap: 8, zIndex: 3, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topTitle: { fontFamily: FONTS.uiBold, fontSize: 15 },
  topSub: { fontFamily: FONTS.ui, fontSize: 12.5 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 10, paddingTop: 10, zIndex: 4, borderTopWidth: StyleSheet.hairlineWidth },
  controls: { flexDirection: 'row', gap: 4, justifyContent: 'space-around', width: '100%', maxWidth: 460, paddingHorizontal: 8 },
  foot: { fontFamily: FONTS.ui, fontSize: 12, letterSpacing: 0.2, textAlign: 'center', paddingHorizontal: 16 },
  mini: { position: 'absolute', gap: 4, zIndex: 2 },
  miniBar: { height: 2, borderRadius: 1, overflow: 'hidden' },
  miniText: { fontFamily: FONTS.ui, fontSize: 11, textAlign: 'center' },
  ribbonAbs: { position: 'absolute', right: 16, zIndex: 2 },
  unlock: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 99, zIndex: 6 },
  unlockText: { fontFamily: FONTS.uiBold, fontSize: 14 },
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 99, zIndex: 7, borderWidth: 1, maxWidth: '88%' },
  toastText: { fontFamily: FONTS.uiBold, fontSize: 14, textAlign: 'center' },
  recapWrap: { justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 20 },
  recap: { width: '100%', maxWidth: 520, borderRadius: 20, padding: 22, gap: 14, borderWidth: 1 },
  recapKicker: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1.4 },
  end: { alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 10 },
  endTitle: { fontFamily: FONTS.serifMedium, fontSize: 48 },
  endCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 14, gap: 8, alignItems: 'center', minWidth: 260, marginTop: 4 },
  endPts: { fontFamily: FONTS.uiBold, fontSize: 17 },
  endLine: { fontFamily: FONTS.ui, fontSize: 14 },
  endBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
