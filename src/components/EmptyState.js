// src/components/EmptyState.js — пустое состояние: эмодзи + текст.

import {
  useMemo,
} from 'react';
import { StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import EmptyArt from './EmptyArt';

import { useTheme } from '../settings/SettingsContext';

export default function EmptyState({ emoji = '🍃', art, title, hint, style }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.emojiWrap}>
        {art ? <EmptyArt name={art} size={52} /> : (
          <Text style={styles.emoji}>{emoji}</Text>
        )}
      </View>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24 },
    emojiWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emoji: { fontSize: 34 },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      textAlign: 'center',
    },
    hint: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
    },
  });
