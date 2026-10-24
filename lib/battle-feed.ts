import { GRACE_MS, type Asked, type BattleEvent, type BattleResult, type BattleView, type MoveOption } from "@/lib/battle-types";
import type { Slot } from "@/lib/types";

// Client-side ordering of battle steps (spec §9.4) and the countdown clock (§10.3).
// Pure: the battle screen acts on what these return.

export type StepEvent = Extract<BattleEvent, { kind: "battle-step" }>;

/** A step's lines to play. `exact`: your own lines (your HP exact), not the public ones. */
export type StepLines = { step: number; lines: string[]; exact: boolean };

const isSlot = (v: unknown): v is Slot => v === 1 || v === 2;
const isAsked = (v: unknown): v is Asked => v === null || v === "team" || v === "move" || v === "switch";
const isInt = (v: unknown): v is number => Number.isInteger(v);

function parseResult(v: unknown): BattleResult | null | undefined {
  if (v === null) return null;
  const r = v as { winner?: unknown; reason?: unknown } | undefined;
  if (!r || (r.winner !== null && !isSlot(r.winner))) return undefined;
  if (r.reason !== "normal" && r.reason !== "forfeit" && r.reason !== "abandoned") return undefined;
  return { winner: r.winner, reason: r.reason };
}

/** A `battle-step` event in an Ably message's data, or null. */
export function parseBattleStep(data: unknown): StepEvent | null {
  const d = data as Record<string, unknown> | null;
  if (d?.kind !== "battle-step" || !isInt(d.step) || d.step < 1 || !isInt(d.at)) return null;
  if (d.lines !== null && !(Array.isArray(d.lines) && d.lines.every((l) => typeof l === "string"))) return null;
  const asked = d.asked as Record<string, unknown> | undefined;
  const timeouts = d.timeouts as Record<string, unknown> | undefined;
  if (!asked || !isAsked(asked[1]) || !isAsked(asked[2])) return null;
  if (!timeouts || !isInt(timeouts[1]) || !isInt(timeouts[2])) return null;
  if (d.deadline !== null && !isInt(d.deadline)) return null;
  if (!Array.isArray(d.timedOut) || !d.timedOut.every(isSlot)) return null;
  const result = parseResult(d.result);
  if (result === undefined) return null;
  return {
    kind: "battle-step",
    step: d.step,
    lines: d.lines as string[] | null,
    asked: { 1: asked[1], 2: asked[2] },
    deadline: d.deadline as number | null,
    at: d.at,
    timeouts: { 1: timeouts[1], 2: timeouts[2] },
    timedOut: d.timedOut as Slot[],
    result,
  };
}

export type RematchEvent = Extract<BattleEvent, { kind: "rematch-requested" }>;

/** A `rematch-requested` event in an Ably message's data, or null. */
export function parseRematchRequested(data: unknown): RematchEvent | null {
  const d = data as Record<string, unknown> | null;
  return d?.kind === "rematch-requested" && isSlot(d.slot) ? { kind: d.kind, slot: d.slot } : null;
}

/** The steps in a view that come after `played`, in order: your own lines. */
export function stepsFromView(played: number, view: BattleView): StepLines[] {
  const out: StepLines[] = [];
  view.log.steps.forEach((lines, i) => {
    const step = view.log.from + i;
    if (step > played) out.push({ step, lines, exact: true });
  });
  return out;
}

export type EventPlan =
  /** Already played (a duplicate, or the echo of your own POST). */
  | { kind: "duplicate" }
  /** Next in line: fetch your view for it, and play these public lines if the view is slow. */
  | { kind: "next"; lines: string[] | null }
  /** A step is missing (or too big to publish): fetch from this step. */
  | { kind: "gap"; from: number };

/** Where a `battle-step` event fits after `played` steps. */
export function planEvent(played: number, event: StepEvent): EventPlan {
  if (event.step <= played) return { kind: "duplicate" };
  if (event.step === played + 1) return { kind: "next", lines: event.lines };
  return { kind: "gap", from: played + 1 };
}

/**
 * The deadline of the newest step known, in server time, and server time minus
 * local time when it arrived.
 */
export type Clock = { step: number; deadline: number | null; offset: number };

/** Keeps whichever clock is for the later step; the same step takes the fresher offset. */
export function newerClock(current: Clock | null, next: Clock): Clock {
  return !current || next.step >= current.step ? next : current;
}

export const clockFromView = (view: BattleView, localNow: number): Clock => ({
  step: view.step,
  deadline: view.stage === "ended" ? null : view.deadline,
  offset: view.serverNow - localNow,
});

export const clockFromEvent = (event: StepEvent, localNow: number): Clock => ({
  step: event.step,
  deadline: event.deadline,
  offset: event.at - localNow,
});

/** Whole seconds left on the countdown at local time `localNow` (never below 0). */
export function secondsLeft(clock: Clock, localNow: number): number {
  if (clock.deadline === null) return 0;
  return Math.max(0, Math.ceil((clock.deadline - (localNow + clock.offset)) / 1000));
}

/** `m:ss`, as the countdown shows it. */
export const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** The countdown turns red at this many seconds left. */
export const WARN_SECONDS = 15;
/** The timeout trigger fires this long after the deadline: the server's grace, plus a margin. */
export const TIMEOUT_DELAY_MS = GRACE_MS + 250;
/** At most one timeout trigger this often. */
export const TIMEOUT_EVERY_MS = 2000;

/**
 * Local ms from `localNow` until the next timeout trigger: at deadline + grace +
 * 250 ms in server time, and no sooner than 2 s after the last one. Null with no deadline.
 */
export function timeoutDelay(clock: Clock, localNow: number, lastTrigger: number): number | null {
  if (clock.deadline === null) return null;
  const due = clock.deadline + TIMEOUT_DELAY_MS - clock.offset;
  return Math.max(due - localNow, lastTrigger + TIMEOUT_EVERY_MS - localNow, 0);
}

/**
 * Whether a move can be clicked: not disabled, and not out of PP. A move with no PP
 * of its own (null: a locked move, Recharge, Struggle) is always usable.
 */
export const isMoveUsable = (move: Pick<MoveOption, "disabled" | "pp">) => !move.disabled && (move.pp === null || move.pp > 0);
