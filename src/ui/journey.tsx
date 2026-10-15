/**
 * Peças da jornada do leitor usadas na biblioteca, nas Configurações e na
 * tela Jornada: o hook com o estado, a faixa do dia, o resumo da última
 * leitura, as metas (minutos, dias por semana, lembrete) e a medalha.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayKey } from '../core/catalog';
import {
  BADGES, DAY_GOALS, levelOf, minutesLeft, stepsLeft, streakOf, WEEK_TARGETS, type Badge,
} from '../core/journey';
import { getReminderHour, REMINDER_HOURS, remindersSupported, setReminderHour } from '../services/reminders';
import { markLastSeen, onJourney, setJourneyGoals, type JourneySnap } from '../state/journey';
import { IconButton, ProgressRing, Segmented } from './components';
import { Icon, type IconName } from './Icon';
import { FONTS, usePrefs } from './prefs';

/** Minutos de hoje para mostrar ("<1" quando já começou). */
export const minLabel = (m: number) => (m > 0 && m < 1 ? '<1' : String(Math.floor(m)));

/** Estado da jornada, atualizado a cada mudança. */
export function useJourney(): JourneySnap | null {
  const [s, set] = useState<JourneySnap | null>(null);
  useEffect(() => onJourney(set), []);
  return s;
}

/** Números do dia a partir do estado. */
export function useToday(j: JourneySnap | null) {
  return useMemo(() => {
    if (!j) return null;
    const now = new Date();
    const today = j.days[dayKey(now)] ?? 0;
    return {
      today, goal: j.goal, left: minutesLeft(j.days, j.goal, now), met: today >= j.goal,
      streak: streakOf(j.days, j.state.rest, now), level: levelOf(j.state.points), next: stepsLeft(j.state)[0],
    };
  }, [j]);
}

/** Faixa da biblioteca: anel do dia, sequência, nível e o próximo passo. */
export function JourneyStrip({ j }: { j: JourneySnap | null }) {
  const { c } = usePrefs();
  const t = useToday(j);
  if (!t) return <View style={{ height: 74 }} />;
  const head = t.streak > 0 ? `${t.streak} ${t.streak === 1 ? 'dia seguido' : 'dias seguidos'}` : 'Comece sua sequência hoje';
  const sub = t.met ? 'Meta do dia cumprida' : `Faltam ${t.left} min para a meta de hoje`;
  return (
    <Pressable onPress={() => router.push('/journey')} accessibilityRole="button"
      accessibilityLabel={`Sua jornada: ${head}. ${sub}. Nível ${t.level.n}, ${t.level.name}.`}
      style={({ pressed }) => [st.strip, { backgroundColor: c.surface, borderColor: c.line, opacity: pressed ? 0.85 : 1 }]}>
      <ProgressRing pct={t.today / t.goal} size={48} stroke={5}>
        {t.met ? <Icon name="check" size={20} color={c.accent} strokeWidth={2.4} />
          : <Text style={[st.ringText, { color: c.fg }]}>{minLabel(t.today)}</Text>}
      </ProgressRing>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={st.row}>
          {t.streak > 0 ? <Icon name="flame" size={15} color={c.accent} strokeWidth={2} /> : null}
          <Text style={[st.stripHead, { color: c.fg }]} numberOfLines={1}>{head}</Text>
          {t.streak > 0 ? <Text style={[st.stripLevel, { color: c.mut }]} numberOfLines={1}>· {t.level.name}</Text> : null}
        </View>
        <Text style={[st.stripSub, { color: c.mut }]} numberOfLines={1}>
          {t.next ? `Próximo passo: ${t.next.title}` : sub}
        </Text>
      </View>
      <Icon name="next" size={18} color={c.mut} />
    </Pressable>
  );
}

/** "Boa leitura!": resumo da última leitura, uma vez, na volta para a biblioteca. */
export function LastSessionCard({ j }: { j: JourneySnap | null }) {
  const { c } = usePrefs();
  const last = j?.state.last;
  if (!last || last.seen) return null;
  const minutes = Math.max(1, Math.round(last.ms / 60_000));
  const badges = last.badges.map((id) => BADGES.find((b) => b.id === id)).filter((b): b is Badge => !!b);
  const parts = [`${minutes} min${last.title ? ` em “${last.title}”` : ''}`, `+${Math.round(last.points)} pontos`];
  if (last.goal) parts.push('meta do dia cumprida');
  return (
    <View style={[st.last, { backgroundColor: c.accentSoft, borderColor: c.accent }]} accessibilityLiveRegion="polite">
      <View style={st.lastHead}>
        <Text style={[st.lastTitle, { color: c.fg }]}>{last.comeback ? 'Que bom te ver de volta!' : 'Boa leitura!'}</Text>
        <IconButton icon="close" label="Fechar o resumo" size={16} plain onPress={() => void markLastSeen()} />
      </View>
      <Text style={[st.lastText, { color: c.fg }]}>{parts.join(' · ')}</Text>
      {badges.map((b) => (
        <View key={b.id} style={st.row}>
          <Icon name={b.icon as IconName} size={16} color={c.accent} />
          <Text style={[st.lastText, { color: c.fg }]}>Conquista: {b.title}</Text>
        </View>
      ))}
    </View>
  );
}

