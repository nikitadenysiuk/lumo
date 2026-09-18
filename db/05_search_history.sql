-- История поиска: каждый анализ фото / скан штрих-кода / выбор из поиска,
-- даже если пользователь НЕ сохранил это в дневник.
--
-- Выполнить в Supabase → SQL Editor → Run.

create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('photo', 'barcode', 'search')),
  title text,
  calories integer,          -- для photo — на порцию; для barcode/search — на 100 г
  photo_url text,
  created_at timestamptz not null default now()
);

create index search_history_user_created_idx
  on public.search_history (user_id, created_at desc);

alter table public.search_history enable row level security;

create policy "sh_select_own"
  on public.search_history for select using (auth.uid() = user_id);
create policy "sh_insert_own"
  on public.search_history for insert with check (auth.uid() = user_id);
create policy "sh_delete_own"
  on public.search_history for delete using (auth.uid() = user_id);
