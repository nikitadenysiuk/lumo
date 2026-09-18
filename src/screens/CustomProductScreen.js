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

import { addFavorite } from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import Screen from '../ui/Screen';
import Button from '../ui/Button';

const toN = (s) => Math.max(0, parseFloat(String(s).replace(',', '.')) || 0);

function Field({ styles, c, label, value, onChange, unit, kb = 'decimal-pad' }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType={kb}
          maxLength={kb === 'default' ? 60 : 6}
          placeholderTextColor={c.textFaint}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

export default function CustomProductScreen({ navigation }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('custom.title') });
  }, [navigation, t]);

  function buildProduct() {
    const nm = name.trim();
    if (!nm) {
      Alert.alert(t('custom.title'), t('custom.needName'));
      return null;
    }
    const kc = Math.round(toN(kcal));
    if (kc <= 0) {
      Alert.alert(t('custom.title'), t('custom.needKcal'));
      return null;
    }
    return {
      barcode: null,
      name: nm,
      brand: brand.trim(),
      per100: {
        calories: kc,
        protein_g: toN(protein),
        carbs_g: toN(carbs),
        fat_g: toN(fat),
      },
      servingSizeG: 100,
      imageUrl: null,
      items: null,
      custom: true,
    };
  }

  async function saveOnly() {
    const product = buildProduct();
    if (!product) return;
    setBusy(true);
    try {
      await addFavorite({
        title: product.brand ? `${product.name} (${product.brand})` : product.name,
        calories: product.per100.calories,
        payload: product,
        kind: 'product',
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('custom.title'), toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function toDiary() {
    const product = buildProduct();
    if (!product) return;
    navigation.replace('BarcodeResult', { product });
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
        <Field
          styles={styles}
          c={c}
          label={t('custom.name')}
          value={name}
          onChange={setName}
          kb="default"
        />
        <Field
          styles={styles}
          c={c}
          label={t('custom.brand')}
          value={brand}
          onChange={setBrand}
          kb="default"
        />

        <Text style={styles.section}>{t('custom.per100')}</Text>
        <Field
          styles={styles}
          c={c}
          label={t('home.kcalShort')}
          value={kcal}
          onChange={setKcal}
        />
        <View style={styles.row3}>
          <Field
            styles={styles}
            c={c}
            label={t('home.protein')}
            value={protein}
            onChange={setProtein}
            unit={t('res.g')}
          />
          <Field
            styles={styles}
            c={c}
            label={t('home.fat')}
            value={fat}
            onChange={setFat}
            unit={t('res.g')}
          />
          <Field
            styles={styles}
            c={c}
            label={t('home.carbs')}
            value={carbs}
            onChange={setCarbs}
            unit={t('res.g')}
          />
        </View>

        <Button
          label={t('custom.toDiary')}
          loading={busy}
          onPress={toDiary}
          size="lg"
          style={styles.primary}
        />
        <Button
          label={t('custom.saveOnly')}
          variant="ghost"
          disabled={busy}
          onPress={saveOnly}
          style={styles.secondary}
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
    section: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      marginTop: 18,
      marginBottom: 4,
    },
    field: { flex: 1, marginTop: 10 },
    label: { fontSize: 12, color: c.textMuted, marginBottom: 4 },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: c.inputBg,
    },
    input: { flex: 1, paddingVertical: 11, fontSize: 16, color: c.text },
    unit: { fontSize: 13, color: c.textFaint, marginLeft: 4 },
    row3: { flexDirection: 'row', gap: 8 },
    primary: { marginTop: 24 },
    secondary: { marginTop: 4 },
  });
