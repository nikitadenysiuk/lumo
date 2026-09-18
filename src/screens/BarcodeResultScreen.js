import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

import {
  saveMeal,
  fetchFavorites,
  addFavorite,
  deleteFavorite,
} from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme, useSettings } from '../settings/SettingsContext';
import { useSelectedDay } from '../state/SelectedDayContext';
import IngredientEditor from '../components/IngredientEditor';
import MealTypePicker from '../components/MealTypePicker';
import { sumItems, fromGrams, toGrams } from '../lib/nutrition';
import { guessMealType } from '../lib/meals';
import { productKey, getPortion, setPortion } from '../lib/portionMemory';
import { checkDup } from '../lib/dupGuard';
import { hSuccess } from '../lib/haptics';
import SuccessCheck from '../components/SuccessCheck';
import Screen from '../ui/Screen';
import Button from '../ui/Button';

const round1 = (n) => Math.round(n * 10) / 10;
const toN = (s) => Math.max(0, parseFloat(String(s).replace(',', '.')) || 0);

export default function BarcodeResultScreen({ route, navigation }) {
  const { t } = useT();
  const c = useTheme();
  const { units } = useSettings();
  const { selectedKey, isToday } = useSelectedDay();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { product } = route.params;
  const imperial = units === 'imperial';
  const [mealType, setMealType] = useState(() =>
    guessMealType(isToday ? new Date() : new Date(`${selectedKey}T12:00:00`))
  );

  const multi = (product.items?.length ?? 0) > 1;
  const title = product.brand
    ? `${product.name} (${product.brand})`
    : product.name;

  const [keepPhoto, setKeepPhoto] = useState(!!product.imageUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [favId, setFavId] = useState(null);

  useEffect(() => {
    fetchFavorites()
      .then((list) => {
        const f = list.find((x) => x.title === title);
        if (f) setFavId(f.id);
      })
      .catch((e) => console.warn('favorites', e?.message));
  }, [title]);

  async function toggleFav() {
    try {
      if (favId) {
        await deleteFavorite(favId);
        setFavId(null);
      } else {
        const f = await addFavorite({
          title,
          calories: product.per100?.calories,
          payload: product,
        });
        setFavId(f.id);
      }
    } catch (e) {
      Alert.alert(t('nav.tabFood'), toUserMessage(e));
    }
  }

  // --- режим ингредиентов ---
  const [scaledItems, setScaledItems] = useState(multi ? product.items : []);
  const itemTotals = sumItems(scaledItems);

  // --- режим одной позиции (продукт из базы, per 100 г) ---
  const pKey = useMemo(() => productKey(product), [product]);
  const [amount, setAmount] = useState(
    String(fromGrams(product.servingSizeG || 100, imperial))
  );
  const amountTouched = useRef(false);
  const g1 = toGrams(toN(amount), imperial);

  // подставить запомненную порцию (если юзер ещё не трогал поле)
  useEffect(() => {
    let alive = true;
    if (multi || !pKey) return;
    getPortion(pKey).then((g) => {
      if (alive && g && !amountTouched.current) {
        setAmount(String(fromGrams(g, imperial)));
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pKey, multi, imperial]);
  const single = useMemo(
    () => ({
      calories: Math.round(product.per100.calories * (g1 / 100)),
      protein_g: round1(product.per100.protein_g * (g1 / 100)),
      carbs_g: round1(product.per100.carbs_g * (g1 / 100)),
      fat_g: round1(product.per100.fat_g * (g1 / 100)),
    }),
    [product, g1]
  );

  const values = multi ? itemTotals : single;

  const Pill = ({ label, value }) => (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );

  async function handleSave() {
    if (!multi && g1 <= 0) return Alert.alert(t('bc.needWeight'));
    if (isToday && !(await checkDup(title, values.calories))) return;
    setSaving(true);
    try {
      await saveMeal({
        food_name: title,
        calories: values.calories,
        protein_g: values.protein_g,
        carbs_g: values.carbs_g,
        fat_g: values.fat_g,
        photo_url: keepPhoto ? product.imageUrl : null,
        items: multi ? scaledItems : null,
        meal_type: mealType,
        created_at: isToday
          ? undefined
          : new Date(`${selectedKey}T12:00:00`).toISOString(),
      });
      if (!multi) setPortion(pKey, g1);
      hSuccess();
      setSaved(true); // saving остаётся true до конца анимации «галочки»
    } catch (e) {
      Alert.alert(t('bc.saveFail'), toUserMessage(e));
      setSaving(false);
    }
  }

  return (
    <Screen style={styles.root}>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.photo} />
      ) : null}

      <View style={styles.nameRow}>
        <Text style={styles.name}>{title}</Text>
        <Pressable onPress={toggleFav} hitSlop={10} style={styles.star}>
          <Text style={[styles.starText, favId && styles.starOn]}>
            {favId ? '★' : '☆'}
          </Text>
        </Pressable>
      </View>
      {product.aiConfidence ? (
        <Text style={styles.aiBadge}>🤖 {t('food.aiBadge')}</Text>
      ) : null}

      {!multi && (
        <Text style={styles.per100}>
          {t('bc.per100', {
            kcal: product.per100.calories,
            p: round1(product.per100.protein_g),
            f: round1(product.per100.fat_g),
            c: round1(product.per100.carbs_g),
          })}
        </Text>
      )}

      <View style={styles.caloriesBox}>
        <Text style={styles.caloriesNumber}>{values.calories}</Text>
        <Text style={styles.caloriesLabel}>{t('bc.kcalInPortion')}</Text>
      </View>

      {multi ? (
        <IngredientEditor
          items={product.items}
          onChange={setScaledItems}
          imperial={imperial}
        />
      ) : (
        <View style={styles.gramsRow}>
          <Text style={styles.gramsLabel}>{t('bc.portionWeight')}</Text>
          <View style={styles.gramsInputWrap}>
            <TextInput
              style={styles.gramsInput}
              value={amount}
              onChangeText={(v) => {
                amountTouched.current = true;
                setAmount(v);
              }}
              keyboardType="decimal-pad"
              maxLength={6}
            />
            <Text style={styles.gramsUnit}>
              {imperial ? t('res.oz') : t('bc.g')}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.macrosRow}>
        <Pill label={t('home.protein')} value={values.protein_g} />
        <Pill label={t('home.carbs')} value={values.carbs_g} />
        <Pill label={t('home.fat')} value={values.fat_g} />
      </View>

      <MealTypePicker value={mealType} onChange={setMealType} />

      {product.imageUrl ? (
        <View style={styles.photoChoice}>
          <Text style={styles.photoChoiceText}>{t('bc.keepPhoto')}</Text>
          <Switch value={keepPhoto} onValueChange={setKeepPhoto} />
        </View>
      ) : null}

      <Button
        label={saving ? t('bc.saving') : t('bc.save')}
        loading={saving}
        onPress={handleSave}
        size="lg"
      />

      <Button
        label={t('bc.scanAnother')}
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={styles.back}
      />
    </ScrollView>

    <SuccessCheck
      visible={saved}
      onDone={() => navigation.navigate('Main', { screen: 'HistoryTab' })}
    />
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    container: { padding: 20 },
    photo: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      marginBottom: 14,
      resizeMode: 'contain',
      backgroundColor: c.card,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    name: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: c.text },
    star: { padding: 2 },
    starText: { fontSize: 22, color: c.textFaint },
    starOn: { color: '#f5a623' },
    aiBadge: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 12,
      marginTop: 4,
      fontWeight: '600',
    },
    per100: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 6,
      marginBottom: 4,
    },
    gramsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    gramsLabel: { fontSize: 15, fontWeight: '600', color: c.text },
    gramsInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: c.inputBg,
    },
    gramsInput: {
      paddingVertical: 10,
      fontSize: 16,
      minWidth: 60,
      textAlign: 'right',
      color: c.text,
    },
    gramsUnit: { fontSize: 14, color: c.textFaint, marginLeft: 4 },
    caloriesBox: { alignItems: 'center', marginBottom: 14, marginTop: 8 },
    caloriesNumber: { fontSize: 44, fontWeight: '800', color: c.primary },
    caloriesLabel: { fontSize: 14, color: c.textMuted },
    macrosRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    pill: {
      flex: 1,
      marginHorizontal: 4,
      backgroundColor: c.card,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    pillValue: { fontSize: 16, fontWeight: '700', color: c.text },
    pillLabel: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    photoChoice: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      marginBottom: 12,
    },
    photoChoiceText: { fontSize: 14, color: c.text, flex: 1, marginRight: 12 },
    back: { marginTop: 4 },
  });
