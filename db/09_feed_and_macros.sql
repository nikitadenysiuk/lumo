-- (1) Кэш ленты рецептов на пользователя.
-- (2) get_profile теперь считает цели по БЖУ из дневной нормы калорий и веса.
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

create table if not exists public.feed_cache (
  user_id uuid primary key references auth.users on delete cascade,
  goal text,
  lang text,
  recipes jsonb,
  updated_at timestamptz not null default now()
);

alter table public.feed_cache enable row level security;

drop policy if exists "fc_select_own" on public.feed_cache;
drop policy if exists "fc_insert_own" on public.feed_cache;
drop policy if exists "fc_update_own" on public.feed_cache;

create policy "fc_select_own" on public.feed_cache for select using (auth.uid() = user_id);
create policy "fc_insert_own" on public.feed_cache for insert with check (auth.uid() = user_id);
create policy "fc_update_own" on public.feed_cache for update using (auth.uid() = user_id);

-- get_profile + цели по БЖУ
create or replace function public.get_profile()
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  v_limit int := 3;
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

  v_kcal := coalesce(p.daily_kcal_goal, 0);
  if v_kcal > 0 and p.weight_kg is not null then
    -- белок: 1.6–1.8 г/кг, но не больше 35% калорий
    v_prot := round(p.weight_kg *
      (case p.goal when 'lose' then 1.8 when 'gain' then 1.8 else 1.6 end));
    if v_prot * 4 > v_kcal * 0.35 then
      v_prot := round(v_kcal * 0.35 / 4.0);
    end if;
    -- жиры: 28% калорий
    v_fat := round(v_kcal * 0.28 / 9.0);
    -- углеводы: остаток
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
    'daily_kcal_goal', p.daily_kcal_goal,
    'protein_goal', v_prot,
    'fat_goal', v_fat,
    'carbs_goal', v_carb
  );
end;
$$;

grant execute on function public.get_profile() to authenticated;
