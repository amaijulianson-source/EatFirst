import type { Worker } from "tesseract.js";
import { validBarcode } from "./model";
const assetRoot = new URL(`${import.meta.env.BASE_URL}ocr/v1/`, location.origin)
  .href;
export const ocrCacheName = `eatfirst-ocr-${new URL(import.meta.env.BASE_URL, location.origin).pathname}`;
const assets = [
  "worker.min.js",
  "core.wasm.js",
  "lang/eng.traineddata.gz",
  "lang/nld.traineddata.gz",
];
export async function preparePhotoTools(
  progress: (text: string) => void,
  signal?: AbortSignal,
) {
  if (!("caches" in window))
    throw Error(
      "This browser cannot cache photo tools. Use quick add or try Safari/Chrome outside private browsing.",
    );
  const cache = await caches.open(ocrCacheName);
  for (let i = 0; i < assets.length; i++) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const url = assetRoot + assets[i];
    if (await cache.match(url)) continue;
    progress(`Preparing offline photo tools ${i + 1}/${assets.length}…`);
    try {
      const r = await fetch(url, { signal });
      if (!r.ok) throw Error("Asset unavailable");
      await cache.put(url, r);
    } catch (e) {
      if (signal?.aborted) throw e;
      throw Error(
        "Photo tools are not available offline yet. Connect once and prepare them; quick add still works offline.",
      );
    }
  }
  await Promise.all([
    import("tesseract.js"),
    import("@zxing/browser"),
    import("idb-keyval"),
  ]);
  progress("Photo tools are ready on this browser.");
}
export async function photoToolsReady() {
  if (!("caches" in window)) return false;
  const cache = await caches.open(ocrCacheName);
  return (
    await Promise.all(assets.map((a) => cache.match(assetRoot + a)))
  ).every(Boolean);
}
export async function imageCanvas(file: File) {
  if (!file.type.startsWith("image/"))
    throw Error(
      "Choose an image (JPEG, PNG or WebP). Convert HEIC if your browser cannot open it.",
    );
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw Error("Image could not be opened.");
    const scale = Math.min(
      1,
      1800 / img.naturalWidth,
      2200 / img.naturalHeight,
      Math.sqrt(3200000 / (img.naturalWidth * img.naturalHeight)),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch {
    throw Error("Could not open this photo. Try a clear JPEG or PNG.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export class LocalPhotoReader {
  private worker?: Worker;
  private initializing?: Promise<Worker>;
  private stopping?: Promise<void>;
  private urls: string[] = [];
  private abort = new AbortController();
  constructor(private progress: (s: string) => void) {}
  async read(file: File): Promise<{ text: string; barcodes: string[] }> {
    const canvas = await imageCanvas(file);
    try {
      let barcodes: string[] = [];
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const decoder = new BrowserMultiFormatReader();
        const result = decoder.decodeFromCanvas(canvas);
        const value = result.getText();
        if (validBarcode(value)) barcodes = [value];
      } catch {
        /* No barcode in this photograph is normal. OCR still runs. */
      }
      if (this.abort.signal.aborted)
        throw new DOMException("Cancelled", "AbortError");
      await preparePhotoTools(this.progress, this.abort.signal);
      if (!this.worker) {
        const { createWorker, OEM } = await import("tesseract.js");
        const cache = await caches.open(ocrCacheName);
        const workerResponse = await cache.match(assetRoot + "worker.min.js"),
          coreResponse = await cache.match(assetRoot + "core.wasm.js");
        if (!workerResponse || !coreResponse)
          throw Error(
            "Prepare photo tools again; an offline asset is missing.",
          );
        const workerUrl = URL.createObjectURL(
          new Blob([await workerResponse.arrayBuffer()], {
            type: "application/javascript",
          }),
        );
        const coreUrl = URL.createObjectURL(
          new Blob([await coreResponse.arrayBuffer()], {
            type: "application/javascript",
          }),
        );
        this.urls.push(workerUrl, coreUrl);
        const { set } = await import("idb-keyval");
        await Promise.all(
          ["eng", "nld"].map(async (code) => {
            const response = await cache.match(
              assetRoot + `lang/${code}.traineddata.gz`,
            );
            if (!response)
              throw Error(
                "A language model is missing. Prepare photo tools again.",
              );
            await set(
              `./${code}.traineddata`,
              new Uint8Array(await response.arrayBuffer()),
            );
          }),
        );
        if (this.abort.signal.aborted) {
          for (const url of this.urls) URL.revokeObjectURL(url);
          this.urls = [];
          throw new DOMException("Cancelled", "AbortError");
        }
        this.initializing = createWorker("eng+nld", OEM.LSTM_ONLY, {
          workerPath: workerUrl,
          corePath: coreUrl + "#core.js",
          langPath: assetRoot + "lang",
          cacheMethod: "readOnly",
          workerBlobURL: false,
          logger: (m) => {
            if (m.status === "recognizing text")
              this.progress(
                `Reading label text ${Math.round(m.progress * 100)}%`,
              );
          },
        });
      }
      if (this.initializing) {
        try {
          this.worker = await this.initializing;
        } finally {
          this.initializing = undefined;
        }
      }
      if (this.abort.signal.aborted) {
        await this.stop();
        throw new DOMException("Cancelled", "AbortError");
      }
      const worker = this.worker!;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void this.stop();
          reject(
            Error("This photo took too long. Try a closer, sharper crop."),
          );
        }, 75000);
      });
      try {
        const r = await Promise.race([worker.recognize(canvas), timeout]);
        return { text: r.data.text, barcodes };
      } finally {
        if (timer) clearTimeout(timer);
      }
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
  async stop() {
    if (this.stopping) return this.stopping;
    this.abort.abort();
    this.stopping = (async () => {
      if (this.initializing) await this.initializing.catch(() => undefined);
      const w = this.worker;
      this.worker = undefined;
      if (w) await w.terminate();
      for (const url of this.urls) URL.revokeObjectURL(url);
      this.urls = [];
    })();
    return this.stopping;
  }
}
