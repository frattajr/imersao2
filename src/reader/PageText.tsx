/**
 * Texto de uma página/parágrafo com a tipografia escolhida e as entidades
 * (personagens, lugares, termos) tocáveis para o X-Ray. Os nomes ficam com
 * um sublinhado pontilhado bem discreto, para não poluir a leitura.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { segmentText } from '../core/xray';

export interface TypeStyle { fontFamily: string; fontSize: number; lineHeight: number; color: string; textAlign: TextStyle['textAlign'] }

export const PageText = memo(function PageText({ text, terms, style, mut, onTerm }: {
  text: string; terms: string[]; style: TypeStyle; mut: string; onTerm?: (term: string) => void;
}) {
  const segs = useMemo(() => segmentText(text, onTerm ? terms : []), [text, terms, onTerm]);
  return (
    <Text style={[st.body, style]} android_hyphenationFrequency="full" textBreakStrategy="highQuality" accessibilityRole="text" selectable={false}>
      {segs.map((s, i) => (s.term && onTerm ? (
        <Text key={i} onPress={() => onTerm(s.term!)} suppressHighlighting={false} accessibilityRole="button" accessibilityHint="Mostra quem é, sem spoilers"
          style={[st.term, { textDecorationColor: mut }]}>{s.t}</Text>
      ) : s.t))}
    </Text>
  );
});

const st = StyleSheet.create({
  body: { maxWidth: 680, width: '100%' },
  term: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
});
