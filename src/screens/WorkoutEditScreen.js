// src/screens/WorkoutEditScreen.js
//
// Модальный экран: записать / изменить тренировку. См. db/19_workouts.sql.

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import Chip from '../ui/Chip';
import DayPickerSheet from '../components/DayPickerSheet';
import {
  saveWorkout,
  deleteWorkout,
  fetchWorkoutSets,
  replaceWorkoutSets,
} from '../services/supabaseClient';
import {
  WORKOUT_TYPES,
  FEELINGS,
  isCardioType,
  isStrengthType,
  typeLabel,
  flattenExercises,
  groupSets,
} from '../lib/workouts';
import { dayKey } from '../lib/days';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';

const emptyExercise = () => ({ name: '', sets: [{ reps: '', weight: '' }] });
const lastOf = (arr) => arr[arr.length - 1];

function ExerciseBlock({ ex, index, styles, c, t, onName, onSet, onAddSet, onDelSet, onDelEx }) {
  return (
    <View style={styles.exBlock}>
      <View style={styles.exHead}>
        <View style={styles.exNameWrap}>
          <TextInput
            style={styles.exName}
            value={ex.name}
            onChangeText={(v) => onName(index, v)}
            placeholder={t('workout.exercise_ph')}
            placeholderTextColor={c.textFaint}
            maxLength={50}
          />
        </View>
        <Pressable onPress={() => onDelEx(index)} hitSlop={8}>
          <Ionicons name="close" size={18} color={c.textFaint} />
        </Pressable>
      </View>

      {ex.sets.map((s, si) => (
        <View key={si} style={styles.setRow}>
          <Text style={styles.setIdx}>{si + 1}</Text>
          <View style={styles.setInput}>
            <TextInput
              style={styles.setField}
              value={s.reps}
              onChangeText={(v) => onSet(index, si, 'reps', v)}
              placeholder={t('workout.reps')}
              placeholderTextColor={c.textFaint}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
          <Text style={styles.setX}>×</Text>
          <View style={styles.setInput}>
            <TextInput
              style={styles.setField}
              value={s.weight}
              onChangeText={(v) => onSet(index, si, 'weight', v)}
              placeholder={t('workout.kg')}
              placeholderTextColor={c.textFaint}
              keyboardType="decimal-pad"
              maxLength={6}
            />
          </View>
          <Text style={styles.setUnit}>{t('workout.kg')}</Text>
          <Pressable onPress={() => onDelSet(index, si)} hitSlop={6} style={styles.setDel}>
            <Ionicons name="remove-circle-outline" size={18} color={c.textFaint} />
          </Pressable>
        </View>
      ))}

      <Pressable style={styles.addSet} onPress={() => onAddSet(index)}>
        <Ionicons name="add" size={14} color={c.primary} />
        <Text style={styles.addSetText}>{t('workout.addSet')}</Text>
      </Pressable>
    </View>
  );
}

