// src/ui/Card.js — единая карточка (фон, радиус, рамка, тень).

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../settings/SettingsContext';
import { RADIUS, SP } from '../theme/tokens';

export default function Card({ children, style, padded = true, elevated = true }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        elevated && c.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
    },
    padded: { padding: SP.lg },
  });
