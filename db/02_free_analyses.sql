-- ШАГ 9 — лимит бесплатных анализов (3 шт), дальше показываем Paywall.
--
-- Как это работает:
--  * у каждого пользователя строка в public.profiles со счётчиком analyses_used
--  * строка создаётся автоматически триггером при регистрации
--  * пользователь НЕ может менять счётчик напрямую (нет update-политики)
--  * счётчик увеличивает только функция consume_analysis() — она выполняется
--    с правами владельца (security definer), в обход RLS
--
-- Это не абсолютная защита (клиент может просто не вызвать consume_analysis),
-- но для MVP достаточно. Полная защита появится вместе с Edge Function (ШАГ 7).
--
-- Выполнить целиком в Supabase → SQL Editor → Run.

-- 1. Таблица профилей ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  analyses_used integer not null default 0,
  is_pro boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Пользователь видит только свой профиль. Insert/Update/Delete-политик нет
-- намеренно: строку создаёт триггер, счётчик меняет только функция ниже.
create policy "profiles_select_own"
  on public.profiles for select using (auth.uid() = id);

-- 2. Авто-создание профиля при регистрации ----------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили для уже существующих пользователей (тестовые аккаунты из ШАГА 8).
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- 3. Посмотреть остаток (без побочных эффектов) -----------------------------
create or replace function public.analysis_quota()
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_used int;
  v_pro boolean;
  v_limit int := 3;
begin
  select analyses_used, is_pro into v_used, v_pro
  from public.profiles where id = auth.uid();

  if not found then
    insert into public.profiles (id) values (auth.uid())
    on conflict (id) do nothing;
    v_used := 0;
    v_pro := false;
  end if;

  return json_build_object(
    'used', v_used,
    'limit', v_limit,
    'is_pro', v_pro,
    'remaining', greatest(v_limit - v_used, 0)
  );
end;
$$;

-- 4. Зафиксировать использование одного бесплатного анализа ----------------
create or replace function public.consume_analysis()
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_used int;
  v_pro boolean;
  v_limit int := 3;
begin
  select analyses_used, is_pro into v_used, v_pro
  from public.profiles where id = auth.uid()
  for update;

  if not found then
    insert into public.profiles (id, analyses_used) values (auth.uid(), 1);
    return json_build_object(
      'used', 1, 'limit', v_limit, 'is_pro', false,
      'remaining', greatest(v_limit - 1, 0)
    );
  end if;

  if not v_pro then
    update public.profiles set analyses_used = analyses_used + 1
    where id = auth.uid()
    returning analyses_used into v_used;
  end if;

  return json_build_object(
    'used', v_used,
    'limit', v_limit,
    'is_pro', v_pro,
    'remaining', greatest(v_limit - v_used, 0)
  );
end;
$$;

grant execute on function public.analysis_quota() to authenticated;
grant execute on function public.consume_analysis() to authenticated;
