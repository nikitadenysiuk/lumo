-- ШАГ 6 — таблица дневника питания.
-- Выполнено в Supabase SQL Editor. Хранится здесь для истории.

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  food_name text,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  photo_url text,
  created_at timestamptz not null default now()
);

create index meals_user_created_idx on public.meals (user_id, created_at desc);

alter table public.meals enable row level security;

create policy "meals_select_own"
  on public.meals for select using (auth.uid() = user_id);
create policy "meals_insert_own"
  on public.meals for insert with check (auth.uid() = user_id);
create policy "meals_update_own"
  on public.meals for update using (auth.uid() = user_id);
create policy "meals_delete_own"
  on public.meals for delete using (auth.uid() = user_id);
