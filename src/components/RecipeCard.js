import {
  useMemo,
} from 'react';
import { Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';

import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { sumItems } from '../lib/nutrition';

export default function RecipeCard({
  recipe,
  onAddToDiary,
  favId,
  onToggleFav,
  onShoppingList,
  onCook,
}) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const totals = sumItems(recipe.items || []);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{recipe.title}</Text>
        {onToggleFav && (
          <Pressable onPress={onToggleFav} hitSlop={10} style={styles.star}>
            <Text style={[styles.starText, favId && styles.starOn]}>
              {favId ? '★' : '☆'}
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.meta}>
        {recipe.servings} {t('recipe.servings')} · {totals.calories}{' '}
        {t('res.kcal')} {t('recipe.perServing')}
      </Text>
      <Text style={styles.macros}>
        {t('res.macros', {
          p: totals.protein_g,
          f: totals.fat_g,
          c: totals.carbs_g,
        })}
      </Text>

      <Text style={styles.section}>{t('res.ingredients')}</Text>
      {(recipe.items || []).map((it, k) => (
        <View key={k} style={styles.ingRow}>
          <Text style={styles.ingName} numberOfLines={1}>
            {it.name}
          </Text>
          <Text style={styles.ingMeta}>
            {Math.round(it.grams)} {t('res.g')} · {Math.round(it.calories)}{' '}
            {t('res.kcal')}
          </Text>
        </View>
      ))}

      {recipe.steps?.length > 0 && (
        <>
          <Text style={styles.section}>{t('recipe.steps')}</Text>
          {recipe.steps.map((s, k) => (
            <Text key={k} style={styles.step}>
              {k + 1}. {s}
            </Text>
          ))}
        </>
      )}

      {(onShoppingList || onCook) && (
        <View style={styles.actionRow}>
          {onShoppingList && (
            <Pressable style={styles.actionBtn} onPress={onShoppingList}>
              <Text style={styles.actionText}>🛒 {t('recipe.shopping')}</Text>
            </Pressable>
          )}
          {onCook && recipe.steps?.length > 0 && (
            <Pressable style={styles.actionBtn} onPress={onCook}>
              <Text style={styles.actionText}>👩‍🍳 {t('recipe.cook')}</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable style={styles.addBtn} onPress={onAddToDiary}>
        <Text style={styles.addBtnText}>{t('recipe.addToDiary')}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 16,
      marginTop: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      ...c.shadow,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    title: { fontSize: 18, fontWeight: '800', color: c.text, flex: 1, marginRight: 8 },
    star: { padding: 2 },
    starText: { fontSize: 22, color: c.textFaint },
    starOn: { color: '#f5a623' },
    meta: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    macros: { fontSize: 12, color: c.textMuted, marginTop: 2, marginBottom: 8 },
    section: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      marginTop: 12,
      marginBottom: 4,
    },
    ingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    ingName: { fontSize: 14, color: c.text, flex: 1, marginRight: 10 },
    ingMeta: { fontSize: 12, color: c.textMuted },
    step: { fontSize: 14, color: c.text, marginTop: 6, lineHeight: 20 },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    actionBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
    },
    actionText: { color: c.text, fontWeight: '600', fontSize: 12, textAlign: 'center' },
    addBtn: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: 'center',
    },
    addBtnText: { color: c.primary, fontWeight: '700' },
  });
