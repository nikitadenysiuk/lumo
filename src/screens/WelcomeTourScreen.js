// src/screens/WelcomeTourScreen.js
//
// Быстрый гид по главным разделам для нового аккаунта. Показывается один раз,
// сразу после онбординга (см. ProfileGate в App.js). Свайп + кнопка «Далее».

import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../ui/Text';
import Button from '../ui/Button';
import Screen from '../ui/Screen';
import { withAlpha } from '../theme/palettes';
import { useTheme } from '../settings/SettingsContext';
import { useT } from '../i18n/LocaleContext';

const SLIDES = ['photo', 'coach', 'home', 'diary', 'profile'];

function Art({ kind, c, t, styles }) {
  if (kind === 'photo') {
    return (
      <View style={styles.artCard}>
        <View style={styles.bigPill}>
          <Ionicons name="camera" size={20} color={c.onPrimary} />
          <Text style={styles.bigPillText}>{t('nav.tabPhoto')}</Text>
        </View>
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Ionicons name="camera-outline" size={15} color={c.primary} />
            <Text style={styles.chipText}>{t('tour.photo_snap')}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="image-outline" size={15} color={c.primary} />
            <Text style={styles.chipText}>{t('tour.photo_upload')}</Text>
          </View>
        </View>
      </View>
    );
  }
  if (kind === 'coach') {
    return (
      <View style={styles.artCard}>
        <View style={styles.bigPill}>
          <Ionicons name="barbell" size={20} color={c.onPrimary} />
          <Text style={styles.bigPillText}>{t('nav.tabCoach')}</Text>
        </View>
        <View style={styles.miniRows}>
          {['sparkles', 'nutrition', 'chatbubble-ellipses'].map((ic) => (
            <View key={ic} style={styles.miniRow}>
              <Ionicons name={ic} size={14} color={c.primary} />
              <View style={styles.miniBar} />
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (kind === 'home') {
    return (
      <View style={styles.artCard}>
        <View style={styles.ringTrack}>
          <Ionicons name="flame" size={26} color={c.primary} />
          <Text style={styles.ringText}>1 850</Text>
        </View>
        <View style={styles.trackRow}>
          <View style={styles.trackBar}>
            <View style={styles.trackFill} />
          </View>
          <Text style={styles.ringSub}>2 100</Text>
        </View>
      </View>
    );
  }
  if (kind === 'diary') {
    return (
      <View style={styles.artCard}>
        <Ionicons name="book" size={30} color={c.primary} />
        <View style={styles.miniRows}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.miniRow}>
              <View style={[styles.dot, { backgroundColor: c.primary }]} />
              <View style={styles.miniBar} />
            </View>
          ))}
        </View>
      </View>
    );
  }
  // profile
  return (
    <View style={styles.artCard}>
      <Ionicons name="person-circle" size={34} color={c.primary} />
      <View style={styles.chipRow}>
        {['color-palette-outline', 'language-outline', 'notifications-outline'].map(
          (ic) => (
            <View key={ic} style={[styles.chip, styles.chipIconOnly]}>
              <Ionicons name={ic} size={16} color={c.primary} />
            </View>
          )
        )}
      </View>
    </View>
  );
}

export default function WelcomeTourScreen({ onDone }) {
  const c = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c, width), [c, width]);

  const listRef = useRef(null);
  const [i, setI] = useState(0);
  const last = i >= SLIDES.length - 1;

  const goTo = (n) => {
    listRef.current?.scrollToOffset({ offset: n * width, animated: true });
    setI(n);
  };
  const next = () => {
    if (last) onDone();
    else goTo(i + 1);
  };

  return (
    <Screen>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, n) => (
            <View
              key={s}
              style={[styles.dot2, n === i && styles.dot2On]}
            />
          ))}
        </View>
        {!last ? (
          <Pressable onPress={onDone} hitSlop={10}>
            <Text style={styles.skip}>{t('tour.skip')}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s}
        style={styles.list}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setI(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Art kind={item} c={c} t={t} styles={styles} />
            <Text style={styles.kicker}>{t('tour.kicker')}</Text>
            <Text style={styles.title}>{t(`tour.${item}_title`)}</Text>
            <Text style={styles.body}>{t(`tour.${item}_body`)}</Text>
          </View>
        )}
      />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          label={last ? t('tour.start') : t('tour.next')}
          onPress={next}
          size="lg"
        />
      </View>
    </Screen>
  );
}

const makeStyles = (c, width) =>
  StyleSheet.create({
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    dots: { flexDirection: 'row', gap: 6 },
    dot2: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: c.divider,
    },
    dot2On: { backgroundColor: c.primary, width: 20 },
    skip: { fontSize: 14, fontWeight: '700', color: c.textMuted, width: 60, textAlign: 'right' },

    list: { flex: 1 },
    slide: {
      width,
      paddingHorizontal: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kicker: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: c.primary,
      marginTop: 34,
      marginBottom: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: c.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    body: {
      fontSize: 15,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },

    artCard: {
      width: Math.min(width - 56, 300),
      minHeight: 150,
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 20,
      ...c.shadow,
    },
    bigPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    bigPillText: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      gap: 5,
      backgroundColor: c.accentSoft,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 11,
    },
    chipIconOnly: { paddingHorizontal: 10 },
    chipText: { fontSize: 12, fontWeight: '700', color: c.primary },

    miniRows: { gap: 9, alignSelf: 'stretch', paddingHorizontal: 10 },
    miniRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    miniBar: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: withAlpha(c.primary, c.dark ? 0.22 : 0.13),
    },
    dot: { width: 8, height: 8, borderRadius: 4 },

    ringTrack: {
      width: 108,
      height: 108,
      borderRadius: 54,
      borderWidth: 8,
      borderColor: withAlpha(c.primary, c.dark ? 0.3 : 0.18),
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    ringText: { fontSize: 20, fontWeight: '800', color: c.text },
    ringSub: { fontSize: 12, color: c.textMuted, fontWeight: '700' },
    trackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', paddingHorizontal: 8 },
    trackBar: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.barTrack,
      overflow: 'hidden',
    },
    trackFill: {
      width: '78%',
      height: 6,
      borderRadius: 3,
      backgroundColor: c.primary,
    },

    bottom: { paddingHorizontal: 24, paddingTop: 8 },
  });
