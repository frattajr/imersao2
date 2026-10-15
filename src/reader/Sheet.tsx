/** Painel que sobe de baixo (bottom sheet) discreto, fecha tocando fora. */
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS, usePrefs } from '../ui/prefs';

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Fechar painel" />
      <View style={[st.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + 18, borderColor: c.btn }]} accessibilityViewIsModal>
        <View style={[st.grip, { backgroundColor: c.mut }]} />
        <Text style={[st.title, { color: c.fg }]} accessibilityRole="header">{title}</Text>
        <ScrollView contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function SheetRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const { c } = usePrefs();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[st.label, { color: c.fg }]}>{label}</Text>
      {hint ? <Text style={[st.hint, { color: c.mut }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '78%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, gap: 12, maxWidth: 640, alignSelf: 'center', width: '100%', borderTopWidth: 1 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, opacity: 0.4 },
  title: { fontFamily: FONTS.serifMedium, fontSize: 21 },
  label: { fontFamily: FONTS.uiBold, fontSize: 15 },
  hint: { fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 19, marginTop: -4 },
});
