// src/screens/coach/Skeleton.js — карточки-заглушки на время загрузки данных.

import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useTheme } from '../../settings/SettingsContext';

function Bar({ w, h = 12, op, c }) {
  return (
    <Animated.View
      style={{
        opacity: op,
        width: w,
        height: h,
        borderRadius: 6,
        backgroundColor: c.cardBorder,
      }}
    />
  );
}

export function SkeletonCard({ lines = 3, style }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const op = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [op]);

  return (
    <View style={[styles.card, style]}>
      <Bar w="55%" h={14} op={op} c={c} />
      {Array.from({ length: lines }).map((_, i) => (
        <Bar
          key={i}
          w={i === lines - 1 ? '70%' : '100%'}
          op={op}
          c={c}
        />
      ))}
    </View>
  );
}

export function SkeletonList({ count = 2, lines = 3 }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 16,
      gap: 10,
      ...c.shadow,
    },
  });
