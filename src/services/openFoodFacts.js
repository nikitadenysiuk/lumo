// src/services/openFoodFacts.js
//
// Поиск упакованного продукта по штрих-коду в бесплатной базе
// Open Food Facts (openfoodfacts.org). Возвращает БЖУ на 100 г
// и ссылку на фото продукта.

import { AppError, isNetworkError } from './errors';
import { i18n, t } from '../i18n';

const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_UA = 'Lumo/1.0 (https://openfoodfacts.org)';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * fetch с таймаутом и одним повтором. Бросает ошибку с понятным message
 * (в т.ч. в консоль Metro пишем настоящую причину).
 */
async function offFetch(
  url,
  { label = 'OFF', timeoutMs = 12000, retries = 1, allowStatuses = [] } = {}
) {
  let lastReason = 'unknown';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': OFF_UA, Accept: 'application/json' },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok || allowStatuses.includes(res.status)) return res;
      lastReason = `HTTP ${res.status}`;
      console.warn(`[${label}] ${lastReason} ${url}`);
      // 4xx (кроме 429) сам не починится — не повторяем
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      clearTimeout(timer);
      lastReason = e?.name === 'AbortError' ? `timeout ${timeoutMs}ms` : e?.message || String(e);
      console.warn(`[${label}] attempt ${attempt + 1}/${retries + 1}: ${lastReason}`);
      if (isNetworkError(e)) throw new AppError(t('err.network'), 'NO_NETWORK');
    }
  }
  console.warn(`[${label}] giving up: ${lastReason}`);
  throw new AppError(t('err.offServer'), 'SERVER');
}

// brands бывает строкой ("A, B") или массивом (["A","B"]) в разных API OFF.
function firstBrand(brands) {
  if (Array.isArray(brands)) return (brands[0] || '').trim();
  return String(brands || '').split(',')[0].trim();
}

function pickString(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return pickString(v[0]);
  if (v && typeof v === 'object') {
    const s = Object.values(v).find((x) => typeof x === 'string' && x);
    return s || '';
  }
  return '';
}

// "30 g" / "1 portion (30 g)" -> 30
function parseServingGrams(s) {
  if (!s) return null;
  const m = String(s).match(/([\d.,]+)\s*g/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Поиск продуктов по названию в Open Food Facts (бесплатно, без ключа).
 * @param {string} query
 * @returns {Promise<Array<{barcode, name, brand, per100, servingSizeG, imageUrl}>>}
 */
export async function searchFood(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  // Новый поисковый сервис OFF (старый /cgi/search.pl часто перегружен).
  const url =
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}` +
    `&page_size=25` +
    `&fields=code,product_name,brands,nutriments,image_front_small_url,serving_size`;

  const res = await offFetch(url, { label: 'OFF search' });

  const json = await res.json().catch(() => null);
  const products = json?.hits ?? [];

  return products
    .map((p) => {
      const n = p.nutriments || {};
      const calories = Math.round(num(n['energy-kcal_100g']));
      const name = pickString(p.product_name).trim();
      if (!calories || !name) return null;
      return {
        barcode: p.code ? String(p.code) : null,
        name,
        brand: firstBrand(p.brands),
        per100: {
          calories,
          protein_g: num(n.proteins_100g),
          carbs_g: num(n.carbohydrates_100g),
          fat_g: num(n.fat_100g),
        },
        servingSizeG: parseServingGrams(pickString(p.serving_size)),
        imageUrl: pickString(p.image_front_small_url) || null,
      };
    })
    .filter(Boolean);
}

/**
 * @param {string} barcode - EAN/UPC цифрами
 * @returns {Promise<{barcode, name, brand, per100:{calories,protein_g,carbs_g,fat_g}, servingSizeG:(number|null), imageUrl:(string|null)}>}
 */
export async function lookupBarcode(barcode) {
  const fields =
    'product_name,brands,nutriments,image_front_url,image_url,serving_size';
  const lc = i18n.locale || 'en';
  const url = `${OFF_URL}/${encodeURIComponent(
    barcode
  )}.json?lc=${lc}&fields=${fields}`;

  const res = await offFetch(url, { label: 'OFF barcode', allowStatuses: [404] });

  const json = await res.json().catch(() => null);
  if (res.status === 404 || !json || json.status !== 1 || !json.product) {
    throw new AppError(t('err.offNotFound'), 'NOT_FOUND');
  }

  const p = json.product;
  const n = p.nutriments || {};
  const per100 = {
    calories: Math.round(num(n['energy-kcal_100g'])),
    protein_g: num(n.proteins_100g),
    carbs_g: num(n.carbohydrates_100g),
    fat_g: num(n.fat_100g),
  };

  if (!per100.calories) {
    throw new AppError(t('err.offNoData'), 'NO_DATA');
  }

  return {
    barcode,
    name: (pickString(p.product_name) || t('res.unknownFood')).trim(),
    brand: firstBrand(p.brands),
    per100,
    servingSizeG: parseServingGrams(p.serving_size),
    imageUrl: p.image_front_url || p.image_url || null,
  };
}
