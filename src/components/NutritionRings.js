// src/components/NutritionRings.js
// Вложенные кольца в стиле Apple Watch: калории (внешнее) + Б / Ж / У.

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Text } from '../ui/Text';
import AnimatedNumber from './AnimatedNumber';
import { groupNum } from '../lib/format';
import { MACRO_COLORS } from '../theme/palettes';
import { useTheme } from '../settings/SettingsContext';

const ACircle = Animated.createAnimatedComponent(Circle);
const GAP = 6;

function Ring({ cx, r, stroke, color, pct, over, track, delay = 0 }) {
  const circ = 2 * Math.PI * r;
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(prog, {
      toValue: Math.min(1, pct),
      duration: 800,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [pct, prog, delay]);
  const offset = prog.interpolate({ inputRange: [0, 1], outputRange: [circ, 0.001] });
  return (
    <>
      <Circle cx={cx} cy={cx} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      {pct > 0 && (
        <ACircle
          cx={cx}
          cy={cx}
          r={r}
          stroke={over ? '#EF4444' : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      )}
    </>
  );
}

export default function NutritionRings({
  size = 208,
  kcal = 0,
  kcalGoal = 0,
  protein = 0,
  proteinGoal = 0,
  fat = 0,
  fatGoal = 0,
  carbs = 0,
  carbsGoal = 0,
  children,
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const cx = size / 2;

  const kStroke = 14;
  const mStroke = 9;
  const r0 = (size - kStroke) / 2;
  const r1 = r0 - (kStroke / 2 + GAP + mStroke / 2);
  const r2 = r1 - (mStroke + GAP);
  const r3 = r2 - (mStroke + GAP);

  const p = (v, g) => (g > 0 ? v / g : 0);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="nrKcal" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.primaryLight || '#FF9F6B'} />
            <Stop offset="1" stopColor={c.primaryDark} />
          </LinearGradient>
        </Defs>
        <Ring
          cx={cx}
          r={r0}
          stroke={kStroke}
          color="url(#nrKcal)"
          track={c.barTrack}
          pct={p(kcal, kcalGoal)}
          over={kcalGoal > 0 && kcal > kcalGoal}
        />
        <Ring
          cx={cx}
          r={r1}
          stroke={mStroke}
          color={MACRO_COLORS.protein}
          track={c.barTrack}
          pct={p(protein, proteinGoal)}
          over={proteinGoal > 0 && protein > proteinGoal}
          delay={80}
        />
        <Ring
          cx={cx}
          r={r2}
          stroke={mStroke}
          color={MACRO_COLORS.fat}
          track={c.barTrack}
          pct={p(fat, fatGoal)}
          over={fatGoal > 0 && fat > fatGoal}
          delay={160}
        />
        <Ring
          cx={cx}
          r={r3}
          stroke={mStroke}
          color={MACRO_COLORS.carbs}
          track={c.barTrack}
          pct={p(carbs, carbsGoal)}
          over={carbsGoal > 0 && carbs > carbsGoal}
          delay={240}
        />
      </Svg>
      <View style={styles.center}>
        {children ?? (
          <>
            <AnimatedNumber
              value={kcal}
              style={styles.kcal}
              format={(n) => groupNum(n)}
            />
            {kcalGoal > 0 && (
              <Text style={styles.goal}>/ {groupNum(kcalGoal)}</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    center: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kcal: { fontSize: 34, fontWeight: '800', color: c.primary },
    goal: { fontSize: 12, fontWeight: '600', color: c.textMuted, marginTop: 1 },
  });
