-- Разбивка блюда на ингредиенты (для покомпонентной корректировки грамм).
-- Храним как jsonb-массив: [{name, grams, calories, protein_g, carbs_g, fat_g}, ...]
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повторного запуска.

alter table public.meals add column if not exists items jsonb;
