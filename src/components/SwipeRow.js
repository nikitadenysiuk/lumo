// src/components/SwipeRow.js
// Свайп строки ВЛЕВО открывает красную кнопку «Удалить».
// Без сторонних библиотек — PanResponder + Animated. Работает в Expo Go.

import {
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';

import { useTheme } from '../settings/SettingsContext';
import { useT } from '../i18n/LocaleContext';
import { hTap, hSuccess } from '../lib/haptics';

const ACTION_W = 100; // ширина кнопки «Удалить»
const OPEN_AT = 40; // порог, после которого строка «залипает» открытой
const MAX_PULL = ACTION_W + 40;

export default function SwipeRow({ children, onDelete }) {
  const c = useTheme();
  const { t } = useT();
  const tx = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);

  const settle = (toOpen) => {
    Animated.timing(tx, {
      toValue: toOpen ? -ACTION_W : 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      if (toOpen && !openRef.current) hTap();
      openRef.current = toOpen;
      setOpen(toOpen);
    });
  };

  const pan = useRef(
    PanResponder.create({
      // забираем жест как только движение явно горизонтальное
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      // не отдавать жест обратно списку — из-за этого свайп «сбрасывался»
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderMove: (_, g) => {
        const base = openRef.current ? -ACTION_W : 0;
        let next = base + g.dx;
        if (next > 0) next = 0;
        if (next < -MAX_PULL) next = -MAX_PULL;
        tx.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const base = openRef.current ? -ACTION_W : 0;
        settle(base + g.dx < -OPEN_AT);
      },
      onPanResponderTerminate: (_, g) => {
        const base = openRef.current ? -ACTION_W : 0;
        settle(base + g.dx < -OPEN_AT);
      },
    })
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={[styles.action, { backgroundColor: c.danger }]}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            settle(false);
            hSuccess();
            onDelete?.();
          }}
        >
          <Text style={styles.actionText}>
            🗑{'\n'}
            {t('common.delete')}
          </Text>
        </Pressable>
      </View>
      <Animated.View
        style={[
          styles.front,
          { backgroundColor: c.bg, transform: [{ translateX: tx }] },
        ]}
        {...pan.panHandlers}
      >
        {children}
        {open && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => settle(false)}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  action: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: MAX_PULL,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  actionBtn: {
    width: ACTION_W,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  front: {},
});
