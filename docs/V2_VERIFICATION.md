# EatFirst V2 release verification — 2026-11-06

Production V1 is preserved until the V2 candidate passes its checks and the release is published. The branch is `feat/family-sharing-v2`.

## Executed checks

- Lint and TypeScript checking passed.
- 37 unit tests passed, including an actual IndexedDB V1→V2 upgrade fixture retaining the unchanged original kitchen, per-record diffs, sequential offline replay, stale-edit detection, migration deduplication, retained backups and shopping purchase history.
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

Actual hosted SMTP delivery and physical iPhone/Android installation are not claimed as tested. Supabase's default SMTP may restrict recipients/rate-limit messages; a suitable email provider must deliver signup/recovery email to the family. Email confirmation remains enabled. The actual confirmation/recovery application flows were tested through real local GoTrue + Mailpit.

Existing V1 backups remain accepted. V2 keeps the original `state/main` record and uses separate per-user/per-household caches and queues. Pending proposals and archived backups remain browser-local; clearing site data can remove them. Already-downloaded data cannot be remotely erased from an offline device after membership revocation. Modern browsers allow one active editor tab per browser profile to avoid local multi-tab queue races; other family phones are independent.

## Cleanup

The owner must run `docs/CLEANUP_TEST_ACCOUNTS.sql` in the hosted SQL Editor after all hosted tests. It removes only the agreed three accounts and their test households, with safeguards against unexpected names/memberships. Child inventory, shopping, history, frequencies, invitation and operation records cascade. This connection has no privileged hosted admin credentials, so cleanup is not falsely reported as automatic. No test passwords/session tokens are committed.
