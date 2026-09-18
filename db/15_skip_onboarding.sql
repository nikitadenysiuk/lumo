-- ШАГ 15 — «пропустить онбординг»: ручной ввод цели по калориям без анкеты.
--
-- Единственное изменение: save_goal_overrides теперь помечает профиль как
-- onboarded (onboarded_at), если он ещё не помечен. Это позволяет новому
-- пользователю задать норму калорий напрямую и попасть в приложение,
-- минуя 4 шага мастера.
--
-- Для уже прошедших онбординг coalesce сохраняет старую метку — поведение
-- экрана «Цели» не меняется.
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

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
    target_weight_kg = p_target_weight,
    onboarded_at = coalesce(onboarded_at, now())
  where id = auth.uid();

  return public.get_profile();
end;
$$;

grant execute on function public.save_goal_overrides(integer, integer, integer, integer, numeric)
  to authenticated;
