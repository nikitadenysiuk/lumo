-- ШАГ 10 — приватное хранилище фото еды.
--
-- Bucket 'meal-photos', НЕ публичный. Файлы лежат по пути <user_id>/<файл>.jpg.
-- Политики разрешают пользователю работать только со своей папкой.
-- Фото показываются через временные signed URL (генерируются в приложении).
--
-- Выполнить в Supabase → SQL Editor → Run.

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

-- Загрузка: только в свою папку
create policy "meal_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Чтение: только свои файлы
create policy "meal_photos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Удаление: только свои файлы
create policy "meal_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
