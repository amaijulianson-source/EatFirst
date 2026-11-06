# EatFirst

A private, offline kitchen companion that helps households use what they have. No account, backend, API key, paid service, analytics, or remote images.

## Features

- Today dashboard: due-today and next-three-day summaries, priority groceries, recently added food, and meal suggestions.
- Inventory: quick add and save-and-add-another, edit, remaining quantities, categories, storage locations, optional package date and notes, optional estimated total value, search/filter/sort, confirmed removal with undo, and partial eaten/used/discarded records.
- Local calendar expiry logic across month/year boundaries. Separate use-by and best-before language. Past-date food is excluded from automatic recipe matching; use-by is always a safety deadline.
- 27 curated offline recipes with steps, approximate quantities, times and reliable dietary tags. Explicit ingredient aliases, editable staple assumptions, availability/urgency/missing/time ranking, missing ingredients to shopping, and user-confirmed deductions in inventory units.
- Shopping: add, inline edit name and quantity/note (saved on blur), check, remove, and transfer to inventory with a date prompt.
- Waste: calendar-week and month discard counts, six-month chart, category breakdown, history, and actual recorded estimated waste value only.
- Settings: light/dark/device theme, vegetarian/vegan/gluten-free filters, pantry staples, currency, complete JSON export, validated replacement import with confirmation, confirmed deletion, and an explicitly labelled optional sample kitchen.
- Local privacy page, responsive desktop/sidebar and mobile/bottom navigation, keyboard-accessible dialogs, reduced-motion styling, local app illustrations, and installable PWA icons.

## Stack and structure

React 19, TypeScript, Vite, Dexie/IndexedDB, Lucide icons, maintainable plain CSS, vite-plugin-pwa/Workbox, Vitest, fake-indexeddb, Playwright. See package-lock.json for exact resolved versions.

- `src/core.ts`: typed model, date math, consumption, waste, shopping, backup validation.
- `src/db.ts`: IndexedDB repository, version 1 schema. Future schema changes must introduce a Dexie version migration and corresponding backup schema migration; unsupported backup versions are rejected.
- `src/recipes.ts`: curated recipes, explicit normalization and ranking.
- `src/App.tsx`: application views, dialogs and persistence coordinator.
- `src/style.css`: responsive design system, themes and local CSS food illustration.
- `tests/`: business/persistence unit tests and browser workflows.

## Local development

Node 22.12+ (tested with Node 24), npm.

```sh
cd /workspace/eatfirst
npm ci
npm run dev
```

Open http://localhost:5173. Actual inventory starts empty. In Settings choose **Try sample kitchen** to explore, then **Reset demo** to clear it. Sample mode can only begin from an entirely empty kitchen/list/history to avoid mixing real and example data.

## Checks

```sh
npm run lint
npm run typecheck
npm test
TZ=Pacific/Honolulu npm test
TZ=Pacific/Kiritimati npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview -- --port 4173
```

Playwright tests use the production build at port 4175 in desktop Chromium and mobile-size Chromium. They cover empty states, add/edit/consume/discard/remove, shopping transfer, persistence after reload, recipe steps, backup export/invalid rejection, themes and offline reload. This is mobile viewport emulation, not a physical-device Safari test.

## Build and deployment

```sh
npm run build
```

Upload **the contents of `dist/`** to any HTTPS static host. Hash navigation and the configured production base path support repository subpaths without server rewrite rules. HTTPS (or localhost) is required for service workers and installability. No backend needed.

### GitHub Pages (free for a public repository)

Repository: https://github.com/amaijulianson-source/EatFirst

**Live app: https://amaijulianson-source.github.io/EatFirst/**

The repository uses `main`, and deployment runs automatically on default-branch updates. To configure the same setup in another repository:

1. Create/select a GitHub repository and push **the contents of this directory as its root**.
2. In repository Settings → Pages, select **GitHub Actions** as the source.
3. In Actions, manually run **Deploy EatFirst to GitHub Pages**. The workflow runs lint, typecheck, unit tests and build, then publishes `dist/`.

The workflow deploys automatically on updates to the repository’s existing default branch, and can also be started manually. Other branches do not deploy. The production build uses the exact repository name from GitHub to set its base URL, manifest ID/scope/start URL and service-worker scope. No credentials are included. Alternatively upload `dist/` through Cloudflare Pages Direct Upload on its free plan. This deployment uses the public EatFirst repository only.

