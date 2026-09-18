// src/services/aiService.js
//
// Анализ еды через Google Gemini. Запросы идут НЕ напрямую в Gemini, а через
// Supabase Edge Function `gemini` (supabase/functions/gemini/index.ts) —
// ключ Gemini живёт на сервере, лимит бесплатных анализов там же проверяется
// и списывается. Клиент готовит тело запроса и разбирает ответ.

import { AppError, isNetworkError } from './errors';
import { i18n, t } from '../i18n';
import { supabase } from './supabaseClient';

const GEMINI_MODEL = 'gemini-flash-latest';
// Быстрая лёгкая модель — для ленты рецептов (качество ниже, скорость ~3× выше).
const GEMINI_MODEL_FAST = 'gemini-flash-lite-latest';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const AI_PROXY_URL = `${SUPABASE_URL}/functions/v1/gemini`;

const LANG_NAME = {
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ar: 'Arabic',
  zh: 'Chinese',
};
const langName = () => LANG_NAME[i18n.locale] || 'English';

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};
const lc = (v) => String(v || '').toLowerCase();
const conf3 = (v) => (['high', 'medium', 'low'].includes(lc(v)) ? lc(v) : 'low');

/**
 * Один запрос к Gemini через Edge Function.
 * @param {'photo'|'byName'|'recipes'|'feed'|'coach'|'workout_tip'|'coach_chat'|'workout_plan'|'supp_tip'|'supp_reco'} kind
 * @param {object} body тело запроса Gemini
 * @param {string} model
 */
async function geminiJSON(kind, body, model = GEMINI_MODEL) {
  if (!SUPABASE_URL) throw new AppError(t('err.generic'), 'UNKNOWN');

  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token ?? null;
  } catch (e) {
    // ниже разберёмся по 401
  }

  let response;
  try {
    response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ kind, model, body }),
    });
  } catch (e) {
    if (isNetworkError(e)) throw new AppError(t('err.network'), 'NO_NETWORK');
    throw new AppError(t('err.serverBusy'), 'SERVER');
  }

  if (response.status === 402) {
    throw new AppError(t('home.freeOut'), 'QUOTA');
  }
  if (response.status === 401) {
    throw new AppError(t('err.generic'), 'UNAUTH');
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw mapHttpError(response.status, bodyText);
  }

  const data = await response.json().catch(() => null);
  if (!data) throw new AppError(t('err.serverBusy'), 'SERVER');
  if (data?.promptFeedback?.blockReason) throw new AppError(t('err.blocked'), 'BLOCKED');

  const candidate = data?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
    throw new AppError(t('err.blocked'), 'BLOCKED');
  }
  if (finishReason && finishReason !== 'STOP') {
    throw new AppError(t('err.badJson'), 'BAD_JSON');
  }

  const text = (candidate?.content?.parts ?? [])
    .filter((p) => p && typeof p.text === 'string' && p.thought !== true)
    .map((p) => p.text)
    .join('')
    .trim();
  if (!text) throw new AppError(t('err.badJson'), 'BAD_JSON');

  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn('[Gemini] не распарсился ответ:', text);
    throw new AppError(t('err.badJson'), 'BAD_JSON');
  }
}

// Схема одного ингредиента.
const ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    grams: { type: 'NUMBER' },
    calories: { type: 'NUMBER' },
    protein_g: { type: 'NUMBER' },
    carbs_g: { type: 'NUMBER' },
    fat_g: { type: 'NUMBER' },
  },
  required: ['name', 'grams', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
  propertyOrdering: ['name', 'grams', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
};

// Приводим список ингредиентов к чистому виду.
function cleanItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((it) => ({
      name: typeof it?.name === 'string' && it.name.trim() ? it.name.trim() : '—',
      grams: Math.max(1, Math.round(num(it?.grams))),
      calories: Math.max(0, Math.round(num(it?.calories))),
      protein_g: Math.max(0, num(it?.protein_g)),
      carbs_g: Math.max(0, num(it?.carbs_g)),
      fat_g: Math.max(0, num(it?.fat_g)),
    }))
    .filter((it) => it.grams > 0);
}

