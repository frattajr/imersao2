import { Literata_400Regular, Literata_500Medium } from '@expo-google-fonts/literata';
import { Nunito_600SemiBold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { bootAudio } from '../src/audio';
import { ensureSession } from '../src/services/supabase';
import { syncNow } from '../src/services/sync';
import { PrefsProvider, usePrefs } from '../src/ui/prefs';

void SplashScreen.preventAutoHideAsync();

function Root() {
  const { c, theme } = usePrefs();
  return (
    <>
      <StatusBar style={theme === 'sepia' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="read/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="lab" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="paste" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="glossary/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  const [loaded] = useFonts({ Literata_400Regular, Literata_500Medium, Nunito_600SemiBold, Nunito_800ExtraBold });

  useEffect(() => {
    bootAudio();
    void ensureSession().then(() => syncNow());
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void syncNow(); });
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
