import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, ScrollView, Share, StyleSheet } from 'react-native';

import {
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

export default function RecipeDetailScreen({ route, navigation }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { recipe, favId: initialFavId } = route.params;
  const [favId, setFavId] = useState(initialFavId ?? null);

  useFocusEffect(
    useCallback(() => {
      if (initialFavId) return;
      fetchFavorites()
        .then((list) => {
          const f = list.find(
            (x) => x.kind === 'recipe' && x.title === recipe.title
          );
          if (f) setFavId(f.id);
        })
        .catch((e) => console.warn('favs', e?.message));
    }, [initialFavId, recipe.title])
  );

  async function toggleFav() {
    try {
      if (favId) {
        await deleteFavorite(favId);
        setFavId(null);
      } else {
        const f = await addFavorite({
          title: recipe.title,
          calories: null,
          payload: recipe,
          kind: 'recipe',
        });
        setFavId(f.id);
      }
    } catch (e) {
      Alert.alert(t('nav.recipe'), toUserMessage(e));
    }
  }

  return (
    <Screen>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <RecipeCard
        recipe={recipe}
        favId={favId}
        onToggleFav={toggleFav}
        onAddToDiary={() =>
          navigation.navigate('BarcodeResult', {
            product: recipeToProduct(recipe),
          })
        }
        onShoppingList={() =>
          Share.share({ message: shoppingListText(recipe, t) }).catch(() => {})
        }
        onCook={() =>
          navigation.navigate('CookMode', {
            title: recipe.title,
            steps: recipe.steps || [],
          })
        }
      />
    </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: 16, paddingBottom: 40 },
  });
