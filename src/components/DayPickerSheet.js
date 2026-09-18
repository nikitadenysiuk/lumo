// src/components/DayPickerSheet.js
// Нижняя шторка с горизонтальной лентой дат для выбора дня.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';

import Sheet from './Sheet';
import Button from '../ui/Button';
import { useTheme } from '../settings/SettingsContext';
import { useT } from '../i18n/LocaleContext';
import { addDays, dayKey, startOfDay } from '../lib/days';

const BACK = 7;
const FWD = 14;
const CELL_W = 58;

export default function DayPickerSheet({
  visible,
  onClose,
  onPick,
  title,
  confirmLabel,
  initialKey,
}) {
  const c = useTheme();
  const { locale } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const scrollRef = useRef(null);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    const out = [];
    for (let i = -BACK; i <= FWD; i += 1) out.push(addDays(today, i));
    return out;
  }, []);

  const defKey = initialKey || dayKey(addDays(new Date(), 1));
  const [sel, setSel] = useState(defKey);

  useEffect(() => {
    if (visible) {
      setSel(defKey);
      const idx = days.findIndex((d) => dayKey(d) === defKey);
      const x = Math.max(0, (idx < 0 ? BACK : idx) * CELL_W - CELL_W * 2);
      setTimeout(() => scrollRef.current?.scrollTo({ x, animated: false }), 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {days.map((d) => {
          const k = dayKey(d);
          const active = k === sel;
          return (
            <Pressable
              key={k}
              style={[styles.cell, active && styles.cellActive]}
              onPress={() => setSel(k)}
            >
              <Text style={[styles.dow, active && styles.txtActive]}>
                {d.toLocaleDateString(locale, { weekday: 'short' })}
              </Text>
              <Text style={[styles.num, active && styles.txtActive]}>
                {d.getDate()}
              </Text>
              <Text style={[styles.mon, active && styles.txtActive]}>
                {d.toLocaleDateString(locale, { month: 'short' })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Button
        label={confirmLabel}
        onPress={() => {
          onPick(sel);
          onClose();
        }}
        style={styles.btn}
      />
    </Sheet>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
      paddingHorizontal: 14,
      paddingTop: 2,
      paddingBottom: 12,
    },
    strip: { paddingHorizontal: 10, gap: 6, paddingBottom: 4 },
    cell: {
      width: CELL_W - 6,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    cellActive: { backgroundColor: c.primary, borderColor: c.primary },
    dow: { fontSize: 10, color: c.textMuted, textTransform: 'uppercase' },
    num: { fontSize: 17, fontWeight: '800', color: c.text, marginVertical: 1 },
    mon: { fontSize: 9, color: c.textFaint, textTransform: 'lowercase' },
    txtActive: { color: c.onPrimary },
    btn: { marginTop: 16, marginHorizontal: 8 },
  });
