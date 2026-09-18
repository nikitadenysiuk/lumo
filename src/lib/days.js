// src/lib/days.js — группировка приёмов пищи по дням (локальное время).

// Цветовые метки выполнения дневной нормы калорий.
export const GOAL_COLORS = {
  none: null,
  red: '#ef4444',
  yellow: '#f59e0b',
  green: '#22c55e',
};

/**
 * @returns {'none'|'red'|'yellow'|'green'}
 *  none  — за день ничего не записано
 *  red   — норма не выполнена (< 75%)
 *  yellow— почти / в процессе (75–95%)
 *  green — выполнена или перевыполнена (>= 95%)
 */
export function goalStatus(kcal, goal) {
  if (!kcal) return 'none';
  if (!goal) return 'green';
  const p = kcal / goal;
  if (p < 0.75) return 'red';
  if (p < 0.95) return 'yellow';
  return 'green';
}

export function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(
    x.getDate()
  ).padStart(2, '0')}`;
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isSameDay(a, b) {
  return dayKey(a) === dayKey(b);
}

/** Список последних `n` дат (Date, начало дня), от старой к сегодня. */
export function lastNDays(n, endDate = new Date()) {
  const end = startOfDay(endDate);
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(addDays(end, -i));
  return out;
}

/**
 * Сколько дней подряд (считая от сегодня) есть хотя бы одна запись.
 * Если сегодня пусто — стрик считается по вчерашний день включительно.
 * @param {object} byDay результат totalsByDay
 */
export function currentStreak(byDay, endDate = new Date()) {
  let d = startOfDay(endDate);
  if (!byDay[dayKey(d)]?.count) d = addDays(d, -1);
  let n = 0;
  while (byDay[dayKey(d)]?.count) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

/**
 * Средние за последние `n` дней ПО ДНЯМ С ЗАПИСЯМИ (пустые дни не занижают).
 * @returns {{days:number, calories:number, protein_g:number, carbs_g:number, fat_g:number}}
 */
export function weekAverage(byDay, n = 7, endDate = new Date()) {
  const dates = lastNDays(n, endDate);
  const withData = dates.map((d) => byDay[dayKey(d)]).filter((x) => x && x.count);
  const days = withData.length;
  if (!days) {
    return { days: 0, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  }
  const sum = withData.reduce(
    (a, x) => ({
      calories: a.calories + x.calories,
      protein_g: a.protein_g + x.protein_g,
      carbs_g: a.carbs_g + x.carbs_g,
      fat_g: a.fat_g + x.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
  return {
    days,
    calories: Math.round(sum.calories / days),
    protein_g: Math.round(sum.protein_g / days),
    carbs_g: Math.round(sum.carbs_g / days),
    fat_g: Math.round(sum.fat_g / days),
  };
}

/** Суммы по дню: { 'YYYY-MM-DD': {calories,protein_g,carbs_g,fat_g,count} } */
export function totalsByDay(meals) {
  const map = {};
  for (const m of meals || []) {
    const k = dayKey(m.created_at);
    if (!map[k]) {
      map[k] = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, count: 0 };
    }
    map[k].calories += m.calories ?? 0;
    map[k].protein_g += Number(m.protein_g) || 0;
    map[k].carbs_g += Number(m.carbs_g) || 0;
    map[k].fat_g += Number(m.fat_g) || 0;
    map[k].count += 1;
  }
  for (const k of Object.keys(map)) {
    map[k].protein_g = Math.round(map[k].protein_g);
    map[k].carbs_g = Math.round(map[k].carbs_g);
    map[k].fat_g = Math.round(map[k].fat_g);
  }
  return map;
}
