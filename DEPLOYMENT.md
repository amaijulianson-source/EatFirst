# EatFirst deployment

Repository: https://github.com/amaijulianson-source/EatFirst

Public Pages target: https://amaijulianson-source.github.io/EatFirst/

## Current status

**EatFirst V4 deployed successfully and verified against the actual public HTTPS site on 2026-11-06.**

Public app: https://amaijulianson-source.github.io/EatFirst/

Successful V4 deployment: https://github.com/amaijulianson-source/EatFirst/actions/runs/42237889893 . Released source: `4bc141e31baeeed542610d5a239c86fb762d1417`. The automatic default-branch workflow remains `.github/workflows/deploy.yml`. Actual public verification is recorded in `docs/V4_VERIFICATION.md`; V3/V2 history remains in their verification documents.

The owner enabled Pages with GitHub Actions as its source. GitHub Pages reports HTTPS enforced. No further GitHub settings changes are required. All 24 desktop/mobile browser tests passed against the public URL, including real multi-photo OCR and offline recognition. Manifest/icon/scope/offline checks and Chromium's installability check passed. An isolated browser seeded from the actual V3 site updated to V4 while preserving its grocery and favorite. Physical-device installation and personal Google account consent are not automated.

## Active configuration

- Public repository, existing default branch `main`. Its initial `.gitattributes` and commit history were preserved by merging, without force-pushing.
- GitHub Pages source: GitHub Actions. `.github/workflows/deploy.yml` validates and publishes default-branch updates automatically; manual dispatch is also available.
- CI runs lint, typecheck, unit tests, desktop/mobile browser tests and a production build. `BASE_PATH` derives from the exact repository name, generating `/EatFirst/` URLs for assets, manifest identity, launch URL, scope and service worker.
- HTTPS is provided by GitHub Pages. No custom domain or paid service is used. Optional Supabase Auth/PostgreSQL/Realtime provides family sharing.
- PWA includes standalone mode, 192/512 PNG icons, a maskable icon, 180px Apple touch icon, iOS metadata, safe-area layout, offline app cache and local IndexedDB.

## Verification

```sh
PLAYWRIGHT_BASE_URL=https://amaijulianson-source.github.io/EatFirst/ npm run test:e2e
EATFIRST_URL=https://amaijulianson-source.github.io/EatFirst/ node tests/pwa-check.mjs
```

These commands use isolated browser profiles; grocery data stays in their own local browser storage. See VERIFICATION.md for actual results. The test suite checks normal food/recipe/shopping/waste flows and persistence. The PWA check validates icons, scopes, offline launch and refresh, page errors and phone-width overflow. Device installation is checked separately on an actual phone.

## Install

**iPhone:** Open the public URL in Safari, not the ChatGPT in-app browser. Share → Add to Home Screen → Open as Web App if offered → Add.

**Android:** Open the public URL in Chrome. ⋮ menu → Install app or Add to Home screen → Install.

Open the new home-screen icon and allow the initial online load to finish before trying offline mode. Browser/device labels vary. iOS can give the installed app its own storage context, so enter real groceries after installation or transfer a JSON backup. Family households synchronize through Supabase; local-only kitchens do not. No automatic background expiry notifications are provided.

## Existing installations and migration

Open the original URL online, close all EatFirst tabs and installed app windows, then reopen. The actual V3-to-V4 worker update and local-data preservation were verified in Chromium. A waiting worker activates when all old windows close; no forced reload discards pending edits. Never clear site data to update. The new worker excludes the preview from root navigation fallback. The preview remains available under its original path, with separate database/auth/PWA scope, so existing preview links and OAuth callbacks remain valid.

Google sessions in the preview are intentionally separate: sign into the main app with the same Google account and select the existing household. Do not create a duplicate. Other users can still choose Review local migration and confirm; the original V1 state is preserved. Real Supabase households/accounts are not reset by deployment.

## V4 photo tools

Add food opens shopping-trip, quick-add, multiple-photo and expiry-scan methods. Optional local English/Dutch OCR/barcode tools are bundled under the Pages subdirectory and prepared on request (about 9 MB). After preparation they work offline; normal app precaching remains approximately 1.5 MiB. All detections/dates require review. No production database migration or extra configuration is required. See `docs/V4_ENTRY.md` for data ownership, scoped product patterns, backup and recognition limits.
