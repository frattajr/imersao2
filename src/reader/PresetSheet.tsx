/**
 * Escolha do estilo de som na primeira leitura: Sutil (recomendado),
 * Cinema, Só ambiente ou Silêncio, e se a pessoa está no alto-falante do
 * celular ou de fone. Dá para mudar depois no painel de som.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../ui/components';
import { Icon } from '../ui/Icon';
import { FONTS, SOUND_PRESETS, usePrefs, type SoundPreset } from '../ui/prefs';
import { Sheet, SheetRow } from './Sheet';

export function PresetRow({ onPick }: { onPick?: (p: SoundPreset) => void }) {
  const { c, sound, volI, applyPreset } = usePrefs();
  const current: SoundPreset | undefined = volI === 3 ? 'silencio' : sound.preset;
  return (
    <View style={st.grid} accessibilityRole="radiogroup" accessibilityLabel="Estilo de som">
      {(Object.keys(SOUND_PRESETS) as SoundPreset[]).map((k) => {
        const on = current === k;
        const p = SOUND_PRESETS[k];
        return (
          <Pressable key={k} onPress={() => { applyPreset(k); onPick?.(k); }} accessibilityRole="radio" accessibilityState={{ checked: on }}
            accessibilityLabel={`${p.label}. ${p.hint}`}
            style={({ pressed }) => [st.card, { backgroundColor: on ? c.accentSoft : c.btn, borderColor: on ? c.accent : 'transparent', opacity: pressed ? 0.85 : 1 }]}>
            <View style={st.head}>
              <Icon name={p.icon} size={18} color={on ? c.accent : c.fg} />
              <Text style={[st.label, { color: on ? c.accent : c.fg }]}>{p.label}</Text>
            </View>
            <Text style={[st.hint, { color: c.mut }]}>{p.hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OutputRow() {
  const { sound, setSound } = usePrefs();
  return (
    <Segmented value={sound.output} onChange={(v) => setSound({ output: v })} accessibilityLabel="Saída de som"
      options={[{ value: 'speaker', label: 'Alto-falante' }, { value: 'headphones', label: 'Fone de ouvido' }]} />
  );
}

export function PresetSheet({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  return (
    <Sheet visible={visible} title="Como você quer o som?" onClose={onDone}>
      <PresetRow onPick={() => setTimeout(onDone, 250)} />
      <SheetRow label="Você está ouvindo pelo" hint="No alto-falante do celular o som é ajustado para não chiar.">
        <OutputRow />
      </SheetRow>
    </Sheet>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: '45%', minHeight: 82, borderRadius: 16, padding: 12, gap: 6, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: FONTS.uiBold, fontSize: 15 },
  hint: { fontFamily: FONTS.ui, fontSize: 12.5, lineHeight: 17 },
});
