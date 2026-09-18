// src/components/Sheet.js — нижняя «шторка» (bottom sheet), без сторонних библиотек.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../settings/SettingsContext';

const H = Dimensions.get('window').height;

export default function Sheet({ visible, onClose, children }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [render, setRender] = useState(visible);
  const y = useRef(new Animated.Value(H)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRender(true);
      Animated.parallel([
        Animated.timing(y, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (render) {
      Animated.parallel([
        Animated.timing(y, { toValue: H, duration: 190, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 190, useNativeDriver: true }),
      ]).start(() => setRender(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!render) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: c.card,
            paddingBottom: insets.bottom + 14,
            transform: [{ translateY: y }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: c.divider }]} />
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 6,
  },
});
