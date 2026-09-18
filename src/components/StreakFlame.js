// src/components/StreakFlame.js — «огонёк» стрика с лёгкой пульсацией.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Text } from '../ui/Text';
import { useTheme } from '../settings/SettingsContext';

export default function StreakFlame({ n, label }) {
  const s = useRef(new Animated.Value(0)).current;
  const c = useTheme();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(s, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(s, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [s]);

  const scale = s.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const rotate = s.interpolate({
    inputRange: [0, 1],
    outputRange: ['-6deg', '6deg'],
  });

  return (
    <View style={styles.row}>
      <Animated.Text
        style={[styles.fire, { transform: [{ scale }, { rotate }] }]}
      >
        🔥
      </Animated.Text>
      <Text style={[styles.txt, { color: c.primary }]}>
        {n} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fire: { fontSize: 13 },
  txt: { fontSize: 12, fontWeight: '800' },
});