function totalsOf(items) {
  return items.reduce(
    (a, it) => ({
      calories: a.calories + it.calories,
      protein_g: Math.round((a.protein_g + it.protein_g) * 10) / 10,
      carbs_g: Math.round((a.carbs_g + it.carbs_g) * 10) / 10,
      fat_g: Math.round((a.fat_g + it.fat_g) * 10) / 10,
      grams: a.grams + it.grams,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, grams: 0 }
  );
}

// ========================= Анализ фото =========================

const PHOTO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    food_name: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    note: { type: 'STRING' },
    items: { type: 'ARRAY', items: ITEM_SCHEMA },
  },
  required: ['food_name', 'confidence', 'note', 'items'],
  propertyOrdering: ['food_name', 'confidence', 'note', 'items'],
};

/**
 * @param {string} base64Image
 * @returns {Promise<{food_name,confidence,note,items:Array,calories,protein_g,carbs_g,fat_g,portion_grams}>}
 */
export async function analyzeFoodPhoto(base64Image) {
  if (!base64Image) throw new AppError(t('err.generic'), 'UNKNOWN');
  const lang = langName();

  const raw = await geminiJSON('photo', {
    system_instruction: {
      parts: [
        {
          text: `You are an expert nutritionist estimating food from a photo. Answer STRICTLY with one JSON object, no markdown.
Fields:
- food_name: overall dish/meal name, in ${lang}
- confidence: "high" | "medium" | "low"
- note: one short sentence, in ${lang}
- items: array of the main components of the meal (2 to 6; if it is one simple food, one item). Each item:
    - name: component name, in ${lang}
    - grams: estimated weight of this component in grams (> 0)
    - calories: kcal for that amount
    - protein_g, carbs_g, fat_g: grams for that amount
If there is no recognisable food, return one item with zeros and confidence "low".`,
        },
      ],
    },
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
          { text: 'Analyse this meal.' },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: PHOTO_SCHEMA,
      maxOutputTokens: 3000,
      temperature: 0.2,
    },
  });

  let items = cleanItems(raw?.items);
  const foodName =
    typeof raw?.food_name === 'string' && raw.food_name.trim()
      ? raw.food_name.trim()
      : t('res.unknownFood');

  if (items.length === 0) {
    items = [
      {
        name: foodName,
        grams: 1,
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      },
    ];
  }

  const totals = totalsOf(items);
  return {
    food_name: foodName,
    confidence: conf3(raw?.confidence),
    note: typeof raw?.note === 'string' ? raw.note : '',
    items,
    calories: totals.calories,
    protein_g: totals.protein_g,
    carbs_g: totals.carbs_g,
    fat_g: totals.fat_g,
    portion_grams: totals.grams,
  };
}

// ================= Оценка блюда по названию =================

const DISH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    food_name: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    items: { type: 'ARRAY', items: ITEM_SCHEMA },
  },
  required: ['food_name', 'confidence', 'items'],
  propertyOrdering: ['food_name', 'confidence', 'items'],
};

/**
 * Оценка блюда по названию. Возвращает объект в форме "продукта"
 * (как из openFoodFacts) + разбивку items для типичной порции.
 * @param {string} query
 */
