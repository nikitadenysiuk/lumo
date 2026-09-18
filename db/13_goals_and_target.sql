-- Ручное переопределение целей (ккал + БЖУ) и целевой вес.
-- Пустое значение (null) = использовать автоматический расчёт.
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

alter table public.profiles
  add column if not exists target_weight_kg numeric
    check (target_weight_kg between 30 and 400),
  add column if not exists kcal_goal_override integer
    check (kcal_goal_override between 800 and 8000),
  add column if not exists protein_goal_override integer
    check (protein_goal_override between 0 and 500),
  add column if not exists fat_goal_override integer
    check (fat_goal_override between 0 and 500),
  add column if not exists carbs_goal_override integer
    check (carbs_goal_override between 0 and 1000);

-- get_profile: применяет переопределения поверх авто-расчёта.
create or replace function public.get_profile()
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  v_limit int := 3;
  v_kcal_auto int := 0;
  v_kcal int := 0;
  v_prot int := 0;
  v_fat int := 0;
  v_carb int := 0;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then
    insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;
    select * into p from public.profiles where id = auth.uid();
  end if;

  v_kcal_auto := coalesce(p.daily_kcal_goal, 0);
  v_kcal := coalesce(p.kcal_goal_override, v_kcal_auto);

  if v_kcal > 0 and p.weight_kg is not null then
    v_prot := round(p.weight_kg *
      (case p.goal when 'lose' then 1.8 when 'gain' then 1.8 else 1.6 end));
    if v_prot * 4 > v_kcal * 0.35 then
      v_prot := round(v_kcal * 0.35 / 4.0);
    end if;
    v_fat := round(v_kcal * 0.28 / 9.0);
    v_carb := greatest(0, round((v_kcal - v_prot * 4 - v_fat * 9) / 4.0));
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
    'daily_kcal_goal', coalesce(p.kcal_goal_override, nullif(v_kcal_auto, 0)),
    'daily_kcal_auto', nullif(v_kcal_auto, 0),
    'protein_goal', coalesce(p.protein_goal_override, v_prot),
    'fat_goal', coalesce(p.fat_goal_override, v_fat),
    'carbs_goal', coalesce(p.carbs_goal_override, v_carb),
    'protein_auto', v_prot,
    'fat_auto', v_fat,
    'carbs_auto', v_carb,
    'kcal_override', p.kcal_goal_override,
    'protein_override', p.protein_goal_override,
    'fat_override', p.fat_goal_override,
    'carbs_override', p.carbs_goal_override,
    'target_weight_kg', p.target_weight_kg
  );
end;
$$;

-- Сохранить переопределения. Любой параметр null → очистить (вернуть авто).
create or replace function public.save_goal_overrides(
  p_kcal integer,
  p_protein integer,
  p_fat integer,
  p_carbs integer,
  p_target_weight numeric
)
returns json
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_kcal is not null and (p_kcal < 800 or p_kcal > 8000) then
    raise exception 'bad kcal';
  end if;
  if p_protein is not null and (p_protein < 0 or p_protein > 500) then
    raise exception 'bad protein';
  end if;
  if p_fat is not null and (p_fat < 0 or p_fat > 500) then
    raise exception 'bad fat';
  end if;
  if p_carbs is not null and (p_carbs < 0 or p_carbs > 1000) then
    raise exception 'bad carbs';
  end if;
  if p_target_weight is not null and (p_target_weight < 30 or p_target_weight > 400) then
    raise exception 'bad target weight';
  end if;

  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;

  update public.profiles set
    kcal_goal_override = p_kcal,
    protein_goal_override = p_protein,
    fat_goal_override = p_fat,
    carbs_goal_override = p_carbs,
    target_weight_kg = p_target_weight
  where id = auth.uid();

  return public.get_profile();
end;
$$;

-- save_profile: при полном пересчёте через мастер снимаем ручную
-- норму калорий (её задают отдельно на экране «Цели»). Ручные Б/Ж/У
-- оставляем — это тонкая подстройка.
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
    kcal_goal_override = null,
    onboarded_at = coalesce(onboarded_at, now())
  where id = auth.uid();

  return public.get_profile();
end;
$$;

grant execute on function public.get_profile() to authenticated;
grant execute on function public.save_profile(text, integer, integer, numeric, text, text)
  to authenticated;
grant execute on function public.save_goal_overrides(integer, integer, integer, integer, numeric)
  to authenticated;
