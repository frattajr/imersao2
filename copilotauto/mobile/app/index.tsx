import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api } from '../src/api';
import { parsePlate, parseVin } from '../src/ocr';
import { TERMS, TERMS_VERSION } from '../src/terms';
import { colors } from '../src/theme';

const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;

export default function Home() {
  const [accepted, setAccepted] = useState(false);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [km, setKm] = useState('');
  const [price, setPrice] = useState('');
  const [plate, setPlate] = useState('');
  const [vin, setVin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const y = digits(year);
  const valid = accepted && make.trim() && model.trim() && y >= 1980 && y <= new Date().getFullYear() + 1 && km !== '';

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const insp = await api.createInspection(
        {
          make: make.trim(),
          model: model.trim(),
          year: y,
          km: digits(km),
          asking_price: price ? digits(price) : null,
          plate: plate ? parsePlate(plate) : null,
          vin: vin ? parseVin(vin) : null,
        },
        TERMS_VERSION,
        new Date(),
      );
      router.push({ pathname: '/inspect/[id]', params: { id: insp.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Vistoria guiada antes da compra</Text>
        <Text style={s.lead}>
          Em cerca de 20 minutos, a câmera te guia por 20 fotos: motor, estrutura, pneus, lataria e cabine.
          No fim, você recebe os pontos de atenção e quanto eles podem valer na negociação.
        </Text>

        <Text style={s.h2}>O carro</Text>
        <Field label="Marca" value={make} onChange={setMake} placeholder="Volkswagen" />
        <Field label="Modelo e versão" value={model} onChange={setModel} placeholder="Gol 1.6 MSI" />
        <View style={s.row}>
          <Field label="Ano" value={year} onChange={setYear} placeholder="2018" numeric flex />
          <Field label="Km anunciado" value={km} onChange={setKm} placeholder="62000" numeric flex />
        </View>
        <Field label="Preço pedido (R$)" value={price} onChange={setPrice} placeholder="52000" numeric />
        <View style={s.row}>
          <Field label="Placa (opcional)" value={plate} onChange={setPlate} placeholder="ABC1D23" flex />
          <Field label="Chassi (opcional)" value={vin} onChange={setVin} placeholder="17 caracteres" flex />
        </View>

        <Text style={s.h2}>Antes de começar</Text>
        <View style={s.terms}>
          {TERMS.map((t) => (
            <Text key={t} style={s.term}>•  {t}</Text>
          ))}
        </View>
        <Pressable
          style={s.check}
          onPress={() => setAccepted((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
        >
          <View style={[s.box, accepted && s.boxOn]}>{accepted && <Text style={s.tick}>✓</Text>}</View>
          <Text style={s.checkText}>Li e entendi que o resultado é uma triagem visual, não um laudo.</Text>
        </Pressable>

        {error && <Text style={s.error}>{error}</Text>}
        <Pressable style={[s.cta, !valid && s.ctaOff]} disabled={!valid || busy} onPress={start}>
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={s.ctaText}>Começar vistoria</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  flex?: boolean;
}) {
  return (
    <View style={[s.field, p.flex && { flex: 1 }]}>
      <Text style={s.label}>{p.label}</Text>
      <TextInput
        style={s.input}
        value={p.value}
        onChangeText={p.onChange}
        placeholder={p.placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={p.numeric ? 'number-pad' : 'default'}
        autoCapitalize={p.numeric ? 'none' : 'characters'}
      />
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48 },
  h1: { color: colors.text, fontSize: 26, fontWeight: '700', marginBottom: 8 },
  lead: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  h2: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 28, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 12 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  terms: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 8 },
  term: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: colors.onAccent, fontWeight: '800' },
  checkText: { color: colors.text, flex: 1, fontSize: 14, lineHeight: 20 },
  error: { color: '#F0605D', marginTop: 16 },
  cta: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  ctaOff: { opacity: 0.4 },
  ctaText: { color: colors.onAccent, fontSize: 17, fontWeight: '700' },
});
