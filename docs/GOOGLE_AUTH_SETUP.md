# Google sign-in for EatFirst V2 (release remains blocked)

V1 stays live at https://amaijulianson-source.github.io/EatFirst/. Changes are on `feat/family-sharing-v2`; do not merge before real Google login and release gates pass. This replaces the previous SMTP plan. No email-password signup, SMTP account, paid plan, custom domain or new GitHub secret is needed for Google-only authentication.

## 1. Google Cloud — owner action

Open https://console.cloud.google.com/ with the Google account that should own the configuration. Create/select an EatFirst project. Open **Google Auth Platform → Get started** (older consoles: APIs & Services → OAuth consent screen).

- Branding: name **EatFirst**, your support/contact email. A logo is optional; skip it initially. No Gmail or Drive API is needed.
- Audience: **External** for personal Google accounts. Start in Testing. Add your own and family Google addresses as test users if the console requests them. Google documents an exception to Testing warnings/7-day authorizations for apps requesting only basic sign-in scopes; do not add extra scopes to this app. Before final release review the Audience publishing status. Branding verification is distinct from basic login; do not buy a domain or try to verify ownership of `supabase.co`.
- Data Access: only **openid**, **userinfo.email**, **userinfo.profile**.
- Clients → Create client → **Web application**, name **EatFirst web**.
- Authorized JavaScript origin (no path): `https://amaijulianson-source.github.io`
- Authorized redirect URI (exact): `https://mbcfjavjmboyongdmowb.supabase.co/auth/v1/callback`

Create the client. Keep its Client Secret private. The Supabase callback is the Google redirect URI; the Pages URL is the app destination configured in Supabase. Do not swap these.

## 2. Supabase — owner action

In the existing EatFirst project:

1. **Authentication → Sign In / Providers → Google**. Enable the provider. Enter the Google Client ID and Client Secret, then save.
2. Keep **Skip nonce checks** off and **Skip email verification** off if those options appear.
3. **Authentication → URL Configuration**: Site URL and allowed redirect URL must include the exact `https://amaijulianson-source.github.io/EatFirst/` (capital F, trailing slash). No wildcard redirect is needed.
4. Leave the global **Allow new users to sign up** enabled: Google users need to create Supabase accounts on first login. Do not disable this global setting to disable email signup.
5. **After actual Google login is verified**, disable the **Email provider** in Sign In / Providers. This removes email/password and email OTP entry points without disabling Google signup. Keep existing account records, household tables, RLS and invitation checks intact. Do not disable email confirmation as a workaround. Google verifies the account identity; account recovery belongs to Google.

Never send the Google secret in chat, store it in Vite variables or add it to GitHub. Existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are sufficient for the frontend. Client secrets are used by Supabase's server only.

## 3. App behavior

**Family → Continue with Google** uses Supabase's authorization-code flow with PKCE and an account chooser. The app requests no Gmail/Drive access and no Google offline access. Supabase refreshes its own persisted session. The callback returns to the app root under `/EatFirst/` and opens Family, so Pages needs no callback route or server rewrite.

A valid invitation is retained on this device before leaving for Google. After signing in, explicitly accept the invitation with your own display name. Owner-created links expire after 48 hours, work once, can be revoked, and may be restricted to the recipient's Google account email. Share links privately using your preferred messenger. No invitation email is automatically sent. Creating a Google/Supabase account alone grants no access to another household.

Local groceries are never uploaded just by signing in. **Review local migration → Confirm** is still required. The original local kitchen and dated backup are preserved. No database migration is needed for this login UI change.

## 4. Mandatory verification before replacing V1

Automated local checks verify OAuth request parameters, PKCE challenge/verifier, callback errors, retained invitations, real GoTrue callback/session exchange, session persistence/logout, RLS, invitation constraints, offline edits, conflicts and migration. Local callback fixtures use local GoTrue email verification, explicitly **not Google's external consent screen**. They establish callback transport correctness but cannot prove Google credentials, consent or physical PWA behavior.

After provider configuration, verify real Google sign-in in a V2 preview while V1 remains unchanged. A preview URL must be added explicitly to Supabase's redirect allowlist and built with its own base path; the Google redirect remains the Supabase callback above. Do not deploy V2 over V1 merely to get a test login screen.

Use two independent Google accounts/browser profiles for actual sign-in, sign-out/reopen, invitation acceptance, denied outsider access, inventory and shopping realtime. Test a refresh, offline/reconnect, and confirmed local migration. No real household should be deleted during verification.

On iPhone Safari and Android Chrome, test from the installed icon as well. OAuth may open a browser window; returning to an installed PWA can vary by OS/browser version and separate storage contexts. If a callback says it cannot finish, retry in the same Safari/Chrome context where sign-in started. Do not clear site data. Do not promise identical PWA authentication behavior on all phones. Offline use requires a prior successful online load and existing cached session/data; first sign-in always needs internet.

## Sources checked 2026-11-06

- Supabase Google setup and browser OAuth: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- Google Audience / basic-sign-in Testing exception: https://support.google.com/cloud/answer/15549945
- Supabase redirect allowlist: https://supabase.com/docs/guides/auth/redirect-urls
