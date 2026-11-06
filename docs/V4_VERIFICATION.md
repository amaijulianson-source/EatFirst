# EatFirst V4 verification

## Local checks actually executed

- ESLint and TypeScript passed.
- **149 unit tests passed**: all V3 checks plus 51 new tests covering Dutch/English grocery normalization, product identity preservation, package quantities, date extraction/type/order/year rules, invalid dates, GTIN checksums, photo parsing, duplicate views versus separate batches, product-memory reuse without dates, shopping transfers/selection/concurrency, exact batch merging, date assignment, scoped patterns and persisted draft baselines.
- **24 browser tests passed** on desktop and phone-sized Chromium: all existing V3 flows plus quick-add pattern reuse, batch purchased-item transfer, date confirmation, actual English/Dutch multi-photo OCR, draft restoration, actual offline OCR, actual EAN-13 image decoding, editable opt-in lookup, separate date-photo matching, incorrect draft removal and cancellation without inventory changes. The free registry response is mocked in that browser test; Tesseract, language models, images and ZXing are real.
- Independent PostgreSQL RLS/RPC tests passed. Full disposable local GoTrue/PostgREST/database two-browser household/migration/offline/conflict/transfer and authentication tests passed. No production SQL or real user account mutation was performed.
- Runtime npm audit: zero known vulnerabilities.

A Tesseract language-object initialization issue was found in real browser testing. The implementation uses the supported string-language initialization and seeds only trusted bundled model bytes into the library cache; cached blob worker/core scripts allow tested offline recognition. Generated third-party OCR assets are excluded from authored-source lint, while application code and the asset-preparation script remain linted. No failing recognition test is represented as a pass.

## Required release verification

GitHub CI repeats checks before merge/deployment. After publication, verify the actual public app, all 24 browser flows, correct Pages subdirectory paths for OCR assets, offline app/recognition, Google handoff and an isolated persistent browser seeded from pre-release V3. Record exact run/results below. Do not claim physical phone camera/HEIC or personal Google login was automated.
