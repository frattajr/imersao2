/**
 * Painel de som do leitor: o que está tocando, estilo, saída, volumes
 * separados de ambiente e efeitos, e as chaves (loops, foco, respiro). O
 * aviso de "som ruim" fica no fim.
 */
import { StyleSheet, Text, View } from 'react-native';
import { RoundButton, Segmented, ToggleRow } from '../ui/components';
import { Icon } from '../ui/Icon';
import { FONTS, LEVELS, usePrefs } from '../ui/prefs';
import { OutputRow, PresetRow } from './PresetSheet';
import { Sheet, SheetRow } from './Sheet';

export const LEVEL_LABEL = ['Mudo', '25%', '50%', '75%', '100%'];

export function AudioSheet({ visible, onClose, playing, onReport, reported }: {
  visible: boolean; onClose: () => void; playing: string[]; onReport?: () => void; reported: boolean;
}) {
  const { c, sound, setSound } = usePrefs();
  const lv = LEVELS.map((_, i) => ({ value: i, label: LEVEL_LABEL[i] }));
  return (
    <Sheet visible={visible} title="Som" onClose={onClose}>
      <View style={[st.now, { borderColor: c.line }]} accessibilityLabel={`Tocando agora: ${playing.length ? playing.join(', ') : 'silêncio'}`}>
        <Icon name="headphones" size={18} color={c.accent} />
        <Text style={[st.nowText, { color: c.fg }]} numberOfLines={2}>
          {playing.length ? playing.join(' · ') : 'Silêncio'}
        </Text>
      </View>
      <SheetRow label="Estilo">
        <PresetRow />
      </SheetRow>
      <SheetRow label="Ouvindo pelo">
        <OutputRow />
      </SheetRow>
      <SheetRow label="Ambiente">
        <Segmented value={sound.ambient} onChange={(v) => setSound({ ambient: v })} options={lv} accessibilityLabel="Volume do ambiente" />
      </SheetRow>
      <SheetRow label="Efeitos" hint="Passos, portas, sinos e os detalhes do lugar.">
        <Segmented value={sound.sfx} onChange={(v) => setSound({ sfx: v })} options={lv} accessibilityLabel="Volume dos efeitos" />
      </SheetRow>
      <View>
        <ToggleRow label="Ambiente contínuo" hint="Chuva, vento, lareira… tocando sem parar, baixinho." value={sound.loops} onChange={(v) => setSound({ loops: v })} />
        <ToggleRow label="Modo foco" hint="Só o essencial, abafado, sem efeitos." value={sound.focus} onChange={(v) => setSound({ focus: v })} />
        <ToggleRow label="Respiro" hint="O ambiente desce devagar se a cena demora; volta quando ela muda." value={sound.breathe} onChange={(v) => setSound({ breathe: v })} />
      </View>
      {onReport && (
        <View style={{ alignItems: 'flex-start' }}>
          <RoundButton variant="ghost" icon="flag" label={reported ? 'Obrigado! Vamos trocar esse som.' : 'Algum som está ruim'} onPress={onReport} disabled={reported} />
        </View>
      )}
    </Sheet>
  );
}

const st = StyleSheet.create({
  now: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  nowText: { fontFamily: FONTS.ui, fontSize: 14.5, flexShrink: 1 },
});
