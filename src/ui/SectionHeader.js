// src/ui/SectionHeader.js — заголовок секции + опциональный правый элемент.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from '../settings/SettingsContext';
import { SP } from '../theme/tokens';

export default function SectionHeader({ title, right, style }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.title}>{title}</Text>
      {right ?? null}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SP.sm,
    },
    title: { fontSize: 16, fontWeight: '800', color: c.text },
  });
