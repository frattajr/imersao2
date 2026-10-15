/**
 * Barra de progresso arrastável: arraste para ver onde vai cair (capítulo e
 * %) e solte para pular. Também aceita toque direto num ponto da barra.
 */
import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { FONTS, usePrefs } from '../ui/prefs';

export function Scrubber({ value, max, label, onCommit }: {
  /** parágrafo atual (0..max-1) */
  value: number; max: number;
  /** texto mostrado para uma posição (ex.: "Capítulo 3 · 42%") */
  label: (pos: number) => string;
  onCommit: (pos: number) => void;
}) {
  const { c } = usePrefs();
  const w = useRef(1);
  const [drag, setDrag] = useState<number | null>(null);
  const posAt = (x: number) => Math.max(0, Math.min(max - 1, Math.round((x / Math.max(1, w.current)) * (max - 1))));
  const dragRef = useRef<number | null>(null);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { dragRef.current = posAt(e.nativeEvent.locationX); setDrag(dragRef.current); },
    onPanResponderMove: (e) => { dragRef.current = posAt(e.nativeEvent.locationX); setDrag(dragRef.current); },
    onPanResponderRelease: () => { if (dragRef.current != null) onCommit(dragRef.current); dragRef.current = null; setDrag(null); },
    onPanResponderTerminate: () => { dragRef.current = null; setDrag(null); },
  })).current;
  const shown = drag ?? value;
  const pct = max > 1 ? (shown / (max - 1)) * 100 : 0;
  return (
    <View style={{ gap: 8 }}>
      <Text style={[st.label, { color: drag != null ? c.fg : c.mut }]} accessibilityLiveRegion="polite">{label(shown)}</Text>
      <View
        style={st.hit}
        onLayout={(e: LayoutChangeEvent) => (w.current = e.nativeEvent.layout.width)}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Posição no livro"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onCommit(Math.max(0, Math.min(max - 1, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1) * Math.max(1, Math.round(max / 50)))))}
      >
        <View style={[st.track, { backgroundColor: c.btn }]} pointerEvents="none">
          <View style={[st.fill, { width: `${pct}%`, backgroundColor: c.accent }]} />
        </View>
        <View style={[st.knob, { left: `${pct}%`, backgroundColor: c.accent, borderColor: c.surface }]} pointerEvents="none" />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: FONTS.uiBold, fontSize: 14 },
  hit: { height: 34, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', opacity: 0.85 },
  knob: { position: 'absolute', width: 20, height: 20, borderRadius: 10, marginLeft: -10, borderWidth: 3 },
});
