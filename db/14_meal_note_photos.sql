-- Заметка к приёму пищи + несколько фото.
-- photos — jsonb-массив путей (storage) или внешних ссылок.
-- photo_url остаётся как «главное» фото (для миниатюр в списках).
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

alter table public.meals
  add column if not exists note text,
  add column if not exists photos jsonb;
