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
