// src/lib/meals.js — типы приёмов пищи.

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_EMOJI = {
  breakfast: '🥣',
  lunch: '🍲',
  dinner: '🍛',
  snack: '🍎',
};

/** Угадать тип приёма по времени. */
export function guessMealType(date = new Date()) {
  const h = new Date(date).getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

/** Порядок для группировки в дневнике. */
export const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2, snack: 3, other: 4 };
