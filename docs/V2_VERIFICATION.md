# EatFirst V2 release verification — 2026-11-06

Production V1 is preserved until the V2 candidate passes its checks and the release is published. The branch is `feat/family-sharing-v2`.

## Executed checks

- Lint and TypeScript checking passed.
- 38 unit tests passed, including an actual IndexedDB V1→V2 upgrade fixture retaining the unchanged original kitchen, per-record diffs, sequential offline replay, stale-edit detection, migration deduplication, retained backups and shopping purchase history.
- Independent PostgreSQL tests passed: RLS enabled on all exposed tables; anonymous and cross-household access denied; direct writes denied even to owners; owner/member controls; restricted and single-use invitations; revocation; atomic conflict rejection; duplicate operation acknowledgements; removed-member access denial. The narrowly scoped cleanup SQL was also tested to preserve non-test users and households.
- The reproducible local stack (`npm run test:family-local`) passed using actual GoTrue Auth, PostgREST, PostgreSQL and Mailpit, without the oversized full Supabase development image. It verified signup, password login, token refresh, logout, email confirmation with PKCE, session persistence, password recovery/update and login with the changed password.
- Two local browser profiles passed household creation, invitation acceptance, confirmed local migration, inventory and shopping sharing via reconnect/refetch fallback, offline editing + cached reload + reconnection, frequently bought history and atomic shopping-to-inventory transfer. The original local kitchen was present after logout.
- Actual hosted Supabase API tests passed using three disposable, pre-confirmed test accounts: login, refresh, logout, separate household isolation, restricted/single-use/revoked invitations, owner/member rules, concurrent edits (one accepted/one rejected), idempotency and all-or-nothing consumption events.
- Two browser profiles connected to the actual hosted Supabase project passed inventory and shopping realtime sharing, offline reload/reconnect, confirmed migration and preserved local data, frequencies and atomic purchased-item transfer. Both received real `postgres_changes` frames (not mocked callbacks).
- A deliberately dropped successful RPC response was retried without duplicate consumption. Competing offline consumption from two phones produced one winning server event and a retained conflict proposal on the other device; confirmed resolution preserved that proposal in a local backup.
- An independent hosted websocket isolation check subscribed an outsider to a known foreign household ID. The authorized owner received updates; the outsider received **zero** data events, even though a channel join acknowledgement was permitted.
- Browser scenarios reported zero uncaught page errors.

## Scope and limits

Hosted tests used the supplied publishable key and temporary ordinary-user sessions, never a service-role key. All test households are named `EatFirst V2 verification …`. Browser profiles are isolated; no real user's browser/local food was read or reset.

The local services are real Auth and database implementations. Local tests use a refetch fallback because no local Realtime server was started. Websocket behavior and cross-household websocket isolation were tested against the real hosted Supabase service instead.

Google OAuth now replaces email/password signup in the V2 UI. SMTP delivery is no longer a release requirement. Real Google provider configuration/consent and physical iPhone/Android OAuth return behavior remain release gates; earlier local email confirmation/recovery checks are historical evidence, not evidence of Google login.

Existing V1 backups remain accepted. V2 keeps the original `state/main` record and uses separate per-user/per-household caches and queues. Pending proposals and archived backups remain browser-local; clearing site data can remove them. Already-downloaded data cannot be remotely erased from an offline device after membership revocation. Modern browsers allow one active editor tab per browser profile to avoid local multi-tab queue races; other family phones are independent.

## Cleanup

The owner must run `docs/CLEANUP_TEST_ACCOUNTS.sql` in the hosted SQL Editor after all hosted tests. It removes only the agreed three accounts and their test households, with safeguards against unexpected names/memberships. Child inventory, shopping, history, frequencies, invitation and operation records cascade. This connection has no privileged hosted admin credentials, so cleanup is not falsely reported as automatic. No test passwords/session tokens are committed.

## Final release hardening

An offline transition now aborts in-flight cloud fetches immediately; the sync coordinator owns retries rather than allowing a REST retry loop to delay local queued edits. A unit regression check covers cancellation. Existing local PostgreSQL security tests and the complete Auth/offline browser stack passed again after this change.

The owner executed the guarded cleanup script and reported `remaining_test_accounts = 0`. An independent login check confirmed all three former test accounts now reject authentication. Hosted fixture households were removed by the same cascading cleanup transaction. The temporary hosted password/config files were deleted and will not ship.

