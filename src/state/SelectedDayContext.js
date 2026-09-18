// src/state/SelectedDayContext.js
// Общий выбранный день для всего приложения (Главная + Дневник).

import { createContext, useContext, useMemo, useState } from 'react';

import { dayKey } from '../lib/days';

const Ctx = createContext(null);

export function SelectedDayProvider({ children }) {
  const [selectedKey, setSelectedKey] = useState(dayKey(new Date()));

  const value = useMemo(() => {
    const todayKey = dayKey(new Date());
    return {
      selectedKey,
      setSelectedKey,
      todayKey,
      isToday: selectedKey === todayKey,
      resetToToday: () => setSelectedKey(dayKey(new Date())),
    };
  }, [selectedKey]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelectedDay() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSelectedDay должен быть внутри SelectedDayProvider');
  return v;
}
