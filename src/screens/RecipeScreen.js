import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
} from 'react-native';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

import { generateRecipes } from '../services/aiService';
import {
  getAnalysisQuota,
  fetchFavorites,
  addFavorite,
  deleteFavorite,
} from '../services/supabaseClient';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { recipeToProduct } from '../lib/nutrition';
import { shoppingListText } from '../lib/recipeText';
import RecipeCard from '../components/RecipeCard';
import Screen from '../ui/Screen';
import Button from '../ui/Button';

export default function RecipeScreen({ navigation }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recipes, setRecipes] = useState(null);
  const [favMap, setFavMap] = useState({}); // title -> favId

  const loadFavs = useCallback(() => {
    fetchFavorites()
      .then((list) => {
        const m = {};
        list
          .filter((f) => f.kind === 'recipe')
          .forEach((f) => {
            m[f.title] = f.id;
          });
        setFavMap(m);
      })
      .catch((e) => console.warn('favs', e?.message));
  }, []);

  useFocusEffect(loadFavs);

  async function generate() {
    const q = text.trim();
    if (q.length < 2 || busy) return;
    try {
      const quota = await getAnalysisQuota();
      if (!quota.is_pro && quota.remaining <= 0) {
        navigation.navigate('Paywall');
        return;
      }
    } catch (e) {
      // сервер проверит лимит
    }
    setBusy(true);
    try {
      const list = await generateRecipes(q);
      setRecipes(list);
    } catch (e) {
      if (e?.code === 'QUOTA') {
        navigation.navigate('Paywall');
        return;
      }
      Alert.alert(t('nav.recipe'), toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function addToDiary(recipe) {
    navigation.navigate('BarcodeResult', { product: recipeToProduct(recipe) });
  }

  async function toggleFav(recipe) {
    const existing = favMap[recipe.title];
    try {
      if (existing) {
        await deleteFavorite(existing);
        setFavMap((m) => {
          const n = { ...m };
          delete n[recipe.title];
          return n;
        });
      } else {
        const f = await addFavorite({
          title: recipe.title,
          calories: null,
          payload: recipe,
          kind: 'recipe',
        });
        setFavMap((m) => ({ ...m, [recipe.title]: f.id }));
      }
    } catch (e) {
      Alert.alert(t('nav.recipe'), toUserMessage(e));
    }
  }

  return (
    <Screen>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={t('recipe.placeholder')}
          placeholderTextColor={c.textFaint}
          multiline
        />

        <Button
          label={t('recipe.generate')}
          loading={busy}
          onPress={generate}
          size="lg"
          style={styles.btn}
        />

        {busy && <Text style={styles.hint}>{t('recipe.generating')}</Text>}

        {recipes !== null && recipes.length === 0 && !busy && (
          <Text style={styles.empty}>{t('recipe.empty')}</Text>
        )}

        {recipes?.map((r, i) => (
          <RecipeCard
            key={i}
            recipe={r}
            onAddToDiary={() => addToDiary(r)}
            favId={favMap[r.title]}
            onToggleFav={() => toggleFav(r)}
            onShoppingList={() =>
              Share.share({ message: shoppingListText(r, t) }).catch(() => {})
            }
            onCook={() =>
              navigation.navigate('CookMode', {
                title: r.title,
                steps: r.steps || [],
              })
            }
          />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 40 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.inputBg,
      minHeight: 90,
      textAlignVertical: 'top',
    },
    btn: { marginTop: 12 },
    hint: { color: c.textMuted, textAlign: 'center', marginTop: 10 },
    empty: { color: c.textFaint, textAlign: 'center', marginTop: 24 },
  });
