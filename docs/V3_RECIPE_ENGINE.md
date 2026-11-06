# EatFirst V3 recipe engine

## Architecture and data preservation

The existing Data version 1 backup format, IndexedDB schema version 2, Supabase tables, RLS, authentication settings, operation queues, conflict recovery and household data remain intact. No production SQL is required. Food and shopping mutations still go through the existing atomic per-record queue and compare-and-swap server RPC. No real household or account is reset, modified or used as a test fixture.

`src/cooking/ingredients.ts` defines explicit Dutch/English aliases and preparation profiles. It deliberately distinguishes raw rice from cooked rice, bell pepper (`paprika` in Dutch) from `ground paprika`, and cod from salmon. Unknown foods are not guessed. Known quantities convert only between compatible measures (kg/g, litres/ml, tablespoons/teaspoons/ml, pieces). Bag/pack/can/portion-to-weight conversions require verification; they are not invented.

`templates.ts` defines 18 methods. Required roles are a base, a compatible protein/dairy component and at least one compatible vegetable/fruit. A second compatible vegetable and a supported flavour are optional. Role allowlists constrain substitutions. Cold templates exclude raw chicken/fish/eggs. Cooking instructions distinguish raw poultry, fish, tofu, cooked beans, firm vegetables, tender vegetables and leaves. Dedicated methods handle fritters, oats, eggs, jacket potatoes, casseroles and soups. Times reflect the selected components and are guides, not doneness guarantees.

`library.ts` preserves all 27 old identifiers and combines them with 126 deliberately selected method/ingredient/flavour combinations and 3 photo-matched original recipes: **156 curated recipes**. They are reviewed, plausible variations, not 156 independently kitchen-tested dishes. Adaptive generation selects from the actual eligible inventory. It generates a bounded, deterministic set of useful suggestions per household, across thousands of possible role/flavour combinations over different inventories. Unsupported combinations fall back to the curated collection with explicit missing ingredients.

## Matching and ranking

Past use-by and past best-before supplies are excluded. Frozen supplies and uncertain preparation forms require verification. A pantry assumption cannot override an existing past-date supply or invent raw chicken. Known shortages show their actual missing quantity. Unknown units are a verification state, not proof of sufficient stock. Core dry ingredients and common seasonings may be explicitly assumed via pantry settings; UI always discloses those assumptions.

Ranking is deterministic: ready-to-cook meals first; then available fraction ×100 + urgent ingredient count ×6 − missing count ×4 − verification count ×3 − minutes ×0.08, with a penalty of 8 per appearance in the last five personal cooked meals. Stable IDs break ties. Home sections limit repeated methods to provide variety. Urgency is computed against the device's local calendar, including month/year boundaries. Data changes from Supabase, local edits, quantities, pantry preferences and the local-date timer recalculate results.

Serving changes scale quantities without multiplying cooking time. Food temperature, thickness, cookware and batching still determine doneness. Recipes are original guidance, not freshness predictions or a medical/allergen-free guarantee. Package labels and cross-contact need checking; known allergen exclusions conservatively hide recipes with unknown labels. Basic preparation temperature guidance follows https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures . Rice handling follows https://www.food.gov.uk/safety-hygiene/home-food-fact-checker .

## Ownership and backups

Shared inventory, shopping, dietary tags, pantry staples and currency stay household-owned. Favorites, ingredient/allergen exclusions and recently cooked meals are personal **on this device**, stored in the existing IndexedDB caches table under `recipes:<user-or-device>:<household-or-local>`. They do not synchronize between phones and cannot appear under another account/household key. A saved adaptive recipe stores its original structured snapshot so it remains available when inventory changes.

Recipes → Preferences exports/imports a separately validated recipe-memory JSON backup, with explicit replacement confirmation. Settings continues to export/import the existing grocery/household backup format. Browser storage clearing can erase personal memories, local groceries and pending changes; export both backups as needed.

Missing ingredients add their shortfall to shared shopping. Compatible existing quantities cover the larger request rather than accumulating on every tap; this prevents accidental duplicate purchases and is explained in the UI. Incompatible/unclear list units receive a note for review. This is not a cumulative meal-planning ledger. Checked items reopen without duplication.

Cooking always requires explicit confirmation. Inventory units start at zero; only entered positive amounts become shared consumption events. Changes to a reviewed ingredient require rechecking the form. No automatic deductions or guessed package weights occur. Cooking history is written after the inventory save; a history failure must never cause a second automatic deduction.

## Photography, offline operation and updates

Three local optimized food photographs have verified recipe/image relevance and documented licenses at `public/recipes/LICENSES.md`. Credits appear in details. All other curated and adaptive recipes use original branded CSS artwork; missing image requests fall back to artwork. No paid API, external AI, new family account, image hotlink or runtime recipe service is required. WebP photographs are included in the static Workbox precache; total application assets remain around 1 MiB.

Existing root and preview PWA identities/scopes remain unchanged. The production worker does not navigate the preview or remove its cache. Updates wait for old tabs/windows to close; no IndexedDB clearing, token clearing, automatic reload during edits or reinstallation is needed. Devices must reconnect and reopen before discovering an update; physical mobile timing varies.
