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
