-- ШАГ 16 — удаление аккаунта пользователем (требование App Store / Google Play,
-- и право на стирание по GDPR).
--
-- Функция delete_account() удаляет ВСЕ данные текущего пользователя и,
-- по возможности, саму учётную запись в auth.users.
--
-- Фото из Storage удаляет КЛИЕНТ через Storage API (см. supabaseClient.js) —
-- Supabase запрещает прямой delete из storage.objects.
--
-- Выполнить в Supabase → SQL Editor → Run. Безопасно для повтора.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- прикладные таблицы (на случай, если удалить auth.users не удастся —
  -- данные всё равно должны быть стёрты)
  delete from public.meals where user_id = uid;
  delete from public.favorites where user_id = uid;
  delete from public.weight_log where user_id = uid;
  delete from public.water_log where user_id = uid;
  delete from public.search_history where user_id = uid;
  delete from public.feed_cache where user_id = uid;
  delete from public.profiles where id = uid;

  -- сама учётная запись (остальное ушло бы каскадом и без этого)
  begin
    delete from auth.users where id = uid;
  exception when others then
    -- нет прав на схему auth в этом проекте — данные уже удалены выше,
    -- саму запись можно снести из дашборда Supabase → Authentication → Users
    raise notice 'delete_account: auth.users not removed (%.%)', sqlstate, sqlerrm;
  end;
end;
$$;

grant execute on function public.delete_account() to authenticated;
