# Voice inventory verification

Release candidate: `feat/natural-voice-inventory`, replacing V4 photo/scanning entry. V5 visual research was preserved separately in a named Git stash; it is not included in this release. No production database changes, test-user creation, household deletion, billing or paid API activation was performed.

## Local checks actually executed

- TypeScript and ESLint passed. Exact `/EatFirst/` production build and frontend cloud configuration validation passed. All **28** desktop/mobile browser tests also passed against that production-path build (36.8 seconds). Its manifest/icons/scope, offline launch/refresh, phone overflow and page-error checks passed.
- **223 unit tests passed**, including the owner's complete messy example, English/Dutch number words, multi-food clauses, fillers, repeated mentions, count and name corrections, approximate quantities, contextual package increments, date types/local dates/DST/year boundaries, low-stock descriptions, stock-check versus purchase reconciliation, stale-record rejection, explicit shopping opt-in, private draft validation/isolation, actual IndexedDB persistence, backup round-trips, family deltas, and unknown-quantity recipe verification.
- Capture lifecycle is tested independently with injected Web Speech API-shaped events: final/interim deduplication, 15-second pause without finalization, service end/resume, unfinished phrase recovery, permission/network/language/no-speech errors, startup timeout, background interruption, final flush, cancellation and abort cleanup. These are lifecycle simulations, **not real microphone transcription accuracy**.
- **28 desktop/phone-sized Chromium browser tests passed** (48.0 seconds), including the final stale-draft/current-inventory regression. Tested voice review edits/removal/manual missing items, native textarea fallback, saved/restored drafts, explicit confirmation, offline interpretation/save/reload, stock total replacement, purchase batches, low-stock shopping opt-in, removed photo options, and all existing recipes/shopping/waste/backup flows.
- `test:security` passed against disposable Docker PostgreSQL fixtures: RLS, cross-household access, invitations, operations and cleanup-script preservation tests. It did **not** execute cleanup against the real project.
- `test:family-local` passed in a disposable GoTrue/PostgREST/PostgreSQL stack with two browser accounts: household creation/invite acceptance, original local migration and data preservation after logout, shared groceries/shopping via refetch fallback, offline queue/reload/reconnect, purchase history, shopping transfer, membership revocation with retained pending export, and real local auth callback/session/logout checks. New voice totals, low-stock and unknown-quantity fields round-tripped through the actual RPC and another browser. An offline voice update returned as one existing grocery, without duplicate addition. Full transcripts were absent from the shared snapshot. No production family account was used.
- `npm audit --omit=dev` found **zero runtime vulnerabilities**. The complete audit found 12 low/moderate build-tool dependency findings, zero high or critical; no forced dependency upgrades were applied.
- Read-only checks of the actual hosted Supabase project confirmed Google enabled and anonymous inventory/shopping/membership/invitation requests rejected (401, zero exposed records). No hosted mutation or authenticated family test was performed.
- Production V4 was loaded into a separate persistent Chromium profile with a deliberately local-only grocery for the subsequent update test. V4's service worker controlled that profile; actual family storage was not used.

## WebKit and device verification boundary

The WebKit binary downloaded successfully, but the local machine could not launch it because six system libraries are missing. The environment has no root/scoped installer privileges; its apt attempt was denied. That failed launch is not reported as a pass. Feature CI installs WebKit and its dependencies and runs the voice suite with an iPhone-sized WebKit project; its result must be recorded before merging.

Actual Apple/Google speech transcription, physical iPhone Safari/home-screen microphone permissions, calls, screen locking, recognition accuracy, keyboard dictation and battery behavior are **not physically tested here**. On unsupported browsers/configurations the app offers an editable transcript and keyboard dictation, not a false active microphone. Browser API existence is not treated as proof that the vendor service started. No guaranteed offline browser speech recognition or automatic language switching is promised.

## Release gates and deployment

At this document's initial commit, the feature is not merged or deployed. Final feature CI, production-path build/assets, actual public-site flows, Google provider handoff/cancellation, anonymous cloud access checks and the seeded V4-to-voice PWA update test remain to be recorded after execution. Google account consent needs a human; automated provider handoff/cancellation is not a personal Google login.

Update this record with exact check/deployment links and actual results. Do not label pending/unexecuted checks as passed. Production deployment is authorized by the owner only after critical checks pass.
