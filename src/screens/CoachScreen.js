// src/screens/CoachScreen.js
//
// Раздел «Тренер». Контейнер: hero + сегментированный контрол + маршрутизация
// по вкладкам. Логика загрузки и генерации ИИ-карточек живёт здесь, вкладки —
// «тупые» презентационные компоненты в src/screens/coach/.

import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { Text } from '../ui/Text';
import CoachChat from '../components/CoachChat';
import TodayTab from './coach/TodayTab';
import SuppsTab from './coach/SuppsTab';
import WorkoutsTab from './coach/WorkoutsTab';
import {
  fetchRecentMeals,
  fetchWeightLog,
  getProfile,
  getWater,
  getCoachCard,
  saveCoachCard,
  fetchSupplements,
  fetchSupplementLog,
  fetchSupplementLogRange,
  getSupplementReco,
  clearSupplementReco,
  logSupplement,
  unlogSupplement,
  fetchWorkouts,
  fetchWorkoutSetsIn,
  fetchExerciseNames,
  fetchActivePlan,
  deleteWorkoutPlan,
} from '../services/supabaseClient';
import {
  generateCoachCard,
  generateWorkoutTip,
  generateSupplementTip,
} from '../services/aiService';
import { buildCoachContext } from '../lib/coachContext';
import { buildWorkoutContext } from '../lib/workoutContext';
import { buildSupplementContext } from '../lib/supplementContext';
import { dayKey } from '../lib/days';
import { isSlotTaken } from '../lib/supplements';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme, useSettings } from '../settings/SettingsContext';
import { hSelect, hSuccess } from '../lib/haptics';

const TABS = ['today', 'workouts', 'supps', 'chat'];
const SEG_ICON = {
  today: 'today-outline',
  workouts: 'barbell-outline',
  supps: 'flask-outline',
  chat: 'chatbubble-ellipses-outline',
};

