// src/screens/ExerciseProgressScreen.js
//
// Модальный экран: прогресс по одному упражнению — график рабочего веса по датам
// и список сессий. См. db/19_workouts.sql.

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '../ui/Text';
import Screen from '../ui/Screen';
import TrendChart from '../components/TrendChart';
import EmptyState from '../components/EmptyState';
import { fetchExerciseHistory } from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';

function buildSessions(rows) {
  const byDay = new Map();
  for (const r of rows) {
    const w = Number(r.weight_kg) || 0;
    const reps = Number(r.reps) || 0;
    if (!byDay.has(r.workout_on)) {
      byDay.set(r.workout_on, { date: r.workout_on, best: 0, bestReps: 0, volume: 0, sets: 0 });
    }
    const s = byDay.get(r.workout_on);
    s.volume += w * reps;
    s.sets += 1;
    if (w > s.best) {
      s.best = w;
      s.bestReps = reps;
    }
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default function ExerciseProgressScreen({ route, navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const name = route.params?.name || '';

  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: name || t('exprog.title') });
  }, [navigation, name, t]);

  useEffect(() => {
    fetchExerciseHistory(name)
      .then(setRows)
      .catch((e) => setErr(toUserMessage(e)));
  }, [name]);

  const sessions = useMemo(() => (rows ? buildSessions(rows) : []), [rows]);
  const chartData = useMemo(
    () =>
      sessions.map((s) => ({
        t: new Date(`${s.date}T12:00:00`).getTime(),
        v: s.best,
      })),
    [sessions]
  );

  const pr = sessions.reduce((m, s) => Math.max(m, s.best), 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        {err ? (
          <Text style={styles.err}>{err}</Text>
        ) : rows == null ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : sessions.length === 0 ? (
          <EmptyState
            emoji="📈"
            title={t('exprog.empty_title')}
            hint={t('exprog.empty_hint')}
          />
        ) : (
          <>
            {pr > 0 ? (
              <View style={styles.prCard}>
                <Text style={styles.prLabel}>{t('exprog.pr')}</Text>
                <Text style={styles.prValue}>
                  {pr} {t('workout.kg')}
                </Text>
              </View>
            ) : null}

            {chartData.filter((d) => d.v > 0).length >= 2 ? (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>{t('exprog.chartTitle')}</Text>
                <TrendChart
                  data={chartData}
                  locale={locale}
                  fmt={(v) => `${Math.round(v)} ${t('workout.kg')}`}
                />
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>{t('exprog.sessions')}</Text>
            {[...sessions].reverse().map((s) => (
              <View key={s.date} style={styles.row}>
                <Text style={styles.rowDate}>
                  {new Date(`${s.date}T12:00:00`).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                <View style={styles.rowRight}>
                  {s.best > 0 ? (
                    <Text style={styles.rowBest}>
                      {s.best} {t('workout.kg')}
                      {s.bestReps ? ` × ${s.bestReps}` : ''}
                    </Text>
                  ) : (
                    <Text style={styles.rowBest}>{s.sets} × {t('workout.addSet')}</Text>
                  )}
                  {s.volume > 0 ? (
                    <Text style={styles.rowVol}>
                      {Math.round(s.volume)} {t('workout.kg')}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, paddingBottom: 40 },
    center: { paddingVertical: 60, alignItems: 'center' },
    err: { color: c.danger, fontSize: 14, textAlign: 'center', paddingVertical: 40 },

    prCard: {
      backgroundColor: c.accentSoft,
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      alignItems: 'center',
    },
    prLabel: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.primary,
      marginBottom: 4,
    },
    prValue: { fontSize: 26, fontWeight: '800', color: c.text },

    chartCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 14,
      marginBottom: 8,
      ...c.shadow,
    },
    chartTitle: { fontSize: 13, fontWeight: '700', color: c.textMuted, marginBottom: 8 },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.textMuted,
      marginTop: 20,
      marginBottom: 8,
      marginLeft: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    rowDate: { fontSize: 13, color: c.textMuted },
    rowRight: { alignItems: 'flex-end' },
    rowBest: { fontSize: 14, fontWeight: '700', color: c.text },
    rowVol: { fontSize: 11.5, color: c.textFaint, marginTop: 1 },
  });
