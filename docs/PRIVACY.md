# Privacy Policy — Lumo

**Draft — review with a lawyer before publishing.** Replace every `[BRACKETED]`
placeholder. This template aims to be GDPR‑aware because the app stores data in
the EU, but it is not legal advice.

**Effective date:** `[DATE]`
**Last updated:** `[DATE]`

## 1. Who we are

Lumo ("**Lumo**", "**we**", "**us**") is a mobile app for logging food and
tracking calories and macronutrients.

The data controller is `[LEGAL NAME / SOLE TRADER NAME]`, `[ADDRESS OR COUNTRY]`.
Contact: **`[privacy@yourdomain]`**.

We have not appointed a Data Protection Officer; the contact above handles
privacy requests.

## 2. What data we collect

**You give us:**

| Data | Why |
|---|---|
| Email address and password | Create and secure your account (password is hashed by our auth provider; we never see it) |
| Food diary entries — food names, calories, protein/fat/carbs, portion sizes, meal type, date/time, optional notes | The core service |
| Photos of meals you choose to add | Shown in your diary; sent for AI analysis (see §4) |
| Weight log, water log, fasting window setting | Optional tracking features |
| Goals (calorie/macro targets, target weight) and profile inputs (sex, age, height, weight, activity) if you complete onboarding | Calculate and show your daily targets |
| App settings — theme, accent colour, language, units, reminder preferences | Personalise the app |
| Favourites and recipes you save, search history within the app | Speed up repeat logging |

**Collected automatically:**

- Device language and region (via the operating system) to pick a default
  language and measurement units.
- Basic technical error logs (locally / in our infrastructure) to diagnose
  crashes. We do **not** use third‑party analytics or advertising SDKs.

We do **not** collect precise location, contacts, or your device's photo
library beyond the individual images you select.

## 3. How we use your data and our legal bases (GDPR Art. 6)

- **Provide the service** (store your diary, calculate goals, show trends) —
  performance of our contract with you (Art. 6(1)(b)).
- **Analyse meal photos / text descriptions** — necessary to provide a feature
  you request (Art. 6(1)(b)); for photos, also your explicit choice to submit
  each image.
- **Send local reminders** — only if you turn them on (consent, Art. 6(1)(a));
  you can turn them off any time in Settings.
- **Keep the app secure and fix bugs** — our legitimate interest (Art. 6(1)(f)).

We do **not** use your data for advertising and we do **not** sell it.

## 4. Third parties that process your data

| Provider | What they receive | Purpose | Their policy |
|---|---|---|---|
| **Supabase** (database, authentication, file storage; EU region — Ireland) | All account and diary data, meal photos | Hosting the backend | `https://supabase.com/privacy` |
| **Google — Gemini API** | Meal photos and text food descriptions you submit for analysis; **not** your identity | AI estimate of calories and macros | `https://ai.google.dev/gemini-api/terms` and Google's privacy policy |
| **Open Food Facts** | The barcode number you scan or type | Look up packaged‑product nutrition | `https://world.openfoodfacts.org/privacy` |
| **Apple / Google** (App Store / Google Play) | Purchase and subscription data if you buy a subscription | Process payments and manage subscriptions | Apple / Google policies |

`[If you later add RevenueCat, Sentry, push notifications, etc., add rows here.]`

Meal photos and food descriptions sent to Google's Gemini API may be processed
on servers **outside the EU (e.g. the United States)**. Where we rely on such
transfers we use the European Commission's Standard Contractual Clauses or an
adequacy decision. Per Google's API terms, prompts submitted through the paid
Gemini API tier are not used to train Google's models; confirm the tier you use.

## 5. Storage, security and retention

- Data is stored with Supabase in the EU (Ireland).
- Traffic between the app and our backend is encrypted (HTTPS/TLS). Your login
  session is stored in your device's secure keychain.
- Row‑Level Security ensures each user can only read and write their own rows.
- We keep your data until you delete your account or ask us to delete it. If you
  are inactive for `[e.g. 24 months]` we may delete your account after notifying
  you at your email address.
- Backups are retained for up to `[e.g. 30 days]` and then overwritten.

## 6. Your rights

You can, at any time:

- **Access / export** your data — the app exports your full diary to CSV
  (Settings → Export). For a copy of all other data, email us.
- **Correct** inaccurate data — edit entries in the app or contact us.
- **Delete** your account and data — in the app: **Profile → Delete account**.
  This permanently removes your diary, photos, weight/water logs, favourites and
  profile. `[If your Supabase project's function cannot remove the auth record
  itself, state that the login record is removed within X days by us, and give a
  contact for confirmation.]`
- **Restrict or object** to processing, and **withdraw consent** for reminders.
- **Data portability** — receive your data in a machine‑readable format (CSV /
  JSON).
- **Complain** to your local supervisory authority (for the EU, the list is at
  `https://edpb.europa.eu/about-edpb/about-edpb/members_en`).

We respond to requests within 30 days.

## 7. Children

Lumo is not directed to children. You must be at least `[13 / 16 — pick per your
target countries]` years old to use it. If you believe a child has given us data,
contact us and we will delete it.

## 8. Changes to this policy

We may update this policy. If changes are material we will notify you in the app
or by email before they take effect. The "Last updated" date above always
reflects the current version.

## 9. Contact

`[privacy@yourdomain]` — `[LEGAL NAME]`, `[ADDRESS OR COUNTRY]`.
