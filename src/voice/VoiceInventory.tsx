import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Pause,
  Check,
  ArrowLeft,
  Plus,
  Trash2,
  MessageCircle,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";
import {
  categories,
  locations,
  foodAmount,
  type Data,
  type Food,
} from "../core";
import { normalizeProduct, productKey, sharedPatterns } from "../entry/model";
import { calendarToday } from "./dates";
import {
  interpretInventory,
  type VoiceMode,
  type VoiceItem,
} from "./interpret";
import {
  SpeechSession,
  browserSpeechFactory,
  type SpeechSnapshot,
} from "./speech";
import {
  applyVoiceReview,
  proposedAction,
  reviewInventory,
  type VoiceReview,
} from "./reconcile";
import {
  readVoiceDraft,
  storeVoiceDraft,
  clearVoiceDraft,
  type VoiceDraft,
} from "./storage";
import "./voice.css";
const idle: SpeechSnapshot = {
  status: "idle",
  text: "",
  interim: "",
  pending: "",
  message: "Ready when you are.",
};
const units = [
  "pieces",
  "carton",
  "pack",
  "bottle",
  "loaf",
  "bag",
  "can",
  "container",
  "jar",
  "box",
  "bunch",
  "g",
  "kg",
  "ml",
  "litre",
  "portion",
];
export function VoiceInventory({
  data,
  identity,
  commit,
  scopeGuard,
  close,
  back,
}: {
  data: Data;
  identity: string;
  commit: (data: Data, message?: string) => Promise<void>;
  scopeGuard: () => boolean;
  close: () => void;
  back: () => void;
}) {
  const [speech, setSpeech] = useState(idle),
    [mode, setMode] = useState<VoiceMode>("check"),
    [language, setLanguage] = useState<"nl-NL" | "en-GB">(
      navigator.language.startsWith("nl") ? "nl-NL" : "en-GB",
    ),
    [timeZone, setTimeZone] = useState(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [phase, setPhase] = useState<"capture" | "review">("capture"),
    [rows, setRows] = useState<VoiceReview[]>([]),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [restored, setRestored] = useState(false),
    [resolvedDate, setResolvedDate] = useState(calendarToday()),
    [understood, setUnderstood] = useState(false);
  const baseline = useRef(structuredClone(data)),
    session = useRef<SpeechSession | null>(null),
    alive = useRef(true),
    saveLock = useRef(false),
    persist = useRef(Promise.resolve()),
    latest = useRef<VoiceDraft | null>(null),
    savedRef = useRef(false);
  const factory = useMemo(() => browserSpeechFactory(), []);
  const active = ["starting", "listening", "stopping"].includes(speech.status);
  const patterns = useMemo(() => sharedPatterns(data), [data]);
  const today = calendarToday(new Date(), timeZone);
  const parsed = useMemo(
    () =>
      interpretInventory(speech.text, {
        today,
        mode,
        existing: baseline.current.foods,
        patterns,
      }),
    [speech.text, today, mode, patterns],
  );
  useEffect(() => {
    let valid = true;
    alive.current = true;
    void readVoiceDraft(identity)
      .then((d) => {
        if (!valid) return;
        const text = d?.text ?? "";
        setSpeech({
          ...idle,
          text,
          pending: d?.pending ?? "",
          status: d ? "paused" : "idle",
          message: d
            ? "Your private draft was restored. The microphone is off."
            : idle.message,
        });
        if (d) {
          baseline.current = d.baseline;
          setMode(d.mode);
          setLanguage(d.language);
          setTimeZone(d.timeZone);
          setRows(d.rows);
          setPhase(d.phase);
          setResolvedDate(d.resolvedDate);
          setRestored(true);
        }
        if (factory)
          session.current = new SpeechSession(
            factory,
            (s) => {
              if (alive.current) setSpeech(s);
            },
            text,
          );
        // Restore unconfirmed speech without starting a microphone.
        if (d?.pending && session.current)
          session.current.snapshot = {
            ...session.current.snapshot,
            pending: d.pending,
            status: "paused",
          };
        setReady(true);
      })
      .catch((e) => {
        if (valid) {
          setError((e as Error).message);
          setReady(true);
          if (factory) session.current = new SpeechSession(factory, setSpeech);
        }
      });
    const interrupt = () => {
      if (document.visibilityState === "hidden")
        session.current?.interrupt(
          "Listening stopped while EatFirst was in the background. Resume when you return.",
        );
    };
    const pagehide = () => {
      session.current?.interrupt("Listening interrupted. Your draft is kept.");
      if (latest.current && !savedRef.current)
        void storeVoiceDraft(identity, latest.current);
    };
    const offline = () =>
      session.current?.interrupt(
        "Connection lost. Your transcript is kept. Type offline or resume when connected.",
      );
    document.addEventListener("visibilitychange", interrupt);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("offline", offline);
    return () => {
      valid = false;
      session.current?.dispose();
      session.current = null;
      alive.current = false;
      document.removeEventListener("visibilitychange", interrupt);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("offline", offline);
    };
  }, [identity, factory]);
  useEffect(() => {
    if (!ready || savedRef.current) return;
    const d: VoiceDraft = {
      version: 1,
      text: speech.text,
      pending: speech.pending || speech.interim,
      mode,
      language,
      timeZone,
      phase,
      rows,
      baseline: baseline.current,
      resolvedDate,
    };
    latest.current = d;
    persist.current = persist.current
      .catch(() => undefined)
      .then(() => storeVoiceDraft(identity, d));
    void persist.current.catch(() => {
      if (alive.current)
        setError(
          "Your draft could not be saved on this device. Keep this window open and copy the transcript before leaving.",
        );
    });
  }, [
    ready,
    speech.text,
    speech.pending,
    speech.interim,
    mode,
    language,
    timeZone,
    phase,
    rows,
    identity,
    resolvedDate,
  ]);
  function editText(text: string) {
    setError("");
    if (session.current) session.current.edit(text);
    else setSpeech((s) => ({ ...s, text }));
  }
  function edit(id: string, patch: Partial<VoiceReview>) {
    setRows((old) => old.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  async function finish() {
    const finished = session.current
      ? await session.current.endSegment()
      : speech;
    if (!alive.current) return;
    setError("");
    const text = finished.pending
      ? [finished.text, finished.pending].join("\n")
      : finished.text;
    const result = interpretInventory(text, {
      today,
      mode,
      existing: data.foods,
      patterns,
    });
    if (!result.items.length) {
      setError(
        "No groceries identified yet. Edit the transcript or add an item in the review.",
      );
    }
    baseline.current = structuredClone(data);
    setRows(reviewInventory(result.items, baseline.current, mode));
    setResolvedDate(today);
    setPhase("review");
    setUnderstood(false);
  }
  async function confirm() {
    if (saveLock.current) return;
    saveLock.current = true;
    setBusy(true);
    setError("");
    try {
      if (!scopeGuard())
        throw Error(
          "Your account or kitchen changed. Reopen Talk to EatFirst in the intended kitchen.",
        );
      if (
        calendarToday(new Date(), timeZone) !== resolvedDate &&
        rows.some((r) => r.expirySpoken)
      )
        throw Error(
          "The calendar date changed since this review. Return to the transcript and Finish again to recheck relative dates.",
        );
      const result = applyVoiceReview(data, baseline.current, rows, today);
      await commit(result, "Voice inventory changes saved");
      savedRef.current = true;
      setSaved(true);
      latest.current = null;
      await persist.current.catch(() => undefined);
      await clearVoiceDraft(identity).catch(() => undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saveLock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function discard() {
    session.current?.dispose();
    session.current = null;
    savedRef.current = true;
    await persist.current.catch(() => undefined);
    await clearVoiceDraft(identity);
    close();
  }
  function backToTalk() {
    if (
      rows.length &&
      !window.confirm(
        "Return to the transcript? The next Finish will rebuild this review from your words; manual review edits will be replaced.",
      )
    )
      return;
    setPhase("capture");
    setUnderstood(false);
  }
  if (!ready) return <p role="status">Opening your private voice draft…</p>;
  if (saved)
    return (
      <div className="entry-success">
        <ClipboardCheck size={38} />
        <h3>Your kitchen is up to date.</h3>
        <p>
          Only your confirmed inventory changes and selected shopping
          suggestions were saved. Your transcript was removed from this device’s
          draft.
        </p>
        <button className="btn primary" onClick={close}>
          Done
        </button>
      </div>
    );
  const reviewWarnings =
    (parsed.suggestedMode !== undefined && parsed.suggestedMode !== mode) ||
    parsed.unresolved.length > 0 ||
    speech.pending !== "" ||
    rows.some(
      (r) =>
        r.warnings.length > 0 ||
        r.quantity === null ||
        (r.expiry && r.dateType === "unknown"),
    );
  return (
    <div
      className={`voice-flow ${phase === "capture" ? "voice-capturing" : ""}`}
    >
      {error && (
        <p className="banner danger" role="alert">
          {error}
        </p>
      )}
      {restored && (
        <p className="banner">
          Unsaved draft restored. No inventory changes have been made.
        </p>
      )}
      {phase === "capture" ? (
        <>
          <button className="text-btn" disabled={active} onClick={back}>
            <ArrowLeft size={16} />
            All entry methods
          </button>
          <div className="voice-heading">
            <span className="voice-kicker">A little kitchen check-in</span>
            <h3>You talk. We’ll organize.</h3>
            <p>
              Hesitate, take a look around, change your mind. Your session stays
              open until you tap Finish.
            </p>
          </div>
          <div
            className={`voice-capture ${speech.status === "listening" ? "is-listening" : ""}`}
          >
            <label className="voice-mode-select">
              Inventory mode · {language === "nl-NL" ? "Nederlands" : "English"}
              <select
                aria-label="Inventory mode"
                disabled={active}
                value={mode}
                onChange={(e) => setMode(e.target.value as VoiceMode)}
              >
                <option value="check">Check my stock · replace totals</option>
                <option value="purchase">
                  Add new groceries · new batches
                </option>
              </select>
            </label>
            <button
              className="voice-mic"
              aria-label={
                speech.status === "listening"
                  ? "Pause listening"
                  : speech.status === "starting"
                    ? "Starting microphone"
                    : "Start or resume listening"
              }
              disabled={
                !factory ||
                speech.status === "starting" ||
                speech.status === "stopping" ||
                Boolean(speech.pending)
              }
              onClick={() => {
                if (speech.status === "listening") session.current?.pause();
                else session.current?.start(language);
              }}
            >
              {speech.status === "listening" ? (
                <Pause size={35} />
              ) : factory ? (
                <Mic size={35} />
              ) : (
                <MicOff size={35} />
              )}
            </button>
            <strong role="status">
              {speech.status === "listening"
                ? "Listening…"
                : speech.status === "starting"
                  ? "Starting…"
                  : speech.status === "stopping"
                    ? "Finishing this phrase…"
                    : !factory
                      ? "Use keyboard dictation below"
                      : speech.status === "idle"
                        ? "Tap to start"
                        : "Microphone off · Resume listening"}
            </strong>
            <button
              className="text-btn voice-finish"
              onClick={() => void finish()}
            >
              <Check size={16} />
              Finish session
            </button>
            <p>
              {!factory
                ? "This browser does not offer speech recognition. Tap the transcript and use your keyboard’s microphone, or type naturally."
                : speech.message}
            </p>
            <small>
              Silence never saves or finishes your inventory session.
            </small>
          </div>
          <details className="voice-language-settings">
            <summary>
              {language === "nl-NL" ? "Nederlands" : "English"} · {timeZone} ·
              Change
            </summary>
            <div className="entry-grid voice-options">
              <label>
                Speech language
                <select
                  disabled={active}
                  value={language}
                  onChange={(e) =>
                    setLanguage(e.target.value as typeof language)
                  }
                >
                  <option value="en-GB">English</option>
                  <option value="nl-NL">Nederlands</option>
                </select>
              </label>
              <label>
                Calendar timezone
                <select
                  disabled={active}
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                >
                  {[
                    ...new Set([
                      Intl.DateTimeFormat().resolvedOptions().timeZone,
                      "Europe/Amsterdam",
                      "Europe/London",
                      "UTC",
                    ]),
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <p className="voice-disclosure">
            <AlertCircle size={17} />
            <span>
              Browser speech may send audio to Apple or Google and may need
              internet. EatFirst does not record audio or upload your
              transcript. Interpretation stays on this device.{" "}
              <a
                href="#Privacy"
                onClick={() => {
                  session.current?.dispose();
                  close();
                }}
              >
                Privacy details
              </a>
            </span>
          </p>
          {speech.interim && (
            <p className="voice-interim" aria-live="polite">
              Hearing: {speech.interim}
              <small>Provisional · not yet in the inventory draft</small>
            </p>
          )}
          {speech.pending && (
            <div className="banner">
              <strong>Last phrase needs a check</strong>
              <p>{speech.pending}</p>
              <p>The service stopped before confirming this phrase.</p>
              <div className="form-actions">
                <button
                  className="btn secondary"
                  onClick={() => {
                    if (session.current) session.current.keepPending();
                    else
                      setSpeech((s) => ({
                        ...s,
                        text: [s.text, s.pending].join("\n"),
                        pending: "",
                      }));
                  }}
                >
                  Keep last phrase
                </button>
                <button
                  className="text-btn"
                  onClick={() => {
                    if (session.current) session.current.discardPending();
                    else setSpeech((s) => ({ ...s, pending: "" }));
                  }}
                >
                  Discard last phrase
                </button>
              </div>
            </div>
          )}
          <label className="voice-transcript">
            Your words
            <textarea
              aria-label="Your words"
              rows={5}
              maxLength={18000}
              readOnly={active}
              value={speech.text}
              onChange={(e) => editText(e.target.value)}
              placeholder={
                language === "nl-NL"
                  ? "Ik heb zeven eieren, twee pakken melk en een beetje kaas…"
                  : "I have seven eggs, a carton of milk… actually, two cartons…"
              }
            />
          </label>
          <p className="small muted">
            Pause to edit. On iPhone, tap here and use the keyboard microphone
            if the browser microphone is unavailable. Keep EatFirst open and the
            screen unlocked while speaking.
          </p>
          <div className="voice-detected">
            <div className="section-heading">
              <h3>Recognized so far</h3>
              <MessageCircle size={20} />
            </div>
            {parsed.items.length ? (
              <ul>
                {parsed.items.map((r) => (
                  <li key={r.id}>
                    <strong>{r.name}</strong>
                    <span>
                      {r.quantity === null
                        ? "Quantity unspecified"
                        : `${r.quantity} ${r.unit}`}
                      {r.lowStock ? " · Low stock" : ""}
                      {r.expiry ? ` · ${r.expiry}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                Your groceries will appear here as complete phrases arrive.
                Nothing is saved yet.
              </p>
            )}
          </div>
          {parsed.suggestedMode && parsed.suggestedMode !== mode && (
            <p className="banner">
              Your words sound like{" "}
              {parsed.suggestedMode === "purchase"
                ? "new purchases"
                : "a stock check"}
              . Check the selected mode before finishing.
            </p>
          )}
          <div className="entry-confirm">
            <button
              className="btn secondary"
              onClick={() =>
                void discard().catch((e) => setError((e as Error).message))
              }
            >
              Cancel session
            </button>
            <button className="btn primary" onClick={() => void finish()}>
              <Check size={18} />
              Finish & review
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="text-btn" onClick={backToTalk} disabled={busy}>
            <ArrowLeft size={16} />
            Back to transcript
          </button>
          <div className="voice-heading">
            <span className="voice-kicker">One last look</span>
            <h3>Your kitchen, organized.</h3>
            <p>
              {mode === "check"
                ? "Review updates to what you already have. Existing totals are replaced, not added again."
                : "Review your new purchases. Existing stock stays separate unless you choose to increase a batch."}
            </p>
          </div>
          <p className="small muted">
            Spoken dates resolved for {resolvedDate} in {timeZone}. Unknown date
            types need checking against the package; a date never guarantees
            safety.
          </p>
          {parsed.suggestedMode && parsed.suggestedMode !== mode && (
            <p className="banner">
              Your words suggest{" "}
              {parsed.suggestedMode === "purchase"
                ? "new purchases"
                : "a stock check"}
              , but this review uses{" "}
              {mode === "check" ? "stock totals" : "new purchases"}. Return to
              the transcript to change mode if needed.
            </p>
          )}
          {parsed.unresolved.length > 0 && (
            <div className="banner">
              <strong>Some words need your help</strong>
              <ul>
                {parsed.unresolved.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <p>Add a missing item below or correct the transcript.</p>
            </div>
          )}
          {speech.pending && (
            <p className="banner">
              An unconfirmed last phrase is included in this review: “
              {speech.pending}”. Check every suggested item.
            </p>
          )}
          {rows.map((r, i) => {
            const matches = baseline.current.foods.filter(
                (f) => productKey(f.name) === productKey(r.name),
              ),
              target = baseline.current.foods.find((f) => f.id === r.targetId);
            return (
              <article className="draft-card voice-review-card" key={r.id}>
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
                    aria-label={`Remove voice item ${i + 1}`}
                    onClick={() =>
                      setRows((old) => old.filter((x) => x.id !== r.id))
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <p className="voice-action">
                  {proposedAction(r, baseline.current)}
                </p>
                <label>
                  Item name
                  <input
                    value={r.name}
                    maxLength={100}
                    onChange={(e) =>
                      edit(r.id, {
                        name: e.target.value,
                        action: "choose",
                        targetId: "",
                      })
                    }
                  />
                </label>
                <div className="entry-grid">
                  <label>
                    Quantity (leave blank if unknown)
                    <input
                      type="number"
                      min="0.001"
                      max="1000000"
                      step="any"
                      placeholder="Unspecified"
                      value={r.quantity ?? ""}
                      onChange={(e) =>
                        edit(r.id, {
                          quantity:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Unit
                    <select
                      value={r.unit}
                      onChange={(e) => edit(r.id, { unit: e.target.value })}
                    >
                      {[...new Set([...units, r.unit])].map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <details className="voice-details">
                  <summary>
                    {r.location} · {r.category} · {r.expiry || "No expiry date"}
                    {r.expiry && r.dateType === "unknown"
                      ? " · check date type"
                      : ""}
                  </summary>
                  <div className="entry-grid">
                    <label>
                      Storage
                      <select
                        value={r.location}
                        onChange={(e) =>
                          edit(r.id, {
                            location: e.target.value as Food["location"],
                            locationSpoken: true,
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
                            category: e.target.value as Food["category"],
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
                          edit(r.id, {
                            expiry: e.target.value,
                            expirySpoken: true,
                          })
                        }
                      />
                    </label>
                    <label>
                      Date type
                      <select
                        value={r.dateType}
                        onChange={(e) =>
                          edit(r.id, {
                            dateType: e.target.value as VoiceReview["dateType"],
                            expirySpoken: true,
                          })
                        }
                      >
                        <option value="unknown">
                          Not specified · check label
                        </option>
                        <option value="use-by">Use-by · safety</option>
                        <option value="best-before">
                          Best-before · quality
                        </option>
                      </select>
                    </label>
                  </div>
                </details>
                <label className="entry-checkbox voice-low">
                  <input
                    type="checkbox"
                    checked={r.lowStock ?? target?.lowStock ?? false}
                    onChange={(e) => edit(r.id, { lowStock: e.target.checked })}
                  />
                  Low stock / nearly empty
                </label>
                {(r.lowStock ?? target?.lowStock) && (
                  <label className="entry-checkbox">
                    <input
                      type="checkbox"
                      checked={r.addToShopping}
                      onChange={(e) =>
                        edit(r.id, { addToShopping: e.target.checked })
                      }
                    />
                    Also add {r.name || "this item"} to the shopping list
                  </label>
                )}
                <label>
                  Inventory action
                  <select
                    value={
                      r.action === "new"
                        ? "new"
                        : r.targetId
                          ? `${r.action}:${r.targetId}`
                          : "choose"
                    }
                    onChange={(e) => {
                      const [action, targetId = ""] = e.target.value.split(":");
                      edit(r.id, {
                        action: action as VoiceReview["action"],
                        targetId,
                      });
                    }}
                  >
                    <option value="choose">Choose an action…</option>
                    <option value="new">Add as a new batch</option>
                    {matches.flatMap((f) => [
                      <option key={`replace-${f.id}`} value={`replace:${f.id}`}>
                        Update total: {f.name} · {foodAmount(f)} · {f.location}
                        {f.expiry ? ` · ${f.expiry}` : ""}
                      </option>,
                      <option
                        key={`increase-${f.id}`}
                        value={`increase:${f.id}`}
                      >
                        Add quantity to: {f.name} · {foodAmount(f)}
                      </option>,
                    ])}
                  </select>
                </label>
                {target && (
                  <p className="small muted">
                    Currently {foodAmount(target)} · {target.location}
                    {target.expiry ? ` · ${target.expiry}` : ""}. Unspoken
                    details are kept.
                  </p>
                )}
                {r.warnings.length > 0 && (
                  <details className="voice-warnings">
                    <summary>Needs review · {r.warnings.length} notes</summary>
                    <ul>
                      {r.warnings.map((w, j) => (
                        <li key={j}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </article>
            );
          })}
          <button
            className="btn secondary full"
            disabled={busy}
            onClick={() => {
              const n = normalizeProduct("");
              const item: VoiceItem = {
                id: crypto.randomUUID(),
                name: "",
                quantity: null,
                unit: "pieces",
                category: n.category,
                location: n.location,
                locationSpoken: false,
                expiry: "",
                dateType: "unknown",
                expirySpoken: false,
                lowStock: null,
                warnings: [],
              };
              setRows((old) => [
                ...old,
                ...reviewInventory([item], baseline.current, mode),
              ]);
            }}
          >
            <Plus size={18} />
            Add a missing item
          </button>
          {reviewWarnings && (
            <label className="entry-checkbox voice-ack">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
              />
              I’ve checked uncertain names, amounts, dates and references.
            </label>
          )}
          <div className="entry-confirm">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() =>
                void discard().catch((e) => setError((e as Error).message))
              }
            >
              Cancel session
            </button>
            <button
              className="btn primary"
              disabled={
                busy ||
                !rows.some((r) => r.included) ||
                (reviewWarnings && !understood)
              }
              onClick={() => void confirm()}
            >
              <Check size={18} />
              {busy ? "Saving…" : "Confirm inventory changes"}
            </button>
          </div>
        </>
      )}
      <p className="voice-private small muted">
        Your unfinished transcript stays only on this device for this account
        and kitchen. Cancel session deletes it. Only confirmed inventory and
        selected shopping items synchronize with your family.
      </p>
    </div>
  );
}
