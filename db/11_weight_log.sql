-- Трекинг веса: одна запись на календарный день (можно перезаписать).
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

create table if not exists public.weight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  logged_on date not null default (now() at time zone 'utc')::date,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 500),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index if not exists weight_log_user_date_idx
  on public.weight_log (user_id, logged_on desc);

alter table public.weight_log enable row level security;

drop policy if exists "weight_select_own" on public.weight_log;
drop policy if exists "weight_insert_own" on public.weight_log;
drop policy if exists "weight_update_own" on public.weight_log;
drop policy if exists "weight_delete_own" on public.weight_log;

create policy "weight_select_own"
  on public.weight_log for select using (auth.uid() = user_id);
create policy "weight_insert_own"
  on public.weight_log for insert with check (auth.uid() = user_id);
create policy "weight_update_own"
  on public.weight_log for update using (auth.uid() = user_id);
create policy "weight_delete_own"
  on public.weight_log for delete using (auth.uid() = user_id);
