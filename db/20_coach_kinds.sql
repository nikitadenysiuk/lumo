-- «Тренер» · Фаза 3b: разные виды карточек коуча в coach_cards.
--
-- Добавляет колонку kind ('day' — дневная карточка, 'workout' — совет по тренировкам)
-- и делает её частью первичного ключа: теперь на день может быть по одной карточке
-- каждого вида.
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

alter table public.coach_cards
  add column if not exists kind text not null default 'day';

do $$
begin
  alter table public.coach_cards drop constraint if exists coach_cards_pkey;
exception when others then null;
end $$;

alter table public.coach_cards
  add primary key (user_id, card_date, kind);
