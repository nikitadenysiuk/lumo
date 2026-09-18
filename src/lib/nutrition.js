// src/lib/nutrition.js
// Масштабирование ингредиентов по граммам и суммирование.

export const G_PER_OZ = 28.3495;

const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Пересчитывает один ингредиент под новый вес.
 * @param {{name,grams,calories,protein_g,carbs_g,fat_g}} base
 * @param {number} newGrams
 */
export function scaleItem(base, newGrams) {
  const s = base.grams > 0 ? newGrams / base.grams : 0;
  return {
    name: base.name,
    grams: Math.round(newGrams),
    calories: Math.round(base.calories * s),
    protein_g: r1(base.protein_g * s),
    carbs_g: r1(base.carbs_g * s),
    fat_g: r1(base.fat_g * s),
  };
}

export function sumItems(items) {
  return items.reduce(
    (a, it) => ({
      calories: a.calories + (it.calories || 0),
      protein_g: r1(a.protein_g + (it.protein_g || 0)),
      carbs_g: r1(a.carbs_g + (it.carbs_g || 0)),
      fat_g: r1(a.fat_g + (it.fat_g || 0)),
      grams: a.grams + (it.grams || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, grams: 0 }
  );
}

export const toGrams = (amount, imperial) =>
  imperial ? amount * G_PER_OZ : amount;
export const fromGrams = (grams, imperial) =>
  imperial ? r1(grams / G_PER_OZ) : Math.round(grams);

// Рецепт -> объект "продукта" для BarcodeResultScreen (одна порция).
export function recipeToProduct(recipe) {
  const items = recipe.items || [];
  const totals = sumItems(items);
  const per = (v) => (totals.grams ? Math.round((v / totals.grams) * 1000) / 10 : 0);
  return {
    barcode: null,
    name: recipe.title,
    brand: '',
    per100: {
      calories: totals.grams
        ? Math.round((totals.calories / totals.grams) * 100)
        : 0,
      protein_g: per(totals.protein_g),
      carbs_g: per(totals.carbs_g),
      fat_g: per(totals.fat_g),
    },
    servingSizeG: totals.grams,
    imageUrl: null,
    aiConfidence: 'medium',
    items,
  };
}
