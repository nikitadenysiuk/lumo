import {
  useMemo,
} from 'react';
import { Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';

import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { MEAL_TYPES, MEAL_EMOJI } from '../lib/meals';

export default function MealTypePicker({ value, onChange }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.row}>
      {MEAL_TYPES.map((k) => {
        const active = value === k;
        return (
          <Pressable
            key={k}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(k)}
          >
            <Text style={styles.emoji}>{MEAL_EMOJI[k]}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>
              {t(`mt.${k}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 6, marginVertical: 12 },
    chip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    emoji: { fontSize: 16 },
    label: { fontSize: 10, color: c.textMuted, marginTop: 2 },
    labelActive: { color: c.onPrimary, fontWeight: '700' },
  });
