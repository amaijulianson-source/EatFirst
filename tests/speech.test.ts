import { describe, it, expect, vi, afterEach } from "vitest";
import {
  SpeechSession,
  type RecognitionEngine,
  type RecognitionEvent,
} from "../src/voice/speech";
class FakeEngine implements RecognitionEngine {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onaudioend: (() => void) | null = null;
  onresult: ((event: RecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  result(values: [string, boolean][]) {
    this.onresult?.({
      resultIndex: 0,
      results: values.map(([transcript, isFinal]) => ({
        isFinal,
        length: 1,
        0: { transcript },
      })),
    });
  }
}
function setup(initial = "") {
  const engines: FakeEngine[] = [];
  const changed = vi.fn();
  const session = new SpeechSession(
    () => {
      const e = new FakeEngine();
      engines.push(e);
      return e;
    },
    changed,
    initial,
  );
  return { session, engines, changed };
}
afterEach(() => vi.useRealTimers());
describe("speech capture lifecycle, independently of inventory interpretation", () => {
  it("accumulates finalized segments and resumes after a service end", () => {
    const { session, engines } = setup();
    session.start("en-GB");
    engines[0].result([["seven eggs", true]]);
    engines[0].onend?.();
    expect(session.snapshot).toMatchObject({
      status: "paused",
      text: "seven eggs",
    });
    session.start("nl-NL");
    engines[1].result([["twee pakken melk", true]]);
    expect(session.snapshot.text).toBe("seven eggs\ntwee pakken melk");
    expect(engines[1].lang).toBe("nl-NL");
    session.dispose();
  });
  it("does not duplicate repeated result events or interim revisions", () => {
    const { session, engines } = setup();
    session.start("en-GB");
    engines[0].result([
      ["seven eggs", true],
      ["two", false],
    ]);
    engines[0].result([
      ["seven eggs", true],
      ["two cartons", false],
    ]);
    expect(session.snapshot.text).toBe("seven eggs");
    expect(session.snapshot.interim).toBe("two cartons");
    engines[0].result([
      ["seven eggs", true],
      ["two cartons of milk", true],
    ]);
    expect(session.snapshot.text).toBe("seven eggs\ntwo cartons of milk");
    session.dispose();
  });
  it("does not finish or discard the session during 15 seconds of silence", () => {
    vi.useFakeTimers();
    const { session, engines } = setup();
    session.start("en-GB");
    engines[0].result([["seven eggs", true]]);
    vi.advanceTimersByTime(15000);
    expect(session.snapshot.status).toBe("listening");
    expect(session.snapshot.text).toBe("seven eggs");
    engines[0].result([
      ["seven eggs", true],
      ["some cheese", true],
    ]);
    expect(session.snapshot.text).toContain("some cheese");
    session.dispose();
  });
  it("shows microphone off immediately on audio end and preserves unfinished speech", () => {
    const { session, engines } = setup();
    session.start("en-GB");
    engines[0].result([
      ["seven eggs", true],
      ["cheese expires", false],
    ]);
    engines[0].onaudioend?.();
    expect(session.snapshot).toMatchObject({
      status: "paused",
      text: "seven eggs",
      pending: "cheese expires",
    });
    session.start("en-GB");
    expect(engines).toHaveLength(1);
    session.keepPending();
    session.start("en-GB");
    expect(engines).toHaveLength(2);
    session.dispose();
  });
  it.each([
    "network",
    "not-allowed",
    "service-not-allowed",
    "audio-capture",
    "no-speech",
    "language-not-supported",
  ])(
    "handles %s without losing finalized text or claiming active listening",
    (error) => {
      const { session, engines } = setup();
      session.start("en-GB");
      engines[0].result([["seven eggs", true]]);
      engines[0].onerror?.({ error });
      expect(session.snapshot.status).toBe("error");
      expect(session.snapshot.text).toBe("seven eggs");
      expect(session.snapshot.message.length).toBeGreaterThan(20);
      expect(engines[0].abort).toHaveBeenCalled();
      session.dispose();
    },
  );
  it("handles background interruptions and ignores late callbacks", () => {
    const { session, engines } = setup();
    session.start("en-GB");
    engines[0].result([["seven eggs", true]]);
    const late = engines[0].onresult;
    session.interrupt("Backgrounded");
    late?.({
      resultIndex: 0,
      results: [
        { isFinal: true, length: 1, 0: { transcript: "late unwanted text" } },
      ],
    });
    expect(session.snapshot).toMatchObject({
      status: "paused",
      text: "seven eggs",
    });
    expect(engines[0].abort).toHaveBeenCalled();
    session.dispose();
  });
  it("times out a service that never actually starts", () => {
    vi.useFakeTimers();
    const engine = new FakeEngine();
    engine.start = vi.fn();
    const session = new SpeechSession(
      () => engine,
      () => undefined,
    );
    session.start("en-GB");
    expect(session.snapshot.status).toBe("starting");
    vi.advanceTimersByTime(10001);
    expect(session.snapshot.status).toBe("error");
    expect(engine.abort).toHaveBeenCalled();
    session.dispose();
  });
  it("cleans up after a thrown start and permits a manual retry", () => {
    const e = new FakeEngine();
    e.start = vi.fn(() => {
      throw Error("busy");
    });
    const session = new SpeechSession(
      () => e,
      () => undefined,
      "saved words",
    );
    session.start("en-GB");
    expect(session.snapshot.status).toBe("error");
    expect(session.snapshot.text).toBe("saved words");
    session.dispose();
  });
  it("Finish explicitly stops the microphone and flushes the segment", async () => {
    const { session, engines } = setup();
    session.start("en-GB");
    engines[0].result([["seven eggs", true]]);
    const ended = await session.endSegment();
    expect(ended).toMatchObject({ text: "seven eggs", status: "paused" });
    expect(engines[0].stop).toHaveBeenCalled();
    session.dispose();
  });
  it("can edit finalized speech while paused and cancel without retaining a microphone", () => {
    const { session, engines } = setup();
    session.start("en-GB");
    engines[0].result([["two tomatoes", true]]);
    session.pause();
    session.edit("four tomatoes");
    expect(session.snapshot.text).toBe("four tomatoes");
    session.start("en-GB");
    session.dispose();
    expect(engines[1].abort).toHaveBeenCalled();
    expect(engines[1].onresult).toBeNull();
  });
  it("aborts a stopping service that never sends end", async () => {
    vi.useFakeTimers();
    const { session, engines } = setup();
    session.start("en-GB");
    engines[0].stop = vi.fn();
    const ended = session.endSegment();
    await vi.advanceTimersByTimeAsync(1600);
    expect((await ended).status).toBe("paused");
    expect(engines[0].abort).toHaveBeenCalled();
    session.dispose();
  });
});
