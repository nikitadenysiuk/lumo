-- ОБЪЕДИНЁННАЯ МИГРАЦИЯ РАЗДЕЛА «ТРЕНЕР» (db/17–22).
-- Выполнить ЦЕЛИКОМ в Supabase → SQL Editor → Run. Безопасно для повтора.
-- После выполнения: Supabase → Settings → API → Reload schema cache.


-- ======================================================================
-- 17_coach.sql
-- ======================================================================

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


-- ======================================================================
-- 18_supplements.sql
-- ======================================================================

-- «Тренер» · Фаза 2: трекер добавок (БАДов).
--
-- supplements     — что принимает пользователь: название, доза, расписание.
-- supplement_log  — отметки «принял» по дням и слотам времени.
--
-- Также обновляет delete_account() — добавляет новые таблицы и coach_cards
-- (пропущено в db/17) в явную очистку.
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  dose text,                       -- «1000 МЕ», «2 капсулы», «5 мл» и т.п. (свободный текст)
  times text[] not null default '{}',   -- слоты времени «HH:MM», по возрастанию
  days smallint[] not null default '{}', -- дни недели 1..7 (пн..вс); пусто = каждый день
  note text,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists supplements_user_idx
  on public.supplements (user_id, sort, created_at);

create table if not exists public.supplement_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  supplement_id uuid not null references public.supplements on delete cascade,
  taken_on date not null,
  slot text not null default '',    -- слот «HH:MM» либо '' (без конкретного времени)
  taken_at timestamptz not null default now(),
  unique (supplement_id, taken_on, slot)
);

create index if not exists supplement_log_user_date_idx
  on public.supplement_log (user_id, taken_on desc);

alter table public.supplements enable row level security;
alter table public.supplement_log enable row level security;

drop policy if exists "supp_select_own" on public.supplements;
drop policy if exists "supp_insert_own" on public.supplements;
drop policy if exists "supp_update_own" on public.supplements;
drop policy if exists "supp_delete_own" on public.supplements;
create policy "supp_select_own" on public.supplements for select using (auth.uid() = user_id);
create policy "supp_insert_own" on public.supplements for insert with check (auth.uid() = user_id);
create policy "supp_update_own" on public.supplements for update using (auth.uid() = user_id);
create policy "supp_delete_own" on public.supplements for delete using (auth.uid() = user_id);

drop policy if exists "supplog_select_own" on public.supplement_log;
drop policy if exists "supplog_insert_own" on public.supplement_log;
drop policy if exists "supplog_delete_own" on public.supplement_log;
create policy "supplog_select_own" on public.supplement_log for select using (auth.uid() = user_id);
create policy "supplog_insert_own" on public.supplement_log for insert with check (auth.uid() = user_id);
create policy "supplog_delete_own" on public.supplement_log for delete using (auth.uid() = user_id);

-- delete_account(): добавляем coach_cards, supplements, supplement_log
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.supplement_log where user_id = uid;
  delete from public.supplements where user_id = uid;
  delete from public.coach_cards where user_id = uid;
  delete from public.meals where user_id = uid;
  delete from public.favorites where user_id = uid;
  delete from public.weight_log where user_id = uid;
  delete from public.water_log where user_id = uid;
  delete from public.search_history where user_id = uid;
  delete from public.feed_cache where user_id = uid;
  delete from public.profiles where id = uid;

  begin
    delete from auth.users where id = uid;
  exception when others then
    raise notice 'delete_account: auth.users not removed (%.%)', sqlstate, sqlerrm;
  end;
end;
$$;

grant execute on function public.delete_account() to authenticated;


-- ======================================================================
-- 19_workouts.sql
-- ======================================================================

-- «Тренер» · Фаза 3: трекер тренировок.
--
-- workouts      — одна тренировка: дата, тип, длительность, ощущение, ккал, дистанция.
-- workout_sets  — подходы силовой тренировки (упражнение / повторы / вес).
--
-- Также обновляет delete_account() — добавляет новые таблицы.
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_on date not null default current_date,
  type text not null default 'strength',  -- strength|cardio|run|walk|bike|swim|yoga|other
  title text,
  duration_min integer check (duration_min is null or (duration_min >= 0 and duration_min <= 1440)),
  distance_km numeric check (distance_km is null or (distance_km >= 0 and distance_km <= 1000)),
  calories_est integer check (calories_est is null or (calories_est >= 0 and calories_est <= 20000)),
  feeling smallint check (feeling is null or feeling between 1 and 3),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists workouts_user_date_idx
  on public.workouts (user_id, workout_on desc);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  exercise text not null,
  set_index smallint not null default 1,
  reps smallint check (reps is null or (reps >= 0 and reps <= 1000)),
  weight_kg numeric check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 2000)),
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists workout_sets_workout_idx
  on public.workout_sets (workout_id, sort);
create index if not exists workout_sets_user_ex_idx
  on public.workout_sets (user_id, exercise, created_at);

alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;

drop policy if exists "wo_select_own" on public.workouts;
drop policy if exists "wo_insert_own" on public.workouts;
drop policy if exists "wo_update_own" on public.workouts;
drop policy if exists "wo_delete_own" on public.workouts;
create policy "wo_select_own" on public.workouts for select using (auth.uid() = user_id);
create policy "wo_insert_own" on public.workouts for insert with check (auth.uid() = user_id);
create policy "wo_update_own" on public.workouts for update using (auth.uid() = user_id);
create policy "wo_delete_own" on public.workouts for delete using (auth.uid() = user_id);

