// src/screens/coach/WorkoutsTab.js — вкладка «Тренировки».

import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../../ui/Text';
import Button from '../../ui/Button';
import EmptyState from '../../components/EmptyState';
import TipCard from './TipCard';
import { SkeletonList } from './Skeleton';
import { coachTints } from './tints';
import { dayKey } from '../../lib/days';
import { feelingEmoji, groupByDay, typeIcon, typeLabel } from '../../lib/workouts';
import { useTheme, useSettings } from '../../settings/SettingsContext';
import { useT } from '../../i18n/LocaleContext';

// Сводка по журналу: тренировок за 7 / 30 дней и сколько дней прошло с последней.
function summarize(workouts) {
  const ms = (k) => new Date(`${k}T12:00:00`).getTime();
  const now = ms(dayKey(new Date()));
  let w7 = 0;
  let w30 = 0;
  let last = null;
  for (const w of workouts || []) {
    if (!w.workout_on) continue;
    const age = Math.round((now - ms(w.workout_on)) / 86400000);
    if (age <= 6) w7 += 1;
    if (age <= 29) w30 += 1;
    if (!last || w.workout_on > last) last = w.workout_on;
  }
  const daysSince = last
    ? Math.max(0, Math.round((now - ms(last)) / 86400000))
    : null;
  return { w7, w30, daysSince };
}

function StatStrip({ s, t, styles }) {
  return (
    <View style={styles.statStrip}>
      <View style={styles.statCell}>
        <Text style={styles.statNum}>{s.w7}</Text>
        <Text style={styles.statLabel}>{t('workout.sWeek')}</Text>
      </View>
      <View style={styles.statSep} />
      <View style={styles.statCell}>
        <Text style={styles.statNum}>{s.w30}</Text>
        <Text style={styles.statLabel}>{t('workout.sMonth')}</Text>
      </View>
      <View style={styles.statSep} />
      <View style={styles.statCell}>
        <Text style={styles.statNum}>{s.daysSince == null ? '—' : s.daysSince}</Text>
        <Text style={styles.statLabel}>{t('workout.sLast')}</Text>
      </View>
    </View>
  );
}

function dayLabel(key, locale, t) {
  const today = dayKey(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return t('workout.today');
  if (key === dayKey(y)) return t('workout.yesterday');
  try {
    return new Date(`${key}T12:00:00`).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });
  } catch (e) {
    return key;
  }
}

