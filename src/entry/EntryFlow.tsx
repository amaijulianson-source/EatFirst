import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Camera,
  CalendarDays,
  Check,
  ClipboardList,
  Plus,
  ShoppingBasket,
  Trash2,
  ScanLine,
  Package,
  RefreshCw,
} from "lucide-react";
import { categories, locations, type Data, type Food } from "../core";
import {
  makeDraft,
  draftFromShopping,
  parsePhotoText,
  mergeDetections,
  sharedPatterns,
  validatePatterns,
  learnPatterns,
  saveDrafts,
  assignDates,
  normalizeProduct,
  commonGroceries,
  type Draft,
  type Pattern,
  type DateCandidate,
  type ExpiryChange,
} from "./model";
import {
  readPatterns,
  savePatterns,
  readDraft,
  storeDraft,
  clearDraft,
} from "./storage";
import "./entry.css";
export type EntryMode = "choose" | "shopping" | "quick" | "photo" | "expiry";
type ModalComponent = (p: {
  title: string;
  children: ReactNode;
  close: () => void;
}) => ReactNode;
type ScanDate = DateCandidate & {
  id: string;
  itemId: string;
  selected: boolean;
  dateType: Food["dateType"];
  source: string;
};
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
    [progress, setProgress] = useState(""),
    [merge, setMerge] = useState(false),
    [raw, setRaw] = useState(""),
    [scanDates, setScanDates] = useState<ScanDate[]>([]),
    [savedIds, setSavedIds] = useState<string[]>([]),
    [ready, setReady] = useState(false),
    [photoReady, setPhotoReady] = useState(false),
    [revision, setRevision] = useState(0),
    [filesRead, setFilesRead] = useState(0);
  const preparation = useRef<AbortController | null>(null);
  const baseline = useRef(structuredClone(data)),
    alive = useRef(true),
    epoch = useRef(0),
    reader = useRef<import("./recognition").LocalPhotoReader | null>(null),
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
      // This is a cancellation generation, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      epoch.current++;
      void reader.current?.stop();
      preparation.current?.abort();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    setRows([]);
    setScanDates([]);
    baseline.current = structuredClone(data);
    void Promise.all([
      readPatterns(identity),
      mode !== "choose" && mode !== "expiry"
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
    if (!ready || savedIds.length || mode === "choose" || mode === "expiry")
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
        ? "Saved to inventory. Selected shopping items moved together with the groceries. Add package dates now or finish."
        : "Saved to inventory. Add visible package dates now or finish.",
    );
  }
  async function photos(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    if (
      list.length > 8 ||
      list.some((f) => f.size > 12 * 1024 * 1024) ||
      list.reduce((n, f) => n + f.size, 0) > 40 * 1024 * 1024
    )
      throw Error("Choose up to 8 images, under 12 MB each and 40 MB total.");
    const token = ++epoch.current;
    const { LocalPhotoReader } = await import("./recognition");
    reader.current = new LocalPhotoReader((s) => {
      if (alive.current && epoch.current === token) setProgress(s);
    });
    let detected: Draft[] = [],
      read = 0;
    const dates: ScanDate[] = [];
    const errors: string[] = [];
    for (const file of list) {
      if (epoch.current !== token) break;
      setProgress(`Photo ${read + 1}/${list.length}: ${file.name}`);
      try {
        const recognized = await reader.current.read(file);
        if (epoch.current !== token) break;
        const parsed = parsePhotoText(
          recognized.text + "\n" + recognized.barcodes.join("\n"),
          file.name,
          combined,
        );
        detected = [...detected, ...parsed.drafts];
        for (const barcode of [
          ...new Set([...recognized.barcodes, ...parsed.barcodes]),
        ])
          if (!parsed.drafts.some((d) => d.barcode === barcode)) {
            const d = makeDraft("", "photo", combined);
            d.barcode = barcode;
            d.name = "";
            d.sources = [file.name];
            d.review = [
              "Barcode found. Match a saved pattern, look it up online or type the product name.",
            ];
            detected.push(d);
          }
        const itemNames = parsed.drafts.map((d) =>
          normalizeProduct(d.name).name.toLowerCase(),
        );
        for (const candidate of parsed.dates) {
          const matching = data.foods
            .filter((f) => !savedIds.length || savedIds.includes(f.id))
            .filter((f) =>
              itemNames.includes(normalizeProduct(f.name).name.toLowerCase()),
            );
          dates.push({
            ...candidate,
            id: crypto.randomUUID(),
            source: file.name,
            itemId: matching.length === 1 ? matching[0].id : "",
            selected: false,
            dateType: candidate.type ?? "use-by",
          });
        }
        read++;
        setRaw((old) => (old + "\n\n" + recognized.text).slice(-18000));
      } catch (e) {
        errors.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    await reader.current?.stop();
    reader.current = null;
    if (epoch.current !== token || !alive.current) return;
    setFilesRead((n) => n + read);
    setPhotoReady(read > 0);
    setRows((old) => mergeDetections([...old, ...detected]));
    setScanDates((old) => [...old, ...dates]);
    setProgress("");
    setMessage(
      `${read} photos read. ${detected.length} item suggestions and ${dates.length} date candidates. Nothing is saved until you confirm.`,
    );
    if (errors.length) setError(errors.join("\n"));
    if (!detected.length && !dates.length && !errors.length)
      setMessage(
        "No clear labels or dates were recognized. Try close-ups with good light, paste label text below, or add items manually. Overview photos without readable labels cannot reliably identify products.",
      );
  }
  async function setDates() {
    if (!scopeGuard())
      throw Error("Your account or kitchen changed. Reopen the scan.");
    const changes: ExpiryChange[] = scanDates
      .filter((s) => s.selected)
      .map((s) => ({ id: s.itemId, expiry: s.date, dateType: s.dateType }));
    if (!changes.length)
      throw Error("Select a date and inventory item to update.");
    if (changes.some((c) => !c.id))
      throw Error("Match every selected date to an item.");
    await commit(
      assignDates(data, changes, baseline.current),
      "Confirmed package dates saved",
    );
    setScanDates([]);
    baseline.current = structuredClone(data);
    setMessage(
      "Confirmed dates saved. Past dates remain clearly marked in inventory.",
    );
  }
  function parsePasted() {
    const parsed = parsePhotoText(raw, "Pasted label text", combined);
    if (mode === "expiry") {
      setScanDates((old) => [
        ...old,
        ...parsed.dates.map((c) => ({
          ...c,
          id: crypto.randomUUID(),
          itemId: "",
          selected: false,
          dateType: c.type ?? ("use-by" as const),
          source: "Pasted label text",
        })),
      ]);
    } else {
      setRows((old) => mergeDetections([...old, ...parsed.drafts]));
      setScanDates((old) => [
        ...old,
        ...parsed.dates.map((c) => ({
          ...c,
          id: crypto.randomUUID(),
          itemId: "",
          selected: false,
          dateType: c.type ?? ("use-by" as const),
          source: "Pasted label text",
        })),
      ]);
    }
    setMessage(
      `Found ${parsed.drafts.length} products and ${parsed.dates.length} dates. Review before saving.`,
    );
  }
  function cancelScan() {
    epoch.current++;
    void reader.current?.stop();
    reader.current = null;
    preparation.current?.abort();
    setBusy(false);
    setProgress("");
    setMessage("Reading stopped. Existing review items are kept.");
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
  const activeFoods = savedIds.length
    ? data.foods.filter((f) => savedIds.includes(f.id))
    : data.foods;
  return (
    <Modal
      title={
        mode === "choose"
          ? "Add to inventory"
          : mode === "shopping"
            ? "Put away your shopping"
            : mode === "quick"
              ? "Quick add"
              : mode === "photo"
                ? "Import from photos"
                : "Assign package dates"
      }
      close={() => {
        epoch.current++;
        void reader.current?.stop();
        preparation.current?.abort();
        close();
      }}
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
              {
                mode: "photo",
                icon: Camera,
                title: "Import from photos",
                body: "Multiple label, product, barcode or receipt photos.",
              },
              {
                mode: "expiry",
                icon: CalendarDays,
                title: "Scan expiry dates",
                body: "Match package dates to groceries already in your kitchen.",
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
            All additions go through a review. No expiry dates are invented and
            no photos are uploaded to a server.
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
              {savedIds.length > 0 && mode !== "expiry" ? (
                <div className="entry-success">
                  <Check size={30} />
                  <h3>Your groceries are in.</h3>
                  <p>
                    Add visible package dates now, or leave them blank and scan
                    later.
                  </p>
                  <div className="form-actions">
                    <button className="btn secondary" onClick={close}>
                      Done
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => {
                        setMode("expiry");
                        setMessage(
                          "Choose the matching item and confirm each date.",
                        );
                      }}
                    >
                      Scan dates for these items
                    </button>
                  </div>
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
                  {(mode === "photo" || mode === "expiry") && (
                    <section className="photo-entry">
                      <div className="entry-intro">
                        <Camera size={25} />
                        <p>
                          {mode === "expiry"
                            ? "Photograph the printed date closely, ideally with the product name. Select the target item and confirm every date."
                            : "Add up to 8 photos at a time: clear product labels, package sizes, barcodes, receipt lines or overview photos with readable labels. Bare groceries cannot reliably be identified without text."}
                        </p>
                      </div>
                      <p className="entry-privacy">
                        Recognition runs on this device. Only groceries and
                        notes you confirm are shared. First preparation
                        downloads about 9 MB of free tools; they are then cached
                        for offline use. Nothing is added automatically.
                      </p>
                      <div className="entry-upload-actions">
                        <label
                          className={`btn primary ${busy ? "disabled" : ""}`}
                        >
                          <Camera size={18} />
                          Choose multiple photos
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={busy}
                            onChange={(e) => {
                              const files = e.target.files;
                              void run(() => photos(files));
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <label
                          className={`btn secondary ${busy ? "disabled" : ""}`}
                        >
                          <ScanLine size={18} />
                          Take a photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            disabled={busy}
                            onChange={(e) => {
                              const files = e.target.files;
                              void run(() => photos(files));
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      {progress && (
                        <div className="entry-progress" role="status">
                          <RefreshCw size={18} />
                          <span>{progress}</span>
                          <button className="text-btn" onClick={cancelScan}>
                            Stop reading
                          </button>
                        </div>
                      )}
                      <button
                        className="text-btn"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const tools = await import("./recognition");
                            preparation.current = new AbortController();
                            await tools.preparePhotoTools(
                              setProgress,
                              preparation.current.signal,
                            );
                            setPhotoReady(await tools.photoToolsReady());
                            setProgress("");
                          })
                        }
                      >
                        {photoReady
                          ? "Check offline photo tools"
                          : "Prepare offline photo tools"}
                      </button>
                      <p className="muted small">
                        {filesRead
                          ? `${filesRead} photos read this session. `
                          : ""}
                        Clear, flat labels work best. Keep only the relevant
                        date/product in frame. OCR may confuse letters and
                        numbers.
                      </p>
                      <details className="entry-text">
                        <summary>Review or paste recognized label text</summary>
                        <label>
                          Label or receipt text
                          <textarea
                            rows={5}
                            value={raw}
                            maxLength={18000}
                            onChange={(e) => setRaw(e.target.value)}
                            placeholder={"Halfvolle melk 1L\nTHT 07/11/2026"}
                          />
                        </label>
                        <button
                          className="btn secondary"
                          disabled={busy}
                          onClick={parsePasted}
                        >
                          Read pasted text
                        </button>
                      </details>
                      {mode === "photo" && (
                        <>
                          <button
                            className="btn secondary full"
                            disabled={busy}
                            onClick={() =>
                              setRows((old) => [
                                ...old,
                                makeDraft("", "photo", combined),
                              ])
                            }
                          >
                            <Plus size={17} />
                            Add an item manually
                          </button>
                          {scanDates.length > 0 && (
                            <details className="photo-date-candidates" open>
                              <summary>
                                Match date photos to the review (
                                {scanDates.length})
                              </summary>
                              {scanDates.map((s) => (
                                <div className="date-review" key={s.id}>
                                  <p>
                                    <strong>{s.raw}</strong> · {s.source}
                                  </p>
                                  <p className="muted small">{s.reason}</p>
                                  <label>
                                    Review item for this date
                                    <select
                                      value={s.itemId}
                                      onChange={(e) =>
                                        setScanDates((old) =>
                                          old.map((c) =>
                                            c.id === s.id
                                              ? { ...c, itemId: e.target.value }
                                              : c,
                                          ),
                                        )
                                      }
                                    >
                                      <option value="">
                                        Choose a review item
                                      </option>
                                      {rows.map((r, i) => (
                                        <option key={r.id} value={r.id}>
                                          {r.name || `Item ${i + 1}`}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <div className="entry-grid">
                                    <label>
                                      Package date
                                      <input
                                        type="date"
                                        value={s.date}
                                        onChange={(e) =>
                                          setScanDates((old) =>
                                            old.map((c) =>
                                              c.id === s.id
                                                ? { ...c, date: e.target.value }
                                                : c,
                                            ),
                                          )
                                        }
                                      />
                                    </label>
                                    <label>
                                      Package date type
                                      <select
                                        value={s.dateType}
                                        onChange={(e) =>
                                          setScanDates((old) =>
                                            old.map((c) =>
                                              c.id === s.id
                                                ? {
                                                    ...c,
                                                    dateType: e.target
                                                      .value as Food["dateType"],
                                                  }
                                                : c,
                                            ),
                                          )
                                        }
                                      >
                                        <option value="use-by">
                                          Use-by · safety
                                        </option>
                                        <option value="best-before">
                                          Best-before · quality
                                        </option>
                                      </select>
                                    </label>
                                  </div>
                                  <button
                                    className="btn secondary"
                                    disabled={!s.itemId || !s.date}
                                    onClick={() => {
                                      edit(s.itemId, {
                                        expiry: s.date,
                                        dateType: s.dateType,
                                      });
                                      setScanDates((old) =>
                                        old.filter((c) => c.id !== s.id),
                                      );
                                    }}
                                  >
                                    Confirm date for this draft
                                  </button>
                                  <button
                                    className="text-btn"
                                    onClick={() =>
                                      setScanDates((old) =>
                                        old.filter((c) => c.id !== s.id),
                                      )
                                    }
                                  >
                                    Ignore this date
                                  </button>
                                </div>
                              ))}
                            </details>
                          )}
                        </>
                      )}
                      {mode === "expiry" && (
                        <>
                          <p className="muted small">
                            The date’s year is required. Numeric dates are read
                            as day/month/year unless written YYYY-MM-DD. Confirm
                            ambiguous dates and whether the label is use-by or
                            best-before.
                          </p>
                          {scanDates.map((s) => (
                            <article className="date-review" key={s.id}>
                              <label className="entry-checkbox">
                                <input
                                  type="checkbox"
                                  checked={s.selected}
                                  onChange={(e) =>
                                    setScanDates((old) =>
                                      old.map((c) =>
                                        c.id === s.id
                                          ? { ...c, selected: e.target.checked }
                                          : c,
                                      ),
                                    )
                                  }
                                />
                                Apply this date
                              </label>
                              <p>
                                <strong>{s.raw || "Manual date"}</strong> ·{" "}
                                {s.source}
                              </p>
                              <p className="muted small">{s.reason}</p>
                              <label>
                                Match inventory item
                                <select
                                  value={s.itemId}
                                  onChange={(e) =>
                                    setScanDates((old) =>
                                      old.map((c) =>
                                        c.id === s.id
                                          ? { ...c, itemId: e.target.value }
                                          : c,
                                      ),
                                    )
                                  }
                                >
                                  <option value="">
                                    Choose the correct item
                                  </option>
                                  {activeFoods.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.name} · {f.quantity} {f.unit} ·{" "}
                                      {f.location}
                                      {f.expiry ? ` · current ${f.expiry}` : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="entry-grid">
                                <label>
                                  Confirmed expiry date
                                  <input
                                    type="date"
                                    value={s.date}
                                    onChange={(e) =>
                                      setScanDates((old) =>
                                        old.map((c) =>
                                          c.id === s.id
                                            ? { ...c, date: e.target.value }
                                            : c,
                                        ),
                                      )
                                    }
                                  />
                                </label>
                                <label>
                                  Confirmed date type
                                  <select
                                    value={s.dateType}
                                    onChange={(e) =>
                                      setScanDates((old) =>
                                        old.map((c) =>
                                          c.id === s.id
                                            ? {
                                                ...c,
                                                dateType: e.target
                                                  .value as Food["dateType"],
                                              }
                                            : c,
                                        ),
                                      )
                                    }
                                  >
                                    <option value="use-by">
                                      Use-by · safety
                                    </option>
                                    <option value="best-before">
                                      Best-before · quality
                                    </option>
                                  </select>
                                </label>
                              </div>
                              <button
                                className="text-btn"
                                onClick={() =>
                                  setScanDates((old) =>
                                    old.filter((c) => c.id !== s.id),
                                  )
                                }
                              >
                                Remove date candidate
                              </button>
                            </article>
                          ))}
                          <button
                            className="btn secondary full"
                            onClick={() =>
                              setScanDates((old) => [
                                ...old,
                                {
                                  id: crypto.randomUUID(),
                                  raw: "",
                                  date: "",
                                  review: true,
                                  reason:
                                    "Enter the exact date from the package; no date is guessed.",
                                  source: "Manual",
                                  itemId: "",
                                  selected: true,
                                  dateType: "use-by",
                                },
                              ])
                            }
                          >
                            <Plus size={17} />
                            Add a date manually
                          </button>
                          <button
                            className="btn primary full"
                            disabled={
                              busy || !scanDates.some((s) => s.selected)
                            }
                            onClick={() => void run(setDates)}
                          >
                            Save confirmed dates
                          </button>
                        </>
                      )}
                    </section>
                  )}
                  {mode !== "expiry" && rows.length > 0 && (
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
                        dates into different rows. Photos of the same package
                        are not counted twice automatically.
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
                            {r.source === "photo"
                              ? "Detected · needs review"
                              : r.source === "shopping"
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
                          {r.barcode && (
                            <div className="barcode-review">
                              <p>Barcode: {r.barcode}</p>
                              <button
                                className="text-btn"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    const { lookupBarcode } =
                                      await import("./lookup");
                                    const p = await lookupBarcode(r.barcode!);
                                    const suggestion = makeDraft(
                                      p.name + " " + p.quantity,
                                      "photo",
                                      combined,
                                    );
                                    edit(r.id, {
                                      ...suggestion,
                                      id: r.id,
                                      barcode: r.barcode,
                                      sources: r.sources,
                                      review: [
                                        ...suggestion.review,
                                        "Open Food Facts result; confirm product and size.",
                                      ],
                                    });
                                  })
                                }
                              >
                                Look up barcode online
                              </button>
                              <small>
                                Optional: sends only this barcode to Open Food
                                Facts. No photo is sent.
                              </small>
                            </div>
                          )}
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
                  devices. Confirmed package patterns and barcode shortcuts are
                  also saved privately on this device for this account and
                  kitchen. Photos are not stored or uploaded. Unfinished item
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
