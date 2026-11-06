# EatFirst V2 Supabase setup (not deployed)

V2 is developed on `feat/family-sharing-v2`. The existing production app remains V1 until authentication, database privacy and synchronization tests pass, the project is configured and a release is approved. Never merge this branch while these gates are incomplete.

## One-time database setup

Use **only** the dedicated EatFirst Supabase project. Open **SQL Editor → New query**, copy the complete migration below, and run it once:

https://github.com/amaijulianson-source/EatFirst/blob/feat/family-sharing-v2/supabase/migrations/202611060001_family.sql

Use GitHub’s **Raw** button to copy the SQL. It creates household tables, RLS policies, transactional RPCs, invitation token hashing/expiry, idempotency records and realtime publication. It does not copy existing local groceries. Do not run files under `tests/security/` in your hosted project: those bootstrap a disposable test database only.

## Authentication

Authentication → URL Configuration:

- Site URL: `https://amaijulianson-source.github.io/EatFirst/`
- Allowed redirect URL: `https://amaijulianson-source.github.io/EatFirst/`
- Email/password signups enabled. Keep email confirmation enabled on the real project.

For local verification only, temporarily add `http://localhost:4179/` to allowed redirect URLs if requested. The local Supabase test instance is separate and does not require changing hosted email-confirmation settings.

Supabase’s default email provider may rate-limit messages or restrict recipient delivery. Configure your own SMTP provider later if family signup emails do not arrive; no paid service is required by the app. Never turn off household RLS or expose a service-role key to work around an error.

## Frontend configuration

Project URL is the root `https://mbcfjavjmboyongdmowb.supabase.co`, without `/rest/v1/`.

Build-time values:

- `VITE_SUPABASE_URL`: root project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key (legacy anon key also supported).

These values are public browser configuration, not privileged credentials. Service-role/secret keys and database passwords must never enter Vite variables, source files, screenshots or chat. Local `.env.local` is ignored by Git. GitHub Actions will read repository secrets with the two names above after the release is ready. Nothing is deployed merely by preparing them.

## Release gates

- Local PostgreSQL isolation tests and local Supabase auth/integration tests must pass.
- Hosted migration must be installed, and real-project email confirmation/login and two-family isolation must be verified.
- Owner/member invitation, removal, shopping/inventory realtime, conflicts, idempotent retries, offline reload/reconnect and confirmed legacy migration must pass.
- V1 local data must survive database version upgrade; the local `state/main` kitchen is never replaced by cloud data.
- Production build and PWA checks must pass before any merge/default-branch push or deployment.
