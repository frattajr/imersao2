/**
 * Configurações: som (volume, suavidade das transições, sons da história,
 * detalhes de ambiente, suavização automática), leitura e a chave da
 * ElevenLabs.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localSounds } from '../src/services/localSounds';
import { supabase } from '../src/services/supabase';
import { Choice, RoundButton } from '../src/ui/components';
import { OutputRow, PresetRow } from '../src/reader/PresetSheet';
import { TypeRows } from '../src/reader/TypeSheet';
import {
  BASE_FONT, DETAIL_LEVELS, FADE_LEVELS, FONTS, LEVELS, LINE_HEIGHTS, MARGINS, PARA_SPACING, READING_FONTS, SIZES, usePrefs, VOLUMES,
} from '../src/ui/prefs';

const VOLUME_LABEL = ['Baixo', 'Médio', 'Alto', 'Mudo'];
const LEVEL_LABEL = ['Mudo', '25%', '50%', '75%', '100%'];

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const { c } = usePrefs();
  return (
    <View style={[st.group, { backgroundColor: c.card }]}>
      <Text style={[st.gTitle, { color: c.fg }]}>{title}</Text>
      {hint ? <Text style={[st.hint, { color: c.mut }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/** Amostra do texto com a tipografia escolhida. */
function TypePreview() {
  const { c, type, sizeI } = usePrefs();
  const f = READING_FONTS[type.font];
  const size = BASE_FONT * SIZES[sizeI];
  const lh = size * LINE_HEIGHTS[type.lineI];
  const p = { fontFamily: f.regular, fontSize: size, lineHeight: lh, color: c.fg, textAlign: type.justify ? 'justify' as const : 'left' as const };
  const ind = type.book ? '\u2003\u2002' : '';
  return (
    <View style={[st.group, { backgroundColor: c.bg, paddingHorizontal: MARGINS[type.marginI], borderWidth: 1, borderColor: c.btn }]}>
      <Text style={p}>A chuva fina de outubro molhava as janelas do café quando Helena empurrou a porta.</Text>
      <Text style={[p, { marginTop: type.book ? 0 : lh * PARA_SPACING[type.paraI] }]}>{ind}O sino acima dela tilintou baixinho.</Text>
    </View>
  );
}

