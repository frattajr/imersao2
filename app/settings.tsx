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
import { DETAIL_LEVELS, FADE_LEVELS, FONTS, SIZES, SPOT_LEVELS, usePrefs, VOLUMES } from '../src/ui/prefs';

const VOLUME_LABEL = ['Baixo', 'Médio', 'Alto', 'Mudo'];

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

export default function Settings() {
  const { c, volI, setVol, sound, setSound, theme, setTheme, sizeI, setSize } = usePrefs();
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
        <Group title="Volume do ambiente">
          <Choice value={volI} onChange={setVol} accessibilityLabel="Volume do ambiente"
            options={VOLUMES.map((_, i) => ({ value: i, label: VOLUME_LABEL[i] }))} />
        </Group>
        <Group title="Transições" hint="Quanto tempo o som leva para mudar quando a cena muda. Mais suave = trocas mais lentas e discretas.">
          <Choice value={sound.fade} onChange={(v) => setSound({ fade: v })} accessibilityLabel="Suavidade das transições"
            options={FADE_LEVELS.map((l, i) => ({ value: i, label: l.label }))} />
        </Group>
        <Group title="Sons da história" hint="Passos, portas, rugidos, sinos… o que acontece na cena.">
          <Choice value={sound.spots} onChange={(v) => setSound({ spots: v })} accessibilityLabel="Volume dos sons da história"
            options={SPOT_LEVELS.map((l, i) => ({ value: i, label: l.label }))} />
        </Group>
        <Group title="Detalhes de ambiente" hint="Rangidos, gotas, rajadas, folhas, coruja… tocam baixinho, de tempos em tempos.">
          <Choice value={sound.details} onChange={(v) => setSound({ details: v })} accessibilityLabel="Frequência dos detalhes de ambiente"
            options={DETAIL_LEVELS.map((l, i) => ({ value: i, label: l.label }))} />
        </Group>
        <Group title="Suavizar quando a cena muda muito" hint="Se a história troca de lugar várias vezes em pouco tempo, o som fica mais baixo e as trocas mais lentas.">
          <Choice value={sound.auto ? 1 : 0} onChange={(v) => setSound({ auto: v === 1 })} accessibilityLabel="Suavização automática"
            options={[{ value: 1, label: 'Ligada' }, { value: 0, label: 'Desligada' }]} />
        </Group>

        <Text style={[st.section, { color: c.mut }]}>LEITURA</Text>
        <Group title="Tema">
          <Choice value={theme} onChange={setTheme} options={[{ value: 'dark', label: '☾ Escuro' }, { value: 'sepia', label: '☀ Sépia' }]} />
        </Group>
        <Group title="Tamanho da letra">
          <Choice value={sizeI} onChange={setSize} options={SIZES.map((_, i) => ({ value: i, label: ['A−−', 'A−', 'A', 'A+', 'A++'][i] }))} />
        </Group>

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