export async function analyzeFoodByName(query) {
  const q = String(query || '').trim();
  if (!q) throw new AppError(t('err.generic'), 'UNKNOWN');
  const lang = langName();

  const raw = await geminiJSON('byName', {
    system_instruction: {
      parts: [
        {
          text: `You are an expert nutritionist. The user gives the name of a food or dish. Answer STRICTLY with one JSON object, no markdown.
Fields:
- food_name: cleaned-up dish name, in ${lang}
- confidence: "high" | "medium" | "low"
- items: array of the main components of ONE typical serving (1 to 6). Each item:
    - name: component name, in ${lang}
    - grams: weight of this component in a typical serving (> 0)
    - calories: kcal for that amount
    - protein_g, carbs_g, fat_g: grams for that amount
If the query is not a food, return one item with zeros and confidence "low".`,
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: q }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: DISH_SCHEMA,
      maxOutputTokens: 2500,
      temperature: 0.2,
    },
  });

  const items = cleanItems(raw?.items);
  const totals = totalsOf(items);
  if (!totals.calories || !totals.grams) {
    throw new AppError(t('food.noResults'), 'NO_DATA');
  }

  const per100 = {
    calories: Math.round((totals.calories / totals.grams) * 100),
    protein_g: Math.round((totals.protein_g / totals.grams) * 1000) / 10,
    carbs_g: Math.round((totals.carbs_g / totals.grams) * 1000) / 10,
    fat_g: Math.round((totals.fat_g / totals.grams) * 1000) / 10,
  };

  return {
    barcode: null,
    name:
      typeof raw?.food_name === 'string' && raw.food_name.trim()
        ? raw.food_name.trim()
        : q,
    brand: '',
    per100,
    servingSizeG: totals.grams,
    imageUrl: null,
    aiConfidence: conf3(raw?.confidence),
    items,
  };
}

// ================= Рецепт из имеющихся продуктов =================

const RECIPE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    servings: { type: 'NUMBER' },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
    items: { type: 'ARRAY', items: ITEM_SCHEMA },
  },
  required: ['title', 'servings', 'steps', 'items'],
  propertyOrdering: ['title', 'servings', 'steps', 'items'],
};

const RECIPES_SCHEMA = {
  type: 'OBJECT',
  properties: { recipes: { type: 'ARRAY', items: RECIPE_SCHEMA } },
  required: ['recipes'],
};

/**
 * Пользователь перечисляет продукты — модель предлагает 1–3 рецепта.
 * items у каждого рецепта — ингредиенты НА ОДНУ ПОРЦИЮ с граммами и БЖУ.
 * @param {string} text
 * @returns {Promise<Array<{title,servings,steps:string[],items:Array}>>}
 */
export async function generateRecipes(text) {
  const q = String(text || '').trim();
  if (q.length < 2) throw new AppError(t('err.generic'), 'UNKNOWN');
  const lang = langName();

  const raw = await geminiJSON('recipes', {
    system_instruction: {
      parts: [
        {
          text: `You are a home cook. The user lists ingredients they have. Answer STRICTLY with one JSON object, no markdown.
Propose 1 to 3 simple realistic recipes that use MOSTLY the listed ingredients (common staples like salt, pepper, oil, water are allowed).
Field "recipes": array. Each recipe:
- title: dish name, in ${lang}
- servings: number of servings (integer, >= 1)
- steps: array of short cooking steps, in ${lang}
- items: array of ingredients FOR ONE SERVING. Each item:
    - name: ingredient name, in ${lang}
    - grams: weight per serving in grams (> 0)
    - calories: kcal for that amount
    - protein_g, carbs_g, fat_g: grams for that amount
If nothing sensible can be cooked, return an empty "recipes" array.`,
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: q }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RECIPES_SCHEMA,
      maxOutputTokens: 4000,
      temperature: 0.4,
    },
  });

  const recipes = Array.isArray(raw?.recipes) ? raw.recipes : [];
  return recipes
    .map((r) => {
      const items = cleanItems(r?.items);
      if (items.length === 0) return null;
      return {
        title:
          typeof r?.title === 'string' && r.title.trim()
            ? r.title.trim()
            : t('res.unknownFood'),
        servings: Math.max(1, Math.round(num(r?.servings)) || 1),
        steps: Array.isArray(r?.steps)
          ? r.steps.map((s) => String(s)).filter(Boolean)
          : [],
        items,
      };
    })
    .filter(Boolean);
}

// ================= Лента рецептов под цель =================

const GOAL_HINT = {
  lose: 'The person wants to LOSE weight — favour lighter, lower-calorie, higher-protein meals.',
  gain: 'The person wants to GAIN weight — favour calorie-dense, balanced, protein-rich meals.',
  maintain: 'The person wants to MAINTAIN weight — balanced everyday meals.',
};

/**
 * 4 разнообразных рецепта под цель пользователя. Кэш — на стороне вызова
 * (Supabase feed_cache). НЕ тратит лимит анализов.
 * @param {'lose'|'maintain'|'gain'} goal
 */
export async function getFeedRecipes(goal = 'maintain') {
  const lang = langName();

  const raw = await geminiJSON(
    'feed',
    {
    system_instruction: {
      parts: [
        {
          text: `You are a chef curating a recipe feed. Answer STRICTLY with one JSON object, no markdown.
${GOAL_HINT[goal] || GOAL_HINT.maintain}
Field "recipes": array of exactly 4 VARIED recipes (different cuisines and meal types). Keep steps short. Each recipe:
- title: dish name, in ${lang}
- servings: integer >= 1
- steps: array of short cooking steps, in ${lang}
- items: array of ingredients FOR ONE SERVING. Each item:
    - name: ingredient name, in ${lang}
    - grams: weight per serving in grams (> 0)
    - calories: kcal for that amount
    - protein_g, carbs_g, fat_g: grams for that amount`,
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: 'Give me the feed.' }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RECIPES_SCHEMA,
      maxOutputTokens: 6000,
      temperature: 0.8,
    },
    },
    GEMINI_MODEL_FAST
  );

  return (Array.isArray(raw?.recipes) ? raw.recipes : [])
    .map((r) => {
      const items = cleanItems(r?.items);
      if (items.length === 0) return null;
      return {
        title:
          typeof r?.title === 'string' && r.title.trim()
            ? r.title.trim()
            : t('res.unknownFood'),
        servings: Math.max(1, Math.round(num(r?.servings)) || 1),
        steps: Array.isArray(r?.steps)
          ? r.steps.map((s) => String(s)).filter(Boolean)
          : [],
        items,
      };
    })
    .filter(Boolean);
}

// ================= Дневная карточка коуча =================

const COACH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    summary: { type: 'STRING' },
    tips: { type: 'ARRAY', items: { type: 'STRING' } },
    focus: { type: 'STRING' },
  },
  required: ['headline', 'summary', 'tips', 'focus'],
  propertyOrdering: ['headline', 'summary', 'tips', 'focus'],
};

