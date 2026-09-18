// src/lib/portionMemory.js
// Запоминает последний использованный размер порции для продукта (в граммах),
// чтобы при повторном добавлении не выставлять его заново.
// Локально (SecureStore), на устройство. Ключ — штрих-код или имя+бренд.

import * as SecureStore from 'expo-secure-store';

const KEY = 'portion_memory_v1';
const MAX_ENTRIES = 50; // держим значение под ~1.5 КБ (лимит SecureStore на Android)

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch (e) {
    cache = {};
  }
  return cache;
}

/** Стабильный ключ продукта: штрих-код, иначе имя|бренд. */
export function productKey(product) {
  if (!product) return null;
  if (product.barcode) return `bc:${product.barcode}`;
  const name = String(product.name || '').toLowerCase().trim();
  const brand = String(product.brand || '').toLowerCase().trim();
  if (!name) return null;
  return `nm:${name}|${brand}`;
}

export async function getPortion(key) {
  if (!key) return null;
  const m = await load();
  const v = m[key];
  return typeof v === 'number' && v > 0 ? v : null;
}

export async function setPortion(key, grams) {
  if (!key || !(grams > 0)) return;
  const m = await load();
  delete m[key]; // переставить в конец (грубый LRU)
  m[key] = Math.round(grams);

  const keys = Object.keys(m);
  if (keys.length > MAX_ENTRIES) {
    for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete m[k];
  }

  cache = m;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(m));
  } catch (e) {
    // не критично
  }
}
