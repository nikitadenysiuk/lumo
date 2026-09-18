// src/ui/Button.js — единая кнопка (primary | secondary | ghost | danger).

import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from './Text';
import { useTheme } from '../settings/SettingsContext';
import { hSelect } from '../lib/haptics';
import { RADIUS } from '../theme/tokens';

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  haptic = true,
  style,
  fullWidth = true,
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const off = disabled || loading;

  const v = styles[variant] || styles.primary;
  const vText = styles[`${variant}Text`] || styles.primaryText;
  const spinnerColor =
    variant === 'primary' || variant === 'danger' ? c.onPrimary : c.primary;

  return (
    <Pressable
      onPress={() => {
        if (off) return;
        if (haptic) hSelect();
        onPress && onPress();
      }}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.lg,
        fullWidth && styles.full,
        v,
        pressed && !off && styles.pressed,
        off && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View style={styles.row}>
          {icon ? (
            <Ionicons
              name={icon}
              size={size === 'lg' ? 19 : 17}
              color={vText.color}
              style={styles.icon}
            />
          ) : null}
          <Text style={[styles.text, size === 'lg' && styles.textLg, vText]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    base: {
      borderRadius: RADIUS.lg,
      paddingVertical: 13,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lg: { paddingVertical: 16 },
    full: { alignSelf: 'stretch' },
    row: { flexDirection: 'row', alignItems: 'center' },
    icon: { marginRight: 8 },
    text: { fontSize: 15, fontWeight: '700' },
    textLg: { fontSize: 16, fontWeight: '800' },
    pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
    disabled: { opacity: 0.5 },

    primary: { backgroundColor: c.primary },
    primaryText: { color: c.onPrimary },

    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: c.primary,
    },
    secondaryText: { color: c.primary },

    ghost: { backgroundColor: 'transparent', paddingVertical: 10 },
    ghostText: { color: c.primary },

    danger: { backgroundColor: c.danger },
    dangerText: { color: '#fff' },
  });
