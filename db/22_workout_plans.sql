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
