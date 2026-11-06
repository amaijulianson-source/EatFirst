# EatFirst

**https://amaijulianson-source.github.io/EatFirst/**

A private kitchen companion for using food before it goes to waste. Use a local kitchen without an account, or opt into a shared household with separate family accounts. GitHub Pages hosts the static PWA; optional Supabase Free provides Auth, PostgreSQL and Realtime.

## Everyday features

- Today dashboard, date-aware inventory, search/category/storage/expiry filters, quick multi-add and partial eaten/used/discarded tracking.
- Safety-related use-by dates kept distinct from quality-related best-before dates. No invented expiry dates or freshness predictions; past-date foods are excluded from automatic recipes.
- 27 offline recipes with explicit ingredient aliases, adjustable pantry assumptions, missing ingredients to shopping and confirmed inventory deductions.
- Shopping mode, priorities, categories, notes, search, purchase history/frequently bought items and purchased-to-inventory transfer. Transfer prompts for package dates and changes both records atomically in a household.
- Waste history/charts and recorded estimated values only; no fabricated savings or environmental claims.
- Light/dark/device appearance, accessible responsive layout, mobile bottom navigation, local illustrations/icons, installable PWA and offline application cache.
- JSON backup export/validated replacement import and explicitly labelled local sample mode.

## Start your family kitchen

1. Open EatFirst from its installed home-screen icon. Use **Family** (people icon in the header, or Family & sync in the desktop sidebar).
2. Create your own account, confirm your email, and sign in. Open confirmation links in the same browser where possible; if the link opens elsewhere, return to the installed app and sign in after confirmation.
3. Create a household. Its creator is the owner; every member uses their own account and password.
4. To bring existing groceries across, choose **Review local migration** and confirm. Your original local kitchen stays intact and a dated local backup is saved. Migration adds inventory, shopping, activity and purchase history, skips matching IDs/duplicate active shopping names, and blocks differing records with matching IDs for review. It does not replace household pantry settings.
5. **Create invitation link**, preferably restricted to the recipient's email. Share it privately. It expires after 48 hours and works once. The family member opens it, signs in/creates their own account and accepts. Reopen the invitation after email confirmation if necessary.
6. Select the household to share inventory, shopping, quantities, date fields, activity and relevant preferences. Owners can rename it, revoke invitations and remove members. Switching to **On this device · local kitchen** or signing out restores the original local kitchen.

Email confirmation stays enabled. Supabase's default email service may restrict recipients and rate-limit signup/recovery messages. The project owner must configure a suitable SMTP provider if needed for family delivery. No SMTP credential belongs in GitHub/Vite or chat. Password recovery works through **Forgot password?**; open the recovery email in the browser where the request was started (use Safari/Chrome for recovery if the installed app's storage is separate).

## Install

- **iPhone:** Open the public link in Safari → Share → Add to Home Screen → Open as Web App if offered → Add.
- **Android:** Open in Chrome → ⋮ → Install app / Add to Home screen → Install.

Let the first online load finish. If an old installed version remains visible, close all EatFirst windows/tabs and reopen. **Do not clear browser storage to update:** it may hold the original kitchen, pending changes or preserved backups.

Physical-device installation is not claimed as tested; browser labels and standalone behavior vary. There are no automatic background expiry alerts. Open Today for date priorities.

## Sync, privacy and conflicts

A household edit is a durable, per-record change batch with a unique operation ID and expected prior record values. A database transaction checks membership, locks the household, compares expected values, applies all changes or none, and records the operation once. Repeated requests acknowledge the same operation rather than repeating consumption. Conflicting edits do not silently overwrite a family member's work.

Realtime signals trigger atomic household refetches. Reconnect, focus, successful subscription and a visible-page periodic refresh also retry/refetch. Offline edits stay in an IndexedDB queue scoped to the authenticated user and household. Previously authenticated devices can display their cache offline; authentication or expired-session recovery can require going online.

**Family** shows synced/pending/offline/error/conflict states. Conflicts retain the local proposal. Export it or explicitly keep the shared version: a dated proposal backup and operation archive are preserved first. Re-enter any intended changes from that backup. Later queued edits are preserved with the proposal, not silently replayed over a conflict.

Modern browsers permit one active editor tab per browser profile to prevent local queue races. Another tab shows a read-only notice; close the editor and reload the other tab to use it. Different family phones have independent queues. Use one editor tab in browsers without Web Locks support.

RLS protects every exposed table. Normal clients cannot directly write tables, including owners; checked RPCs control mutations, invitations and membership management. Invitation tokens are random, hashed in PostgreSQL and validated for email restriction, expiry, revocation and reuse. Only owners manage membership. Publishable/anon keys are intentionally public; secret/service-role keys are never included in the frontend.