export default function WorkoutEditScreen({ route, navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const initial = route.params?.workout || null;
  const preset = !initial ? route.params?.preset || null : null;

  const [workoutOn, setWorkoutOn] = useState(initial?.workout_on || dayKey(new Date()));
  const [type, setType] = useState(initial?.type || preset?.type || 'strength');
  const [title, setTitle] = useState(initial?.title || preset?.title || '');
  const [duration, setDuration] = useState(
    initial?.duration_min != null ? String(initial.duration_min) : ''
  );
  const [distance, setDistance] = useState(
    initial?.distance_km != null ? String(initial.distance_km) : ''
  );
  const [calories, setCalories] = useState(
    initial?.calories_est != null ? String(initial.calories_est) : ''
  );
  const [feeling, setFeeling] = useState(initial?.feeling || null);
  const [note, setNote] = useState(initial?.note || '');
  const [exercises, setExercises] = useState(
    preset?.exercises?.length ? preset.exercises : [emptyExercise()]
  );
  const [busy, setBusy] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: initial ? t('workout.editTitle') : t('workout.newTitle'),
    });
  }, [navigation, initial, t]);

  useEffect(() => {
    if (!initial) return;
    fetchWorkoutSets(initial.id)
      .then((rows) => {
        const g = groupSets(rows);
        if (g.length) setExercises(g);
      })
      .catch((e) => console.warn('fetchWorkoutSets', e?.message));
  }, [initial]);

  const strength = isStrengthType(type);
  const cardio = isCardioType(type);

  const setExName = (i, v) =>
    setExercises((p) => p.map((ex, k) => (k === i ? { ...ex, name: v } : ex)));
  const setRep = (i, si, field, v) =>
    setExercises((p) =>
      p.map((ex, k) =>
        k !== i ? ex : { ...ex, sets: ex.sets.map((s, sk) => (sk === si ? { ...s, [field]: v } : s)) }
      )
    );
  const addSet = (i) =>
    setExercises((p) =>
      p.map((ex, k) => {
        if (k !== i) return ex;
        const prev = lastOf(ex.sets) || { reps: '', weight: '' };
        return { ...ex, sets: [...ex.sets, { reps: prev.reps, weight: prev.weight }] };
      })
    );
  const delSet = (i, si) =>
    setExercises((p) =>
      p.map((ex, k) => (k !== i ? ex : { ...ex, sets: ex.sets.filter((_, sk) => sk !== si) }))
    );
  const addExercise = () => setExercises((p) => [...p, emptyExercise()]);
  const delExercise = (i) =>
    setExercises((p) => (p.length <= 1 ? [emptyExercise()] : p.filter((_, k) => k !== i)));

  const dateLabel = useMemo(() => {
    try {
      if (workoutOn === dayKey(new Date())) return t('workout.today');
      return new Date(`${workoutOn}T12:00:00`).toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      });
    } catch (e) {
      return workoutOn;
    }
  }, [workoutOn, locale, t]);

  const onSave = async () => {
    setBusy(true);
    try {
      const w = await saveWorkout({
        id: initial?.id,
        workout_on: workoutOn,
        type,
        title,
        duration_min: duration || null,
        distance_km: cardio ? distance || null : null,
        calories_est: calories || null,
        feeling,
        note,
      });
      if (strength) await replaceWorkoutSets(w.id, flattenExercises(exercises));
      else if (initial) await replaceWorkoutSets(w.id, []);
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('res.saveFail'), toUserMessage(e));
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(t('workout.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('workout.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkout(initial.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert(t('res.saveFail'), toUserMessage(e));
          }
        },
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
          <Pressable style={styles.dateRow} onPress={() => setDayOpen(true)}>
            <Ionicons name="calendar-outline" size={16} color={c.textMuted} />
            <Text style={styles.dateText}>{dateLabel}</Text>
            <Ionicons name="chevron-down" size={14} color={c.textFaint} />
          </Pressable>

          <Text style={styles.section}>{t('workout.type_label')}</Text>
          <View style={styles.chipsWrap}>
            {WORKOUT_TYPES.map((w) => (
              <Chip
                key={w.id}
                label={typeLabel(w.id, t)}
                active={type === w.id}
                onPress={() => setType(w.id)}
              />
            ))}
          </View>

          <Text style={styles.label}>{t('workout.title_label')}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={typeLabel(type, t)}
              placeholderTextColor={c.textFaint}
              maxLength={60}
            />
          </View>

          {strength ? (
            <>
              <Text style={styles.section}>{t('workout.exercises_label')}</Text>
              {exercises.map((ex, i) => (
                <ExerciseBlock
                  key={i}
                  ex={ex}
                  index={i}
                  styles={styles}
                  c={c}
                  t={t}
                  onName={setExName}
                  onSet={setRep}
                  onAddSet={addSet}
                  onDelSet={delSet}
                  onDelEx={delExercise}
                />
              ))}
              <Pressable style={styles.addEx} onPress={addExercise}>
                <Ionicons name="add-circle-outline" size={18} color={c.primary} />
                <Text style={styles.addExText}>{t('workout.addExercise')}</Text>
              </Pressable>
            </>
          ) : null}

          {cardio ? (
            <>
              <Text style={styles.label}>{t('workout.distance_label')}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType="decimal-pad"
                  placeholder="5"
                  placeholderTextColor={c.textFaint}
                  maxLength={6}
                />
                <Text style={styles.unit}>{t('workout.km')}</Text>
              </View>
            </>
          ) : null}

          <View style={styles.row2}>
            <View style={styles.col}>
              <Text style={styles.label}>{t('workout.duration_label')}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                  placeholder="45"
                  placeholderTextColor={c.textFaint}
                  maxLength={4}
                />
                <Text style={styles.unit}>{t('workout.min')}</Text>
              </View>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>{t('workout.calories_label')}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="number-pad"
                  placeholder="300"
                  placeholderTextColor={c.textFaint}
                  maxLength={5}
                />
                <Text style={styles.unit}>{t('workout.kcal')}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.section}>{t('workout.feeling_label')}</Text>
          <View style={styles.chipsWrap}>
            {FEELINGS.map((f) => (
              <Chip
                key={f.v}
                label={`${f.emoji}  ${t(`workout.feeling_${f.v}`)}`}
                active={feeling === f.v}
                onPress={() => setFeeling(feeling === f.v ? null : f.v)}
              />
            ))}
          </View>

          <Text style={styles.label}>{t('workout.note_label')}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder={t('workout.note_ph')}
              placeholderTextColor={c.textFaint}
              maxLength={200}
            />
          </View>

          <Button
            label={t('workout.save')}
            onPress={onSave}
            loading={busy}
            size="lg"
            style={styles.save}
          />
          {initial ? (
            <Button
              label={t('workout.delete')}
              variant="danger"
              onPress={onDelete}
              style={styles.del}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <DayPickerSheet
        visible={dayOpen}
        onClose={() => setDayOpen(false)}
        onPick={(k) => {
          setWorkoutOn(k);
          setDayOpen(false);
        }}
        title={t('workout.pickDay')}
        confirmLabel={t('workout.save')}
        initialKey={workoutOn}
      />
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 48 },

    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    dateText: { fontSize: 13, fontWeight: '700', color: c.text, textTransform: 'capitalize' },

    section: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      marginTop: 22,
      marginBottom: 8,
    },
    label: { fontSize: 12, color: c.textMuted, marginTop: 16, marginBottom: 5 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: c.inputBg,
    },
    input: { flex: 1, paddingVertical: 12, fontSize: 16, color: c.text },
    unit: { fontSize: 13, color: c.textFaint, marginLeft: 4 },
    row2: { flexDirection: 'row', gap: 10 },
    col: { flex: 1 },

    exBlock: {
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: 12,
      marginBottom: 10,
    },
    exHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    exNameWrap: {
      flex: 1,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    exName: { paddingVertical: 6, fontSize: 15, fontWeight: '700', color: c.text },

    setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    setIdx: {
      width: 18,
      fontSize: 12,
      fontWeight: '700',
      color: c.textFaint,
      textAlign: 'center',
    },
    setInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      backgroundColor: c.inputBg,
    },
    setField: { paddingVertical: 8, paddingHorizontal: 8, fontSize: 15, color: c.text, textAlign: 'center' },
    setX: { fontSize: 13, color: c.textFaint },
    setUnit: { fontSize: 12, color: c.textFaint },
    setDel: { paddingLeft: 2 },

    addSet: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingVertical: 4 },
    addSetText: { fontSize: 12.5, fontWeight: '700', color: c.primary },

    addEx: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      marginTop: 2,
    },
    addExText: { fontSize: 14, fontWeight: '700', color: c.primary },

    save: { marginTop: 28 },
    del: { marginTop: 8 },
  });
