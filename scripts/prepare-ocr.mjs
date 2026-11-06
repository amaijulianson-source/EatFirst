import { URL } from "node:url";
import { mkdir, copyFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await mkdir(new URL("public/ocr/v1/", root), { recursive: true });
await copyFile(
  new URL("node_modules/tesseract.js/dist/worker.min.js", root),
  new URL("public/ocr/v1/worker.min.js", root),
);
await copyFile(
  new URL("node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", root),
  new URL("public/ocr/v1/core.wasm.js", root),
);

await copyFile(
  new URL("node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt", root),
  new URL("public/ocr/v1/worker.min.js.LICENSE.txt", root),
);
