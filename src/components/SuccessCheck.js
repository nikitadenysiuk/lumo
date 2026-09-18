// src/components/SuccessCheck.js — короткая «галочка успеха» после сохранения.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SuccessCheck({ visible, onDone, holdMs = 480 }) {
  const s = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    s.setValue(0);
    Animated.sequence([
      Animated.spring(s, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.delay(holdMs),
      Animated.timing(s, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => onDone && onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const scale = s.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View style={[styles.badge, { opacity: s, transform: [{ scale }] }]}>
        <Ionicons name="checkmark" size={46} color="#fff" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
