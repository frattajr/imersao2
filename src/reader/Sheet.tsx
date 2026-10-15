/** Painel que sobe de baixo (bottom sheet) discreto, fecha tocando fora ou no X. */
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../ui/components';
import { FONTS, usePrefs } from '../ui/prefs';

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Fechar painel" />
      <View style={[st.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 18, borderColor: c.line }]} accessibilityViewIsModal>
        <View style={[st.grip, { backgroundColor: c.mut }]} />
        <View style={st.head}>
          <Text style={[st.title, { color: c.fg }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
          <IconButton icon="close" label="Fechar" onPress={onClose} size={18} />
        </View>
        <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function SheetRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const { c } = usePrefs();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={[st.label, { color: c.mut }]}>{label.toUpperCase()}</Text>
        {hint ? <Text style={[st.hint, { color: c.mut }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, gap: 10, maxWidth: 640, alignSelf: 'center', width: '100%', borderTopWidth: 1 },
  grip: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, opacity: 0.35 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 },
  title: { fontFamily: FONTS.serifMedium, fontSize: 21, flexShrink: 1 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11.5, letterSpacing: 1.1 },
  hint: { fontFamily: FONTS.ui, fontSize: 13, lineHeight: 18 },
});
