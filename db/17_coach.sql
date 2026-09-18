-- «Тренер» · Фаза 1: кэш дневной карточки коуча.
--
-- Одна карточка на пользователя в день (на конкретном языке). Генерируется
-- через Gemini один раз и переиспользуется весь день. Лимит анализов не тратит.
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

create table if not exists public.coach_cards (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_date date not null,
  lang text not null default 'en',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, card_date)
);

create index if not exists coach_cards_user_date_idx
  on public.coach_cards (user_id, card_date desc);

alter table public.coach_cards enable row level security;

drop policy if exists "coach_cards_select_own" on public.coach_cards;
drop policy if exists "coach_cards_insert_own" on public.coach_cards;
drop policy if exists "coach_cards_update_own" on public.coach_cards;
drop policy if exists "coach_cards_delete_own" on public.coach_cards;

create policy "coach_cards_select_own"
  on public.coach_cards for select using (auth.uid() = user_id);
create policy "coach_cards_insert_own"
  on public.coach_cards for insert with check (auth.uid() = user_id);
create policy "coach_cards_update_own"
  on public.coach_cards for update using (auth.uid() = user_id);
create policy "coach_cards_delete_own"
  on public.coach_cards for delete using (auth.uid() = user_id);