/** Medalha de uma conquista (cheia quando conquistada). */
export function BadgeTile({ b, on, onPress, w }: { b: Badge; on: boolean; onPress: () => void; w: number }) {
  const { c } = usePrefs();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${b.title}${on ? ', conquistada' : ', ainda não'}. ${b.desc}`}
      style={({ pressed }) => [st.tile, { width: w, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[st.medal, { backgroundColor: on ? c.accentSoft : c.btn, borderColor: on ? c.accent : 'transparent' }]}>
        <Icon name={(on ? b.icon : 'lock') as IconName} size={on ? 24 : 18} color={on ? c.accent : c.mut} />
      </View>
      <Text style={[st.tileText, { color: on ? c.fg : c.mut }]} numberOfLines={2}>{b.title}</Text>
    </Pressable>
  );
}

/** Metas: minutos por dia, dias por semana e lembrete. */
export function GoalsRows({ j }: { j: JourneySnap | null }) {
  const { c } = usePrefs();
  const [hour, setHour] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { void getReminderHour().then(setHour); }, []);
  if (!j) return null;
  const today = j.days[dayKey(new Date())] ?? 0;
  const label = (t: string) => <Text style={[st.label, { color: c.mut }]}>{t}</Text>;
  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 10 }}>
        {label('MINUTOS POR DIA')}
        <Segmented value={j.goal} onChange={(g) => void setJourneyGoals({ goal: g })} accessibilityLabel="Minutos por dia"
          options={DAY_GOALS.map((g) => ({ value: g, label: `${g} min` }))} />
      </View>
      <View style={{ gap: 10 }}>
        {label('DIAS POR SEMANA')}
        <Text style={[st.hint, { color: c.mut }]}>Não precisa ser todo dia: a semana fica completa com estes dias de meta cumprida.</Text>
        <Segmented value={j.weekTarget} onChange={(w) => void setJourneyGoals({ weekTarget: w })} accessibilityLabel="Dias por semana"
          options={WEEK_TARGETS.map((w) => ({ value: w, label: `${w} dias` }))} />
      </View>
      <View style={{ gap: 10 }}>
        {label('LEMBRETE')}
        {remindersSupported ? (
          <>
            <Text style={[st.hint, { color: c.mut }]}>Um aviso por dia, no horário escolhido. Não aparece se a meta já foi cumprida.</Text>
            <Segmented value={hour ?? -1} accessibilityLabel="Lembrete"
              onChange={(h) => {
                const v = h < 0 ? null : h;
                setHour(v);
                void setReminderHour(v, { goal: j.goal, metToday: today >= j.goal, book: j.state.last?.title }).then((r) => {
                  setMsg(r === 'denied' ? 'Sem permissão para notificações: libere nas configurações do celular.' : '');
                  if (r === 'denied') setHour(null);
                });
              }}
              options={[{ value: -1, label: 'Não' }, ...REMINDER_HOURS.map((h) => ({ value: h, label: `${h}h` }))]} />
            {msg ? <Text style={[st.hint, { color: c.danger }]}>{msg}</Text> : null}
          </>
        ) : (
          <Text style={[st.hint, { color: c.mut }]}>O lembrete diário funciona no app do celular.</Text>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  strip: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, paddingVertical: 12, paddingLeft: 12, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ringText: { fontFamily: FONTS.uiBold, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stripHead: { fontFamily: FONTS.uiBold, fontSize: 14.5, flexShrink: 0 },
  stripLevel: { fontFamily: FONTS.ui, fontSize: 13.5, flexShrink: 1 },
  stripSub: { fontFamily: FONTS.ui, fontSize: 13 },
  last: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, padding: 14, paddingTop: 8, gap: 6 },
  lastHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastTitle: { fontFamily: FONTS.serifMedium, fontSize: 18 },
  lastText: { fontFamily: FONTS.ui, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  tile: { alignItems: 'center', gap: 6 },
  medal: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  tileText: { fontFamily: FONTS.ui, fontSize: 12, textAlign: 'center', lineHeight: 16 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11.5, letterSpacing: 1.1 },
  hint: { fontFamily: FONTS.ui, fontSize: 13, lineHeight: 18 },
});
