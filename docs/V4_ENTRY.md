# EatFirst V4: faster inventory entry

**Add food** opens four methods: From shopping trip, Quick add, Import from photos, Scan expiry dates. Existing food editing and single-item Put away remain available. All V3 recipes, authentication, household sharing and backup behavior remain intact.

## Shopping trip

Mark items purchased, then choose **Add purchased items to inventory → Review purchased items**. Change quantities/units, category, storage and optional dates. Uncheck anything to keep on the shopping list. Confirmation creates all selected groceries and removes the selected purchased rows in one existing atomic household operation. Purchased frequency history remains intact. No rows are removed until inventory save succeeds. Offline confirmation persists the same durable queue as V3.

Exact batch merging is optional and off by default. Matching requires the same normalized product variant, unit, storage, category, exact expiry/date type and notes; priced batches are not merged, avoiding fabricated cost allocation. Different milk variants, package sizes and expiry batches stay separate. Stale shopping rows, repeated shopping IDs, changed merge targets or stale date-assignment targets reject the review before a partial write. The existing server CAS/operation-ID mechanism protects concurrent edits and lost acknowledgements.

## Quick add and product patterns

Type a name/package label, choose quantity/unit and storage, optionally enter the package date, then Save food or Save & add another. For larger manual batches, add to the review instead. Dutch/English aliases suggest clean names while product detail stays in notes. Milk variants remain distinct and recipe-compatible; plant drinks, soy yogurt, peanut butter, stock and cooked/processed chicken are not silently turned into raw cow's milk/butter/chicken.

Package sizes support g/kg/ml/litres, cl/dl, counts and common package units. No bag/pack-to-weight conversion is invented. Unknown quantities default to one editable piece and are explicitly marked for review. Quantities shown are total amounts: e.g. two 500 g packs total 1000 g. Pantry/fridge/freezer are editable suggestions; follow the package, including opening/thawing instructions.

Shared current groceries and activity snapshots supply cross-device household suggestions. Exact confirmed package patterns/barcode shortcuts are additionally saved locally under `entry:<user-or-device>:<household-or-local>:patterns`. They are private per account/kitchen/device and have their own validated export/import. Dates and prices are never reused. They are not a perfect product identity catalog. New barcode shortcuts can also be inferred from confirmed shared inventory notes.

## Multiple photos and date matching

Use Choose multiple photos (up to 8 per selection, 12 MB each, 40 MB total) or Take a photo; add further selections to the same review. Clear English/Dutch labels, package sizes and printed dates are read by Tesseract.js; ZXing reads a retail barcode when visible. Original image files remain transient on the device. Only selected, confirmed inventory fields and notes synchronize. Full receipts/OCR text and photos are not sent to Supabase or an AI service.

The engine uses constrained normalization, package parsing, GTIN checksum validation and local product patterns. An optional explicit lookup can send a barcode alone to Open Food Facts. It never sends a photo. This free registry is not required by core functionality and may lack a product or be unavailable. Unknown barcode-only items require typing a name if no saved pattern/lookup is available. Overview photos without readable labels cannot reliably identify bare fruit or unpackaged objects; the app says so instead of inventing detections.

Every suggestion can be edited, unchecked or removed. Duplicate photo detections with compatible identity/size/date combine their sources without summing quantities. One label's date may complete a matching undated close-up; differing known expiry batches remain separate. Users confirm how many packages the photos actually represent. A date-only photo can be matched explicitly to a draft before saving.

**Scan expiry dates** works on existing inventory or the groceries just transferred/imported. Match each candidate to one inventory row, check the year/date order/type, select it and save. Use-by and best-before labels are recognized in English/Dutch. Unlabelled or ambiguous numeric dates require review; numeric order is day/month/year unless ISO. Two-digit years are explicitly interpreted as 20xx and require confirmation. Missing years or invalid dates are not invented. A past date may be recorded for tracking but never becomes a safety claim; existing recipe exclusions remain intact. Multiple selected dates for the same target are rejected rather than silently overwriting.

Unfinished item reviews and their original concurrency baseline are stored locally per method/account/kitchen. Original images and date-only scan candidates are not retained after the session. Closing mid-review does not add groceries. Confirmed inventory is not retried merely because a later product-pattern save fails. Pattern/draft deletion affects that device scope only, never a real shared household.

## Offline tools, privacy and updates

The ordinary app still precaches roughly 1.5 MiB. OCR tools/models are deliberately excluded from mandatory precaching and prepared only on request (about 9 MB downloaded; additional public language-model cache uses browser storage). They are bundled locally and cached by an OCR-specific Cache Storage name under the app/preview scope. Cached worker/core scripts are instantiated as local blob URLs, and trusted language bytes seed Tesseract's model cache, so prepared recognition works offline even without relying on a CDN. No paid OCR/AI API or new family account is needed.

The public model cache contains no user photographs or OCR results. The existing IndexedDB schema version, Data backup format, Supabase tables, policies, auth/session keys and household queues are unchanged. No production SQL or account change is required. Existing grocery backups remain compatible; product-pattern backup is separate, like V3 recipe memories. Never clear storage to update a PWA. Close old app windows and reopen online to activate the new worker. Physical camera/HEIC support and update timing vary by browser/OS.

Licenses/provenance: [local tool notice](../public/ocr/NOTICE.md). This release uses original generated text/barcode fixtures to test recognition rather than private family photos. Full Google account interaction was owner-tested in V2; V4 preserves that implementation.
