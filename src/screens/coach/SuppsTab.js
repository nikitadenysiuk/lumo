// src/screens/coach/SuppsTab.js — вкладка «Добавки».

import { useEffect, useMemo, useState } from 'react';
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
import { withAlpha } from '../../theme/palettes';
import {
  isDueOn,
  isSlotTaken,
  progressForDay,
  scheduleSummary,
  slotsOf,
} from '../../lib/supplements';
import { useTheme, useSettings } from '../../settings/SettingsContext';
import { useT } from '../../i18n/LocaleContext';

function Progress({ supps, log, t, c, styles }) {
  const { taken, total } = progressForDay(supps, log, new Date());
  if (total === 0) return null;
  const pct = Math.round((taken / total) * 100);
  const done = taken >= total;
  return (
    <View style={styles.progCard}>
      <View style={styles.progTop}>
        <Text style={styles.progText}>
          {done ? t('supp.allDone') : t('supp.progressToday', { taken, total })}
        </Text>
        <Ionicons
          name={done ? 'checkmark-circle' : 'flask'}
          size={18}
          color={c.primary}
        />
      </View>
      <View style={styles.progTrack}>
        <View style={[styles.progFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function SuppCard({ supp, log, onToggle, onEdit, t, locale, c, styles }) {
  const due = isDueOn(supp, new Date());
  return (
    <View style={styles.suppCard}>
      <Pressable style={styles.suppHead} onPress={onEdit}>
        <View style={styles.suppHeadText}>
          <Text style={styles.suppName}>
            {supp.name}
            {supp.dose ? <Text style={styles.suppDose}>  {supp.dose}</Text> : null}
          </Text>
          <Text style={styles.suppSched}>{scheduleSummary(supp, t, locale)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
      </Pressable>
      <View style={styles.slotRow}>
        {slotsOf(supp).map((slot) => {
          const taken = isSlotTaken(log, supp.id, slot);
          return (
            <Pressable
              key={slot || 'anytime'}
              onPress={() => onToggle(supp, slot)}
              style={[styles.slot, taken && styles.slotOn, !due && styles.slotDim]}
            >
              <Ionicons
                name={taken ? 'checkmark-circle' : 'ellipse-outline'}
                size={15}
                color={taken ? c.onPrimary : c.textMuted}
              />
              <Text style={[styles.slotText, taken && styles.slotTextOn]}>
                {slot || t('supp.take')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function RecoCard({ reco, onAdd, onRedo, onHide, tintReco, t, c, styles }) {
  return (
    <View style={styles.recoCard}>
      <View style={styles.recoHead}>
        <View style={styles.recoBadge}>
          <Ionicons name="bulb" size={16} color={tintReco} />
        </View>
        <Text style={styles.recoKicker}>{t('reco.cardKicker')}</Text>
      </View>
      {!!reco.intro && <Text style={styles.recoIntro}>{reco.intro}</Text>}

      {(reco.items || []).map((it, i) => (
        <View key={i} style={styles.recoItem}>
          <View style={styles.recoItemBody}>
            <Text style={styles.recoName}>
              {it.name}
              {it.dose ? <Text style={styles.recoDose}>  {it.dose}</Text> : null}
            </Text>
            {!!it.timing && <Text style={styles.recoMeta}>{it.timing}</Text>}
            {!!it.why && <Text style={styles.recoWhy}>{it.why}</Text>}
          </View>
          <Pressable style={styles.recoAdd} onPress={() => onAdd(it)}>
            <Ionicons name="add" size={16} color="#fff" />
          </Pressable>
        </View>
      ))}

      <Text style={styles.recoNote}>{t('supp.tipDisclaimer')}</Text>
      <View style={styles.recoActions}>
        <Pressable onPress={onRedo} hitSlop={6}>
          <Text style={styles.recoActionText}>{t('reco.redo')}</Text>
        </Pressable>
        <Pressable onPress={onHide} hitSlop={6}>
          <Text style={styles.recoActionText}>{t('reco.hide')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SuppsTab({
  supps,
  suppLog,
  suppTip,
  suppTipBusy,
  suppTipErr,
  suppReco,
  onLoad,
  onToggleSlot,
  onRefreshTip,
  onHideReco,
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

  const goEdit = (params) => navigation.navigate('SupplementEdit', params);
  const addFromReco = (it) =>
    goEdit({ preset: { name: it.name, dose: it.dose, note: it.timing } });

  // прячем из рекомендаций то, что уже добавлено в список
  const recoItems = useMemo(() => {
    const norm = (s) => String(s || '').trim().toLowerCase();
    const owned = (supps || []).map((s) => norm(s.name)).filter(Boolean);
    const has = (name) => {
      const b = norm(name);
      return owned.some(
        (a) =>
          a === b ||
          (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a)))
      );
    };
    return (suppReco?.items || []).filter((it) => !has(it.name));
  }, [suppReco, supps]);

  const showReco = !!suppReco && recoItems.length > 0;

  // все рекомендации добавлены — очищаем сохранённый список
  useEffect(() => {
    if (suppReco && recoItems.length === 0) onHideReco();
  }, [suppReco, recoItems.length, onHideReco]);

  const recoBlock = showReco ? (
    <RecoCard
      reco={{ ...suppReco, items: recoItems }}
      onAdd={addFromReco}
      onRedo={() => navigation.navigate('SupplementReco')}
      onHide={onHideReco}
      tintReco={tints.reco}
      t={t}
      c={c}
      styles={styles}
    />
  ) : (
    <Pressable
      style={styles.planCta}
      onPress={() => navigation.navigate('SupplementReco')}
    >
      <Ionicons name="sparkles" size={16} color={c.primary} />
      <Text style={styles.planCtaText}>
        {suppReco ? t('reco.redo') : t('reco.buildBtn')}
      </Text>
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
      {supps == null ? (
        <SkeletonList count={3} lines={2} />
      ) : supps.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.suppEmpty}>
            <EmptyState
              emoji="💊"
              title={t('supp.empty_title')}
              hint={t('supp.empty_hint')}
            />
            <Button
              label={t('supp.addBtn')}
              icon="add"
              onPress={() => goEdit()}
              fullWidth={false}
            />
          </View>
          {recoBlock}
        </View>
      ) : (
        <>
          <Progress supps={supps} log={suppLog} t={t} c={c} styles={styles} />
          {supps.map((s) => (
            <SuppCard
              key={s.id}
              supp={s}
              log={suppLog}
              onToggle={onToggleSlot}
              onEdit={() => goEdit({ supplement: s })}
              t={t}
              locale={locale}
              c={c}
              styles={styles}
            />
          ))}
          <Pressable style={styles.addRow} onPress={() => goEdit()}>
            <Ionicons name="add-circle-outline" size={20} color={c.primary} />
            <Text style={styles.addRowText}>{t('supp.addBtn')}</Text>
          </Pressable>
          <Text style={styles.disclaimer}>{t('supp.reminderNote')}</Text>

          <View style={styles.divider} />

          <TipCard
            kicker={t('supp.tipKicker')}
            icon="nutrition"
            tint={tints.supp}
            tip={suppTip}
            busy={suppTipBusy}
            err={suppTipErr}
            onRefresh={onRefreshTip}
            note={suppTip ? t('supp.tipDisclaimer') : null}
            loadingText={t('supp.tipThinking')}
          />
          {recoBlock}
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
    disclaimer: {
      fontSize: 11.5,
      color: c.textFaint,
      textAlign: 'center',
      lineHeight: 16,
      marginTop: 14,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.divider,
      marginTop: 10,
      marginBottom: 20,
    },

    progCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 16,
      marginBottom: 14,
      ...c.shadow,
    },
    progTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    progText: { fontSize: 14, fontWeight: '700', color: c.text },
    progTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.barTrack,
      overflow: 'hidden',
    },
    progFill: { height: 6, borderRadius: 3, backgroundColor: c.primary },

    suppCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 14,
      marginBottom: 10,
      ...c.shadow,
    },
    suppHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    suppHeadText: { flex: 1 },
    suppName: { fontSize: 15, fontWeight: '700', color: c.text },
    suppDose: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    suppSched: { fontSize: 12, color: c.textMuted, marginTop: 3 },

    slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
    slot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 11,
    },
    slotOn: { backgroundColor: c.primary, borderColor: c.primary },
    slotDim: { opacity: 0.55 },
    slotText: { fontSize: 12.5, fontWeight: '700', color: c.textMuted },
    slotTextOn: { color: c.onPrimary },

    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 14,
      marginTop: 4,
    },
    addRowText: { fontSize: 14, fontWeight: '700', color: c.primary },

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

    recoCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 16,
      marginBottom: 18,
      ...c.shadow,
    },
    recoHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginBottom: 8,
    },
    recoBadge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: withAlpha(tints.reco, c.dark ? 0.22 : 0.13),
      alignItems: 'center',
      justifyContent: 'center',
    },
    recoKicker: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: tints.reco,
    },
    recoIntro: { fontSize: 13.5, color: c.textMuted, lineHeight: 20 },
    recoItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
      marginTop: 6,
    },
    recoItemBody: { flex: 1 },
    recoName: { fontSize: 14, fontWeight: '700', color: c.text },
    recoDose: { fontSize: 12.5, fontWeight: '600', color: c.textMuted },
    recoMeta: { fontSize: 12, color: tints.reco, marginTop: 2 },
    recoWhy: { fontSize: 12.5, color: c.textMuted, marginTop: 3, lineHeight: 17 },
    recoAdd: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: tints.reco,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    recoNote: { fontSize: 11, color: c.textFaint, lineHeight: 15, marginTop: 12 },
    recoActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    recoActionText: { fontSize: 12.5, fontWeight: '700', color: tints.reco },
  });
