// src/components/FadeInRow.js — плавное появление строки списка со сдвигом.

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export default function FadeInRow({ index = 0, children, style }) {
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(a, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index, 7) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: a,
          transform: [
            { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
