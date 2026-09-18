import {
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { useKeepAwake } from 'expo-keep-awake';

import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import Screen from '../ui/Screen';

export default function CookModeScreen({ route, navigation }) {
  useKeepAwake();
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { title, steps = [] } = route.params || {};
  const [i, setI] = useState(0);

  useLayoutEffect(() => {
    navigation.setOptions({ title: title || t('recipe.cook') });
  }, [navigation, title, t]);

  if (!steps.length) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.done}>{t('recipe.noSteps')}</Text>
        </View>
      </Screen>
    );
  }

  const last = i === steps.length - 1;

  return (
    <Screen style={styles.container}>
      <View style={styles.progressRow}>
        {steps.map((_, k) => (
          <View
            key={k}
            style={[styles.dot, k <= i && { backgroundColor: c.primary }]}
          />
        ))}
      </View>

      <View style={styles.body}>
        <Text style={styles.counter}>
          {t('recipe.stepN', { n: i + 1, total: steps.length })}
        </Text>
        <Text style={styles.stepText}>{steps[i]}</Text>
      </View>

      <View style={styles.nav}>
        <Pressable
          style={[styles.navBtn, i === 0 && styles.navBtnOff]}
          onPress={() => setI((x) => Math.max(0, x - 1))}
          disabled={i === 0}
        >
          <Text style={styles.navText}>‹ {t('recipe.prev')}</Text>
        </Pressable>
        <Pressable
          style={[styles.navBtn, styles.navBtnPrimary]}
          onPress={() => {
            if (last) navigation.goBack();
            else setI((x) => x + 1);
          }}
        >
          <Text style={[styles.navText, styles.navTextPrimary]}>
            {last ? t('recipe.finish') : `${t('recipe.next')} ›`}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    container: { flex: 1, padding: 20 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    done: { color: c.textMuted, fontSize: 15 },
    progressRow: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      marginTop: 8,
    },
    dot: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.divider,
      maxWidth: 40,
    },
    body: { flex: 1, justifyContent: 'center' },
    counter: {
      fontSize: 13,
      fontWeight: '700',
      color: c.primary,
      marginBottom: 12,
      textAlign: 'center',
    },
    stepText: {
      fontSize: 24,
      lineHeight: 34,
      fontWeight: '600',
      color: c.text,
      textAlign: 'center',
    },
    nav: { flexDirection: 'row', gap: 12 },
    navBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    navBtnOff: { opacity: 0.4 },
    navBtnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
    navText: { fontSize: 15, fontWeight: '700', color: c.text },
    navTextPrimary: { color: c.onPrimary },
  });
