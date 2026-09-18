-- Избранное + полезная нагрузка для истории поиска
-- (чтобы по тапу в истории можно было заново открыть продукт с БЖУ).
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

alter table public.search_history add column if not exists payload jsonb;

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  calories integer,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

drop policy if exists "fav_select_own" on public.favorites;
drop policy if exists "fav_insert_own" on public.favorites;
drop policy if exists "fav_delete_own" on public.favorites;

create policy "fav_select_own"
  on public.favorites for select using (auth.uid() = user_id);
create policy "fav_insert_own"
  on public.favorites for insert with check (auth.uid() = user_id);
create policy "fav_delete_own"
  on public.favorites for delete using (auth.uid() = user_id);
