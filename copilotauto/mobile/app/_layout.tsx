import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '../src/theme';

export default function Layout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'CopilotAuto' }} />
        <Stack.Screen name="inspect/[id]" options={{ title: 'Vistoria', headerShown: false }} />
        <Stack.Screen name="report/[id]" options={{ title: 'Relatório' }} />
      </Stack>
    </>
  );
}
