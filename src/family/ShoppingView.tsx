import { useState, useRef } from "react";
import {
  Plus,
  Search,
  ShoppingBasket,
  Check,
  ArrowRight,
  X,
  Star,
  ChevronDown,
  ChevronUp,
  Refrigerator,
} from "lucide-react";
import { canonical } from "./changes";
import { preserveBackup } from "../db";
import { useKitchen } from "./useKitchen";
import {
  addShopping,
  purchaseItem,
  normalize,
  categories,
  type Data,
  type Shopping,
} from "../core";
export function ShoppingView({
  data,
  saving,
  commit,
  putAway,
  finishShopping,
}: {
  data: Data;
  saving: boolean;
  commit: (data: Data, message?: string, optimistic?: boolean) => Promise<void>;
  putAway: (item: Shopping) => void;
  finishShopping: () => void;
}) {
  const family = useKitchen();
  const focused = useRef(new Map<string, string>());
  const [editError, setEditError] = useState("");
  const [mode, setMode] = useState(false),
    [query, setQuery] = useState(""),
    [showPurchased, setShowPurchased] = useState(true),
    [filter, setFilter] = useState("All");
  const pending = data.shopping.filter((s) => !s.checked),
    purchased = data.shopping.filter((s) => s.checked);
  const visible = (checked: boolean) =>
    data.shopping
      .filter(
        (s) =>
          s.checked === checked &&
          (!query || s.name.toLowerCase().includes(query.toLowerCase())) &&
          (filter === "All" || (s.category ?? "Other") === filter),
      )
      .sort(
        (a, b) =>
          Number(Boolean(b.priority)) - Number(Boolean(a.priority)) ||
          a.name.localeCompare(b.name),
      );
  async function update(id: string, patch: Partial<Shopping>, guard = false) {
    const current = data.shopping.find((s) => s.id === id);
    if (
      guard &&
      focused.current.has(id) &&
      focused.current.get(id) !== canonical(current)
    ) {
      await preserveBackup(
        {
          ...data,
          shopping: data.shopping.map((s) =>
            s.id === id ? { ...s, ...patch } : s,
          ),
        },
        "Shopping edit proposal — changed by another member",
        family.session?.user.id,
      );
      setEditError(
        "This shopping item changed while you were typing. Your proposal is preserved in Family → local backups. Review the latest item before editing again.",
      );
      return;
    }
    await commit(
      {
        ...data,
        shopping: data.shopping.map((s) =>
          s.id === id ? { ...s, ...patch } : s,
        ),
      },
      "Shopping item updated",
    );
  }
  const row = (s: Shopping) => (
    <div className={`shopping-row ${s.checked ? "checked" : ""}`} key={s.id}>
      <input
        type="checkbox"
        aria-label={`Purchased ${s.name}`}
        checked={s.checked}
        disabled={saving}
        onChange={async (e) => {
          await commit(
            purchaseItem(data, s.id, e.target.checked),
            "Shopping list updated",
            true,
          );
        }}
      />
      <div className="shopping-text">
        <input
          aria-label={`Edit ${s.name}`}
          defaultValue={s.name}
          key={s.name}
          maxLength={100}
          onFocus={() => focused.current.set(s.id, canonical(s))}
          onBlur={async (e) => {
            const name = e.target.value.trim();
            if (name && name !== s.name) await update(s.id, { name }, true);
            else e.target.value = s.name;
          }}
        />
        <input
          aria-label={`Quantity for ${s.name}`}
          onFocus={() => focused.current.set(s.id, canonical(s))}
          placeholder="Add quantity or note"
          defaultValue={s.quantity}
          maxLength={200}
          onBlur={async (e) => {
            if (e.target.value !== s.quantity)
              await update(s.id, { quantity: e.target.value }, true);
          }}
        />
        {!mode && (
          <details className="shopping-details">
            <summary>Details{s.category ? ` · ${s.category}` : ""}</summary>
            <label>
              Category
              <select
                aria-label={`Category for ${s.name}`}
                value={s.category ?? "Other"}
                onChange={(e) =>
                  update(s.id, {
                    category: e.target.value as Shopping["category"],
                  })
                }
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <input
                aria-label={`Notes for ${s.name}`}
                defaultValue={s.notes ?? ""}
                maxLength={1000}
                onBlur={(e) => {
                  if (e.target.value !== (s.notes ?? ""))
                    void update(s.id, { notes: e.target.value }, true);
                }}
              />
            </label>
          </details>
        )}
      </div>
      <div className="shopping-tools">
        {!mode && (
          <button
            className={`icon-btn ${s.priority ? "priority-on" : ""}`}
            aria-label={`${s.priority ? "Unpin" : "Prioritize"} ${s.name}`}
            onClick={() => update(s.id, { priority: !s.priority })}
          >
            <Star size={17} fill={s.priority ? "currentColor" : "none"} />
          </button>
        )}
        <button className="text-btn" onClick={() => putAway(s)}>
          Put away <ArrowRight size={15} />
        </button>
        {!mode && (
          <button
            className="icon-btn"
            aria-label={`Remove ${s.name} from shopping list`}
            onClick={() =>
              commit(
                {
                  ...data,
                  shopping: data.shopping.filter((x) => x.id !== s.id),
                },
                "Shopping item removed",
              )
            }
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
  return (
    <div className={mode ? "shopping-mode" : ""}>
      {editError && (
        <div className="banner danger" role="alert">
          {editError}
          <button onClick={() => setEditError("")}>Dismiss</button>
        </div>
      )}
      <div className="page-heading">
        <div>
          <p className="eyebrow">A LITTLE LIST. A BETTER SHOP.</p>
          <h1>
            {mode
              ? "Let’s bring the good stuff home."
              : "Shop with a little more purpose."}
          </h1>
          <p>
            {mode
              ? `${pending.length} left to find · ${purchased.length} in your basket`
              : "A shared plan for the next grocery run, with the essentials close at hand."}
          </p>
        </div>
        <button
          className={`btn ${mode ? "primary" : "secondary"}`}
          onClick={() => setMode(!mode)}
        >
          <ShoppingBasket size={18} />
          {mode ? "Finish shopping mode" : "Start shopping mode"}
        </button>
      </div>
      {purchased.length > 0 && (
        <button
          className="btn primary full finish-trip"
          onClick={finishShopping}
        >
          <Refrigerator size={18} />
          Add purchased items to inventory ({purchased.length})
        </button>
      )}
      {mode && (
        <div
          className="shopping-progress"
          role="progressbar"
          aria-label="Shopping progress"
          aria-valuemin={0}
          aria-valuemax={data.shopping.length || 1}
          aria-valuenow={purchased.length}
        >
          <span
            style={{
              width: `${data.shopping.length ? (purchased.length / data.shopping.length) * 100 : 0}%`,
            }}
          />
        </div>
      )}
      <form
        className="shopping-add panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form),
            name = String(fd.get("name")).trim();
          if (!name) return;
          let next = addShopping(data, [name]);
          const quantity = String(fd.get("quantity")).trim();
          if (quantity)
            next = {
              ...next,
              shopping: next.shopping.map((s) =>
                normalize(s.name) === normalize(name) ? { ...s, quantity } : s,
              ),
            };
          await commit(next, "Added to the shopping list");
          form.reset();
        }}
      >
        <input
          name="name"
          required
          maxLength={100}
          placeholder="What do you need?"
          aria-label="Shopping item name"
        />
        <input
          className="shopping-add-qty"
          name="quantity"
          maxLength={200}
          placeholder="Quantity (optional)"
          aria-label="New shopping item quantity"
        />
        <button className="btn primary" disabled={saving}>
          <Plus size={18} />
          Add to list
        </button>
      </form>
      {!mode && (data.frequent?.length ?? 0) > 0 && (
        <section className="panel padded frequent-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE EVERYDAY ESSENTIALS</p>
              <h2>Frequently bought</h2>
            </div>
            <Star size={20} />
          </div>
          <p className="muted small">
            Based on items you’ve marked purchased. Tap to add them again.
          </p>
          <div className="frequent-chips">
            {[...(data.frequent ?? [])]
              .sort(
                (a, b) =>
                  b.count - a.count ||
                  b.lastPurchased.localeCompare(a.lastPurchased),
              )
              .slice(0, 12)
              .map((f) => (
                <button
                  className="btn secondary"
                  key={f.id}
                  aria-label={`Add ${f.name} again`}
                  onClick={() =>
                    commit(addShopping(data, [f.name]), `${f.name} added again`)
                  }
                >
                  <Plus size={15} />
                  {f.name}
                  <small>{f.count}</small>
                </button>
              ))}
          </div>
        </section>
      )}
      <div className="shopping-filters">
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Search shopping list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find an item…"
          />
        </div>
        <label>
          Category
          <select
            aria-label="Shopping category filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>
            To pick up <span className="muted">{pending.length}</span>
          </h2>
          {!mode && <span className="muted small">Star the essentials</span>}
        </div>
        {visible(false).map(row)}
        {!visible(false).length && (
          <div className="empty">
            <span className="empty-icon">
              <Check size={30} />
            </span>
            <h3>
              {data.shopping.length
                ? "All set for this part of the list"
                : "Room for the essentials"}
            </h3>
            <p>
              {data.shopping.length
                ? "Everything here is in the basket, or hidden by your filters."
                : "Add a grocery, use a frequently bought item, or send missing recipe ingredients to your list."}
            </p>
          </div>
        )}
      </section>
      {purchased.length > 0 && (
        <section className="panel purchased-panel">
          <div className="section-heading">
            <button
              className="text-btn purchased-toggle"
              onClick={() => setShowPurchased(!showPurchased)}
            >
              {showPurchased ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
              Purchased · {purchased.length}
            </button>
            <button
              className="btn secondary"
              onClick={() => putAway(purchased[0])}
            >
              <Refrigerator size={17} />
              Put away next item
            </button>
          </div>
          {showPurchased && visible(true).map(row)}
        </section>
      )}
      <p className="muted small">
        “Put away” asks for the package’s expiry date and storage location.
        Saving adds the food and removes the shopping item together. No expiry
        date is guessed.
      </p>
    </div>
  );
}
