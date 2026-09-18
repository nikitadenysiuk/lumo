-- Тип избранного: 'product' (продукт/блюдо из поиска) или 'recipe' (рецепт).
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

alter table public.favorites
  add column if not exists kind text not null default 'product';
