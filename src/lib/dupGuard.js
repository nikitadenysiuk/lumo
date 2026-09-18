// src/lib/dupGuard.js
// Защита от случайного повторного добавления того же приёма (двойной тап,
// «кажется не сработало»). Проверка локальная — по уже загруженному списку.

import { Alert } from 'react-native';
import { t } from '../i18n';
import { fetchRecentMeals } from '../services/supabaseClient';

const WINDOW_MS = 4 * 60 * 1000;

/** Ищет такой же приём, добавленный за последние ~4 минуты. */
export function findRecentDup(meals, name, calories) {
  const nm = String(name || '').trim().toLowerCase();
  if (!nm) return null;
  const now = Date.now();
  return (
    (meals || []).find((m) => {
      if (now - new Date(m.created_at).getTime() > WINDOW_MS) return false;
      if (String(m.food_name || '').trim().toLowerCase() !== nm) return false;
      if (calories != null && Math.abs((m.calories || 0) - calories) > 20) {
        return false;
      }
      return true;
    }) || null
  );
}

/** Диалог «уже добавляли, всё равно?». Promise<boolean> — продолжать. */
export function confirmDup() {
  return new Promise((resolve) => {
    Alert.alert(t('dup.title'), t('dup.msg'), [
      { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('dup.addAnyway'), onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Сам подтягивает приёмы за сегодня и, если находит дубль, спрашивает.
 * Для экранов, где список приёмов не загружен. Promise<boolean> — продолжать.
 */
export async function checkDup(name, calories) {
  let meals = [];
  try {
    meals = await fetchRecentMeals(1);
  } catch (e) {
    return true; // не смогли проверить — не мешаем сохранить
  }
  if (!findRecentDup(meals, name, calories)) return true;
  return confirmDup();
}
