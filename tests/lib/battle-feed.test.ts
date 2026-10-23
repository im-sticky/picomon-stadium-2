import { describe, expect, it } from "vitest";
import {
  clockFromEvent,
  clockFromView,
  formatClock,
  isMoveUsable,
  newerClock,
  parseBattleStep,
  planEvent,
  secondsLeft,
  stepsFromView,
  timeoutDelay,
  type StepEvent,
} from "@/lib/battle-feed";
import { GRACE_MS, type BattleView } from "@/lib/battle-types";

const event = (step: number, more: Partial<StepEvent> = {}): StepEvent => ({
  kind: "battle-step",
  step,
  lines: ["|turn|2"],
  asked: { 1: "move", 2: "move" },
  deadline: 100_000,
  at: 25_000,
  timeouts: { 1: 0, 2: 0 },
  timedOut: [],
  result: null,
  ...more,
});

const view = (step: number, from: number, more: Partial<BattleView> = {}): BattleView => ({
  code: "K7PQ",
  you: { slot: 1 },
  battleSize: 3,
  stage: "in-progress",
  step,
  asked: { 1: "move", 2: "move" },
  chosen: false,
  request: null,
  order: null,
  deadline: 100_000,
  serverNow: 25_000,
  timeouts: { 1: 0, 2: 0 },
  log: { from, steps: Array.from({ length: step - from + 1 }, (_, i) => [`|turn|${from + i}`]) },
  result: null,
  ...more,
});

describe("parseBattleStep", () => {
  it("accepts a battle-step and drops unknown fields", () => {
    expect(parseBattleStep({ ...event(3), extra: 1 })).toEqual(event(3));
    expect(parseBattleStep(event(3, { lines: null, deadline: null, result: { winner: null, reason: "abandoned" } }))).toMatchObject({
      lines: null,
      result: { winner: null, reason: "abandoned" },
    });
  });

  it("rejects anything else", () => {
    expect(parseBattleStep(null)).toBeNull();
    expect(parseBattleStep({ kind: "battle-order-progress", slot: 1, count: 2 })).toBeNull();
    expect(parseBattleStep({ ...event(3), step: 0 })).toBeNull();
    expect(parseBattleStep({ ...event(3), lines: [1] })).toBeNull();
    expect(parseBattleStep({ ...event(3), asked: { 1: "dance", 2: null } })).toBeNull();
    expect(parseBattleStep({ ...event(3), result: { winner: 3, reason: "normal" } })).toBeNull();
    expect(parseBattleStep({ ...event(3), timedOut: [3] })).toBeNull();
  });
});

describe("planEvent", () => {
  it("plays the next step, skips a duplicate and fetches across a gap", () => {
    expect(planEvent(2, event(3))).toEqual({ kind: "next", lines: ["|turn|2"] });
    expect(planEvent(3, event(3))).toEqual({ kind: "duplicate" });
    expect(planEvent(4, event(3))).toEqual({ kind: "duplicate" });
    expect(planEvent(2, event(5))).toEqual({ kind: "gap", from: 3 });
    // Too big to publish: the next step, but its lines come from a fetch.
    expect(planEvent(2, event(3, { lines: null }))).toEqual({ kind: "next", lines: null });
  });
});

describe("stepsFromView", () => {
  it("returns only the steps after the ones played, as your exact lines", () => {
    expect(stepsFromView(0, view(2, 1))).toEqual([
      { step: 1, lines: ["|turn|1"], exact: true },
      { step: 2, lines: ["|turn|2"], exact: true },
    ]);
    expect(stepsFromView(1, view(2, 1))).toEqual([{ step: 2, lines: ["|turn|2"], exact: true }]);
    expect(stepsFromView(2, view(2, 1))).toEqual([]);
  });
});

describe("the clock", () => {
  it("counts down to the server's deadline through the offset", () => {
    // Local time runs 5 s behind the server's.
    const clock = clockFromView(view(2, 2, { deadline: 100_000, serverNow: 25_000 }), 20_000);
    expect(clock).toEqual({ step: 2, deadline: 100_000, offset: 5_000 });
    expect(secondsLeft(clock, 20_000)).toBe(75);
    expect(secondsLeft(clock, 20_001)).toBe(75);
    expect(secondsLeft(clock, 21_000)).toBe(74);
    expect(secondsLeft(clock, 94_999)).toBe(1);
    expect(secondsLeft(clock, 200_000)).toBe(0);
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(15)).toBe("0:15");
    expect(formatClock(0)).toBe("0:00");
  });

  it("has no deadline once ended", () => {
    const clock = clockFromView(view(5, 5, { stage: "ended", deadline: null }), 0);
    expect(clock.deadline).toBeNull();
    expect(secondsLeft(clock, 0)).toBe(0);
    expect(timeoutDelay(clock, 0, 0)).toBeNull();
  });

  it("takes the clock of the later step", () => {
    const older = clockFromView(view(2, 2), 20_000);
    const newer = clockFromEvent(event(3, { at: 30_000 }), 26_000);
    expect(newer).toEqual({ step: 3, deadline: 100_000, offset: 4_000 });
    expect(newerClock(older, newer)).toBe(newer);
    expect(newerClock(newer, older)).toBe(newer);
    expect(newerClock(null, older)).toBe(older);
  });

  it("fires the timeout at deadline + grace + 250 ms server time, at most every 2 s", () => {
    const clock = { step: 2, deadline: 100_000, offset: 5_000 };
    // Server time 100_000 + 1_250 is local 96_250.
    const due = 100_000 + GRACE_MS + 250 - 5_000;
    expect(timeoutDelay(clock, 20_000, 0)).toBe(due - 20_000);
    expect(timeoutDelay(clock, due, 0)).toBe(0);
    expect(timeoutDelay(clock, due + 500, due)).toBe(1_500);
    expect(timeoutDelay(clock, due + 5_000, due)).toBe(0);
  });
});

describe("isMoveUsable", () => {
  it("disables a disabled move or one out of PP, never one with no PP of its own", () => {
    expect(isMoveUsable({ disabled: false, pp: 10 })).toBe(true);
    expect(isMoveUsable({ disabled: false, pp: 0 })).toBe(false);
    expect(isMoveUsable({ disabled: true, pp: 10 })).toBe(false);
    // Recharge, a locked Outrage or Struggle: the request has no PP for them.
    expect(isMoveUsable({ disabled: false, pp: null })).toBe(true);
    expect(isMoveUsable({ disabled: true, pp: null })).toBe(false);
  });
});
