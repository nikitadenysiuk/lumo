import {
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

import { saveMeal } from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { useSelectedDay } from '../state/SelectedDayContext';
import MealTypePicker from '../components/MealTypePicker';
import { guessMealType } from '../lib/meals';
import { hSuccess } from '../lib/haptics';
import { checkDup } from '../lib/dupGuard';
import Screen from '../ui/Screen';
import Button from '../ui/Button';

const toN = (s) => Math.max(0, parseFloat(String(s).replace(',', '.')) || 0);

export default function QuickAddScreen({ navigation }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { selectedKey, isToday } = useSelectedDay();

  const [kcal, setKcal] = useState('');
  const [name, setName] = useState('');
  const [showMacros, setShowMacros] = useState(false);
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [mealType, setMealType] = useState(() =>
    guessMealType(isToday ? new Date() : new Date(`${selectedKey}T12:00:00`))
  );
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('quick.title') });
  }, [navigation, t]);

  async function save() {
    const kc = Math.round(toN(kcal));
    if (kc <= 0) return Alert.alert(t('quick.title'), t('quick.needKcal'));
    if (isToday && !(await checkDup(name.trim() || t('quick.default'), kc))) {
      return;
    }
    setBusy(true);
    try {
      await saveMeal({
        food_name: name.trim() || t('quick.default'),
        calories: kc,
        protein_g: showMacros ? toN(protein) : 0,
        fat_g: showMacros ? toN(fat) : 0,
        carbs_g: showMacros ? toN(carbs) : 0,
        meal_type: mealType,
        created_at: isToday
          ? undefined
          : new Date(`${selectedKey}T12:00:00`).toISOString(),
      });
      hSuccess();
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('quick.title'), toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

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
        <Text style={styles.bigLabel}>{t('quick.kcal')}</Text>
        <TextInput
          style={styles.bigInput}
          value={kcal}
          onChangeText={setKcal}
          keyboardType="number-pad"
          maxLength={5}
          placeholder="0"
          placeholderTextColor={c.textFaint}
          autoFocus
        />

        <Text style={styles.label}>{t('quick.name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('quick.default')}
          placeholderTextColor={c.textFaint}
          maxLength={60}
        />

        <MealTypePicker value={mealType} onChange={setMealType} />

        {showMacros ? (
          <View style={styles.macros}>
            {[
              [t('home.protein'), protein, setProtein],
              [t('home.fat'), fat, setFat],
              [t('home.carbs'), carbs, setCarbs],
            ].map(([lbl, val, setter]) => (
              <View key={lbl} style={styles.macroCell}>
                <Text style={styles.macroLabel}>
                  {lbl}, {t('res.g')}
                </Text>
                <TextInput
                  style={styles.macroInput}
                  value={val}
                  onChangeText={setter}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  placeholder="0"
                  placeholderTextColor={c.textFaint}
                />
              </View>
            ))}
          </View>
        ) : (
          <Pressable onPress={() => setShowMacros(true)} style={styles.addMacros}>
            <Text style={styles.addMacrosText}>＋ {t('quick.addMacros')}</Text>
          </Pressable>
        )}

        <Button
          label={busy ? t('common.saving') : t('common.save')}
          loading={busy}
          onPress={save}
          size="lg"
          style={styles.save}
        />
      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 40 },
    bigLabel: {
      fontSize: 12,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 8,
    },
    bigInput: {
      fontSize: 48,
      fontWeight: '800',
      color: c.primary,
      textAlign: 'center',
      paddingVertical: 6,
    },
    label: { fontSize: 12, color: c.textMuted, marginTop: 16, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.inputBg,
    },
    macros: { flexDirection: 'row', gap: 8 },
    macroCell: { flex: 1 },
    macroLabel: { fontSize: 11, color: c.textMuted, marginBottom: 4 },
    macroInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      textAlign: 'center',
      backgroundColor: c.inputBg,
    },
    addMacros: { alignItems: 'center', paddingVertical: 10 },
    addMacrosText: { color: c.primary, fontWeight: '600', fontSize: 13 },
    save: { marginTop: 22 },
  });
