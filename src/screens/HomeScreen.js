import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Text } from '../ui/Text';

import {
  fetchRecentMeals,
  fetchWorkouts,
  getProfile,
  getFeedCache,
  setFeedCache,
  getWater,
  setWater,
  fetchFavorites,
  addMealFromPayload,
} from '../services/supabaseClient';
import { getFeedRecipes } from '../services/aiService';
import { rescheduleReminders } from '../services/notifications';
import { toUserMessage } from '../services/errors';
import { sumItems } from '../lib/nutrition';
import { guessMealType } from '../lib/meals';
import { productKey, getPortion } from '../lib/portionMemory';
import { findRecentDup, confirmDup } from '../lib/dupGuard';
import {
  dayKey,
  lastNDays,
  totalsByDay,
  goalStatus,
  GOAL_COLORS,
  currentStreak,
  weekAverage,
} from '../lib/days';
import { i18n } from '../i18n';
import { useT } from '../i18n/LocaleContext';
import { useTheme, useSettings } from '../settings/SettingsContext';
import { useSelectedDay } from '../state/SelectedDayContext';
import { MACRO_COLORS } from '../theme/palettes';
import Screen from '../ui/Screen';
import Button from '../ui/Button';
import CalorieRing from '../components/CalorieRing';
import MacroRing from '../components/MacroRing';
import StreakFlame from '../components/StreakFlame';
import LogHeatmap from '../components/LogHeatmap';
import AnimatedNumber from '../components/AnimatedNumber';
import EmptyState from '../components/EmptyState';
import Flash from '../components/Flash';
import { HomeSkeleton } from '../components/Skeleton';
import { hSelect, hSuccess } from '../lib/haptics';
import { groupNum } from '../lib/format';

