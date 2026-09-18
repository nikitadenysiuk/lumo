-- ШАГ (после MVP) — онбординг + дневная цель по калориям.
--
-- Добавляем в profiles данные пользователя и считаем норму калорий
-- по формуле Миффлина-Сан-Жеора. Пользователь НЕ может писать в profiles
-- напрямую (нет update-политики) — только через функцию save_profile.
--
-- Выполнить в Supabase → SQL Editor → Run.

alter table public.profiles
  add column if not exists sex text check (sex in ('male', 'female')),
  add column if not exists age integer check (age between 10 and 120),
  add column if not exists height_cm integer check (height_cm between 100 and 250),
  add column if not exists weight_kg numeric check (weight_kg between 30 and 400),
  add column if not exists activity text check (activity in
    ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  add column if not exists goal text check (goal in ('lose', 'maintain', 'gain')),
  add column if not exists daily_kcal_goal integer,
  add column if not exists onboarded_at timestamptz;

-- Полный профиль: счётчик анализов + данные онбординга + цель.
create or replace function public.get_profile()
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  v_limit int := 3;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then
    insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;
    select * into p from public.profiles where id = auth.uid();
  end if;

  return json_build_object(
    'used', p.analyses_used,
    'limit', v_limit,
    'is_pro', p.is_pro,
    'remaining', greatest(v_limit - p.analyses_used, 0),
    'onboarded', p.onboarded_at is not null,
    'sex', p.sex,
    'age', p.age,
    'height_cm', p.height_cm,
    'weight_kg', p.weight_kg,
    'activity', p.activity,
    'goal', p.goal,
    'daily_kcal_goal', p.daily_kcal_goal
  );
end;
$$;

-- Сохранить данные онбординга и пересчитать дневную норму.
create or replace function public.save_profile(
  p_sex text,
  p_age integer,
  p_height_cm integer,
  p_weight_kg numeric,
  p_activity text,
  p_goal text
)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_bmr numeric;
  v_factor numeric;
  v_tdee numeric;
  v_goal_kcal integer;
begin
  if p_sex not in ('male', 'female') then raise exception 'bad sex'; end if;
  if p_activity not in ('sedentary','light','moderate','active','very_active')
    then raise exception 'bad activity'; end if;
  if p_goal not in ('lose', 'maintain', 'gain') then raise exception 'bad goal'; end if;
  if p_age is null or p_age < 10 or p_age > 120 then raise exception 'bad age'; end if;
  if p_height_cm is null or p_height_cm < 100 or p_height_cm > 250
    then raise exception 'bad height'; end if;
  if p_weight_kg is null or p_weight_kg < 30 or p_weight_kg > 400
    then raise exception 'bad weight'; end if;

  -- Миффлин-Сан-Жеор
  v_bmr := 10 * p_weight_kg + 6.25 * p_height_cm - 5 * p_age
         + (case when p_sex = 'male' then 5 else -161 end);

  v_factor := case p_activity
    when 'sedentary' then 1.2
    when 'light' then 1.375
    when 'moderate' then 1.55
    when 'active' then 1.725
    when 'very_active' then 1.9
  end;

  v_tdee := v_bmr * v_factor;

  v_goal_kcal := round(
    (v_tdee + (case p_goal when 'lose' then -500 when 'gain' then 400 else 0 end)) / 10.0
  ) * 10;
  if v_goal_kcal < 1200 then v_goal_kcal := 1200; end if;

  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;

  update public.profiles set
    sex = p_sex,
    age = p_age,
    height_cm = p_height_cm,
    weight_kg = p_weight_kg,
    activity = p_activity,
    goal = p_goal,
    daily_kcal_goal = v_goal_kcal,
    onboarded_at = coalesce(onboarded_at, now())
  where id = auth.uid();

  return public.get_profile();
end;
$$;

grant execute on function public.get_profile() to authenticated;
grant execute on function public.save_profile(text, integer, integer, numeric, text, text)
  to authenticated;
