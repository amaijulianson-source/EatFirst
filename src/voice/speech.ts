export type SpeechStatus =
  "idle" | "starting" | "listening" | "stopping" | "paused" | "error";
export type SpeechSnapshot = {
  status: SpeechStatus;
  text: string;
  interim: string;
  pending: string;
  message: string;
};
export type RecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
};
export type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};
export interface RecognitionEngine {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onaudioend: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionFactory = () => RecognitionEngine;
export function browserSpeechFactory(): RecognitionFactory | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionEngine;
    webkitSpeechRecognition?: new () => RecognitionEngine;
  };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? () => new C() : null;
}
const errors: Record<string, string> = {
  "not-allowed":
    "Microphone or speech permission was denied. Allow it in browser settings, or use keyboard dictation below.",
  "service-not-allowed":
    "Speech recognition is unavailable here. On iPhone, try Safari with Siri/Dictation enabled, or use keyboard dictation below.",
  "audio-capture":
    "The microphone is unavailable. Check other apps and permissions, then resume or use keyboard dictation.",
  network:
    "The speech service lost its connection. Your transcript is kept. Resume when online, or type below.",
  "no-speech":
    "No speech was received. Your session is still open; tap Resume listening when ready.",
  "language-not-supported":
    "This speech service does not support the chosen language. Try the other language or keyboard dictation.",
  aborted:
    "Listening was interrupted. Your transcript is kept; tap Resume listening when ready.",
};
/** Each browser recognition run is a segment of the user-controlled session.
 * Silence/end/error NEVER finishes the inventory session. No unbounded restart loop.
 */
