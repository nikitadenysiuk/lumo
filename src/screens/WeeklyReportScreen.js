import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import Svg, { Rect } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import {
  fetchRecentMeals,
  fetchWeightLog,
  getProfile,
} from '../services/supabaseClient';
import {
  dayKey,
  lastNDays,
  totalsByDay,
  currentStreak,
  weekAverage,
  goalStatus,
  GOAL_COLORS,
} from '../lib/days';
import { groupNum } from '../lib/format';
import { useT } from '../i18n/LocaleContext';
import { useTheme, useSettings } from '../settings/SettingsContext';
import Screen from '../ui/Screen';
import Button from '../ui/Button';

const LB = 2.2046226;

export default function WeeklyReportScreen({ navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const { units } = useSettings();
  const imperial = units === 'imperial';
  const styles = useMemo(() => makeStyles(c), [c]);
  const cardRef = useRef(null);

  const [state, setState] = useState(null);
  const [sharing, setSharing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('report.title') });
  }, [navigation, t]);

  const load = useCallback(async () => {
    try {
      const [meals, weights, profile] = await Promise.all([
        fetchRecentMeals(14),
        fetchWeightLog(30),
        getProfile().catch(() => null),
      ]);
      const byDay = totalsByDay(meals ?? []);
      const week = lastNDays(7);
      const avg = weekAverage(byDay, 7);
      const goalKcal = profile?.daily_kcal_goal ?? null;

      const weekStart = week[0].getTime();
      const recentW = (weights ?? []).filter(
        (w) => new Date(w.logged_on).getTime() >= weekStart
      );
      let weightDelta = null;
      if (recentW.length >= 2) {
        const d =
          Number(recentW[recentW.length - 1].weight_kg) -
          Number(recentW[0].weight_kg);
        weightDelta = Math.round(d * (imperial ? LB : 1) * 10) / 10;
      }

      setState({
        week,
        byDay,
        avg,
        goalKcal,
        streak: currentStreak(byDay),
        weightDelta,
      });
    } catch (e) {
      console.warn('report load', e?.message);
      setState({ week: lastNDays(7), byDay: {}, avg: { days: 0 }, goalKcal: null, streak: 0, weightDelta: null });
    }
  }, [imperial]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function share() {
    if (sharing || !cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: t('report.title'),
        });
      }
    } catch (e) {
      Alert.alert(t('report.title'), String(e?.message || e));
    } finally {
      setSharing(false);
    }
  }

  if (!state) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </Screen>
    );
  }

  const { week, byDay, avg, goalKcal, streak, weightDelta } = state;
  const wUnit = imperial ? t('weight.lb') : t('onb.kg');
  const rangeLabel =
    week[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' }) +
    ' – ' +
    week[6].toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const vals = week.map((d) => byDay[dayKey(d)]?.calories || 0);
  const vmax = Math.max(goalKcal || 0, ...vals, 1);

  return (
    <Screen>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View ref={cardRef} collapsable={false} style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.brand}>Lumo</Text>
          <Text style={styles.range}>{rangeLabel}</Text>
        </View>
        <Text style={styles.cardTitle}>{t('report.heading')}</Text>

        <Text style={styles.bigNum}>
          {avg.days ? groupNum(avg.calories) : '—'}
          <Text style={styles.bigUnit}> {t('report.kcalDay')}</Text>
        </Text>

        <View style={styles.chart}>
          {week.map((d, i) => {
            const v = vals[i];
            const col = GOAL_COLORS[goalStatus(v, goalKcal)] || c.divider;
            return (
              <View key={i} style={styles.chartCol}>
                <View style={styles.chartBarBox}>
                  <Svg width={16} height={70}>
                    <Rect
                      x={3}
                      y={70 - Math.max(3, (v / vmax) * 70)}
                      width={10}
                      height={Math.max(3, (v / vmax) * 70)}
                      rx={3}
                      fill={col}
                    />
                  </Svg>
                </View>
                <Text style={styles.chartDow}>
                  {d.toLocaleDateString(locale, { weekday: 'narrow' })}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.stats}>
          <Stat styles={styles} label={t('report.daysLogged')} value={`${avg.days} / 7`} />
          <Stat styles={styles} label={t('home.streakLabel')} value={`🔥 ${streak}`} />
          {weightDelta != null && (
            <Stat
              styles={styles}
              label={t('weight.title')}
              value={`${weightDelta > 0 ? '+' : ''}${weightDelta} ${wUnit}`}
            />
          )}
        </View>

        {avg.days > 0 && (
          <Text style={styles.macros}>
            {t('res.macros', {
              p: avg.protein_g,
              f: avg.fat_g,
              c: avg.carbs_g,
            })}{' '}
            · {t('report.perDay')}
          </Text>
        )}
      </View>

      <Button
        label={t('report.share')}
        icon="share-outline"
        loading={sharing}
        onPress={share}
        size="lg"
        style={styles.shareBtn}
      />
    </ScrollView>
    </Screen>
  );
}

function Stat({ styles, label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 40 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 20,
      padding: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    brand: { fontSize: 18, fontWeight: '900', color: c.primary, letterSpacing: 0.5 },
    range: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    cardTitle: { fontSize: 14, color: c.textMuted, marginTop: 10 },
    bigNum: { fontSize: 44, fontWeight: '900', color: c.text, marginTop: 2 },
    bigUnit: { fontSize: 14, fontWeight: '600', color: c.textMuted },
    chart: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 18,
    },
    chartCol: { alignItems: 'center', flex: 1 },
    chartBarBox: { height: 70, justifyContent: 'flex-end' },
    chartDow: { fontSize: 10, color: c.textFaint, marginTop: 4 },
    stats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    stat: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 17, fontWeight: '800', color: c.text },
    statLabel: { fontSize: 11, color: c.textMuted, marginTop: 3, textAlign: 'center' },
    macros: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 16,
      textAlign: 'center',
    },
    shareBtn: { marginTop: 20 },
  });
