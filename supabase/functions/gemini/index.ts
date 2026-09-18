// supabase/functions/gemini/index.ts
//
// Прокси к Google Gemini. Ключ Gemini живёт ТОЛЬКО здесь (Supabase Secrets),
// в приложение не попадает.
//
// Приложение шлёт: { kind, model, body }
//   kind  — 'photo' | 'byName' | 'recipes' | 'feed' | 'coach' | ...
//   model — строка модели (проверяется по белому списку)
//   body  — готовое тело запроса Gemini (system_instruction, contents, generationConfig)
//
// Для kind ∈ METERED: проверяем лимит бесплатных анализов по JWT пользователя
// и списываем один ПОСЛЕ успешного ответа Gemini. Для остальных — не списываем.
//
// Деплой:
//   supabase secrets set GEMINI_API_KEY=<ключ>
//   supabase functions deploy gemini

import { createClient } from 'npm:@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const ALLOWED_MODELS = new Set([
  'gemini-3.6-flash',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]);

const METERED = new Set(['photo', 'byName', 'recipes']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

addEventListener('unhandledrejection', (e) => {
  console.error('[gemini] UNHANDLED REJECTION:', (e as PromiseRejectionEvent).reason);
  (e as PromiseRejectionEvent).preventDefault();
});

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  if (!GEMINI_API_KEY) return json(500, { error: 'GEMINI_API_KEY not set' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json(500, {
      error: 'supabase env missing',
      has_url: !!SUPABASE_URL,
      has_anon: !!SUPABASE_ANON_KEY,
    });
  }

  // --- авторизация: должен быть валидный пользователь Supabase ---
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json(401, { error: 'unauthorized', reason: 'no bearer' });
  }
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let user;
  try {
    const res = await supa.auth.getUser();
    user = res.data?.user ?? null;
    if (res.error || !user) {
      return json(401, {
        error: 'unauthorized',
        reason: 'getUser',
        detail: res.error?.message ?? 'no user',
      });
    }
  } catch (e) {
    return json(500, { error: 'getUser threw', detail: String((e as Error)?.stack ?? e) });
  }

  // --- разбор запроса ---
  let payload: { kind?: string; model?: string; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'bad json' });
  }
  const { kind, model, body } = payload;
  if (!kind || !model || !body || typeof body !== 'object') {
    return json(400, { error: 'kind, model and body are required' });
  }
  if (!ALLOWED_MODELS.has(model)) {
    return json(400, { error: `model not allowed: ${model}` });
  }
  console.log(`[gemini] step=start kind=${kind} model=${model} metered=${METERED.has(kind)}`);

  // --- проверка лимита (только для платных видов) ---
  if (METERED.has(kind)) {
    let quota: { is_pro?: boolean; remaining?: number } | null = null;
    try {
      const { data, error } = await supa.rpc('analysis_quota');
      if (error) {
        return json(500, { error: 'quota check failed', detail: error.message });
      }
      quota = data;
      console.log(`[gemini] step=quota ok remaining=${quota?.remaining} is_pro=${quota?.is_pro}`);
    } catch (e) {
      return json(500, {
        error: 'quota check threw',
        detail: String((e as Error)?.stack ?? e),
      });
    }
    if (quota && !quota.is_pro && (quota.remaining ?? 0) <= 0) {
      return json(402, { error: 'quota_exceeded', quota });
    }
  }

  // --- вызов Gemini (с авто-повтором на перегрузку) ---
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const gHeaders = {
    'Content-Type': 'application/json',
    'x-goog-api-key': GEMINI_API_KEY,
  };
  const gBody = JSON.stringify(body);
  const RETRY_DELAYS = [600, 1500, 3000]; // мс

  let gRes: Response;
  let attempt = 0;
  while (true) {
    try {
      gRes = await fetch(url, { method: 'POST', headers: gHeaders, body: gBody });
    } catch (e) {
      if (attempt < RETRY_DELAYS.length) {
        console.log(`[gemini] step=fetch-error retry=${attempt + 1}`);
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt++]));
        continue;
      }
      return json(502, { error: 'gemini fetch failed', detail: String((e as Error)?.stack ?? e) });
    }
    if (
      (gRes.status === 429 || gRes.status === 500 || gRes.status === 503) &&
      attempt < RETRY_DELAYS.length
    ) {
      console.log(`[gemini] step=retry status=${gRes.status} attempt=${attempt + 1}`);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt++]));
      continue;
    }
    break;
  }

  console.log(`[gemini] step=fetched status=${gRes.status} ok=${gRes.ok} attempts=${attempt + 1}`);

  let gText: string;
  try {
    gText = await gRes.text();
  } catch (e) {
    return json(502, { error: 'gemini body read failed', detail: String((e as Error)?.stack ?? e) });
  }
  console.log(`[gemini] step=body len=${gText.length}`);

  // --- списываем один анализ ТОЛЬКО при успехе ---
  if (gRes.ok && METERED.has(kind)) {
    try {
      await supa.rpc('consume_analysis');
      console.log('[gemini] step=consume ok');
    } catch (e) {
      console.error('[gemini] step=consume threw:', e);
    }
  }

  // отдаём ответ Gemini как есть (со статусом Gemini, но в валидном диапазоне)
  const outStatus = gRes.status >= 200 && gRes.status <= 599 ? gRes.status : 502;
  console.log(`[gemini] step=done out=${outStatus}`);
  return new Response(gText, {
    status: outStatus,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error('gemini fn crash:', e);
    return json(500, {
      error: 'edge crash',
      detail: String((e as Error)?.stack ?? e),
    });
  }
});
