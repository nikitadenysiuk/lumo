// src/services/supabaseClient.js
//
// One shared Supabase client for the whole app: auth, Postgres (meal log
// history), and storage (food photos). Create a free project at
// https://supabase.com, then fill in .env from .env.example.

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { t } from '../i18n';
import { sumItems } from '../lib/nutrition';
import { MEAL_TYPES } from '../lib/meals';

const r1 = (n) => Math.round(n * 10) / 10;

// В БД meal_type допускает только 4 значения (или NULL) — см. db/10_meal_type.sql.
// Всё остальное ('other', пусто, мусор) приводим к NULL, иначе insert падает
// по check-constraint "meals_meal_type_check".
const cleanMealType = (v) => (MEAL_TYPES.includes(v) ? v : null);

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Supabase needs somewhere to persist the session between app launches.
// expo-secure-store keeps it in the OS keychain instead of plain storage.
const ExpoSecureStoreAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Приватный bucket с фото еды (создаётся в db/03_storage.sql).
const MEAL_PHOTOS_BUCKET = 'meal-photos';

// base64 -> байты. atob есть в React Native (Hermes) начиная с RN 0.74.
function base64ToBytes(base64) {
  const binary = global.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Saves one analyzed meal to the `meals` table.
 * Expected table schema (run in Supabase SQL editor):
 *
 * create table meals (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users not null default auth.uid(),
 *   food_name text,
 *   calories int,
 *   protein_g numeric,
 *   carbs_g numeric,
 *   fat_g numeric,
 *   photo_url text,
 *   created_at timestamptz default now()
 * );
 * alter table meals enable row level security;
 * create policy "Users manage their own meals" on meals
 *   for all using (auth.uid() = user_id);
 */
export async function saveMeal(meal) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t('err.generic'));

  const row = { ...meal, user_id: user.id };
  if ('meal_type' in row) row.meal_type = cleanMealType(row.meal_type);

  const { data, error } = await supabase
    .from('meals')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Быстрое добавление в дневник без экрана результата.
 * Принимает payload из поиска / истории / избранного:
 *  - продукт  { name, brand?, per100:{...}, servingSizeG?, imageUrl?, items? }
 *  - результат фото { food_name, items:[...] }
 *  - копия записи дневника { food_name, calories, protein_g, ... , items? }
 * @param {object} payload
 * @param {{ dateKey:string, isToday:boolean, mealType:string, grams?:number }} opts
 */
export async function addMealFromPayload(payload, opts) {
  const { dateKey, isToday, mealType, grams } = opts || {};
  const created_at = isToday
    ? undefined
    : new Date(`${dateKey}T12:00:00`).toISOString();

  let meal;
  if (payload && payload.per100) {
    // упакованный продукт / ответ "Спросить AI"
    const g = grams || payload.servingSizeG || 100;
    const k = g / 100;
    const p = payload.per100;
    meal = {
      food_name: payload.brand ? `${payload.name} (${payload.brand})` : payload.name,
      calories: Math.round((p.calories || 0) * k),
      protein_g: r1((p.protein_g || 0) * k),
      carbs_g: r1((p.carbs_g || 0) * k),
      fat_g: r1((p.fat_g || 0) * k),
      photo_url:
        typeof payload.imageUrl === 'string' && payload.imageUrl.startsWith('http')
          ? payload.imageUrl
          : null,
    };
  } else if (payload && Array.isArray(payload.items) && payload.items.length) {
    // сохранённый результат фото
    const totals = sumItems(payload.items);
    meal = {
      food_name: payload.food_name || payload.name || '—',
      calories: totals.calories,
      protein_g: totals.protein_g,
      carbs_g: totals.carbs_g,
      fat_g: totals.fat_g,
      items: payload.items,
    };
  } else if (payload && payload.food_name) {
    // копия записи дневника ("повторить приём")
    meal = {
      food_name: payload.food_name,
      calories: payload.calories || 0,
      protein_g: Number(payload.protein_g) || 0,
      carbs_g: Number(payload.carbs_g) || 0,
      fat_g: Number(payload.fat_g) || 0,
      photo_url:
        typeof payload.photo_url === 'string' && payload.photo_url.startsWith('http')
          ? payload.photo_url
          : null,
      items: Array.isArray(payload.items) && payload.items.length ? payload.items : null,
    };
  } else {
    throw new Error(t('err.generic'));
  }

  return saveMeal({ ...meal, meal_type: mealType, created_at });
}

/**
 * Сколько бесплатных анализов осталось у текущего пользователя.
 * Не меняет счётчик. Возвращает { used, limit, is_pro, remaining }.
 */
