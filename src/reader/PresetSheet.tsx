/**
 * Escolha do estilo de som na primeira leitura: Sutil (recomendado),
 * Cinematográfico, Só ambiente ou Silêncio, e se a pessoa está no
 * alto-falante do celular ou de fone. Dá para mudar depois no 🎧.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Choice } from '../ui/components';
import { FONTS, SOUND_PRESETS, usePrefs, type SoundPreset } from '../ui/prefs';
import { Sheet, SheetRow } from './Sheet';

export function PresetRow({ onPick }: { onPick?: (p: SoundPreset) => void }) {
  const { c, sound, volI, applyPreset } = usePrefs();
  const current: SoundPreset | undefined = volI === 3 ? 'silencio' : sound.preset;
  return (
    <View style={st.grid}>
      {(Object.keys(SOUND_PRESETS) as SoundPreset[]).map((k) => {
        const on = current === k;
        return (
          <Pressable key={k} onPress={() => { applyPreset(k); onPick?.(k); }} accessibilityRole="radio" accessibilityState={{ checked: on }}
            style={({ pressed }) => [st.card, { backgroundColor: on ? c.fg : c.btn, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={[st.label, { color: on ? c.bg : c.fg }]}>{SOUND_PRESETS[k].label}</Text>
            <Text style={[st.hint, { color: on ? c.bg : c.mut }]}>{SOUND_PRESETS[k].hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OutputRow() {
  const { sound, setSound } = usePrefs();
  return (
    <Choice value={sound.output} onChange={(v) => setSound({ output: v })} accessibilityLabel="Saída de som"
      options={[{ value: 'speaker', label: '📱 Alto-falante' }, { value: 'headphones', label: '🎧 Fone' }]} />
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
  card: { flexGrow: 1, flexBasis: '45%', minHeight: 84, borderRadius: 16, padding: 12, gap: 4 },
  label: { fontFamily: FONTS.uiBold, fontSize: 15.5 },
  hint: { fontFamily: FONTS.ui, fontSize: 13, lineHeight: 18 },
});
