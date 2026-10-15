/** Chamada à API da Anthropic (Messages API) esperando uma resposta em JSON. */

export class ClaudeError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export async function askClaudeJson<T>(prompt: string, opts: { model: string; maxTokens: number }): Promise<T> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new ClaudeError(500, 'ANTHROPIC_API_KEY não configurada');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new ClaudeError(r.status, `Claude ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json() as { content?: { type: string; text?: string }[] };
  const text = (d.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  return extractJson<T>(text);
}

/** Pega o primeiro objeto JSON do texto (tolera texto antes/depois ou ```json). */
export function extractJson<T>(t: string): T {
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s < 0 || e < s) throw new ClaudeError(502, 'Resposta da IA sem JSON');
  return JSON.parse(t.slice(s, e + 1)) as T;
}

export async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
