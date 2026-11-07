# Talk to EatFirst

## Daily use

Inventory → Add food → **Talk to EatFirst** is the primary entry choice. Manual Quick add and shopping-trip transfer remain. Pick one of two explicit modes:

- **Check what I have:** a spoken count is a current total, not an increment. A unique existing match is proposed for update; multiple batches or mismatched units require choosing. Unspoken quantities, dates, notes, prices and storage remain intact.
- **Add new groceries:** purchases are proposed as separate new batches. You can explicitly increase a compatible existing batch instead. A different expiry requires a new batch. Spoken intent is suggested, never silently used to change the chosen mode.

Choose **English** or **Nederlands**, then tap the microphone. The browser permission prompt and speech engine control availability. Recognition languages are selected explicitly; automatic bilingual switching is not promised.

Complete phrases appear in **Your words** and **Recognized so far**. Interim results are separately labelled provisional and never repeatedly counted. Pause/resume retains preceding segments. Silence, service errors and microphone interruption never finish the user's inventory session. When the browser ends a recognition run, the app shows **Microphone off · Resume listening**. It does not pretend `continuous: true` prevents silence timeouts or silently loop microphone permissions. Only the user’s Finish action opens final review; only Confirm changes inventory.

If the last phrase was not finalized, it remains visible as unconfirmed. Keep, discard or correct it. Finish includes it with an explicit review warning. Start-up has a 10-second failure watchdog; stop has a 1.5-second fallback abort. There is no silence timer. Backgrounding, page hiding and offline events stop capture deliberately. Keep the screen unlocked and the app foregrounded. Calls, OS termination and speech not delivered by the service cannot be recovered as audio: the app does not make recordings.

If the browser microphone is unavailable, use **Your words** with the phone keyboard’s dictation microphone, or type naturally. Keyboard dictation is a deliberate accessible fallback, not claimed as app-controlled continuous recording. It follows the phone's privacy/language settings. iPhone home-screen speech support varies by WebKit/OS configuration; an exposed JavaScript constructor alone does not prove a working service. If needed, open the existing site in Safari with Siri/Dictation enabled. Avoid embedded in-app browsers. There is no requirement to clear storage or reinstall.

## Interpretation and corrections

`src/voice/interpret.ts` is a deterministic local interpreter. It separates food entity spans, spoken amount/unit normalization, date qualifiers, low-stock conditions, storage and conversation focus. Entity boundaries work without commas. A bounded grammar and existing grocery names/recipe aliases support common Dutch/English conversations; no remote LLM or human-level understanding is claimed.

Examples covered by executed transcript tests:

- “Seven eggs … one pack of milk … cheese good until the seventh of November … ketchup almost finished … two tomatoes … actually four tomatoes … another carton of milk” → eggs 7, milk 2 cartons, unspecified cheese/date, low-stock ketchup, tomatoes 4.
- “Four apples, no actually six” replaces four with six.
- “Two bottles of water and another bottle” totals three bottles.
- “Milk … actually make that oat milk” corrects identity while retaining a spoken count.
- “Two milk cartons. One of those is almost empty” retains two and records low stock.
- “Ik heb zeven eieren, twee pakken melk en een beetje kaas” preserves Dutch product identities and leaves the cheese amount unknown.

Repeated mentions are not automatically summed. Explicit additional amounts are summed only when units agree and the prior count is known. An additional package can target a unique earlier matching unit. Ambiguous references and unrecognized wording are surfaced for correction; unknown products can be added manually in review or recognized from existing household names. This is not arbitrary open-domain language understanding. A transcription error is not magically corrected by the inventory parser.

No package becomes an invented weight/volume. A few/some/een beetje is not a precise count. The legacy data format requires a positive numeric quantity: new unspecified stock uses a non-convertible `unspecified` unit with `quantityUnknown: true`. UI displays **Quantity unspecified**; recipe checks require verification and do not allocate the internal presence sentinel as a real count. Whole-item use/discard remains possible; partial deductions need a known amount first. Old clients may not understand the new optional UI flags; update family devices before editing these records in an older cached version.

## Dates, stock and safety

Relative dates use the selected calendar timezone (device timezone by default; Europe/Amsterdam is selectable). Calendar arithmetic handles DST/month/year boundaries without UTC off-by-one shifts. English/Dutch weekdays, named months, ordinals, tomorrow/morgen and “another three days” are supported. “Next weekday” means the next occurrence, including seven days ahead if today has that name, and is explicitly flagged for date confirmation. Missing years use the current calendar year; a date in the past is shown as past rather than silently pushed into next year. A missing month uses the current month and requires confirmation. Numeric dates use day/month with a warning. Impossible or incomplete dates do not clear an existing expiry.

Only explicit use-by/te gebruiken tot or best-before/ten minste houdbaar sets a known type. Otherwise `dateTypeUnconfirmed` is displayed. For backwards compatibility the internal type is conservatively `use-by`; it is never presented as a verified use-by claim. Past unconfirmed dates are excluded from recipe use. Dates and storage suggestions do not establish safety. Review full dates and package labels.

