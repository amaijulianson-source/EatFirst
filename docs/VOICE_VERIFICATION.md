# EatFirst voice release verification

The complete voice upgrade, including recipe-independent cooking/eating/waste, is **live** at [EatFirst](https://amaijulianson-source.github.io/EatFirst/).

Deployed source: [`6522d7471137c06588feb000e804537fafcc1b10`](https://github.com/amaijulianson-source/EatFirst/commit/6522d7471137c06588feb000e804537fafcc1b10). [Voice replacement PR](https://github.com/amaijulianson-source/EatFirst/pull/5), [consumption PR](https://github.com/amaijulianson-source/EatFirst/pull/6), [green feature checks](https://github.com/amaijulianson-source/EatFirst/actions/runs/42361332717), [successful production checks/deployment](https://github.com/amaijulianson-source/EatFirst/actions/runs/42361724273).

The initial voice-only production run was cancelled before publication when the owner added consumption requirements. V4 remained live until the complete release passed. No real household/account was used as a write fixture, no production SQL/membership changes were made, no billing was enabled, and stopped V5 visual research remains separate from the deployed source.

## Executed release checks

| Check                                                                 | Actual result                                                                                                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, ESLint, cloud build configuration                         | Passed                                                                                                                                                                           |
| Unit tests                                                            | **274 passed**                                                                                                                                                                   |
| Desktop and phone-sized Chromium                                      | **38 passed** in the production release workflow                                                                                                                                 |
| iPhone-sized WebKit voice/consumption UI                              | **11 passed** in CI; Linux WebKit, not a physical iPhone                                                                                                                         |
| RLS, invitations, membership/revocation, idempotency and stale writes | Passed against disposable PostgreSQL policy fixtures                                                                                                                             |
| Two-account GoTrue/PostgREST browser stack                            | Passed household invitations/migration, session persistence/logout, inventory/shopping, atomic transfer, revoked-access proposal preservation and offline queue/reload/reconnect |
| Shared voice inventory and activity                                   | Passed totals/low stock/unknown fields, recipe-independent cooking/eating, offline waste and no duplicate application via actual local RPCs and another browser                  |
| Production and retained preview builds                                | Passed; automatic default-branch deployment preserved                                                                                                                            |
| Runtime dependency audit                                              | Zero vulnerabilities with `npm audit --omit=dev`; full build-tool audit has 12 low/moderate findings, zero high/critical                                                         |

Transcript tests cover the owner's exact messy inventory and cooking examples; English/Dutch numbers, ordinals, dates, fillers and corrections; contractions and Dutch completed-action order; added versus reconciled stock; fractions and whole/unclear amounts; meal-name exclusion; matching units/expiry batches; incompatible stock/shortages; wrong-product and overdraw rejection; stable event identifiers; partial use and waste separation; backups and actual IndexedDB persistence. Private drafts are scoped by account/kitchen and never become shared transcripts.

Capture lifecycle tests use injected Web Speech API-shaped events, independently of the parser. They verify final/interim deduplication, 15-second silence without finalization, service end/resume, unfinished phrase recovery, permission/network/language/no-speech errors, startup timeout, background interruption, explicit Finish and cancellation/abort cleanup. These are **not** real transcription accuracy measurements. A separate unmocked Chromium API probe could not start the vendor speech service in this headless environment; it correctly showed microphone-off recovery and fallback. No successful vendor transcription is claimed from that probe.

## Actual public website verification

All **38 Chromium browser tests passed against the actual HTTPS production URL** (51.0 seconds), not just localhost. They exercised inventory/manual entry/shopping transfer, recipes/cooking/history/preferences, waste, backups, voice drafts and review, stock reconciliation, corrections, independent cooking/eating/discard, unknown-amount clarification, missing ingredients, partial quantities and offline reload without duplicate deduction. All data writes in these checks were to fresh browser-local verification profiles, not a real Supabase household.

Additional live checks passed:

- Homepage/application assets, manifest, 192/512/maskable PNG icons, Apple touch icon, standalone display, exact `/EatFirst/` manifest/start/service-worker scopes, offline launch/refresh, phone-width overflow and zero critical page errors.
- Google OAuth handoff reached a valid Google sign-in page with S256 PKCE and the exact production redirect. Provider cancellation returned cleanly to Family. A real Google account login/consent was **not** performed by automation.
- Actual hosted Supabase reported Google enabled. Anonymous inventory, shopping, membership and invitation requests returned **401 with zero exposed records**. No hosted mutation was made. Authenticated cross-household isolation was tested in disposable policy/RPC fixtures; real family sessions were not accessed.
- A persistent Chromium profile seeded from the actual V4 site detected the waiting new worker, displayed the update notice, and activated the new version after all old windows closed. Its original grocery survived with the same quantity. No storage clearing or reinstall was used. The obsolete app-scoped OCR cache was removed; the inventory database was preserved. The upgraded profile opened and refreshed offline, interpreted/confirmed voice inventory, and retained it after refresh with no page errors.

Machine-readable results and screenshots: [production report](../artifacts/voice/production-verification.json), [PWA update result](../artifacts/voice/update-verification.json), [current phone capture UI](../artifacts/voice/capture-phone.png), [consumption review](../artifacts/voice/consumption-phone.png). Screenshots use disposable local-only fixtures, not the owner's family data.

## Device limits and opening the update

Physical iPhone Safari/home-screen microphone permissions, Siri availability, actual speech recognition accuracy, OS keyboard dictation, calls, screen locking and battery behavior remain untested here. WebKit UI tests do not prove Apple speech-service availability. The app visibly reports when listening stops and keeps finalized/unconfirmed words; it never treats silence as Finish. Browser speech may use Apple/Google and need internet. Local interpretation/offline text entry is supported; universally offline voice capture and automatic language switching are not promised.

Open the existing app online, close all EatFirst tabs/windows, then reopen to activate a waiting update. Do not clear website data. No reinstall or Supabase setup is required for this release. On an unsupported microphone configuration, use Safari outside an embedded viewer, enable the phone's Siri/Dictation as appropriate, or tap **Your words** and use keyboard dictation/type naturally.

Use **Inventory → Add food → Talk to EatFirst** for stock/purchases, or **Tell EatFirst what I used** for cooking, snacks or waste. Explicit action verbs also work in the main assistant. Every change/deduction remains editable and requires confirmation. See [design, interpretation and privacy details](VOICE_INVENTORY.md).
