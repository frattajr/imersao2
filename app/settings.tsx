/**
 * Configurações, do mais usado ao mais técnico: leitura (tema, modo,
 * texto), som (estilo, volume, saída), meta diária, ajustes finos do som
 * (recolhidos), sons da ElevenLabs e créditos.
 */
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEVEL_LABEL } from '../src/reader/AudioSheet';
import { OutputRow, PresetRow } from '../src/reader/PresetSheet';
import { SheetRow } from '../src/reader/Sheet';
import { TypeRows } from '../src/reader/TypeSheet';
import { localSounds } from '../src/services/localSounds';
import { supabase } from '../src/services/supabase';
import { IconButton, RoundButton, Segmented, ToggleRow } from '../src/ui/components';
import { Icon } from '../src/ui/Icon';
import { GoalsRows, useJourney } from '../src/ui/journey';
import {
  BASE_FONT, DETAIL_LEVELS, FADE_LEVELS, FONTS, LEVELS, LINE_HEIGHTS, MARGINS, PARA_SPACING, READING_FONTS, SIZES, usePrefs, VOLUMES,
} from '../src/ui/prefs';

const VOLUME_LABEL = ['Baixo', 'Médio', 'Alto', 'Mudo'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { c } = usePrefs();
  return (
    <View style={{ gap: 10 }}>
      <Text style={[st.section, { color: c.fg }]}>{title}</Text>
      <View style={[st.group, { backgroundColor: c.surface, borderColor: c.line }]}>{children}</View>
    </View>
  );
}