const GOAL_LINE = {
  lose: 'The person is trying to LOSE weight.',
  gain: 'The person is trying to GAIN weight / build muscle.',
  maintain: 'The person is trying to MAINTAIN their weight.',
};

/**
 * Персональная карточка «тренера» на сегодня. Кэш — на стороне вызова
 * (Supabase coach_cards, одна на день). НЕ тратит лимит анализов.
 * @param {object} context результат buildCoachContext()
 * @returns {Promise<{headline:string, summary:string, tips:string[], focus:string}>}
 */
export async function generateCoachCard(context) {
  const lang = langName();
  const goal = context?.goal || 'maintain';

  const raw = await geminiJSON(
    'coach',
    {
      system_instruction: {
        parts: [
          {
            text: `You are a warm, encouraging personal nutrition & fitness coach. You get a JSON summary of the user's last 7 days of eating (and weight/water if present). Answer STRICTLY with one JSON object, no markdown. Everything in ${lang}.
${GOAL_LINE[goal] || GOAL_LINE.maintain}
Fields:
- headline: 3–6 words, warm and specific to how things are going (not generic).
- summary: 1–2 sentences on how yesterday and this week went — mention a concrete number if useful (calories vs goal, protein, streak, logged days).
- tips: array of 2–3 SHORT, concrete, actionable tips for TODAY based on the data (e.g. "Add ~20 g protein at lunch", "You skipped logging 3 days — log dinner tonight"). No fluff.
- focus: one very short phrase — the single thing to focus on today.
Be honest but kind. If data is sparse (few logged days), gently encourage consistent logging. Never give medical advice.`,
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: JSON.stringify(context) }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: COACH_SCHEMA,
        maxOutputTokens: 1200,
        temperature: 0.6,
      },
    },
    GEMINI_MODEL_FAST
  );

  const str = (v, fallback = '') =>
    typeof v === 'string' && v.trim() ? v.trim() : fallback;

  return {
    headline: str(raw?.headline, t('coach.fallbackHeadline')),
    summary: str(raw?.summary),
    tips: Array.isArray(raw?.tips)
      ? raw.tips.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
      : [],
    focus: str(raw?.focus),
  };
}

/**
 * Совет по тренировкам на основе истории (последние 3 недели).
 * Кэш — на стороне вызова (coach_cards, kind='workout'). НЕ тратит лимит анализов.
 * @param {object} context результат buildWorkoutContext()
 * @returns {Promise<{headline:string, summary:string, tips:string[], focus:string}>}
 */
export async function generateWorkoutTip(context) {
  const lang = langName();
  const goal = context?.goal || 'maintain';

  const raw = await geminiJSON(
    'workout_tip',
    {
      system_instruction: {
        parts: [
          {
            text: `You are a supportive strength & conditioning coach. You get a JSON summary of the user's last 3 weeks of workouts. Answer STRICTLY with one JSON object, no markdown. Everything in ${lang}.
${GOAL_LINE[goal] || GOAL_LINE.maintain}
Fields:
- headline: 3–6 words, specific to their training pattern right now.
- summary: 1–2 sentences on how training is going — reference concrete numbers (sessions per week, days since last strength, a lift trending up).
- tips: array of 2–3 SHORT, concrete, actionable tips for the next few days (e.g. "You haven't done strength in 6 days — hit a full-body session", "Bench volume is climbing — add a top set at +2.5 kg"). No fluff.
- focus: one very short phrase — the single training priority right now.
If data is sparse (few workouts logged), gently encourage logging and starting a simple routine. Be encouraging, never shaming. No medical or injury-treatment advice.`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: COACH_SCHEMA,
        maxOutputTokens: 1200,
        temperature: 0.6,
      },
    },
    GEMINI_MODEL_FAST
  );

  const str = (v, fallback = '') =>
    typeof v === 'string' && v.trim() ? v.trim() : fallback;

  return {
    headline: str(raw?.headline, t('coach.fallbackHeadline')),
    summary: str(raw?.summary),
    tips: Array.isArray(raw?.tips)
      ? raw.tips.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
      : [],
    focus: str(raw?.focus),
  };
}

// ================= План тренировок =================

const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    days: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          focus: { type: 'STRING' },
          exercises: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                sets: { type: 'NUMBER' },
                reps: { type: 'STRING' },
                note: { type: 'STRING' },
              },
              required: ['name', 'sets', 'reps'],
            },
          },
        },
        required: ['name', 'focus', 'exercises'],
      },
    },
    tips: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'summary', 'days', 'tips'],
};

