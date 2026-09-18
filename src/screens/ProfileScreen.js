import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import Screen from '../ui/Screen';

import { useAuth } from '../services/authContext';
import { getProfile, deleteAccount } from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';

// ИМТ = вес(кг) / рост(м)^2
function bmiOf(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [profile, setProfile] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getProfile()
        .then(setProfile)
        .catch((e) => console.warn('profile: getProfile', e?.message));
    }, [])
  );

  const activityLabel = {
    sedentary: t('onb.a_sedentary'),
    light: t('onb.a_light'),
    moderate: t('onb.a_moderate'),
    active: t('onb.a_active'),
    very_active: t('onb.a_veryActive'),
  };
  const goalLabel = {
    lose: t('onb.g_lose'),
    maintain: t('onb.g_maintain'),
    gain: t('onb.g_gain'),
  };

  const bmi = bmiOf(profile?.weight_kg, profile?.height_cm);
  const bmiCat =
    bmi == null
      ? null
      : bmi < 18.5
      ? t('prof.bmiUnder')
      : bmi < 25
      ? t('prof.bmiNormal')
      : bmi < 30
      ? t('prof.bmiOver')
      : t('prof.bmiObese');

  function confirmSignOut() {
    Alert.alert(t('prof.signOutConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('prof.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);
  }

  async function runDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      await signOut();
    } catch (e) {
      setDeleting(false);
      Alert.alert(t('prof.deleteAccount'), toUserMessage(e));
    }
  }

  function confirmDeleteAccount() {
    if (deleting) return;
    Alert.alert(t('prof.deleteAccount'), t('prof.deleteMsg1'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(t('prof.deleteConfirm2'), t('prof.deleteMsg2'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('prof.deleteForever'),
              style: 'destructive',
              onPress: runDelete,
            },
          ]);
        },
      },
    ]);
  }

  return (
    <Screen>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>{t('prof.account')}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('prof.subscription')}</Text>
        {profile?.is_pro ? (
          <Text style={styles.pro}>{t('prof.pro')}</Text>
        ) : (
          <>
            <Text style={styles.plan}>
              {profile
                ? t('prof.free', { n: profile.remaining, limit: profile.limit })
                : '…'}
            </Text>
            <Pressable
              style={styles.upgrade}
              onPress={() => navigation.navigate('Paywall')}
            >
              <Text style={styles.upgradeText}>{t('prof.upgrade')}</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('prof.goalSection')}</Text>
        {profile?.daily_kcal_goal ? (
          <>
            <Text style={styles.goalKcal}>
              {t('prof.perDay', { kcal: profile.daily_kcal_goal })}
            </Text>
            <Text style={styles.goalMeta}>
              {profile.sex === 'male' ? t('onb.male') : t('onb.female')} ·{' '}
              {profile.age} {t('onb.yrs')} · {profile.height_cm} {t('onb.cm')} ·{' '}
              {profile.weight_kg} {t('onb.kg')}
            </Text>
            {bmi != null && (
              <Text style={styles.goalMeta}>
                {t('prof.bmi')}: {bmi} — {bmiCat}
              </Text>
            )}
            <Text style={styles.goalMeta}>
              {activityLabel[profile.activity]} · {goalLabel[profile.goal]}
            </Text>
          </>
        ) : (
          <Text style={styles.soon}>{t('prof.notSet')}</Text>
        )}
        {profile?.target_weight_kg ? (
          <Text style={styles.goalMeta}>
            🎯 {t('goals.targetWeight')}: {profile.target_weight_kg} {t('onb.kg')}
          </Text>
        ) : null}
        <View style={styles.goalBtns}>
          <Pressable
            style={styles.editGoal}
            onPress={() =>
              navigation.navigate('EditGoal', { initial: profile ?? null })
            }
          >
            <Text style={styles.editGoalText}>{t('prof.editGoal')}</Text>
          </Pressable>
          <Pressable
            style={styles.editGoal}
            onPress={() => navigation.navigate('Goals')}
          >
            <Text style={styles.editGoalText}>🎯 {t('goals.title')}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        onPress={() => navigation.navigate('Weight')}
      >
        <Text style={styles.settingsText}>⚖️  {t('weight.title')}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        onPress={() => navigation.navigate('Trends')}
      >
        <Text style={styles.settingsText}>📈  {t('trends.title')}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        onPress={() => navigation.navigate('Achievements')}
      >
        <Text style={styles.settingsText}>🏆  {t('ach.title')}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        onPress={() => navigation.navigate('WeeklyReport')}
      >
        <Text style={styles.settingsText}>📊  {t('report.title')}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text style={styles.settingsText}>⚙️  {t('prof.settings')}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={styles.signOut} onPress={confirmSignOut}>
        <Text style={styles.signOutText}>{t('prof.signOut')}</Text>
      </Pressable>

      <Pressable
        style={styles.deleteAcc}
        onPress={confirmDeleteAccount}
        disabled={deleting}
      >
        <Text style={styles.deleteAccText}>
          {deleting ? t('prof.deleting') : t('prof.deleteAccount')}
        </Text>
      </Pressable>

      <Text style={styles.disclaimer}>{t('prof.disclaimer')}</Text>
    </ScrollView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16 },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    label: { fontSize: 13, color: c.textMuted, marginBottom: 6 },
    email: { fontSize: 16, fontWeight: '600', color: c.text },
    plan: { fontSize: 15, marginBottom: 12, color: c.text },
    pro: { fontSize: 15, fontWeight: '700', color: c.primary },
    upgrade: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    upgradeText: { color: c.onPrimary, fontWeight: '700' },
    soon: { fontSize: 14, color: c.textFaint },
    goalKcal: { fontSize: 18, fontWeight: '700', color: c.primary },
    goalMeta: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    goalBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
    editGoal: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    editGoalText: { color: c.primary, fontWeight: '600', fontSize: 13 },
    settingsRow: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    rowPressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
    settingsText: { fontSize: 15, fontWeight: '600', color: c.text },
    chevron: { fontSize: 22, color: c.textFaint },
    signOut: {
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 4,
    },
    signOutText: { color: c.danger, fontWeight: '700', fontSize: 15 },
    deleteAcc: { alignItems: 'center', paddingVertical: 10, marginTop: 2 },
    deleteAccText: { color: c.textFaint, fontWeight: '600', fontSize: 12 },
    disclaimer: {
      fontSize: 12,
      color: c.textFaint,
      textAlign: 'center',
      marginTop: 20,
    },
  });