/** Bloco que abre e fecha (ajustes finos). */
function Collapsible({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  const { c } = usePrefs();
  const [open, setOpen] = useState(false);
  return (
    <View style={[st.group, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={st.collHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[st.collTitle, { color: c.fg }]}>{title}</Text>
          <Text style={[st.hint, { color: c.mut }]}>{hint}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><Icon name="down" size={20} color={c.mut} /></View>
      </Pressable>
      {open ? children : null}
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
  const ind = type.book ? '  ' : '';
  return (
    <View style={[st.preview, { backgroundColor: c.bg, paddingHorizontal: MARGINS[type.marginI], borderColor: c.line }]}>
      <Text style={p}>A chuva fina de outubro molhava as janelas do café quando Helena empurrou a porta.</Text>
      <Text style={[p, { marginTop: type.book ? 0 : lh * PARA_SPACING[type.paraI] }]}>{ind}O sino acima dela tilintou baixinho.</Text>
    </View>
  );
}

export default function Settings() {
  const { c, volI, setVol, sound, setSound } = usePrefs();
  const journey = useJourney();
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState('');
  const [count, setCount] = useState(0);
  const lv = LEVELS.map((_, i) => ({ value: i, label: LEVEL_LABEL[i] }));

  useEffect(() => {
    void localSounds.getKey().then(setKey);
    const refresh = () => void localSounds.list().then((l) => setCount(l.length));
    refresh();
    return localSounds.subscribe(refresh);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 }]}>
        <View style={st.head}>
          <IconButton icon="back" label="Voltar" onPress={() => router.back()} />
          <Text style={[st.h1, { color: c.fg }]}>Configurações</Text>
        </View>

        <Section title="Leitura">
          <TypeRows />
          <TypePreview />
        </Section>

        <Section title="Som">
          <SheetRow label="Estilo" hint="Um ponto de partida; os ajustes finos continuam valendo.">
            <PresetRow />
          </SheetRow>
          <SheetRow label="Volume geral">
            <Segmented value={volI} onChange={setVol} accessibilityLabel="Volume geral"
              options={VOLUMES.map((_, i) => ({ value: i, label: VOLUME_LABEL[i] }))} />
          </SheetRow>
          <SheetRow label="Ouvindo pelo" hint="No alto-falante do celular, graves e agudos extremos são cortados para não chiar.">
            <OutputRow />
          </SheetRow>
        </Section>

        <Section title="Metas e lembrete">
          <GoalsRows j={journey} />
          <View style={{ alignItems: 'flex-start' }}>
            <RoundButton variant="ghost" icon="trophy" label="Ver sua jornada" onPress={() => router.push('/journey')} />
          </View>
        </Section>

        <Collapsible title="Ajustes finos do som" hint="Volumes separados, transições, detalhes e respiro.">
          <SheetRow label="Ambiente" hint="Chuva, vento, lareira, taberna… baixinho, sem parar.">
            <Segmented value={sound.ambient} onChange={(v) => setSound({ ambient: v })} accessibilityLabel="Volume do ambiente" options={lv} />
          </SheetRow>
          <SheetRow label="Efeitos" hint="Sons da cena e dos detalhes, separado do ambiente.">
            <Segmented value={sound.sfx} onChange={(v) => setSound({ sfx: v })} accessibilityLabel="Volume dos efeitos" options={lv} />
          </SheetRow>
          <SheetRow label="Transições" hint="Quanto tempo o som leva para mudar quando a cena muda.">
            <Segmented value={sound.fade} onChange={(v) => setSound({ fade: v })} accessibilityLabel="Suavidade das transições"
              options={FADE_LEVELS.map((l, i) => ({ value: i, label: l.label.replace('Muito suave', 'Lenta') }))} />
          </SheetRow>
          <SheetRow label="Detalhes de ambiente" hint="Rangidos, gotas, rajadas, coruja… de tempos em tempos.">
            <Segmented value={sound.details} onChange={(v) => setSound({ details: v })} accessibilityLabel="Frequência dos detalhes de ambiente"
              options={DETAIL_LEVELS.map((l, i) => ({ value: i, label: l.label.replace('Desligados', 'Nunca') }))} />
          </SheetRow>
          <View>
            <ToggleRow label="Ambiente contínuo" hint="Os loops de chuva, vento, lareira…" value={sound.loops} onChange={(v) => setSound({ loops: v })} />
            <ToggleRow label="Modo foco" hint="Só o essencial, abafado, sem efeitos. Para estudar ou ler textos densos." value={sound.focus} onChange={(v) => setSound({ focus: v })} />
            <ToggleRow label="Suavizar mudanças rápidas" hint="Se a história troca de lugar várias vezes seguidas, o som fica mais baixo e lento." value={sound.auto} onChange={(v) => setSound({ auto: v })} />
            <ToggleRow label="Respiro" hint="Depois de alguns minutos no mesmo lugar, o ambiente desce devagar; volta quando a cena muda." value={sound.breathe} onChange={(v) => setSound({ breathe: v })} />
          </View>
        </Collapsible>

        <Collapsible title="Sons da ElevenLabs" hint={`Chave para gerar sons novos · repositório com ${count} ${count === 1 ? 'som' : 'sons'}`}>
          <SheetRow label="Chave da ElevenLabs"
            hint={supabase
              ? 'O app usa o repositório do servidor. Esta chave vale só para testar sons neste aparelho.'
              : 'Fica salva só neste aparelho. Sons novos são gerados enquanto você lê; os que já existem vêm do repositório, sem custo.'}>
            <TextInput value={key} onChangeText={(k) => { setKey(k); void localSounds.setKey(k); }} placeholder="sk_…" placeholderTextColor={c.mut}
              secureTextEntry autoCapitalize="none" autoCorrect={false} style={[st.input, { color: c.fg, backgroundColor: c.bg, borderColor: c.line }]}
              accessibilityLabel="Chave da ElevenLabs" />
          </SheetRow>
          <View style={{ alignItems: 'flex-start' }}>
            <RoundButton icon="headphones" label="Abrir repositório de sons" onPress={() => router.push('/lab')} />
          </View>
        </Collapsible>

        <Section title="Fontes e créditos">
          <Text style={[st.hint, { color: c.mut }]}>
            Os clássicos são obras em domínio público. Os textos vêm do Project Gutenberg (gutenberg.org) e do Wikisource em português (pt.wikisource.org), passam por limpeza e têm a grafia atualizada pelo app. As capas do acervo vêm da Open Library (openlibrary.org). Os sons ambientes vêm do Freesound (freesound.org), todos em domínio público (CC0); autor e link de cada um ficam no pacote de sons. As traduções de Poe e Dickens e as sinopses foram escritas para o Imersão.
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 22, maxWidth: 600, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 27 },
  section: { fontFamily: FONTS.serifMedium, fontSize: 19, marginLeft: 4 },
  group: { borderRadius: 18, padding: 16, gap: 20, borderWidth: 1 },
  collHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  collTitle: { fontFamily: FONTS.uiBold, fontSize: 16 },
  hint: { fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 20 },
  preview: { borderRadius: 14, paddingVertical: 16, borderWidth: 1 },
  input: { fontFamily: FONTS.ui, fontSize: 16, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1 },
});
