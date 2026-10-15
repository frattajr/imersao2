/**
 * Texto de leitura com a tipografia escolhida, as entidades do X-Ray
 * tocáveis (sublinhado pontilhado discreto) e os grifos coloridos (com ✎
 * quando têm nota).
 *
 * - `PageSpans`: um pedaço de parágrafo, aninhável. Os pedaços de um mesmo
 *   parágrafo (que foi dividido em páginas) são desenhados dentro do mesmo
 *   bloco de texto (`ParaBlock`), então o parágrafo corre inteiro.
 * - Toque: vira a página / mostra as barras; toque longo: abre a seleção do
 *   pedaço tocado. No celular usa onPress/onLongPress do próprio Text; na
 *   web (que não tem toque longo em texto) usa o sistema de "responder".
 * - Estilo livro: recuo na primeira linha; abertura de capítulo com título
 *   e as primeiras palavras em versalete.
 */
import { memo, useMemo } from 'react';
import { Platform, StyleSheet, Text, type GestureResponderEvent, type TextStyle } from 'react-native';
import { applyHighlights, HIGHLIGHT_BG, type Annotation, type Span } from '../core/annotations';
import { plain } from '../core/text';
import { segmentText } from '../core/xray';

export interface TypeStyle { fontFamily: string; fontSize: number; lineHeight: number; color: string; textAlign: TextStyle['textAlign'] }

/** Recuo da primeira linha (1,5 em). */
const INDENT = '  ';
const LONG_MS = 420;
const MOVE_TOL = 10;

export interface PressHandlers { onTap: (pageX: number) => void; onLong?: () => void }

/* um gesto por vez: estado do toque em andamento (web) */
let gesture: { timer: ReturnType<typeof setTimeout> | null; fired: boolean; x: number; y: number } | null = null;
const endGesture = () => { if (gesture?.timer) clearTimeout(gesture.timer); gesture = null; };
/** toque num nome do X-Ray ou num grifo: o toque no parágrafo (virar página) não vale */
let innerAt = 0;
const inner = <T,>(fn: (x: T) => void) => (x: T) => { innerAt = Date.now(); fn(x); };

