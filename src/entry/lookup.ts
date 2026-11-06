import { validBarcode } from "./model";
// Opt-in only. The request contains a public barcode; never photos or OCR text.
export async function lookupBarcode(barcode: string) {
  if (!validBarcode(barcode)) throw Error("Not a valid retail barcode.");
  if (!navigator.onLine)
    throw Error(
      "Online product lookup needs an internet connection. You can type the name instead.",
    );
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_nl,quantity,brands`,
      {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      },
    );
    if (!r.ok)
      throw Error("Product database unavailable. Type the name instead.");
    const data = await r.json();
    const p = data.product;
    if (data.status !== 1 || !p)
      throw Error(
        "Product not found. Enter its name and package size manually.",
      );
    const name = p.product_name_nl || p.product_name;
    if (typeof name !== "string" || !name.trim())
      throw Error("This product has no usable name. Enter it manually.");
    return {
      name: name.slice(0, 100),
      quantity: typeof p.quantity === "string" ? p.quantity.slice(0, 100) : "",
      brand: typeof p.brands === "string" ? p.brands.slice(0, 100) : "",
    };
  } catch (e) {
    if (controller.signal.aborted)
      throw Error("Product lookup timed out. Type the name instead.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
