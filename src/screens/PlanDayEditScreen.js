// src/screens/PlanDayEditScreen.js
//
// Правка одного дня плана тренировок (название + упражнения).
// Params: { planId, dayIndex, day: { name, focus, exercises: [{name, sets, reps, note}] } }

import { useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import Screen from '../ui/Screen';
import Button from '../ui/Button';
import {
  fetchActivePlan,
  updateWorkoutPlan,
  deleteWorkoutPlan,
} from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';

const emptyEx = () => ({ name: '', sets: '3', reps: '8–12', note: '' });

export default function PlanDayEditScreen({ route, navigation }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { planId, dayIndex, day } = route.params || {};

  const [name, setName] = useState(day?.name || '');
  const [exs, setExs] = useState(
    (day?.exercises || []).length
      ? day.exercises.map((e) => ({
          name: e.name || '',
          sets: e.sets != null ? String(e.sets) : '3',
          reps: e.reps || '8–12',
          note: e.note || '',
        }))
      : [emptyEx()]
  );
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('planday.title') });
  }, [navigation, t]);

  const setField = (i, f, v) =>
    setExs((p) => p.map((e, k) => (k === i ? { ...e, [f]: v } : e)));
  const addEx = () => setExs((p) => [...p, emptyEx()]);
  const delEx = (i) =>
    setExs((p) => (p.length <= 1 ? [emptyEx()] : p.filter((_, k) => k !== i)));

  const persist = async (mutator) => {
    setBusy(true);
    try {
      const plan = await fetchActivePlan();
      if (!plan || plan.id !== planId) throw new Error(t('planday.gone'));
      const payload = { ...(plan.payload || {}) };
      payload.days = Array.isArray(payload.days) ? [...payload.days] : [];
      mutator(payload);
      await updateWorkoutPlan(planId, payload);
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('res.saveFail'), toUserMessage(e));
      setBusy(false);
    }
  };

  const onSave = () => {
    const nm = name.trim();
    if (!nm) {
      Alert.alert(t('planday.nameRequired'));
      return;
    }
    const exercises = exs
      .map((e) => ({
        name: e.name.trim(),
        sets: Math.max(1, Math.round(parseFloat(e.sets)) || 3),
        reps: e.reps.trim() || '8–12',
        note: e.note.trim(),
      }))
      .filter((e) => e.name);
    persist((payload) => {
      payload.days[dayIndex] = { ...(payload.days[dayIndex] || {}), name: nm, exercises };
    });
  };

  const onDeleteDay = () => {
    Alert.alert(t('planday.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('planday.deleteDay'),
        style: 'destructive',
        onPress: () =>
          persist((payload) => {
            payload.days.splice(dayIndex, 1);
          }),
      },
    ]);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>{t('planday.dayName')}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('planday.dayName_ph')}
              placeholderTextColor={c.textFaint}
              maxLength={60}
            />
          </View>

          <Text style={styles.section}>{t('workout.exercises_label')}</Text>
          {exs.map((e, i) => (
            <View key={i} style={styles.exBlock}>
              <View style={styles.exTop}>
                <View style={styles.exNameWrap}>
                  <TextInput
                    style={styles.exName}
                    value={e.name}
                    onChangeText={(v) => setField(i, 'name', v)}
                    placeholder={t('workout.exercise_ph')}
                    placeholderTextColor={c.textFaint}
                    maxLength={50}
                  />
                </View>
                <Pressable onPress={() => delEx(i)} hitSlop={8}>
                  <Ionicons name="close" size={18} color={c.textFaint} />
                </Pressable>
              </View>
              <View style={styles.exRow}>
                <View style={styles.exSmall}>
                  <Text style={styles.exSmallLabel}>{t('planday.sets')}</Text>
                  <TextInput
                    style={styles.exSmallField}
                    value={e.sets}
                    onChangeText={(v) => setField(i, 'sets', v)}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View style={styles.exSmall}>
                  <Text style={styles.exSmallLabel}>{t('planday.repsLabel')}</Text>
                  <TextInput
                    style={styles.exSmallField}
                    value={e.reps}
                    onChangeText={(v) => setField(i, 'reps', v)}
                    placeholder={t('planday.reps_ph')}
                    placeholderTextColor={c.textFaint}
                    maxLength={12}
                  />
                </View>
              </View>
              <View style={styles.inputWrapSm}>
                <TextInput
                  style={styles.input}
                  value={e.note}
                  onChangeText={(v) => setField(i, 'note', v)}
                  placeholder={t('planday.note_ph')}
                  placeholderTextColor={c.textFaint}
                  maxLength={80}
                />
              </View>
            </View>
          ))}

          <Pressable style={styles.addEx} onPress={addEx}>
            <Ionicons name="add-circle-outline" size={18} color={c.primary} />
            <Text style={styles.addExText}>{t('workout.addExercise')}</Text>
          </Pressable>

          <Button
            label={t('workout.save')}
            onPress={onSave}
            loading={busy}
            size="lg"
            style={styles.save}
          />
          <Button
            label={t('planday.deleteDay')}
            variant="danger"
            onPress={onDeleteDay}
            style={styles.del}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 48 },
    label: { fontSize: 12, color: c.textMuted, marginTop: 16, marginBottom: 5 },
    section: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      marginTop: 22,
      marginBottom: 8,
    },
    inputWrap: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: c.inputBg,
    },
    inputWrapSm: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      backgroundColor: c.inputBg,
      marginTop: 8,
    },
    input: { paddingVertical: 11, fontSize: 15, color: c.text },

    exBlock: {
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 12,
      marginBottom: 10,
    },
    exTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    exNameWrap: {
      flex: 1,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    exName: { paddingVertical: 6, fontSize: 15, fontWeight: '700', color: c.text },
    exRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    exSmall: { flex: 1 },
    exSmallLabel: { fontSize: 11, color: c.textMuted, marginBottom: 4 },
    exSmallField: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.inputBg,
      textAlign: 'center',
    },

    addEx: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      marginTop: 2,
    },
    addExText: { fontSize: 14, fontWeight: '700', color: c.primary },
    save: { marginTop: 24 },
    del: { marginTop: 8 },
  });
