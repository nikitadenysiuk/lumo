// src/components/Skeleton.js — заглушки-плейсхолдеры на время загрузки.

import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { useTheme } from '../settings/SettingsContext';

export function SkeletonBox({ width = '100%', height = 16, radius = 8, style }) {
  const c = useTheme();
  const a = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [a]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: c.barTrack,
          opacity: a,
        },
        style,
      ]}
    />
  );
}

export function HomeSkeleton() {
  const c = useTheme();
  return (
    <View style={{ padding: 16 }}>
      <View
        style={{
          backgroundColor: c.accentSoft,
          borderRadius: 16,
          padding: 20,
          alignItems: 'center',
        }}
      >
        <SkeletonBox width={120} height={14} radius={7} />
        <SkeletonBox
          width={170}
          height={170}
          radius={85}
          style={{ marginTop: 16 }}
        />
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 18 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonBox key={i} width={64} height={64} radius={32} />
          ))}
        </View>
      </View>
      <SkeletonBox height={116} radius={14} style={{ marginTop: 12 }} />
      <SkeletonBox height={72} radius={14} style={{ marginTop: 12 }} />
      <SkeletonBox height={52} radius={14} style={{ marginTop: 16 }} />
    </View>
  );
}

export function CardsSkeleton({ cards = 3, height = 150 }) {
  return (
    <View style={{ padding: 16, gap: 14 }}>
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonBox key={i} height={height} radius={14} />
      ))}
    </View>
  );
}

export function ListSkeleton({ rows = 6 }) {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <SkeletonBox width={44} height={44} radius={8} />
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonBox width={`${55 + ((i * 13) % 35)}%`} height={13} />
            <SkeletonBox width="35%" height={10} />
          </View>
          <SkeletonBox width={40} height={16} />
        </View>
      ))}
    </View>
  );
}