function PlanCard({
  plan,
  onNewPlan,
  onDeletePlan,
  onStartDay,
  onEditDay,
  t,
  c,
  styles,
}) {
  const p = plan.payload || {};
  const days = p.days || [];
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? days : days.slice(0, 3);
  return (
    <View style={styles.planCard}>
      <View style={styles.planHead}>
        <Ionicons name="clipboard" size={15} color={c.primary} />
        <Text style={styles.planTitle}>{p.title || plan.title}</Text>
      </View>
      {!!p.summary && <Text style={styles.planSummary}>{p.summary}</Text>}

      {shown.map((d, i) => (
        <View key={i} style={styles.planDay}>
          <Pressable
            style={styles.planDayLeft}
            onPress={() => onEditDay(i, d)}
          >
            <Text style={styles.planDayName} numberOfLines={1}>
              {d.name}
            </Text>
            <View style={styles.planDayMetaRow}>
              <Text style={styles.planDayFocus} numberOfLines={1}>
                {[d.focus, `${d.exercises?.length || 0} ${t('plan.exCount')}`]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Ionicons name="pencil" size={11} color={c.textFaint} />
            </View>
          </Pressable>
          <Pressable style={styles.planStart} onPress={() => onStartDay(d)}>
            <Text style={styles.planStartText}>{t('plan.startDay')}</Text>
          </Pressable>
        </View>
      ))}

      {days.length > 3 ? (
        <Pressable
          style={styles.planMore}
          onPress={() => setExpanded((v) => !v)}
          hitSlop={6}
        >
          <Text style={styles.planMoreText}>
            {expanded
              ? t('plan.lessDays')
              : t('plan.moreDays', { n: days.length - 3 })}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={13}
            color={c.primary}
          />
        </Pressable>
      ) : null}

      {Array.isArray(p.tips) && p.tips.length > 0 ? (
        <View style={styles.planTips}>
          {p.tips.map((tp, i) => (
            <Text key={i} style={styles.planTip}>
              • {tp}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.planActions}>
        <Pressable onPress={onNewPlan} hitSlop={6}>
          <Text style={styles.planActionText}>{t('plan.newPlan')}</Text>
        </Pressable>
        <Pressable onPress={onDeletePlan} hitSlop={6}>
          <Text style={[styles.planActionText, { color: c.danger }]}>
            {t('plan.deletePlan')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function WorkoutCard({ w, onEdit, t, c, styles }) {
  const meta = [];
  if (w.duration_min) meta.push(`${w.duration_min} ${t('workout.min')}`);
  if (w.distance_km) meta.push(`${w.distance_km} ${t('workout.km')}`);
  if (w.calories_est) meta.push(`${w.calories_est} ${t('workout.kcal')}`);
  return (
    <Pressable style={styles.woCard} onPress={onEdit}>
      <View style={styles.woIcon}>
        <Ionicons name={typeIcon(w.type)} size={18} color={c.primary} />
      </View>
      <View style={styles.woBody}>
        <Text style={styles.woTitle} numberOfLines={1}>
          {w.title || typeLabel(w.type, t)}
        </Text>
        {meta.length > 0 ? (
          <Text style={styles.woMeta}>{meta.join('  ·  ')}</Text>
        ) : null}
      </View>
      {w.feeling ? (
        <Text style={styles.woFeeling}>{feelingEmoji(w.feeling)}</Text>
      ) : null}
      <Ionicons name="chevron-forward" size={15} color={c.textFaint} />
    </Pressable>
  );
}

export default function WorkoutsTab({
  workouts,
  exerciseNames,
  plan,
  woTip,
  woTipBusy,
  woTipErr,
  onLoad,
  onRefreshTip,
  onDeletePlan,
  onStartPlanDay,
  navigation,
  tabBarH,
}) {
  const c = useTheme();
  const { accent } = useSettings();
  const { t, locale } = useT();
  const tints = useMemo(() => coachTints(accent), [accent]);
  const styles = useMemo(() => makeStyles(c, tints), [c, tints]);
  const [refreshing, setRefreshing] = useState(false);

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await onLoad();
    } finally {
      setRefreshing(false);
    }
  };

  const planBlock = plan ? (
    <PlanCard
      plan={plan}
      onNewPlan={() => navigation.navigate('PlanWizard')}
      onDeletePlan={onDeletePlan}
      onStartDay={onStartPlanDay}
      onEditDay={(i, d) =>
        navigation.navigate('PlanDayEdit', {
          planId: plan.id,
          dayIndex: i,
          day: d,
        })
      }
      t={t}
      c={c}
      styles={styles}
    />
  ) : (
    <Pressable
      style={styles.planCta}
      onPress={() => navigation.navigate('PlanWizard')}
    >
      <Ionicons name="clipboard-outline" size={18} color={c.primary} />
      <Text style={styles.planCtaText}>{t('plan.buildBtn')}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.body, { paddingBottom: tabBarH + 28 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={doRefresh}
          tintColor={c.primary}
        />
      }
    >
      {workouts == null ? (
        <SkeletonList count={2} lines={3} />
      ) : workouts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.suppEmpty}>
            <EmptyState
              emoji="🏋️"
              title={t('workout.empty_title')}
              hint={t('workout.empty_hint')}
            />
            <Button
              label={t('workout.addBtn')}
              icon="add"
              onPress={() => navigation.navigate('WorkoutEdit')}
              fullWidth={false}
            />
          </View>
          {planBlock}
        </View>
      ) : (
        <>
          <StatStrip s={summarize(workouts)} t={t} styles={styles} />

          {planBlock}

          <TipCard
            kicker={t('workout.tipKicker')}
            icon="barbell"
            tint={tints.workout}
            tip={woTip}
            busy={woTipBusy}
            err={woTipErr}
            onRefresh={onRefreshTip}
            loadingText={t('workout.tipThinking')}
          />

          {groupByDay(workouts).map((g) => (
            <View key={g.key} style={styles.woDay}>
              <Text style={styles.woDayLabel}>{dayLabel(g.key, locale, t)}</Text>
              {g.items.map((w) => (
                <WorkoutCard
                  key={w.id}
                  w={w}
                  onEdit={() =>
                    navigation.navigate('WorkoutEdit', { workout: w })
                  }
                  t={t}
                  c={c}
                  styles={styles}
                />
              ))}
            </View>
          ))}

          {exerciseNames.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>
                {t('workout.progressLabel')}
              </Text>
              <View style={styles.exList}>
                {exerciseNames.map((ex, i) => (
                  <Pressable
                    key={ex.name}
                    style={[styles.exRow, i > 0 && styles.exRowDiv]}
                    onPress={() =>
                      navigation.navigate('ExerciseProgress', { name: ex.name })
                    }
                  >
                    <Text style={styles.exName} numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <View style={styles.exRight}>
                      <Text style={styles.exCount}>{ex.count}</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={c.textFaint}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Pressable
            style={styles.addRow}
            onPress={() => navigation.navigate('WorkoutEdit')}
          >
            <Ionicons name="add-circle-outline" size={20} color={c.primary} />
            <Text style={styles.addRowText}>{t('workout.addBtn')}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c, tints) =>
  StyleSheet.create({
    body: { padding: 16, paddingTop: 18, flexGrow: 1 },
    centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
    emptyWrap: { gap: 16, paddingTop: 4 },
    suppEmpty: { alignItems: 'center', gap: 4, paddingTop: 20 },

    statStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      paddingVertical: 14,
      marginBottom: 18,
      ...c.shadow,
    },
    statCell: { flex: 1, alignItems: 'center', gap: 3 },
    statNum: { fontSize: 19, fontWeight: '800', color: c.text },
    statLabel: { fontSize: 10.5, color: c.textMuted, textAlign: 'center' },
    statSep: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: c.divider },

    planMore: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    planMoreText: { fontSize: 12.5, fontWeight: '700', color: c.primary },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: c.textMuted,
      textTransform: 'uppercase',
      marginTop: 22,
      marginBottom: 8,
      marginLeft: 2,
    },

    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 14,
      marginTop: 4,
    },
    addRowText: { fontSize: 14, fontWeight: '700', color: c.primary },

    woDay: { marginBottom: 18 },
    woDayLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: c.textMuted,
      textTransform: 'uppercase',
      marginBottom: 8,
      marginLeft: 2,
    },
    woCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 13,
      marginBottom: 8,
      ...c.shadow,
    },
    woIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    woBody: { flex: 1 },
    woTitle: { fontSize: 14.5, fontWeight: '700', color: c.text },
    woMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    woFeeling: { fontSize: 16 },

    exList: {
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      paddingHorizontal: 14,
      ...c.shadow,
    },
    exRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
    },
    exRowDiv: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    exName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
      marginRight: 10,
    },
    exRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    exCount: { fontSize: 12, color: c.textFaint, fontWeight: '700' },

    planCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.primary,
      borderStyle: 'dashed',
      borderRadius: 14,
      paddingVertical: 14,
      marginBottom: 18,
    },
    planCtaText: { fontSize: 14, fontWeight: '700', color: c.primary },

    planCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 16,
      marginBottom: 18,
      ...c.shadow,
    },
    planHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    planTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text },
    planSummary: {
      fontSize: 13,
      color: c.textMuted,
      lineHeight: 19,
      marginBottom: 10,
    },
    planDay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    planDayLeft: { flex: 1, paddingVertical: 2 },
    planDayName: { fontSize: 13.5, fontWeight: '700', color: c.text },
    planDayMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 2,
    },
    planDayFocus: { flex: 1, fontSize: 11.5, color: c.textMuted },
    planStart: {
      backgroundColor: c.primary,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 14,
    },
    planStartText: { color: c.onPrimary, fontWeight: '700', fontSize: 12 },
    planTips: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
      gap: 4,
    },
    planTip: { fontSize: 12, color: c.textMuted, lineHeight: 17 },
    planActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    planActionText: { fontSize: 12.5, fontWeight: '700', color: c.primary },
  });
