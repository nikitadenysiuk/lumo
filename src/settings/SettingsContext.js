// src/settings/SettingsContext.js
//
// Хранит настройки приложения (тема, единицы измерения, оповещения)
// и раздаёт их через useSettings(). useTheme() — сразу палитра цветов.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Localization from 'expo-localization';

import {
  palettes,
  THEMES,
  THEME_OPTIONS,
  ACCENTS,
  ACCENT_IDS,
  DEFAULT_ACCENT,
  withAlpha,
} from '../theme/palettes';

const KEY_THEME = 'app_theme';
const KEY_UNITS = 'app_units';
const KEY_NOTIF = 'app_notifications';
const KEY_WATER = 'app_water_goal';
const KEY_FAST = 'app_fast_goal';
const KEY_ACCENT = 'app_accent';
const KEY_WATER_REMINDER = 'app_water_reminder';
const KEY_WORKOUT_BALANCE = 'app_workout_balance';
const KEY_MOTIVATION = 'app_motivation_push';

export const WATER_GOAL_MIN = 4;
export const WATER_GOAL_MAX = 16;
const WATER_GOAL_DEFAULT = 8;

// Часы окна голодания. 0 = функция выключена.
export const FAST_GOAL_MIN = 12;
export const FAST_GOAL_MAX = 20;

const SettingsContext = createContext(null);

function guessUnits() {
  try {
    const region = Localization.getLocales?.()[0]?.regionCode;
    // США / Либерия / Мьянма — имперская система
    if (['US', 'LR', 'MM'].includes(region)) return 'imperial';
  } catch (e) {
    // ignore
  }
  return 'metric';
}

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState('system'); // 'system' | 'light' | 'dark'
  const [sysScheme, setSysScheme] = useState(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );
  const [units, setUnitsState] = useState('metric'); // 'metric' | 'imperial'
  const [notifications, setNotifState] = useState(false);
  const [waterGoal, setWaterGoalState] = useState(WATER_GOAL_DEFAULT);
  const [fastGoal, setFastGoalState] = useState(0);
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);
  const [waterReminder, setWaterReminderState] = useState(false);
  const [workoutBalance, setWorkoutBalanceState] = useState(true);
  const [motivationPush, setMotivationPushState] = useState(true); // по умолчанию вкл.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [th, un, nf, wg, fg, ac, wr, wb, mp] = await Promise.all([
          SecureStore.getItemAsync(KEY_THEME),
          SecureStore.getItemAsync(KEY_UNITS),
          SecureStore.getItemAsync(KEY_NOTIF),
          SecureStore.getItemAsync(KEY_WATER),
          SecureStore.getItemAsync(KEY_FAST),
          SecureStore.getItemAsync(KEY_ACCENT),
          SecureStore.getItemAsync(KEY_WATER_REMINDER),
          SecureStore.getItemAsync(KEY_WORKOUT_BALANCE),
          SecureStore.getItemAsync(KEY_MOTIVATION),
        ]);
        if (THEME_OPTIONS.includes(th)) setThemeState(th);
        if (ACCENT_IDS.includes(ac)) setAccentState(ac);
        if (wr === '1') setWaterReminderState(true);
        if (wb === '0') setWorkoutBalanceState(false);
        if (mp === '0') setMotivationPushState(false);
        if (un === 'imperial' || un === 'metric') setUnitsState(un);
        else setUnitsState(guessUnits());
        if (nf === '1') setNotifState(true);
        const wgN = parseInt(wg, 10);
        if (wgN >= WATER_GOAL_MIN && wgN <= WATER_GOAL_MAX) setWaterGoalState(wgN);
        const fgN = parseInt(fg, 10);
        if (fgN === 0 || (fgN >= FAST_GOAL_MIN && fgN <= FAST_GOAL_MAX)) {
          setFastGoalState(fgN);
        }
      } catch (e) {
        setUnitsState(guessUnits());
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSysScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const setTheme = (t) => {
    if (!THEME_OPTIONS.includes(t)) return;
    setThemeState(t);
    SecureStore.setItemAsync(KEY_THEME, t).catch(() => {});
  };
  const setUnits = (u) => {
    setUnitsState(u);
    SecureStore.setItemAsync(KEY_UNITS, u).catch(() => {});
  };
  const setNotifications = (on) => {
    setNotifState(on);
    SecureStore.setItemAsync(KEY_NOTIF, on ? '1' : '0').catch(() => {});
  };
  const setWaterGoal = (n) => {
    const v = Math.max(WATER_GOAL_MIN, Math.min(WATER_GOAL_MAX, Math.round(n)));
    setWaterGoalState(v);
    SecureStore.setItemAsync(KEY_WATER, String(v)).catch(() => {});
  };
  const setFastGoal = (n) => {
    const r = Math.round(n);
    const v = r === 0 ? 0 : Math.max(FAST_GOAL_MIN, Math.min(FAST_GOAL_MAX, r));
    setFastGoalState(v);
    SecureStore.setItemAsync(KEY_FAST, String(v)).catch(() => {});
  };
  const setAccent = (id) => {
    if (!ACCENT_IDS.includes(id)) return;
    setAccentState(id);
    SecureStore.setItemAsync(KEY_ACCENT, id).catch(() => {});
  };
  const setWaterReminder = (on) => {
    setWaterReminderState(on);
    SecureStore.setItemAsync(KEY_WATER_REMINDER, on ? '1' : '0').catch(() => {});
  };
  const setWorkoutBalance = (on) => {
    setWorkoutBalanceState(on);
    SecureStore.setItemAsync(KEY_WORKOUT_BALANCE, on ? '1' : '0').catch(() => {});
  };
  const setMotivationPush = (on) => {
    setMotivationPushState(on);
    SecureStore.setItemAsync(KEY_MOTIVATION, on ? '1' : '0').catch(() => {});
  };

  const resolvedTheme = theme === 'system' ? sysScheme : theme;

  // палитра с учётом выбранного акцента
  const c = useMemo(() => {
    const base = palettes[resolvedTheme] || palettes.light;
    if (accent === DEFAULT_ACCENT) return base;
    const acc = ACCENTS.find((a) => a.id === accent);
    if (!acc) return base;
    return {
      ...base,
      primary: acc.primary,
      primaryDark: acc.primaryDark,
      primaryLight: acc.primaryLight,
      accentSoft: withAlpha(acc.primary, base.dark ? 0.16 : 0.1),
    };
  }, [resolvedTheme, accent]);

  const value = useMemo(
    () => ({
      ready,
      theme, // выбор пользователя: 'system' | 'light' | 'dark'
      resolvedTheme, // что реально применено: 'light' | 'dark'
      setTheme,
      units,
      setUnits,
      notifications,
      setNotifications,
      waterGoal,
      setWaterGoal,
      fastGoal,
      setFastGoal,
      accent,
      setAccent,
      accents: ACCENTS,
      waterReminder,
      setWaterReminder,
      workoutBalance,
      setWorkoutBalance,
      motivationPush,
      setMotivationPush,
      c,
      themes: THEMES,
      themeOptions: THEME_OPTIONS,
    }),
    [
      ready,
      theme,
      resolvedTheme,
      units,
      notifications,
      waterGoal,
      fastGoal,
      accent,
      waterReminder,
      workoutBalance,
      motivationPush,
      c,
    ]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings должен быть внутри <SettingsProvider>');
  return ctx;
}

// Удобно, когда экрану нужны только цвета.
export function useTheme() {
  return useSettings().c;
}