export default function Settings() {
  const { c, volI, setVol, sound, setSound } = usePrefs();
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState('');
  const [count, setCount] = useState(0);

  useEffect(() => {
    void localSounds.getKey().then(setKey);
    const refresh = () => void localSounds.list().then((l) => setCount(l.length));
    refresh();
    return localSounds.subscribe(refresh);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c.ov }}>
      <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
        <View style={st.head}>
          <RoundButton label="←" accessibilityLabel="Voltar" onPress={() => router.back()} />
          <Text style={[st.h1, { color: c.fg }]}>Configurações</Text>
        </View>

        <Text style={[st.section, { color: c.mut }]}>SOM</Text>
        <Group title="Estilo de som" hint="Um ponto de partida; os ajustes abaixo continuam valendo.">
          <PresetRow />
        </Group>
        <Group title="Ouvindo pelo" hint="No alto-falante do celular, graves e agudos extremos são cortados para não chiar.">
          <OutputRow />
        </Group>
        <Group title="Volume geral">
          <Choice value={volI} onChange={setVol} accessibilityLabel="Volume geral"
            options={VOLUMES.map((_, i) => ({ value: i, label: VOLUME_LABEL[i] }))} />
        </Group>
        <Group title="Ambiente (loops)" hint="Chuva, vento, lareira, taberna… tocando sem parar, baixinho.">
          <Choice value={sound.ambient} onChange={(v) => setSound({ ambient: v })} accessibilityLabel="Volume do ambiente"
            options={LEVELS.map((_, i) => ({ value: i, label: LEVEL_LABEL[i] }))} />
          <Choice value={sound.loops ? 1 : 0} onChange={(v) => setSound({ loops: v === 1 })} accessibilityLabel="Loops de ambiente"
            options={[{ value: 1, label: 'Loops ligados' }, { value: 0, label: 'Loops desligados' }]} />
        </Group>
        <Group title="Efeitos (SFX)" hint="Volume dos sons da cena e dos detalhes, separado do ambiente.">
          <Choice value={sound.sfx} onChange={(v) => setSound({ sfx: v })} accessibilityLabel="Volume dos efeitos"
            options={LEVELS.map((_, i) => ({ value: i, label: LEVEL_LABEL[i] }))} />
        </Group>
        <Group title="Modo foco" hint="Só o ambiente essencial, abafado e mais baixo, sem efeitos. Para estudar ou ler textos densos.">
          <Choice value={sound.focus ? 1 : 0} onChange={(v) => setSound({ focus: v === 1 })} accessibilityLabel="Modo foco"
            options={[{ value: 0, label: 'Desligado' }, { value: 1, label: 'Ligado' }]} />
        </Group>
        <Group title="Transições" hint="Quanto tempo o som leva para mudar quando a cena muda. Mais suave = trocas mais lentas e discretas.">
          <Choice value={sound.fade} onChange={(v) => setSound({ fade: v })} accessibilityLabel="Suavidade das transições"
            options={FADE_LEVELS.map((l, i) => ({ value: i, label: l.label }))} />
        </Group>
        <Group title="Detalhes de ambiente" hint="Rangidos, gotas, rajadas, folhas, coruja… tocam baixinho, de tempos em tempos.">
          <Choice value={sound.details} onChange={(v) => setSound({ details: v })} accessibilityLabel="Frequência dos detalhes de ambiente"
            options={DETAIL_LEVELS.map((l, i) => ({ value: i, label: l.label }))} />
        </Group>
        <Group title="Suavizar quando a cena muda muito" hint="Se a história troca de lugar várias vezes em pouco tempo, o som fica mais baixo e as trocas mais lentas.">
          <Choice value={sound.auto ? 1 : 0} onChange={(v) => setSound({ auto: v === 1 })} accessibilityLabel="Suavização automática"
            options={[{ value: 1, label: 'Ligada' }, { value: 0, label: 'Desligada' }]} />
        </Group>

        <Group title="Respiro" hint="Depois de alguns minutos no mesmo lugar, o ambiente desce devagar até quase sumir; volta quando a cena muda. Se você parar de ler, o som também desce.">
          <Choice value={sound.breathe ? 1 : 0} onChange={(v) => setSound({ breathe: v === 1 })} accessibilityLabel="Respiro"
            options={[{ value: 1, label: 'Ligado' }, { value: 0, label: 'Desligado' }]} />
        </Group>

        <Text style={[st.section, { color: c.mut }]}>LEITURA</Text>
        <Group title="Texto e tela">
          <TypeRows />
        </Group>
        <TypePreview />

        <Text style={[st.section, { color: c.mut }]}>SONS DA ELEVENLABS</Text>
        <Group title="Chave da ElevenLabs"
          hint={supabase
            ? 'O app usa o repositório do servidor. Esta chave vale só para testar sons neste aparelho.'
            : 'Fica salva só neste aparelho. Sons novos são gerados enquanto você lê; os que já existem vêm do repositório, sem custo.'}>
          <TextInput value={key} onChangeText={(k) => { setKey(k); void localSounds.setKey(k); }} placeholder="sk_…" placeholderTextColor={c.mut}
            secureTextEntry autoCapitalize="none" autoCorrect={false} style={[st.input, { color: c.fg, backgroundColor: c.btn }]} />
        </Group>
        <Group title={`Repositório de sons (${count})`} hint="Veja, ouça e teste os sons já criados, ou crie um novo descrevendo o som.">
          <RoundButton label="Abrir repositório de sons" onPress={() => router.push('/lab')} />
        </Group>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 12, maxWidth: 600, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 30 },
  section: { fontFamily: FONTS.uiBold, fontSize: 12.5, letterSpacing: 1.2, marginTop: 12, marginLeft: 4 },
  group: { borderRadius: 18, padding: 16, gap: 10 },
  gTitle: { fontFamily: FONTS.uiBold, fontSize: 16 },
  hint: { fontFamily: FONTS.ui, fontSize: 14, lineHeight: 20, marginTop: -4 },
  input: { fontFamily: FONTS.ui, fontSize: 16, minHeight: 48, borderRadius: 14, paddingHorizontal: 14 },
});
