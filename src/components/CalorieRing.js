// src/components/CalorieRing.js — большое кольцо калорий за день (с анимацией).

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '../settings/SettingsContext';

const ACircle = Animated.createAnimatedComponent(Circle);

export default function CalorieRing({
  size = 190,
  stroke = 13,
  value = 0,
  goal = 0,
  children,
}) {
  const c = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? value / goal : 0;
  const over = pct > 1;
  const shown = Math.max(0, Math.min(1, pct));
  const half = size / 2;

  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(prog, {
      toValue: shown,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [shown, prog]);

  const dashoffset = prog.interpolate({
    inputRange: [0, 1],
    outputRange: [circ, 0.001],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="calGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.primaryLight || '#FF9F6B'} />
            <Stop offset="1" stopColor={c.primaryDark} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={half}
          cy={half}
          r={r}
          stroke={c.barTrack}
          strokeWidth={stroke}
          fill="none"
        />
        {pct > 0 && (
          <ACircle
            cx={half}
            cy={half}
            r={r}
            stroke={over ? c.danger : 'url(#calGrad)'}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${half} ${half})`}
          />
        )}
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