drop policy if exists "ws_select_own" on public.workout_sets;
drop policy if exists "ws_insert_own" on public.workout_sets;
drop policy if exists "ws_delete_own" on public.workout_sets;
create policy "ws_select_own" on public.workout_sets for select using (auth.uid() = user_id);
create policy "ws_insert_own" on public.workout_sets for insert with check (auth.uid() = user_id);
create policy "ws_delete_own" on public.workout_sets for delete using (auth.uid() = user_id);

-- delete_account(): добавляем workout_sets, workouts
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.workout_sets where user_id = uid;
  delete from public.workouts where user_id = uid;
  delete from public.supplement_log where user_id = uid;
  delete from public.supplements where user_id = uid;
  delete from public.coach_cards where user_id = uid;
  delete from public.meals where user_id = uid;
  delete from public.favorites where user_id = uid;
  delete from public.weight_log where user_id = uid;
  delete from public.water_log where user_id = uid;
  delete from public.search_history where user_id = uid;
  delete from public.feed_cache where user_id = uid;
  delete from public.profiles where id = uid;

  begin
    delete from auth.users where id = uid;
  exception when others then
    raise notice 'delete_account: auth.users not removed (%.%)', sqlstate, sqlerrm;
  end;
end;
$$;

grant execute on function public.delete_account() to authenticated;


-- ======================================================================
-- 20_coach_kinds.sql
-- ======================================================================

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


-- ======================================================================
-- 21_coach_chat.sql
-- ======================================================================

-- «Тренер» · Фаза 4: чат «спроси тренера».
--
-- coach_messages — история переписки с ИИ-тренером.
-- Лимит бесплатных вопросов (3/день) проверяется на клиенте по этой же таблице
-- (стоимость запроса на flash-lite мизерная, отдельный серверный счётчик не нужен).
--
-- Также обновляет delete_account().
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_user_idx
  on public.coach_messages (user_id, created_at);

alter table public.coach_messages enable row level security;

drop policy if exists "cm_select_own" on public.coach_messages;
drop policy if exists "cm_insert_own" on public.coach_messages;
drop policy if exists "cm_delete_own" on public.coach_messages;
create policy "cm_select_own" on public.coach_messages for select using (auth.uid() = user_id);
create policy "cm_insert_own" on public.coach_messages for insert with check (auth.uid() = user_id);
create policy "cm_delete_own" on public.coach_messages for delete using (auth.uid() = user_id);

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.coach_messages where user_id = uid;
  delete from public.workout_sets where user_id = uid;
  delete from public.workouts where user_id = uid;
  delete from public.supplement_log where user_id = uid;
  delete from public.supplements where user_id = uid;
  delete from public.coach_cards where user_id = uid;
  delete from public.meals where user_id = uid;
  delete from public.favorites where user_id = uid;
  delete from public.weight_log where user_id = uid;
  delete from public.water_log where user_id = uid;
  delete from public.search_history where user_id = uid;
  delete from public.feed_cache where user_id = uid;
  delete from public.profiles where id = uid;

  begin
    delete from auth.users where id = uid;
  exception when others then
    raise notice 'delete_account: auth.users not removed (%.%)', sqlstate, sqlerrm;
  end;
end;
$$;

grant execute on function public.delete_account() to authenticated;


-- ======================================================================
-- 22_workout_plans.sql
-- ======================================================================

-- «Тренер» · Фаза 3 (доп.): план тренировок, собранный ИИ по ответам пользователя.
--
-- workout_plans — сохранённые планы. Активным считается последний созданный
-- (active = true); при создании нового старые помечаются active = false.
--
-- Также обновляет delete_account().
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  payload jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists workout_plans_user_idx
  on public.workout_plans (user_id, created_at desc);

alter table public.workout_plans enable row level security;

drop policy if exists "wp_select_own" on public.workout_plans;
drop policy if exists "wp_insert_own" on public.workout_plans;
drop policy if exists "wp_update_own" on public.workout_plans;
drop policy if exists "wp_delete_own" on public.workout_plans;
create policy "wp_select_own" on public.workout_plans for select using (auth.uid() = user_id);
create policy "wp_insert_own" on public.workout_plans for insert with check (auth.uid() = user_id);
create policy "wp_update_own" on public.workout_plans for update using (auth.uid() = user_id);
create policy "wp_delete_own" on public.workout_plans for delete using (auth.uid() = user_id);

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.workout_plans where user_id = uid;
  delete from public.coach_messages where user_id = uid;
  delete from public.workout_sets where user_id = uid;
  delete from public.workouts where user_id = uid;
  delete from public.supplement_log where user_id = uid;
  delete from public.supplements where user_id = uid;
  delete from public.coach_cards where user_id = uid;
  delete from public.meals where user_id = uid;
  delete from public.favorites where user_id = uid;
  delete from public.weight_log where user_id = uid;
  delete from public.water_log where user_id = uid;
  delete from public.search_history where user_id = uid;
  delete from public.feed_cache where user_id = uid;
  delete from public.profiles where id = uid;

  begin
    delete from auth.users where id = uid;
  exception when others then
    raise notice 'delete_account: auth.users not removed (%.%)', sqlstate, sqlerrm;
  end;
end;
$$;

grant execute on function public.delete_account() to authenticated;

