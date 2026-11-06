# Release verification

Executed in the task workspace on 2026-11-06 with Node 24.22.1.

| Check                            | Result                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| `npm run lint`                   | Passed                                                        |
| `npm run typecheck`              | Passed                                                        |
| `npm test` (Vitest 5.1.0)        | 22 passed                                                     |
| `TZ=Pacific/Honolulu npm test`   | 22 passed                                                     |
| `TZ=Pacific/Kiritimati npm test` | 22 passed                                                     |
| `npm run test:e2e`               | 6 passed: 3 desktop Chromium + 3 mobile Chromium              |
| `npm run build`                  | Passed; generated manifest, icons and 13 precached app assets |
| `npm audit --omit=dev`           | 0 reported runtime vulnerabilities                            |

Browser tests exercised empty inventory, add, save-and-add-another, editing, persistence after reload, partial consumption, discard records, removal confirmation, inventory search/date filtering, shopping add/check/remove/inline edit/transfer, recipe instructions, confirmed cooking deduction, JSON export, invalid backup rejection, valid replacement restore, theme changes and offline reload. Screenshots were inspected for desktop and mobile. Playwright traces are retained only for failures.

A separate production-browser sweep checked Today, Inventory, Recipes, Shopping, Waste, Settings and Privacy at widths 360, 390, 768 and 1280 px, with no horizontal overflow or page errors. The skip link was checked for keyboard focus without changing the current route. Preview screenshots are in `artifacts/` and contain explicitly labelled sample data, created only in isolated test browser profiles.

## Audit limits

The complete `npm audit` still reports 12 development-only advisories (2 low, 10 moderate) in transitive build/lint tooling (`deepmerge`, `glob`, `minimatch`, Workbox/Rollup and TypeScript ESLint dependency chains). `npm audit fix` was attempted but did not resolve those chains. The critical test-runner advisories were resolved by upgrading Vitest, and the no-longer-needed image-generation dependency was removed. No vulnerable development tools are shipped as app runtime code. Recheck dependencies before future releases; no forced unverified dependency overrides were introduced.

## What has not been verified

Physical iOS/Android devices, native Safari/Firefox, store installation flows, a dedicated assistive-technology audit, and a live hosted deployment. Mobile browser tests emulate iPhone-sized Chromium rather than real mobile Safari. Multi-tab conflict resolution and cross-device sync are outside this local-only MVP. No public deployment was attempted.

Final visual check corrected document-level dark-theme inheritance and verified the rebuilt production page uses light text (`rgb(231, 238, 229)`) on its dark canvas (`rgb(23, 35, 30)`). The final dark mobile screenshot was inspected after that fix. Final production build passed again.

## GitHub Pages and phone-install preparation (2026-11-06)

- Re-ran lint, TypeScript checking and all 22 unit tests successfully.
- Re-ran all 6 desktop/mobile browser tests against the normal root mount successfully.
- Built with `BASE_PATH=/Eatfirst/` successfully and re-ran all 6 browser tests at that exact case-sensitive subdirectory successfully.
- Ran `tests/pwa-check.mjs` against the subdirectory build: manifest name/short name, standalone display, start URL/scope, 192/512/maskable icons, Apple touch icon, service-worker scope/control, offline launch/refresh, phone-width overflow and page-error checks passed.
- Added a Pages workflow that deploys only default-branch updates, with manual dispatch also available. Its base path derives from the actual repository name, preserving capitalization. Added safe-area support and iOS standalone metadata.
- The first subdirectory test attempt used a preview server mounted at `/` instead of `/Eatfirst/`; it failed to load assets. After configuring the preview server with the same `BASE_PATH` as the build, the complete suite and PWA checks passed.
- The GitHub connector confirms the connected account is `amaijulianson-source`. Both the connector and authenticated CLI return 404 for `amaijulianson-source/Eatfirst`, and it is absent from the repositories visible to this connection. The exact target URL and repository access are required before selecting its existing default branch, pushing or configuring Pages.
- No public deployment has occurred, no public production URL is verified, and no physical iPhone/Android install has been claimed. No unrelated repository contents were read or changed.

## Confirmed repository and permission check

The user supplied https://github.com/amaijulianson-source/EatFirst and made it public. On 2026-11-06 both GitHub connections could read it. The verified default branch is `main`; its initial `.gitattributes` and history were merged into the complete local app without replacement or force-push. Lint, typecheck, 22 unit tests and all 6 desktop/mobile browser tests passed again.

Publication is still blocked: authenticated Git push returned HTTP 403, the connected GitHub blob API returned “Resource not accessible by integration” (403), and the Pages creation API returned the same denial. The integration requires explicit repository access; public visibility grants reading but does not grant writing. No application code has been pushed and no Pages site is deployed. The owner has been asked to add EatFirst to the GitHub App installation's repository access. The documented Pages URL remains a target until actual deployment succeeds.
