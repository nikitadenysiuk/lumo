import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import Screen from '../ui/Screen';
import Button from '../ui/Button';

import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';

const LOGO = require('../../assets/splash-icon.png');

// This is a visual stub. Real subscriptions (App Store + Google Play)
// go through RevenueCat — see README "Monetization" section.

export default function PaywallScreen({ navigation }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Screen style={styles.container}>
      <View style={styles.logoWrap}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </View>
      <Text style={styles.brand}>Lumo</Text>
      <Text style={styles.title}>{t('pay.title')}</Text>
      <Text style={styles.subtitle}>{t('pay.subtitle')}</Text>

      <View style={styles.plan}>
        <Text style={styles.planPrice}>{t('pay.priceMonth')}</Text>
        <Text style={styles.planNote}>{t('pay.priceYear')}</Text>
      </View>

      <Button
        label={t('pay.cta')}
        size="lg"
        onPress={() => {
          // TODO: Purchases.purchasePackage(selectedPackage)
          navigation.goBack();
        }}
        style={styles.cta}
      />

      <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
        <Text style={styles.dismiss}>{t('pay.later')}</Text>
      </Pressable>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    container: {
      padding: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoWrap: {
      width: 88,
      height: 88,
      borderRadius: 22,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    logo: { width: 56, height: 56 },
    brand: {
      fontSize: 15,
      fontWeight: '800',
      color: c.primary,
      letterSpacing: 0.5,
      marginBottom: 14,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 12,
      color: c.text,
    },
    subtitle: {
      fontSize: 15,
      color: c.textMuted,
      textAlign: 'center',
      marginBottom: 28,
    },
    plan: {
      backgroundColor: c.accentSoft,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 24,
      alignItems: 'center',
      marginBottom: 24,
      alignSelf: 'stretch',
    },
    planPrice: {
      fontSize: 20,
      fontWeight: '700',
      color: c.dark ? c.text : c.primary,
      textAlign: 'center',
    },
    planNote: {
      fontSize: 13,
      color: c.dark ? c.text : c.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    cta: { marginBottom: 14 },
    dismiss: { color: c.textMuted, fontSize: 14 },
  });