## Backup and restore

Settings → Export JSON backup downloads all inventory, shopping, activity, preferences and sample-mode state. Backups are plain JSON, not encrypted. Keep them private. Import accepts at most 10 MB, validates version, dates, enums, finite nonnegative quantities/values, records and IDs, then presents a replacement confirmation. Import replaces the full kitchen; export the current one first. Malformed files never change saved state.

## Persistence, privacy and PWA

All user data lives in this browser profile's IndexedDB. The app has no user-data server or sync. Storage clearing, private mode, device loss and browser eviction can erase data. Export regularly; use one open tab for editing to avoid concurrent tabs overwriting each other's snapshots. Storage failures show an error and do not apply the attempted change to the UI. Switching domains or browser profiles creates a separate kitchen.

The service worker precaches the app shell and recipe collection. Offline works after a successful initial load/cache. On update, the current app remains active and a notice asks you to close all EatFirst tabs and reopen. No forced reload during editing. Installation uses the browser menu when supported. There are no automatic background expiry alerts; open Today to review dates.

## Limits and food safety

- Inventory is manually entered, with no barcode database, freshness prediction or guessed exact dates.
- Ingredient availability uses explicit aliases, not fuzzy guesses. Quantities are approximate recipe guidance and are not automatically verified; deduction is optional and manually confirmed. Only known aliases match (for example, organic eggs require naming them Eggs for matching).
- Past best-before food is kept separate and excluded from recipe matching conservatively. This does not mean all such food is unsafe, or that in-date food is guaranteed safe. Follow storage instructions and local guidance. Use-by is safety-related: do not consume after it.
- Dietary tags are recipe filters, not allergen guarantees. Check actual labels, especially stock, sauces, oats, noodles and packaged beans.
- Financial totals are estimated values the user entered. Changing currency relabels values without converting them. No money-saved or environmental claims.
- Waste counts are discard events; a partial discard is one event. They are not comparable weights. Weeks begin Monday.
- Browser support for install UI, storage persistence and service-worker updates varies. Physical iOS/Android testing remains advisable before a broad release.

## Future enhancements

Additional reviewed recipes and aliases, optional barcode scanning with local lookup, household sharing through an explicitly opt-in service, per-record conflict resolution for multiple open tabs, richer accessible trend comparisons, and a dedicated screen-reader/physical-device audit.

## Verification record

See [VERIFICATION.md](VERIFICATION.md) for commands actually executed, browser coverage, remaining development-tool audit advisories and unverified platforms. Runtime dependency audit reports zero vulnerabilities. Example desktop/mobile/dark screenshots are included in `artifacts/`; the app never loads those examples into a user's inventory automatically.

## Install on your phone

Open https://amaijulianson-source.github.io/EatFirst/ on your phone. Do not install from a ChatGPT in-app webview.

- **iPhone:** Open the link in Safari → Share (square with up arrow) → Add to Home Screen → turn on Open as Web App if offered → Add. Open EatFirst from its home-screen icon. The included 180×180 Apple touch icon and standalone metadata support this flow.
- **Android:** Open the link in Chrome → menu (⋮) → Install app, or Add to Home screen → Install. Labels vary by browser/device. Open the new EatFirst icon.

Let the first load finish while online before trying airplane mode. Keep regular JSON backups: installed PWAs still rely on browser/device storage. iOS may use a separate storage context for a newly installed home-screen app, so begin entering real groceries after installing, or transfer a backup. Native installation behavior has not been tested on a physical phone.

### Verify the public deployment

```sh
PLAYWRIGHT_BASE_URL=https://amaijulianson-source.github.io/EatFirst/ npm run test:e2e
EATFIRST_URL=https://amaijulianson-source.github.io/EatFirst/ node tests/pwa-check.mjs
```

Preserve the exact `/EatFirst/` capitalization and the trailing slash. Browser tests use isolated profiles and modify only their own local browser data. The additional PWA check validates manifest identity, all icons, Apple icon, service-worker scope, offline home-screen-style launch/refresh, mobile overflow and page errors.

For a local Pages-subdirectory rehearsal, set `BASE_PATH=/Eatfirst/` for **both** `npm run build` and `npm run preview`. Without the environment variable on preview, Vite serves a different mount point. Default development and browser tests continue to use `/`.
