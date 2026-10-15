// cada peso importado do próprio arquivo: o app leva só as fontes que usa
import { AtkinsonHyperlegible_400Regular } from '@expo-google-fonts/atkinson-hyperlegible/400Regular';
import { AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible/700Bold';
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_500Medium } from '@expo-google-fonts/literata/500Medium';
import { Merriweather_400Regular } from '@expo-google-fonts/merriweather/400Regular';
import { Merriweather_700Bold } from '@expo-google-fonts/merriweather/700Bold';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { bootAudio } from '../src/audio';
import { syncReminders } from '../src/services/reminders';
import { ensureSession } from '../src/services/supabase';
import { syncNow } from '../src/services/sync';
import { dayKey } from '../src/core/catalog';
import { loadJourney, track } from '../src/state/journey';
import { PrefsProvider, usePrefs } from '../src/ui/prefs';

void SplashScreen.preventAutoHideAsync();

function Root() {
  const { c, theme } = usePrefs();
  return (
    <>
      <StatusBar style={c.status} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="read/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="lab" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="catalog" />
        <Stack.Screen name="search" />
        <Stack.Screen name="journey" />
        <Stack.Screen name="paste" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="glossary/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  const [loaded] = useFonts({
    Literata_400Regular, Literata_500Medium, Merriweather_400Regular, Merriweather_700Bold,
    AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, Nunito_600SemiBold, Nunito_800ExtraBold,
  });

  useEffect(() => {
    bootAudio();
    void ensureSession().then(() => syncNow());
    // jornada: acerta a sequência do dia (dias de descanso) e reagenda o lembrete
    const openDay = () => void track({ type: 'open' })
      .then(async (r) => {
        const { goal } = await loadJourney();
        await syncReminders({ goal, minutesToday: r.days[dayKey(new Date())] ?? 0, book: r.state.last?.title });
      })
      .catch(() => undefined);
    openDay();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') { void syncNow(); openDay(); } });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <Root />
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
