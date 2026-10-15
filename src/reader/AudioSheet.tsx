/**
 * Painel de áudio do leitor (conforto acústico): volumes separados de
 * ambiente e efeitos, loops liga/desliga, modo foco, o que está tocando e
 * o aviso de "som ruim".
 */
import { Text, View } from 'react-native';
import { Choice, RoundButton } from '../ui/components';
import { FONTS, LEVELS, usePrefs } from '../ui/prefs';
import { OutputRow, PresetRow } from './PresetSheet';
import { Sheet, SheetRow } from './Sheet';

const LEVEL_LABEL = ['Mudo', '25%', '50%', '75%', '100%'];

export function AudioSheet({ visible, onClose, playing, onReport, reported }: {
  visible: boolean; onClose: () => void; playing: string[]; onReport?: () => void; reported: boolean;
}) {
  const { c, sound, setSound } = usePrefs();
  const lv = LEVELS.map((_, i) => ({ value: i, label: LEVEL_LABEL[i] }));
  return (
    <Sheet visible={visible} title="Som" onClose={onClose}>
      <SheetRow label="Estilo">
        <PresetRow />
      </SheetRow>
      <SheetRow label="Ouvindo pelo">
        <OutputRow />
      </SheetRow>
      <SheetRow label="Tocando agora">
        <Text style={{ fontFamily: FONTS.ui, fontSize: 15, color: c.mut }}>{playing.length ? playing.join('   ') : '🎧 silêncio'}</Text>
      </SheetRow>
      <SheetRow label="Ambiente (loops)">
        <Choice value={sound.ambient} onChange={(v) => setSound({ ambient: v })} options={lv} accessibilityLabel="Volume do ambiente" />
        <Choice value={sound.loops ? 1 : 0} onChange={(v) => setSound({ loops: v === 1 })} accessibilityLabel="Loops"
          options={[{ value: 1, label: 'Loops ligados' }, { value: 0, label: 'Desligados' }]} />
      </SheetRow>
      <SheetRow label="Efeitos (SFX)" hint="Passos, portas, sinos e os detalhes do lugar.">
        <Choice value={sound.sfx} onChange={(v) => setSound({ sfx: v })} options={lv} accessibilityLabel="Volume dos efeitos" />
      </SheetRow>
      <SheetRow label="Modo foco" hint="Só o ambiente essencial, abafado, sem efeitos.">
        <Choice value={sound.focus ? 1 : 0} onChange={(v) => setSound({ focus: v === 1 })} accessibilityLabel="Modo foco"
          options={[{ value: 0, label: 'Desligado' }, { value: 1, label: '🎯 Ligado' }]} />
      </SheetRow>
      <SheetRow label="Respiro" hint="Depois de alguns minutos no mesmo lugar, o ambiente desce devagar; volta quando a cena muda.">
        <Choice value={sound.breathe ? 1 : 0} onChange={(v) => setSound({ breathe: v === 1 })} accessibilityLabel="Respiro"
          options={[{ value: 1, label: 'Ligado' }, { value: 0, label: 'Desligado' }]} />
      </SheetRow>
      {onReport && (
        <View style={{ alignItems: 'flex-start' }}>
          <RoundButton label={reported ? 'Obrigado! Vamos trocar esse som.' : '👎 Algum som está ruim'} onPress={onReport} disabled={reported} />
        </View>
      )}
    </Sheet>
  );
}
