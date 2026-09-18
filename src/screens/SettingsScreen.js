import {
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import appJson from '../../app.json';

import { useT } from '../i18n/LocaleContext';
import { LANGUAGE_NAMES } from '../i18n';
import {
  useSettings,
  WATER_GOAL_MIN,
  WATER_GOAL_MAX,
  FAST_GOAL_MIN,
  FAST_GOAL_MAX,
} from '../settings/SettingsContext';
import { enableReminders, disableReminders } from '../services/notifications';
import { exportDiaryCsv } from '../services/exportDiary';
import { toUserMessage } from '../services/errors';
import { PRIVACY_URL, TERMS_URL } from '../config/legal';
import Screen from '../ui/Screen';
import Chip from '../ui/Chip';
import * as WebBrowser from 'expo-web-browser';

export default function SettingsScreen() {
  const { t, locale, supported, setLocale } = useT();
  const {
    c,
    theme,
    setTheme,
    themeOptions,
    units,
    setUnits,
    notifications,
    setNotifications,
    waterGoal,
    setWaterGoal,
    fastGoal,
    setFastGoal,
    accent,
    setAccent,
    accents,
    waterReminder,
    setWaterReminder,
    workoutBalance,
    setWorkoutBalance,
    motivationPush,
    setMotivationPush,
  } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [exporting, setExporting] = useState(false);

  async function onExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await exportDiaryCsv();
      if (res.empty) Alert.alert(t('set.exportCsv'), t('set.exportEmpty'));
      else if (!res.shared) {
        Alert.alert(t('set.exportCsv'), t('set.exportSaved', { n: res.count }));
      }
    } catch (e) {
      Alert.alert(t('set.exportCsv'), toUserMessage(e));
    } finally {
      setExporting(false);
    }
  }

  const themeLabel = {
    system: t('set.themeSystem'),
    light: t('set.themeLight'),
    dark: t('set.themeDark'),
  };

  async function toggleNotifications(on) {
    setNotifications(on);
    if (on) {
      const ok = await enableReminders();
      if (!ok) {
        setNotifications(false);
        Alert.alert(t('set.notifDenied'), t('set.notifDeniedMsg'));
      }
    } else {
      disableReminders();
    }
  }

  function openLegal(url) {
    if (!url) {
      Alert.alert(t('set.legal'), t('set.legalSoon'));
      return;
    }
    WebBrowser.openBrowserAsync(url).catch((e) =>
      Alert.alert(t('set.legal'), toUserMessage(e))
    );
  }

  async function toggleWaterReminder(on) {
    setWaterReminder(on);
    if (on) {
      const ok = await enableReminders();
      if (!ok) {
        setWaterReminder(false);
        Alert.alert(t('set.notifDenied'), t('set.notifDeniedMsg'));
      }
    }
  }

  return (
    <Screen>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.section}>{t('set.theme')}</Text>
      <View style={styles.card}>
        <View style={styles.chips}>
          {themeOptions.map((key) => (
            <Chip
              key={key}
              label={themeLabel[key]}
              active={theme === key}
              onPress={() => setTheme(key)}
            />
          ))}
        </View>
      </View>

      <Text style={styles.section}>{t('set.accent')}</Text>
      <View style={styles.card}>
        <View style={styles.swatches}>
          {accents.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => setAccent(a.id)}
              hitSlop={6}
              style={[
                styles.swatch,
                { backgroundColor: a.primary },
                accent === a.id && styles.swatchActive,
              ]}
            >
              {accent === a.id && <Text style={styles.swatchCheck}>✓</Text>}
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.section}>{t('set.units')}</Text>
      <View style={styles.card}>
        <View style={styles.chips}>
          <Chip
            label={t('set.unitsMetric')}
            active={units === 'metric'}
            onPress={() => setUnits('metric')}
          />
          <Chip
            label={t('set.unitsImperial')}
            active={units === 'imperial'}
            onPress={() => setUnits('imperial')}
          />
        </View>
      </View>

      <Text style={styles.section}>{t('set.language')}</Text>
      <View style={styles.card}>
        <View style={styles.chips}>
          {supported.map((code) => (
            <Chip
              key={code}
              label={LANGUAGE_NAMES[code]}
              active={locale === code}
              onPress={() => setLocale(code)}
            />
          ))}
        </View>
      </View>

      <Text style={styles.section}>{t('set.notifications')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('set.notifDesc')}</Text>
          <Switch value={notifications} onValueChange={toggleNotifications} />
        </View>
        <View style={[styles.row, styles.rowGap]}>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>{t('set.motivationPush')}</Text>
            <Text style={styles.rowHint}>{t('set.motivationPushHint')}</Text>
          </View>
          <Switch value={motivationPush} onValueChange={setMotivationPush} />
        </View>
      </View>

      <Text style={styles.section}>{t('water.title')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('water.goalLabel')}</Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setWaterGoal(waterGoal - 1)}
              disabled={waterGoal <= WATER_GOAL_MIN}
            >
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <Text style={styles.stepVal}>{waterGoal}</Text>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setWaterGoal(waterGoal + 1)}
              disabled={waterGoal >= WATER_GOAL_MAX}
            >
              <Text style={styles.stepTxt}>＋</Text>
            </Pressable>
          </View>
        </View>
        <View style={[styles.row, styles.rowGap]}>
          <Text style={styles.rowLabel}>{t('set.waterReminder')}</Text>
          <Switch value={waterReminder} onValueChange={toggleWaterReminder} />
        </View>
      </View>

      <Text style={styles.section}>{t('fast.title')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('fast.window')}</Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepBtn}
              onPress={() =>
                setFastGoal(fastGoal <= FAST_GOAL_MIN ? 0 : fastGoal - 1)
              }
              disabled={fastGoal === 0}
            >
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <Text style={styles.stepVal}>
              {fastGoal === 0 ? t('fast.off') : `${fastGoal} ${t('fast.h')}`}
            </Text>
            <Pressable
              style={styles.stepBtn}
              onPress={() =>
                setFastGoal(fastGoal === 0 ? FAST_GOAL_MIN : fastGoal + 1)
              }
              disabled={fastGoal >= FAST_GOAL_MAX}
            >
              <Text style={styles.stepTxt}>＋</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Text style={styles.section}>{t('set.workoutSection')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>{t('set.workoutBalance')}</Text>
            <Text style={styles.rowHint}>{t('set.workoutBalanceHint')}</Text>
          </View>
          <Switch value={workoutBalance} onValueChange={setWorkoutBalance} />
        </View>
      </View>

      <Text style={styles.section}>{t('set.data')}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={onExport} disabled={exporting}>
          <Text style={styles.rowLabel}>{t('set.exportCsv')}</Text>
          {exporting ? (
            <ActivityIndicator color={c.textMuted} />
          ) : (
            <Text style={styles.rowValue}>⤓</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.section}>{t('set.legal')}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => openLegal(PRIVACY_URL)}>
          <Text style={styles.rowLabel}>{t('set.privacy')}</Text>
          <Text style={styles.rowValue}>›</Text>
        </Pressable>
        <Pressable
          style={[styles.row, styles.rowGap]}
          onPress={() => openLegal(TERMS_URL)}
        >
          <Text style={styles.rowLabel}>{t('set.terms')}</Text>
          <Text style={styles.rowValue}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>{t('set.about')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('set.version')}</Text>
          <Text style={styles.rowValue}>{appJson.expo?.version ?? '1.0.0'}</Text>
        </View>
        <Text style={styles.disclaimer}>{t('prof.disclaimer')}</Text>
      </View>
    </ScrollView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 32 },
    section: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      marginTop: 18,
      marginBottom: 8,
      marginLeft: 4,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchActive: {
      borderWidth: 2,
      borderColor: c.text,
    },
    swatchCheck: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowGap: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    rowLabel: { color: c.text, fontSize: 14, flex: 1, marginRight: 12 },
    rowValue: { color: c.textMuted, fontSize: 14 },
    rowTextWrap: { flex: 1, marginRight: 12 },
    rowHint: { color: c.textMuted, fontSize: 12, marginTop: 3, lineHeight: 16 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    stepBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepTxt: { fontSize: 17, fontWeight: '800', color: c.primary },
    stepVal: {
      fontSize: 15,
      fontWeight: '800',
      color: c.text,
      minWidth: 52,
      textAlign: 'center',
    },
    disclaimer: { color: c.textFaint, fontSize: 12, marginTop: 12 },
  });
