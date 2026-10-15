import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Usuário dono do token enviado pelo app (conta anônima ou com e-mail). */
export async function requireUser(req: Request): Promise<User | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

let adminClient: SupabaseClient | null = null;
/** Cliente com permissão de servidor (acessa o cache e o contador de uso). */
export function admin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
  }
  return adminClient;
}

/** Conta uma chamada à IA e diz se o leitor ainda está dentro do limite diário. */
export async function withinDailyLimit(uid: string): Promise<boolean> {
  const limit = Number(Deno.env.get('AI_DAILY_LIMIT') ?? 300);
  const { data, error } = await admin().rpc('bump_ai_usage', { p_owner: uid, p_limit: limit });
  return !error && data === true;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const { data } = await admin().from('ai_cache').select('value').eq('key', key).maybeSingle();
  return (data?.value as T) ?? null;
}

export async function cachePut(key: string, kind: string, value: unknown, model: string): Promise<void> {
  await admin().from('ai_cache').upsert({ key, kind, value, model });
}
