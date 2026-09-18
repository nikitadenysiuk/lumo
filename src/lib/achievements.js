// src/lib/achievements.js — расчёт бейджей из уже имеющихся данных.

import { currentStreak, lastNDays, dayKey, goalStatus } from './days';

function tierBadge(id, emoji, title, value, tiers) {
  const reached = tiers.filter((x) => value >= x).length;
  const next = tiers[Math.min(reached, tiers.length - 1)];
  return {
    id,
    emoji,
    title,
    value,
    target: next,
    tier: reached,
    maxTier: tiers.length,
    done: reached >= tiers.length,
    progress: Math.min(1, value / next),
  };
}

/**
 * @param {{meals:Array, weights:Array, favorites:Array, byDay:object, goalKcal:?number}} data
 * @param {(k:string,o?:object)=>string} t
 */
export function computeAchievements(data, t) {
  const { meals = [], weights = [], favorites = [], byDay = {}, goalKcal } = data;

  const mealCount = meals.length;
  const daysLogged = Object.keys(byDay).length;
  const weightCount = weights.length;
  const favRecipes = favorites.filter((f) => f.kind === 'recipe').length;
  const streak = currentStreak(byDay);

  const week = lastNDays(7);
  const weekGreen = week.filter(
    (d) => goalStatus(byDay[dayKey(d)]?.calories || 0, goalKcal) === 'green'
  ).length;

  return [
    tierBadge('meals', '🍽', t('ach.meals'), mealCount, [1, 10, 50, 200]),
    tierBadge('days', '📅', t('ach.days'), daysLogged, [1, 7, 30, 100]),
    tierBadge('streak', '🔥', t('ach.streak'), streak, [3, 7, 14, 30]),
    tierBadge('weight', '⚖️', t('ach.weight'), weightCount, [1, 7, 30]),
    tierBadge('recipes', '🍳', t('ach.recipes'), favRecipes, [1, 5, 15]),
    {
      id: 'weekgoal',
      emoji: '🎯',
      title: t('ach.weekGoal'),
      value: weekGreen,
      target: 7,
      tier: weekGreen >= 7 ? 1 : 0,
      maxTier: 1,
      done: weekGreen >= 7,
      progress: weekGreen / 7,
    },
  ];
}
