import { useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '../services/authContext';
import {
  signInWithOAuth,
  signInWithApple,
  isAppleAvailable,
} from '../services/socialAuth';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { toUserMessage } from '../services/errors';
import { PRIVACY_URL, TERMS_URL } from '../config/legal';
import { hSuccess } from '../lib/haptics';
import Screen from '../ui/Screen';
import Button from '../ui/Button';

export default function AuthScreen() {
  const { signIn, signUp, resendConfirmation } = useAuth();
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [social, setSocial] = useState(null); // 'google' | 'apple' | 'facebook'
  const [appleOk, setAppleOk] = useState(false);

  const isSignup = mode === 'signup';
  const anyBusy = busy || !!social;

  useEffect(() => {
    isAppleAvailable().then(setAppleOk);
  }, []);

  function openLegal(url) {
    if (!url) {
      Alert.alert(t('set.legal'), t('set.legalSoon'));
      return;
    }
    WebBrowser.openBrowserAsync(url).catch(() => {});
  }

  function translateAuthError(msg = '') {
    const m = msg.toLowerCase();
    if (m.includes('invalid login credentials')) return t('auth.e_invalid');
    if (m.includes('user already registered')) return t('auth.e_userExists');
    if (m.includes('email not confirmed')) return t('auth.e_notConfirmed');
    if (m.includes('unable to validate email address')) return t('auth.e_badEmail');
    if (m.includes('password should be at least')) return t('auth.e_shortPwd');
    if (m.includes('network') || m.includes('fetch')) return t('auth.e_network');
    return msg;
  }

  async function handleResend() {
    const em = email.trim();
    if (!em) return;
    try {
      const { error } = await resendConfirmation(em);
      if (error) throw error;
      Alert.alert(t('auth.resendSent'), t('auth.resendSentMsg', { email: em }));
    } catch (e) {
      Alert.alert(t('auth.failTitle'), toUserMessage(e));
    }
  }

  async function handleSubmit() {
    if (!email.trim() || !password) {
      Alert.alert(t('auth.needFields'), t('auth.needFieldsMsg'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('auth.shortPwd'), t('auth.shortPwdMsg'));
      return;
    }

    setBusy(true);
    try {
      const fn = isSignup ? signUp : signIn;
      const { data, error } = await fn(email.trim(), password);

      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.includes('not confirmed')) {
          Alert.alert(t('auth.e_notConfirmed'), t('auth.confirmEmailMsg'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('auth.resend'), onPress: handleResend },
          ]);
          return;
        }
        Alert.alert(t('auth.failTitle'), translateAuthError(error.message));
        return;
      }

      if (isSignup && !data.session) {
        Alert.alert(t('auth.almostDone'), t('auth.confirmEmailMsg'), [
          { text: t('auth.resend'), onPress: handleResend },
          { text: t('common.ok') },
        ]);
        setMode('signin');
        setPassword('');
        return;
      }
    } catch (e) {
      Alert.alert(t('auth.errorTitle'), toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider) {
    if (anyBusy) return;
    setSocial(provider);
    try {
      const res = await signInWithOAuth(provider);
      if (res === 'ok') hSuccess();
    } catch (e) {
      Alert.alert(t('auth.failTitle'), t('auth.socialFail'));
    } finally {
      setSocial(null);
    }
  }

  async function handleApple() {
    if (anyBusy) return;
    setSocial('apple');
    try {
      await signInWithApple();
      hSuccess();
    } catch (e) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(t('auth.failTitle'), t('auth.socialFail'));
      }
    } finally {
      setSocial(null);
    }
  }

  return (
    <Screen style={styles.flex}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Lumo</Text>
        <Text style={styles.subtitle}>
          {isSignup ? t('auth.signUpTitle') : t('auth.signInTitle')}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          placeholderTextColor={c.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!anyBusy}
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          placeholderTextColor={c.textFaint}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          editable={!anyBusy}
        />

        <Button
          label={isSignup ? t('auth.signUp') : t('auth.signIn')}
          loading={busy}
          disabled={anyBusy}
          onPress={handleSubmit}
          size="lg"
          style={styles.button}
        />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>{t('auth.or')}</Text>
          <View style={styles.divider} />
        </View>

        <SocialButton
          styles={styles}
          c={c}
          icon="logo-google"
          label={t('auth.withGoogle')}
          loading={social === 'google'}
          disabled={anyBusy}
          onPress={() => handleOAuth('google')}
        />
        <SocialButton
          styles={styles}
          c={c}
          icon="logo-facebook"
          label={t('auth.withFacebook')}
          loading={social === 'facebook'}
          disabled={anyBusy}
          onPress={() => handleOAuth('facebook')}
        />
        {appleOk && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              c.dark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={styles.appleBtn}
            onPress={handleApple}
          />
        )}

        <Pressable
          onPress={() => setMode(isSignup ? 'signin' : 'signup')}
          disabled={anyBusy}
          style={styles.switch}
        >
          <Text style={styles.switchText}>
            {isSignup ? t('auth.toSignIn') : t('auth.toSignUp')}
          </Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Text style={styles.legalText}>{t('auth.legalPre')} </Text>
          <Pressable onPress={() => openLegal(TERMS_URL)} hitSlop={6}>
            <Text style={styles.legalLink}>{t('set.terms')}</Text>
          </Pressable>
          <Text style={styles.legalText}> {t('auth.legalAnd')} </Text>
          <Pressable onPress={() => openLegal(PRIVACY_URL)} hitSlop={6}>
            <Text style={styles.legalLink}>{t('set.privacy')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  );
}

function SocialButton({ styles, c, icon, label, loading, disabled, onPress }) {
  return (
    <Pressable
      style={[styles.social, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {loading ? (
        <ActivityIndicator color={c.text} />
      ) : (
        <>
          <Ionicons name={icon} size={20} color={c.text} style={styles.socialIcon} />
          <Text style={styles.socialText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 24, paddingVertical: 48, justifyContent: 'center', flexGrow: 1 },
    title: { fontSize: 32, fontWeight: '800', textAlign: 'center', color: c.primary },
    subtitle: {
      fontSize: 15,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 28,
    },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      marginBottom: 12,
      color: c.text,
      backgroundColor: c.inputBg,
    },
    button: { marginTop: 4 },
    disabled: { opacity: 0.6 },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginVertical: 20,
    },
    divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.divider },
    dividerText: { fontSize: 12, color: c.textFaint, fontWeight: '600' },
    social: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingVertical: 13,
      marginBottom: 10,
      backgroundColor: c.card,
    },
    socialIcon: {},
    socialText: { fontSize: 15, fontWeight: '700', color: c.text },
    appleBtn: { height: 48, marginBottom: 10 },
    switch: { marginTop: 16, alignItems: 'center' },
    switchText: { color: c.primary, fontWeight: '600' },
    legalRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 22,
    },
    legalText: { color: c.textFaint, fontSize: 11 },
    legalLink: { color: c.textMuted, fontSize: 11, fontWeight: '700' },
  });
