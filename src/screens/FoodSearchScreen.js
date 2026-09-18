import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

import { searchFood } from '../services/openFoodFacts';
import { analyzeFoodByName } from '../services/aiService';
import {
  fetchSearchHistory,
  clearSearchHistory,
  logSearch,
  fetchFavorites,
  deleteFavorite,
  getAnalysisQuota,
  addMealFromPayload,
} from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { useSelectedDay } from '../state/SelectedDayContext';
import { guessMealType } from '../lib/meals';
import { productKey, getPortion } from '../lib/portionMemory';
import { hSuccess } from '../lib/haptics';
import Flash from '../components/Flash';
import Screen from '../ui/Screen';
import EmptyState from '../components/EmptyState';

const KIND_ICON = { photo: '📷', barcode: '▮▮▮', search: '🔎' };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function FoodSearchScreen({ navigation }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [asking, setAsking] = useState(false);
  const [tab, setTab] = useState('recent'); // 'recent' | 'fav'
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [flash, setFlash] = useState(null);
  const reqIdRef = useRef(0);
  const flashTimer = useRef(null);
  const { selectedKey, isToday } = useSelectedDay();

  const showFlash = useCallback((msg) => {
    setFlash(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1400);
  }, []);

  async function quickAdd(payload) {
    if (!payload) return;
    try {
      const grams = await getPortion(productKey(payload)).catch(() => null);
      await addMealFromPayload(payload, {
        dateKey: selectedKey,
        isToday,
        mealType: guessMealType(
          isToday ? new Date() : new Date(`${selectedKey}T12:00:00`)
        ),
        grams: grams || undefined,
      });
      hSuccess();
      showFlash('✓ ' + t('mt.added'));
    } catch (e) {
      Alert.alert(t('nav.tabFood'), toUserMessage(e));
    }
  }

  // payload из строки истории/избранного, который можно добавить в 1 тап
  function addableOf(item) {
    const p = item.payload;
    if (!p) return null;
    if (p.per100 || (Array.isArray(p.items) && p.items.length)) return p;
    return null;
  }

  const reload = useCallback(() => {
    fetchSearchHistory()
      .then(setHistory)
      .catch((e) => console.warn('history', e?.message));
    fetchFavorites()
      .then(setFavorites)
      .catch((e) => console.warn('favorites', e?.message));
  }, []);

  useFocusEffect(reload);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  async function runSearch(text) {
    const q = (text ?? query).trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    Keyboard.dismiss();
    const id = ++reqIdRef.current;
    setSearching(true);
    try {
      const list = await searchFood(q);
      if (id === reqIdRef.current) setResults(list);
    } catch (e) {
      if (id === reqIdRef.current) {
        setResults([]);
        Alert.alert(t('nav.tabFood'), toUserMessage(e));
      }
    } finally {
      if (id === reqIdRef.current) setSearching(false);
    }
  }

  function openProduct(product) {
    logSearch({
      kind: 'search',
      title: product.brand ? `${product.name} (${product.brand})` : product.name,
      calories: product.per100?.calories,
      payload: product,
    });
    navigation.navigate('BarcodeResult', { product });
  }

  function openHistoryItem(item) {
    const p = item.payload;
    const isPhotoLike =
      p && !p.per100 && Array.isArray(p.items) && p.items.length;
    if (p && (item.kind === 'photo' || isPhotoLike)) {
      navigation.navigate('Result', { result: p });
    } else if (p && p.per100) {
      navigation.navigate('BarcodeResult', { product: p });
    } else if (item.title) {
      setQuery(item.title);
      runSearch(item.title);
    }
  }

  async function askAi() {
    const q = query.trim();
    if (q.length < 2 || asking) return;
    Keyboard.dismiss();
    try {
      const quota = await getAnalysisQuota();
      if (!quota.is_pro && quota.remaining <= 0) {
        navigation.navigate('Paywall');
        return;
      }
    } catch (e) {
      // сервер проверит лимит сам
    }
    setAsking(true);
    try {
      const product = await analyzeFoodByName(q);
      logSearch({
        kind: 'search',
        title: product.name,
        calories: product.per100?.calories,
        payload: product,
      });
      navigation.navigate('BarcodeResult', { product });
    } catch (e) {
      if (e?.code === 'QUOTA') {
        navigation.navigate('Paywall');
        return;
      }
      Alert.alert(t('nav.tabFood'), toUserMessage(e));
    } finally {
      setAsking(false);
    }
  }

  function confirmClear() {
    Alert.alert(t('food.clearConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('food.clear'),
        style: 'destructive',
        onPress: () =>
          clearSearchHistory()
            .then(() => setHistory([]))
            .catch((e) => console.warn(e?.message)),
      },
    ]);
  }

  function removeFav(fav) {
    setFavorites((arr) => arr.filter((f) => f.id !== fav.id));
    deleteFavorite(fav.id).catch((e) => {
      console.warn(e?.message);
      reload();
    });
  }

  const busy = searching || asking;
  const showingResults = results !== null;

  const favProducts = favorites.filter((f) => f.kind !== 'recipe');
  const favRecipes = favorites.filter((f) => f.kind === 'recipe');

  function openSaved(item) {
    if (tab === 'recipes') {
      navigation.navigate('RecipeDetail', {
        recipe: item.payload,
        favId: item.id,
      });
    } else {
      openHistoryItem(item);
    }
  }

  const renderSaved = ({ item }) => {
    const isFav = tab !== 'recent';
    const icon =
      tab === 'recipes' ? '🍳' : isFav ? '★' : KIND_ICON[item.kind] ?? '•';
    const addable = tab !== 'recipes' ? addableOf(item) : null;
    return (
      <Pressable
        style={({ pressed }) => [styles.histRow, pressed && styles.pressed]}
        onPress={() => openSaved(item)}
      >
        <Text style={styles.histIcon}>{icon}</Text>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title || '—'}
          </Text>
          <Text style={styles.rowSub}>
            {tab === 'recent'
              ? `${t(`food.kind${cap(item.kind)}`)} · ${new Date(
                  item.created_at
                ).toLocaleDateString()}`
              : new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        {tab !== 'recipes' && item.calories != null && (
          <Text style={styles.rowKcalSmall}>{item.calories}</Text>
        )}
        {addable && (
          <Pressable
            onPress={() => quickAdd(addable)}
            hitSlop={10}
            style={styles.quickAdd}
          >
            <Text style={styles.quickAddText}>＋</Text>
          </Pressable>
        )}
        {isFav && (
          <Pressable
            onPress={() => removeFav(item)}
            hitSlop={10}
            style={styles.favX}
          >
            <Text style={styles.favXText}>✕</Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  const savedData =
    tab === 'recent' ? history : tab === 'fav' ? favProducts : favRecipes;

  // живой фильтр по своим продуктам, пока не запустили поиск в базе
  const q2 = query.trim().toLowerCase();
  const savedFiltered =
    q2.length >= 1
      ? savedData.filter((x) => (x.title || '').toLowerCase().includes(q2))
      : savedData;

  return (
    <Screen style={styles.screen}>
      <Flash message={flash} />
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch()}
          returnKeyType="search"
          placeholder={t('food.placeholder')}
          placeholderTextColor={c.textFaint}
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => {
              setQuery('');
              setResults(null);
            }}
          >
            <Text style={styles.clearX}>✕</Text>
          </Pressable>
        )}
      </View>

      {busy && (
        <View style={styles.centerPad}>
          <ActivityIndicator color={c.primary} />
          <Text style={styles.dim}>
            {asking ? t('food.asking') : t('food.searching')}
          </Text>
        </View>
      )}

      {!busy && showingResults && (
        <FlatList
          data={results}
          keyExtractor={(item, i) => (item.barcode || 'x') + i}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('food.noResults')}</Text>
          }
          ListFooterComponent={
            query.trim().length >= 2 ? (
              <Pressable style={styles.askAi} onPress={askAi}>
                <Text style={styles.askAiText}>
                  🤖 {t('food.askAi', { q: query.trim() })}
                </Text>
                <Text style={styles.askAiHint}>{t('food.askAiHint')}</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => openProduct(item)}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]} />
              )}
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                {!!item.brand && (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {item.brand}
                  </Text>
                )}
              </View>
              <Text style={styles.rowKcal}>
                {item.per100.calories}
                {'\n'}
                <Text style={styles.per100}>{t('food.per100Short')}</Text>
              </Text>
              <Pressable
                onPress={() => quickAdd(item)}
                hitSlop={10}
                style={styles.quickAdd}
              >
                <Text style={styles.quickAddText}>＋</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}

      {!busy && !showingResults && (
        <>
          <View style={styles.tabs}>
            {[
              ['recent', t('food.recent')],
              ['fav', `★ ${t('food.favorites')}`],
              ['recipes', `🍳 ${t('recipe.title')}`],
            ].map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.tab, tab === key && styles.tabActive]}
                onPress={() => setTab(key)}
              >
                <Text
                  style={[styles.tabText, tab === key && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab !== 'recipes' && (
            <Pressable
              style={styles.customBtn}
              onPress={() => navigation.navigate('CustomProduct')}
            >
              <Text style={styles.customBtnText}>＋ {t('custom.add')}</Text>
            </Pressable>
          )}

          <FlatList
            data={savedFiltered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              !q2 && tab === 'recent' && history.length > 0 ? (
                <Pressable onPress={confirmClear} style={styles.clearHeader}>
                  <Text style={styles.clearLink}>{t('food.clear')}</Text>
                </Pressable>
              ) : null
            }
            ListFooterComponent={
              q2.length >= 2 ? (
                <Pressable style={styles.askAi} onPress={() => runSearch()}>
                  <Text style={styles.askAiText}>
                    🔎 {t('food.searchDb', { q: query.trim() })}
                  </Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              q2 ? (
                <Text style={styles.emptyText}>{t('food.noSaved')}</Text>
              ) : (
                <EmptyState
                  art={tab === 'recent' ? 'search' : tab === 'recipes' ? 'chef' : 'star'}
                  title={
                    tab === 'recent'
                      ? t('food.hint')
                      : tab === 'recipes'
                      ? t('recipe.noFav')
                      : t('food.noFav')
                  }
                />
              )
            }
            renderItem={renderSaved}
          />
        </>
      )}
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: c.inputBg,
    },
    input: { flex: 1, paddingVertical: 12, fontSize: 16, color: c.text },
    clearX: { color: c.textFaint, fontSize: 16, padding: 4 },
    centerPad: { alignItems: 'center', paddingTop: 30, gap: 8 },
    dim: { color: c.textMuted },
    list: { paddingHorizontal: 16, paddingBottom: 24 },
    emptyText: { color: c.textFaint, textAlign: 'center', marginTop: 40 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: 8,
      marginRight: 12,
      backgroundColor: c.card,
    },
    thumbEmpty: {},
    rowText: { flex: 1, marginRight: 10 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    rowSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    rowKcal: {
      fontSize: 16,
      fontWeight: '700',
      color: c.primary,
      textAlign: 'right',
    },
    rowKcalSmall: { fontSize: 14, fontWeight: '700', color: c.primary },
    per100: { fontSize: 10, fontWeight: '400', color: c.textFaint },
    tabs: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 6,
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 3,
    },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    tabActive: { backgroundColor: c.primary },
    tabText: { color: c.textMuted, fontWeight: '600', fontSize: 13 },
    tabTextActive: { color: c.onPrimary },
    clearHeader: { alignItems: 'flex-end', paddingVertical: 6 },
    clearLink: { fontSize: 13, color: c.primary, fontWeight: '600' },
    customBtn: {
      marginHorizontal: 16,
      marginBottom: 6,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: 'center',
    },
    customBtnText: { color: c.primary, fontWeight: '700', fontSize: 13 },
    histRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    histIcon: { width: 28, fontSize: 13, color: c.textMuted },
    favX: { paddingHorizontal: 6, marginLeft: 6 },
    favXText: { color: c.textFaint, fontSize: 14 },
    quickAdd: {
      width: 34,
      height: 34,
      borderRadius: 17,
      marginLeft: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accentSoft,
    },
    quickAddText: { color: c.primary, fontSize: 20, fontWeight: '800', lineHeight: 22 },
    flash: {
      position: 'absolute',
      top: 10,
      alignSelf: 'center',
      zIndex: 20,
      backgroundColor: c.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    flashText: { color: c.onPrimary, fontWeight: '700', fontSize: 13 },
    askAi: {
      marginTop: 16,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
    },
    askAiText: {
      color: c.dark ? c.text : c.primary,
      fontWeight: '700',
      fontSize: 14,
      textAlign: 'center',
    },
    askAiHint: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 4,
      textAlign: 'center',
    },
  });
