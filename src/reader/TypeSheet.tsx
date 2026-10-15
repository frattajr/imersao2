/** Painel "Texto": tema, modo de leitura e tipografia sem sair da leitura. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RoundButton, Segmented, ToggleRow } from '../ui/components';
import { Icon } from '../ui/Icon';
import {
  FONTS, LAYOUT_LABEL, LAYOUTS, LINE_HEIGHTS, MARGIN_LABEL, MARGINS, PALETTES, PARA_LABEL, PARA_SPACING, READING_FONTS, resolveTheme, SIZES,
  THEME_CHOICES, THEME_LABEL, usePrefs, type ReadingFont,
} from '../ui/prefs';
import { Sheet, SheetRow } from './Sheet';

/** Temas como amostras: a cor do fundo com "Aa" na cor do texto. */
function ThemeSwatches() {
  const { c, theme, setTheme } = usePrefs();
  return (
    <View style={st.swatches} accessibilityRole="radiogroup" accessibilityLabel="Tema">
      {THEME_CHOICES.map((t) => {
        const on = theme === t;
        const pal = PALETTES[t === 'auto' ? resolveTheme('auto') : t];
        return (
          <Pressable key={t} onPress={() => setTheme(t)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t === 'auto' ? 'Automático: sépia de dia, escuro à noite' : THEME_LABEL[t]}
            style={({ pressed }) => [st.swatchWrap, { opacity: pressed ? 0.8 : 1 }]}>
            <View style={[st.swatch, { backgroundColor: pal.bg, borderColor: on ? c.accent : c.line, borderWidth: on ? 2 : 1 }]}>
              {t === 'auto'
                ? <Icon name="moon" size={16} color={pal.fg} />
                : <Text style={[st.swatchAa, { color: pal.fg }]}>Aa</Text>}
            </View>
            <Text style={[st.swatchLabel, { color: on ? c.accent : c.mut }]} numberOfLines={1}>{THEME_LABEL[t]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tamanho da letra: menor / maior, com o valor no meio. */
function SizeStepper() {
  const { c, sizeI, setSize } = usePrefs();
  const btn = (d: number, small: boolean) => (
    <Pressable onPress={() => setSize(sizeI + d)} disabled={d < 0 ? sizeI === 0 : sizeI === SIZES.length - 1} accessibilityRole="button"
      accessibilityLabel={d < 0 ? 'Letra menor' : 'Letra maior'}
      style={({ pressed }) => [st.stepBtn, { backgroundColor: c.btn, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[st.stepA, { color: c.fg, fontSize: small ? 14 : 21 }]}>A</Text>
    </Pressable>
  );
  return (
    <View style={st.stepper} accessibilityRole="adjustable" accessibilityLabel="Tamanho da letra"
      accessibilityValue={{ text: `${Math.round(SIZES[sizeI] * 100)}%` }}>
      {btn(-1, true)}
      <Text style={[st.stepVal, { color: c.fg }]}>{Math.round(SIZES[sizeI] * 100)}%</Text>
      {btn(1, false)}
    </View>
  );
}

/** Linhas de tipografia (usadas aqui e nas Configurações). */
export function TypeRows({ compact }: { compact?: boolean }) {
  const { c, type, setType, layout, setLayout } = usePrefs();
  const [more, setMore] = useState(false);
  return (
    <>
      <SheetRow label="Tema">
        <ThemeSwatches />
      </SheetRow>
      <SheetRow label="Modo de leitura" hint={compact ? undefined : 'Parágrafo: um trecho por tela, foco total. Página: como um livro. Rolagem: texto contínuo.'}>
        <Segmented value={layout} onChange={setLayout} options={LAYOUTS.map((l) => ({ value: l, label: LAYOUT_LABEL[l] }))} accessibilityLabel="Modo de leitura" />
      </SheetRow>
      <SheetRow label="Tamanho da letra">
        <SizeStepper />
      </SheetRow>
      <SheetRow label="Fonte">
        <Segmented value={type.font} onChange={(f: ReadingFont) => setType({ font: f })} accessibilityLabel="Fonte"
          options={(Object.keys(READING_FONTS) as ReadingFont[]).map((f) => ({ value: f, label: READING_FONTS[f].label }))} />
      </SheetRow>
      <Pressable onPress={() => setMore((m) => !m)} accessibilityRole="button" accessibilityState={{ expanded: more }} style={st.more}>
        <Text style={[st.moreText, { color: c.fg }]}>Mais ajustes de texto</Text>
        <View style={{ transform: [{ rotate: more ? '180deg' : '0deg' }] }}><Icon name="down" size={18} color={c.mut} /></View>
      </Pressable>
      {more && (
        <>
          <SheetRow label="Estilo" hint={compact ? undefined : 'Livro: recuo na primeira linha, sem espaço entre parágrafos e abertura de capítulo.'}>
            <Segmented value={type.book ? 1 : 0} onChange={(v) => setType({ book: v === 1 })} accessibilityLabel="Estilo"
              options={[{ value: 1, label: 'Livro' }, { value: 0, label: 'Tela' }]} />
          </SheetRow>
          {!type.book && (
            <SheetRow label="Espaço entre parágrafos">
              <Segmented value={type.paraI} onChange={(v) => setType({ paraI: v })} options={PARA_SPACING.map((_, i) => ({ value: i, label: PARA_LABEL[i] }))} />
            </SheetRow>
          )}
          <SheetRow label="Altura das linhas">
            <Segmented value={type.lineI} onChange={(v) => setType({ lineI: v })} accessibilityLabel="Altura das linhas"
              options={LINE_HEIGHTS.map((x, i) => ({ value: i, label: x.toFixed(1).replace('.', ',') }))} />
          </SheetRow>
          <SheetRow label="Margens">
            <Segmented value={type.marginI} onChange={(v) => setType({ marginI: v })} accessibilityLabel="Margens"
              options={MARGINS.map((_, i) => ({ value: i, label: MARGIN_LABEL[i] }))} />
          </SheetRow>
          <SheetRow label="Alinhamento" hint={compact ? undefined : 'No celular, à esquerda lê melhor; justificado usa hifenização onde o aparelho permite.'}>
            <Segmented value={type.justify ? 1 : 0} onChange={(v) => setType({ justify: v === 1 })} accessibilityLabel="Alinhamento"
              options={[{ value: 0, label: 'À esquerda' }, { value: 1, label: 'Justificado' }]} />
          </SheetRow>
          <View>
            <ToggleRow label="Animação ao virar" value={type.anim} onChange={(v) => setType({ anim: v })} />
            <ToggleRow label="Cor do clima" hint="Névoa de cor bem leve no alto da tela, conforme a cena." value={type.tint} onChange={(v) => setType({ tint: v })} />
          </View>
        </>
      )}
    </>
  );
}

export function TypeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title="Texto" onClose={onClose}>
      <TypeRows compact />
      <View style={{ alignItems: 'flex-start' }}>
        <RoundButton variant="ghost" icon="settings" label="Todas as configurações" onPress={() => { onClose(); router.push('/settings'); }} />
      </View>
    </Sheet>
  );
}

const st = StyleSheet.create({
  swatches: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  swatchWrap: { alignItems: 'center', gap: 6, flex: 1 },
  swatch: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  swatchAa: { fontFamily: FONTS.serifMedium, fontSize: 16 },
  swatchLabel: { fontFamily: FONTS.ui, fontSize: 11.5 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepA: { fontFamily: FONTS.serifMedium },
  stepVal: { fontFamily: FONTS.uiBold, fontSize: 15, minWidth: 56, textAlign: 'center' },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  moreText: { fontFamily: FONTS.uiBold, fontSize: 15 },
});
