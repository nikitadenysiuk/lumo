// src/screens/SupplementRecoScreen.js
//
// Мастер подбора добавок: тренер задаёт вопросы, по ответам и тому, что уже
// принимаешь, советует добавки. Результат кэшируется (coach_cards kind='supp_reco').

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Text } from '../ui/Text';
import Screen from '../ui/Screen';
import { generateSupplementReco } from '../services/aiService';
import { fetchSupplements, saveSupplementReco } from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { hSelect } from '../lib/haptics';

const STEPS = ['goal', 'diet', 'experience'];
const OPTS = {
  goal: ['muscle', 'lose', 'energy', 'health', 'sleep'],
  diet: ['normal', 'vegetarian', 'vegan', 'lowfish', 'lowsun'],
  experience: ['basics', 'advanced'],
};

export default function SupplementRecoScreen({ navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const scrollRef = useRef(null);

  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('reco.wizardTitle') });
  }, [navigation, t]);

  const key = STEPS[step];

  const finish = async (final) => {
    setBusy(true);
    try {
      const list = await fetchSupplements().catch(() => []);
      const names = list
        .filter((s) => s.active !== false)
        .map((s) => s.name)
        .filter(Boolean);
      const reco = await generateSupplementReco(final, names);
      if (!reco.items.length) throw new Error(t('reco.genFail'));
      await saveSupplementReco(locale, reco);
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
      <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
        <View style={[styles.bubble, styles.coach]}>
          <Text style={styles.bubbleText}>{t('reco.intro')}</Text>
        </View>

        {STEPS.slice(0, step).map((k) => (
          <View key={k}>
            <View style={[styles.bubble, styles.coach]}>
              <Text style={styles.bubbleText}>{t(`reco.q_${k}`)}</Text>
            </View>
            <View style={[styles.bubble, styles.user]}>
              <Text style={[styles.bubbleText, styles.userText]}>
                {t(`reco.o_${answers[k]}`)}
              </Text>
            </View>
          </View>
        ))}

        {!busy ? (
          <>
            <View style={[styles.bubble, styles.coach]}>
              <Text style={styles.bubbleText}>{t(`reco.q_${key}`)}</Text>
            </View>
            <View style={styles.opts}>
              {OPTS[key].map((v) => (
                <Pressable key={v} style={styles.opt} onPress={() => pick(v)}>
                  <Text style={styles.optText}>{t(`reco.o_${v}`)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.building}>
            <ActivityIndicator color={c.primary} />
            <Text style={styles.buildingText}>{t('reco.building')}</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
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

    building: { alignItems: 'center', gap: 12, paddingVertical: 40 },
    buildingText: { fontSize: 13, color: c.textMuted },
  });
