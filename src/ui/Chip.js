// src/ui/Chip.js — pill-чип (выбор одного из вариантов).

import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { useTheme } from '../settings/SettingsContext';
import { hSelect } from '../lib/haptics';
import { RADIUS } from '../theme/tokens';

export default function Chip({ label, active, onPress, style, flex }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={() => {
        hSelect();
        onPress && onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        flex && styles.flex,
        active && styles.active,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.pill,
      paddingVertical: 8,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flex: { flex: 1 },
    active: { backgroundColor: c.primary, borderColor: c.primary },
    pressed: { opacity: 0.8 },
    text: { fontSize: 13, fontWeight: '700', color: c.textMuted },
    textActive: { color: c.onPrimary },
  });
