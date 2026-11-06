# EatFirst local recognition tools

Recognition runs locally. These files are optional static tools, not an online vision service. No image, receipt or full OCR text is uploaded by recognition. Only reviewed groceries/notes synchronize when the user confirms.

- Tesseract.js 7.0.0 and tesseract.js-core, Apache-2.0: https://github.com/naptha/tesseract.js and https://github.com/naptha/tesseract.js-core . The locked npm packages generate `v1/worker.min.js`, its notice and `v1/core.wasm.js` during prebuild. The core is a self-contained universal LSTM/WebAssembly build.
- English and Dutch `tessdata_fast` models, Apache-2.0: https://github.com/tesseract-ocr/tessdata_fast . Models downloaded 2026-11-06 from `eng.traineddata` and `nld.traineddata`, gzip-compressed without timestamps and bundled locally.
- ZXing browser / library: https://github.com/zxing-js/browser and https://github.com/zxing-js/library . Package license copies are under `licenses/`.
- idb-keyval: https://github.com/jakearchibald/idb-keyval (Apache-2.0). Used only for the recognition library's public language-model cache. The household database is not modified by model preparation.

Compressed model SHA-256:

- eng: `4c2eca50c078bff5714711eec96f229a5ee4d1eeae063bb67409a0e214d6e376`
- nld: `556bdf9382a1ef53153386dcd6d83bf5064332309472252619e3c4c6cc101b9f`

The optional user-triggered product lookup sends only a validated retail barcode to Open Food Facts: https://world.openfoodfacts.org/ . Database terms: https://world.openfoodfacts.org/terms-of-use . No product photographs are fetched or reused. Coverage and availability are not guaranteed; users can always type a product name. Core OCR/barcode reading and review do not require this service.

All applicable bundled license texts are under `licenses/`; the generated worker's third-party notice is included alongside it. Bump the `ocr/v1/` asset namespace deliberately if changing worker/core/model versions, so a cache cannot mix incompatible tool versions.