Local mode uploads no groceries. Family mode stores shared records and account information with Supabase and caches household records on devices. Logged-out UI does not show the household cache, but the browser is **not an encrypted vault**. Already-downloaded records cannot be remotely erased from an offline device after removal; online access is rechecked on refetch. Use trusted browser profiles. No analytics or advertising is included.

## Data and backups

IndexedDB schema version 2 adds `caches` and `backups` while retaining V1 `state/main` unchanged. Cloud data never replaces that legacy record. Backups retain the portable version-1 data format, with optional new shopping/purchase-history fields; old V1 exports remain accepted. Theme is per-device; household pantry/diet/currency preferences synchronize.

Export regularly. Import replaces the **active** kitchen after confirmation; in family mode it affects all members and preserves a local backup first. Sample loading and local data deletion are disabled while a household is active. Preserved backups are available in Family. Browser clearing, eviction, private browsing and device loss can erase local-only data and pending edits. There is no server backup of an edit until it synchronizes.

## Development and tests

Node 24, npm, and Chromium. Docker is needed for independent database/Auth integration tests.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:security
npx playwright install chromium
npm run test:family-local
npm run test:e2e
npm run build
```

Copy `.env.example` to `.env.local` for optional cloud features. Use the Supabase project root URL and publishable key. All `.env*.local` files and generated output are ignored; never commit privileged credentials.

`test:security` uses an isolated PostgreSQL container and exercises RLS/RPCs. `test:family-local` creates disposable Auth/REST/database/mail containers and browser fixtures, tests confirmation/recovery and two-device offline/refetch behavior, then cleans up its own services. It needs free loopback ports 4179, 4182, 54325–54330. It does not connect to the real Supabase project. Real hosted realtime/isolation tests are documented in [V2 verification](docs/V2_VERIFICATION.md); temporary test-user passwords/tokens are not committed or placed in CI.

To test the public release without changing server data:

```sh
PLAYWRIGHT_BASE_URL=https://amaijulianson-source.github.io/EatFirst/ npm run test:e2e
EATFIRST_URL=https://amaijulianson-source.github.io/EatFirst/ node tests/pwa-check.mjs
```

These use isolated browser profiles and local-mode groceries.

## Architecture

React, TypeScript, Vite, Dexie, Supabase JS, Lucide, plain CSS, Workbox/PWA, Vitest and Playwright. Business logic is separate from UI:

- `src/core.ts`, `src/recipes.ts`: inventory, dates, shopping/history, validated backups and offline recipes.
- `src/db.ts`: additive IndexedDB migration and preserved backups.
- `src/family/changes.ts`: per-record diffs, deterministic replay, migration merge and conflict detection.
- `src/family/store.ts`: authenticated scopes, cache/queue coordinator, realtime/reconnect, retries and resolution.
- `src/family/Family.tsx`, `ShoppingView.tsx`: family/account and shared shopping workflows.
- `supabase/migrations/`: reviewed database schema, RLS and transactional functions.

## Configuration and deployment

[Supabase setup](docs/SUPABASE_SETUP.md) covers database installation, Auth redirects and build variables. GitHub repository secrets are `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A build check rejects missing values and secret/service-role keys. GitHub Pages uses the exact `/EatFirst/` path for assets, manifest identity, scope, launch URL and service worker; hash navigation supports refresh without rewrites.

The feature branch has a **checks-only** workflow, including the independent database/Auth tests. The Pages workflow deploys default-branch updates after its checks pass. Do not merge a release whose hosted auth/privacy/sync or local-data upgrade gates are incomplete. HTTPS is provided by Pages. No custom domain or paid hosting is required.

For a local subpath rehearsal, set `BASE_PATH=/EatFirst/` on both build and preview. To roll back cloud behavior, retain the V2 database reader and backups; never reset/downgrade the browser database or delete queues as a rollback shortcut.

## Limits and next steps

No barcode lookup, automatic quantity conversion, guaranteed food freshness, background alerts or remote erase. Recipes use approximate quantities and conservative dietary tags; check labels/allergens and storage guidance. Waste counts are discard events; financial totals include only entered estimates, and changing currency relabels values without conversion. Household changes over 5000 record modifications require smaller batches. Account removal and permanent server-side household deletion require the project administrator; membership controls are available in-app.

Future improvements could include richer conflict comparisons, barcode assistance, push alerts where supported, additional reviewed recipes and more physical-device/accessibility testing. See [verification](docs/V2_VERIFICATION.md) for the checks actually executed and genuine remaining limits.
