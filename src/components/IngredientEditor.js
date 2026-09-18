import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { sumItems, fromGrams, toGrams } from '../lib/nutrition';

const toN = (s) => Math.max(0, parseFloat(String(s).replace(',', '.')) || 0);
const r1 = (n) => Math.round(n * 10) / 10;

// item (на порцию) -> строка редактора (значения на 100 г)
function toRows(items) {
  return (items || []).map((it) => {
    const g = Math.max(1, Math.round(Number(it.grams) || 1));
    return {
      name: it.name || '',
      grams: g,
      p100: {
        kcal: (Number(it.calories) || 0) / g * 100,
        p: (Number(it.protein_g) || 0) / g * 100,
        c: (Number(it.carbs_g) || 0) / g * 100,
        f: (Number(it.fat_g) || 0) / g * 100,
      },
    };
  });
}

function rowToItem(r) {
  const k = r.grams / 100;
  return {
    name: (r.name || '').trim() || '—',
    grams: Math.round(r.grams),
    calories: Math.round(r.p100.kcal * k),
    protein_g: r1(r.p100.p * k),
    carbs_g: r1(r.p100.c * k),
    fat_g: r1(r.p100.f * k),
  };
}

/**
 * Редактор списка ингредиентов: имя, вес (граммы/унции), и по тапу —
 * значения на 100 г. Плюс кнопка «добавить». onChange получает массив
 * items (на порцию) при любом изменении.
 */
export default function IngredientEditor({ items, onChange, imperial }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [rows, setRows] = useState(() => toRows(items));
  const [open, setOpen] = useState(-1);
  const [preset, setPreset] = useState('m');
  const baseGrams = useRef(toRows(items).map((r) => r.grams));

  const step = imperial ? 0.5 : 10;
  const unit = imperial ? t('res.oz') : t('res.g');

  const PRESET_FACTOR = { s: 0.7, m: 1, l: 1.4 };
  const applyPreset = (key) => {
    setPreset(key);
    const f = PRESET_FACTOR[key];
    setRows((rs) =>
      rs.map((r, i) => ({
        ...r,
        grams: Math.max(1, Math.round((baseGrams.current[i] ?? r.grams) * f)),
      }))
    );
  };

  useEffect(() => {
    onChange(rows.map(rowToItem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const set = (i, patch) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setP100 = (i, key, val) =>
    setRows((rs) =>
      rs.map((r, idx) =>
        idx === i ? { ...r, p100: { ...r.p100, [key]: toN(val) } } : r
      )
    );
  const bump = (i, dir) => {
    const cur = fromGrams(rows[i].grams, imperial);
    const next = Math.max(step, r1(cur + dir * step));
    set(i, { grams: toGrams(next, imperial) });
    setPreset(null);
  };
  const add = () => {
    setRows((rs) => [
      ...rs,
      { name: '', grams: imperial ? toGrams(3.5, true) : 100, p100: { kcal: 0, p: 0, c: 0, f: 0 } },
    ]);
    setOpen(rows.length);
    setPreset(null);
  };
  const remove = (i) => {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
    setOpen(-1);
    setPreset(null);
  };

  const totals = sumItems(rows.map(rowToItem));

  return (
    <View style={styles.wrap}>
      {rows.length > 0 && (
        <View style={styles.presets}>
          {[
            ['s', t('res.portionS')],
            ['m', t('res.portionM')],
            ['l', t('res.portionL')],
          ].map(([k, label]) => (
            <Pressable
              key={k}
              style={[styles.preset, preset === k && styles.presetActive]}
              onPress={() => applyPreset(k)}
            >
              <Text
                style={[
                  styles.presetTxt,
                  preset === k && styles.presetTxtActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {rows.map((r, i) => {
        const it = rowToItem(r);
        return (
          <View key={i} style={styles.row}>
            <View style={styles.line1}>
              <TextInput
                style={styles.nameInput}
                value={r.name}
                onChangeText={(v) => set(i, { name: v })}
                placeholder={t('res.ingredient')}
                placeholderTextColor={c.textFaint}
              />
              <Pressable style={styles.stepBtn} onPress={() => bump(i, -1)}>
                <Text style={styles.stepTxt}>−</Text>
              </Pressable>
              <TextInput
                style={styles.gramsInput}
                value={String(fromGrams(r.grams, imperial))}
                onChangeText={(v) => {
                  set(i, { grams: toGrams(toN(v), imperial) });
                  setPreset(null);
                }}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <Pressable style={styles.stepBtn} onPress={() => bump(i, 1)}>
                <Text style={styles.stepTxt}>+</Text>
              </Pressable>
              <Pressable onPress={() => remove(i)} hitSlop={8} style={styles.del}>
                <Text style={styles.delTxt}>✕</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => setOpen(open === i ? -1 : i)}>
              <Text style={styles.sub}>
                {it.calories} {t('res.kcal')} ·{' '}
                {t('res.macros', {
                  p: it.protein_g,
                  f: it.fat_g,
                  c: it.carbs_g,
                })}
                {'  '}
                <Text style={styles.editHint}>
                  {open === i ? '▲' : t('res.per100edit')}
                </Text>
              </Text>
            </Pressable>

            {open === i && (
              <View style={styles.p100row}>
                {[
                  ['kcal', t('res.kcal')],
                  ['p', 'Б'],
                  ['f', 'Ж'],
                  ['c', 'У'],
                ].map(([key, label]) => (
                  <View key={key} style={styles.p100cell}>
                    <Text style={styles.p100label}>{label}/100{unit}</Text>
                    <TextInput
                      style={styles.p100input}
                      value={String(r1(r.p100[key]))}
                      onChangeText={(v) => setP100(i, key, v)}
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <Pressable style={styles.add} onPress={add}>
        <Text style={styles.addTxt}>＋ {t('res.addIngredient')}</Text>
      </Pressable>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {t('res.total')} · {Math.round(totals.grams)} {t('res.g')}
        </Text>
        <Text style={styles.totalVal}>
          {totals.calories} {t('res.kcal')}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: { width: '100%' },
    presets: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    preset: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingVertical: 7,
      alignItems: 'center',
    },
    presetActive: { backgroundColor: c.primary, borderColor: c.primary },
    presetTxt: { fontSize: 12, fontWeight: '700', color: c.textMuted },
    presetTxtActive: { color: c.onPrimary },
    row: {
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    line1: { flexDirection: 'row', alignItems: 'center' },
    nameInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
      paddingVertical: 4,
      marginRight: 6,
    },
    stepBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepTxt: { fontSize: 15, fontWeight: '700', color: c.dark ? c.text : c.primary },
    gramsInput: {
      width: 46,
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
      marginHorizontal: 2,
    },
    del: { paddingHorizontal: 4, marginLeft: 4 },
    delTxt: { color: c.textFaint, fontSize: 13 },
    sub: { fontSize: 12, color: c.textMuted, marginTop: 3 },
    editHint: { color: c.primary, fontWeight: '600' },
    p100row: { flexDirection: 'row', gap: 6, marginTop: 8 },
    p100cell: { flex: 1 },
    p100label: { fontSize: 9, color: c.textFaint, marginBottom: 2 },
    p100input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 6,
      fontSize: 13,
      color: c.text,
      textAlign: 'center',
      backgroundColor: c.inputBg,
    },
    add: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: c.primary,
      borderStyle: 'dashed',
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    addTxt: { color: c.primary, fontWeight: '700', fontSize: 13 },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.divider,
    },
    totalLabel: { fontSize: 13, color: c.textMuted },
    totalVal: { fontSize: 16, fontWeight: '800', color: c.primary },
  });
