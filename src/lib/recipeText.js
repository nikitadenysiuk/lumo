// src/lib/recipeText.js — текстовые представления рецепта.

/**
 * Список покупок: «• Название — 120 г» по строке на ингредиент.
 * @param {{title, servings, items:Array}} recipe
 * @param {(k:string, o?:object)=>string} t
 */
export function shoppingListText(recipe, t) {
  const lines = (recipe.items || []).map((it) => {
    const g = Math.round(Number(it.grams) || 0);
    return g > 0
      ? `• ${it.name} — ${g} ${t('res.g')}`
      : `• ${it.name}`;
  });
  const head = recipe.servings
    ? `${recipe.title} · ${recipe.servings} ${t('recipe.servings')}`
    : recipe.title;
  return `${head}\n\n${lines.join('\n')}`;
}
