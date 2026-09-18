# Legal documents

- `PRIVACY.md` — Privacy Policy draft
- `TERMS.md` — Terms of Service draft

Both are **starting drafts**. Before publishing:

1. **Have them reviewed** by a lawyer familiar with your country and with the EU
   (the backend and likely some users are in the EU). Pay special attention to
   §7/§8 of the Terms (health disclaimer, subscriptions) and §4/§6 of the Privacy
   Policy (AI processing, data‑subject rights).
2. **Fill every `[BRACKETED]` placeholder** — legal name, contact email(s),
   address/country, effective date, minimum age, governing law.
3. **Account deletion** is implemented: Profile → "Delete account" runs the
   `delete_account()` DB function (`db/16_delete_account.sql` — run it in
   Supabase). It wipes all app data and tries to remove the `auth.users` record.
   After deploying, test it with a throwaway account and check in Supabase →
   Authentication → Users whether the login record is gone; if the function
   couldn't remove it (no rights on the `auth` schema in your project), either
   move deletion to an Edge Function with the service‑role key, or state in the
   Privacy Policy that you remove the login record manually within N days.
4. **Host each document at a stable public URL** — options:
   - a page on your website / a GitHub Pages site;
   - a public file in Supabase Storage;
   - a Notion / Google Sites page.
5. **Put the URLs in the app.** Edit `src/config/legal.js`:

   ```js
   export const PRIVACY_URL = 'https://your-site/privacy';
   export const TERMS_URL   = 'https://your-site/terms';
   export const SUPPORT_EMAIL = 'support@yourdomain';
   ```

   Settings → "Legal" shows both links (opens in an in‑app browser). The
   Auth screen also links to them under the sign‑up button.
6. **App store metadata** needs the Privacy Policy URL in both App Store Connect
   and the Google Play Console.
7. Translations: the app is localised into 9 languages, but a single canonical
   English version of each document is acceptable for launch. Add translations
   later if needed.
