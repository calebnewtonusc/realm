import { describe, expect, it } from "vitest";
import type { AgentProbe } from "../../state/store";
import { failureAction, failureCause } from "./failure-cause";

/** The failure strings one user's agents actually ended turns on (10/13, 7 days, 166 failed turns),
 *  numbers and names as they were, plus Realm's own Gemini sign-in error. */
const SEEN: [string, ReturnType<typeof failureCause>["kind"]][] = [
  ["You've hit your weekly limit · resets 6pm (America/Los_Angeles)", "limit"],
  ["You've hit your weekly limit · resets Oct 16 at 1am (America/Los_Angeles)", "limit"],
  ["Failed to authenticate: OAuth token has expired. Please log in again or contact your administrator.", "sign_in"],
  ["Image 1 size (6.2MB) exceeds API limit (5MB). Please resize the image before sending.", "input"],
  ["Gemini needs you to sign in: This client is no longer supported for Gemini Code Assist for individuals.", "sign_in"],
  ["API Error: 529 Overloaded", "transient"],
  ["Request timed out", "transient"],
  ["Claude ran out of context on this turn", "input"],
];

const probe = (rows: Partial<AgentProbe>[]): AgentProbe[] =>
  rows.map((r) => ({ kind: "claude", available: true, loggedIn: null, reason: null, version: null, ...r }) as AgentProbe);

describe("failureCause", () => {
  it.each(SEEN)("reads %s as %s", (message, kind) => expect(failureCause(message).kind).toBe(kind));
  it("reads an image over the size cap as a message to change, though it says 'limit'", () => {
    // Mutant: limit checked before input, which offers another agent the same oversized image.
    expect(failureCause("Image 1 size (6.2MB) exceeds API limit (5MB).").kind).toBe("input");
  });
});

describe("failureAction", () => {
  const both = probe([{ kind: "claude" }, { kind: "codex" }, { kind: "acp:gemini", loggedIn: false }]);
  it("sends a limited agent's question to another ready agent, never 'Try again'", () => {
    // Mutant: retry on every failure, which on the weekly limit is a button that cannot work.
    expect(failureAction(failureCause("You've hit your weekly limit · resets 6pm"), "claude", both, "claude"))
      .toEqual({ kind: "ask_other", agentKind: "codex", label: "Ask Codex instead" });
  });
  it("treats a signed-out agent as stuck whatever its error said", () => {
    expect(failureAction(failureCause("Gemini did not answer initialize within 10000ms"), "acp:gemini", both, "acp:gemini"))
      .toEqual({ kind: "ask_other", agentKind: "claude", label: "Ask Claude instead" });
  });
  it("offers Try again for a blip, nothing for a message that must change, nothing when no agent can take it", () => {
    expect(failureAction(failureCause("API Error: 529 Overloaded"), "claude", both, null)).toEqual({ kind: "retry", label: "Try again" });
    expect(failureAction(failureCause("Claude ran out of context on this turn"), "claude", both, null)).toBeNull();
    expect(failureAction(failureCause("You've hit your weekly limit"), "claude", probe([{ kind: "claude" }]), null)).toBeNull();
  });
});
