// src/screens/PlanWizardScreen.js
//
// Мастер составления плана тренировок: тренер задаёт вопросы, по ответам
// генерирует недельный план (см. aiService.generateWorkoutPlan, db/22_workout_plans.sql).

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import Screen from '../ui/Screen';
import Button from '../ui/Button';
import { generateWorkoutPlan } from '../services/aiService';
import { saveWorkoutPlan } from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { hSelect } from '../lib/haptics';

const STEPS = ['goal', 'level', 'days', 'place', 'duration', 'limits'];
const OPTS = {
  goal: ['muscle', 'lose', 'strength', 'endurance', 'fit'],
  level: ['beginner', 'mid', 'advanced'],
  days: ['2', '3', '4', '5'],
  place: ['gym', 'home_db', 'home_bw', 'outdoor'],
  duration: ['30', '45', '60', '90'],
};

export default function PlanWizardScreen({ navigation }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const scrollRef = useRef(null);

  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [limits, setLimits] = useState('');
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('plan.wizardTitle') });
  }, [navigation, t]);

  const key = STEPS[step];

  const optLabel = (k, v) => {
    if (k === 'days') return v === '5' ? '5+' : v;
    if (k === 'duration') return `${v} ${t('workout.min')}`;
    return t(`plan.o_${v}`);
  };

  const finish = async (final) => {
    setBusy(true);
    try {
      const plan = await generateWorkoutPlan(final);
      if (!plan.days.length) throw new Error(t('plan.genFail'));
      await saveWorkoutPlan(plan.title, plan);
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('res.saveFail'), toUserMessage(e));
      setBusy(false);
    }
  };

  const pick = (v) => {
    hSelect();
    const next = { ...answers, [key]: v };
    setAnswers(next);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } else {
      finish(next);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.bubble, styles.coach]}>
            <Text style={styles.bubbleText}>{t('plan.intro')}</Text>
          </View>

          {STEPS.slice(0, step).map((k) => (
            <View key={k}>
              <View style={[styles.bubble, styles.coach]}>
                <Text style={styles.bubbleText}>{t(`plan.q_${k}`)}</Text>
              </View>
              <View style={[styles.bubble, styles.user]}>
                <Text style={[styles.bubbleText, styles.userText]}>
                  {k === 'limits'
                    ? answers.limits
                      ? answers.limits
                      : t('plan.skip')
                    : optLabel(k, answers[k])}
                </Text>
              </View>
            </View>
          ))}

          {!busy ? (
            <>
              <View style={[styles.bubble, styles.coach]}>
                <Text style={styles.bubbleText}>{t(`plan.q_${key}`)}</Text>
              </View>

              {key === 'limits' ? (
                <View style={styles.limitsWrap}>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      value={limits}
                      onChangeText={setLimits}
                      placeholder={t('plan.limits_ph')}
                      placeholderTextColor={c.textFaint}
                      multiline
                      maxLength={200}
                    />
                  </View>
                  <View style={styles.limitsBtns}>
                    <Button
                      label={t('plan.skip')}
                      variant="secondary"
                      onPress={() => pick('')}
                      fullWidth={false}
                    />
                    <Button
                      label={t('plan.done')}
                      onPress={() => pick(limits.trim())}
                      fullWidth={false}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.opts}>
                  {OPTS[key].map((v) => (
                    <Pressable key={v} style={styles.opt} onPress={() => pick(v)}>
                      <Text style={styles.optText}>{optLabel(key, v)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.building}>
              <ActivityIndicator color={c.primary} />
              <Text style={styles.buildingText}>{t('plan.building')}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { padding: 16, paddingBottom: 40, gap: 10 },

    bubble: {
      maxWidth: '86%',
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 13,
    },
    coach: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
    },
    user: {
      backgroundColor: c.primary,
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
      marginTop: 6,
    },
    bubbleText: { fontSize: 14.5, color: c.text, lineHeight: 20 },
    userText: { color: c.onPrimary },

    opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    opt: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    optText: { fontSize: 14, fontWeight: '700', color: c.primary },

    limitsWrap: { gap: 10, marginTop: 4 },
    inputWrap: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: c.inputBg,
    },
    input: { paddingVertical: 12, fontSize: 15, color: c.text, minHeight: 60 },
    limitsBtns: { flexDirection: 'row', gap: 10 },

    building: { alignItems: 'center', gap: 12, paddingVertical: 40 },
    buildingText: { fontSize: 13, color: c.textMuted },
  });