/**
 * Собирает недельный план тренировок по ответам пользователя.
 * kind='workout_plan' (не метрируется). Модель flash-lite.
 * @param {{goal,level,days,place,duration,limits}} answers
 */
export async function generateWorkoutPlan(answers) {
  const lang = langName();

  const raw = await geminiJSON(
    'workout_plan',
    {
      system_instruction: {
        parts: [
          {
            text: `You are an experienced strength & conditioning coach. Build a realistic weekly workout plan from the user's answers. Answer STRICTLY as one JSON object, no markdown. Everything in ${lang}.
User answers (JSON): ${JSON.stringify(answers)}
Rules:
- "days" array length MUST equal the number of training days the user picked.
- Each day: name (e.g. "Day A — Push"), focus (short), and 4–7 exercises.
- Each exercise: name, sets (integer 2–5), reps (string, e.g. "8–12" or "30 sec"), optional short note.
- Only use equipment consistent with the user's "place" answer.
- Respect the user's level (beginner = simpler, compound-focused) and any limits/injuries they mention.
- "tips": 2–3 short practical tips (progression, rest, warm-up).
- "summary": 1–2 sentences describing the plan.`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: 'Build my plan.' }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: PLAN_SCHEMA,
        maxOutputTokens: 4000,
        temperature: 0.5,
      },
    },
    GEMINI_MODEL_FAST
  );

  const days = Array.isArray(raw?.days) ? raw.days : [];
  return {
    title:
      typeof raw?.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : t('plan.defaultTitle'),
    summary: typeof raw?.summary === 'string' ? raw.summary.trim() : '',
    tips: Array.isArray(raw?.tips)
      ? raw.tips.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
      : [],
    days: days
      .map((d) => ({
        name: String(d?.name || '').trim() || '—',
        focus: String(d?.focus || '').trim(),
        exercises: (Array.isArray(d?.exercises) ? d.exercises : [])
          .map((e) => ({
            name: String(e?.name || '').trim(),
            sets: Math.max(1, Math.round(num(e?.sets)) || 3),
            reps: String(e?.reps || '').trim() || '8–12',
            note: String(e?.note || '').trim(),
          }))
          .filter((e) => e.name),
      }))
      .filter((d) => d.exercises.length),
  };
}

// ================= Совет по добавкам =================

/**
 * Совет по добавкам на основе того, что принимает пользователь, и регулярности.
 * Кэш — на стороне вызова (coach_cards, kind='supp'). НЕ тратит лимит анализов.
 * @param {object} context результат buildSupplementContext()
 * @returns {Promise<{headline:string, summary:string, tips:string[], focus:string}>}
 */
export async function generateSupplementTip(context) {
  const lang = langName();
  const goal = context?.goal || 'maintain';

  const raw = await geminiJSON(
    'supp_tip',
    {
      system_instruction: {
        parts: [
          {
            text: `You are a knowledgeable nutrition coach — NOT a doctor. You get a JSON summary of the supplements the user takes, their schedule, how consistently they took them over the last 2 weeks, and their goal. Answer STRICTLY as one JSON object, no markdown. Everything in ${lang}.
${GOAL_LINE[goal] || GOAL_LINE.maintain}
Fields:
- headline: 3–6 words about their supplement routine.
- summary: 1–2 sentences — mention adherence with a concrete number (e.g. "you took omega-3 5 of the last 7 days") and the overall picture.
- tips: array of 2–3 SHORT practical tips: better timing (with food or on an empty stomach, morning vs evening), a nudge for the one they keep missing, and — ONLY if clearly relevant to their goal — one gentle mention of a single well-established supplement they don't take (e.g. creatine for muscle gain, vitamin D if none, protein if under target). Never suggest megadoses or stacks.
- focus: one very short phrase.
Do NOT diagnose, do NOT give medical dosing advice, do NOT discuss prescription medication or drug interactions in depth. If they take nothing, briefly encourage adding what they take so you can help.`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: COACH_SCHEMA,
        maxOutputTokens: 1000,
        temperature: 0.55,
      },
    },
    GEMINI_MODEL_FAST
  );

  const str = (v, fallback = '') =>
    typeof v === 'string' && v.trim() ? v.trim() : fallback;

  return {
    headline: str(raw?.headline, t('coach.fallbackHeadline')),
    summary: str(raw?.summary),
    tips: Array.isArray(raw?.tips)
      ? raw.tips.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
      : [],
    focus: str(raw?.focus),
  };
}

// ================= Подбор добавок =================

const RECO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intro: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          dose: { type: 'STRING' },
          timing: { type: 'STRING' },
          why: { type: 'STRING' },
        },
        required: ['name', 'dose', 'timing', 'why'],
      },
    },
  },
  required: ['intro', 'items'],
};

