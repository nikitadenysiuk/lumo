# Edge Function: `gemini`

Прокси к Google Gemini. Ключ Gemini теперь **только на сервере** — в приложение
не попадает, из собранного APK/IPA его не вытащить.

`supabase/functions/gemini/index.ts` — код функции.

---

## Развёртывание — через дашборд (без установки чего-либо)

1. **Сгенерируй НОВЫЙ ключ Gemini.** Старый попал в предыдущие сборки —
   его нужно отозвать. https://aistudio.google.com/apikey → Create API key →
   скопируй. Затем на том же экране удали (Revoke) старый ключ.

2. Supabase → проект → слева **Edge Functions** → **Create a new function** (или
   **Deploy a new function** → **Via Editor**).
   - Имя: `gemini`
   - Открой `supabase/functions/gemini/index.ts`, скопируй **весь** файл, вставь
     в редактор (замени шаблон).
   - **Deploy**.

3. Задай секрет с ключом Gemini:
   Supabase → **Edge Functions** → вкладка **Secrets** (или Project Settings →
   Edge Functions → Secrets) → **Add new secret**:
   - Name: `GEMINI_API_KEY`
   - Value: новый ключ из шага 1
   - Save.
   (`SUPABASE_URL` и `SUPABASE_ANON_KEY` уже доступны функции автоматически —
   их добавлять не надо.)

4. **Убери ключ из приложения.** Открой `.env` в корне проекта и удали строку
   `EXPO_PUBLIC_GEMINI_API_KEY=...` целиком. Перезапусти `expo start -c`.

5. Проверь в приложении: сфотографируй еду, «Спросить AI» по названию,
   сгенерируй рецепт, лента рецептов на Главной. Всё должно работать как раньше.
   Если лимит бесплатных анализов исчерпан — открывается Paywall (теперь это
   проверяется на сервере, не обойти).

---

## Развёртывание — через CLI (если поставлен Supabase CLI)

```bash
supabase login
supabase link --project-ref <ref>          # ref из URL проекта
supabase secrets set GEMINI_API_KEY=<новый-ключ>
supabase functions deploy gemini
```

Затем шаги 4–5 выше.

---

## Что делает функция

- Принимает `{ kind, model, body }` от приложения.
- Проверяет, что запрос от **залогиненного пользователя** (по JWT) — иначе 401.
- `model` — только из белого списка (защита от вызова дорогих моделей).
- Для `kind` = `photo` / `byName` / `recipes`: проверяет лимит бесплатных
  анализов (`analysis_quota`), при исчерпании — **402**, и списывает один
  (`consume_analysis`) **только после успешного ответа** Gemini.
- `kind` = `feed` (лента рецептов) лимит не тратит.
- Ответ Gemini отдаётся приложению как есть — вся логика разбора осталась в
  `src/services/aiService.js`.

## Расходы

Supabase Edge Functions: бесплатно до 500 000 вызовов/мес. Gemini: тот же
бесплатный тариф, что и раньше. Ничего платить не нужно.
