import { Trash2, Plus } from "lucide-react";
import {
  daysUntil,
  foodAmount,
  foodDateType,
  type Data,
  type Event,
} from "../core";
import { normalizeProduct } from "../entry/model";
import { planUsage, usageCandidates, usageAmountLabel } from "./consumption";
import { usageLabel } from "./intents";
import type { VoiceReview } from "./reconcile";
export function ConsumptionReview({
  row: r,
  index,
  baseline,
  today,
  edit,
  remove,
}: {
  row: VoiceReview;
  index: number;
  baseline: Data;
  today: string;
  edit: (patch: Partial<VoiceReview>) => void;
  remove: () => void;
}) {
  if (!r.consumption) return null;
  const usage = r.consumption,
    allocations = r.allocations ?? [],
    candidates = usageCandidates(r, baseline);
  function replan(patch: Partial<VoiceReview>) {
    const item = { ...r, ...patch },
      plan = planUsage(item, baseline, today);
    edit({
      ...patch,
      allocations: plan.allocations,
      warnings: plan.warnings,
    });
  }
  function amount(id: string, value: number | null, whole = false) {
    edit({
      allocations: allocations.map((a) =>
        a.id === id ? { ...a, amount: value, whole } : a,
      ),
    });
  }
  return (
    <article className="draft-card usage-review-card">
      <div className="draft-card-head">
        <label className="entry-checkbox">
          <input
            type="checkbox"
            checked={r.included}
            onChange={(e) => edit({ included: e.target.checked })}
          />
          Include item {index + 1}
        </label>
        <button
          className="icon-btn"
          aria-label={`Remove voice item ${index + 1}`}
          onClick={remove}
        >
          <Trash2 size={18} />
        </button>
      </div>
      <p
        className={`voice-action ${usage.kind === "discarded" ? "usage-waste" : ""}`}
      >
        {usageLabel(usage)} · {usageAmountLabel(r)}
      </p>
      <label>
        Ingredient name
        <input
          value={r.name}
          maxLength={100}
          list={`usage-names-${r.id}`}
          onChange={(e) => edit({ name: e.target.value, allocations: [] })}
          onBlur={(e) =>
            replan({ name: normalizeProduct(e.target.value).name })
          }
        />
      </label>
      <datalist id={`usage-names-${r.id}`}>
        {[...new Set(baseline.foods.map((f) => f.name))].map((n) => (
          <option key={n}>{n}</option>
        ))}
      </datalist>
      <label>
        What happened?
        <select
          value={usage.kind}
          onChange={(e) =>
            replan({
              consumption: {
                ...usage,
                kind: e.target.value as Event["action"],
              },
            })
          }
        >
          <option value="used">Used while cooking</option>
          <option value="eaten">Eaten</option>
          <option value="discarded">Discarded · record as waste</option>
        </select>
      </label>
      {allocations.map((a, j) => {
        const f = baseline.foods.find((f) => f.id === a.id);
        if (!f)
          return (
            <p key={a.id} className="error-text">
              This batch is no longer available. Rebuild the review.
            </p>
          );
        return (
          <div className="usage-batch" key={a.id}>
            <div className="draft-card-head">
              <strong>
                {f.name} · {f.location}
              </strong>
              <button
                className="icon-btn"
                aria-label={`Remove batch ${j + 1} for ${r.name}`}
                onClick={() =>
                  edit({
                    allocations: allocations.filter((b) => b.id !== a.id),
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
            <p className="small muted">
              Recorded: {foodAmount(f)} ·{" "}
              {f.expiry ? `${foodDateType(f)} ${f.expiry}` : "No expiry date"}
            </p>
            {daysUntil(f, today) < 0 && (
              <p className="banner">
                This batch is past its recorded date. Recording what happened
                does not mean the food was safe.
              </p>
            )}
            {!f.quantityUnknown ? (
              <label>
                Amount to deduct ({f.unit})
                <input
                  aria-label={`Amount from batch ${j + 1} (${f.unit})`}
                  type="number"
                  min="0.001"
                  step="any"
                  max={f.quantity}
                  value={a.amount ?? ""}
                  placeholder="Enter actual amount"
                  onChange={(e) =>
                    amount(
                      a.id,
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
            ) : (
              <p className="banner">
                No quantity is recorded. Set a known amount in Inventory first,
                or confirm the whole item is finished.
              </p>
            )}
            <div className="usage-fractions">
              <button
                className="chip"
                disabled={f.quantityUnknown}
                onClick={() => amount(a.id, f.quantity / 4)}
              >
                Use ¼
              </button>
              <button
                className="chip"
                disabled={f.quantityUnknown}
                onClick={() => amount(a.id, f.quantity / 2)}
              >
                Use half
              </button>
              <button
                className="chip"
                onClick={() => amount(a.id, f.quantity, true)}
              >
                {usage.kind === "discarded"
                  ? "Discard whole item"
                  : "Finish whole item"}
              </button>
            </div>
            <p className="usage-remaining">
              {f.quantityUnknown
                ? a.whole
                  ? "Whole item will be removed; no numerical quantity is claimed."
                  : "Amount needs clarification."
                : a.amount === null
                  ? "Enter an amount before confirming."
                  : a.amount > f.quantity || a.amount <= 0
                    ? "Amount must be within the recorded stock."
                    : `Remaining after confirmation: ${Math.round((f.quantity - a.amount) * 1e8) / 1e8} ${f.unit}`}
            </p>
          </div>
        );
      })}
      <label>
        Choose a batch for {r.name || "this ingredient"}
        <select
          value=""
          onChange={(e) => {
            if (e.target.value)
              edit({
                allocations: [
                  ...allocations,
                  { id: e.target.value, amount: null, whole: false },
                ],
              });
          }}
        >
          <option value="">
            {candidates.length
              ? "Select a batch to include…"
              : "No matching product — check the name"}
          </option>
          {candidates
            .filter((f) => !allocations.some((a) => a.id === f.id))
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {foodAmount(f)} · {f.location}
                {f.expiry ? ` · ${f.expiry}` : ""}
              </option>
            ))}
        </select>
      </label>
      {!allocations.length && (
        <p className="banner">
          <Plus size={15} /> Choose the correct existing batch. If it is not
          recorded, leave this ingredient unchecked; EatFirst will not invent
          stock or deduct another product.
        </p>
      )}
      {r.warnings.length > 0 && (
        <details className="voice-warnings">
          <summary>Check this deduction · {r.warnings.length} notes</summary>
          <ul>
            {r.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
