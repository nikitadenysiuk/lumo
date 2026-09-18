import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { useFocusEffect } from '@react-navigation/native';

import { getProfile, saveGoalOverrides } from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme, useSettings } from '../settings/SettingsContext';
import Screen from '../ui/Screen';
import Button from '../ui/Button';
import useLeaveGuard from '../lib/useLeaveGuard';

const LB = 2.2046226;

function GoalRow({ styles, c, label, value, onChange, auto, unit }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={5}
          placeholder={auto != null ? String(auto) : '—'}
          placeholderTextColor={c.textFaint}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

export default function GoalsScreen({ navigation }) {
  const { t } = useT();
  const c = useTheme();
  const { units } = useSettings();
  const imperial = units === 'imperial';
  const styles = useMemo(() => makeStyles(c), [c]);

  const [profile, setProfile] = useState(null);
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const edit = (setter) => (v) => {
    setter(v);
    setTouched(true);
  };
  const allowLeave = useLeaveGuard(navigation, touched && !busy);

  const wUnit = imperial ? t('weight.lb') : t('onb.kg');
  const toViewW = (kg) =>
    kg == null ? '' : String(Math.round((imperial ? kg * LB : kg) * 10) / 10);
  const toKgW = (v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    if (!n) return null;
    return imperial ? n / LB : n;
  };

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('goals.title') });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      getProfile()
        .then((p) => {
          setProfile(p);
          setKcal(p.kcal_override != null ? String(p.kcal_override) : '');
          setProtein(p.protein_override != null ? String(p.protein_override) : '');
          setFat(p.fat_override != null ? String(p.fat_override) : '');
          setCarbs(p.carbs_override != null ? String(p.carbs_override) : '');
          setTarget(toViewW(p.target_weight_kg));
        })
        .catch((e) => console.warn('goals load', e?.message));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  async function save() {
    setBusy(true);
    try {
      const updated = await saveGoalOverrides({
        kcal: kcal.trim() || null,
        protein: protein.trim() || null,
        fat: fat.trim() || null,
        carbs: carbs.trim() || null,
        targetWeight: toKgW(target),
      });
      setProfile(updated);
      allowLeave();
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('goals.title'), toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function resetAll() {
    setTouched(true);
    setKcal('');
    setProtein('');
    setFat('');
    setCarbs('');
  }

  if (!profile) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.hint}>{t('goals.hint')}</Text>

      <Text style={styles.section}>{t('goals.daily')}</Text>
      <View style={styles.card}>
        <GoalRow
          styles={styles}
          c={c}
          label={t('home.kcalShort')}
          value={kcal}
          onChange={edit(setKcal)}
          auto={profile.daily_kcal_auto}
        />
        <GoalRow
          styles={styles}
          c={c}
          label={t('home.protein')}
          value={protein}
          onChange={edit(setProtein)}
          auto={profile.protein_auto}
          unit={t('res.g')}
        />
        <GoalRow
          styles={styles}
          c={c}
          label={t('home.fat')}
          value={fat}
          onChange={edit(setFat)}
          auto={profile.fat_auto}
          unit={t('res.g')}
        />
        <GoalRow
          styles={styles}
          c={c}
          label={t('home.carbs')}
          value={carbs}
          onChange={edit(setCarbs)}
          auto={profile.carbs_auto}
          unit={t('res.g')}
        />
        <Pressable onPress={resetAll} style={styles.resetBtn}>
          <Text style={styles.resetText}>{t('goals.reset')}</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>{t('goals.targetWeight')}</Text>
      <View style={styles.card}>
        <GoalRow
          styles={styles}
          c={c}
          label={t('weight.title')}
          value={target}
          onChange={edit(setTarget)}
          unit={wUnit}
        />
      </View>

      <Button
        label={busy ? t('common.saving') : t('common.save')}
        loading={busy}
        onPress={save}
        size="lg"
        style={styles.save}
      />
    </ScrollView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 40 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: { fontSize: 13, color: c.textMuted, marginBottom: 8 },
    section: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      marginTop: 16,
      marginBottom: 8,
      marginLeft: 4,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    rowLabel: { fontSize: 15, color: c.text },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: c.inputBg,
      minWidth: 110,
      justifyContent: 'flex-end',
    },
    input: {
      paddingVertical: 9,
      fontSize: 16,
      color: c.text,
      textAlign: 'right',
      minWidth: 56,
    },
    unit: { fontSize: 13, color: c.textFaint, marginLeft: 4 },
    resetBtn: { alignItems: 'center', paddingVertical: 10 },
    resetText: { color: c.primary, fontWeight: '600', fontSize: 13 },
    save: { marginTop: 22 },
  });
