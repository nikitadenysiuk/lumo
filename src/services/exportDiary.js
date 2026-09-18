// src/services/exportDiary.js
// Выгрузка всего дневника в CSV-файл + системное «Поделиться».

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { fetchAllMeals } from './supabaseClient';
import { mealsToCsv } from '../lib/csv';
import { dayKey } from '../lib/days';

/**
 * @returns {Promise<{count:number, empty?:boolean, shared:boolean, uri?:string}>}
 */
export async function exportDiaryCsv() {
  const meals = await fetchAllMeals();
  if (!meals.length) return { count: 0, empty: true, shared: false };

  const csv = mealsToCsv(meals);
  const name = `lumo-diary-${dayKey(new Date())}.csv`;
  const uri = FileSystem.cacheDirectory + name;

  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return { count: meals.length, shared: false, uri };

  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: name,
  });
  return { count: meals.length, shared: true, uri };
}
