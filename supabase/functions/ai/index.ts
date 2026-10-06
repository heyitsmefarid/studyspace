import { createClient } from 'npm:@supabase/supabase-js@2';
import { runTask } from '@ai/router.ts';
import { createGeminiProvider } from '@ai/geminiProvider.ts';
import { createGroqProvider } from '@ai/groqProvider.ts';
import { AI_TASKS, fail, type AiTask } from '@ai/types.ts';
import { corsHeaders, limitError, parseAllowedOrigins, readLimits } from '@ai/guards.ts';

const env = (k: string) => Deno.env.get(k);

function serviceKey(): string {
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try { return (JSON.parse(env('SUPABASE_SECRET_KEYS') ?? '{}') as { default?: string }).default ?? ''; } catch { return ''; }
}

const admin = createClient(env('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
const ALLOWED = parseAllowedOrigins(env('ALLOWED_ORIGINS'));

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), ALLOWED);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(fail('BAD_INPUT', 'Use POST.'), 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(fail('UNAUTHORIZED', 'Please log in again.'), 401);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return reply(fail('UNAUTHORIZED', 'Please log in again.'), 401);
  const uid = auth.user.id;

  const { data: profile } = await admin.from('profiles').select('id').eq('id', uid).maybeSingle();
  if (!profile) return reply(fail('UNAUTHORIZED', 'This account is not part of StudySpace.'), 403);

  let body: { task?: unknown; input?: unknown };
  try { body = await req.json(); } catch { return reply(fail('BAD_INPUT', 'The request body must be JSON.'), 400); }
  if (typeof body.task !== 'string' || !(AI_TASKS as readonly string[]).includes(body.task)) {
    return reply(fail('BAD_INPUT', 'Unknown AI task.'), 400);
  }
  const task = body.task as AiTask;

  // Reserve a slot atomically (per-member lock, rolling 24 h) before any provider call.
  const limits = readLimits(env);
  const { data: reservation, error: reserveError } = await admin
    .rpc('reserve_ai_request', { p_user: uid, p_task: task, p_per_minute: limits.perMinute, p_per_day: limits.perDay })
    .single<{ allowed: boolean; request_id: string | null; used_today: number; code: string | null }>();
  if (reserveError || !reservation) {
    console.error('reserve_ai_request failed', reserveError?.message);
    return reply(fail('PROVIDER_UNAVAILABLE', "Nova can't start right now. Try again shortly.", true, 10), 503);
  }
  if (!reservation.allowed) return reply({ ok: false, error: limitError(reservation.code, limits) }, 429);

  const result = await runTask(task, body.input, {
    providers: {
      gemini: createGeminiProvider({ apiKey: env('GEMINI_API_KEY'), model: env('GEMINI_MODEL') }),
      groq: createGroqProvider({ apiKey: env('GROQ_API_KEY'), model: env('GROQ_MODEL') }),
    },
  });

  const { error: logError } = await admin.from('ai_requests').update({
    provider: result.ok ? result.meta.provider : null,
    status: result.ok ? 'ok' : 'error',
    error_code: result.ok ? null : result.error.code,
  }).eq('id', reservation.request_id!);
  if (logError) console.error('ai_requests update failed', logError.message);

  if (result.ok) return reply({ ...result, meta: { ...result.meta, remainingToday: Math.max(0, limits.perDay - reservation.used_today) } });
  return reply(result, result.error.code === 'BAD_INPUT' ? 400 : 200);
});
