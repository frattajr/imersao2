/**
 * Lembrete diário de leitura (notificação local; só no app do celular).
 *
 * Gentil de propósito:
 * - agenda só os próximos 3 dias — se a pessoa parar de abrir o app, os
 *   lembretes param sozinhos (nada de insistir por semanas);
 * - pula o dia em que a meta já foi cumprida;
 * - a mensagem convida (o livro do momento, o tamanho da meta), nunca cobra
 *   nem fala em "perder a sequência".
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getRepo } from '../state/db';

export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';
export const REMINDER_HOURS = [8, 12, 19, 21];
const DAYS_AHEAD = 3;

let ready = false;
async function setup(): Promise<void> {
  if (ready) return;
  ready = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('leitura', { name: 'Lembrete de leitura', importance: Notifications.AndroidImportance.DEFAULT });
  }
}

export async function getReminderHour(): Promise<number | null> {
  const v = await (await getRepo()).kvGet('reminder');
  return v && Number(v) >= 0 ? Number(v) : null;
}

/** Textos variados, sempre convidando. */
function message(goal: number, book: string | undefined, n: number): { title: string; body: string } {
  const opts = [
    { title: 'Hora da leitura', body: book ? `Que tal ${goal} minutos de “${book}”?` : `${goal} minutos de leitura e o dia fica completo.` },
    { title: `Seus ${goal} minutos de hoje`, body: book ? `“${book}” está esperando, com o som da cena.` : 'Um conto curto já conta.' },
    { title: 'Uma pausa para ler', body: 'Coloque o fone, escolha um clima e leia um pouco.' },
  ];
  return opts[n % opts.length];
}

/**
 * Reagenda os lembretes (ao abrir o app, ao cumprir a meta, ao mudar o
 * horário). `hour` null desliga.
 */
export async function refreshReminders(p: { hour: number | null; goal: number; metToday: boolean; book?: string }): Promise<void> {
  if (!remindersSupported) return;
  try {
    await setup();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (p.hour == null) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const now = new Date();
    for (let i = 0; i <= DAYS_AHEAD; i++) {
      const when = new Date(now);
      when.setDate(now.getDate() + i);
      when.setHours(p.hour, 0, 0, 0);
      if (when <= now || (i === 0 && p.metToday)) continue;
      await Notifications.scheduleNotificationAsync({
        content: { ...message(p.goal, p.book, when.getDate()), sound: false },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'leitura' },
      });
    }
  } catch {
    // sem permissão ou sem suporte: segue sem lembrete
  }
}

/** Liga (pedindo permissão) ou desliga o lembrete. */
export async function setReminderHour(hour: number | null, ctx: { goal: number; metToday: boolean; book?: string }): Promise<'ok' | 'denied' | 'unsupported'> {
  if (!remindersSupported) return 'unsupported';
  await (await getRepo()).kvSet('reminder', hour == null ? '-1' : String(hour));
  if (hour != null) {
    try {
      await setup();
      const cur = await Notifications.getPermissionsAsync();
      const st = cur.status === 'granted' ? cur : await Notifications.requestPermissionsAsync();
      if (st.status !== 'granted') return 'denied';
    } catch {
      return 'unsupported';
    }
  }
  await refreshReminders({ hour, ...ctx });
  return 'ok';
}

/** Reagenda a partir do estado da jornada (ao abrir o app e ao cumprir a meta). */
export async function syncReminders(p: { goal: number; minutesToday: number; book?: string }): Promise<void> {
  if (!remindersSupported) return;
  const hour = await getReminderHour();
  await refreshReminders({ hour, goal: p.goal, metToday: p.minutesToday >= p.goal, book: p.book });
}
