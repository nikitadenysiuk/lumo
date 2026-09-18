import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';

import {
  fetchRecentMeals,
  getSignedPhotoUrls,
  getProfile,
  addMealFromPayload,
  deleteMeal,
} from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import SwipeRow from '../components/SwipeRow';
import FadeInRow from '../components/FadeInRow';
import Screen from '../ui/Screen';
import Flash from '../components/Flash';
import { groupNum } from '../lib/format';
import OptionSheet from '../components/OptionSheet';
import DayPickerSheet from '../components/DayPickerSheet';
import EmptyState from '../components/EmptyState';
import { ListSkeleton } from '../components/Skeleton';
import { hSuccess, hSelect } from '../lib/haptics';
import { findRecentDup, confirmDup } from '../lib/dupGuard';
import {
  dayKey,
  lastNDays,
  totalsByDay,
  goalStatus,
  GOAL_COLORS,
} from '../lib/days';
import { MEAL_EMOJI, MEAL_ORDER, guessMealType } from '../lib/meals';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { useSelectedDay } from '../state/SelectedDayContext';

const STRIP_DAYS = 30;

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryScreen({ navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const stripRef = useRef(null);

  const [meals, setMeals] = useState([]);
  const [photoUrls, setPhotoUrls] = useState({});
  const [goalKcal, setGoalKcal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState(null);
  const [addSheet, setAddSheet] = useState(false);
  const [rowSheet, setRowSheet] = useState(null); // приём для меню действий
  const [copyMeal, setCopyMeal] = useState(null); // приём для выбора дня копии
  const flashTimer = useRef(null);
  const pendingDelete = useRef(null); // { meal, timer } — удаление ждёт «Отменить»
  const { selectedKey, setSelectedKey, todayKey } = useSelectedDay();

  const showFlash = useCallback((msg) => {
    setFlash({ message: msg });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1400);
  }, []);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('DiarySearch')}
          hitSlop={12}
          style={{ paddingHorizontal: 6 }}
        >
          <Ionicons name="search" size={21} color={c.text} />
        </Pressable>
      ),
    });
  }, [navigation, c.text]);

  // довести отложенное удаление до сервера (при уходе с экрана / новом удалении)
  const commitPendingDelete = useCallback(() => {
    const p = pendingDelete.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingDelete.current = null;
    setFlash(null);
    deleteMeal(p.meal).catch((e) => {
      console.warn('history delete', e?.message);
    });
  }, []);
  useEffect(() => () => commitPendingDelete(), [commitPendingDelete]);
  useFocusEffect(useCallback(() => () => commitPendingDelete(), [commitPendingDelete]));

  const load = useCallback(async () => {
    try {
      const [data, profile] = await Promise.all([
        fetchRecentMeals(45),
        getProfile().catch(() => null),
      ]);
      const hideId = pendingDelete.current?.meal?.id;
      setMeals((data ?? []).filter((m) => m.id !== hideId));
      setGoalKcal(profile?.daily_kcal_goal ?? null);
      try {
        const urls = await getSignedPhotoUrls((data ?? []).map((m) => m.photo_url));
        setPhotoUrls(urls);
      } catch (e) {
        console.warn('signed urls', e?.message);
      }
    } catch (err) {
      console.warn('history load', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function removeMeal(meal) {
    // если ещё висит прошлое удаление — фиксируем его на сервере
    commitPendingDelete();
    setMeals((arr) => arr.filter((m) => m.id !== meal.id));
    clearTimeout(flashTimer.current);

    const timer = setTimeout(() => {
      const p = pendingDelete.current;
      pendingDelete.current = null;
      setFlash(null);
      if (p) {
        deleteMeal(p.meal).catch((e) => {
          console.warn('history delete', e?.message);
          load();
        });
      }
    }, 5000);
    pendingDelete.current = { meal, timer };

    const undo = () => {
      const p = pendingDelete.current;
      if (!p) return;
      clearTimeout(p.timer);
      pendingDelete.current = null;
      setFlash(null);
      setMeals((arr) =>
        arr.some((m) => m.id === p.meal.id) ? arr : [...arr, p.meal]
      );
      hSuccess();
    };

    setFlash({
      message: '✓ ' + t('common.deleted'),
      actionLabel: t('common.undo'),
      onAction: undo,
    });
  }

  function copyPrevDay() {
    const d = new Date(`${selectedKey}T12:00:00`);
    d.setDate(d.getDate() - 1);
    const prevKey = dayKey(d);
    const prevMeals = meals.filter((m) => dayKey(m.created_at) === prevKey);
    const prevLabel = d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
    });
    if (!prevMeals.length) {
      Alert.alert(t('hist.copyDay'), t('hist.copyEmpty', { d: prevLabel }));
      return;
    }
    Alert.alert(
      t('hist.copyDay'),
      t('hist.copyConfirm', { n: prevMeals.length, d: prevLabel }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.ok'),
          onPress: async () => {
            try {
              for (const m of prevMeals) {
                await addMealFromPayload(m, {
                  dateKey: selectedKey,
                  isToday: selectedKey === todayKey,
                  mealType: m.meal_type || null,
                });
              }
              hSuccess();
              showFlash(`✓ ${t('mt.added')} · ${prevMeals.length}`);
              load();
            } catch (e) {
              Alert.alert(t('hist.copyDay'), toUserMessage(e));
            }
          },
        },
      ]
    );
  }

  // «↻» = «хочу это сегодня»: всегда добавляем на текущий день
  async function copyMealToDay(meal, key) {
    try {
      await addMealFromPayload(meal, {
        dateKey: key,
        isToday: key === todayKey,
        mealType: meal.meal_type || guessMealType(new Date()),
      });
      hSuccess();
      const label = new Date(key).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
      });
      showFlash(`✓ ${t('hist.copiedTo', { d: label })}`);
      if (key === selectedKey) load();
    } catch (e) {
      Alert.alert(t('hist.copyTo'), toUserMessage(e));
    }
  }

  async function repeatMeal(meal) {
    if (
      findRecentDup(meals, meal.food_name, meal.calories) &&
      !(await confirmDup())
    ) {
      return;
    }
    try {
      await addMealFromPayload(meal, {
        dateKey: todayKey,
        isToday: true,
        mealType: meal.meal_type || guessMealType(new Date()),
      });
      hSuccess();
      showFlash('✓ ' + t('mt.added'));
      if (selectedKey !== todayKey) setSelectedKey(todayKey);
      load();
    } catch (e) {
      Alert.alert(t('hist.repeat'), toUserMessage(e));
    }
  }

  const byDay = useMemo(() => totalsByDay(meals), [meals]);
  const days = useMemo(() => lastNDays(STRIP_DAYS), []);

  const selMeals = meals.filter((m) => dayKey(m.created_at) === selectedKey);
  const selTotals = byDay[selectedKey] || { calories: 0 };

  const sections = useMemo(() => {
    const groups = {};
    for (const m of selMeals) {
      const k = m.meal_type || 'other';
      (groups[k] = groups[k] || []).push(m);
    }
    return Object.keys(groups)
      .sort((a, b) => (MEAL_ORDER[a] ?? 9) - (MEAL_ORDER[b] ?? 9))
      .map((k) => ({
        key: k,
        kcal: groups[k].reduce((s, m) => s + (m.calories || 0), 0),
        data: groups[k].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        ),
      }));
  }, [selMeals]);

  const yestKey = dayKey(new Date(Date.now() - 86400000));
  const selLabel =
    selectedKey === todayKey
      ? t('hist.today')
      : selectedKey === yestKey
      ? t('hist.yesterday')
      : new Date(selectedKey).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
        });

  if (loading) {
    return (
      <Screen>
        <ListSkeleton rows={7} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Flash
        message={flash?.message}
        actionLabel={flash?.actionLabel}
        onAction={flash?.onAction}
      />
      <View style={styles.stripWrap}>
        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          onContentSizeChange={() =>
            stripRef.current?.scrollToEnd({ animated: false })
          }
        >
          {days.map((d) => {
            const k = dayKey(d);
            const tot = byDay[k]?.calories || 0;
            const active = k === selectedKey;
            const color = GOAL_COLORS[goalStatus(tot, goalKcal)];
            return (
              <Pressable
                key={k}
                style={[styles.dayCell, active && styles.dayCellActive]}
                onPress={() => setSelectedKey(k)}
              >
                <Text style={[styles.dayDow, active && styles.dayTextActive]}>
                  {d.toLocaleDateString(locale, { weekday: 'narrow' })}
                </Text>
                <Text style={[styles.dayNum, active && styles.dayTextActive]}>
                  {d.getDate()}
                </Text>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: color || c.divider },
                  ]}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.summaryBar}>
        <Text style={styles.summaryLabel}>{selLabel}</Text>
        <Text style={styles.summaryValue}>
          {groupNum(selTotals.calories)} {t('hist.kcal')}
          {goalKcal ? (
            <Text style={styles.summaryGoal}>
              {'  '}/ {groupNum(goalKcal)}
            </Text>
          ) : null}
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
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
        ListEmptyComponent={<EmptyState art="plate" title={t('hist.empty')} />}
        ListHeaderComponent={
          sections.length > 0 ? (
            <Text style={styles.swipeHint}>{t('hist.swipeHint')}</Text>
          ) : null
        }
        ListFooterComponent={
          <Pressable
            style={styles.addMeal}
            onPress={() => setAddSheet(true)}
          >
            <Text style={styles.addMealText}>＋ {t('mt.addMeal')}</Text>
          </Pressable>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.secHead}>
            <Text style={styles.secTitle}>
              {MEAL_EMOJI[section.key] || ''} {t(`mt.${section.key}`)}
            </Text>
            <Text style={styles.secKcal}>
              {groupNum(section.kcal)} {t('hist.kcal')}
            </Text>
          </View>
        )}
        renderItem={({ item, index }) => {
          const raw = item.photo_url;
          const photo = raw
            ? raw.startsWith('http')
              ? raw
              : photoUrls[raw]
            : null;
          return (
            <FadeInRow index={index}>
            <SwipeRow onDelete={() => removeMeal(item)}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => navigation.navigate('MealDetail', { meal: item })}
                onLongPress={() => {
                  hSelect();
                  setRowSheet(item);
                }}
                delayLongPress={280}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]} />
                )}
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.food_name}
                  </Text>
                  <Text style={styles.rowMacros}>
                    {t('res.macros', {
                      p: Math.round(Number(item.protein_g) || 0),
                      f: Math.round(Number(item.fat_g) || 0),
                      c: Math.round(Number(item.carbs_g) || 0),
                    })}
                  </Text>
                  <Text style={styles.rowTime}>
                    {formatTime(item.created_at)}
                    {item.note ? '  📝' : ''}
                  </Text>
                </View>
                <Text style={styles.rowCalories}>
                  {groupNum(item.calories)} {t('hist.kcal')}
                </Text>
                <Pressable
                  onPress={() => repeatMeal(item)}
                  hitSlop={10}
                  style={styles.repeat}
                >
                  <Text style={styles.repeatText}>↻</Text>
                </Pressable>
              </Pressable>
            </SwipeRow>
            </FadeInRow>
          );
        }}
      />

      <OptionSheet
        visible={!!rowSheet}
        onClose={() => setRowSheet(null)}
        title={rowSheet?.food_name || t('hist.rowActions')}
        options={[
          {
            label: t('hist.repeatToday'),
            icon: 'refresh',
            onPress: () => rowSheet && repeatMeal(rowSheet),
          },
          {
            label: t('hist.copyTo'),
            icon: 'calendar-outline',
            onPress: () => {
              const m = rowSheet;
              if (m) setTimeout(() => setCopyMeal(m), 260);
            },
          },
          {
            label: t('common.edit'),
            icon: 'create-outline',
            onPress: () =>
              rowSheet &&
              navigation.navigate('MealDetail', { meal: rowSheet }),
          },
          {
            label: t('common.delete'),
            icon: 'trash-outline',
            destructive: true,
            onPress: () => rowSheet && removeMeal(rowSheet),
          },
        ]}
      />

      <OptionSheet
        visible={addSheet}
        onClose={() => setAddSheet(false)}
        title={t('mt.addMeal')}
        options={[
          {
            label: t('hist.sheetPhoto'),
            icon: 'camera',
            onPress: () => navigation.navigate('CameraTab'),
          },
          {
            label: t('hist.sheetManual'),
            icon: 'create',
            onPress: () => navigation.navigate('QuickAdd'),
          },
          {
            label: t('hist.copyDay'),
            icon: 'copy',
            onPress: copyPrevDay,
          },
        ]}
      />

      <DayPickerSheet
        visible={!!copyMeal}
        onClose={() => setCopyMeal(null)}
        title={t('hist.copyToTitle', { name: copyMeal?.food_name || '' })}
        confirmLabel={t('hist.copyDo')}
        onPick={(key) => copyMeal && copyMealToDay(copyMeal, key)}
      />
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stripWrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    strip: { paddingHorizontal: 8, paddingVertical: 8 },
    dayCell: {
      width: 40,
      alignItems: 'center',
      paddingVertical: 6,
      borderRadius: 10,
      marginHorizontal: 2,
    },
    dayCellActive: { backgroundColor: c.accentSoft },
    dayDow: {
      fontSize: 10,
      color: c.textMuted,
      textTransform: 'uppercase',
    },
    dayNum: { fontSize: 14, fontWeight: '700', color: c.text, marginTop: 2 },
    dayTextActive: { color: c.dark ? c.text : c.primary },
    dot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
    summaryBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: c.accentSoft,
    },
    summaryLabel: {
      fontSize: 14,
      color: c.dark ? c.text : c.textMuted,
      textTransform: 'capitalize',
    },
    summaryValue: { fontSize: 18, fontWeight: '700', color: c.primary },
    summaryGoal: { fontSize: 14, fontWeight: '600', color: c.textMuted },
    list: { padding: 16 },
    empty: { textAlign: 'center', color: c.textFaint, marginTop: 40 },
    swipeHint: { fontSize: 11, color: c.textFaint, marginBottom: 2 },
    secHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 14,
      marginBottom: 2,
    },
    secTitle: { fontSize: 13, fontWeight: '800', color: c.text },
    secKcal: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    footer: { marginTop: 18 },
    footerRow: { flexDirection: 'row', gap: 10 },
    footerHalf: { flex: 1, marginTop: 0 },
    addMeal: {
      marginTop: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.primary,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 6,
      alignItems: 'center',
    },
    addMealText: {
      color: c.primary,
      fontWeight: '700',
      fontSize: 13,
      textAlign: 'center',
    },
    copyDay: { alignItems: 'center', paddingVertical: 14 },
    copyDayText: { color: c.textMuted, fontWeight: '600', fontSize: 13 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    rowPressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
    thumb: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
    thumbEmpty: { backgroundColor: c.card },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 16, fontWeight: '600', color: c.text },
    rowMacros: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    rowTime: { fontSize: 11, color: c.textFaint, marginTop: 2 },
    rowCalories: { fontSize: 16, fontWeight: '700', color: c.primary },
    repeat: {
      width: 34,
      height: 34,
      borderRadius: 17,
      marginLeft: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accentSoft,
    },
    repeatText: { color: c.primary, fontSize: 18, fontWeight: '800' },
    flash: {
      position: 'absolute',
      top: 10,
      alignSelf: 'center',
      zIndex: 20,
      backgroundColor: c.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    flashText: { color: c.onPrimary, fontWeight: '700', fontSize: 13 },
  });
