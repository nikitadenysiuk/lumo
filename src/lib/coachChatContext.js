// src/lib/coachChatContext.js — сводка профиля для чата с тренером.

import { buildCoachContext } from './coachContext';
import { buildWorkoutContext } from './workoutContext';
import { sortTimes } from './supplements';

export function buildChatContext({
  meals,
  weightLog,
  profile,
  waterToday,
  waterGoal,
  supplements,
  workouts,
  sets,
}) {
  return {
    nutrition: buildCoachContext({
      meals,
      weightLog,
      profile,
      waterToday,
      waterGoal,
    }),
    training: buildWorkoutContext({
      workouts,
      sets,
      goal: profile?.goal,
    }),
    supplements: (supplements || [])
      .filter((s) => s.active !== false)
      .map((s) => ({
        name: s.name,
        dose: s.dose || null,
        times: sortTimes(s.times),
      })),
  };
}
