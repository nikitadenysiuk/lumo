// src/components/MacroRing.js
// Кольцо прогресса по одному макронутриенту (Б / Ж / У), с анимацией.

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '../ui/Text';
import AnimatedNumber from './AnimatedNumber';
import { useTheme } from '../settings/SettingsContext';

const ACircle = Animated.createAnimatedComponent(Circle);

export default function MacroRing({
  size = 74,
  stroke = 8,
  value = 0,
  goal = 0,
  color,
  label,
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const over = goal > 0 && value > goal;

  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(prog, {
      toValue: pct,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [pct, prog]);

  const dashoffset = prog.interpolate({
    inputRange: [0, 1],
    outputRange: [circ, 0.001],
  });

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={c.barTrack}
            strokeWidth={stroke}
            fill="none"
          />
          {pct > 0 && (
            <ACircle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={over ? c.danger : color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={circ}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </Svg>
        <View style={styles.center}>
          <AnimatedNumber value={value} style={styles.value} />
          {goal > 0 && <Text style={styles.goal}>/ {goal}</Text>}
        </View>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: { alignItems: 'center' },
    center: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    value: { fontSize: 15, fontWeight: '800', color: c.text },
    goal: { fontSize: 10, fontWeight: '600', color: c.textMuted, marginTop: -1 },
    label: { fontSize: 12, color: c.dark ? c.text : c.textMuted, marginTop: 6 },
  });
