# EatFirst V2 Supabase setup

The owner verified the Google-authenticated preview and authorized production release. The existing household database and real accounts are preserved. Future deployments run through the default-branch GitHub Actions workflow.

## One-time database setup

Use **only** the dedicated EatFirst Supabase project. Open **SQL Editor → New query**, copy the complete migration below, and run it once:

https://github.com/amaijulianson-source/EatFirst/blob/feat/family-sharing-v2/supabase/migrations/202611060001_family.sql

Use GitHub’s **Raw** button to copy the SQL. It creates household tables, RLS policies, transactional RPCs, invitation token hashing/expiry, idempotency records and realtime publication. It does not copy existing local groceries. Do not run files under `tests/security/` in your hosted project: those bootstrap a disposable test database only.

## Authentication

Use **Google OAuth** for the family's accounts. Follow the exact owner-only Google Cloud and Supabase setup in [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md). The previous email/SMTP setup is superseded. Keep email provider settings unchanged until Google login is verified, then disable the Email provider, not global signup. RLS stays enabled.

## Frontend configuration

Project URL is the root `https://mbcfjavjmboyongdmowb.supabase.co`, without `/rest/v1/`.

Build-time values:

- `VITE_SUPABASE_URL`: root project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key (legacy anon key also supported).

These values are public browser configuration, not privileged credentials. Service-role/secret keys and database passwords must never enter Vite variables, source files, screenshots or chat. Local `.env.local` is ignored by Git. GitHub Actions will read repository secrets with the two names above after the release is ready. Nothing is deployed merely by preparing them.

## Release gates

- Local PostgreSQL isolation tests and local Supabase auth/integration tests must pass.
- Hosted migration must be installed, and real-project Google OAuth login and two-family isolation must be verified.
- Owner/member invitation, removal, shopping/inventory realtime, conflicts, idempotent retries, offline reload/reconnect and confirmed legacy migration must pass.
- V1 local data must survive database version upgrade; the local `state/main` kitchen is never replaced by cloud data.
- Production build and PWA checks must pass before any merge/default-branch push or deployment.
