-- Трекинг воды: сколько стаканов выпито за календарный день.
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

create table if not exists public.water_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  logged_on date not null,
  glasses integer not null default 0 check (glasses >= 0 and glasses <= 30),
  updated_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index if not exists water_log_user_date_idx
  on public.water_log (user_id, logged_on desc);

alter table public.water_log enable row level security;

drop policy if exists "water_select_own" on public.water_log;
drop policy if exists "water_insert_own" on public.water_log;
drop policy if exists "water_update_own" on public.water_log;
drop policy if exists "water_delete_own" on public.water_log;

create policy "water_select_own"
  on public.water_log for select using (auth.uid() = user_id);
create policy "water_insert_own"
  on public.water_log for insert with check (auth.uid() = user_id);
create policy "water_update_own"
  on public.water_log for update using (auth.uid() = user_id);
create policy "water_delete_own"
  on public.water_log for delete using (auth.uid() = user_id);