/**
 * Подбирает добавки по ответам пользователя и тому, что он уже принимает.
 * kind='supp_reco' (не метрируется). Модель flash-lite.
 * @param {{goal,diet,experience}} answers
 * @param {string[]} alreadyTaking названия добавок, которые уже принимает
 */
export async function generateSupplementReco(answers, alreadyTaking = []) {
  const lang = langName();

  const raw = await geminiJSON(
    'supp_reco',
    {
      system_instruction: {
        parts: [
          {
            text: `You are a nutrition coach — NOT a doctor. Recommend evidence-based supplements based on the user's goal, diet and what they already take. Answer STRICTLY as one JSON object, no markdown. Everything in ${lang}.
User answers (JSON): ${JSON.stringify(answers)}
Already taking: ${JSON.stringify(alreadyTaking)}
Rules:
- Recommend 2–4 supplements the user is NOT already taking. Prioritise well-established, safe options (creatine, whey or plant protein, vitamin D3, omega-3, magnesium, caffeine, electrolytes, vitamin B12 for vegans, etc.).
- If experience is "basics", recommend only the 2 most impactful and most established.
- Each item: name, dose (typical safe range, e.g. "3–5 g/day"), timing (short, e.g. "with a meal"), why (one sentence tied to their goal or diet).
- NEVER recommend hormones, prohormones, prescription drugs, high-risk stimulants, or anything needing medical supervision. No megadoses.
- "intro": one short sentence.`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: 'Recommend supplements.' }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RECO_SCHEMA,
        maxOutputTokens: 1800,
        temperature: 0.5,
      },
    },
    GEMINI_MODEL_FAST
  );

  return {
    intro: typeof raw?.intro === 'string' ? raw.intro.trim() : '',
    items: (Array.isArray(raw?.items) ? raw.items : [])
      .map((e) => ({
        name: String(e?.name || '').trim(),
        dose: String(e?.dose || '').trim(),
        timing: String(e?.timing || '').trim(),
        why: String(e?.why || '').trim(),
      }))
      .filter((e) => e.name)
      .slice(0, 5),
  };
}

// ================= Чат с тренером =================

const CHAT_SCHEMA = {
  type: 'OBJECT',
  properties: { reply: { type: 'STRING' } },
  required: ['reply'],
};

/**
 * Ответ ИИ-тренера в чате. kind='coach_chat' (лимит проверяется на клиенте).
 * НЕ тратит серверный лимит анализов. Модель — flash-lite.
 * @param {Array<{role:'user'|'assistant', content:string}>} history последние сообщения
 * @param {string} contextText JSON-сводка профиля пользователя
 */
export async function coachChatReply(history, contextText) {
  const lang = langName();

  const contents = (history || [])
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  if (contents.length === 0 || contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: 'Hi' }] });
  }

  const raw = await geminiJSON(
    'coach_chat',
    {
      system_instruction: {
        parts: [
          {
            text: `You are the user's personal nutrition & fitness coach, chatting with them. Reply in ${lang}.
Be concise (2–5 sentences), warm, practical and specific to the user's data. Give concrete numbers and actions. Never diagnose or give medical treatment advice — for medical concerns, suggest seeing a professional.
User context (JSON): ${contextText}
Answer STRICTLY as one JSON object: { "reply": "<your message>" }`,
          },
        ],
      },
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: CHAT_SCHEMA,
        maxOutputTokens: 700,
        temperature: 0.7,
      },
    },
    GEMINI_MODEL_FAST
  );

  const reply = typeof raw?.reply === 'string' ? raw.reply.trim() : '';
  return reply || t('coachchat.fallback');
}

