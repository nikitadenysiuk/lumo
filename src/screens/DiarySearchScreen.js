import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

import { fetchRecentMeals, addMealFromPayload } from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { dayKey } from '../lib/days';
import { groupNum } from '../lib/format';
import { guessMealType } from '../lib/meals';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { useSelectedDay } from '../state/SelectedDayContext';
import { hSuccess } from '../lib/haptics';
import { findRecentDup, confirmDup } from '../lib/dupGuard';
import Screen from '../ui/Screen';
import EmptyState from '../components/EmptyState';

const DAYS = 90;

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DiarySearchScreen({ navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { todayKey } = useSelectedDay();

  const [meals, setMeals] = useState(null);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchRecentMeals(DAYS)
        .then((d) => alive && setMeals(d ?? []))
        .catch((e) => {
          console.warn('diary search', e?.message);
          if (alive) setMeals([]);
        });
      return () => {
        alive = false;
      };
    }, [])
  );

  const query = q.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!meals || query.length < 2) return [];
    return meals.filter((m) =>
      (m.food_name || '').toLowerCase().includes(query)
    );
  }, [meals, query]);

  const stats = useMemo(() => {
    if (!matches.length) return null;
    const total = matches.reduce((s, m) => s + (m.calories || 0), 0);
    return {
      n: matches.length,
      total,
      avg: Math.round(total / matches.length),
    };
  }, [matches]);

  const sections = useMemo(() => {
    const g = {};
    for (const m of matches) {
      const k = dayKey(m.created_at);
      (g[k] = g[k] || []).push(m);
    }
    return Object.keys(g)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((k) => ({
        key: k,
        title: new Date(k).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        data: g[k].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      }));
  }, [matches, locale]);

  async function repeat(m) {
    if (busyId) return;
    if (
      findRecentDup(meals, m.food_name, m.calories) &&
      !(await confirmDup())
    ) {
      return;
    }
    setBusyId(m.id);
    try {
      await addMealFromPayload(m, {
        dateKey: todayKey,
        isToday: true,
        mealType: m.meal_type || guessMealType(new Date()),
      });
      hSuccess();
      navigation.navigate('Main', { screen: 'HistoryTab' });
    } catch (e) {
      Alert.alert(t('nav.diarySearch'), toUserMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder={t('dsearch.placeholder')}
            placeholderTextColor={c.textFaint}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Text style={styles.clearX}>✕</Text>
            </Pressable>
          )}
        </View>

        {meals === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : query.length < 2 ? (
          <Text style={styles.hint}>{t('dsearch.hint')}</Text>
        ) : matches.length === 0 ? (
          <EmptyState art="search" title={t('dsearch.none', { q: q.trim() })} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            ListHeaderComponent={
              stats ? (
                <Text style={styles.stats}>
                  {t('dsearch.stats', {
                    n: stats.n,
                    total: groupNum(stats.total),
                    avg: groupNum(stats.avg),
                  })}
                </Text>
              ) : null
            }
            renderSectionHeader={({ section }) => (
              <Text style={styles.secTitle}>{section.title}</Text>
            )}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => navigation.navigate('MealDetail', { meal: item })}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.food_name}
                  </Text>
                  <Text style={styles.rowSub}>
                    {fmtTime(item.created_at)} ·{' '}
                    {t('res.macros', {
                      p: Math.round(Number(item.protein_g) || 0),
                      f: Math.round(Number(item.fat_g) || 0),
                      c: Math.round(Number(item.carbs_g) || 0),
                    })}
                  </Text>
                </View>
                <Text style={styles.rowKcal}>
                  {groupNum(item.calories)} {t('home.kcalShort')}
                </Text>
                <Pressable
                  onPress={() => repeat(item)}
                  hitSlop={10}
                  style={styles.repeat}
                  disabled={!!busyId}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator size="small" color={c.primary} />
                  ) : (
                    <Text style={styles.repeatText}>↻</Text>
                  )}
                </Pressable>
              </Pressable>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    center: { paddingTop: 40, alignItems: 'center' },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: c.inputBg,
    },
    input: { flex: 1, paddingVertical: 12, fontSize: 16, color: c.text },
    clearX: { color: c.textFaint, fontSize: 16, padding: 4 },
    hint: { color: c.textFaint, textAlign: 'center', marginTop: 30, fontSize: 13 },
    list: { paddingHorizontal: 16, paddingBottom: 32 },
    stats: {
      fontSize: 12,
      fontWeight: '700',
      color: c.primary,
      textAlign: 'center',
      marginBottom: 10,
    },
    secTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: c.textMuted,
      marginTop: 14,
      marginBottom: 2,
      textTransform: 'capitalize',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
    rowText: { flex: 1, marginRight: 10 },
    rowName: { fontSize: 15, fontWeight: '600', color: c.text },
    rowSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    rowKcal: { fontSize: 15, fontWeight: '700', color: c.primary },
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
  });
