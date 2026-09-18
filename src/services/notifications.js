// src/services/notifications.js
//
// Локальные напоминания записать приём пищи. Работают в Expo Go
// (только локальные, не push).
//
// «Умные»: каждый слот планируется как разовое уведомление на ближайшее
// срабатывание и переносится на завтра, если приём этого типа уже записан
// сегодня. rescheduleReminders() дёргается при запуске / возврате в приложение
// и после сохранения приёма (см. App.js ReminderScheduler).

import * as Notifications from 'expo-notifications';

import { t } from '../i18n';
import { isDueOn, isSlotTaken, sortTimes } from '../lib/supplements';

// type: какой приём «закрывает» этот слот (null — вечерний итог за день).
const SLOTS = [
  { hour: 9, minute: 0, type: 'breakfast', keys: ['notif.b1', 'notif.b2'] },
  { hour: 13, minute: 0, type: 'lunch', keys: ['notif.l1', 'notif.l2'] },
  { hour: 19, minute: 0, type: 'dinner', keys: ['notif.d1', 'notif.d2'] },
  { hour: 21, minute: 30, type: null, keys: ['notif.e1', 'notif.e2'] },
];

// слоты напоминания о воде (отдельный тумблер)
const WATER_SLOTS = [
  { hour: 11, minute: 30, keys: ['notif.w1', 'notif.w2'] },
  { hour: 16, minute: 0, keys: ['notif.w1', 'notif.w2'] },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Мотивационный слот — одно короткое сообщение в день о прогрессе.
const MOTIVATION_HOUR = 10;
const MOTIVATION_MIN = 30;
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365];

// Выбирает одно сообщение по приоритету на основе состояния пользователя.
function pickMotivation(m) {
  const { streak = 0, yKcal = 0, yGoal = 0, yLogged = false } = m || {};
  const { daysSinceWorkout = null, everLoggedWorkout = false } = m || {};

  if (STREAK_MILESTONES.includes(streak)) {
    return t('notif.mot_streak', { n: streak });
  }
  if (streak >= 3) return t('notif.mot_streakGo', { n: streak });
  if (yGoal && yKcal > yGoal * 1.15) return t('notif.mot_over');
  if (!yLogged) return t('notif.mot_missed');
  if (yGoal && yKcal > 0 && yKcal < yGoal * 0.6) return t('notif.mot_under');
  if (everLoggedWorkout && daysSinceWorkout != null && daysSinceWorkout >= 4) {
    return t('notif.mot_workout');
  }
  if (yGoal && yKcal >= yGoal * 0.9 && yKcal <= yGoal * 1.1) {
    return t('notif.mot_onTarget');
  }
  return t(pick(['notif.mot_g1', 'notif.mot_g2', 'notif.mot_g3']));
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function hasPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

async function doReschedule({
  enabled,
  loggedTypes = new Set(),
  mealCount = 0,
  water = null, // { enabled, goal, today }
  supplements = null, // { list: [...], log: [...] }
  motivation = null, // { enabled, streak, yKcal, yGoal, yLogged, daysSinceWorkout, everLoggedWorkout }
}) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const permitted = await hasPermission();
    const mealsOn = enabled && permitted;
    const waterOn = !!(water && water.enabled) && permitted;
    const suppList = (supplements && supplements.list) || [];
    const suppLog = (supplements && supplements.log) || [];
    const suppOn = permitted && suppList.length > 0;
    const motOn = !!(motivation && motivation.enabled) && permitted;
    if (!mealsOn && !waterOn && !suppOn && !motOn) return;

    const now = Date.now();

    if (motOn) {
      const at = new Date();
      at.setHours(MOTIVATION_HOUR, MOTIVATION_MIN, 0, 0);
      if (at.getTime() <= now) at.setDate(at.getDate() + 1);
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Lumo', body: pickMotivation(motivation) },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
        },
      });
    }

    if (suppOn) {
      const today = new Date();
      for (const s of suppList) {
        if (!isDueOn(s, today)) continue;
        for (const slot of sortTimes(s.times)) {
          const [h, m] = slot.split(':').map(Number);
          if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
          const at = new Date();
          at.setHours(h, m, 0, 0);
          let toTomorrow = at.getTime() <= now;
          // уже отмечено принятым сегодня — не напоминаем
          if (!toTomorrow && isSlotTaken(suppLog, s.id, slot)) toTomorrow = true;
          if (toTomorrow) {
            at.setDate(at.getDate() + 1);
            // на завтра проверяем, положена ли добавка завтра
            if (!isDueOn(s, at)) continue;
          }
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Lumo',
              body: t('notif.supp', { name: s.name || t('supp.title') }),
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: at,
            },
          });
        }
      }
    }

    if (waterOn) {
      for (const slot of WATER_SLOTS) {
        const at = new Date();
        at.setHours(slot.hour, slot.minute, 0, 0);
        // слот прошёл ИЛИ дневная норма воды уже набрана — на завтра
        let toTomorrow = at.getTime() <= now;
        if (!toTomorrow && (water.today || 0) >= (water.goal || 8)) {
          toTomorrow = true;
        }
        if (toTomorrow) at.setDate(at.getDate() + 1);
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Lumo', body: t(pick(slot.keys)) },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: at,
          },
        });
      }
    }

    if (!mealsOn) return;

    for (const slot of SLOTS) {
      const at = new Date();
      at.setHours(slot.hour, slot.minute, 0, 0);

      // слот уже прошёл сегодня — на завтра
      let toTomorrow = at.getTime() <= now;

      // приём этого типа уже записан сегодня — на завтра
      if (!toTomorrow && slot.type && loggedTypes.has(slot.type)) {
        toTomorrow = true;
      }
      // вечерний итог: если за день уже 2+ приёма — не дёргаем сегодня
      if (!toTomorrow && slot.type === null && mealCount >= 2) {
        toTomorrow = true;
      }

      if (toTomorrow) at.setDate(at.getDate() + 1);

      await Notifications.scheduleNotificationAsync({
        content: { title: 'Lumo', body: t(pick(slot.keys)) },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
        },
      });
    }
  } catch (e) {
    console.warn('rescheduleReminders', e?.message);
  }
}

// Сериализуем вызовы: cancelAll + 4×schedule не должны переплетаться
// (иначе получаются дубли уведомлений).
let _chain = Promise.resolve();

/**
 * Пересобрать расписание напоминаний под текущее состояние дня.
 * @param {{ enabled:boolean, loggedTypes?:Set<string>, mealCount?:number }} opts
 */
export function rescheduleReminders(opts = {}) {
  _chain = _chain.then(() => doReschedule(opts)).catch(() => {});
  return _chain;
}

/**
 * Запрашивает разрешение на уведомления. Возвращает true при успехе.
 * Само расписание пересобирает ReminderScheduler (см. App.js) по настройкам.
 */
export async function requestNotifPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

// старое имя — для совместимости
export const enableReminders = requestNotifPermission;

export async function disableReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('disableReminders', e?.message);
  }
}
