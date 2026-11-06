# EatFirst V3 verification

## Executed before release

- ESLint and TypeScript passed.
- **98 unit tests passed**: existing V2 core/auth/queue checks plus 55 V3 tests covering 156 structured recipe entries, 18 template role allowlists, Dutch/English aliases, kg/g and litre/ml conversions, unknown package units, exact shortages, servings, ingredient allocation order, use-by/best-before exclusion, raw/cooked separation, bean preparation, frozen ingredients, poultry/egg controls, diets/allergens/exclusions, urgency, repetition, 1,000-item inventories, idempotent shopping requests, confirmed consumption, and private recipe-memory persistence/import rejection.
- **12 Playwright tests passed** across desktop and iPhone-sized Chromium: all six V2 flows plus adaptive recipes, serving shortfalls, favorite/history persistence, confirmed deductions, missing quantities to shopping, exclusions, image failure fallback, photo credits, filters and recipe-memory export.
- Independent PostgreSQL RLS/RPC suite passed.
- Real disposable local GoTrue/PostgREST/PostgreSQL tests passed: authentication/session/logout, private households, restricted/single-use invitations, migrations, cross-device inventory/shopping, offline queue/reload/reconnect, conflicts, idempotent changes, purchased-item transfers and revoked-member backup/export. No production SQL was run.
- Exact `/EatFirst/` production build passed. Manifest/icons/scope, offline navigation/refresh, mobile overflow and page errors passed. Three photographs were visually inspected against their matched recipes and primary-source licenses. Total precache is approximately 1 MiB, including WebP images.

The old browser tests were updated to use Discover/search because recipes may appear in more than one Home section. New tests caught and fixed canned-bean preparation verification and an ambiguous servings label; incompatible quantities remain verification states. None of these were released before passing checks.

## Release boundaries

All live household tables, policies, Google OAuth settings, users, shared data, operation queues and IndexedDB schema are preserved. No production migration or paid service is introduced. Tests use isolated browser profiles or disposable local services. They do not create, edit or delete a real family's household.

Recipes are original, reviewed rule-based cooking guidance. They were not physically cooked in a test kitchen. Allergen filters are conservative ingredient/label checks, not a guarantee against cross-contact. Unknown stock units and preparation/storage history need human verification. Personal favorites/exclusions/history remain device-local and have a separate backup.

Full Google account interaction was verified by the owner in V2; this upgrade preserves that auth implementation. Production verification checks the Google handoff/cancellation without accessing a personal password/token. Physical iPhone/Android installation and PWA OAuth cannot be fully automated in this environment. Update activation is checked with an isolated Chromium profile seeded from the actual pre-release V2 deployment.

## Deployment and live results

To be recorded after the authorized release completes. GitHub Actions repeats all required checks before publishing. V3 must not be called live until the production workflow succeeds and the public application is checked.
