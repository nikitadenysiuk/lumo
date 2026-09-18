// src/lib/coachContext.js
//
// Собирает компактную сводку по пользователю за последнюю неделю — её отдаём
// Gemini для дневной карточки коуча (см. aiService.getCoachCard).
// Ничего не запрашивает сам: получает уже загруженные данные.

import {
  addDays,
  currentStreak,
  dayKey,
  lastNDays,
  totalsByDay,
  weekAverage,
} from './days';

function weightSummary(weightLog) {
  if (!Array.isArray(weightLog) || weightLog.length === 0) return null;
  const sorted = [...weightLog].sort((a, b) =>
    String(a.logged_on).localeCompare(String(b.logged_on))
  );
  const last = sorted[sorted.length - 1];
  const current = Number(last.weight_kg);
  if (!Number.isFinite(current)) return null;

  const nearestBefore = (isoDate) => {
    let best = null;
    for (const row of sorted) {
      if (String(row.logged_on) <= isoDate) best = row;
      else break;
    }
    return best ? Number(best.weight_kg) : null;
  };

  const d7 = nearestBefore(dayKey(addDays(new Date(), -7)));
  const d30 = nearestBefore(dayKey(addDays(new Date(), -30)));
  const round1 = (n) => Math.round(n * 10) / 10;

  return {
    current: round1(current),
    delta7: d7 != null ? round1(current - d7) : null,
    delta30: d30 != null ? round1(current - d30) : null,
    entries: sorted.length,
  };
}

/**
 * @param {{
 *   meals: Array,            // последние ~14 дней приёмов
 *   weightLog?: Array,       // записи веса
 *   profile: object,         // из getProfile()
 *   waterToday?: number,     // стаканов сегодня
 *   waterGoal?: number,      // норма стаканов
 * }} input
 */
export function buildCoachContext({
  meals,
  weightLog,
  profile,
  waterToday = 0,
  waterGoal = 8,
}) {
  const byDay = totalsByDay(meals || []);
  const goalKcal = profile?.daily_kcal_goal ?? null;
  const goalProtein = profile?.protein_goal ?? null;

  const days = lastNDays(7).map((d) => {
    const k = dayKey(d);
    const tot = byDay[k];
    return {
      date: k,
      kcal: tot?.calories ?? 0,
      protein_g: tot?.protein_g ?? 0,
      carbs_g: tot?.carbs_g ?? 0,
      fat_g: tot?.fat_g ?? 0,
      logged: !!tot?.count,
      pct_of_goal:
        goalKcal && tot?.calories
          ? Math.round((tot.calories / goalKcal) * 100)
          : null,
    };
  });

  const yKey = dayKey(addDays(new Date(), -1));
  const y = byDay[yKey];
  const yesterday = y
    ? {
        kcal: y.calories,
        protein_g: y.protein_g,
        pct_of_goal: goalKcal ? Math.round((y.calories / goalKcal) * 100) : null,
        over_kcal: goalKcal ? y.calories - goalKcal : null,
      }
    : null;

  const wavg = weekAverage(byDay, 7);
  const loggedDays = days.filter((d) => d.logged).length;

  return {
    goal: profile?.goal || 'maintain',
    goal_kcal: goalKcal,
    goal_protein_g: goalProtein,
    streak_days: currentStreak(byDay),
    logged_days_last_7: loggedDays,
    week_avg: {
      kcal: wavg.calories,
      protein_g: wavg.protein_g,
      carbs_g: wavg.carbs_g,
      fat_g: wavg.fat_g,
      days_counted: wavg.days,
    },
    yesterday,
    days,
    water: { today: waterToday || 0, goal: waterGoal || 8 },
    weight: weightSummary(weightLog),
  };
}
