# Email templates

Branded HTML for Supabase auth emails.

## Files

| File | Supabase template | Subject line to set |
|---|---|---|
| `confirm-signup.ru.html` | Authentication → Email Templates → **Confirm signup** | `Подтвердите адрес для Lumo` |
| `confirm-signup.en.html` | same (English variant) | `Confirm your email for Lumo` |

## How to install

1. Supabase dashboard → **Authentication** → **Email Templates** (or **Emails →
   Templates**) → select **Confirm signup**.
2. Open the `.html` file, copy **all** of it, paste into the template body
   (replace what's there).
3. Set the **Subject** field to the line from the table above.
4. Leave the Supabase variables intact — `{{ .ConfirmationURL }}` (the link) and
   `{{ .Email }}` (the address). Do not rename them.
5. Save. Send yourself a test (register a throwaway email).

## Notes

- Supabase email templates are **one language per template**. Pick RU or EN based
  on your main audience. Switching later = paste the other file.
- The design is light‑mode only (`color-scheme: light`). Email dark‑mode handling
  is unreliable across clients, so we keep a fixed light palette with strong
  contrast.
- Tested layout: Gmail (web/app), Apple Mail, Outlook (VML button fallback
  included). The coral gradient degrades to a solid coral in Outlook — expected.
- The logo is a CSS "L" in a white rounded square (no image to host). If you have
  a hosted PNG logo, you can swap the `<td>…L…</td>` cell for
  `<img src="https://…" width="64" height="64" alt="Lumo" />`.
- On the Supabase **free tier**, built‑in email is heavily rate‑limited and sent
  from a Supabase address. For production configure custom SMTP
  (Authentication → Emails → SMTP Settings) — the template stays the same.

## Other templates

Reset‑password / magic‑link / change‑email templates aren't included because the
app doesn't use those flows yet. When you add "forgot password", ask for a
matching `reset-password.*.html` — it's the same design with different copy.
