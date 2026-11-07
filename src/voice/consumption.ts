import { daysUntil, type Data, type Food } from "../core";
import { productKey } from "../entry/model";
import { measure } from "../cooking/engine";
import type { VoiceItem } from "./interpret";
export type UsageAllocation = {
  id: string;
  amount: number | null;
  whole: boolean;
};
export function usageCandidates(item: VoiceItem, data: Data) {
  return data.foods.filter((f) => productKey(f.name) === productKey(item.name));
}
function compatible(source: string, target: string) {
  return measure(1, source).unit === measure(1, target).unit;
}
/** Only a review proposal. No inventory or events are changed here. */
export function planUsage(
  item: VoiceItem,
  data: Data,
  today: string,
): { allocations: UsageAllocation[]; warnings: string[] } {
  const usage = item.consumption;
  if (!usage) return { allocations: [], warnings: [] };
  const all = usageCandidates(item, data),
    warnings: string[] = [];
  if (!all.length)
    return {
      allocations: [],
      warnings: [
        "No matching recorded food. Choose the correct existing product; nothing new will be added.",
      ],
    };
  let candidates = all.filter(
    (f) =>
      (!item.locationSpoken || f.location === item.location) &&
      (!item.expirySpoken || !item.expiry || f.expiry === item.expiry),
  );
  if (usage.kind !== "discarded")
    candidates = candidates.filter((f) => daysUntil(f, today) >= 0);
  if (!candidates.length)
    return {
      allocations: [],
      warnings: [
        "No automatic match for this location/date, or the matching food is past its date. Choose a batch explicitly to record what happened; a past date never establishes safety.",
      ],
    };
  if (usage.amount === "half" || usage.amount === "all") {
    if (candidates.length !== 1)
      return {
        allocations: [],
        warnings: [
          "Which batch did you mean? Choose it below before applying a fraction or finishing it.",
        ],
      };
    const f = candidates[0];
    if (usage.amount === "half" && f.quantityUnknown)
      return {
        allocations: [{ id: f.id, amount: null, whole: false }],
        warnings: [
          "The recorded quantity is unknown. Record a known quantity in Inventory before deducting a fraction.",
        ],
      };
    return {
      allocations: [
        {
          id: f.id,
          amount: usage.amount === "half" ? f.quantity / 2 : f.quantity,
          whole: usage.amount === "all",
        },
      ],
      warnings: [
        usage.amount === "half"
          ? `Half of the recorded ${f.quantity} ${f.unit}. Confirm this batch and amount.`
          : "The selected batch will be finished. Confirm this is the entire item.",
      ],
    };
  }
  if (item.quantity === null || usage.amount === "unclear")
    return {
      allocations:
        candidates.length === 1
          ? [{ id: candidates[0].id, amount: null, whole: false }]
          : [],
      warnings: [
        "No exact amount was spoken. Enter what you used; some, a little and almost all are not precise quantities.",
      ],
    };
  const exact = candidates.filter(
    (f) => !f.quantityUnknown && compatible(item.unit, f.unit),
  );
  if (!exact.length)
    return {
      allocations:
        candidates.length === 1
          ? [{ id: candidates[0].id, amount: null, whole: false }]
          : [],
      warnings: [
        `You said ${item.quantity} ${item.unit}, but no batch has a compatible known quantity. Enter the actual deduction in the recorded unit; package sizes are not invented.`,
      ],
    };
  if (new Set(exact.map((f) => `${f.category}:${f.location}`)).size > 1)
    return {
      allocations: [],
      warnings: [
        "Matching batches have different storage/categories. Choose the actual batch instead of guessing which product you used.",
      ],
    };
  const need = measure(item.quantity, item.unit),
    available = exact.reduce(
      (n, f) => n + measure(f.quantity, f.unit).quantity,
      0,
    );
  if (available + 1e-7 < need.quantity)
    return {
      allocations:
        exact.length === 1
          ? [{ id: exact[0].id, amount: null, whole: false }]
          : [],
      warnings: [
        `The spoken ${item.quantity} ${item.unit} exceeds recorded stock. Correct the amount or update Inventory first; nothing is silently capped.`,
      ],
    };
  let remaining = need.quantity;
  const allocations: UsageAllocation[] = [];
  for (const f of exact.sort(
    (a, b) =>
      daysUntil(a, today) - daysUntil(b, today) ||
      a.added.localeCompare(b.added) ||
      a.id.localeCompare(b.id),
  )) {
    if (remaining <= 1e-7) break;
    const factor = measure(1, f.unit).quantity,
      used = Math.min(remaining, measure(f.quantity, f.unit).quantity);
    allocations.push({
      id: f.id,
      amount: Math.min(f.quantity, Math.round((used / factor) * 1e8) / 1e8),
      whole: false,
    });
    remaining -= used;
  }
  if (allocations.length > 1 || exact.length > 1)
    warnings.push(
      "Proposed earliest-expiry batch order. Check each batch and adjust the split.",
    );
  if (usage.last && Math.abs(available - need.quantity) > 1e-7)
    warnings.push(
      "You said last, but Inventory records more. Only the spoken amount is proposed; check your remaining stock.",
    );
  return { allocations, warnings };
}
export function usageAmountLabel(item: VoiceItem) {
  const u = item.consumption;
  if (!u) return "";
  return u.amount === "half"
    ? "Half of a recorded batch"
    : u.amount === "all"
      ? "Finish a recorded batch"
      : item.quantity !== null
        ? `${item.quantity} ${item.unit}`
        : "Amount needs clarification";
}
export function validAllocation(a: UsageAllocation, f: Food | undefined) {
  return Boolean(
    f &&
    a.amount !== null &&
    Number.isFinite(a.amount) &&
    a.amount > 0 &&
    a.amount <= f.quantity &&
    (!f.quantityUnknown || (a.whole && a.amount === f.quantity)),
  );
}
