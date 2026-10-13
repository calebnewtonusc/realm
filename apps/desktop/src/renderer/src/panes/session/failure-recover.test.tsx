import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Transcript } from "./Transcript";
import type { Block, Transcript as TranscriptModel } from "./transcript-model";

afterEach(cleanup);
const model = (blocks: Block[]): TranscriptModel =>
  ({ blocks, run: null, pendingPermissions: [], usage: { costUsd: 0, inputTokens: 0, outputTokens: 0, numTurns: 0 }, init: null, feedback: {}, summary: null, promptHint: null });
const user = (text: string, ts: number): Block => ({ kind: "user", text, ts } as Block);

/** The failure card's one way out (failure-cause.ts), drawn by the transcript on the right card only. */
const failed = (...after: Block[]) => model([
  user("Hello", 1),
  { kind: "error", message: "You've hit your weekly limit · resets 6pm", ts: 2 },
  ...after,
]);

describe("the failed turn's action", () => {
  it("sits on the failure that ended the log and runs what it names", () => {
    const run = vi.fn();
    render(<Transcript transcript={failed()} sessionStatus="idle" onDecide={() => {}} recover={{ label: "Ask Codex instead", run }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Codex instead" }));
    expect(run).toHaveBeenCalledOnce();
  });
  it("is not drawn on an older failure the session has moved past, nor while a turn is in flight", () => {
    // Mutant: the button on every error card, where it would act on the newest turn from an old one.
    const later = failed(user("And now?", 3), { kind: "assistant", messageId: "m", text: "Here.", streaming: false, ts: 4 });
    const { unmount } = render(<Transcript transcript={later} sessionStatus="idle" onDecide={() => {}} recover={{ label: "Try again", run: () => {} }} />);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    unmount();
    render(<Transcript transcript={failed()} sessionStatus="running" onDecide={() => {}} recover={{ label: "Try again", run: () => {} }} />);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
