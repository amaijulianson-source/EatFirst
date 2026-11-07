import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Plus,
  ShoppingBasket,
  Trash2,
  Package,
} from "lucide-react";
import { categories, locations, type Data, type Food } from "../core";
import {
  makeDraft,
  draftFromShopping,
  sharedPatterns,
  validatePatterns,
  learnPatterns,
  saveDrafts,
  normalizeProduct,
  commonGroceries,
  type Draft,
  type Pattern,
} from "./model";
import {
  readPatterns,
  savePatterns,
  readDraft,
  storeDraft,
  clearDraft,
} from "./storage";
import { VoiceInventory } from "../voice/VoiceInventory";
import { Mic } from "lucide-react";
import "./entry.css";
export type EntryMode = "choose" | "shopping" | "quick" | "voice";
type ModalComponent = (p: {
  title: string;
  children: ReactNode;
  close: () => void;
}) => ReactNode;
export function EntryFlow({
  mode: initialMode,
  data,
  identity,
  commit,
  close,
  Modal,
  scopeGuard,
}: {
  mode: EntryMode;
  data: Data;
  identity: string;
  commit: (data: Data, message?: string) => Promise<void>;
  close: () => void;
  Modal: ModalComponent;
  scopeGuard: () => boolean;
}) {
  const [mode, setMode] = useState(initialMode),
    [rows, setRows] = useState<Draft[]>([]),
    [patterns, setPatterns] = useState<Pattern[]>([]),
    [name, setName] = useState(""),
    [quantity, setQuantity] = useState(1),
    [unit, setUnit] = useState("pieces"),
    [storage, setStorage] = useState<Food["location"]>("Pantry"),
    [expiry, setExpiry] = useState(""),
    [type, setType] = useState<Food["dateType"]>("best-before"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [merge, setMerge] = useState(false),
    [savedIds, setSavedIds] = useState<string[]>([]),
    [ready, setReady] = useState(false),
    [revision, setRevision] = useState(0);
  const baseline = useRef(structuredClone(data)),
    alive = useRef(true),
    patternRef = useRef(patterns),
    savingDraft = useRef(Promise.resolve());
  patternRef.current = patterns;
  const key = `${identity}:${mode}`;
  const combined = [
    ...patterns,
    ...sharedPatterns(data).filter(
      (p) => !patterns.some((m) => m.name === p.name),
    ),
  ];
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    setRows([]);
    baseline.current = structuredClone(data);
    void Promise.all([
      readPatterns(identity),
      mode !== "choose" && mode !== "voice"
        ? readDraft(key)
        : Promise.resolve(null),
    ])
      .then(([p, d]) => {
        if (!active) return;
        setPatterns(p);
        if (d) {
          baseline.current = d.baseline;
          setRows(d.rows);
          setMessage(
            "Your unsaved review has been restored. Check each item before saving.",
          );
        }
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError(
            "Saved entry preferences could not be opened. Your inventory is unchanged.",
          );
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
    // Freeze the review baseline on entry; live data is checked again at confirmation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, mode, key]);
  useEffect(() => {
    if (!ready || savedIds.length || mode === "choose" || mode === "voice")
      return;
    const draft = { rows, baseline: baseline.current };
    savingDraft.current = savingDraft.current
      .catch(() => undefined)
      .then(() => storeDraft(key, draft));
    void savingDraft.current.catch(() => {
      if (alive.current)
        setError(
          "Could not preserve this draft on the device. Keep this review open until saved.",
        );
    });
  }, [rows, key, ready, mode, savedIds]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (alive.current)
        setError((e as Error).message ?? "Could not complete this step.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function edit(id: string, patch: Partial<Draft>) {
    setRows((old) => old.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function choose(value: string) {
    setName(value);
    const d = makeDraft(value, "manual", combined);
    setQuantity(d.quantity);
    setUnit(d.unit);
    setStorage(d.location);
    setType(d.dateType);
  }
  async function fastQuick(again = false) {
    if (!scopeGuard()) throw Error("Your kitchen changed. Reopen this action.");
    const d = {
      ...makeDraft(name, "manual", combined),
      quantity,
      unit,
      location: storage,
      expiry,
      dateType: type,
    };
    const result = saveDrafts(data, [d], baseline.current, false);
    await commit(result.data, `${d.name} saved`);
    baseline.current = structuredClone(result.data);
    try {
      const learned = learnPatterns(patternRef.current, [d]);
      await savePatterns(identity, learned);
      setPatterns(learned);
    } catch {
      setMessage("Food saved; product memory could not be updated.");
    }
    if (again) {
      setName("");
      setExpiry("");
      setQuantity(1);
      setUnit("pieces");
      setMessage("Saved. Add the next grocery.");
    } else close();
  }
  function addQuick() {
    if (!name.trim()) {
      setError("Enter a food name.");
      return;
    }
    const d = makeDraft(name, "manual", combined);
    setRows((old) => [
      ...old,
      { ...d, quantity, unit, location: storage, expiry, dateType: type },
    ]);
    setName("");
    setExpiry("");
    setMessage("Added to review. Save the reviewed items when ready.");
  }
  function chooseShopping() {
    setRows(
      data.shopping
        .filter((s) => s.checked)
        .map((s) => draftFromShopping(s, combined)),
    );
    baseline.current = structuredClone(data);
    setMessage(
      "Only selected purchased items move. Unselected items stay on your shopping list.",
    );
  }
  async function rememberAndSave() {
    if (!scopeGuard())
      throw Error(
        "Your account or kitchen changed. Reopen this action in the intended kitchen.",
      );
    const result = saveDrafts(data, rows, baseline.current, merge);
    await commit(
      result.data,
      `${result.ids.length} groceries added to inventory`,
    );
    setSavedIds(result.ids);
    setRows([]);
    await savingDraft.current.catch(() => undefined);
    await clearDraft(key);
    try {
      const next = learnPatterns(patternRef.current, rows);
      await savePatterns(identity, next);
      setPatterns(next);
    } catch {
      setMessage(
        "Inventory saved. Product patterns could not be updated; no inventory retry is needed.",
      );
    }
    baseline.current = structuredClone(result.data);
    setMessage(
      rows.some((r) => r.shoppingId)
        ? "Saved to inventory. Selected shopping items moved together with the groceries."
        : "Saved to inventory.",
    );
  }
  const units = [
    "pieces",
    "g",
    "kg",
    "ml",
    "litre",
    "bag",
    "pack",
    "loaf",
    "portion",
    "can",
    "bottle",
    "bunch",
    "box",
  ];
  if (mode === "voice")
    return (
      <Modal title="Talk to EatFirst" close={close}>
        <VoiceInventory
          data={data}
          identity={identity}
          commit={commit}
          scopeGuard={scopeGuard}
          close={close}
          back={() => setMode("choose")}
        />
      </Modal>
    );
  return (
    <Modal
      title={
        mode === "choose"
          ? "Add to inventory"
          : mode === "shopping"
            ? "Put away your shopping"
            : "Quick add"
      }
      close={close}
    >
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="banner" role="status">
          {message}
        </div>
      )}
      {mode === "choose" ? (
        <div className="entry-choices">
          {(
            [
              {
                mode: "voice",
                icon: Mic,
                title: "Talk to EatFirst",
                body: "Describe your kitchen naturally. Review every change before saving.",
              },
              {
                mode: "shopping",
                icon: ShoppingBasket,
                title: "From shopping trip",
                body: `${data.shopping.filter((s) => s.checked).length} purchased items ready to review`,
              },
              {
                mode: "quick",
                icon: Plus,
                title: "Quick add",
                body: "One item or a few. Reuse your common groceries.",
              },
            ] as const
          ).map((m) => (
            <button
              className="entry-choice"
              aria-label={m.title}
              key={m.mode}
              onClick={() => {
                setMode(m.mode);
                setMessage("");
              }}
            >
              <span className="entry-choice-icon">
                <m.icon size={25} />
              </span>
              <span>
                <strong>{m.title}</strong>
                <small>{m.body}</small>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
          <p className="muted small">
            Speak naturally or add groceries by hand. Nothing from a voice
            session is shared until you confirm.
          </p>
        </div>
      ) : (
        <>
          <button
            className="text-btn"
            disabled={busy}
            onClick={() => {
              setMode("choose");
              setMessage("");
            }}
          >
            All entry methods
          </button>
          {!ready ? (
            <p role="status">Opening your kitchen’s saved patterns…</p>
          ) : (
            <>
              {savedIds.length > 0 ? (
                <div className="entry-success">
                  <Check size={30} />
                  <h3>Your groceries are in.</h3>
                  <p>
                    You can edit dates and quantities any time in Inventory.
                  </p>
                  <button className="btn primary" onClick={close}>
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {mode === "shopping" && (
                    <section className="entry-intro">
                      <ShoppingBasket size={24} />
                      <p>
                        Purchased groceries are copied into an editable review.
                        Each selected shopping item is removed only when the
                        inventory save succeeds; changes are atomic and safely
                        queued offline.
                      </p>
                      <button
                        className="btn primary full"
                        onClick={chooseShopping}
                        disabled={busy || !data.shopping.some((s) => s.checked)}
                      >
                        Review purchased items (
                        {data.shopping.filter((s) => s.checked).length})
                      </button>
                      {!data.shopping.some((s) => s.checked) && (
                        <p className="muted">
                          Mark items purchased in Shopping first.
                        </p>
                      )}
                    </section>
                  )}
                  {mode === "quick" && (
                    <section className="quick-entry">
                      <label>
                        Food name
                        <input
                          autoFocus
                          value={name}
                          onChange={(e) => choose(e.target.value)}
                          placeholder="e.g. AH halfvolle melk 1L"
                          maxLength={100}
                          list="grocery-patterns"
                        />
                      </label>
                      <datalist id="grocery-patterns">
                        {[
                          ...new Set([
                            ...combined.map((p) => p.name),
                            ...commonGroceries,
                          ]),
                        ]
                          .slice(0, 100)
                          .map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                      </datalist>
                      {name && normalizeProduct(name).name !== name && (
                        <p className="entry-suggestion">
                          Suggested inventory name:{" "}
                          <strong>{normalizeProduct(name).name}</strong> ·{" "}
                          {normalizeProduct(name).location}
                        </p>
                      )}
                      <div className="entry-grid">
                        <label>
                          Quantity
                          <input
                            type="number"
                            min="0.001"
                            max="1000000"
                            step="any"
                            value={quantity}
                            onChange={(e) =>
                              setQuantity(Number(e.target.value))
                            }
                          />
                        </label>
                        <label>
                          Unit
                          <select
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                          >
                            {units.map((u) => (
                              <option key={u}>{u}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Storage
                          <select
                            value={storage}
                            onChange={(e) =>
                              setStorage(e.target.value as Food["location"])
                            }
                          >
                            {locations.map((l) => (
                              <option key={l}>{l}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Expiry date (optional)
                          <input
                            type="date"
                            value={expiry}
                            onChange={(e) => setExpiry(e.target.value)}
                          />
                        </label>
                        <label>
                          Date type
                          <select
                            value={type}
                            onChange={(e) =>
                              setType(e.target.value as Food["dateType"])
                            }
                          >
                            <option value="use-by">Use-by · safety</option>
                            <option value="best-before">
                              Best-before · quality
                            </option>
                          </select>
                        </label>
                      </div>
                      <div className="form-actions">
                        <button
                          className="btn secondary"
                          onClick={() => void run(() => fastQuick(true))}
                          disabled={busy}
                        >
                          Save & add another
                        </button>
                        <button
                          className="btn primary"
                          onClick={() => void run(() => fastQuick(false))}
                          disabled={busy}
                        >
                          Save food
                        </button>
                      </div>
                      <button
                        className="text-btn"
                        onClick={addQuick}
                        disabled={busy}
                      >
                        <Plus size={17} />
                        Add to a batch review instead
                      </button>
                      <h3>Reuse a grocery</h3>
                      <div className="entry-patterns">
                        {[
                          ...new Set([
                            ...combined.slice(0, 8).map((p) => p.name),
                            ...commonGroceries,
                          ]),
                        ]
                          .slice(0, 12)
                          .map((n) => (
                            <button
                              key={n}
                              onClick={() => choose(n)}
                              className="chip"
                            >
                              <Package size={14} />
                              {n}
                            </button>
                          ))}
                      </div>
                      <p className="muted small">
                        Suggestions use this household’s groceries/history and
                        saved patterns on this device. Dates are never reused.
                      </p>
                    </section>
                  )}
                  {rows.length > 0 && (
                    <section className="entry-review">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">CHECK BEFORE YOU SAVE</p>
                          <h3>Review {rows.length} groceries</h3>
                        </div>
                        <ClipboardList size={24} />
                      </div>
                      <p className="muted small">
                        Uncheck anything incorrect. Separate different expiry
                        dates into different rows.
                      </p>
                      {rows.map((r, i) => (
                        <article className="draft-card" key={r.id}>
                          <div className="draft-card-head">
                            <label className="entry-checkbox">
                              <input
                                type="checkbox"
                                checked={r.included}
                                onChange={(e) =>
                                  edit(r.id, { included: e.target.checked })
                                }
                              />
                              Include item {i + 1}
                            </label>
                            <button
                              className="icon-btn"
                              aria-label={`Remove draft ${i + 1}`}
                              onClick={() =>
                                setRows((old) =>
                                  old.filter((d) => d.id !== r.id),
                                )
                              }
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                          <p className="draft-source">
                            {r.source === "shopping"
                              ? "From purchased list"
                              : "Manual suggestion"}
                            {r.sources.length > 1
                              ? ` · ${r.sources.length} sources`
                              : ""}
                          </p>
                          <label>
                            Item name
                            <input
                              value={r.name}
                              maxLength={100}
                              onChange={(e) =>
                                edit(r.id, { name: e.target.value })
                              }
                            />
                          </label>
                          <div className="entry-grid">
                            <label>
                              Quantity
                              <input
                                type="number"
                                min="0.001"
                                max="1000000"
                                step="any"
                                value={r.quantity}
                                onChange={(e) =>
                                  edit(r.id, {
                                    quantity: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Unit
                              <select
                                value={r.unit}
                                onChange={(e) =>
                                  edit(r.id, { unit: e.target.value })
                                }
                              >
                                {units.map((u) => (
                                  <option key={u}>{u}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Storage
                              <select
                                value={r.location}
                                onChange={(e) =>
                                  edit(r.id, {
                                    location: e.target
                                      .value as Food["location"],
                                  })
                                }
                              >
                                {locations.map((l) => (
                                  <option key={l}>{l}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Category
                              <select
                                value={r.category}
                                onChange={(e) =>
                                  edit(r.id, {
                                    category: e.target
                                      .value as Food["category"],
                                  })
                                }
                              >
                                {categories.map((c) => (
                                  <option key={c}>{c}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Expiry date (optional)
                              <input
                                type="date"
                                value={r.expiry}
                                onChange={(e) =>
                                  edit(r.id, { expiry: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              Date type
                              <select
                                value={r.dateType}
                                onChange={(e) =>
                                  edit(r.id, {
                                    dateType: e.target
                                      .value as Food["dateType"],
                                  })
                                }
                              >
                                <option value="use-by">Use-by · safety</option>
                                <option value="best-before">
                                  Best-before · quality
                                </option>
                              </select>
                            </label>
                          </div>
                          <details>
                            <summary>Why this suggestion?</summary>
                            {r.review.map((s, n) => (
                              <p key={n} className="muted small">
                                {s}
                              </p>
                            ))}
                            <p className="muted small">
                              Sources: {r.sources.join(", ")}
                            </p>
                            <label>
                              Notes
                              <textarea
                                value={r.notes}
                                maxLength={1900}
                                onChange={(e) =>
                                  edit(r.id, { notes: e.target.value })
                                }
                              />
                            </label>
                          </details>
                        </article>
                      ))}
                      <label className="entry-checkbox merge-choice">
                        <input
                          type="checkbox"
                          checked={merge}
                          onChange={(e) => setMerge(e.target.checked)}
                        />
                        Combine exact matching batches (same product, units,
                        storage, date, notes; no recorded price)
                      </label>
                      <div className="entry-confirm">
                        <button
                          className="btn secondary"
                          disabled={busy}
                          onClick={() =>
                            setRows((old) => [
                              ...old,
                              makeDraft("", "manual", combined),
                            ])
                          }
                        >
                          <Plus size={17} />
                          Another item
                        </button>
                        <button
                          className="btn primary"
                          disabled={busy || !rows.some((r) => r.included)}
                          onClick={() => void run(rememberAndSave)}
                        >
                          <Check size={17} />
                          Confirm & save {
                            rows.filter((r) => r.included).length
                          }{" "}
                          items
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}
              <details className="entry-pattern-settings">
                <summary>Saved product patterns & drafts</summary>
                <p className="muted small">
                  Shared groceries/history inform suggestions across family
                  devices. Confirmed package patterns are also saved privately
                  on this device for this account and kitchen. Unfinished item
                  reviews are kept locally, not shared.
                </p>
                <div className="form-actions">
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await savingDraft.current.catch(() => undefined);
                        await clearDraft(key);
                        setRows([]);
                        setRevision((n) => n + 1);
                        setMessage(
                          "This entry draft was discarded. Inventory is unchanged.",
                        );
                      })
                    }
                  >
                    Discard this draft
                  </button>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        if (
                          !window.confirm(
                            "Forget saved package patterns on this device for this account and kitchen? Shared groceries are kept.",
                          )
                        )
                          return;
                        await savePatterns(identity, []);
                        setPatterns([]);
                        setMessage(
                          "Saved patterns cleared; shared inventory suggestions remain.",
                        );
                      })
                    }
                  >
                    Forget saved patterns
                  </button>
                </div>
                <div className="form-actions">
                  <button
                    className="btn secondary"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob(
                          [
                            JSON.stringify(
                              {
                                format: "eatfirst-product-patterns",
                                version: 1,
                                patterns,
                              },
                              null,
                              2,
                            ),
                          ],
                          { type: "application/json" },
                        ),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "eatfirst-product-patterns.json";
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    Export product patterns
                  </button>
                  <label className="btn secondary">
                    Import product patterns
                    <input
                      className="sr-only"
                      type="file"
                      accept="application/json"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        void run(async () => {
                          if (f.size > 250000)
                            throw Error("Pattern backup is too large.");
                          const parsed = JSON.parse(await f.text());
                          if (
                            parsed.format !== "eatfirst-product-patterns" ||
                            parsed.version !== 1
                          )
                            throw Error(
                              "Not an EatFirst product-pattern backup.",
                            );
                          const next = validatePatterns(parsed.patterns);
                          if (
                            !window.confirm(
                              "Replace saved product patterns for this account and kitchen on this device? Inventory is kept.",
                            )
                          )
                            return;
                          await savePatterns(identity, next);
                          setPatterns(next);
                          setMessage(
                            "Product patterns restored. Dates are never reused.",
                          );
                        });
                      }}
                    />
                  </label>
                </div>
                <small className="muted">
                  Draft revision {revision}. Never clear browser storage just to
                  update EatFirst.
                </small>
              </details>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
