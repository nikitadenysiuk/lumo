// src/components/AnimatedNumber.js — плавная «докрутка» числа при изменении.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { Text } from '../ui/Text';

export default function AnimatedNumber({
  value = 0,
  style,
  duration = 600,
  format = (n) => String(Math.round(n)),
}) {
  const anim = useRef(new Animated.Value(value)).current;
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(v));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    const a = Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [value, duration, anim]);

  return <Text style={[TABULAR, style]}>{format(shown)}</Text>;
}

const TABULAR = { fontVariant: ['tabular-nums'] };
