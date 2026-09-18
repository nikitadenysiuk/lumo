// src/lib/supplementContext.js
//
// Сводка по добавкам (что принимает, расписание, регулярность за 14 дней) —
// её отдаём Gemini для совета (см. aiService.generateSupplementTip).

import { dayKey } from './days';
import { isDueOn, slotsOf, sortTimes } from './supplements';

export function buildSupplementContext({ supplements, log, profile, days = 14 }) {
  const active = (supplements || []).filter((s) => s.active !== false);
  const now = new Date();

  const items = active.map((s) => {
    let due = 0;
    let taken = 0;
    for (let i = 0; i < days; i += 1) {
      const d = new Date(now.getTime() - i * 864e5);
      if (!isDueOn(s, d)) continue;
      const k = dayKey(d);
      for (const slot of slotsOf(s)) {
        due += 1;
        const hit = (log || []).some(
          (r) =>
            r.supplement_id === s.id &&
            (r.slot || '') === (slot || '') &&
            r.taken_on === k
        );
        if (hit) taken += 1;
      }
    }
    return {
      name: s.name,
      dose: s.dose || null,
      times: sortTimes(s.times),
      days_of_week: s.days || [],
      note: s.note || null,
      adherence_pct: due ? Math.round((taken / due) * 100) : null,
      taken_slots_14d: taken,
      due_slots_14d: due,
    };
  });

  return {
    goal: profile?.goal || 'maintain',
    supplement_count: items.length,
    window_days: days,
    supplements: items,
  };
}
