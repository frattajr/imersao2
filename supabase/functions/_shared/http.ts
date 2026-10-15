import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-precompute-secret',
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

/**
 * Chamada de pré-cálculo (scripts/precompute-public.ts): traz o segredo
 * PRECOMPUTE_SECRET no cabeçalho. Pode chamar a IA para livros públicos e
 * não conta no limite diário de ninguém.
 */
export function isPrecompute(req: Request): boolean {
  const secret = Deno.env.get('PRECOMPUTE_SECRET');
  return !!secret && secret.length >= 16 && req.headers.get('x-precompute-secret') === secret;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const { data } = await admin().from('ai_cache').select('value').eq('key', key).maybeSingle();
  return (data?.value as T) ?? null;
}

/**
 * Guarda uma resposta da IA no cache global. `bookKey` (ex.: "gut-55752",
 * "sample-poe-coracao") marca de que livro público ela veio, para saber o
 * que já foi pré-calculado.
 */
export async function cachePut(key: string, kind: string, value: unknown, model: string, bookKey?: string | null): Promise<void> {
  await admin().from('ai_cache').upsert({ key, kind, value, model, book_key: bookKey ?? null });
}

/** Identificador de livro público aceito no pedido (só formatos conhecidos). */
export function bookKeyOf(body: { bookKey?: unknown }): string | null {
  const k = typeof body.bookKey === 'string' ? body.bookKey : '';
  return /^(gut-\d{1,7}|sample-[a-z0-9-]{1,40}|pt-[a-z0-9-]{1,40})$/.test(k) ? k : null;
}
