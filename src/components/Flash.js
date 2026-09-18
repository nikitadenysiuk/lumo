// src/components/Flash.js — всплывающая плашка «✓ …» вверху экрана.
// Опционально с кнопкой действия (например «Отменить»).

import {
  useMemo,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';

import { useTheme } from '../settings/SettingsContext';

export default function Flash({ message, actionLabel, onAction }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!message) return null;
  const interactive = !!(actionLabel && onAction);
  return (
    <View
      style={styles.flash}
      pointerEvents={interactive ? 'box-none' : 'none'}
    >
      <View style={styles.inner}>
        <Text style={styles.text}>{message}</Text>
        {interactive ? (
          <Pressable onPress={onAction} hitSlop={10}>
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flash: {
      position: 'absolute',
      top: 10,
      alignSelf: 'center',
      zIndex: 20,
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    text: { color: c.onPrimary, fontWeight: '700', fontSize: 13 },
    action: {
      color: c.onPrimary,
      fontWeight: '800',
      fontSize: 13,
      textDecorationLine: 'underline',
    },
  });
