// src/lib/workouts.js — помощники трекера тренировок (db/19_workouts.sql).

import { dayKey } from './days';

export const WORKOUT_TYPES = [
  { id: 'strength', icon: 'barbell' },
  { id: 'cardio', icon: 'pulse' },
  { id: 'run', icon: 'walk' },
  { id: 'walk', icon: 'footsteps' },
  { id: 'bike', icon: 'bicycle' },
  { id: 'swim', icon: 'water' },
  { id: 'yoga', icon: 'body' },
  { id: 'other', icon: 'fitness' },
];

export const WORKOUT_TYPE_IDS = WORKOUT_TYPES.map((x) => x.id);

const CARDIO = new Set(['cardio', 'run', 'walk', 'bike', 'swim']);
export const isCardioType = (id) => CARDIO.has(id);
export const isStrengthType = (id) => id === 'strength';

export function typeIcon(id) {
  return (WORKOUT_TYPES.find((x) => x.id === id) || WORKOUT_TYPES[7]).icon;
}
export function typeLabel(id, t) {
  return t(`workout.type_${id}`);
}

// Ощущение: 1 = тяжело, 2 = норм, 3 = отлично.
export const FEELINGS = [
  { v: 1, emoji: '😮‍💨' },
  { v: 2, emoji: '🙂' },
  { v: 3, emoji: '🔥' },
];
export function feelingEmoji(v) {
  return (FEELINGS.find((f) => f.v === v) || {}).emoji || '';
}

// Тоннаж силовой: сумма reps × weight по всем подходам.
export function totalVolume(sets) {
  return (sets || []).reduce(
    (a, s) => a + (Number(s.reps) || 0) * (Number(s.weight_kg) || 0),
    0
  );
}

// Группирует список тренировок по дню (сохраняя порядок — новые сверху).
export function groupByDay(workouts) {
  const map = new Map();
  for (const w of workouts || []) {
    const k = w.workout_on;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(w);
  }
  return [...map.entries()].map(([key, items]) => ({ key, items }));
}

// Плоский массив подходов (из редактора: [{name, sets:[{reps,weight}]}]) → строки для БД.
export function flattenExercises(exercises) {
  const rows = [];
  let sort = 0;
  for (const ex of exercises || []) {
    const name = String(ex.name || '').trim();
    if (!name) continue;
    ex.sets.forEach((s, i) => {
      const reps = s.reps === '' || s.reps == null ? null : Number(s.reps);
      const weight =
        s.weight === '' || s.weight == null ? null : Number(s.weight);
      if (reps == null && weight == null) return;
      rows.push({
        exercise: name,
        set_index: i + 1,
        reps: Number.isFinite(reps) ? reps : null,
        weight_kg: Number.isFinite(weight) ? weight : null,
        sort: sort++,
      });
    });
  }
  return rows;
}

// Строки подходов из БД → структура для редактора.
export function groupSets(rows) {
  const order = [];
  const byName = new Map();
  for (const r of [...(rows || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))) {
    if (!byName.has(r.exercise)) {
      byName.set(r.exercise, []);
      order.push(r.exercise);
    }
    byName.get(r.exercise).push({
      reps: r.reps == null ? '' : String(r.reps),
      weight: r.weight_kg == null ? '' : String(r.weight_kg),
    });
  }
  return order.map((name) => ({ name, sets: byName.get(name) }));
}

export const todayKey = () => dayKey(new Date());
