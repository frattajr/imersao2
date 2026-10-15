import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Cliente Supabase, ou `null` quando o app roda sem backend configurado
 * (aí tudo funciona offline, sem IA nem sincronização).
 */
export const supabase: SupabaseClient | null =
  url && anon && !url.includes('SEU-PROJETO')
    ? createClient(url, anon, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

let sessionPromise: Promise<string | null> | null = null;

/**
 * Garante uma sessão. Começa com conta anônima (sem cadastro): o leitor
 * usa o app na hora; depois pode vincular e-mail para levar a biblioteca
 * a outro aparelho.
 */
export function ensureSession(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null);
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session.user.id;
      const { data: d, error } = await supabase.auth.signInAnonymously();
      if (error) {
        sessionPromise = null;
        return null;
      }
      return d.user?.id ?? null;
    })();
  }
  return sessionPromise;
}
