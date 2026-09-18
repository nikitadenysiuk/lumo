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
