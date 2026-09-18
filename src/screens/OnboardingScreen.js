import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { saveProfile, saveGoalOverrides } from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useAuth } from '../services/authContext';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { hSelect, hSuccess } from '../lib/haptics';
import { groupNum } from '../lib/format';
import { MACRO_COLORS } from '../theme/palettes';
import AnimatedNumber from '../components/AnimatedNumber';
import Screen from '../ui/Screen';

const ACTIVITY_KEYS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOAL_KEYS = ['lose', 'maintain', 'gain'];
const STEPS = ['sex', 'body', 'activity', 'goal'];

function StepField({ styles, c, label, value, onChange, suffix }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={5}
          placeholder="—"
          placeholderTextColor={c.textFaint}
        />
        <Text style={styles.fieldSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen({ navigation, route, onDone }) {
  const initial = route?.params?.initial ?? null;
  const isEdit = !!initial;
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState(null);
  const [manual, setManual] = useState(false);
  const [mKcal, setMKcal] = useState('');
  const [mProt, setMProt] = useState('');
  const [mFat, setMFat] = useState('');
  const [mCarbs, setMCarbs] = useState('');
  const [sex, setSex] = useState(initial?.sex ?? null);
  const [age, setAge] = useState(initial?.age ? String(initial.age) : '');
  const [height, setHeight] = useState(
    initial?.height_cm ? String(initial.height_cm) : ''
  );
  const [weight, setWeight] = useState(
    initial?.weight_kg ? String(initial.weight_kg) : ''
  );
  const [activity, setActivity] = useState(initial?.activity ?? null);
  const [goal, setGoal] = useState(initial?.goal ?? 'maintain');
  const [busy, setBusy] = useState(false);

  const activityMap = {
    sedentary: { label: t('onb.a_sedentary'), hint: t('onb.a_sedentaryHint') },
    light: { label: t('onb.a_light'), hint: t('onb.a_lightHint') },
    moderate: { label: t('onb.a_moderate'), hint: t('onb.a_moderateHint') },
    active: { label: t('onb.a_active'), hint: t('onb.a_activeHint') },
    very_active: { label: t('onb.a_veryActive'), hint: t('onb.a_veryActiveHint') },
  };
  const goalMap = {
    lose: t('onb.g_lose'),
    maintain: t('onb.g_maintain'),
    gain: t('onb.g_gain'),
  };

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const Segment = ({ label, active, onPress, big }) => (
    <Pressable
      style={[
        styles.segment,
        big && styles.segmentBig,
        active && styles.segmentActive,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </Pressable>
  );

  function validateStep() {
    if (cur === 'sex' && !sex) {
      Alert.alert(t('onb.pickSex'));
      return false;
    }
    if (cur === 'body') {
      const ageN = parseInt(age, 10);
      const heightN = parseInt(height, 10);
      const weightN = parseFloat(String(weight).replace(',', '.'));
      if (!Number.isFinite(ageN) || ageN < 10 || ageN > 120) {
        Alert.alert(t('onb.checkAge'), t('onb.checkAgeMsg'));
        return false;
      }
      if (!Number.isFinite(heightN) || heightN < 100 || heightN > 250) {
        Alert.alert(t('onb.checkHeight'), t('onb.checkHeightMsg'));
        return false;
      }
      if (!Number.isFinite(weightN) || weightN < 30 || weightN > 400) {
        Alert.alert(t('onb.checkWeight'), t('onb.checkWeightMsg'));
        return false;
      }
    }
    if (cur === 'activity' && !activity) {
      Alert.alert(t('onb.pickActivity'));
      return false;
    }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    if (isLast) return submit();
    hSelect();
    setStep((s) => s + 1);
  }

  function back() {
    hSelect();
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    setBusy(true);
    try {
      const updated = await saveProfile({
        sex,
        age: parseInt(age, 10),
        height_cm: parseInt(height, 10),
        weight_kg: parseFloat(String(weight).replace(',', '.')),
        activity,
        goal,
      });
      if (isEdit) {
        Alert.alert(
          t('onb.doneTitle'),
          t('onb.doneMsg', { kcal: updated.daily_kcal_goal })
        );
        navigation?.goBack();
      } else {
        hSuccess();
        setPlan(updated);
      }
    } catch (e) {
      Alert.alert(t('onb.saveFailed'), toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitManual() {
    const kc = parseInt(String(mKcal).replace(/\D/g, ''), 10);
    if (!Number.isFinite(kc) || kc < 800 || kc > 8000) {
      Alert.alert(t('onb.manualTitle'), t('onb.manualBadKcal'));
      return;
    }
    const g = (v) => {
      const n = parseInt(String(v).replace(/\D/g, ''), 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    setBusy(true);
    try {
      const updated = await saveGoalOverrides({
        kcal: kc,
        protein: g(mProt),
        fat: g(mFat),
        carbs: g(mCarbs),
        targetWeight: null,
      });
      if (!isEdit && !updated?.onboarded) {
        // не выполнена миграция db/15_skip_onboarding.sql
        console.warn('manual onboarding: profile not marked onboarded');
      }
      hSuccess();
      if (onDone) onDone(updated);
      else navigation?.goBack();
    } catch (e) {
      Alert.alert(t('onb.saveFailed'), toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (manual) {
    return (
      <Screen style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.top, { paddingTop: insets.top + 16 }]}>
            <Pressable
              style={styles.backBtn}
              onPress={() => setManual(false)}
              disabled={busy}
            >
              <Text style={styles.backText}>‹ {t('onb.back')}</Text>
            </Pressable>
            <Text style={styles.title}>{t('onb.manualTitle')}</Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>{t('onb.manualKcal')}</Text>
            <TextInput
              style={styles.manualKcalInput}
              value={mKcal}
              onChangeText={setMKcal}
              keyboardType="number-pad"
              maxLength={5}
              placeholder="2000"
              placeholderTextColor={c.textFaint}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
              {t('onb.manualMacros')}
            </Text>
            <View style={styles.row3}>
              {[
                [t('home.protein'), mProt, setMProt],
                [t('home.fat'), mFat, setMFat],
                [t('home.carbs'), mCarbs, setMCarbs],
              ].map(([lbl, val, setter]) => (
                <View key={lbl} style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {lbl}, {t('res.g')}
                  </Text>
                  <View style={styles.fieldInputWrap}>
                    <TextInput
                      style={styles.fieldInput}
                      value={val}
                      onChangeText={setter}
                      keyboardType="number-pad"
                      maxLength={4}
                      placeholder="—"
                      placeholderTextColor={c.textFaint}
                    />
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable
              style={[styles.nextBtn, busy && styles.dim]}
              onPress={submitManual}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={c.onPrimary} />
              ) : (
                <Text style={styles.nextText}>{t('onb.manualDone')}</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  if (plan) {
    return (
      <Screen style={styles.flex}>
        <LinearGradient
          colors={[c.primaryLight || '#FF9F6B', c.primaryDark]}
          style={styles.planHero}
        >
          <Text style={styles.planKicker}>{t('onb.planTitle')}</Text>
          <AnimatedNumber
            value={plan.daily_kcal_goal || 0}
            style={styles.planKcal}
            duration={900}
            format={(n) => groupNum(n)}
          />
          <Text style={styles.planUnit}>{t('onb.planKcal')}</Text>
        </LinearGradient>

        <View style={styles.planBody}>
          <Text style={styles.planMacrosLabel}>{t('onb.planMacros')}</Text>
          <View style={styles.planMacros}>
            {[
              [MACRO_COLORS.protein, t('home.protein'), plan.protein_goal],
              [MACRO_COLORS.fat, t('home.fat'), plan.fat_goal],
              [MACRO_COLORS.carbs, t('home.carbs'), plan.carbs_goal],
            ].map(([col, lbl, val]) => (
              <View key={lbl} style={styles.planMacro}>
                <View style={[styles.planDot, { backgroundColor: col }]} />
                <Text style={styles.planMacroVal}>{val || '—'} {t('res.g')}</Text>
                <Text style={styles.planMacroLbl}>{lbl}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={styles.planStart}
            onPress={() => (onDone ? onDone(plan) : navigation?.goBack())}
          >
            <Text style={styles.nextText}>{t('onb.start')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const stepTitle = {
    sex: t('onb.sex'),
    body: t('onb.stepBody'),
    activity: t('onb.activity'),
    goal: t('onb.goal'),
  }[cur];

  return (
    <Screen style={styles.flex}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.top, { paddingTop: isEdit ? 12 : insets.top + 16 }]}>
        <View style={styles.progress}>
          <View
            style={[
              styles.progressFill,
              { width: `${((step + 1) / STEPS.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.stepLabel}>
          {t('onb.step', { n: step + 1, total: STEPS.length })}
        </Text>
        <Text style={styles.title}>{stepTitle}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {cur === 'sex' && (
          <View style={styles.rowGap}>
            <Segment
              big
              label={t('onb.male')}
              active={sex === 'male'}
              onPress={() => setSex('male')}
            />
            <Segment
              big
              label={t('onb.female')}
              active={sex === 'female'}
              onPress={() => setSex('female')}
            />
          </View>
        )}

        {cur === 'body' && (
          <View style={styles.row3}>
            <StepField
              styles={styles}
              c={c}
              label={t('onb.age')}
              value={age}
              onChange={setAge}
              suffix={t('onb.yrs')}
            />
            <StepField
              styles={styles}
              c={c}
              label={t('onb.height')}
              value={height}
              onChange={setHeight}
              suffix={t('onb.cm')}
            />
            <StepField
              styles={styles}
              c={c}
              label={t('onb.weight')}
              value={weight}
              onChange={setWeight}
              suffix={t('onb.kg')}
            />
          </View>
        )}

        {cur === 'activity' &&
          ACTIVITY_KEYS.map((key) => (
            <Pressable
              key={key}
              style={[styles.optRow, activity === key && styles.optRowActive]}
              onPress={() => setActivity(key)}
            >
              <Text
                style={[
                  styles.optLabel,
                  activity === key && styles.optLabelActive,
                ]}
              >
                {activityMap[key].label}
              </Text>
              <Text style={styles.optHint}>{activityMap[key].hint}</Text>
            </Pressable>
          ))}

        {cur === 'goal' &&
          GOAL_KEYS.map((key) => (
            <Pressable
              key={key}
              style={[styles.optRow, goal === key && styles.optRowActive]}
              onPress={() => setGoal(key)}
            >
              <Text
                style={[
                  styles.optLabel,
                  goal === key && styles.optLabelActive,
                ]}
              >
                {goalMap[key]}
              </Text>
            </Pressable>
          ))}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.navRow}>
          {step > 0 ? (
            <Pressable style={styles.backBtn} onPress={back} disabled={busy}>
              <Text style={styles.backText}>‹ {t('onb.back')}</Text>
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}

          <Pressable
            style={[styles.nextBtn, busy && styles.dim]}
            onPress={next}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <Text style={styles.nextText}>
                {isLast
                  ? isEdit
                    ? t('onb.recalc')
                    : t('onb.submit')
                  : t('onb.next')}
              </Text>
            )}
          </Pressable>
        </View>

        {!isEdit && step === 0 && (
          <Pressable
            style={styles.signOut}
            onPress={() => {
              hSelect();
              setManual(true);
            }}
          >
            <Text style={styles.haveGoalText}>{t('onb.haveGoal')}</Text>
          </Pressable>
        )}
        {!isEdit && step === 0 && (
          <Pressable style={styles.signOut} onPress={() => signOut()}>
            <Text style={styles.signOutText}>{t('onb.signOut')}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    top: { paddingHorizontal: 20, paddingBottom: 8 },
    progress: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.barTrack,
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.primary,
    },
    stepLabel: {
      fontSize: 12,
      color: c.textMuted,
      fontWeight: '700',
      marginTop: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: c.text,
      marginTop: 4,
    },
    container: { padding: 20, paddingTop: 16 },
    rowGap: { flexDirection: 'row', gap: 12 },
    row3: { flexDirection: 'row', gap: 8 },
    segment: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    segmentBig: { paddingVertical: 28 },
    segmentActive: { backgroundColor: c.primary, borderColor: c.primary },
    segmentText: { fontWeight: '700', color: c.textMuted, fontSize: 15 },
    segmentTextActive: { color: c.onPrimary },
    field: { flex: 1 },
    fieldLabel: { fontSize: 12, color: c.textMuted, marginBottom: 4 },
    fieldInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: c.inputBg,
    },
    fieldInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: c.text },
    fieldSuffix: { fontSize: 13, color: c.textFaint },
    optRow: {
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.card,
      ...c.shadow,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    optRowActive: { borderColor: c.primary, backgroundColor: c.accentSoft },
    optLabel: { fontSize: 15, fontWeight: '700', color: c.text },
    optLabelActive: { color: c.dark ? c.text : c.primary },
    optHint: { fontSize: 12, color: c.textFaint, marginTop: 3 },
    bottom: {
      paddingHorizontal: 20,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
      backgroundColor: c.bg,
    },
    navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: {
      minWidth: 90,
      paddingVertical: 15,
      justifyContent: 'center',
    },
    backText: { color: c.textMuted, fontWeight: '700', fontSize: 15 },
    nextBtn: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    dim: { opacity: 0.6 },
    nextText: { color: c.onPrimary, fontWeight: '800', fontSize: 16 },
    planHero: {
      paddingTop: 72,
      paddingBottom: 40,
      alignItems: 'center',
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    planKicker: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 6,
    },
    planKcal: { color: '#fff', fontSize: 56, fontWeight: '900' },
    planUnit: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },
    planBody: { flex: 1, padding: 24, paddingTop: 32 },
    planMacrosLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      marginBottom: 16,
      textAlign: 'center',
    },
    planMacros: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 24,
    },
    planMacro: { alignItems: 'center' },
    planDot: { width: 9, height: 9, borderRadius: 5, marginBottom: 8 },
    planMacroVal: { fontSize: 18, fontWeight: '800', color: c.text },
    planMacroLbl: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    planStart: {
      alignSelf: 'stretch',
      marginTop: 'auto',
      marginBottom: 8,
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    signOut: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
    signOutText: { color: c.textFaint, fontWeight: '600' },
    haveGoalText: { color: c.primary, fontWeight: '700', fontSize: 13 },
    manualKcalInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingVertical: 14,
      fontSize: 34,
      fontWeight: '800',
      color: c.primary,
      textAlign: 'center',
      backgroundColor: c.inputBg,
    },
  });