export async function getAnalysisQuota() {
  const { data, error } = await supabase.rpc('analysis_quota');
  if (error) throw error;
  return data;
}

/**
 * Фиксирует использование одного бесплатного анализа (увеличивает счётчик).
 * Вызывать ТОЛЬКО после успешного ответа от Gemini.
 */
export async function consumeAnalysis() {
  const { data, error } = await supabase.rpc('consume_analysis');
  if (error) throw error;
  return data;
}

/**
 * Полный профиль: счётчик анализов + данные онбординга + дневная цель.
 * { used, limit, is_pro, remaining, onboarded, sex, age, height_cm,
 *   weight_kg, activity, goal, daily_kcal_goal }
 */
export async function getProfile() {
  const { data, error } = await supabase.rpc('get_profile');
  if (error) throw error;
  return data;
}

/**
 * Сохраняет данные онбординга, сервер пересчитывает daily_kcal_goal.
 * @param {{sex, age, height_cm, weight_kg, activity, goal}} input
 * @returns обновлённый профиль (как getProfile)
 */
export async function saveProfile(input) {
  const { data, error } = await supabase.rpc('save_profile', {
    p_sex: input.sex,
    p_age: input.age,
    p_height_cm: input.height_cm,
    p_weight_kg: input.weight_kg,
    p_activity: input.activity,
    p_goal: input.goal,
  });
  if (error) throw error;
  return data;
}

/**
 * Ручные цели: ккал / Б / Ж / У / целевой вес. null в поле = авто-расчёт.
 * @param {{kcal:?number, protein:?number, fat:?number, carbs:?number, targetWeight:?number}} input
 * @returns обновлённый профиль (как getProfile)
 */
export async function saveGoalOverrides(input) {
  const n = (v) =>
    v === null || v === undefined || v === '' || Number.isNaN(Number(v))
      ? null
      : Number(v);
  const { data, error } = await supabase.rpc('save_goal_overrides', {
    p_kcal: n(input.kcal),
    p_protein: n(input.protein),
    p_fat: n(input.fat),
    p_carbs: n(input.carbs),
    p_target_weight: n(input.targetWeight),
  });
  if (error) throw error;
  return data;
}

/** Обновляет поля одной записи. RLS разрешает менять только свои. */
export async function updateMeal(id, patch) {
  const { data, error } = await supabase
    .from('meals')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Полное удаление аккаунта: фото из Storage + все данные + учётная запись
 * (см. db/16_delete_account.sql). После успеха вызывающий делает signOut().
 */
export async function deleteAccount() {
  // 1. удалить все фото пользователя из Storage (папка <user_id>/…) — через API,
  //    прямой delete из storage.objects Supabase запрещает.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      const { data: files } = await supabase.storage
        .from(MEAL_PHOTOS_BUCKET)
        .list(user.id, { limit: 1000 });
      const paths = (files ?? [])
        .filter((f) => f?.name)
        .map((f) => `${user.id}/${f.name}`);
      if (paths.length) {
        await supabase.storage.from(MEAL_PHOTOS_BUCKET).remove(paths);
      }
    }
  } catch (e) {
    console.warn('deleteAccount: storage cleanup', e?.message);
  }

  // 2. удалить данные и учётку на сервере
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
}

/** Удаляет объекты из bucket с фото. Внешние http-ссылки пропускает. */
export async function removeStoragePhotos(paths) {
  const clean = [
    ...new Set(
      (paths ?? []).filter((p) => p && typeof p === 'string' && !p.startsWith('http'))
    ),
  ];
  if (!clean.length) return;
  const { error } = await supabase.storage
    .from(MEAL_PHOTOS_BUCKET)
    .remove(clean);
  if (error) console.warn('Не удалось удалить фото из Storage', error.message);
}

/** Удаляет запись и (по возможности) её фото из Storage. */
export async function deleteMeal(meal) {
  const { error } = await supabase.from('meals').delete().eq('id', meal.id);
  if (error) throw error;

  const paths = [
    meal.photo_url,
    ...(Array.isArray(meal.photos) ? meal.photos : []),
  ];
  await removeStoragePhotos(paths);
}

/**
 * Пишет запись в историю поиска (фото/штрих-код/поиск). Не бросает —
 * это вспомогательная функция, её падение не должно ломать основной поток.
 * @param {{kind:'photo'|'barcode'|'search', title?:string, calories?:number, photo_url?:string}} entry
 */
export async function logSearch(entry) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('search_history').insert({
      user_id: user.id,
      kind: entry.kind,
      title: entry.title ?? null,
      calories: entry.calories ?? null,
      photo_url: entry.photo_url ?? null,
      payload: entry.payload ?? null,
    });
  } catch (e) {
    console.warn('logSearch failed', e?.message);
  }
}