`lowStock` is an optional boolean carried in the existing inventory JSON, displayed in Inventory and editable in ordinary food editing. It never replaces a known quantity with an invented near-empty amount. Review offers an unchecked **Also add to the shopping list** option; no shopping suggestion is applied automatically.

## Review, consistency and privacy

Review supports rename/count/unit changes, storage/category/date editing, low-stock toggles, removal, missing items and explicit new/replace/increase choices. Existing batches are shown with their amounts/dates. Returning to the transcript rebuilds the review from words after a clear warning about manual review edits. Re-finishing uses current inventory as a fresh baseline; confirmation compares that baseline to current records. A stale batch fails atomically. Existing family operation IDs, membership checks, per-record conflict handling, offline queues and idempotent server application remain intact. New review rows also retain fixed IDs to prevent accidental retry duplication.

No schema/table/policy migration is required. No real household or account is deleted, reset or rewritten by release tooling. Optional flags are validated locally, survive grocery backups, and round-trip through the existing JSON payload/RPC. Existing product patterns and V1 migration remain. Shared records contain only confirmed inventory and explicitly selected shopping suggestions—not transcripts, audio, recognition state or parser warnings.

Unfinished transcripts/reviews are stored in existing IndexedDB caches per account and kitchen. They are local browser data, not an encrypted vault. They are removed on successful confirmation or Cancel session; closing merely preserves a draft. Speech is always stopped on component cleanup. Browser clearing/eviction can erase drafts; no zero-loss promise is made for an OS killing the process before a pending storage write completes. No private API key, paid transcription/AI API, billing activation or audio storage is introduced.

## Technology research and selection

| Approach                        | Relevant capability and limitation                                                                                                                                                                                                             | Decision                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Browser Web Speech recognition  | Native language service; streaming final/interim events; `continuous` does not guarantee uninterrupted capture. Safari uses Apple's speech engine; some browsers send audio to a vendor. Runtime service support can differ from API exposure. | Selected with explicit segmented recovery, accurate active/off states, language selector and editable fallback. No EatFirst API bill. |
| OS keyboard dictation           | Works through an ordinary editable transcript when available; app cannot control its microphone lifecycle or long-pause limits.                                                                                                                | Supported fallback; parsing/review remains the same.                                                                                  |
| MediaRecorder                   | Captures audio but does not transcribe it. Background/lock behavior and codecs vary. A second recognizer/service would still be needed.                                                                                                        | Not selected: recording alone would create a misleading voice feature and retain sensitive audio without solving recognition.         |
| Whisper on device               | Multilingual, MIT; ONNX tiny q8 encoder ~10.1 MB + merged decoder ~30.7 MB, plus runtime/tokenizers. Real-time factor, memory and Dutch grocery accuracy on physical iPhone were not established.                                              | Not shipped as an unverified dependency/download. Possible future opt-in offline transcription after physical benchmarks.             |
| Vosk on device                  | Apache-licensed small English model reported ~40 MB; upstream says small models typically need around 300 MB RAM. Language-specific models/accuracy differ; no physical iPhone benchmark performed here.                                       | Not selected for this release. A model name/size is not evidence of usable mobile transcription.                                      |
| Local generative language model | Requires additional model downloads/memory and can hallucinate products, counts or safety details.                                                                                                                                             | Bounded local rules/context and mandatory review selected. No unsupported general-language claim.                                     |

Primary sources consulted November 2026:

- [WebKit: Safari speech recognition and Siri/Dictation prerequisite](https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/).
- [WebKit issue: exposed speech API and home-screen availability](https://bugs.webkit.org/show_bug.cgi?id=225298), [audio-session interruption issue](https://bugs.webkit.org/show_bug.cgi?id=321436). Reports concern particular versions/configurations, not universal current-device results.
- [MDN SpeechRecognition, including service privacy](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [continuous](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/continuous), [end event](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/end_event), [experimental local processing](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally).
- [WebKit MediaRecorder support](https://webkit.org/blog/11353/mediarecorder-api/), [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder).
- [Whisper browser implementation limitations](https://github.com/ggml-org/whisper.cpp/blob/master/examples/whisper.wasm/README.md), [ONNX tiny files and actual sizes](https://huggingface.co/onnx-community/whisper-tiny/tree/main/onnx), [upstream Whisper license](https://github.com/openai/whisper/blob/main/LICENSE).
- [Vosk model sizes, licenses and memory guidance](https://alphacephei.com/vosk/models).

Physical iPhone microphone recognition, Siri permissions, installed-mode capture, calls, screen locking, battery use and actual recognition accuracy need real-device verification. Automated fake speech events exercise the app's lifecycle; they are explicitly not evidence that Apple's/Google's transcription service successfully heard a real person.
