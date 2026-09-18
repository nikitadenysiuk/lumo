// src/components/OptionSheet.js — «шторка» со списком действий.

import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../ui/Text';
import Sheet from './Sheet';
import { useTheme } from '../settings/SettingsContext';

/**
 * @param {{visible, onClose, title?, options: Array<{label, icon?, onPress, destructive?}>}} props
 */
export default function OptionSheet({ visible, onClose, title, options = [] }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {options.map((o, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => {
            onClose();
            o.onPress?.();
          }}
        >
          {o.icon ? (
            <Ionicons
              name={o.icon}
              size={20}
              color={o.destructive ? c.danger : c.text}
              style={styles.icon}
            />
          ) : (
            <View style={styles.icon} />
          )}
          <Text style={[styles.label, o.destructive && { color: c.danger }]}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </Sheet>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
    },
    pressed: { backgroundColor: c.accentSoft },
    icon: { width: 20, marginRight: 14 },
    label: { fontSize: 16, color: c.text, fontWeight: '600' },
  });
