// src/screens/coach/TipCard.js
//
// Карточка ИИ-совета. Каждый вид совета отличается иконкой-бейджем и цветом
// (tint): тренировки — синий, добавки — бирюзовый и т.п.
// tip: { headline, summary, tips: string[] }

import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../../ui/Text';
import { withAlpha } from '../../theme/palettes';
import { useTheme } from '../../settings/SettingsContext';
import { useT } from '../../i18n/LocaleContext';

export default function TipCard({
  kicker,
  icon = 'sparkles',
  tint,
  tip,
  busy,
  err,
  onRefresh,
  note,
  loadingText,
}) {
  const c = useTheme();
  const { t } = useT();
  const accent = tint || c.primary;
  const styles = useMemo(() => makeStyles(c, accent), [c, accent]);

  const Badge = (
    <View style={styles.badge}>
      <Ionicons name={icon} size={16} color={accent} />
    </View>
  );

  if (busy && !tip) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={accent} size="small" />
        {!!loadingText && <Text style={styles.loadingText}>{loadingText}</Text>}
      </View>
    );
  }

  if (err && !tip) {
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          {Badge}
          <Text style={styles.kicker}>{kicker}</Text>
        </View>
        <Text style={styles.errText}>{err}</Text>
        <Pressable onPress={onRefresh} style={styles.refresh}>
          <Ionicons name="refresh" size={13} color={accent} />
          <Text style={styles.retryText}>{t('coach.retry')}</Text>
        </Pressable>
      </View>
    );
  }
  if (!tip) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        {Badge}
        <Text style={styles.kicker}>{kicker}</Text>
      </View>
      <Text style={styles.headline}>{tip.headline}</Text>
      {!!tip.summary && <Text style={styles.summary}>{tip.summary}</Text>}

      {(tip.tips || []).map((tp, i) => (
        <View key={i} style={styles.tipRow}>
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={accent}
            style={styles.tipIcon}
          />
          <Text style={styles.tipText}>{tp}</Text>
        </View>
      ))}

      {!!note && <Text style={styles.note}>{note}</Text>}

      <Pressable onPress={onRefresh} disabled={busy} style={styles.refresh}>
        {busy ? (
          <ActivityIndicator color={c.textMuted} size="small" />
        ) : (
          <>
            <Ionicons name="refresh" size={13} color={c.textMuted} />
            <Text style={styles.refreshText}>{t('coach.refresh')}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (c, accent) =>
  StyleSheet.create({
    loading: {
      alignItems: 'center',
      gap: 10,
      paddingVertical: 24,
      marginBottom: 6,
    },
    loadingText: { color: c.textMuted, fontSize: 13 },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 16,
      marginBottom: 18,
      ...c.shadow,
    },
    badge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: withAlpha(accent, c.dark ? 0.22 : 0.13),
      alignItems: 'center',
      justifyContent: 'center',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginBottom: 10,
    },
    kicker: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: accent,
    },
    headline: { fontSize: 16, fontWeight: '800', color: c.text, lineHeight: 21 },
    errText: { fontSize: 13.5, color: c.textMuted, lineHeight: 19, marginTop: 4 },
    retryText: { fontSize: 13, color: accent, fontWeight: '700' },
    summary: {
      fontSize: 13.5,
      color: c.textMuted,
      lineHeight: 20,
      marginTop: 6,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 10,
    },
    tipIcon: { marginTop: 1 },
    tipText: { flex: 1, fontSize: 13.5, color: c.text, lineHeight: 19 },
    note: { fontSize: 11, color: c.textFaint, lineHeight: 15, marginTop: 12 },
    refresh: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      marginTop: 8,
    },
    refreshText: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
  });
