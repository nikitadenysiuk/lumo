// src/screens/coach/TodayTab.js — вкладка «Сегодня»: дневная карточка коуча.

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { SkeletonCard } from './Skeleton';
import { useTheme } from '../../settings/SettingsContext';
import { useT } from '../../i18n/LocaleContext';

export default function TodayTab({ card, busy, err, onRefresh, tabBarH }) {
  const c = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [refreshing, setRefreshing] = useState(false);

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

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
      {busy && !card ? (
        <View style={styles.skeletonWrap}>
          <Text style={styles.thinking}>{t('coach.thinking')}</Text>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
        </View>
      ) : err && !card ? (
        <View style={styles.centerBox}>
          <Text style={styles.errText}>{err}</Text>
          <Button
            label={t('coach.retry')}
            variant="secondary"
            onPress={onRefresh}
            fullWidth={false}
          />
        </View>
      ) : card ? (
        <>
          {!!card.summary && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryBadge}>
                <Ionicons name="partly-sunny" size={16} color={c.primary} />
              </View>
              <Text style={styles.summaryText}>{card.summary}</Text>
            </View>
          )}

          {Array.isArray(card.tips) && card.tips.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>{t('coach.tipsLabel')}</Text>
              <View style={styles.tipsCard}>
                {card.tips.map((tip, i) => (
                  <View
                    key={i}
                    style={[styles.tipRow, i > 0 && styles.tipRowDivider]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={19}
                      color={c.primary}
                      style={styles.tipIcon}
                    />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {!!card.focus && (
            <View style={styles.focusCard}>
              <Ionicons name="flag" size={16} color={c.primary} />
              <View style={styles.focusTextWrap}>
                <Text style={styles.focusLabel}>{t('coach.focus')}</Text>
                <Text style={styles.focusText}>{card.focus}</Text>
              </View>
            </View>
          )}

          <Pressable onPress={onRefresh} disabled={busy} style={styles.refreshBtn}>
            {busy ? (
              <ActivityIndicator color={c.textMuted} size="small" />
            ) : (
              <>
                <Ionicons name="refresh" size={15} color={c.textMuted} />
                <Text style={styles.refreshText}>{t('coach.refresh')}</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.disclaimer}>{t('coach.disclaimer')}</Text>
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState
            emoji="🧭"
            title={t('coach.empty_title')}
            hint={t('coach.empty_hint')}
          />
          <Button
            label={t('coach.generate')}
            onPress={onRefresh}
            fullWidth={false}
          />
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    body: { padding: 16, paddingTop: 18, flexGrow: 1 },
    centerBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
      gap: 14,
    },
    skeletonWrap: { gap: 12, paddingTop: 6 },
    thinking: { color: c.textMuted, fontSize: 13, marginLeft: 2, marginBottom: 2 },
    emptyWrap: { alignItems: 'center', gap: 4, paddingTop: 12 },
    muted: { color: c.textMuted, fontSize: 13 },
    errText: { color: c.danger, fontSize: 14, textAlign: 'center' },

    summaryCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 16,
      ...c.shadow,
    },
    summaryBadge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryText: { flex: 1, fontSize: 14.5, color: c.text, lineHeight: 21, marginTop: 3 },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: c.textMuted,
      marginTop: 22,
      marginBottom: 8,
      marginLeft: 2,
    },
    tipsCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      paddingHorizontal: 16,
      ...c.shadow,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 13,
    },
    tipRowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    tipIcon: { marginTop: 1 },
    tipText: { flex: 1, fontSize: 14.5, color: c.text, lineHeight: 20 },

    focusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.accentSoft,
      borderRadius: 16,
      padding: 16,
      marginTop: 22,
    },
    focusTextWrap: { flex: 1 },
    focusLabel: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: c.primary,
      marginBottom: 2,
    },
    focusText: { fontSize: 15, fontWeight: '700', color: c.text, lineHeight: 20 },

    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      marginTop: 12,
    },
    refreshText: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
    disclaimer: {
      fontSize: 11.5,
      color: c.textFaint,
      textAlign: 'center',
      lineHeight: 16,
      marginTop: 14,
    },
  });
