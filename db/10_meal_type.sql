-- Тип приёма пищи (завтрак/обед/ужин/перекус).
-- created_at уже есть и задаётся при insert — отдельная колонка не нужна.
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

alter table public.meals add column if not exists meal_type text
  check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));