A revoked member with an offline pending edit was also tested: server access was denied, the pending proposal remained exportable, and a private retained backup remained available after switching back to the local kitchen. This avoids stranding unsynchronized work after removal. Local email/PKCE/recovery and the full two-browser stack passed again with that behavior.

## Google OAuth change — 2026-11-06

Implemented Google-only login UI with the official multicolor Google mark, a same-window Supabase PKCE redirect, explicit Google account chooser, retained invitation links, safe cancellation/error messaging and Google profile name defaults. No shared data/schema/RLS changes. Email/password signup and recovery forms are removed; account recovery belongs to Google. Google Client Secret is configured only in Supabase, never the frontend.

Executed after the change:

- Lint and TypeScript checks passed; **43 unit tests** passed, including redirect/options, offline/provider failure, callback/invitation handling and name metadata.
- Independent PostgreSQL RLS/RPC/cleanup tests passed.
- Actual local GoTrue/PostgREST integration and two-browser family tests passed: private households, restricted/single-use/revoked invitations, original V1 migration, cached session restoration, inventory/shopping refetch, offline queue/reload/reconnect, frequent purchases, atomic transfer and revoked-member proposal export. Local browser sessions use actual local GoTrue fixture tokens; they do not impersonate Google sign-in.
- Browser Google button test inspected the real SDK authorization URL: Google provider, correct redirect, account chooser and S256 PKCE challenge. Cancellation preserved the pending invitation and showed a readable error. No password field remained.
- Real local GoTrue confirmation fixture exercised the production PKCE callback code, session persistence across refresh, Google-style metadata and logout across refresh. **This is not a real Google consent test.**
- Existing Playwright suite: **6 passed** across desktop and phone viewport.
- Production build at exact `/EatFirst/` base passed. Browser checked the actual Pages-subdirectory OAuth redirect, manifest/icons, matching service-worker scope, offline launch/refresh, no horizontal overflow and zero JavaScript errors. Mobile sign-in screenshot inspected in `artifacts/v2-google-login-mobile.png`.

Still required before deployment: owner configures Google OAuth client/provider; actual Google account login/logout/persistence and two-account invitation/sync checks in a V2 preview; installed-phone callback behavior. Hosted realtime/privacy tests previously passed before this auth UI change, but are not falsely represented as Google-authenticated checks. No V2 public deployment or main-branch update was performed. V1 stays live.

## Configured Google provider and isolated preview — 2026-11-06

Hosted public Auth settings now report Google enabled, email enabled and global signup allowed. An actual hosted Supabase authorization request reached Google's account sign-in screen with PKCE and without an invalid-client/redirect error. No account password was entered, no Google login token was obtained and no token exchange is claimed.

The isolated Pages preview uses its own local database, auth-session key, pending-invitation key and PWA scope. A real combined V1/preview browser check created a V1 grocery, opened V2 under the controlling V1 service worker, added preview food, and returned to usable V1. V1's database version, grocery, auth marker and invitation marker were unchanged; preview food stayed separate. Preview PWA manifest/icons/scope/offline launch/refresh passed without page errors or phone overflow. All 43 unit tests, lint/typecheck and the full local Auth/household/offline browser stack passed again after isolation changes.

Google account completion on the phone is the remaining manual gate. The owner must add the exact preview redirect to Supabase and sign in there before V2 replaces V1. The preview uses real Supabase household records, so it is not a mock cloud service. Main receives only an isolated-preview hosting workflow; V2 app source remains on its feature branch.

## Public preview verification — 2026-11-06

Preview deployment succeeded: https://amaijulianson-source.github.io/EatFirst/v2-preview/ . The default URL still serves V1. Workflow run: https://github.com/amaijulianson-source/EatFirst/actions/runs/42211860197 . Both feature-branch CI runs for `606c6e0` passed.

Verified on the actual public URLs, not just localhost:

