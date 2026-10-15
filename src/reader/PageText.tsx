/**
 * Texto de um parágrafo com a tipografia escolhida, as entidades do X-Ray
 * tocáveis (sublinhado pontilhado discreto) e os grifos coloridos (com ✎
 * quando têm nota). Toque longo no parágrafo abre a seleção de trecho.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { applyHighlights, HIGHLIGHT_BG, type Annotation } from '../core/annotations';
import { segmentText } from '../core/xray';

export interface TypeStyle { fontFamily: string; fontSize: number; lineHeight: number; color: string; textAlign: TextStyle['textAlign'] }

export const PageText = memo(function PageText({ text, terms, style, mut, onTerm, highlights, onHighlight }: {
  text: string; terms: string[]; style: TypeStyle; mut: string; onTerm?: (term: string) => void;
  highlights?: Annotation[]; onHighlight?: (id: string) => void;
}) {
  const spans = useMemo(() => applyHighlights(segmentText(text, onTerm ? terms : []), highlights ?? []), [text, terms, onTerm, highlights]);
  // último pedaço de cada grifo (onde vai o ✎ da nota)
  const lastOf = useMemo(() => { const m = new Map<string, number>(); spans.forEach((x, i) => { if (x.hlId) m.set(x.hlId, i); }); return m; }, [spans]);
  return (
    <Text style={[st.body, style]} android_hyphenationFrequency="full" textBreakStrategy="highQuality" accessibilityRole="text" selectable={false}>
      {spans.map((s, i) => {
        const hl = s.hl ? { backgroundColor: HIGHLIGHT_BG[s.hl] } : null;
        if (s.term && onTerm) {
          return (
            <Text key={i} onPress={() => onTerm(s.term!)} accessibilityRole="button" accessibilityHint="Mostra quem é, sem spoilers"
              style={[st.term, { textDecorationColor: mut }, hl]}>{s.t}</Text>
          );
        }
        if (s.hl) {
          return (
            <Text key={i} style={hl} onPress={onHighlight && s.hlId ? () => onHighlight(s.hlId!) : undefined}
              accessibilityHint={s.note ? 'Trecho grifado com nota' : 'Trecho grifado'}>
              {s.t}{s.note && lastOf.get(s.hlId!) === i ? <Text style={[st.noteMark, { color: mut }]}> ✎</Text> : null}
            </Text>
          );
        }
        return s.t;
      })}
    </Text>
  );
});

const st = StyleSheet.create({
  body: { maxWidth: 680, width: '100%' },
  term: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  noteMark: { fontSize: 13 },
});
