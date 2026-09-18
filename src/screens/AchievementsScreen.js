import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Text } from '../ui/Text';

import {
  fetchRecentMeals,
  fetchWeightLog,
  fetchFavorites,
  getProfile,
} from '../services/supabaseClient';
import { totalsByDay } from '../lib/days';
import { computeAchievements } from '../lib/achievements';
import { CardsSkeleton } from '../components/Skeleton';
import Flash from '../components/Flash';
import { hSuccess } from '../lib/haptics';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import Screen from '../ui/Screen';

export default function AchievementsScreen({ navigation }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [data, setData] = useState(null);
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(null);
  const celebratedRef = useRef(false);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('ach.title') });
  }, [navigation, t]);

  const load = useCallback(async () => {
    try {
      const [meals, weights, favorites, profile] = await Promise.all([
        fetchRecentMeals(180),
        fetchWeightLog(180),
        fetchFavorites(),
        getProfile().catch(() => null),
      ]);
      setData({
        meals: meals ?? [],
        weights: weights ?? [],
        favorites: favorites ?? [],
        byDay: totalsByDay(meals ?? []),
        goalKcal: profile?.daily_kcal_goal ?? null,
      });
    } catch (e) {
      console.warn('achievements load', e?.message);
      setData({ meals: [], weights: [], favorites: [], byDay: {}, goalKcal: null });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // поздравить с только что открытыми достижениями
  useEffect(() => {
    if (!data || celebratedRef.current) return;
    celebratedRef.current = true;
    const badges = computeAchievements(data, t);
    (async () => {
      let stored = {};
      try {
        const raw = await SecureStore.getItemAsync('ach_tiers_v1');
        stored = raw ? JSON.parse(raw) : {};
      } catch (e) {
        stored = {};
      }
      const firstRun = Object.keys(stored).length === 0;
      const now = {};
      const unlocked = [];
      for (const b of badges) {
        now[b.id] = b.tier;
        if (!firstRun && b.tier > (stored[b.id] || 0)) unlocked.push(b);
      }
      SecureStore.setItemAsync('ach_tiers_v1', JSON.stringify(now)).catch(
        () => {}
      );
      if (unlocked.length) {
        hSuccess();
        setFlash(
          unlocked.length === 1
            ? `🏆 ${unlocked[0].title}`
            : `🏆 ${t('ach.unlockedN', { n: unlocked.length })}`
        );
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 3000);
      }
    })();
  }, [data, t]);

  if (!data) {
    return (
      <Screen>
        <CardsSkeleton cards={6} height={76} />
      </Screen>
    );
  }

  const badges = computeAchievements(data, t);
  const earned = badges.filter((b) => b.tier > 0).length;

  return (
    <Screen>
    <Flash message={flash} />
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.summary}>
        {t('ach.earned', { n: earned, total: badges.length })}
      </Text>

      {badges.map((b) => (
        <View key={b.id} style={[styles.card, b.tier === 0 && styles.cardDim]}>
          <Text style={styles.emoji}>{b.emoji}</Text>
          <View style={styles.body}>
            <View style={styles.rowTop}>
              <Text style={styles.title}>{b.title}</Text>
              <Text style={styles.tier}>
                {b.maxTier > 1
                  ? t('ach.tier', { n: b.tier, max: b.maxTier })
                  : b.done
                  ? '✓'
                  : ''}
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[styles.fill, { width: `${Math.round(b.progress * 100)}%` }]}
              />
            </View>
            <Text style={styles.meta}>
              {b.value} / {b.target}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 40 },
    summary: {
      fontSize: 14,
      fontWeight: '700',
      color: c.textMuted,
      marginBottom: 12,
      textAlign: 'center',
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    cardDim: { opacity: 0.55 },
    emoji: { fontSize: 30, marginRight: 14 },
    body: { flex: 1 },
    rowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { fontSize: 15, fontWeight: '700', color: c.text, flex: 1 },
    tier: { fontSize: 12, fontWeight: '700', color: c.primary },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.barTrack,
      overflow: 'hidden',
      marginTop: 8,
    },
    fill: { height: 6, borderRadius: 3, backgroundColor: c.primary },
    meta: { fontSize: 11, color: c.textMuted, marginTop: 4 },
  });