const addDayKey = (key, delta) => {
  const d = new Date(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
};

const FEED_TTL_MS = 24 * 60 * 60 * 1000;

// декоративная палитра плиток ленты рецептов (не бренд-цвета)
const FEED_COLORS = [
  '#FF6B35',
  '#10b981',
  '#7B61FF',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#e11d48',
];
const FEED_EMOJI = ['🍲', '🥗', '🍳', '🍝', '🍚', '🥘', '🍛', '🥙'];

function hashIdx(str, mod) {
  let h = 0;
  for (let i = 0; i < String(str).length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % mod;
}

const round = (n) => Math.round(n);

function GrowBar({ style, height, color }) {
  const h = useRef(new Animated.Value(4)).current;
  useEffect(() => {
    const a = Animated.timing(h, {
      toValue: Math.max(4, height),
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [height, h]);
  return <Animated.View style={[style, { height: h, backgroundColor: color }]} />;
}

export default function HomeScreen({ navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { selectedKey, setSelectedKey, todayKey, isToday, resetToToday } =
    useSelectedDay();
  const { waterGoal, fastGoal, notifications, waterReminder, workoutBalance } =
    useSettings();
  const [nowTs, setNowTs] = useState(Date.now());
  const [meals, setMeals] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feed, setFeed] = useState(null);
  const [feedBusy, setFeedBusy] = useState(false);
  const [water, setWaterState] = useState(0);
  const [showCal, setShowCal] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favGrams, setFavGrams] = useState({});
  const [favAddingId, setFavAddingId] = useState(null);
  const [repeatBusyId, setRepeatBusyId] = useState(null);
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(null);
  const goalHitDayRef = useRef(null);
  const streakMilestoneRef = useRef(0);

  const refreshFeed = useCallback(async (goal) => {
    const g = goal || 'maintain';
    setFeedBusy(true);
    try {
      const list = await getFeedRecipes(g);
      setFeed(list);
      setFeedCache(g, i18n.locale, list).catch(() => {});
    } catch (e) {
      console.warn('feed refresh', e?.message);
    } finally {
      setFeedBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    const goal = profile.goal || 'maintain';
    let cancelled = false;
    getFeedCache()
      .then((row) => {
        if (cancelled) return;
        if (row?.recipes?.length) setFeed(row.recipes);
        const fresh =
          row &&
          row.goal === goal &&
          row.lang === i18n.locale &&
          row.recipes?.length &&
          Date.now() - new Date(row.updated_at).getTime() < FEED_TTL_MS;
        if (!fresh) refreshFeed(goal);
      })
      .catch(() => refreshFeed(goal));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.goal, refreshFeed]);

  const load = useCallback(async () => {
    const [m, p, f, w] = await Promise.allSettled([
      fetchRecentMeals(100),
      getProfile(),
      fetchFavorites(),
      fetchWorkouts(45),
    ]);
    if (m.status === 'fulfilled') setMeals(m.value ?? []);
    else console.warn('home: meals', m.reason?.message);
    if (w.status === 'fulfilled') setWorkouts(w.value ?? []);
    if (p.status === 'fulfilled') setProfile(p.value);
    else console.warn('home: profile', p.reason?.message);
    if (f.status === 'fulfilled') {
      const favs = (f.value ?? []).filter(
        (x) =>
          x.kind !== 'recipe' &&
          x.payload &&
          (x.payload.per100 ||
            (Array.isArray(x.payload.items) && x.payload.items.length))
      );
      setFavorites(favs);
      const gmap = {};
      await Promise.all(
        favs.map(async (fav) => {
          const g = await getPortion(productKey(fav.payload)).catch(() => null);
          if (g) gmap[fav.id] = g;
        })
      );
      setFavGrams(gmap);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const addFavoriteToToday = useCallback(
    async (fav) => {
      if (favAddingId) return;
      // по названию (ккал у избранного — на 100 г, не на порцию)
      if (findRecentDup(meals, fav.title, null) && !(await confirmDup())) {
        return;
      }
      setFavAddingId(fav.id);
      try {
        const grams = await getPortion(productKey(fav.payload)).catch(
          () => null
        );
        await addMealFromPayload(fav.payload, {
          dateKey: todayKey,
          isToday: true,
          mealType: guessMealType(new Date()),
          grams: grams || undefined,
        });
        hSuccess();
        if (!isToday) resetToToday();
        await load();
      } catch (e) {
        Alert.alert(t('home.favRow'), toUserMessage(e));
      } finally {
        setFavAddingId(null);
      }
    },
    [favAddingId, meals, todayKey, isToday, resetToToday, load, t]
  );

  const repeatToToday = useCallback(
    async (m) => {
      if (repeatBusyId) return;
      if (
        findRecentDup(meals, m.food_name, m.calories) &&
        !(await confirmDup())
      ) {
        return;
      }
      setRepeatBusyId(m.id);
      try {
        await addMealFromPayload(m, {
          dateKey: todayKey,
          isToday: true,
          mealType: m.meal_type || guessMealType(new Date()),
        });
        hSuccess();
        if (!isToday) resetToToday();
        await load();
      } catch (e) {
        Alert.alert(t('home.recent'), toUserMessage(e));
      } finally {
        setRepeatBusyId(null);
      }
    },
    [repeatBusyId, meals, todayKey, isToday, resetToToday, load, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // держим напоминания в курсе того, что уже записано сегодня
  useEffect(() => {
    if (loading) return;
    const tk = dayKey(new Date());
    const today = meals.filter((m) => dayKey(m.created_at) === tk);
    rescheduleReminders({
      enabled: notifications,
      loggedTypes: new Set(today.map((m) => m.meal_type).filter(Boolean)),
      mealCount: today.length,
      water: {
        enabled: waterReminder,
        goal: waterGoal,
        today: isToday ? water : 0,
      },
    });
  }, [meals, notifications, loading, waterReminder, waterGoal, water, isToday]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getWater(selectedKey)
        .then((g) => alive && setWaterState(g))
        .catch((e) => console.warn('water get', e?.message));
      return () => {
        alive = false;
      };
    }, [selectedKey])
  );

  const changeWater = useCallback(
    (next) => {
      const g = Math.max(0, Math.min(20, next));
      setWaterState(g);
      hSelect();
      setWater(selectedKey, g).catch((e) => console.warn('water set', e?.message));
    },
    [selectedKey]
  );

  useEffect(() => {
    if (!fastGoal) return;
    const id = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(id);
  }, [fastGoal]);

  const lastMealTs = useMemo(() => {
    let mx = 0;
    for (const m of meals) {
      const ts = new Date(m.created_at).getTime();
      if (ts > mx) mx = ts;
    }
    return mx || null;
  }, [meals]);

  const fastHours =
    fastGoal && lastMealTs ? (nowTs - lastMealTs) / 3600000 : null;

  const byDay = useMemo(() => totalsByDay(meals), [meals]);
  const week = useMemo(() => lastNDays(7), []);
  const streak = useMemo(() => currentStreak(byDay), [byDay]);
  const wavg = useMemo(() => weekAverage(byDay, 7), [byDay]);
  const tot = byDay[selectedKey] || {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  };
  const kcal = tot.calories;
  const protein = round(tot.protein_g);
  const carbs = round(tot.carbs_g);
  const fat = round(tot.fat_g);

  // сожжённые калории на тренировках за день (учитываются в балансе, если включено)
  const burnByDay = useMemo(() => {
    const map = {};
    for (const w of workouts) {
      if (!w.calories_est) continue;
      map[w.workout_on] = (map[w.workout_on] || 0) + w.calories_est;
    }
    return map;
  }, [workouts]);
  const burned = workoutBalance ? burnByDay[selectedKey] || 0 : 0;
  const netKcal = Math.max(0, kcal - burned);

  const selMeals = meals
    .filter((m) => dayKey(m.created_at) === selectedKey)
    .slice(0, 3);

  const goalKcal = profile?.daily_kcal_goal ?? null;
  const weekMax = Math.max(
    goalKcal || 0,
    ...week.map((d) => byDay[dayKey(d)]?.calories || 0),
    1
  );
  const pct = goalKcal
    ? Math.min(100, Math.round((netKcal / goalKcal) * 100))
    : 0;
  const over = goalKcal ? netKcal - goalKcal : 0;

  const showFlash = useCallback((msg) => {
    setFlash(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  useEffect(() => {
    SecureStore.getItemAsync('goal_hit_day')
      .then((v) => {
        goalHitDayRef.current = v;
      })
      .catch(() => {});
    SecureStore.getItemAsync('streak_milestone')
      .then((v) => {
        streakMilestoneRef.current = Number(v) || 0;
      })
      .catch(() => {});
  }, []);

  // поздравление с вехой стрика (3 / 7 / 14 / 30 / …)
  useEffect(() => {
    if (loading) return;
    const MS = [3, 7, 14, 30, 50, 100, 150, 200, 365];
    const cur = MS.filter((x) => x <= streak).pop() || 0;
    if (cur < streakMilestoneRef.current) {
      // стрик прервался — откат уровня, без поздравления
      streakMilestoneRef.current = cur;
      SecureStore.setItemAsync('streak_milestone', String(cur)).catch(() => {});
      return;
    }
    if (cur === 0 || cur <= streakMilestoneRef.current) return;
    streakMilestoneRef.current = cur;
    SecureStore.setItemAsync('streak_milestone', String(cur)).catch(() => {});
    hSuccess();
    showFlash(`🔥 ${cur} ${t('home.streakLabel')}!`);
  }, [loading, streak, showFlash, t]);
  // разовое поздравление, когда набрал дневную норму (95–125%)
  useEffect(() => {
    if (loading || !isToday || !goalKcal || netKcal <= 0) return;
    const p = netKcal / goalKcal;
    if (p < 0.95 || p > 1.25) return;
    if (goalHitDayRef.current === todayKey) return;
    goalHitDayRef.current = todayKey;
    SecureStore.setItemAsync('goal_hit_day', todayKey).catch(() => {});
    hSuccess();
    showFlash('🎯 ' + t('home.goalHit'));
  }, [loading, isToday, goalKcal, netKcal, todayKey, showFlash, t]);

  const yestKey = dayKey(new Date(Date.now() - 86400000));
  const dayLabel = isToday
    ? t('home.today')
    : selectedKey === yestKey
    ? t('hist.yesterday')
    : new Date(selectedKey).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
      });
  const canNext = selectedKey < todayKey;

  if (loading) {
    return (
      <Screen>
        <HomeSkeleton />
      </Screen>
    );
  }

  return (
    <Screen>
    <Flash message={flash} />
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          tintColor={c.textMuted}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <View style={styles.todayCard}>
        <View style={styles.dayNav}>
          <Pressable
            onPress={() => setSelectedKey(addDayKey(selectedKey, -1))}
            hitSlop={12}
          >
            <Text style={styles.dayArrow}>‹</Text>
          </Pressable>
          <Pressable onPress={resetToToday} disabled={isToday}>
            <Text style={styles.todayLabel}>{dayLabel}</Text>
          </Pressable>
          <Pressable
            onPress={() => canNext && setSelectedKey(addDayKey(selectedKey, 1))}
            hitSlop={12}
          >
            <Text style={[styles.dayArrow, !canNext && styles.dayArrowOff]}>
              ›
            </Text>
          </Pressable>
        </View>
        {!isToday && (
          <Pressable onPress={resetToToday} style={styles.toToday}>
            <Text style={styles.toTodayText}>→ {t('home.today')}</Text>
          </Pressable>
        )}
        <CalorieRing value={netKcal} goal={goalKcal || 0}>
          <AnimatedNumber
            value={netKcal}
            style={styles.todayKcal}
            format={(n) => groupNum(n)}
          />
          {goalKcal ? (
            <Text style={styles.ringGoal}>/ {groupNum(goalKcal)}</Text>
          ) : (
            <Text style={styles.ringGoal}>{t('home.kcalShort')}</Text>
          )}
        </CalorieRing>

        {goalKcal ? (
          <Text style={styles.todayUnit}>
            {over > 0
              ? t('home.over', { n: over })
              : t('home.remaining', { n: -over })}
          </Text>
        ) : null}

        {burned > 0 ? (
          <Text style={styles.balanceLine}>
            {t('home.balanceLine', { eaten: groupNum(kcal), burned: groupNum(burned) })}
          </Text>
        ) : null}

        <View style={styles.macros}>
          <MacroRing
            label={t('home.protein')}
            value={protein}
            goal={profile?.protein_goal || 0}
            color={MACRO_COLORS.protein}
          />
          <MacroRing
            label={t('home.fat')}
            value={fat}
            goal={profile?.fat_goal || 0}
            color={MACRO_COLORS.fat}
          />
          <MacroRing
            label={t('home.carbs')}
            value={carbs}
            goal={profile?.carbs_goal || 0}
            color={MACRO_COLORS.carbs}
          />
        </View>
      </View>

      <View style={styles.weekCard}>
        <View style={styles.weekHead}>
          <Pressable
            style={styles.weekLabelBtn}
            hitSlop={8}
            onPress={() => {
              hSelect();
              setShowCal((s) => !s);
            }}
          >
            <Text style={styles.weekLabel}>{t('home.last7')}</Text>
            <Text style={styles.weekChevron}>{showCal ? '⌄' : '›'}</Text>
          </Pressable>
          {streak > 0 && (
            <StreakFlame n={streak} label={t('home.streakLabel')} />
          )}
        </View>
        <View style={styles.weekBars}>
          {week.map((d, idx) => {
            const k = dayKey(d);
            const v = byDay[k]?.calories || 0;
            const color = GOAL_COLORS[goalStatus(v, goalKcal)] || c.divider;
            const h = Math.round((v / weekMax) * 44);
            const active = k === selectedKey;
            const isLast = idx === week.length - 1;
            return (
              <Pressable
                key={k}
                style={styles.weekCol}
                onPress={() => setSelectedKey(k)}
              >
                {isLast && v > 0 && (
                  <Text style={styles.weekTodayVal}>{groupNum(v)}</Text>
                )}
                <View style={styles.weekBarBox}>
                  <GrowBar style={styles.weekBar} height={h} color={color} />
                </View>
                <Text
                  style={[styles.weekDow, active && styles.weekDowActive]}
                >
                  {d.toLocaleDateString(i18n.locale, { weekday: 'narrow' })}
                </Text>
                <View
                  style={[
                    styles.weekMark,
                    active && { backgroundColor: c.primary },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        {goalKcal ? (
          <View style={styles.legend}>
            {[
              [GOAL_COLORS.red, t('home.legUnder')],
              [GOAL_COLORS.yellow, t('home.legNear')],
              [GOAL_COLORS.green, t('home.legMet')],
            ].map(([col, label]) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: col }]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {showCal && (
          <LogHeatmap
            byDay={byDay}
            goalKcal={goalKcal}
            selectedKey={selectedKey}
            onSelectDay={setSelectedKey}
            t={t}
          />
        )}

        <Pressable onPress={() => navigation.navigate('WeeklyReport')}>
          <Text style={styles.weekAvg}>
            {wavg.days
              ? `${t('home.weekAvg')}: ${wavg.calories} ${t('home.kcalShort')} · ` +
                t('res.macros', {
                  p: wavg.protein_g,
                  f: wavg.fat_g,
                  c: wavg.carbs_g,
                })
              : t('home.weekAvgEmpty')}
            {'  '}
            <Text style={styles.weekAvgLink}>{t('report.open')} ›</Text>
          </Text>
        </Pressable>
      </View>

      {isToday && fastHours != null && (
        <View style={styles.waterCard}>
          <View style={styles.waterHead}>
            <Text style={styles.waterTitle}>🕒 {t('fast.title')}</Text>
            <Text style={styles.waterCount}>
              {fastHours >= fastGoal
                ? t('fast.reached')
                : `${Math.floor(fastHours)}${t('fast.hShort')} ${Math.floor(
                    (fastHours % 1) * 60
                  )}${t('fast.mShort')} / ${fastGoal}${t('fast.hShort')}`}
            </Text>
          </View>
          <View style={styles.fastTrack}>
            <View
              style={[
                styles.fastFill,
                {
                  width: `${Math.min(100, Math.round((fastHours / fastGoal) * 100))}%`,
                  backgroundColor:
                    fastHours >= fastGoal ? '#22c55e' : c.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.fastSince}>{t('fast.since')}</Text>
        </View>
      )}

      <View style={styles.waterCard}>
        <View style={styles.waterHead}>
          <Text style={styles.waterTitle}>💧 {t('water.title')}</Text>
          <Text style={styles.waterCount}>
            {t('water.count', { n: water, goal: waterGoal })}
          </Text>
        </View>
        <View style={styles.waterRow}>
          {Array.from({ length: waterGoal }).map((_, i) => (
            <Pressable
              key={i}
              hitSlop={4}
              onPress={() => changeWater(water === i + 1 ? i : i + 1)}
            >
              <View
                style={[styles.glass, i < water && styles.glassFull]}
              />
            </Pressable>
          ))}
          <Pressable
            hitSlop={8}
            style={styles.waterBtn}
            onPress={() => changeWater(water - 1)}
          >
            <Text style={styles.waterBtnText}>−</Text>
          </Pressable>
          <Pressable
            hitSlop={8}
            style={styles.waterBtn}
            onPress={() => changeWater(water + 1)}
          >
            <Text style={styles.waterBtnText}>＋</Text>
          </Pressable>
        </View>
        {water > waterGoal && (
          <Text style={styles.waterExtra}>+{water - waterGoal}</Text>
        )}
      </View>

      <Button
        label={t('home.ctaPhoto')}
        icon="camera"
        size="lg"
        onPress={() => navigation.navigate('CameraTab')}
        style={styles.ctaTop}
      />

      <View style={styles.ctaRow}>
        <Button
          label={t('recipe.cta')}
          variant="secondary"
          icon="restaurant-outline"
          onPress={() => navigation.navigate('Recipe')}
          style={styles.ctaHalf}
        />
        <Button
          label={t('quick.cta')}
          variant="secondary"
          icon="add"
          onPress={() => navigation.navigate('QuickAdd')}
          style={styles.ctaHalf}
        />
      </View>

      {profile && !profile.is_pro && (
        <Pressable
          style={styles.quota}
          onPress={() => navigation.navigate('Paywall')}
        >
          <Text style={styles.quotaText}>
            {profile.remaining > 0
              ? t('home.freeLeft', { n: profile.remaining, limit: profile.limit })
              : t('home.freeOut')}
          </Text>
        </Pressable>
      )}

      {isToday && favorites.length > 0 && (
        <View style={styles.favSection}>
          <Text style={styles.favTitle}>★ {t('home.favRow')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favScroll}
          >
            {favorites.map((fav) => {
              const p = fav.payload || {};
              const g = favGrams[fav.id] || p.servingSizeG || 100;
              const kcal = p.per100
                ? Math.round((p.per100.calories || 0) * (g / 100))
                : fav.calories;
              return (
                <Pressable
                  key={fav.id}
                  style={({ pressed }) => [
                    styles.favChip,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => addFavoriteToToday(fav)}
                  disabled={!!favAddingId}
                >
                  {favAddingId === fav.id ? (
                    <ActivityIndicator size="small" color={c.primary} />
                  ) : (
                    <>
                      <Text style={styles.favChipName} numberOfLines={1}>
                        {fav.title}
                      </Text>
                      {kcal != null && (
                        <Text style={styles.favChipKcal}>
                          {groupNum(kcal)} {t('home.kcalShort')}
                        </Text>
                      )}
                    </>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isToday ? t('home.recent') : dayLabel}
        </Text>
        {selMeals.length === 0 ? (
          <EmptyState art="plate" title={t('home.empty')} style={styles.emptyPad} />
        ) : (
          selMeals.map((x) => (
            <Pressable
              key={x.id}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => navigation.navigate('MealDetail', { meal: x })}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {x.food_name}
                </Text>
                <Text style={styles.rowMacros}>
                  {t('res.macros', {
                    p: Math.round(Number(x.protein_g) || 0),
                    f: Math.round(Number(x.fat_g) || 0),
                    c: Math.round(Number(x.carbs_g) || 0),
                  })}
                </Text>
              </View>
              <Text style={styles.rowKcal}>
                {x.calories} {t('home.kcalShort')}
              </Text>
              <Pressable
                onPress={() => repeatToToday(x)}
                hitSlop={10}
                disabled={!!repeatBusyId}
                style={styles.rowRepeat}
              >
                {repeatBusyId === x.id ? (
                  <ActivityIndicator size="small" color={c.primary} />
                ) : (
                  <Text style={styles.rowRepeatText}>↻</Text>
                )}
              </Pressable>
            </Pressable>
          ))
        )}
        <Pressable onPress={() => navigation.navigate('HistoryTab')}>
          <Text style={styles.link}>{t('home.allDiary')}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.feedHead}>
          <Text style={styles.sectionTitle}>{t('home.feedTitle')}</Text>
          <Pressable
            onPress={() => refreshFeed(profile?.goal)}
            disabled={feedBusy}
            hitSlop={10}
          >
            <Text style={styles.refresh}>{feedBusy ? '…' : '↻'}</Text>
          </Pressable>
        </View>

        {feedBusy && !feed ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 8 }} />
        ) : !feed || feed.length === 0 ? (
          <Text style={styles.empty}>{t('home.feedEmpty')}</Text>
        ) : (
          feed.map((r, i) => {
            const totals = sumItems(r.items);
            return (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.feedCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => navigation.navigate('RecipeDetail', { recipe: r })}
              >
                <View
                  style={[
                    styles.feedThumb,
                    { backgroundColor: FEED_COLORS[hashIdx(r.title, FEED_COLORS.length)] },
                  ]}
                >
                  <Text style={styles.feedEmoji}>
                    {FEED_EMOJI[hashIdx(r.title, FEED_EMOJI.length)]}
                  </Text>
                </View>
                <View style={styles.feedText}>
                  <Text style={styles.feedName} numberOfLines={2}>
                    {r.title}
                  </Text>
                  <Text style={styles.feedMeta}>
                    {totals.calories} {t('home.kcalShort')} ·{' '}
                    {t('recipe.perServing')}
                  </Text>
                  <Text style={styles.feedMeta}>
                    {t('res.macros', {
                      p: totals.protein_g,
                      f: totals.fat_g,
                      c: totals.carbs_g,
                    })}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    screen: { backgroundColor: 'transparent' },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg,
    },
    container: { padding: 16 },
    favSection: { marginTop: 20 },
    favTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      marginBottom: 8,
    },
    favScroll: { gap: 8, paddingRight: 4, paddingBottom: 4 },
    favChip: {
      maxWidth: 170,
      minWidth: 96,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...c.shadow,
    },
    favChipName: { fontSize: 13, fontWeight: '700', color: c.text },
    favChipKcal: { fontSize: 11, fontWeight: '600', color: c.primary, marginTop: 2 },
    todayCard: {
      backgroundColor: c.accentSoft,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
    },
    dayNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
    },
    dayArrow: { fontSize: 22, color: c.primary, fontWeight: '700', width: 20, textAlign: 'center' },
    dayArrowOff: { color: c.textFaint, opacity: 0.4 },
    todayLabel: {
      fontSize: 14,
      color: c.dark ? c.text : c.textMuted,
      textTransform: 'capitalize',
      minWidth: 90,
      textAlign: 'center',
    },
    toToday: { marginTop: 2 },
    toTodayText: { fontSize: 11, color: c.primary, fontWeight: '600' },
    weekDowActive: { color: c.primary, fontWeight: '800' },
    weekMark: {
      width: 5,
      height: 5,
      borderRadius: 3,
      marginTop: 3,
      backgroundColor: 'transparent',
    },
    todayKcal: { fontSize: 40, fontWeight: '800', color: c.primary },
    ringGoal: { fontSize: 13, fontWeight: '600', color: c.textMuted, marginTop: 2 },
    todayUnit: {
      fontSize: 13,
      color: c.dark ? c.text : c.textMuted,
      marginTop: 10,
      marginBottom: 4,
    },
    balanceLine: {
      fontSize: 11.5,
      color: c.textFaint,
      marginTop: 2,
      marginBottom: 2,
    },
    barTrack: {
      width: '100%',
      height: 8,
      borderRadius: 4,
      backgroundColor: c.barTrack,
      overflow: 'hidden',
      marginBottom: 14,
    },
    barFill: { height: 8, borderRadius: 4, backgroundColor: c.primary },
    barFillOver: { backgroundColor: c.danger },
    macros: {
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-around',
      marginTop: 14,
    },
    weekCard: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 14,
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    weekHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    weekLabelBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    weekLabel: { fontSize: 12, fontWeight: '700', color: c.textMuted },
    weekChevron: { fontSize: 13, fontWeight: '800', color: c.primary },
    streak: { fontSize: 12, fontWeight: '800', color: c.primary },
    weekAvg: {
      fontSize: 11,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 10,
    },
    weekAvgLink: { color: c.primary, fontWeight: '700' },
    weekBars: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    weekCol: { alignItems: 'center', flex: 1 },
    weekBarBox: { height: 46, justifyContent: 'flex-end' },
    weekBar: {
      width: 11,
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
    },
    weekTodayVal: {
      position: 'absolute',
      top: -12,
      fontSize: 9,
      fontWeight: '700',
      color: c.textMuted,
    },
    weekDow: { fontSize: 10, color: c.textFaint, marginTop: 4 },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 14,
      marginTop: 10,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 7, height: 7, borderRadius: 4 },
    legendText: { fontSize: 10, color: c.textFaint },
    waterCard: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 14,
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    waterHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    waterTitle: { fontSize: 13, fontWeight: '700', color: c.text },
    waterCount: { fontSize: 12, fontWeight: '700', color: c.primary },
    waterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    glass: {
      width: 20,
      height: 26,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: c.primary,
      backgroundColor: 'transparent',
    },
    glassFull: { backgroundColor: c.primary },
    waterBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accentSoft,
    },
    waterBtnText: { fontSize: 16, fontWeight: '800', color: c.primary },
    waterExtra: { fontSize: 11, color: c.textMuted, marginTop: 6 },
    fastTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.barTrack,
      overflow: 'hidden',
    },
    fastFill: { height: 8, borderRadius: 4 },
    fastSince: { fontSize: 10, color: c.textFaint, marginTop: 6 },
    ctaTop: { marginTop: 16 },
    ctaRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    ctaHalf: { flex: 1 },
    ctaSecondary: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    ctaSecondaryText: {
      color: c.primary,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
    quota: {
      marginTop: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: c.card,
      alignItems: 'center',
    },
    quotaText: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
    section: { marginTop: 24 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 8,
      color: c.text,
    },
    empty: { color: c.textFaint, paddingVertical: 8 },
    emptyPad: { paddingVertical: 24 },
    feedHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    refresh: { fontSize: 20, color: c.primary, fontWeight: '700' },
    feedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 10,
      marginTop: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    feedThumb: {
      width: 52,
      height: 52,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    feedEmoji: { fontSize: 26 },
    feedText: { flex: 1 },
    feedName: { fontSize: 15, fontWeight: '600', color: c.text },
    feedMeta: { fontSize: 12, color: c.textMuted, marginTop: 3 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    rowName: { fontSize: 15, color: c.text },
    rowMacros: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    rowKcal: { fontSize: 15, fontWeight: '700', color: c.primary },
    rowRepeat: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginLeft: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accentSoft,
    },
    rowRepeatText: { color: c.primary, fontSize: 17, fontWeight: '800' },
    pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
    link: { color: c.primary, fontWeight: '600', marginTop: 12 },
  });
