// src/lib/supplements.js — помощники для трекера добавок (db/18_supplements.sql).

import { dayKey } from './days';

// Пресеты времени для быстрого выбора в форме.
export const PRESET_TIMES = ['08:00', '13:00', '19:00', '22:00'];

// ISO-номер дня недели: 1 = Пн … 7 = Вс.
export function isoWeekday(date = new Date()) {
  const g = date.getDay();
  return g === 0 ? 7 : g;
}

// Локализованное короткое имя дня недели по ISO-номеру (1..7).
export function weekdayShort(iso, locale = 'en') {
  // 2024-01-01 — понедельник, значит new Date(2024,0,iso) даёт нужный день.
  try {
    return new Date(2024, 0, iso).toLocaleDateString(locale, { weekday: 'short' });
  } catch (e) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][iso - 1] || '';
  }
}

// Приводит ввод времени к «HH:MM» либо возвращает null.
export function normalizeTime(input) {
  const m = String(input || '').trim().match(/^(\d{1,2})[:.\s]?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function sortTimes(times) {
  return [...new Set((times || []).filter(Boolean))].sort();
}

// Принимается ли добавка сегодня (по расписанию дней).
export function isDueOn(supp, date = new Date()) {
  if (!supp || supp.active === false) return false;
  const days = supp.days || [];
  if (days.length === 0) return true;
  return days.includes(isoWeekday(date));
}

// Слоты добавки на день: массив времён, либо [''] если время не задано.
export function slotsOf(supp) {
  const ts = sortTimes(supp?.times);
  return ts.length ? ts : [''];
}

// Есть ли отметка «принял» для (добавка, слот) в этот день.
export function isSlotTaken(log, supplementId, slot) {
  return (log || []).some(
    (r) => r.supplement_id === supplementId && (r.slot || '') === (slot || '')
  );
}

// Сводка «сегодня принято N из M» по всем добавкам, что положены на этот день.
export function progressForDay(supps, log, date = new Date()) {
  let taken = 0;
  let total = 0;
  for (const s of supps || []) {
    if (!isDueOn(s, date)) continue;
    for (const slot of slotsOf(s)) {
      total += 1;
      if (isSlotTaken(log, s.id, slot)) taken += 1;
    }
  }
  return { taken, total };
}

// Текстовая сводка расписания: «08:00, 19:00 · ежедневно» / «09:00 · Пн, Ср, Пт».
export function scheduleSummary(supp, t, locale = 'en') {
  const ts = sortTimes(supp?.times);
  const timePart = ts.length ? ts.join(', ') : t('supp.anytime');
  const days = supp?.days || [];
  const dayPart =
    days.length === 0 || days.length === 7
      ? t('supp.everyday')
      : [...days].sort().map((d) => weekdayShort(d, locale)).join(', ');
  return `${timePart} · ${dayPart}`;
}

export const todayKey = () => dayKey(new Date());
