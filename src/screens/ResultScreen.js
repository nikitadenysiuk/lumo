import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import {
  saveMeal,
  uploadMealPhoto,
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
import { sumItems } from '../lib/nutrition';
import { groupNum } from '../lib/format';
import { MACRO_COLORS } from '../theme/palettes';
import AnimatedNumber from '../components/AnimatedNumber';
import SuccessCheck from '../components/SuccessCheck';
import { guessMealType } from '../lib/meals';
import { hSuccess, hSelect } from '../lib/haptics';
import Screen from '../ui/Screen';
import Button from '../ui/Button';

// created_at для выбранного дня: сегодня → сейчас, иначе полдень того дня
function createdAtFor(selectedKey, isToday) {
  if (isToday) return undefined;
  return new Date(`${selectedKey}T12:00:00`).toISOString();
}

export default function ResultScreen({ route, navigation }) {
  const { t } = useT();
  const c = useTheme();
  const { units } = useSettings();
  const { selectedKey, isToday } = useSelectedDay();
  const styles = useMemo(() => makeStyles(c), [c]);
  const imperial = units === 'imperial';
  const [mealType, setMealType] = useState(() =>
    guessMealType(isToday ? new Date() : new Date(`${selectedKey}T12:00:00`))
  );

  const CONFIDENCE_LABEL = {
    high: t('res.c_high'),
    medium: t('res.c_medium'),
    low: t('res.c_low'),
  };

  const { result, photoBase64 } = route.params;
  const base = useMemo(
    () =>
      result.items?.length
        ? result.items
        : [
            {
              name: result.food_name,
              grams: Math.max(1, Math.round(result.portion_grams || 100)),
              calories: result.calories || 0,
              protein_g: result.protein_g || 0,
              carbs_g: result.carbs_g || 0,
              fat_g: result.fat_g || 0,
            },
          ],
    [result]
  );

  const [items, setItems] = useState(base);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [favId, setFavId] = useState(null);
  const [favBusy, setFavBusy] = useState(false);
  const totals = sumItems(items);

  useEffect(() => {
    let alive = true;
    fetchFavorites()
      .then((list) => {
        if (!alive) return;
        const f = list.find(
          (x) => x.kind !== 'recipe' && x.title === result.food_name
        );
        if (f) setFavId(f.id);
      })
      .catch((e) => console.warn('favorites', e?.message));
    return () => {
      alive = false;
    };
  }, [result.food_name]);

  async function toggleFav() {
    if (favBusy) return;
    setFavBusy(true);
    hSelect();
    try {
      if (favId) {
        await deleteFavorite(favId);
        setFavId(null);
      } else {
        const f = await addFavorite({
          title: result.food_name,
          calories: totals.calories,
          payload: { food_name: result.food_name, items, note: result.note },
          kind: 'product',
        });
        setFavId(f.id);
      }
    } catch (e) {
      Alert.alert(t('res.saveFail'), toUserMessage(e));
    } finally {
      setFavBusy(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      let photoPath = null;
      if (photoBase64) {
        try {
          photoPath = await uploadMealPhoto(photoBase64);
        } catch (e) {
          console.warn('Не удалось загрузить фото', e?.message);
        }
      }

      await saveMeal({
        food_name: result.food_name,
        calories: totals.calories,
        protein_g: totals.protein_g,
        carbs_g: totals.carbs_g,
        fat_g: totals.fat_g,
        photo_url: photoPath,
        photos: photoPath ? [photoPath] : null,
        items,
        meal_type: mealType,
        created_at: createdAtFor(selectedKey, isToday),
      });
      hSuccess();
      setSaved(true); // isSaving остаётся true до конца анимации «галочки»
    } catch (err) {
      Alert.alert(t('res.saveFail'), toUserMessage(err));
      setIsSaving(false);
    }
  }

  return (
    <Screen style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {photoBase64 ? (
          <View style={styles.hero}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${photoBase64}` }}
              style={styles.heroImg}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.8)']}
              style={styles.heroFade}
            />
            <View style={styles.heroText}>
              {result.confidence ? (
                <View style={styles.confChip}>
                  <Text style={styles.confChipText}>
                    🤖 {CONFIDENCE_LABEL[result.confidence] ?? result.confidence}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.heroName} numberOfLines={2}>
                {result.food_name}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.heroNoImg}>
            <Text style={styles.heroNameDark} numberOfLines={2}>
              {result.food_name}
            </Text>
            {result.confidence ? (
              <Text style={styles.confText}>
                🤖 {CONFIDENCE_LABEL[result.confidence] ?? result.confidence}
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.statCard}>
            <AnimatedNumber
              value={totals.calories}
              style={styles.kcalNum}
              format={(n) => groupNum(n)}
            />
            <Text style={styles.kcalUnit}>{t('res.kcal')}</Text>
            <View style={styles.macroRow}>
              <MacroChip
                styles={styles}
                color={MACRO_COLORS.protein}
                label={t('home.protein')}
                value={totals.protein_g}
              />
              <MacroChip
                styles={styles}
                color={MACRO_COLORS.fat}
                label={t('home.fat')}
                value={totals.fat_g}
              />
              <MacroChip
                styles={styles}
                color={MACRO_COLORS.carbs}
                label={t('home.carbs')}
                value={totals.carbs_g}
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.favBtn,
              favId && styles.favBtnOn,
              pressed && styles.favBtnPressed,
            ]}
            onPress={toggleFav}
            disabled={favBusy}
          >
            <Ionicons
              name={favId ? 'star' : 'star-outline'}
              size={16}
              color={favId ? c.onPrimary : c.primary}
            />
            <Text style={[styles.favBtnText, favId && styles.favBtnTextOn]}>
              {favId ? t('res.inFav') : t('res.addFav')}
            </Text>
          </Pressable>

          <Text style={styles.section}>{t('res.ingredients')}</Text>
          <IngredientEditor
            items={base}
            onChange={setItems}
            imperial={imperial}
          />

          <MealTypePicker value={mealType} onChange={setMealType} />

          {result.note ? (
            <Text style={styles.note}>{result.note}</Text>
          ) : null}

          <Button
            label={isSaving ? t('res.saving') : t('res.save')}
            loading={isSaving}
            onPress={handleSave}
            size="lg"
            style={styles.saveButton}
          />

          <Button
            label={t('res.retake')}
            variant="ghost"
            onPress={() => navigation.goBack()}
            style={styles.retakeButton}
          />
        </View>
      </ScrollView>

      <SuccessCheck
        visible={saved}
        onDone={() => navigation.navigate('Main', { screen: 'HistoryTab' })}
      />
    </Screen>
  );
}

function MacroChip({ color, label, value, styles }) {
  return (
    <View style={styles.macroChip}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroChipVal}>{value}</Text>
      <Text style={styles.macroChipLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    container: { paddingBottom: 32 },

    hero: { width: '100%', height: 280, justifyContent: 'flex-end' },
    heroImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    heroFade: { ...StyleSheet.absoluteFillObject },
    heroText: { padding: 20 },
    heroName: { fontSize: 24, fontWeight: '800', color: '#fff' },
    confChip: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginBottom: 8,
    },
    confChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    heroNoImg: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
    heroNameDark: { fontSize: 24, fontWeight: '800', color: c.text },
    confText: { color: c.textMuted, fontSize: 12, marginTop: 4 },

    body: { padding: 20 },

    statCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    kcalNum: { fontSize: 44, fontWeight: '800', color: c.primary },
    kcalUnit: { fontSize: 13, color: c.textMuted, marginTop: -2 },
    macroRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignSelf: 'stretch',
      marginTop: 14,
    },
    macroChip: { alignItems: 'center' },
    macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 5 },
    macroChipVal: { fontSize: 16, fontWeight: '800', color: c.text },
    macroChipLabel: { fontSize: 11, color: c.textMuted, marginTop: 1 },

    favBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 7,
      marginTop: 12,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.primary,
    },
    favBtnOn: { backgroundColor: c.primary },
    favBtnPressed: { opacity: 0.7 },
    favBtnText: { color: c.primary, fontWeight: '700', fontSize: 13 },
    favBtnTextOn: { color: c.onPrimary },
    section: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      marginTop: 20,
      marginBottom: 6,
    },
    note: {
      fontSize: 13,
      color: c.textFaint,
      fontStyle: 'italic',
      marginTop: 14,
    },
    saveButton: { marginTop: 20, marginBottom: 6 },
    retakeButton: { marginTop: 0 },
  });