/** Props de toque/toque longo para um Text (funciona aninhado, inclusive na web). */
export function pressProps(h: PressHandlers): Record<string, unknown> {
  if (Platform.OS !== 'web') {
    return { onPress: (e: GestureResponderEvent) => h.onTap(e.nativeEvent.pageX), onLongPress: h.onLong, delayLongPress: LONG_MS };
  }
  return {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => true,
    onResponderGrant: (e: GestureResponderEvent) => {
      endGesture();
      const g = { timer: null as ReturnType<typeof setTimeout> | null, fired: false, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      if (h.onLong) g.timer = setTimeout(() => { g.fired = true; h.onLong?.(); }, LONG_MS);
      gesture = g;
    },
    onResponderMove: (e: GestureResponderEvent) => {
      if (gesture && (Math.abs(e.nativeEvent.pageX - gesture.x) > MOVE_TOL || Math.abs(e.nativeEvent.pageY - gesture.y) > MOVE_TOL) && gesture.timer) {
        clearTimeout(gesture.timer);
        gesture.timer = null;
      }
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const g = gesture;
      endGesture();
      const x = e.nativeEvent.pageX;
      // o clique do nome/grifo chega logo depois: espera um instante para saber
      if (g && !g.fired) setTimeout(() => { if (Date.now() - innerAt > 250) h.onTap(x); }, 0);
    },
    onResponderTerminate: endGesture,
  };
}

/** Corta os pedaços na posição k (para destacar as primeiras palavras). */
function cutAt(spans: Span[], k: number): { s: Span; lead: boolean }[] {
  const out: { s: Span; lead: boolean }[] = [];
  let pos = 0;
  for (const s of spans) {
    const end = pos + s.t.length;
    if (end <= k) out.push({ s, lead: true });
    else if (pos >= k) out.push({ s, lead: false });
    else {
      out.push({ s: { ...s, t: s.t.slice(0, k - pos) }, lead: true }, { s: { ...s, t: s.t.slice(k - pos) }, lead: false });
    }
    pos = end;
  }
  return out;
}

/** Um pedaço de parágrafo (aninhável dentro de um bloco de texto). */
export const PageSpans = memo(function PageSpans({ text, terms, mut, onTerm, highlights, onHighlight, lead, press }: {
  text: string; terms: string[]; mut: string; onTerm?: (term: string) => void;
  highlights?: Annotation[]; onHighlight?: (id: string) => void;
  /** estilo das primeiras palavras (abertura de capítulo) */
  lead?: TextStyle;
  press?: PressHandlers;
}) {
  const t = plain(text);
  const parts = useMemo(() => {
    const spans = applyHighlights(segmentText(t, onTerm ? terms : []), highlights ?? []);
    const k = lead ? Math.min(28, /^\s*\S+(\s+\S+)?/.exec(t)?.[0].length ?? 0) : 0;
    return cutAt(spans, k);
  }, [t, terms, onTerm, highlights, lead]);
  // último pedaço de cada grifo (onde vai o ✎ da nota)
  const lastOf = useMemo(() => { const m = new Map<string, number>(); parts.forEach((x, i) => { if (x.s.hlId) m.set(x.s.hlId, i); }); return m; }, [parts]);
  const pp = useMemo(() => (press ? pressProps(press) : {}), [press]);
  return (
    <Text {...pp}>
      {parts.map(({ s, lead: isLead }, i) => {
        const hl = s.hl ? { backgroundColor: HIGHLIGHT_BG[s.hl] } : null;
        const ls = isLead ? lead : null;
        if (s.term && onTerm) {
          return (
            <Text key={i} onPress={inner(() => onTerm(s.term!))} accessibilityRole="button" accessibilityHint="Mostra quem é, sem spoilers"
              style={[st.term, { textDecorationColor: mut }, hl, ls]}>{s.t}</Text>
          );
        }
        if (s.hl) {
          return (
            <Text key={i} style={[hl, ls]} onPress={onHighlight && s.hlId ? inner(() => onHighlight(s.hlId!)) : undefined}
              accessibilityHint={s.note ? 'Trecho grifado com nota' : 'Trecho grifado'}>
              {s.t}{s.note && lastOf.get(s.hlId!) === i ? <Text style={[st.noteMark, { color: mut }]}> ✎</Text> : null}
            </Text>
          );
        }
        return ls ? <Text key={i} style={ls}>{s.t}</Text> : s.t;
      })}
    </Text>
  );
});

/** Hifenização: Android nativo; na web, CSS com o idioma do texto. */
const WEB_TEXT = (Platform.OS === 'web' ? { hyphens: 'auto', WebkitHyphens: 'auto' } : {}) as unknown as TextStyle;
const LANG = Platform.OS === 'web' ? ({ lang: 'pt-BR' } as Record<string, string>) : {};

export interface PieceProps {
  page: number;
  text: string;
  highlights?: Annotation[];
}

/**
 * Um parágrafo inteiro: um ou mais pedaços (páginas) no mesmo bloco de
 * texto. `indent` = recuo da primeira linha; `lead` = abertura de capítulo.
 */
export const ParaBlock = memo(function ParaBlock({ pieces, style, mut, terms, onTerm, onHighlight, indent, lead, pressFor, extra }: {
  pieces: PieceProps[]; style: TypeStyle; mut: string; terms: string[]; onTerm?: (t: string) => void; onHighlight?: (id: string) => void;
  indent?: boolean; lead?: TextStyle; pressFor?: (page: number) => PressHandlers; extra?: TextStyle;
}) {
  return (
    <Text style={[st.body, style, WEB_TEXT, extra]} {...LANG} android_hyphenationFrequency="full" textBreakStrategy="highQuality" accessibilityRole="text" selectable={false}>
      {indent ? INDENT : null}
      {pieces.map((p, i) => (
        <Text key={p.page}>
          {i > 0 ? ' ' : null}
          <PageSpans text={p.text} terms={terms} mut={mut} onTerm={onTerm} highlights={p.highlights} onHighlight={onHighlight}
            lead={i === 0 ? lead : undefined} press={pressFor?.(p.page)} />
        </Text>
      ))}
    </Text>
  );
});

/** Compatível com o uso antigo: um parágrafo, um pedaço. */
export const PageText = memo(function PageText({ text, terms, style, mut, onTerm, highlights, onHighlight }: {
  text: string; terms: string[]; style: TypeStyle; mut: string; onTerm?: (term: string) => void;
  highlights?: Annotation[]; onHighlight?: (id: string) => void;
}) {
  return <ParaBlock pieces={[{ page: 0, text, highlights }]} style={style} mut={mut} terms={terms} onTerm={onTerm} onHighlight={onHighlight} />;
});

const st = StyleSheet.create({
  body: { maxWidth: 680, width: '100%' },
  term: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  noteMark: { fontSize: 13 },
});