// --- Избранное ---
export async function fetchFavorites(limit = 60) {
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function addFavorite({ title, calories, payload, kind = 'product' }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t('err.generic'));
  const { data, error } = await supabase
    .from('favorites')
    .insert({
      user_id: user.id,
      title,
      calories: calories ?? null,
      payload: payload ?? null,
      kind,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFavorite(id) {
  const { error } = await supabase.from('favorites').delete().eq('id', id);
  if (error) throw error;
}

// --- Кэш ленты рецептов ---
export async function getFeedCache() {
  const { data, error } = await supabase
    .from('feed_cache')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setFeedCache(goal, lang, recipes) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('feed_cache').upsert({
    user_id: user.id,
    goal,
    lang,
    recipes,
    updated_at: new Date().toISOString(),
  });
}

// --- Карточка коуча (db/17_coach.sql) ---

/**
 * Карточка коуча за день (YYYY-MM-DD). null, если ещё не сгенерирована или язык другой.
 * @param {string} kind 'day' — дневная карточка, 'workout' — совет по тренировкам
 */
export async function getCoachCard(dateKey, lang, kind = 'day') {
  const { data, error } = await supabase
    .from('coach_cards')
    .select('*')
    .eq('card_date', dateKey)
    .eq('kind', kind)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (lang && data.lang && data.lang !== lang) return null;
  return data.payload ?? null;
}

// --- Чат с тренером (db/21_coach_chat.sql) ---

export async function fetchCoachMessages(limit = 60) {
  const { data, error } = await supabase
    .from('coach_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function addCoachMessage(role, content) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t('err.generic'));
  const { data, error } = await supabase
    .from('coach_messages')
    .insert({ user_id: user.id, role, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Сколько вопросов пользователь задал сегодня (для лимита бесплатных). */
export async function countCoachQuestionsToday() {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('coach_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', since.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function clearCoachChat() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('coach_messages')
    .delete()
    .eq('user_id', user.id);
  if (error) throw error;
}

// --- Подбор добавок (кэш в coach_cards kind='supp_reco', не привязан к дню) ---

export async function getSupplementReco() {
  const { data, error } = await supabase
    .from('coach_cards')
    .select('payload')
    .eq('kind', 'supp_reco')
    .order('card_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.payload ?? null;
}

export async function saveSupplementReco(lang, payload) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('coach_cards')
    .delete()
    .eq('user_id', user.id)
    .eq('kind', 'supp_reco');
  const { error } = await supabase.from('coach_cards').insert({
    user_id: user.id,
    card_date: new Date().toISOString().slice(0, 10),
    kind: 'supp_reco',
    lang: lang || 'en',
    payload,
  });
  if (error) throw error;
}

export async function clearSupplementReco() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('coach_cards')
    .delete()
    .eq('user_id', user.id)
    .eq('kind', 'supp_reco');
  if (error) throw error;
}

export async function saveCoachCard(dateKey, lang, payload, kind = 'day') {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('coach_cards').upsert(
    {
      user_id: user.id,
      card_date: dateKey,
      kind,
      lang: lang || 'en',
      payload,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,card_date,kind' }
  );
  if (error) throw error;
}

// --- Добавки / БАДы (db/18_supplements.sql) ---

export async function fetchSupplements() {
  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Создаёт (без id) или обновляет (с id) добавку. Возвращает строку. */
export async function saveSupplement(input) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t('err.generic'));
  const row = {
    user_id: user.id,
    name: String(input.name || '').trim(),
    dose: input.dose ? String(input.dose).trim() : null,
    times: Array.isArray(input.times) ? input.times : [],
    days: Array.isArray(input.days) ? input.days : [],
    note: input.note ? String(input.note).trim() : null,
    active: input.active !== false,
    sort: Number.isFinite(input.sort) ? input.sort : 0,
  };
  if (input.id) row.id = input.id;
  const { data, error } = await supabase
    .from('supplements')
    .upsert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSupplement(id) {
  const { error } = await supabase.from('supplements').delete().eq('id', id);
  if (error) throw error;
}

/** Отметки приёма за день (YYYY-MM-DD). */
export async function fetchSupplementLog(dateKey) {
  const { data, error } = await supabase
    .from('supplement_log')
    .select('*')
    .eq('taken_on', dateKey);
  if (error) throw error;
  return data ?? [];
}

/** Все отметки приёма за последние `days` дней (для оценки регулярности). */
export async function fetchSupplementLogRange(days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('supplement_log')
    .select('*')
    .gte('taken_on', since.toISOString().slice(0, 10));
  if (error) throw error;
  return data ?? [];
}

/** Ставит отметку «принял» для (добавка, слот) на день. slot: 'HH:MM' или ''. */
export async function logSupplement(supplementId, slot, dateKey) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t('err.generic'));
  const { error } = await supabase.from('supplement_log').upsert(
    {
      user_id: user.id,
      supplement_id: supplementId,
      taken_on: dateKey,
      slot: slot || '',
      taken_at: new Date().toISOString(),
    },
    { onConflict: 'supplement_id,taken_on,slot', ignoreDuplicates: true }
  );
  if (error) throw error;
}

/** Снимает отметку «принял». */
export async function unlogSupplement(supplementId, slot, dateKey) {
  const { error } = await supabase
    .from('supplement_log')
    .delete()
    .eq('supplement_id', supplementId)
    .eq('taken_on', dateKey)
    .eq('slot', slot || '');
  if (error) throw error;
}

// --- Тренировки (db/19_workouts.sql) ---

/** Тренировки за последние `days` дней, новые сверху. */
export async function fetchWorkouts(days = 60) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .gte('workout_on', since.toISOString().slice(0, 10))
    .order('workout_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Создаёт (без id) или обновляет (с id) тренировку. Возвращает строку. */
export async function saveWorkout(input) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t('err.generic'));
  const num = (v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const row = {
    user_id: user.id,
    workout_on: input.workout_on,
    type: input.type || 'strength',
    title: input.title ? String(input.title).trim() : null,
    duration_min: input.duration_min != null ? Math.round(num(input.duration_min)) || null : null,
    distance_km: input.distance_km != null ? num(input.distance_km) : null,
    calories_est: input.calories_est != null ? Math.round(num(input.calories_est)) || null : null,
    feeling: input.feeling || null,
    note: input.note ? String(input.note).trim() : null,
  };
  if (input.id) row.id = input.id;
  const { data, error } = await supabase
    .from('workouts')
    .upsert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorkout(id) {
  const { error } = await supabase.from('workouts').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchWorkoutSets(workoutId) {
  const { data, error } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('workout_id', workoutId)
    .order('sort', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// --- План тренировок (db/22_workout_plans.sql) ---

export async function fetchActivePlan() {
  const { data, error } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function saveWorkoutPlan(title, payload) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t('err.generic'));
  await supabase
    .from('workout_plans')
    .update({ active: false })
    .eq('user_id', user.id)
    .eq('active', true);
  const { data, error } = await supabase
    .from('workout_plans')
    .insert({ user_id: user.id, title, payload, active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorkoutPlan(id) {
  const { error } = await supabase.from('workout_plans').delete().eq('id', id);
  if (error) throw error;
}

/** Перезаписывает payload плана (напр. после правки одного дня). */
export async function updateWorkoutPlan(id, payload) {
  const { data, error } = await supabase
    .from('workout_plans')
    .update({ payload })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Подходы для нескольких тренировок сразу. */
export async function fetchWorkoutSetsIn(workoutIds) {
  if (!workoutIds || workoutIds.length === 0) return [];
  const { data, error } = await supabase
    .from('workout_sets')
    .select('*')
    .in('workout_id', workoutIds);
  if (error) throw error;
  return data ?? [];
}

/** Полностью заменяет подходы тренировки. sets: [{exercise, set_index, reps, weight_kg, sort}]. */
export async function replaceWorkoutSets(workoutId, sets) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t('err.generic'));
  const { error: delErr } = await supabase
    .from('workout_sets')
    .delete()
    .eq('workout_id', workoutId);
  if (delErr) throw delErr;
  if (!sets || sets.length === 0) return;
  const rows = sets.map((s) => ({ ...s, user_id: user.id, workout_id: workoutId }));
  const { error } = await supabase.from('workout_sets').insert(rows);
  if (error) throw error;
}

/** Уникальные названия упражнений пользователя (по частоте), для списка «прогресс». */
export async function fetchExerciseNames(limit = 40) {
  const { data, error } = await supabase
    .from('workout_sets')
    .select('exercise')
    .order('created_at', { ascending: false })
    .limit(600);
  if (error) throw error;
  const seen = new Map();
  for (const r of data ?? []) {
    const name = (r.exercise || '').trim();
    if (!name) continue;
    seen.set(name, (seen.get(name) || 0) + 1);
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/**
 * История одного упражнения: подходы + дата тренировки.
 * @returns [{ workout_on, reps, weight_kg }]
 */
/**
 * История одного упражнения: подходы + дата тренировки.
 * Два простых запроса вместо PostgREST-embed (надёжнее — не зависит от того,
 * подхватил ли PostgREST связь workout_sets → workouts).
 * @returns [{ workout_on, reps, weight_kg }]
 */
export async function fetchExerciseHistory(name) {
  const { data: sets, error } = await supabase
    .from('workout_sets')
    .select('reps, weight_kg, workout_id')
    .eq('exercise', name)
    .limit(400);
  if (error) throw error;
  if (!sets || sets.length === 0) return [];

  const ids = [...new Set(sets.map((s) => s.workout_id))];
  const { data: wos, error: e2 } = await supabase
    .from('workouts')
    .select('id, workout_on')
    .in('id', ids);
  if (e2) throw e2;

  const dateById = {};
  for (const w of wos ?? []) dateById[w.id] = w.workout_on;

  return sets
    .map((s) => ({
      workout_on: dateById[s.workout_id],
      reps: s.reps,
      weight_kg: s.weight_kg,
    }))
    .filter((r) => r.workout_on);
}

export async function fetchSearchHistory(limit = 40) {
  const { data, error } = await supabase
    .from('search_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function clearSearchHistory() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('search_history')
    .delete()
    .eq('user_id', user.id);
  if (error) throw error;
}

export async function fetchMealHistory(limit = 50) {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** Все приёмы пользователя (для экспорта дневника). */
export async function fetchAllMeals() {
  const { data, error } = await supabase
    .from('meals')
    .select(
      'created_at, meal_type, food_name, calories, protein_g, carbs_g, fat_g'
    )
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Приёмы пищи за последние `days` дней (для календаря / графиков). */
export async function fetchRecentMeals(days = 45) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// --- Трекинг веса (db/11_weight_log.sql) ---

/** Записи веса за последние `days` дней, по возрастанию даты. */
export async function fetchWeightLog(days = 180) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('weight_log')
    .select('*')
    .gte('logged_on', since.toISOString().slice(0, 10))
    .order('logged_on', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Пишет / перезаписывает вес за указанный день (YYYY-MM-DD). */
export async function logWeight(weightKg, dateKey) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t('err.generic'));
  const { data, error } = await supabase
    .from('weight_log')
    .upsert(
      { user_id: user.id, logged_on: dateKey, weight_kg: weightKg },
      { onConflict: 'user_id,logged_on' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWeightEntry(id) {
  const { error } = await supabase.from('weight_log').delete().eq('id', id);
  if (error) throw error;
}

// --- Трекинг воды (db/12_water_log.sql) ---

/** Сколько стаканов за день (0, если записи нет). */
export async function getWater(dateKey) {
  const { data, error } = await supabase
    .from('water_log')
    .select('glasses')
    .eq('logged_on', dateKey)
    .maybeSingle();
  if (error) throw error;
  return data?.glasses ?? 0;
}

/** Устанавливает число стаканов за день. */
export async function setWater(dateKey, glasses) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(t('err.generic'));
  const g = Math.max(0, Math.min(30, Math.round(glasses)));
  const { error } = await supabase.from('water_log').upsert(
    { user_id: user.id, logged_on: dateKey, glasses: g, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,logged_on' }
  );
  if (error) throw error;
  return g;
}

/**
 * Загружает фото в приватный bucket. Возвращает путь к объекту
 * (его кладём в meals.photo_url), НЕ готовую ссылку.
 * @param {string} base64 - JPEG в base64 без префикса data:
 * @returns {Promise<string>} путь вида "<user_id>/<файл>.jpg"
 */
export async function uploadMealPhoto(base64) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !base64) throw new Error(t('err.generic'));

  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${user.id}/${Date.now()}-${rand}.jpg`;

  const { error } = await supabase.storage
    .from(MEAL_PHOTOS_BUCKET)
    .upload(path, base64ToBytes(base64), {
      contentType: 'image/jpeg',
      upsert: false,
    });
  if (error) throw error;
  return path;
}

/**
 * Для списка путей возвращает { путь: временная_ссылка } (действует 1 час).
 * Битые/недоступные пути молча пропускаются.
 */
export async function getSignedPhotoUrls(paths) {
  // http-ссылки (фото из Open Food Facts) не трогаем — они и так готовые.
  const clean = [
    ...new Set(
      (paths ?? []).filter((p) => p && !p.startsWith('http'))
    ),
  ];
  if (clean.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(MEAL_PHOTOS_BUCKET)
    .createSignedUrls(clean, 3600);
  if (error) throw error;

  const map = {};
  for (const item of data ?? []) {
    if (item.signedUrl && !item.error) {
      map[item.path] = item.signedUrl;
    }
  }
  return map;
}
