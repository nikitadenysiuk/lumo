import {
  useCallback,
  useMemo,
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
import { TextInput } from '../ui/TextInput';

import {
  fetchWeightLog,
  logWeight,
  deleteWeightEntry,
  getProfile,
} from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { dayKey } from '../lib/days';
import { useT } from '../i18n/LocaleContext';
import { useTheme, useSettings } from '../settings/SettingsContext';
import Screen from '../ui/Screen';
import Button from '../ui/Button';

const LB = 2.2046226;
const CHART_N = 14;

export default function WeightScreen() {
  const { t, locale } = useT();
  const c = useTheme();
  const { units } = useSettings();
  const imperial = units === 'imperial';
  const styles = useMemo(() => makeStyles(c), [c]);

  const [rows, setRows] = useState([]);
  const [targetKg, setTargetKg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const unit = imperial ? t('weight.lb') : t('onb.kg');
  const toView = (kg) =>
    imperial ? Math.round(kg * LB * 10) / 10 : Math.round(kg * 10) / 10;
  const toKg = (v) => (imperial ? v / LB : v);

  const load = useCallback(async () => {
    try {
      const [data, profile] = await Promise.all([
        fetchWeightLog(),
        getProfile().catch(() => null),
      ]);
      setRows(data);
      setTargetKg(profile?.target_weight_kg ?? null);
      if (data.length && !input) {
        setInput(String(toView(Number(data[data.length - 1].weight_kg))));
      }
    } catch (e) {
      console.warn('weight load', e?.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function save() {
    const v = parseFloat(String(input).replace(',', '.'));
    if (!v || v <= 0) return Alert.alert(t('weight.title'), t('weight.badValue'));
    const kg = toKg(v);
    if (kg < 20 || kg > 400) {
      return Alert.alert(t('weight.title'), t('weight.badValue'));
    }
    setBusy(true);
    try {
      await logWeight(Math.round(kg * 10) / 10, dayKey(new Date()));
      await load();
    } catch (e) {
      Alert.alert(t('weight.title'), toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(row) {
    Alert.alert(t('weight.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setRows((r) => r.filter((x) => x.id !== row.id));
          try {
            await deleteWeightEntry(row.id);
          } catch (e) {
            console.warn('weight delete', e?.message);
            load();
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </Screen>
    );
  }

  const values = rows.map((r) => Number(r.weight_kg));
  const first = values[0];
  const last = values[values.length - 1];
  const delta = values.length >= 2 ? last - first : 0;
  const deltaView = Math.round(Math.abs(toView(last) - toView(first)) * 10) / 10;

  const chart = rows.slice(-CHART_N);
  const cvals = chart.map((r) => Number(r.weight_kg));
  const lo = Math.min(...cvals);
  const hi = Math.max(...cvals);
  const span = hi - lo || 1;

  // Прогресс к целевому весу: 0 в начале пути, 1 — цель достигнута.
  let targetPct = null;
  let toGo = 0;
  if (targetKg != null && values.length) {
    const startRef = first ?? last;
    const total = Math.abs(startRef - targetKg);
    const done = Math.abs(startRef - last);
    targetPct = total > 0.1 ? Math.max(0, Math.min(1, done / total)) : 1;
    toGo = Math.round(Math.abs(last - targetKg) * (imperial ? LB : 1) * 10) / 10;
  }

  return (
    <Screen>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        {values.length ? (
          <>
            <Text style={styles.current}>
              {toView(last)}
              <Text style={styles.unit}> {unit}</Text>
            </Text>
            {values.length >= 2 && (
              <Text
                style={[
                  styles.delta,
                  { color: delta > 0 ? c.danger : delta < 0 ? '#22c55e' : c.textMuted },
                ]}
              >
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {deltaView} {unit}{' '}
                {t('weight.sinceStart')}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.empty}>{t('weight.empty')}</Text>
        )}

        {targetPct != null && (
          <View style={styles.targetBox}>
            <View style={styles.targetTrack}>
              <View
                style={[styles.targetFill, { width: `${Math.round(targetPct * 100)}%` }]}
              />
            </View>
            <Text style={styles.targetText}>
              {t('goals.targetWeight')}: {toView(targetKg)} {unit}
              {toGo > 0 ? ` · ${t('weight.toGo', { n: toGo, u: unit })}` : ` · ✓`}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          keyboardType="decimal-pad"
          placeholder={unit}
          placeholderTextColor={c.textFaint}
        />
        <Button
          label={t('weight.add')}
          loading={busy}
          onPress={save}
          fullWidth={false}
          style={styles.saveBtn}
        />
      </View>

      {chart.length >= 2 && (
        <View style={styles.card}>
          <View style={styles.chart}>
            {chart.map((r) => {
              const val = Number(r.weight_kg);
              const h = 12 + ((val - lo) / span) * 72;
              return (
                <View key={r.id} style={styles.chartCol}>
                  <View style={[styles.chartBar, { height: h }]} />
                </View>
              );
            })}
          </View>
          <View style={styles.chartScale}>
            <Text style={styles.scaleText}>{toView(lo)}</Text>
            <Text style={styles.scaleText}>{toView(hi)}</Text>
          </View>
        </View>
      )}

      {rows.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.histLabel}>{t('weight.history')}</Text>
          {[...rows].reverse().map((r) => (
            <View key={r.id} style={styles.histRow}>
              <Text style={styles.histDate}>
                {new Date(r.logged_on).toLocaleDateString(locale, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <Text style={styles.histVal}>
                {toView(Number(r.weight_kg))} {unit}
              </Text>
              <Pressable onPress={() => confirmDelete(r)} hitSlop={10}>
                <Text style={styles.histX}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
    </Screen>
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
    hero: {
      backgroundColor: c.accentSoft,
      borderRadius: 16,
      padding: 22,
      alignItems: 'center',
    },
    current: { fontSize: 40, fontWeight: '800', color: c.primary },
    unit: { fontSize: 16, fontWeight: '600', color: c.textMuted },
    delta: { fontSize: 13, fontWeight: '600', marginTop: 6 },
    empty: { fontSize: 14, color: c.textMuted },
    targetBox: { width: '100%', marginTop: 14 },
    targetTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.barTrack,
      overflow: 'hidden',
    },
    targetFill: { height: 8, borderRadius: 4, backgroundColor: c.primary },
    targetText: {
      fontSize: 12,
      color: c.dark ? c.text : c.textMuted,
      marginTop: 6,
      textAlign: 'center',
    },
    addRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.inputBg,
    },
    saveBtn: { justifyContent: 'center' },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 14,
      marginTop: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: 90,
    },
    chartCol: { flex: 1, alignItems: 'center' },
    chartBar: {
      width: 8,
      borderRadius: 3,
      backgroundColor: c.primary,
    },
    chartScale: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    scaleText: { fontSize: 10, color: c.textFaint },
    histLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      marginBottom: 6,
    },
    histRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    histDate: { flex: 1, fontSize: 14, color: c.text },
    histVal: { fontSize: 14, fontWeight: '700', color: c.text, marginRight: 14 },
    histX: { fontSize: 14, color: c.textFaint },
  });
