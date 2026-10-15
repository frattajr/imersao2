/**
 * Peças de interface comuns. Visual: superfícies neutras, uma só cor de
 * destaque (botão principal e opção escolhida), ícones de traço e cantos
 * arredondados.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { FONTS, usePrefs } from './prefs';

type Variant = 'primary' | 'secondary' | 'ghost';

/**
 * Botão. `big` = principal (cor de destaque). `icon` à esquerda do texto.
 * O nome ficou por compatibilidade: o formato é de pílula.
 */
export function RoundButton({ label, onPress, accessibilityLabel, style, big, disabled, icon, variant }: {
  label: string; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle>; big?: boolean; disabled?: boolean;
  icon?: IconName; variant?: Variant;
}) {
  const { c } = usePrefs();
  const v: Variant = variant ?? (big ? 'primary' : 'secondary');
  const bg = v === 'primary' ? c.accent : v === 'secondary' ? c.btn : 'transparent';
  const fg = v === 'primary' ? c.onAccent : c.fg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        big && s.big,
        v === 'ghost' && s.ghost,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={big ? 20 : 18} color={fg} /> : null}
      {label ? <Text style={[s.btnText, { color: fg, fontSize: big ? 16.5 : 15 }]}>{label}</Text> : null}
    </Pressable>
  );
}

/** Botão só com ícone (barras, cabeçalhos). `label` vira o rótulo de acessibilidade, ou aparece embaixo com `caption`. */
export function IconButton({ icon, label, onPress, caption, active, filled, size = 22, style, plain }: {
  icon: IconName; label: string; onPress?: () => void; caption?: boolean; active?: boolean; filled?: boolean; size?: number;
  style?: StyleProp<ViewStyle>;
  /** sem fundo (cabeçalho por cima de imagem usa fundo) */
  plain?: boolean;
}) {
  const { c } = usePrefs();
  const color = active ? c.accent : c.fg;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => [caption ? s.iconCap : [s.icon, !plain && { backgroundColor: c.btn }], { opacity: pressed ? 0.6 : 1 }, style]}>
      <Icon name={icon} size={size} color={color} filled={filled} />
      {caption ? <Text style={[s.cap, { color: active ? c.accent : c.mut }]} numberOfLines={1}>{label}</Text> : null}
    </Pressable>
  );
}

export function ProgressBar({ pct, height = 4 }: { pct: number; height?: number }) {
  const { c } = usePrefs();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.btn, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: c.accent, opacity: 0.85, borderRadius: height }} />
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
        style={({ pressed }) => [s.card, { backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[s.cover, { backgroundColor: tint ?? c.btn }]}>
          <Text style={{ fontSize: 26 }}>{emoji}</Text>
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

/** Escolha entre várias opções que quebram linha (chips). */
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
            style={({ pressed }) => [s.opt, { backgroundColor: on ? c.accentSoft : c.btn, borderColor: on ? c.accent : 'transparent', opacity: pressed ? 0.8 : 1 }]}>
            <Text style={[s.optText, { color: on ? c.accent : c.fg }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Controle segmentado: poucas opções curtas, numa linha só. */
export function Segmented<T extends string | number>({ options, value, onChange, accessibilityLabel }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; accessibilityLabel?: string;
}) {
  const { c } = usePrefs();
  return (
    <View style={[s.seg, { backgroundColor: c.btn }]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [s.segItem, on && { backgroundColor: c.surface, borderColor: c.line }, { opacity: pressed ? 0.75 : 1 }]}>
            <Text style={[s.segText, { color: on ? c.fg : c.mut }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Linha de ajuste liga/desliga: título, explicação curta e a chave. */
export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { c } = usePrefs();
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}
      style={s.toggle}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.tLabel, { color: c.fg }]}>{label}</Text>
        {hint ? <Text style={[s.tHint, { color: c.mut }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: c.mut + '59', true: c.accent }}
        thumbColor="#faf7f0" {...({ activeThumbColor: '#faf7f0' } as object)} accessible={false} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { minWidth: 44, height: 46, borderRadius: 99, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  big: { height: 52, paddingHorizontal: 26 },
  ghost: { paddingHorizontal: 10 },
  btnText: { fontFamily: FONTS.uiBold },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconCap: { minWidth: 56, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  cap: { fontFamily: FONTS.ui, fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  card: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 88, padding: 12, paddingRight: 16, borderRadius: 18 },
  cover: { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.serifMedium, fontSize: 18, lineHeight: 23 },
  sub: { fontFamily: FONTS.ui, fontSize: 14 },
  sec: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 14, marginLeft: 4 },
  choice: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { minHeight: 38, paddingHorizontal: 14, borderRadius: 99, justifyContent: 'center', borderWidth: 1 },
  optText: { fontFamily: FONTS.uiBold, fontSize: 14 },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 2 },
  segItem: { flex: 1, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: 'transparent' },
  segText: { fontFamily: FONTS.uiBold, fontSize: 13.5 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 },
  tLabel: { fontFamily: FONTS.uiBold, fontSize: 15 },
  tHint: { fontFamily: FONTS.ui, fontSize: 13, lineHeight: 18 },
});
