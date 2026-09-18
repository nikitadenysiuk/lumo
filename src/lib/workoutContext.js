// src/lib/workoutContext.js
//
// Компактная сводка по тренировкам за ~3 недели — её отдаём Gemini для
// «совета по тренировкам» (см. aiService.generateWorkoutTip).

import { dayKey } from './days';
import { totalVolume } from './workouts';

export function buildWorkoutContext({ workouts, sets, goal }) {
  const now = new Date();
  const cutoff = dayKey(new Date(now.getTime() - 21 * 864e5));
  const recent = (workouts || []).filter((w) => w.workout_on >= cutoff);

  const byType = {};
  let strengthCount = 0;
  let lastStrengthDate = null;
  let lastAnyDate = null;

  for (const w of recent) {
    byType[w.type] = (byType[w.type] || 0) + 1;
    if (!lastAnyDate || w.workout_on > lastAnyDate) lastAnyDate = w.workout_on;
    if (w.type === 'strength') {
      strengthCount += 1;
      if (!lastStrengthDate || w.workout_on > lastStrengthDate) {
        lastStrengthDate = w.workout_on;
      }
    }
  }

  const daysSince = (d) =>
    d ? Math.round((now - new Date(`${d}T12:00:00`)) / 864e5) : null;

  // объём по упражнениям (последние 3 недели) + топ-5
  const setsByWorkout = {};
  for (const s of sets || []) {
    (setsByWorkout[s.workout_id] ||= []).push(s);
  }
  const recentIds = new Set(recent.map((w) => w.id));
  const exVolume = {};
  for (const s of sets || []) {
    if (!recentIds.has(s.workout_id)) continue;
    const v = (Number(s.reps) || 0) * (Number(s.weight_kg) || 0);
    exVolume[s.exercise] = (exVolume[s.exercise] || 0) + v;
  }
  const topExercises = Object.entries(exVolume)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, vol]) => ({ name, volume_kg: Math.round(vol) }));

  return {
    goal: goal || 'maintain',
    total_workouts_21d: recent.length,
    per_week: Math.round((recent.length / 3) * 10) / 10,
    by_type: byType,
    strength_sessions_21d: strengthCount,
    days_since_last_workout: daysSince(lastAnyDate),
    days_since_last_strength: daysSince(lastStrengthDate),
    recent_workouts: recent.slice(0, 10).map((w) => ({
      date: w.workout_on,
      type: w.type,
      duration_min: w.duration_min,
      distance_km: w.distance_km,
      calories: w.calories_est,
      feeling: w.feeling,
      volume_kg:
        w.type === 'strength'
          ? Math.round(totalVolume(setsByWorkout[w.id]))
          : null,
    })),
    top_exercises: topExercises,
  };
}
