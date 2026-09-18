// src/screens/SupplementEditScreen.js
//
// Модальный экран: добавить / изменить добавку (БАД). См. db/18_supplements.sql.

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
import Chip from '../ui/Chip';
import PromptModal from '../components/PromptModal';
import { saveSupplement, deleteSupplement } from '../services/supabaseClient';
import { requestNotifPermission } from '../services/notifications';
import {
  PRESET_TIMES,
  normalizeTime,
  sortTimes,
  weekdayShort,
} from '../lib/supplements';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';

export default function SupplementEditScreen({ route, navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const initial = route.params?.supplement || null;
  const preset = !initial ? route.params?.preset || null : null;

  const [name, setName] = useState(initial?.name || preset?.name || '');
  const [dose, setDose] = useState(initial?.dose || preset?.dose || '');
  const [times, setTimes] = useState(sortTimes(initial?.times || []));
  const [days, setDays] = useState(initial?.days || []);
  const [note, setNote] = useState(initial?.note || preset?.note || '');
  const [busy, setBusy] = useState(false);
  const [askTime, setAskTime] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: initial ? t('supp.editTitle') : t('supp.newTitle'),
    });
  }, [navigation, initial, t]);

  const toggleTime = (v) =>
    setTimes((prev) =>
      sortTimes(prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
    );

  const toggleDay = (d) =>
    setDays((prev) =>
      [...(prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])].sort(
        (a, b) => a - b
      )
    );

  const addCustomTime = (raw) => {
    const v = normalizeTime(raw);
    if (!v) {
      Alert.alert(t('supp.badTime'));
      return;
    }
    setTimes((prev) => sortTimes([...prev, v]));
  };

  const customTimes = times.filter((x) => !PRESET_TIMES.includes(x));
  const everyDay = days.length === 0 || days.length === 7;

  const onSave = async () => {
    const nm = name.trim();
    if (!nm) {
      Alert.alert(t('supp.nameRequired'));
      return;
    }
    setBusy(true);
    try {
      await saveSupplement({
        id: initial?.id,
        name: nm,
        dose,
        times: sortTimes(times),
        days: days.length === 7 ? [] : days,
        note,
        sort: initial?.sort ?? 0,
        active: initial?.active !== false,
      });
      if (sortTimes(times).length) requestNotifPermission().catch(() => {});
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('res.saveFail'), toUserMessage(e));
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(t('supp.deleteConfirm'), t('supp.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('supp.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSupplement(initial.id);
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
          <Text style={styles.label}>{t('supp.name_label')}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('supp.name_ph')}
              placeholderTextColor={c.textFaint}
              maxLength={60}
              autoFocus={!initial}
            />
          </View>

          <Text style={styles.label}>{t('supp.dose_label')}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={dose}
              onChangeText={setDose}
              placeholder={t('supp.dose_ph')}
              placeholderTextColor={c.textFaint}
              maxLength={40}
            />
          </View>

          <Text style={styles.section}>{t('supp.times_label')}</Text>
          <View style={styles.chipsWrap}>
            {PRESET_TIMES.map((v) => (
              <Chip
                key={v}
                label={v}
                active={times.includes(v)}
                onPress={() => toggleTime(v)}
              />
            ))}
            {customTimes.map((v) => (
              <Chip
                key={v}
                label={`${v}  ✕`}
                active
                onPress={() => toggleTime(v)}
              />
            ))}
            <Pressable style={styles.addChip} onPress={() => setAskTime(true)}>
              <Ionicons name="add" size={15} color={c.primary} />
              <Text style={styles.addChipText}>{t('supp.customTime')}</Text>
            </Pressable>
          </View>
          {times.length === 0 && (
            <Text style={styles.hint}>{t('supp.noTimeHint')}</Text>
          )}

          <Text style={styles.section}>{t('supp.days_label')}</Text>
          <View style={styles.chipsWrap}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Chip
                key={d}
                label={weekdayShort(d, locale)}
                active={!everyDay && days.includes(d)}
                onPress={() => toggleDay(d)}
              />
            ))}
          </View>
          <Text style={styles.hint}>
            {everyDay ? t('supp.everyday') : ''}
          </Text>

          <Text style={styles.label}>{t('supp.note_label')}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder={t('supp.note_ph')}
              placeholderTextColor={c.textFaint}
              maxLength={120}
            />
          </View>

          <Button
            label={t('supp.save')}
            onPress={onSave}
            loading={busy}
            size="lg"
            style={styles.save}
          />
          {initial ? (
            <Button
              label={t('supp.delete')}
              variant="danger"
              onPress={onDelete}
              style={styles.del}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <PromptModal
        visible={askTime}
        onClose={() => setAskTime(false)}
        onSubmit={(v) => {
          setAskTime(false);
          addCustomTime(v);
        }}
        title={t('supp.customTime')}
        placeholder={t('supp.customTime_ph')}
        confirmLabel={t('supp.save')}
        cancelLabel={t('common.cancel')}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 48 },
    section: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      marginTop: 20,
      marginBottom: 8,
    },
    label: { fontSize: 12, color: c.textMuted, marginTop: 16, marginBottom: 5 },
    inputWrap: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: c.inputBg,
    },
    input: { paddingVertical: 12, fontSize: 16, color: c.text },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    addChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      borderWidth: 1,
      borderColor: c.primary,
      borderStyle: 'dashed',
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    addChipText: { color: c.primary, fontWeight: '700', fontSize: 13 },
    hint: { fontSize: 12, color: c.textFaint, marginTop: 8, minHeight: 16 },
    save: { marginTop: 28 },
    del: { marginTop: 8 },
  });
