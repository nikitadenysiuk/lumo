import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';

import {
  fetchWeightLog,
  fetchRecentMeals,
  getProfile,
} from '../services/supabaseClient';
import { dayKey, lastNDays, totalsByDay } from '../lib/days';
import { groupNum } from '../lib/format';
import { useT } from '../i18n/LocaleContext';
import { useTheme, useSettings } from '../settings/SettingsContext';
import { MACRO_COLORS } from '../theme/palettes';
import TrendChart from '../components/TrendChart';
import { CardsSkeleton } from '../components/Skeleton';
import Screen from '../ui/Screen';
import Chip from '../ui/Chip';

const LB = 2.2046226;
const RANGES = [30, 90, 180];

// запоминаем выбранный диапазон между заходами (в рамках сессии)
let lastRange = 90;

function bmiOf(kg, cm) {
  if (!kg || !cm) return null;
  const m = cm / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

export default function TrendsScreen({ navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const { units } = useSettings();
  const imperial = units === 'imperial';
  const styles = useMemo(() => makeStyles(c), [c]);

  const [range, setRangeState] = useState(lastRange);
  const setRange = (r) => {
    lastRange = r;
    setRangeState(r);
  };
  const [weights, setWeights] = useState([]);
  const [meals, setMeals] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('trends.title') });
  }, [navigation, t]);

  const load = useCallback(async () => {
    try {
      const [w, m, p] = await Promise.all([
        fetchWeightLog(180),
        fetchRecentMeals(180),
        getProfile().catch(() => null),
      ]);
      setWeights(w);
      setMeals(m ?? []);
      setProfile(p);
    } catch (e) {
      console.warn('trends load', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const now = Date.now();
  const tMin = now - range * 86400000;
  const wUnit = imperial ? t('weight.lb') : t('onb.kg');
  const wView = (kg) => (imperial ? kg * LB : kg);

  const byDay = useMemo(() => totalsByDay(meals), [meals]);

  const weightSeries = useMemo(
    () =>
      weights
        .map((r) => ({ t: new Date(r.logged_on).getTime(), v: wView(Number(r.weight_kg)) }))
        .filter((d) => d.t >= tMin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weights, tMin, imperial]
  );

  const bmiSeries = useMemo(
    () =>
      profile?.height_cm
        ? weights
            .map((r) => ({
              t: new Date(r.logged_on).getTime(),
              v: bmiOf(Number(r.weight_kg), profile.height_cm),
            }))
            .filter((d) => d.t >= tMin && d.v != null)
        : [],
    [weights, profile, tMin]
  );

  const kcalSeries = useMemo(() => {
    const days = lastNDays(range);
    return days.map((d) => ({
      t: d.getTime(),
      v: byDay[dayKey(d)]?.calories || 0,
    }));
  }, [byDay, range]);

  const kcalDaysWithData = kcalSeries.filter((d) => d.v > 0);
  const kcalAvg = kcalDaysWithData.length
    ? Math.round(
        kcalDaysWithData.reduce((s, d) => s + d.v, 0) / kcalDaysWithData.length
      )
    : 0;

  const wFirst = weightSeries[0]?.v;
  const wLast = weightSeries[weightSeries.length - 1]?.v;
  const wDelta =
    wFirst != null && wLast != null
      ? Math.round((wLast - wFirst) * 10) / 10
      : null;

  const curBmi = bmiSeries[bmiSeries.length - 1]?.v ?? null;
  const bmiCat =
    curBmi == null
      ? null
      : curBmi < 18.5
      ? t('prof.bmiUnder')
      : curBmi < 25
      ? t('prof.bmiNormal')
      : curBmi < 30
      ? t('prof.bmiOver')
      : t('prof.bmiObese');

  if (loading) {
    return (
      <Screen>
        <CardsSkeleton cards={3} height={180} />
      </Screen>
    );
  }

  return (
    <Screen>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.ranges}>
        {RANGES.map((r) => (
          <Chip
            key={r}
            flex
            active={range === r}
            onPress={() => setRange(r)}
            label={t('trends.months', { n: Math.round(r / 30) })}
          />
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{t('weight.title')}</Text>
          {wDelta != null && (
            <Text
              style={[
                styles.cardMeta,
                { color: wDelta > 0 ? c.danger : wDelta < 0 ? '#22c55e' : c.textMuted },
              ]}
            >
              {wDelta > 0 ? '+' : ''}
              {wDelta} {wUnit}
            </Text>
          )}
        </View>
        <TrendChart
          data={weightSeries}
          type="line"
          tMin={tMin}
          tMax={now}
          locale={locale}
          color={c.primary}
          goal={
            profile?.target_weight_kg ? wView(profile.target_weight_kg) : null
          }
          fmt={(v) => `${Math.round(v)} ${wUnit}`}
          emptyText={t('trends.noWeight')}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{t('trends.kcalPerDay')}</Text>
          {kcalAvg > 0 && (
            <Text style={styles.cardMeta}>
              {t('trends.avg')} {groupNum(kcalAvg)}
            </Text>
          )}
        </View>
        <TrendChart
          data={kcalSeries}
          type="bar"
          tMin={tMin}
          tMax={now}
          locale={locale}
          color={MACRO_COLORS.carbs}
          goal={profile?.daily_kcal_goal || null}
          emptyText={t('trends.noData')}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{t('prof.bmi')}</Text>
          {curBmi != null && (
            <Text style={styles.cardMeta}>
              {curBmi} · {bmiCat}
            </Text>
          )}
        </View>
        <TrendChart
          data={bmiSeries}
          type="line"
          tMin={tMin}
          tMax={now}
          locale={locale}
          color={MACRO_COLORS.fat}
          fmt={(v) => v.toFixed(1)}
          emptyText={t('trends.noWeight')}
        />
      </View>

      {!profile?.height_cm && (
        <Text style={styles.hint}>{t('trends.needHeight')}</Text>
      )}
    </ScrollView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 40 },
    ranges: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    cardTitle: { fontSize: 14, fontWeight: '700', color: c.text },
    cardMeta: { fontSize: 13, fontWeight: '700', color: c.textMuted },
    hint: { fontSize: 12, color: c.textFaint, textAlign: 'center', marginTop: 4 },
  });