- Combined V1/preview test passed: a fresh browser profile added V1 food, navigated under V1's worker to the preview, added separate food and returned to usable V1. V1 database version, food, auth-storage marker and invitation marker remained unchanged.
- Preview and original V1 manifest/icons/scope, offline launch/refresh, phone overflow and JavaScript-error checks passed.
- The real preview Google button reached Google's valid sign-in page with the exact preview redirect and S256 PKCE. A valid provider-state cancellation request to the real Supabase callback returned to preview Family and displayed a readable error, without exposing error parameters in the final URL.
- All eight hosted household tables denied anonymous reads with PostgreSQL permission code `42501` (HTTP 401 for anonymous callers). No shared data was exposed or modified.

The owner added the preview redirect to Supabase. Actual Google account completion, session persistence/logout and Google-authenticated invitation/sync checks are awaiting the owner's phone interaction. No Google password or session token is requested. Do not merge V2 over V1 before that gate passes.

Reproduce the non-interactive provider/cancellation check with `node tests/security/google-provider-browser.mjs`. It does not sign into a Google account. To target another properly configured V2 deployment set `EATFIRST_URL` including its trailing slash. This script uses a fresh browser profile and stores only its sign-in-screen capture under ignored test-results.

## Owner-approved production release — 2026-11-06

The owner personally verified the real Google-account preview: sign-in, persistent sessions, household creation, invitation generation/acceptance, shared inventory, realtime shopping and logout/re-login all worked. The owner explicitly authorized V2 to replace V1, stated their V1 data is disposable, and required preservation of all real Supabase accounts/households. No real account/household is modified or deleted by release checks. Local migration remains available for other users.

The final workflow runs lint/typecheck, units, PostgreSQL policy checks, the complete disposable local Auth/household suite, six desktop/mobile flows and Pages-path cloud-configured builds before deploying. The original preview remains at its existing scope/storage to preserve old invitation links and in-flight OAuth callbacks. The root worker excludes preview navigation. Worker updates wait for old windows to close instead of forcing reloads during edits.

## Production deployment completed — 2026-11-06

**V2 is live:** https://amaijulianson-source.github.io/EatFirst/ . PR #1 merged without force-pushing at `e0a7b47c1c5e58cf5b4d5cf301af1cc65bea8743`. Automatic Pages deployment succeeded: https://github.com/amaijulianson-source/EatFirst/actions/runs/42214250959 . Both final branch CI runs for `f171bd5` succeeded before merge.

Checks actually executed for release:

- Lint, TypeScript, all 43 unit tests, production Pages build and cloud configuration validation passed.
- Independent PostgreSQL RLS/RPC suite and real disposable GoTrue/PostgREST two-browser Auth/household/migration/offline/conflict/shopping tests passed. The local family suite initially collided with concurrently running Playwright's output-directory cleanup; a sequential rerun passed. Production CI runs the suites sequentially and passed.
- Hosted Google configuration was enabled, global signup allowed, and all eight household tables denied anonymous reads with PostgreSQL permission code `42501`. No real hosted account or household was modified/deleted.
- **All six Playwright desktop/mobile tests passed on the actual production HTTPS URL**: grocery CRUD/consumption/waste, shopping purchase/transfer, persistence, recipe suggestions/cooking deduction, search/filters, settings, backup/restore and empty states.
- Production manifest, 192/512/maskable icons, Apple icon and exact worker scope passed. Offline inventory navigation/refresh passed, with no horizontal phone overflow and zero page errors.
- Production Google button generated the correct root redirect and S256 PKCE, reached a valid Google sign-in screen and returned through the real hosted cancellation callback to production Family. Full Google-account login and household/realtime checks were personally verified by the owner in preview; automated production tests do not pretend to log into that private account.
- An isolated persistent browser profile with the previous **real deployed V1 worker and grocery** detected the waiting V2 worker without forced reload. Closing all windows and reopening activated V2, retained the V1 grocery through schema upgrade and refresh, and produced zero page errors. This verifies Chromium's cached-worker upgrade mechanism, not a physical iPhone/Android installation.
- Main-worker installation preserved the preview cache in a separate browser check, and preview remained usable offline. The retained public preview's offline/manifest checks also passed after production release.

Existing preview households are real Supabase households and remain intact. On the main URL use the same Google account and select the existing household under Family → Active kitchen. Preview sessions/local data remain separate by design. V1 migration is still available for users who need it. No storage-clearing update instruction is required. Physical installed-PWA OAuth/browser behavior can differ by platform; opening online, closing old windows and reopening is the supported update path.
