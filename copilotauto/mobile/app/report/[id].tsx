import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/api';
import { brl, colors, STATUS } from '../../src/theme';
import type { Report } from '../../src/types';

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.report(id).then(setReport, (e) => setError(String(e?.message ?? e)));
  }, [id]);

  if (error) return <Text style={[s.body, s.pad]}>Não foi possível carregar: {error}</Text>;
  if (!report) return <ActivityIndicator style={{ marginTop: 48 }} color={colors.accent} />;

  const n = report.negotiation;
  const v = report.inspection.vehicle;

  async function copyScript() {
    const lines = [
      `Vistoria do ${v.make} ${v.model} ${v.year}:`,
      ...n.levers.map((l) => `• ${l.argument}`),
      n.suggested_offer ? `Minha proposta: ${brl(n.suggested_offer)}.` : '',
    ].filter(Boolean);
    await Clipboard.setStringAsync(lines.join('\n'));
    setCopied(true);
  }

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.kicker}>{v.make} · {v.year} · {v.km.toLocaleString('pt-BR')} km</Text>
      <Text style={s.h1}>{v.model}</Text>

      {n.recommend_professional_inspection && (
        <View style={[s.card, { borderColor: STATUS.RED.color }]}>
          <Text style={[s.h2, { color: STATUS.RED.color, marginTop: 0 }]}>Confirme com um profissional</Text>
          <Text style={s.body}>{n.recommendation}</Text>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.label}>Custo estimado dos pontos encontrados</Text>
        <Text style={s.big}>{brl(n.total_cost_min)} – {brl(n.total_cost_max)}</Text>
        {n.asking_price != null && n.suggested_offer != null && (
          <View style={s.offerRow}>
            <Stat label="Pedido" value={brl(n.asking_price)} />
            <Stat label="Oferta sugerida" value={brl(n.suggested_offer)} accent />
            <Stat label="Desistir acima de" value={brl(n.walk_away_price ?? n.asking_price)} />
          </View>
        )}
        {n.discount_capped && (
          <Text style={s.small}>Desconto limitado a 25% do preço pedido para manter a proposta crível.</Text>
        )}
        {!n.recommend_professional_inspection && <Text style={[s.body, { marginTop: 12 }]}>{n.recommendation}</Text>}
      </View>

      {n.levers.length > 0 && (
        <>
          <Text style={s.h2}>Argumentos, do mais forte ao mais fraco</Text>
          {n.levers.map((l) => (
            <View key={`${l.component_id}:${l.position ?? ''}`} style={s.lever}>
              <View style={[s.dot, { backgroundColor: STATUS[l.status].color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.leverLabel}>{l.label}</Text>
                <Text style={s.small}>{brl(l.cost_min)} – {brl(l.cost_max)}</Text>
              </View>
            </View>
          ))}
          <Pressable style={s.cta} onPress={copyScript}>
            <Text style={s.ctaText}>{copied ? 'Copiado!' : 'Copiar argumentos para enviar ao vendedor'}</Text>
          </Pressable>
        </>
      )}

      {report.missing_components.length > 0 && (
        <>
          <Text style={s.h2}>Itens sem resultado ({report.missing_components.length})</Text>
          <Text style={s.small}>
            Pulados ou inconclusivos. Sem foto avaliada, não há conclusão sobre eles:{' '}
            {report.missing_components.join('; ')}.
          </Text>
        </>
      )}

      <Text style={[s.small, { marginTop: 28 }]}>{report.legal_notice}</Text>
    </ScrollView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.small}>{label}</Text>
      <Text style={[s.statValue, accent && { color: colors.accent }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 48 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  h1: { color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 4, marginBottom: 16 },
  h2: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: 24, marginBottom: 10 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  label: { color: colors.muted, fontSize: 13 },
  big: { color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.line },
  offerRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  lever: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomColor: colors.line, borderBottomWidth: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  leverLabel: { color: colors.text, fontSize: 15 },
  cta: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  ctaText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
});