export default function CoachScreen({ navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const { waterGoal } = useSettings();
  const insets = useSafeAreaInsets();
  const tabBarH = useBottomTabBarHeight();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [tab, setTab] = useState('today');
  const tabRef = useRef('today');
  tabRef.current = tab;

  // Свежесть загруженных данных по вкладкам: не перезагружаем при быстром
  // переключении, но принудительно обновляем при входе в раздел (focus).
  const STALE_MS = 15000;
  const dataAt = useRef({ supps: 0, workouts: 0 });
  const inflight = useRef({ supps: false, workouts: false });

  // --- дневная карточка ---
  const [card, setCard] = useState(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardErr, setCardErr] = useState(null);
  const cardTriedRef = useRef(false);

  const ensureCard = useCallback(
    async (force = false) => {
      const tk = dayKey(new Date());
      setCardErr(null);
      try {
        if (!force) {
          const cached = await getCoachCard(tk, locale).catch(() => null);
          if (cached) {
            setCard(cached);
            return;
          }
        }
        setCardBusy(true);
        const [profile, meals, weightLog, waterToday] = await Promise.all([
          getProfile(),
          fetchRecentMeals(14).catch(() => []),
          fetchWeightLog(35).catch(() => []),
          getWater(tk).catch(() => 0),
        ]);
        const ctx = buildCoachContext({
          meals,
          weightLog,
          profile,
          waterToday,
          waterGoal,
        });
        const payload = await generateCoachCard(ctx);
        setCard(payload);
        saveCoachCard(tk, locale, payload).catch((e) =>
          console.warn('saveCoachCard', e?.message)
        );
      } catch (e) {
        setCardErr(toUserMessage(e));
      } finally {
        setCardBusy(false);
      }
    },
    [locale, waterGoal]
  );

  // --- добавки ---
  const [supps, setSupps] = useState(null);
  const [suppLog, setSuppLog] = useState([]);
  const [suppTip, setSuppTip] = useState(null);
  const [suppTipBusy, setSuppTipBusy] = useState(false);
  const [suppTipErr, setSuppTipErr] = useState(null);
  const [suppReco, setSuppReco] = useState(null);
  const suppTipTriedRef = useRef(false);

  const loadSupps = useCallback(async (force = false) => {
    if (inflight.current.supps) return;
    if (!force && Date.now() - dataAt.current.supps < STALE_MS) return;
    inflight.current.supps = true;
    try {
      const tk = dayKey(new Date());
      const [list, log, reco] = await Promise.all([
        fetchSupplements().catch(() => []),
        fetchSupplementLog(tk).catch(() => []),
        getSupplementReco().catch(() => null),
      ]);
      setSupps(list);
      setSuppLog(log);
      setSuppReco(reco);
      dataAt.current.supps = Date.now();
    } finally {
      inflight.current.supps = false;
    }
  }, []);

  const hideReco = useCallback(() => {
    setSuppReco(null);
    clearSupplementReco().catch((e) => console.warn('clearReco', e?.message));
  }, []);

  const toggleSlot = useCallback(
    async (supp, slot) => {
      const tk = dayKey(new Date());
      const taken = isSlotTaken(suppLog, supp.id, slot);
      hSelect();
      setSuppLog((prev) =>
        taken
          ? prev.filter(
              (r) =>
                !(r.supplement_id === supp.id && (r.slot || '') === (slot || ''))
            )
          : [...prev, { supplement_id: supp.id, slot: slot || '', taken_on: tk }]
      );
      try {
        if (taken) await unlogSupplement(supp.id, slot, tk);
        else {
          await logSupplement(supp.id, slot, tk);
          hSuccess();
        }
      } catch (e) {
        console.warn('toggleSlot', e?.message);
        loadSupps(true);
      }
    },
    [suppLog, loadSupps]
  );

  const ensureSuppTip = useCallback(
    async (force = false, presetList = null) => {
      const tk = dayKey(new Date());
      setSuppTipErr(null);
      try {
        if (!force) {
          const cached = await getCoachCard(tk, locale, 'supp').catch(() => null);
          if (cached) {
            setSuppTip(cached);
            return;
          }
        }
        const list = Array.isArray(presetList)
          ? presetList
          : await fetchSupplements().catch(() => []);
        if (!list.filter((s) => s.active !== false).length) {
          setSuppTip(null);
          return;
        }
        setSuppTipBusy(true);
        const [log, profile] = await Promise.all([
          fetchSupplementLogRange(14).catch(() => []),
          getProfile().catch(() => ({})),
        ]);
        const ctx = buildSupplementContext({ supplements: list, log, profile });
        const payload = await generateSupplementTip(ctx);
        setSuppTip(payload);
        saveCoachCard(tk, locale, payload, 'supp').catch(() => {});
      } catch (e) {
        setSuppTipErr(toUserMessage(e));
      } finally {
        setSuppTipBusy(false);
      }
    },
    [locale]
  );

  // --- тренировки ---
  const [workouts, setWorkouts] = useState(null);
  const [exerciseNames, setExerciseNames] = useState([]);
  const [plan, setPlan] = useState(null);
  const [woTip, setWoTip] = useState(null);
  const [woTipBusy, setWoTipBusy] = useState(false);
  const [woTipErr, setWoTipErr] = useState(null);
  const woTipTriedRef = useRef(false);

  const loadWorkouts = useCallback(async (force = false) => {
    if (inflight.current.workouts) return;
    if (!force && Date.now() - dataAt.current.workouts < STALE_MS) return;
    inflight.current.workouts = true;
    try {
      const [list, names, activePlan] = await Promise.all([
        fetchWorkouts(60).catch(() => []),
        fetchExerciseNames(30).catch(() => []),
        fetchActivePlan().catch(() => null),
      ]);
      setWorkouts(list);
      setExerciseNames(names);
      setPlan(activePlan);
      dataAt.current.workouts = Date.now();
    } finally {
      inflight.current.workouts = false;
    }
  }, []);

  const startPlanDay = useCallback(
    (d) => {
      navigation.navigate('WorkoutEdit', {
        preset: {
          type: 'strength',
          title: d.name,
          exercises: (d.exercises || []).map((e) => ({
            name: e.name,
            sets: Array.from(
              { length: Math.max(1, Math.round(e.sets) || 3) },
              () => ({
                reps: (String(e.reps || '').match(/\d+/) || [''])[0],
                weight: '',
              })
            ),
          })),
        },
      });
    },
    [navigation]
  );

  const deletePlan = useCallback(() => {
    if (!plan) return;
    Alert.alert(t('plan.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('plan.deletePlan'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkoutPlan(plan.id);
            setPlan(null);
          } catch (e) {
            console.warn('deleteWorkoutPlan', e?.message);
          }
        },
      },
    ]);
  }, [plan, t]);

  const ensureWorkoutTip = useCallback(
    async (force = false, presetList = null) => {
      const tk = dayKey(new Date());
      setWoTipErr(null);
      try {
        if (!force) {
          const cached = await getCoachCard(tk, locale, 'workout').catch(
            () => null
          );
          if (cached) {
            setWoTip(cached);
            return;
          }
        }
        const list = (
          Array.isArray(presetList) && presetList.length
            ? presetList
            : await fetchWorkouts(30).catch(() => [])
        ).slice(0, 40);
        if (!list.length) {
          setWoTip(null);
          return;
        }
        setWoTipBusy(true);
        const [sets, profile] = await Promise.all([
          fetchWorkoutSetsIn(list.map((w) => w.id)).catch(() => []),
          getProfile().catch(() => ({})),
        ]);
        const ctx = buildWorkoutContext({
          workouts: list,
          sets,
          goal: profile?.goal,
        });
        const payload = await generateWorkoutTip(ctx);
        setWoTip(payload);
        saveCoachCard(tk, locale, payload, 'workout').catch(() => {});
      } catch (e) {
        setWoTipErr(toUserMessage(e));
      } finally {
        setWoTipBusy(false);
      }
    },
    [locale]
  );

  useFocusEffect(
    useCallback(() => {
      if (!cardTriedRef.current) {
        cardTriedRef.current = true;
        ensureCard(false);
      }
      // при входе в раздел обновляем данные только активной вкладки
      const active = tabRef.current;
      if (active === 'supps') loadSupps(true);
      else if (active === 'workouts') loadWorkouts(true);
    }, [ensureCard, loadSupps, loadWorkouts])
  );

  const switchTab = (next) => {
    if (next === tab) return;
    hSelect();
    setTab(next);
    if (next === 'workouts') {
      loadWorkouts(false);
      if (!woTipTriedRef.current || woTipErr) {
        woTipTriedRef.current = true;
        ensureWorkoutTip(false, workouts);
      }
    }
    if (next === 'supps') {
      loadSupps(false);
      if (!suppTipTriedRef.current || suppTipErr) {
        suppTipTriedRef.current = true;
        ensureSuppTip(false, supps);
      }
    }
  };

  const dateLabel = useMemo(() => {
    try {
      return new Date().toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } catch (e) {
      return '';
    }
  }, [locale]);

  const compact = tab === 'chat';
  const heroTitle =
    tab !== 'today'
      ? t(`coach.tab_${tab}`)
      : card
      ? card.headline
      : cardBusy
      ? t('coach.thinking')
      : cardErr
      ? t('coach.errTitle')
      : t('coach.fallbackHeadline');

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[c.primary, c.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.hero,
          compact && styles.heroCompact,
          { paddingTop: insets.top + (compact ? 10 : 14) },
        ]}
      >
        <View style={styles.heroKickerRow}>
          <Ionicons name="sparkles" size={13} color="rgba(255,255,255,0.9)" />
          <Text style={styles.heroKicker}>{t('coach.hero')}</Text>
        </View>
        <Text
          style={[styles.heroTitle, compact && styles.heroTitleSm]}
          numberOfLines={compact ? 1 : 2}
        >
          {heroTitle}
        </Text>
        {tab === 'today' && card ? (
          <Text style={styles.heroSub}>{dateLabel}</Text>
        ) : null}
      </LinearGradient>

      <View style={styles.segment}>
        {TABS.map((key) => {
          const active = key === tab;
          return (
            <Pressable
              key={key}
              onPress={() => switchTab(key)}
              style={[styles.segBtn, active && styles.segBtnOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={SEG_ICON[key]}
                size={15}
                color={active ? c.onPrimary : c.textMuted}
              />
              <Text
                style={[styles.segText, active && styles.segTextOn]}
                numberOfLines={1}
              >
                {t(`coach.tab_${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'today' ? (
        <TodayTab
          card={card}
          busy={cardBusy}
          err={cardErr}
          onRefresh={() => ensureCard(true)}
          tabBarH={tabBarH}
        />
      ) : tab === 'supps' ? (
        <SuppsTab
          supps={supps}
          suppLog={suppLog}
          suppTip={suppTip}
          suppTipBusy={suppTipBusy}
          suppTipErr={suppTipErr}
          suppReco={suppReco}
          onLoad={() => loadSupps(true)}
          onToggleSlot={toggleSlot}
          onRefreshTip={() => ensureSuppTip(true)}
          onHideReco={hideReco}
          navigation={navigation}
          tabBarH={tabBarH}
        />
      ) : tab === 'workouts' ? (
        <WorkoutsTab
          workouts={workouts}
          exerciseNames={exerciseNames}
          plan={plan}
          woTip={woTip}
          woTipBusy={woTipBusy}
          woTipErr={woTipErr}
          onLoad={() => loadWorkouts(true)}
          onRefreshTip={() => ensureWorkoutTip(true)}
          onDeletePlan={deletePlan}
          onStartPlanDay={startPlanDay}
          navigation={navigation}
          tabBarH={tabBarH}
        />
      ) : (
        <View style={styles.chatFill}>
          <CoachChat navigation={navigation} bottomInset={12} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    hero: { paddingHorizontal: 20, paddingBottom: 30 },
    heroCompact: { paddingBottom: 20 },
    heroKickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 8,
    },
    heroKicker: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
    },
    heroTitle: { color: '#fff', fontSize: 23, fontWeight: '800', lineHeight: 29 },
    heroTitleSm: { fontSize: 18, lineHeight: 23 },
    heroSub: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 12.5,
      marginTop: 8,
      textTransform: 'capitalize',
    },

    segment: {
      flexDirection: 'row',
      gap: 4,
      marginTop: -22,
      marginHorizontal: 16,
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 4,
      ...c.shadow,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: 'center',
      gap: 2,
    },
    segBtnOn: { backgroundColor: c.primary },
    segText: { fontSize: 10.5, fontWeight: '700', color: c.textMuted },
    segTextOn: { color: c.onPrimary },

    chatFill: { flex: 1, marginTop: 8 },
  });
