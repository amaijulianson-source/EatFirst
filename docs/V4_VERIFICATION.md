# EatFirst V4 verification

## Local checks actually executed

- ESLint and TypeScript passed.
- **151 unit tests passed**: all V3 checks plus 53 new tests covering Dutch/English grocery normalization, product identity preservation, package quantities, date extraction/type/order/year rules, invalid dates, GTIN checksums, photo parsing, duplicate views versus separate batches, product-memory reuse without dates, explicit frozen labels overriding older storage patterns, shopping transfers/selection/concurrency, exact batch merging, date assignment, scoped patterns and persisted draft baselines.
- **24 browser tests passed** on desktop and phone-sized Chromium: all existing V3 flows plus quick-add pattern reuse, batch purchased-item transfer, date confirmation, actual English/Dutch multi-photo OCR, draft restoration, actual offline OCR, actual EAN-13 image decoding, editable opt-in lookup, separate date-photo matching, incorrect draft removal and cancellation without inventory changes. The free registry response is mocked in that browser test; Tesseract, language models, images and ZXing are real.
- Independent PostgreSQL RLS/RPC tests passed. Full disposable local GoTrue/PostgREST/database two-browser household/migration/offline/conflict/transfer and authentication tests passed. No production SQL or real user account mutation was performed.
- Runtime npm audit: zero known vulnerabilities.

A Tesseract language-object initialization issue was found in real browser testing. The implementation uses the supported string-language initialization and seeds only trusted bundled model bytes into the library cache; cached blob worker/core scripts allow tested offline recognition. Generated third-party OCR assets are excluded from authored-source lint, while application code and the asset-preparation script remain linted. No failing recognition test is represented as a pass.

## Final release checks

PR #3 introduced V4; PR #4 added the explicit frozen-storage regression fix and hardened the release checks. The initial publication was cancelled before it could replace V3. Two CI attempts stalled while Ubuntu downloaded optional font packages; Chromium setup now uses the hosted runner's existing Linux libraries and has a bounded timeout. All browser/security/family checks remain required.

An isolated desktop OCR timeout did not reproduce in eight additional real multi-photo/offline OCR repetitions. CI now serializes the WASM-heavy browser tests. Another run exposed a race in the cancellation test: recognition could finish before Stop was clicked. That test now pauses an actual tool download until cancellation, with service workers blocked only in that single test so routing is deterministic. The other recognition tests exercise real service-worker/offline operation. The final local run passed all 24 tests, and the complete PR check passed: https://github.com/amaijulianson-source/EatFirst/actions/runs/42237533191 .

## Deployment and actual public verification

**EatFirst V4 is live and verified at https://amaijulianson-source.github.io/EatFirst/.** PR #3 and PR #4 were merged without force-pushing. Released source: `4bc141e31baeeed542610d5a239c86fb762d1417`. The complete production workflow passed and GitHub Pages publication succeeded on 2026-11-06: https://github.com/amaijulianson-source/EatFirst/actions/runs/42237889893 . Its build repeated lint, typecheck, all 151 unit tests, PostgreSQL security tests, real local authentication/family integration, all 24 browser tests and both Pages-path production builds. Future default-branch updates retain automatic deployment.

Checks performed against the actual public HTTPS app after publication:

- **All 24 desktop/mobile browser tests passed (52.7 seconds)**: original inventory, expiry, shopping, recipes, waste, persistence and backup flows; V3 cooking/favorites/history/photography; and all new V4 entry flows.
- Actual English/Dutch multi-photo OCR, real EAN-13 image decoding, persisted unfinished reviews, date-only photo matching, batch purchased transfers, confirmation/edit/removal/cancellation and actual offline OCR after reload passed under the production `/EatFirst/` path. The optional Open Food Facts response is mocked in its browser test; live registry coverage/availability is not claimed.
- Manifest, 192/512/maskable icons, Apple icon, exact service-worker scope, offline navigation/refresh and phone overflow checks passed, with zero critical page errors. Chromium reported zero installability errors.
- A persistent browser profile seeded from the actual V3 production site detected a waiting V4 worker. Closing all old windows and reopening activated V4. Its V3 grocery and favorite survived; the new entry chooser worked offline with zero page errors. This is a controlled Chromium update check, not a claim about every physical phone's update timing.
- The real Google authorization handoff reached Google's valid sign-in screen with the exact production redirect and S256 PKCE. A valid cancellation returned to Family with a readable error and cleaned callback parameters. Personal Google consent/account interaction was not automated; that flow was owner-verified in V2 and is unchanged.
- Read-only hosted probes confirmed Google remains enabled and all eight shared tables deny anonymous reads with PostgreSQL code 42501. No hosted mutations were performed. Household isolation, migration, durable offline queues, conflicts and atomic changes passed against disposable local real GoTrue/PostgREST/PostgreSQL services; the cross-device browser suite exercises the refetch fallback. Existing hosted realtime implementation and policies are unchanged.

No production SQL migration, real household/account deletion, data reset, new credential or paid service was required. Existing grocery backups, V1 migration and recipe-memory backups remain available. Product patterns have a separate validated device-local backup.

## Practical limits

Recognition needs readable English/Dutch labels, package text, receipts or barcodes. Unlabelled bare groceries cannot be reliably identified. Always review names, package counts, dates, storage and expiry type before confirmation. Missing date years are never invented. Photo tools need an initial online preparation of about 9 MB; optional registry lookup needs a connection and may not contain a product. Exact reusable patterns are account/kitchen/device-local, with shared inventory/activity providing household suggestions. Raw photos/full OCR are not uploaded or retained. Physical phone cameras, HEIC decoding, iPhone/Android installation and full Google account consent were not automated. Never clear site storage to update; close all old EatFirst windows and reopen online.
