/**
 * Jornada do leitor: nível, o dia (anel da meta e o que fazer para fechar),
 * a semana (sequência, dias de descanso, calendário), primeiros passos,
 * desafio da semana, sugestão de meta, conquistas, números e metas.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey } from '../src/core/catalog';
import {
  BADGES, challengeFor, goalAdvice, MAX_FREEZES, STEPS, weekView, type Badge,
} from '../src/core/journey';
import { Sheet } from '../src/reader/Sheet';
import { dismissAdvice, setJourneyGoals } from '../src/state/journey';
import { IconButton, ProgressBar, ProgressRing, RoundButton } from '../src/ui/components';
import { Icon, type IconName } from '../src/ui/Icon';
import { BadgeTile, GoalsRows, minLabel, useJourney, useToday } from '../src/ui/journey';
import { FONTS, usePrefs } from '../src/ui/prefs';

const GROUPS: Badge['group'][] = ['Constância', 'Leitura', 'Imersão', 'Curiosidade'];

function Card({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  const { c } = usePrefs();
  return (
    <View style={[st.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      {title ? (
        <View style={st.cardHead}>
          <Text style={[st.cardTitle, { color: c.fg }]}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export default function Journey() {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const j = useJourney();
  const t = useToday(j);
  const [badge, setBadge] = useState<Badge | null>(null);
  const now = new Date();

  const week = useMemo(() => (j ? weekView(j.days, j.state.rest, now, j.goal) : []), [j]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!j || !t) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const s = j.state;
  const metWeek = week.filter((d) => d.met).length;
  const ch = challengeFor(s.week.key);
  const chDone = s.challenges[s.week.key] === ch.id;
  const chProg = Math.min(ch.target, ch.progress(s.week, j.days, now));
  const stepsDone = STEPS.filter((x) => x.done(s)).length;
  const advice = goalAdvice(j.days, j.goal, now, s.adviceOff);
  const got = BADGES.filter((b) => s.badges[b.id]).length;
  const tileW = Math.floor((Math.min(width, 600) - 32 - 32 - 3 * 8) / 4);
  // sugere continuar o último livro, se não terminou; senão, leituras curtas
  const lastBook = s.last?.finished ? undefined : s.last?.bookId ?? s.session?.bookId;
  const lastTitle = s.last?.title ?? s.session?.title;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 }]}>
        <View style={st.head}>
          <IconButton icon="back" label="Voltar" onPress={() => router.back()} />
          <Text style={[st.h1, { color: c.fg }]}>Sua jornada</Text>
        </View>

        {/* nível */}
        <Card>
          <View style={st.levelRow}>
            <View style={[st.levelBadge, { backgroundColor: c.accentSoft, borderColor: c.accent }]}>
              <Text style={[st.levelN, { color: c.accent }]}>{t.level.n}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[st.kicker, { color: c.accent }]}>NÍVEL {t.level.n}</Text>
              <Text style={[st.levelName, { color: c.fg }]}>{t.level.name}</Text>
            </View>
          </View>
          <ProgressBar pct={t.level.pct * 100} height={6} />
          <Text style={[st.small, { color: c.mut }]}>
            {Math.floor(s.points)} pontos{t.level.to ? ` · faltam ${Math.ceil(t.level.to - s.points)} para ${t.level.next ?? `o nível ${t.level.n + 1}`}` : ''}
          </Text>
          <Text style={[st.small, { color: c.mut }]}>1 ponto por minuto lido · +10 por capítulo · +25 por livro · bônus por metas e desafios</Text>
        </Card>

        {/* hoje */}
        <Card title="Hoje">
          <View style={st.todayRow}>
            <ProgressRing pct={t.today / t.goal} size={92} stroke={8}>
              {t.met ? <Icon name="check" size={30} color={c.accent} strokeWidth={2.4} /> : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={[st.ringBig, { color: c.fg }]}>{minLabel(t.today)}</Text>
                  <Text style={[st.ringSmall, { color: c.mut }]}>de {t.goal} min</Text>
                </View>
              )}
            </ProgressRing>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={[st.todayText, { color: c.fg }]}>
                {t.met ? `Meta cumprida: ${Math.floor(t.today)} min hoje.` : t.today > 0 ? `Faltam ${t.left} min para fechar o dia.` : `Sua meta é ${t.goal} minutos. Um conto curto já ajuda.`}
              </Text>
              {lastBook && lastTitle ? (
                <RoundButton icon="play" label={`Continuar “${lastTitle.length > 18 ? lastTitle.slice(0, 17) + '…' : lastTitle}”`}
                  onPress={() => router.push(`/read/${encodeURIComponent(lastBook)}`)} style={{ alignSelf: 'flex-start' }} />
              ) : (
                <RoundButton icon="book" label="Leituras curtas" onPress={() => router.push({ pathname: '/search', params: { d: 'curto' } })}
                  style={{ alignSelf: 'flex-start' }} />
              )}
            </View>
          </View>
        </Card>

        {/* semana e sequência */}
        <Card title="Constância">
          <View style={st.streakRow}>
            <Icon name="flame" size={22} color={t.streak > 0 ? c.accent : c.mut} />
            <Text style={[st.streakN, { color: c.fg }]}>{t.streak} {t.streak === 1 ? 'dia seguido' : 'dias seguidos'}</Text>
            {s.best > t.streak ? <Text style={[st.small, { color: c.mut }]}>· recorde {s.best}</Text> : null}
          </View>
          <View style={st.week} accessibilityLabel={`Semana: ${metWeek} de ${j.weekTarget} dias com a meta`}>
            {week.map((d) => (
              <View key={d.key} style={st.dayCol}>
                <View style={[st.day, {
                  backgroundColor: d.met ? c.accent : d.read ? c.accentSoft : 'transparent',
                  borderColor: d.met || d.read ? c.accent : d.today ? c.fg : c.line,
                  borderStyle: d.future ? 'dashed' : 'solid',
                }]}>
                  {d.met ? <Icon name="check" size={15} color={c.onAccent} strokeWidth={2.6} />
                    : d.rest ? <Icon name="moon" size={14} color={c.mut} /> : null}
                </View>
                <Text style={[st.dayLabel, { color: d.today ? c.fg : c.mut }]}>{d.label}</Text>
              </View>
            ))}
          </View>
          <Text style={[st.small, { color: c.fg }]}>
            {metWeek >= j.weekTarget ? 'Semana cumprida!' : `${metWeek} de ${j.weekTarget} dias com a meta nesta semana`}
          </Text>
          <View style={[st.rest, { borderColor: c.line }]}>
            <Icon name="moon" size={18} color={c.accent} />
            <Text style={[st.small, { color: c.mut, flex: 1 }]}>
              {s.freezes > 0
                ? `${s.freezes} ${s.freezes === 1 ? 'dia de descanso guardado' : 'dias de descanso guardados'}: se faltar um dia, ele é usado e a sequência continua.`
                : 'Nenhum dia de descanso guardado agora. Você ganha um a cada 7 dias seguidos.'}
              {s.freezes < MAX_FREEZES && s.freezes > 0 ? ' Ganhe mais um a cada 7 dias seguidos.' : ''}
            </Text>
          </View>
        </Card>

        {/* primeiros passos */}
        {!s.stepsDone && (
          <Card title="Primeiros passos" right={<Text style={[st.small, { color: c.mut }]}>{stepsDone} de {STEPS.length}</Text>}>
            <ProgressBar pct={(stepsDone / STEPS.length) * 100} height={4} />
            {STEPS.map((x, i) => {
              const done = x.done(s);
              const first = !done && STEPS.findIndex((y) => !y.done(s)) === i;
              return (
                <View key={x.id} style={st.step}>
                  <View style={[st.check, { backgroundColor: done ? c.accent : 'transparent', borderColor: done ? c.accent : first ? c.fg : c.line }]}>
                    {done ? <Icon name="check" size={13} color={c.onAccent} strokeWidth={2.8} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[st.stepTitle, { color: done ? c.mut : c.fg, textDecorationLine: done ? 'line-through' : 'none' }]}>{x.title}</Text>
                    {first ? <Text style={[st.small, { color: c.mut }]}>{x.hint}</Text> : null}
                  </View>
                </View>
              );
            })}
            <Text style={[st.small, { color: c.mut }]}>Ao completar: +30 pontos e um dia de descanso.</Text>
          </Card>
        )}

        {/* desafio da semana */}
        <Card title="Desafio da semana" right={chDone ? <Icon name="check" size={18} color={c.accent} strokeWidth={2.4} /> : undefined}>
          <Text style={[st.chTitle, { color: c.fg }]}>{ch.title}</Text>
          <Text style={[st.small, { color: c.mut }]}>{ch.desc}</Text>
          <ProgressBar pct={(chProg / ch.target) * 100} height={6} />
          <Text style={[st.small, { color: chDone ? c.accent : c.mut }]}>
            {chDone ? 'Concluído! +20 pontos' : `${chProg} de ${ch.target}${ch.unit ? ` ${ch.unit}` : ''} · um novo desafio toda segunda`}
          </Text>
        </Card>

        {/* sugestão de meta */}
        {advice && (
          <Card title="Uma sugestão">
            <Text style={[st.small, { color: c.fg }]}>{advice.why}</Text>
            <View style={st.row}>
              <RoundButton big label={`Mudar para ${advice.to} min`} onPress={() => void setJourneyGoals({ goal: advice.to })} />
              <RoundButton variant="ghost" label="Agora não" onPress={() => void dismissAdvice()} />
            </View>
          </Card>
        )}

        {/* conquistas */}
        <Card title="Conquistas" right={<Text style={[st.small, { color: c.mut }]}>{got} de {BADGES.length}</Text>}>
          {GROUPS.map((g) => (
            <View key={g} style={{ gap: 10 }}>
              <Text style={[st.label, { color: c.mut }]}>{g.toUpperCase()}</Text>
              <View style={st.tiles}>
                {BADGES.filter((b) => b.group === g).map((b) => (
                  <BadgeTile key={b.id} b={b} on={!!s.badges[b.id]} w={tileW} onPress={() => setBadge(b)} />
                ))}
              </View>
            </View>
          ))}
        </Card>

        {/* números */}
        <Card title="Seus números">
          <View style={st.stats}>
            {[
              [Math.round(s.c.minutes), 'minutos lidos'],
              [s.c.books, s.c.books === 1 ? 'livro terminado' : 'livros terminados'],
              [Math.round(s.c.words / 250), 'páginas (250 palavras)'],
              [s.c.highlights, s.c.highlights === 1 ? 'grifo' : 'grifos'],
            ].map(([n, l]) => (
              <View key={String(l)} style={[st.stat, { backgroundColor: c.btn }]}>
                <Text style={[st.statN, { color: c.fg }]}>{Number(n).toLocaleString('pt-BR')}</Text>
                <Text style={[st.small, { color: c.mut }]}>{l}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* metas */}
        <Card title="Metas e lembrete">
          <GoalsRows j={j} />
        </Card>
      </ScrollView>

      <Sheet visible={!!badge} title={badge?.title ?? ''} onClose={() => setBadge(null)}>
        {badge ? (
          <View style={{ alignItems: 'center', gap: 12, paddingBottom: 8 }}>
            <View style={[st.bigMedal, { backgroundColor: s.badges[badge.id] ? c.accentSoft : c.btn, borderColor: s.badges[badge.id] ? c.accent : 'transparent' }]}>
              <Icon name={badge.icon as IconName} size={40} color={s.badges[badge.id] ? c.accent : c.mut} />
            </View>
            <Text style={[st.todayText, { color: c.fg, textAlign: 'center' }]}>{badge.desc}</Text>
            <Text style={[st.small, { color: c.mut }]}>
              {s.badges[badge.id] ? `Conquistada em ${new Date(s.badges[badge.id]).toLocaleDateString('pt-BR')}` : 'Ainda não conquistada'}
            </Text>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 16, maxWidth: 600, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 27 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: FONTS.serifMedium, fontSize: 19 },
  kicker: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1.3 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11.5, letterSpacing: 1.1 },
  small: { fontFamily: FONTS.ui, fontSize: 13, lineHeight: 18 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  levelBadge: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  levelN: { fontFamily: FONTS.serifMedium, fontSize: 24 },
  levelName: { fontFamily: FONTS.serifMedium, fontSize: 22 },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringBig: { fontFamily: FONTS.uiBold, fontSize: 24, lineHeight: 26 },
  ringSmall: { fontFamily: FONTS.ui, fontSize: 11 },
  todayText: { fontFamily: FONTS.ui, fontSize: 15, lineHeight: 21 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakN: { fontFamily: FONTS.uiBold, fontSize: 17 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6 },
  day: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontFamily: FONTS.uiBold, fontSize: 12 },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepTitle: { fontFamily: FONTS.uiBold, fontSize: 14.5 },
  chTitle: { fontFamily: FONTS.uiBold, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, rowGap: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '45%', borderRadius: 14, padding: 12, gap: 2 },
  statN: { fontFamily: FONTS.serifMedium, fontSize: 24 },
  bigMedal: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});