export class SpeechSession {
  snapshot: SpeechSnapshot = {
    status: "idle",
    text: "",
    interim: "",
    pending: "",
    message: "",
  };
  private engine: RecognitionEngine | null = null;
  private generation = 0;
  private base = "";
  private finals = new Map<number, string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  constructor(
    private factory: RecognitionFactory,
    private changed: (snapshot: SpeechSnapshot) => void,
    initial = "",
  ) {
    this.snapshot.text = initial;
  }
  private publish(patch: Partial<SpeechSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.changed({ ...this.snapshot });
  }
  edit(text: string) {
    if (
      this.snapshot.status === "listening" ||
      this.snapshot.status === "starting" ||
      this.snapshot.status === "stopping"
    )
      return;
    this.publish({ text, pending: "", interim: "" });
  }
  keepPending() {
    if (this.snapshot.pending) {
      this.publish({
        text: [this.snapshot.text, this.snapshot.pending]
          .filter(Boolean)
          .join("\n"),
        pending: "",
        message:
          "Last phrase kept for your review. Check that it was heard correctly.",
      });
    }
  }
  start(lang: string) {
    if (this.disposed || this.engine) return;
    // Pending speech must be deliberately retained/discarded before another run.
    if (this.snapshot.pending) {
      this.publish({
        message: "Keep or discard the last unconfirmed phrase before resuming.",
      });
      return;
    }
    const token = ++this.generation;
    this.base = this.snapshot.text;
    this.finals.clear();
    let engine: RecognitionEngine;
    try {
      engine = this.factory();
    } catch {
      this.publish({
        status: "error",
        message:
          "Speech recognition could not start. Use keyboard dictation or type below.",
      });
      return;
    }
    this.engine = engine;
    engine.lang = lang;
    engine.continuous = true;
    engine.interimResults = true;
    engine.maxAlternatives = 1;
    const current = () => !this.disposed && token === this.generation;
    engine.onstart = () => {
      if (current()) {
        clearTimeout(this.timer);
        this.publish({
          status: "listening",
          message:
            "Listening. Take your time; only Finish opens the final review.",
        });
      }
    };
    engine.onresult = (event) => {
      if (!current()) return;
      const interim: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i],
          text = result[0]?.transcript?.trim() ?? "";
        if (result.isFinal) this.finals.set(i, text);
        else if (text) interim.push(text);
      }
      const text = [
        this.base,
        ...[...this.finals].sort((a, b) => a[0] - b[0]).map(([, s]) => s),
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 18000);
      this.publish({ text, interim: interim.join(" ").slice(0, 4000) });
      if (text.length >= 18000)
        this.pause(
          "Transcript limit reached. Finish this review before starting another session.",
        );
    };
    engine.onerror = (event) => {
      if (!current()) return;
      clearTimeout(this.timer);
      this.publish({
        status: "error",
        message:
          errors[event.error] ??
          "Speech recognition stopped unexpectedly. Your transcript is kept; resume or type below.",
      });
      this.endEngine(engine);
    };
    engine.onaudioend = () => {
      if (current()) {
        this.publish({
          status: "paused",
          message:
            "Microphone stopped. Your session is still open. Tap Resume listening to continue.",
        });
        this.stopEngine(engine);
      }
    };
    engine.onend = () => {
      if (!current()) return;
      clearTimeout(this.timer);
      clearTimeout(this.stopTimer);
      this.engine = null;
      this.publish({
        status: this.snapshot.status === "error" ? "error" : "paused",
        interim: "",
        pending: this.snapshot.interim || this.snapshot.pending,
        message:
          this.snapshot.status === "error"
            ? this.snapshot.message
            : "Listening paused. Your words are kept. Tap Resume listening to continue.",
      });
    };
    this.publish({
      status: "starting",
      interim: "",
      message: "Waiting for microphone permission…",
    });
    this.timer = setTimeout(() => {
      if (current() && this.snapshot.status === "starting") {
        this.publish({
          status: "error",
          message:
            "The speech service did not start. Try Safari with Siri/Dictation enabled, or use keyboard dictation below.",
        });
        this.endEngine(engine);
      }
    }, 10000);
    try {
      engine.start();
    } catch {
      clearTimeout(this.timer);
      this.engine = null;
      this.publish({
        status: "error",
        message:
          "Speech could not start. Tap Resume listening or use keyboard dictation.",
      });
    }
  }
  private stopEngine(engine: RecognitionEngine) {
    try {
      engine.stop();
    } catch {
      this.endEngine(engine);
      return;
    }
    clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => this.endEngine(engine), 1500);
  }
  private endEngine(engine: RecognitionEngine) {
    if (this.engine !== engine) return;
    clearTimeout(this.timer);
    clearTimeout(this.stopTimer);
    this.generation++;
    engine.onresult = null;
    engine.onstart = null;
    engine.onerror = null;
    engine.onend = null;
    engine.onaudioend = null;
    try {
      engine.abort();
    } catch {
      /* Already ended. */
    }
    this.engine = null;
    this.publish({
      status: this.snapshot.status === "error" ? "error" : "paused",
      pending: this.snapshot.interim || this.snapshot.pending,
      interim: "",
    });
  }
  async endSegment(): Promise<SpeechSnapshot> {
    if (!this.engine) return { ...this.snapshot };
    this.pause();
    await new Promise<void>((resolve) => {
      const check = () => {
        if (!this.engine) resolve();
        else setTimeout(check, 25);
      };
      check();
    });
    return { ...this.snapshot };
  }
  pause(message = "Listening paused. Your words are kept.") {
    if (!this.engine) return;
    this.publish({ status: "stopping", message });
    this.stopEngine(this.engine);
  }
  interrupt(message: string) {
    if (this.engine) {
      this.publish({ status: "paused", message });
      this.endEngine(this.engine);
    }
  }
  discardPending() {
    this.publish({
      pending: "",
      message:
        "Unconfirmed phrase discarded. You can repeat it or edit the transcript.",
    });
  }
  dispose() {
    if (this.disposed) return;
    if (this.engine) this.endEngine(this.engine);
    clearTimeout(this.timer);
    clearTimeout(this.stopTimer);
    this.disposed = true;
  }
}
