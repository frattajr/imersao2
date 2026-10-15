import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chunk } from '../src/core/text';
import { saveImported } from '../src/services/importer';
import { RoundButton } from '../src/ui/components';
import { FONTS, usePrefs } from '../src/ui/prefs';

export default function Paste() {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [hint, setHint] = useState('Cole seu texto aqui…');

  const startReading = async () => {
    const pages = chunk(text);
    if (!pages.length) { setHint('Cole um texto antes de começar.'); return; }
    const title = 'Texto: ' + text.trim().replace(/\s+/g, ' ').slice(0, 36);
    const meta = await saveImported(pages, title, 'Texto', 'pasted');
    router.replace(`/read/${encodeURIComponent(meta.id)}`);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[st.wrap, { backgroundColor: c.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
      <Text style={[st.h1, { color: c.fg }]}>Meu texto</Text>
      <Text style={[st.lead, { color: c.mut }]}>Cole seu texto. Cada parágrafo vira uma página.</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={hint}
        placeholderTextColor={c.mut}
        multiline
        textAlignVertical="top"
        style={[st.input, { color: c.fg, backgroundColor: c.surface, borderColor: c.line }]}
        accessibilityLabel="Seu texto"
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <RoundButton label="Voltar" onPress={() => router.back()} />
        <RoundButton big icon="play" label="Começar a ler" onPress={() => void startReading()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 27 },
  lead: { fontFamily: FONTS.ui, fontSize: 16, textAlign: 'center' },
  input: { flex: 1, width: '100%', maxWidth: 560, borderRadius: 16, borderWidth: 1, padding: 16, fontFamily: FONTS.serif, fontSize: 17, lineHeight: 26 },
});
