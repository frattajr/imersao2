import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { FONTS, usePrefs } from './prefs';

export function RoundButton({ label, onPress, accessibilityLabel, style, big, disabled }: {
  label: string; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle>; big?: boolean; disabled?: boolean;
}) {
  const { c } = usePrefs();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: big ? c.fg : c.btn, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
        big && s.big,
        style,
      ]}
    >
      <Text style={[s.btnText, { color: big ? c.bg : c.fg, fontSize: big ? 17 : 16 }]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ pct, height = 4 }: { pct: number; height?: number }) {
  const { c } = usePrefs();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.btn, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: c.fg, opacity: 0.65, borderRadius: height }} />
    </View>
  );
}

export function BookCard({ emoji, tint, title, sub, pct, onPress, onLongPress, right }: {
  emoji: string; tint?: string; title: string; sub: string; pct?: number; onPress: PressableProps['onPress'];
  onLongPress?: PressableProps['onLongPress']; right?: ReactNode;
}) {
  const { c } = usePrefs();
  return (
    <View style={s.row}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${sub}`}
        style={({ pressed }) => [s.card, { backgroundColor: c.card, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[s.cover, { backgroundColor: tint ?? c.btn }]}>
          <Text style={{ fontSize: 30 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[s.title, { color: c.fg }]} numberOfLines={2}>{title}</Text>
          <Text style={[s.sub, { color: c.mut }]} numberOfLines={1}>{sub}</Text>
          {pct ? <View style={{ marginTop: 6 }}><ProgressBar pct={pct} /></View> : null}
        </View>
      </Pressable>
      {right}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const { c } = usePrefs();
  return <Text style={[s.sec, { color: c.mut }]}>{children}</Text>;
}

const s = StyleSheet.create({
  btn: { minWidth: 48, height: 48, borderRadius: 99, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  big: { height: 54, paddingHorizontal: 28 },
  btnText: { fontFamily: FONTS.uiBold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  card: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 92, padding: 12, paddingRight: 16, borderRadius: 20 },
  cover: { width: 68, height: 68, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.serifMedium, fontSize: 19, lineHeight: 24 },
  sub: { fontFamily: FONTS.ui, fontSize: 14 },
  sec: { fontFamily: FONTS.uiBold, fontSize: 12.5, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 14, marginLeft: 4 },
  choice: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { minHeight: 40, paddingHorizontal: 16, borderRadius: 99, justifyContent: 'center' },
  optText: { fontFamily: FONTS.uiBold, fontSize: 14.5 },
});

/** Escolha entre poucas opções (configurações, filtros). */
export function Choice<T extends string | number>({ options, value, onChange, accessibilityLabel }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; accessibilityLabel?: string;
}) {
  const { c } = usePrefs();
  return (
    <View style={s.choice} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ checked: on }}
            style={({ pressed }) => [s.opt, { backgroundColor: on ? c.fg : c.btn, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={[s.optText, { color: on ? c.bg : c.fg }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