function mapHttpError(status, bodyText) {
  let apiMessage = '';
  let retrySeconds = null;
  try {
    const j = JSON.parse(bodyText);
    apiMessage = j?.error?.message ?? '';
    const details = j?.error?.details ?? [];
    const retry = details.find((d) =>
      String(d?.['@type'] ?? '').includes('RetryInfo')
    );
    if (retry?.retryDelay) {
      retrySeconds = parseInt(String(retry.retryDelay), 10) || null;
    }
  } catch (e) {
    // тело не JSON — не страшно
  }

  if (status === 429) {
    return new AppError(
      retrySeconds ? t('err.rateLimitIn', { n: retrySeconds }) : t('err.rateLimit'),
      'RATE_LIMIT'
    );
  }
  if (
    status === 400 &&
    /api key not valid|api_key_invalid|invalid api key/i.test(apiMessage)
  ) {
    return new AppError(t('err.badKey'), 'BAD_KEY');
  }
  if (status === 401 || status === 403) return new AppError(t('err.badKey'), 'BAD_KEY');
  if (status === 404 && /no longer available|not found for/i.test(apiMessage)) {
    return new AppError(t('err.modelGone'), 'SERVER');
  }
  if (status >= 500) return new AppError(t('err.serverBusy'), 'SERVER');
  return new AppError(`${t('err.generic')} (Gemini ${status})`, 'UNKNOWN');
}
