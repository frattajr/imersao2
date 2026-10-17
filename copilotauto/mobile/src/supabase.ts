import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(url, anonKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

/** MVP sem cadastro: sessão anônima do Supabase (ative "Anonymous sign-ins"). */
export async function accessToken(): Promise<string | null> {
  if (!url) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.access_token;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return anon.session?.access_token ?? null;
}
