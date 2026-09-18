import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

import {
  updateMeal,
  deleteMeal,
  getSignedPhotoUrls,
  uploadMealPhoto,
  removeStoragePhotos,
} from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { pickMealPhotoBase64 } from '../lib/photo';
import { useT } from '../i18n/LocaleContext';
import { useTheme, useSettings } from '../settings/SettingsContext';
import IngredientEditor from '../components/IngredientEditor';
import MealTypePicker from '../components/MealTypePicker';
import OptionSheet from '../components/OptionSheet';
import { sumItems } from '../lib/nutrition';
import { groupNum } from '../lib/format';
import AnimatedNumber from '../components/AnimatedNumber';
import { guessMealType } from '../lib/meals';
import { hSuccess } from '../lib/haptics';
import Screen from '../ui/Screen';
import Button from '../ui/Button';
import useLeaveGuard from '../lib/useLeaveGuard';

const photoList = (meal) =>
  Array.isArray(meal.photos) && meal.photos.length
    ? meal.photos
    : meal.photo_url
    ? [meal.photo_url]
    : [];

const resolvePhoto = (path, map) =>
  !path ? null : path.startsWith('http') ? path : map[path] ?? null;

export default function MealDetailScreen({ route, navigation }) {
  const { t, locale } = useT();
  const c = useTheme();
  const { units } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { meal } = route.params;
  const imperial = units === 'imperial';

  const base = useMemo(
    () =>
      Array.isArray(meal.items) && meal.items.length
        ? meal.items
        : [
            {
              name: meal.food_name || '—',
              grams: 100,
              calories: meal.calories || 0,
              protein_g: Number(meal.protein_g) || 0,
              carbs_g: Number(meal.carbs_g) || 0,
              fat_g: Number(meal.fat_g) || 0,
            },
          ],
    [meal]
  );

  const [name, setName] = useState(meal.food_name ?? '');
  const [items, setItems] = useState(base);
  const [mealType, setMealType] = useState(
    meal.meal_type || guessMealType(meal.created_at)
  );
  const [when, setWhen] = useState(new Date(meal.created_at));
  const [note, setNote] = useState(meal.note ?? '');
  const [photos, setPhotos] = useState(() => photoList(meal));
  const [photoMap, setPhotoMap] = useState({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const totals = sumItems(items);

  // --- защита от потери правок ---
  const [itemsChanged, setItemsChanged] = useState(false);
  const itemsBaseRef = useRef(null);
  const onItemsChange = useCallback((next) => {
    setItems(next);
    const s = JSON.stringify(next);
    if (itemsBaseRef.current === null) itemsBaseRef.current = s;
    else if (s !== itemsBaseRef.current) setItemsChanged(true);
  }, []);

  const dirty =
    !busy &&
    (itemsChanged ||
    name !== (meal.food_name ?? '') ||
    note !== (meal.note ?? '') ||
    mealType !== (meal.meal_type || guessMealType(meal.created_at)) ||
    when.getTime() !== new Date(meal.created_at).getTime() ||
    photos.join('|') !== photoList(meal).join('|'));

  const allowLeave = useLeaveGuard(navigation, dirty);

  function shiftDay(delta) {
    setWhen((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + delta);
      return n;
    });
  }
  const whenLabel = when.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  }) +
    ', ' +
    when.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    const need = photos.filter(
      (p) => p && !p.startsWith('http') && !photoMap[p]
    );
    if (!need.length) return;
    getSignedPhotoUrls(need)
      .then((map) => setPhotoMap((prev) => ({ ...prev, ...map })))
      .catch((e) => console.warn('meal photo url', e?.message));
  }, [photos, photoMap]);

  async function addPhoto(source) {
    setPhotoBusy(true);
    try {
      const r = await pickMealPhotoBase64(source);
      if (!r) return;
      if (r.denied) {
        Alert.alert(t('md.photoDenied'));
        return;
      }
      const path = await uploadMealPhoto(r.base64);
      setPhotos((arr) => [...arr, path]);
    } catch (e) {
      Alert.alert(t('md.saveFail'), toUserMessage(e));
    } finally {
      setPhotoBusy(false);
    }
  }

  const photoOptions = [
    { label: t('md.camera'), icon: 'camera', onPress: () => addPhoto('camera') },
    { label: t('md.gallery'), icon: 'images', onPress: () => addPhoto('library') },
  ];

  function removePhoto(path) {
    setPhotos((arr) => arr.filter((p) => p !== path));
  }

  useLayoutEffect(() => {
    navigation.setOptions({ title: meal.food_name ?? t('md.fallback') });
  }, [navigation, meal.food_name, t]);

  async function handleSave() {
    if (!name.trim()) return Alert.alert(t('md.nameEmpty'));
    setBusy(true);
    try {
      await updateMeal(meal.id, {
        food_name: name.trim(),
        calories: totals.calories,
        protein_g: totals.protein_g,
        carbs_g: totals.carbs_g,
        fat_g: totals.fat_g,
        items,
        meal_type: mealType,
        created_at: when.toISOString(),
        note: note.trim() || null,
        photos: photos.length ? photos : null,
        photo_url: photos[0] || null,
      });
      const removed = photoList(meal).filter((p) => !photos.includes(p));
      if (removed.length) removeStoragePhotos(removed).catch(() => {});
      hSuccess();
      allowLeave();
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('md.saveFail'), toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert(t('md.delTitle'), t('md.delMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteMeal(meal);
            allowLeave();
            navigation.goBack();
          } catch (e) {
            Alert.alert(t('md.delFail'), toUserMessage(e));
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <Screen>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photoStrip}
      >
        {photos.map((p) => {
          const uri = resolvePhoto(p, photoMap);
          return (
            <Pressable
              key={p}
              style={styles.photoWrap}
              onLongPress={() =>
                Alert.alert(t('md.removePhoto'), '', [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => removePhoto(p),
                  },
                ])
              }
            >
              {uri ? (
                <Image source={{ uri }} style={styles.photoThumb} />
              ) : (
                <View style={[styles.photoThumb, styles.photoLoading]}>
                  <ActivityIndicator color={c.textMuted} />
                </View>
              )}
              <Pressable
                style={styles.photoX}
                hitSlop={8}
                onPress={() => removePhoto(p)}
              >
                <Text style={styles.photoXText}>✕</Text>
              </Pressable>
            </Pressable>
          );
        })}
        <Pressable
          style={styles.photoAdd}
          onPress={() => setPhotoSheet(true)}
          disabled={photoBusy}
        >
          {photoBusy ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <Text style={styles.photoAddText}>＋</Text>
          )}
        </Pressable>
      </ScrollView>

      <Text style={styles.fieldLabel}>{t('md.name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholderTextColor={c.textFaint}
      />

      <View style={styles.caloriesBox}>
        <AnimatedNumber
          value={totals.calories}
          style={styles.caloriesNumber}
          format={(n) => groupNum(n)}
        />
        <Text style={styles.caloriesLabel}>
          {t('res.kcal')} ·{' '}
          {t('res.macros', {
            p: totals.protein_g,
            f: totals.fat_g,
            c: totals.carbs_g,
          })}
        </Text>
      </View>

      <MealTypePicker value={mealType} onChange={setMealType} />

      <View style={styles.dateRow}>
        <Text style={styles.fieldLabel}>{t('mt.date')}</Text>
        <View style={styles.dateNav}>
          <Pressable onPress={() => shiftDay(-1)} hitSlop={10}>
            <Text style={styles.dateArrow}>‹</Text>
          </Pressable>
          <Text style={styles.dateVal}>{whenLabel}</Text>
          <Pressable onPress={() => shiftDay(1)} hitSlop={10}>
            <Text style={styles.dateArrow}>›</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.fieldLabel}>{t('md.note')}</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={note}
        onChangeText={setNote}
        placeholder={t('md.notePlaceholder')}
        placeholderTextColor={c.textFaint}
        multiline
        maxLength={500}
      />

      <Text style={styles.section}>{t('res.ingredients')}</Text>
      <IngredientEditor items={base} onChange={onItemsChange} imperial={imperial} />

      <Button
        label={busy ? t('md.saving') : t('md.save')}
        loading={busy}
        onPress={handleSave}
        size="lg"
        style={styles.save}
      />

      <Pressable style={styles.delete} onPress={confirmDelete} disabled={busy}>
        <Text style={styles.deleteText}>{t('md.deleteMeal')}</Text>
      </Pressable>

      <OptionSheet
        visible={photoSheet}
        onClose={() => setPhotoSheet(false)}
        title={t('md.addPhoto')}
        options={photoOptions}
      />
    </ScrollView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 40 },
    photoStrip: { gap: 10, paddingBottom: 14, alignItems: 'center' },
    photoWrap: { width: 96, height: 96 },
    photoThumb: { width: 96, height: 96, borderRadius: 10, backgroundColor: c.card },
    photoLoading: { alignItems: 'center', justifyContent: 'center' },
    photoX: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoXText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    photoAdd: {
      width: 96,
      height: 96,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoAddText: { fontSize: 28, color: c.primary, fontWeight: '300' },
    fieldLabel: { fontSize: 12, color: c.textMuted, marginBottom: 4, marginTop: 12 },
    noteInput: { minHeight: 64, textAlignVertical: 'top', paddingTop: 10 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.inputBg,
    },
    caloriesBox: { alignItems: 'center', marginVertical: 16 },
    caloriesNumber: { fontSize: 40, fontWeight: '800', color: c.primary },
    caloriesLabel: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    section: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      marginBottom: 4,
    },
    dateRow: { marginBottom: 12 },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: c.inputBg,
    },
    dateArrow: { fontSize: 20, color: c.primary, fontWeight: '700', width: 24, textAlign: 'center' },
    dateVal: { fontSize: 15, color: c.text, fontWeight: '600' },
    save: { marginTop: 20 },
    delete: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    deleteText: { color: c.danger, fontWeight: '600' },
  });
