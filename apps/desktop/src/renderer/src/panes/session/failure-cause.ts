import { AGENT_META, type AgentKind } from "@realm/contracts";
import { agentAvailability, isBlocked } from "../../state/agent-availability";
import type { AgentProbe } from "../../state/store";

/**
 * Why a turn failed, from the reader's side: the four answers that each call for a different next
 * move, plus the honest catch-all.
 *
 * - `limit`: a usage, rate or quota window closed. Sending the same thing to the same agent fails
 *   again until it reopens, so "Try again" would be a button that cannot work.
 * - `sign_in`: the agent needs credentials. Same: retrying here is pointless.
 * - `input`: the message itself was refused (too large, out of context). It has to change first.
 * - `transient`: the service or the network blinked. Asking again is the fix.
 * - `unknown`: none of the above matched. Asking again is the cheapest thing to try, and it is what
 *   the transcript's Retry already offered.
 *
 * Plain matching, not a model: the failure strings are few and fixed. Measured 10/13 on one user's
 * 166 failed turns over 7 days: 161 were "You've hit your weekly limit · resets …", 4 an image over
 * the size cap, 1 an expired sign-in, so a card that only offered "Try again" was wrong on 166 of 166.
 */
export type FailureCause =
  | { kind: "limit" }
  | { kind: "sign_in" }
  | { kind: "input" }
  | { kind: "transient" }
  | { kind: "unknown" };

const LIMIT =
  /\b(hit your (weekly|session|daily|usage)? ?limit|usage limit|rate limit|quota|exhausted your capacity|limit reached|resets? (at|on|in)\b)/i;
const SIGN_IN =
  /\b(sign(ed)? in|log ?in|logged out|re-?authenticate|failed to authenticate|authentication|unauthori[sz]ed|token (has )?expired|credentials? (expired|missing|invalid))/i;
const INPUT =
  /\b(exceeds|too large|too long|resize the image|out of context|context (window|length)|prompt is too long|ran out of context)\b/i;
const TRANSIENT =
  /\b(overloaded|529|5\d\d\b|internal server error|timed? ?out|timeout|ECONNRESET|ETIMEDOUT|socket hang up|network|temporarily|try again later|service unavailable|bad gateway)\b/i;

export function failureCause(message: string): FailureCause {
  // Input first: "exceeds API limit" names a limit but is a message to shrink, not a window to wait out.
  if (INPUT.test(message)) return { kind: "input" };
  if (LIMIT.test(message)) return { kind: "limit" };
  if (SIGN_IN.test(message)) return { kind: "sign_in" };
  if (TRANSIENT.test(message)) return { kind: "transient" };
  return { kind: "unknown" };
}

/** The one thing the failure card offers, or null when nothing here can help (the message must
 *  change, or no other agent is ready to take it). */
export type FailureAction =
  | { kind: "retry"; label: string }
  | { kind: "ask_other"; agentKind: AgentKind; label: string };

/** The agents tried, in order, when the failed one cannot take the question: the one used last, then
 *  the two harnesses Realm ships first-class adapters for. */
const FALLBACKS: AgentKind[] = ["claude", "codex"];

export function failureAction(
  cause: FailureCause,
  failed: AgentKind,
  probe: AgentProbe[],
  lastAgent: AgentKind | null,
): FailureAction | null {
  // The agent's own probe outranks the words: a signed-out agent cannot answer whatever its error said.
  const stuck =
    cause.kind === "limit" ||
    cause.kind === "sign_in" ||
    isBlocked(agentAvailability(failed, probe));
  if (!stuck)
    return cause.kind === "input"
      ? null
      : { kind: "retry", label: "Try again" };
  for (const kind of [lastAgent, ...FALLBACKS]) {
    if (!kind || kind === failed) continue;
    const a = agentAvailability(kind, probe);
    // `unknown` counts as ready, as the prompter does: never withhold a working path on a guess.
    if (!isBlocked(a) && probe.some((p) => p.kind === kind))
      return {
        kind: "ask_other",
        agentKind: kind,
        label: `Ask ${AGENT_META[kind].label} instead`,
      };
  }
  return null;
}
