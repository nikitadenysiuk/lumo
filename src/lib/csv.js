// src/lib/csv.js — сборка CSV дневника.

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const pad = (n) => String(n).padStart(2, '0');

/**
 * @param {Array} meals записи из fetchAllMeals (created_at по возрастанию)
 * @returns {string} CSV с BOM и CRLF (открывается в Excel/Numbers как UTF-8)
 */
export function mealsToCsv(meals) {
  const header = [
    'date',
    'time',
    'meal',
    'name',
    'calories',
    'protein_g',
    'carbs_g',
    'fat_g',
  ].join(',');

  const lines = (meals || []).map((m) => {
    const d = new Date(m.created_at);
    return [
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      m.meal_type || '',
      m.food_name || '',
      Math.round(Number(m.calories) || 0),
      m.protein_g ?? '',
      m.carbs_g ?? '',
      m.fat_g ?? '',
    ]
      .map(esc)
      .join(',');
  });

  const BOM = String.fromCharCode(0xfeff);
  return BOM + [header, ...lines].join('\r\n') + '\r\n';
}
