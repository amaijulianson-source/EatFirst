import {
  localDate,
  validateBackup,
  type Data,
  type Food,
  addShopping,
} from "../core";
import { productKey } from "../entry/model";
import { canonical } from "../family/changes";
import type { VoiceItem, VoiceMode } from "./interpret";
export type VoiceReview = VoiceItem & {
  action: "new" | "replace" | "increase" | "choose";
  targetId: string;
  newId: string;
  included: boolean;
  addToShopping: boolean;
};
export function reviewInventory(
  items: VoiceItem[],
  data: Data,
  mode: VoiceMode,
): VoiceReview[] {
  return items.map((item) => {
    const matches = data.foods.filter(
      (f) => productKey(f.name) === productKey(item.name),
    );
    const matched =
      mode === "check" && matches.length === 1 ? matches[0] : undefined;
    return {
      ...item,
      category: matched?.category ?? item.category,
      location:
        !item.locationSpoken && matched ? matched.location : item.location,
      warnings: [
        ...item.warnings,
        ...(matched && item.quantity !== null && item.unit !== matched.unit
          ? [
              "Spoken and existing units differ. Choose a batch/action and confirm the unit; no conversion is assumed.",
            ]
          : []),
      ],
      newId: crypto.randomUUID(),
      action:
        mode === "purchase"
          ? "new"
          : matches.length > 1
            ? "choose"
            : matches.length === 1
              ? item.quantity !== null && item.unit !== matches[0].unit
                ? "choose"
                : "replace"
              : "new",
      targetId: mode === "check" && matches.length === 1 ? matches[0].id : "",
      included: true,
      addToShopping: false,
    };
  });
}
export function applyVoiceReview(
  current: Data,
  baseline: Data,
  rows: VoiceReview[],
  today = localDate(),
) {
  const next = structuredClone(current),
    selected = rows.filter((r) => r.included);
  const targets = new Set<string>();
  if (!selected.length) throw Error("Keep at least one item to confirm.");
  for (const r of selected) {
    if (!r.name.trim() || r.name.length > 100)
      throw Error("Check every food name.");
    if (r.action === "choose") throw Error(`Choose how to update ${r.name}.`);
    if (
      r.quantity !== null &&
      (!Number.isFinite(r.quantity) || r.quantity <= 0 || r.quantity > 1000000)
    )
      throw Error("Check each quantity.");
    let food: Food;
    if (r.action === "new") {
      const beforeMatches = baseline.foods.filter(
        (f) => productKey(f.name) === productKey(r.name),
      );
      const nowMatches = current.foods.filter(
        (f) => productKey(f.name) === productKey(r.name),
      );
      if (canonical(beforeMatches) !== canonical(nowMatches))
        throw Error(
          `${r.name} changed in your kitchen. Reopen the review before saving.`,
        );
      // Unspecified quantities use a non-convertible sentinel plus an explicit flag.
      // No count/weight is claimed and recipes must verify availability.
      if (current.foods.some((f) => f.id === r.newId))
        throw Error(
          "This voice review was already saved. Close it to avoid duplicates.",
        );
      food = {
        id: r.newId,
        name: r.name.trim(),
        quantity: r.quantity ?? 1,
        unit: r.quantity === null ? "unspecified" : r.unit,
        quantityUnknown: r.quantity === null,
        category: r.category,
        location: r.location,
        added: today,
        expiry: r.expiry,
        dateType: r.dateType === "unknown" ? "use-by" : r.dateType,
        dateTypeUnconfirmed: r.dateType === "unknown",
        notes: "",
        lowStock: r.lowStock ?? false,
      };
      next.foods.push(food);
    } else {
      if (!r.targetId || targets.has(r.targetId))
        throw Error("Choose a different existing batch for each update.");
      targets.add(r.targetId);
      const before = baseline.foods.find((f) => f.id === r.targetId),
        now = current.foods.find((f) => f.id === r.targetId);
      if (!before || !now || canonical(before) !== canonical(now))
        throw Error(
          `${r.name} changed while you were talking. Reopen the review; nothing was saved.`,
        );
      food = next.foods.find((f) => f.id === r.targetId)!;
      if (r.action === "increase") {
        if (r.quantity === null || food.quantityUnknown || r.unit !== food.unit)
          throw Error(
            `To increase ${r.name}, confirm a quantity in ${food.unit}.`,
          );
        // Expiry dates on separate purchases must not overwrite an old batch silently.
        if (
          r.expirySpoken &&
          (r.expiry !== food.expiry ||
            (r.dateType !== "unknown" && r.dateType !== food.dateType))
        )
          throw Error(`Different expiry for ${r.name}; add it as a new batch.`);
        food.quantity += r.quantity;
      } else if (r.quantity !== null) {
        food.quantity = r.quantity;
        food.unit = r.unit;
        food.quantityUnknown = false;
      }
      food.name = r.name.trim();
      food.category = r.category;
      if (r.locationSpoken) food.location = r.location;
      if (r.expirySpoken) {
        food.expiry = r.expiry;
        food.dateType = r.dateType === "unknown" ? "use-by" : r.dateType;
        food.dateTypeUnconfirmed = r.dateType === "unknown";
      }
      if (r.lowStock !== null) food.lowStock = r.lowStock;
    }
    if (r.addToShopping) {
      const updated = addShopping(next, [r.name]);
      next.shopping = updated.shopping;
    }
  }
  return validateBackup(next);
}
export function proposedAction(row: VoiceReview, data: Data) {
  const f = data.foods.find((f) => f.id === row.targetId);
  if (row.action === "choose")
    return "Choose an existing batch or add a new one";
  if (row.action === "new") return "Add a new inventory item";
  if (!f) return "Choose an existing item";
  if (row.action === "increase")
    return `Increase existing ${f.quantity} ${f.unit}`;
  if (row.quantity === null)
    return `Keep existing ${f.quantityUnknown ? "unspecified quantity" : `${f.quantity} ${f.unit}`}; update spoken details`;
  return f.quantity === row.quantity &&
    f.unit === row.unit &&
    !row.expirySpoken &&
    row.lowStock === null &&
    !row.locationSpoken
    ? "No quantity change"
    : "Replace the existing total; never add it twice";
}
