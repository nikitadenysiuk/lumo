// src/components/LogHeatmap.js
// Календарь логированных дней по месяцам. Свайп влево/вправо или стрелки —
// листать месяцы. Цвет дня = статус дневной нормы (если цель задана).
// Тап по дню — выбрать его.

import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';

import { useTheme } from '../settings/SettingsContext';
import { dayKey, goalStatus, GOAL_COLORS, startOfDay } from '../lib/days';
import { i18n } from '../i18n';
import { hSelect } from '../lib/haptics';

// на сколько месяцев назад можно листать (глубина истории на Главной)
const MIN_OFFSET = -2;

// подписи дней недели в локали (1 янв 2023 — воскресенье)
function weekdayLabels() {
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    out.push(
      new Date(2023, 0, 1 + i).toLocaleDateString(i18n.locale, {
        weekday: 'narrow',
      })
    );
  }
  return out;
}

export default function LogHeatmap({
  byDay = {},
  goalKcal = null,
  selectedKey,
  onSelectDay,
  t,
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [offset, setOffset] = useState(0); // 0 = текущий месяц

  const dow = useMemo(weekdayLabels, []);

  const { rows, monthLabel, loggedCount, pastDays } = useMemo(() => {
    const today = startOfDay(new Date());
    const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const year = first.getFullYear();
    const month = first.getMonth();
    const lead = first.getDay(); // сколько пустых клеток перед 1-м числом
    const total = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    let logged = 0;
    let past = 0;
    for (let d = 1; d <= total; d += 1) {
      const date = new Date(year, month, d);
      const key = dayKey(date);
      const future = date.getTime() > today.getTime();
      const tot = byDay[key];
      const has = !!(tot && tot.count);
      if (!future) {
        past += 1;
        if (has) logged += 1;
      }
      cells.push({
        key,
        d,
        future,
        has,
        kcal: tot?.calories || 0,
        today: key === dayKey(today),
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const grid = [];
    for (let i = 0; i < cells.length; i += 7) grid.push(cells.slice(i, i + 7));

    return {
      rows: grid,
      monthLabel: first.toLocaleDateString(i18n.locale, {
        month: 'long',
        year: 'numeric',
      }),
      loggedCount: logged,
      pastDays: past,
    };
  }, [byDay, offset]);

  const go = (delta) => {
    setOffset((o) => {
      const next = Math.max(MIN_OFFSET, Math.min(0, o + delta));
      if (next !== o) hSelect();
      return next;
    });
  };

  // свайп вправо (dx > 0) — предыдущий месяц; влево — следующий
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 40) go(-1);
        else if (g.dx < -40) go(1);
      },
    })
  ).current;

  const cellColor = (cell) => {
    if (!cell.has) return c.barTrack;
    if (!goalKcal) return c.primary;
    return GOAL_COLORS[goalStatus(cell.kcal, goalKcal)] || c.primary;
  };

  return (
    <View style={styles.wrap} {...pan.panHandlers}>
      <View style={styles.headRow}>
        <Pressable
          hitSlop={10}
          disabled={offset <= MIN_OFFSET}
          onPress={() => go(-1)}
        >
          <Text
            style={[styles.nav, offset <= MIN_OFFSET && styles.navOff]}
          >
            ‹
          </Text>
        </Pressable>
        <Text style={styles.month}>{monthLabel}</Text>
        <Pressable hitSlop={10} disabled={offset >= 0} onPress={() => go(1)}>
          <Text style={[styles.nav, offset >= 0 && styles.navOff]}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.count}>
        {t
          ? t('home.logDaysOf', { n: loggedCount, total: pastDays })
          : `${loggedCount}/${pastDays}`}
      </Text>

      <View style={styles.dowRow}>
        {dow.map((l, i) => (
          <View key={i} style={styles.slot}>
            <Text style={styles.dow}>{l}</Text>
          </View>
        ))}
      </View>

      {rows.map((row, w) => (
        <View key={w} style={styles.row}>
          {row.map((cell, i) => {
            if (!cell) return <View key={`e${i}`} style={styles.slot} />;
            const active = cell.key === selectedKey && !cell.future;
            return (
              <View key={cell.key} style={styles.slot}>
                <Pressable
                  disabled={cell.future}
                  hitSlop={2}
                  onPress={() => {
                    hSelect();
                    onSelectDay && onSelectDay(cell.key);
                  }}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: cell.future
                        ? 'transparent'
                        : cellColor(cell),
                    },
                    cell.today && styles.cellToday,
                    active && styles.cellActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.num,
                      cell.has && !cell.future && styles.numOn,
                      cell.future && styles.numFuture,
                    ]}
                  >
                    {cell.d}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    headRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    nav: { fontSize: 22, fontWeight: '800', color: c.primary, width: 28, textAlign: 'center' },
    navOff: { color: c.textFaint, opacity: 0.4 },
    month: {
      fontSize: 13,
      fontWeight: '800',
      color: c.text,
      textTransform: 'capitalize',
    },
    count: {
      fontSize: 11,
      fontWeight: '700',
      color: c.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    dowRow: { flexDirection: 'row', marginBottom: 4 },
    row: { flexDirection: 'row', marginBottom: 4 },
    slot: { flex: 1, alignItems: 'center' },
    dow: { fontSize: 9, color: c.textFaint },
    cell: {
      width: '84%',
      aspectRatio: 1,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellToday: { borderWidth: 1.5, borderColor: c.text },
    cellActive: { borderWidth: 2, borderColor: c.primary },
    num: { fontSize: 10, fontWeight: '700', color: c.textFaint },
    numOn: { color: '#fff' },
    numFuture: { color: c.textFaint, opacity: 0.4 },
  });
