import { and, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { battles, rooms } from '@/db/schema';
import {
  abandon,
  applyDefault,
  asked,
  choose,
  createBattle,
  endResult,
  forfeit,
  hasChosen,
  linesFor,
  playerRequest,
  restoreBattle,
  serialize,
  toChoiceString,
  type Engine,
} from '@/lib/battle-engine';
import {
  GRACE_MS,
  MAX_TIMEOUTS,
  TIMER_MS,
  type BattleChoice,
  type BattleEvent,
  type BattleResult,
  type BattleStage,
  type BattleView,
  type EndReason,
} from '@/lib/battle-types';
import { TOTAL_PICKS } from '@/lib/draft';
import { findLiveRoom, findMember, isConstraintError, listDraftPicks, withBusyRetry } from '@/lib/rooms';
import type { BattleSize, Slot } from '@/lib/types';

/** A `battle-step` bigger than this goes out with `lines: null` (Ably's limit is 64 KB). */
export const MAX_EVENT_BYTES = 60_000;
const CAS_ATTEMPTS = 5;

const SLOTS = [1, 2] as const;
const other = (slot: Slot): Slot => (slot === 1 ? 2 : 1);

/** The battle row's plain columns, parsed. */
type Saved = {
  stage: BattleStage;
  step: number;
  stepStarts: number[];
  deadline: number | null;
  timeouts: { 1: number; 2: number };
  orders: { 1: number[]; 2: number[] };
  result: BattleResult | null;
};

type BattleRow = typeof battles.$inferSelect;

function parseRow(row: BattleRow): Saved {
  return {
    stage: row.stage as BattleStage,
    step: row.step,
    stepStarts: JSON.parse(row.stepStarts),
    deadline: row.deadline,
    timeouts: { 1: row.p1Timeouts, 2: row.p2Timeouts },
    orders: { 1: JSON.parse(row.p1Order), 2: JSON.parse(row.p2Order) },
    result: row.endReason ? { winner: row.winner as Slot | null, reason: row.endReason as EndReason } : null,
  };
}

const copy = (saved: Saved): Saved => ({
  ...saved,
  stepStarts: [...saved.stepStarts],
  timeouts: { ...saved.timeouts },
  orders: { 1: [...saved.orders[1]], 2: [...saved.orders[2]] },
});

function columns(saved: Saved) {
  return {
    stage: saved.stage,
    step: saved.step,
    stepStarts: JSON.stringify(saved.stepStarts),
    deadline: saved.deadline,
    p1Timeouts: saved.timeouts[1],
    p2Timeouts: saved.timeouts[2],
    p1Order: JSON.stringify(saved.orders[1]),
    p2Order: JSON.stringify(saved.orders[2]),
    winner: saved.result?.winner ?? null,
    endReason: saved.result?.reason ?? null,
  };
}

const askedBoth = (engine: Engine) => ({ 1: asked(engine.battle, 1), 2: asked(engine.battle, 2) });

/**
 * Records the step that began at log index `start`, after an engine call made the
 * log grow. Settles both timeout counts: a slot asked in the step that just ended
 * goes to 0 if it chose in time, or up by one if the server chose for it.
 */
function recordStep(
  engine: Engine,
  saved: Saved,
  start: number,
  now: number,
  wasAsked: { 1: unknown; 2: unknown },
  timedOut: Slot[],
  reason: EndReason,
): BattleEvent {
  const { battle } = engine;
  saved.step += 1;
  saved.stepStarts.push(start);
  for (const slot of SLOTS) {
    if (wasAsked[slot] === null) continue;
    saved.timeouts[slot] = timedOut.includes(slot) ? saved.timeouts[slot] + 1 : 0;
  }
  if (battle.ended) {
    saved.stage = 'ended';
    saved.deadline = null;
    saved.result = endResult(battle, reason);
  } else {
    saved.stage = 'in-progress';
    saved.deadline = now + TIMER_MS;
  }
  const event: BattleEvent = {
    kind: 'battle-step',
    step: saved.step,
    lines: linesFor(battle, start, battle.log.length, 0),
    asked: askedBoth(engine),
    deadline: saved.deadline,
    at: now,
    timeouts: { ...saved.timeouts },
    timedOut,
    result: saved.result,
  };
  if (Buffer.byteLength(JSON.stringify(event), 'utf8') > MAX_EVENT_BYTES) event.lines = null;
  return event;
}

/**
 * If the deadline (plus the grace) has passed, plays the engine's default for every
 * slot that's asked and hasn't chosen, or forfeits a slot on its third timeout in a
 * row (both at once is a tie). That resolves the step, so exactly one step is
 * recorded. `save` is true when the engine changed.
 */
function applyDueTimeouts(
  engine: Engine,
  saved: Saved,
  now: number,
): { save: boolean; events: BattleEvent[]; saved: Saved } {
  if (saved.stage === 'ended' || saved.deadline === null || now < saved.deadline + GRACE_MS) {
    return { save: false, events: [], saved };
  }
  const { battle } = engine;
  const timedOut = SLOTS.filter((slot) => asked(battle, slot) !== null && !hasChosen(battle, slot));
  if (timedOut.length === 0) return { save: false, events: [], saved };

  const next = copy(saved);
  const start = battle.log.length;
  const wasAsked = askedBoth(engine);
  const forfeits = timedOut.filter((slot) => saved.timeouts[slot] + 1 >= MAX_TIMEOUTS);
  let reason: EndReason = 'normal';
  if (forfeits.length === 2) {
    abandon(engine);
    reason = 'abandoned';
  } else if (forfeits.length === 1) {
    forfeit(engine, forfeits[0]);
    reason = 'forfeit';
  } else {
    for (const slot of timedOut) applyDefault(engine, slot);
  }
  if (battle.log.length === start) throw new Error('timeouts did not resolve the step');
  const event = recordStep(engine, next, start, now, wasAsked, timedOut, reason);
  return { save: true, events: [event], saved: next };
}

/** One player's view, with their lines for steps `from`..current (clamped). */
function buildView(
  code: string,
  engine: Engine,
  saved: Saved,
  slot: Slot,
  size: BattleSize,
  from: number,
  now: number,
): BattleView {
  const { battle } = engine;
  const first = Math.max(0, Math.min(from, saved.step));
  const steps: string[][] = [];
  for (let k = first; k <= saved.step; k++) {
    steps.push(linesFor(battle, saved.stepStarts[k], saved.stepStarts[k + 1] ?? battle.log.length, slot));
  }
  const ended = saved.stage === 'ended';
  return {
    code,
    you: { slot },
    battleSize: size,
    stage: saved.stage,
    step: saved.step,
    asked: askedBoth(engine),
    chosen: asked(battle, slot) !== null && hasChosen(battle, slot),
    request: ended ? null : playerRequest(battle, slot),
    order:
      saved.stage === 'team-order'
        ? { yours: [...saved.orders[slot]], opponentCount: saved.orders[other(slot)].length }
        : null,
    deadline: saved.deadline,
    serverNow: now,
    timeouts: { ...saved.timeouts },
    log: { from: first, steps },
    result: saved.result,
  };
}

/** What a mutation sees: the engine and row with any due timeouts already applied. */
type Context = { engine: Engine; saved: Saved; slot: Slot; size: BattleSize };

/**
 * What a mutation did. `reject`: discard its engine and fields (a rejected `choose`
 * still changes the engine). Otherwise `save` says whether it changed anything.
 */
type Mutation<T> = { outcome: T; save: boolean; events?: BattleEvent[]; reject?: boolean };

type WithBattleResult<T> =
  | { kind: 'not-found' }
  | { kind: 'no-battle' }
  | { kind: 'busy' }
  | { kind: 'done'; outcome: T; events: BattleEvent[]; view: (from: number) => BattleView };

/** Test hooks: `beforeWrite` runs between the load and the compare-and-swap update. */
export const casHooks: { beforeWrite?: () => Promise<void> } = {};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Loads the battle, applies due timeouts, runs `mutate` and saves with a
 * compare-and-swap on `version`. Losing the race reloads and redoes the whole
 * attempt, so no choice is lost. `events` are the ones written, for the caller to
 * publish. `applyTimeouts` can skip the timeout path for this call.
 */
async function withBattle<T>(
  db: Db,
  code: string,
  secret: string | null,
  now: number,
  mutate: (ctx: Context) => Mutation<T>,
  applyTimeouts: (saved: Saved) => boolean = () => true,
): Promise<WithBattleResult<T>> {
  if (!secret) return { kind: 'not-found' };
  const room = await findLiveRoom(db, code, now);
  const me = room && (await findMember(db, code, secret));
  if (!room || !me) return { kind: 'not-found' };
  if (room.phase !== 'battle') return { kind: 'no-battle' };
  const size = room.battleSize as BattleSize;

  for (let attempt = 1; attempt <= CAS_ATTEMPTS; attempt++) {
    const [row] = await db.select().from(battles).where(eq(battles.roomCode, code));
    if (!row) return { kind: 'no-battle' };
    let engine = restoreBattle(row.state);
    const loaded = parseRow(row);
    const timed = applyTimeouts(loaded)
      ? applyDueTimeouts(engine, loaded, now)
      : { save: false, events: [], saved: loaded };
    // The state with the timeouts applied, saved even if the mutation is rejected.
    const base = timed.save ? serialize(engine) : row.state;

    const ctx: Context = { engine, saved: copy(timed.saved), slot: me.slot, size };
    const m = mutate(ctx);

    let state: string | null = null;
    let saved = timed.saved;
    let events = timed.events;
    if (m.reject) {
      engine = restoreBattle(base);
      if (timed.save) state = base;
    } else if (m.save) {
      state = serialize(engine);
      saved = ctx.saved;
      events = [...timed.events, ...(m.events ?? [])];
    } else if (timed.save) {
      state = base;
    }

    if (state !== null) {
      await casHooks.beforeWrite?.();
      const result = await db
        .update(battles)
        .set({ state, version: row.version + 1, ...columns(saved), updatedAt: now })
        .where(and(eq(battles.roomCode, code), eq(battles.version, row.version)));
      if (result.rowsAffected !== 1) {
        // Lost the race: the other player saved first. Reload and redo it all.
        await sleep(10 + Math.random() * 40);
        continue;
      }
    }
    const viewed = engine;
    return {
      kind: 'done',
      outcome: m.outcome,
      events,
      view: (from) => buildView(code, viewed, saved, me.slot, size, from, now),
    };
  }
  return { kind: 'busy' };
}

export type StartBattleResult =
  | { kind: 'started'; event: { kind: 'battle-started'; battleSize: BattleSize; deadline: number; at: number } }
  | { kind: 'already-started' }
  | { kind: 'not-found' }
  | { kind: 'not-host' }
  | { kind: 'not-drafting' }
  | { kind: 'draft-incomplete' };

/** The host starts the battle once the draft is complete: the Battle order screen, step 0. */
export async function startBattle(
  db: Db,
  code: string,
  secret: string | null,
  now: number,
  opts: { seed?: string } = {},
): Promise<StartBattleResult> {
  if (!secret) return { kind: 'not-found' };
  try {
    return await withBusyRetry(() =>
      db.transaction(async (tx): Promise<StartBattleResult> => {
        const room = await findLiveRoom(tx, code, now);
        const me = room && (await findMember(tx, code, secret));
        if (!room || !me) return { kind: 'not-found' };
        if (me.slot !== 1) return { kind: 'not-host' };
        if (room.phase === 'battle') return { kind: 'already-started' };
        if (room.phase !== 'draft') return { kind: 'not-drafting' };
        const picks = await listDraftPicks(tx, code);
        if (picks.length < TOTAL_PICKS) return { kind: 'draft-incomplete' };

        const size = room.battleSize as BattleSize;
        const teamOf = (slot: Slot) => picks.filter((p) => p.slot === slot).map((p) => p.pokemonId);
        const engine = createBattle({ size, seed: opts.seed, teams: { 1: teamOf(1), 2: teamOf(2) } });
        const deadline = now + TIMER_MS;
        // The primary key makes a racing second start fail here.
        await tx.insert(battles).values({
          roomCode: code,
          state: serialize(engine),
          version: 1,
          stage: 'team-order',
          step: 0,
          stepStarts: '[0]',
          deadline,
          createdAt: now,
          updatedAt: now,
        });
        await tx.update(rooms).set({ phase: 'battle' }).where(eq(rooms.code, code));
        return { kind: 'started', event: { kind: 'battle-started', battleSize: size, deadline, at: now } };
      }),
    );
  } catch (err) {
    if (isConstraintError(err)) return { kind: 'already-started' };
    throw err;
  }
}

export type ViewResult =
  | { kind: 'view'; view: BattleView; events: BattleEvent[] }
  | { kind: 'not-found' }
  | { kind: 'no-battle' }
  | { kind: 'busy' };

/** The player's view, after applying any due timeouts (whose events the caller publishes). */
export async function getBattleView(
  db: Db,
  code: string,
  secret: string | null,
  from: number,
  now: number,
): Promise<ViewResult> {
  const result = await withBattle(db, code, secret, now, () => ({ outcome: null, save: false }));
  if (result.kind !== 'done') return result;
  return { kind: 'view', view: result.view(from), events: result.events };
}

export type TimeoutResult =
  | { kind: 'checked'; view: BattleView; events: BattleEvent[] }
  | { kind: 'not-found' }
  | { kind: 'no-battle' }
  | { kind: 'busy' };

/**
 * A client's countdown for `step` reached zero: applies due timeouts, the same as the
 * GET. A countdown for an earlier step is already over, so that's a plain read.
 */
export async function triggerTimeout(
  db: Db,
  code: string,
  secret: string | null,
  step: number,
  now: number,
): Promise<TimeoutResult> {
  const result = await withBattle(
    db,
    code,
    secret,
    now,
    () => ({ outcome: null, save: false }),
    (saved) => step >= saved.step,
  );
  if (result.kind !== 'done') return result;
  return { kind: 'checked', view: result.view(step + 1), events: result.events };
}

export type OrderOutcome = 'progressed' | 'unchanged' | 'invalid-order' | 'order-conflict' | 'not-ordering';

export type SubmitOrderResult =
  | { kind: 'progressed' | 'unchanged'; events: BattleEvent[]; view: BattleView }
  | { kind: 'order-conflict' | 'not-ordering'; events: BattleEvent[]; view: BattleView }
  | { kind: 'invalid-order'; events: BattleEvent[] }
  | { kind: 'not-found' }
  | { kind: 'no-battle' }
  | { kind: 'busy' };

/**
 * The player's Battle order so far (1-based draft positions). It must extend the
 * stored order. Reaching the battle size locks it in with the engine; the second
 * lock-in starts the battle (step 1).
 */
export async function submitOrder(
  db: Db,
  code: string,
  secret: string | null,
  order: number[],
  now: number,
): Promise<SubmitOrderResult> {
  const result = await withBattle<OrderOutcome>(db, code, secret, now, ({ engine, saved, slot, size }) => {
    if (order.length > size) return { outcome: 'invalid-order', save: false, reject: true };
    if (saved.stage !== 'team-order') return { outcome: 'not-ordering', save: false, reject: true };
    const stored = saved.orders[slot];
    if (stored.some((value, i) => order[i] !== value)) {
      return { outcome: 'order-conflict', save: false, reject: true };
    }
    if (order.length === stored.length) return { outcome: 'unchanged', save: false };

    saved.orders[slot] = [...order];
    const events: BattleEvent[] = [{ kind: 'battle-order-progress', slot, count: order.length }];
    if (order.length === size) {
      const start = engine.battle.log.length;
      const wasAsked = askedBoth(engine);
      const chosen = choose(engine, slot, toChoiceString({ kind: 'team', order }));
      if (!chosen.ok) throw new Error(`team order rejected: ${chosen.message}`);
      if (engine.battle.log.length > start) events.push(recordStep(engine, saved, start, now, wasAsked, [], 'normal'));
    }
    return { outcome: 'progressed', save: true, events };
  });
  if (result.kind !== 'done') return result;
  if (result.outcome === 'invalid-order') return { kind: 'invalid-order', events: result.events };
  // The client has step 0, the Battle order; only send what follows it.
  return { kind: result.outcome, events: result.events, view: result.view(1) };
}

export type ChoiceOutcome =
  | { kind: 'chosen' | 'resolved' | 'stale-step' | 'already-chosen' | 'ended' | 'invalid-body' }
  | { kind: 'not-asked'; message: string }
  | { kind: 'rejected'; message: string };

export type SubmitChoiceResult =
  | { kind: 'chosen' | 'resolved' | 'stale-step' | 'already-chosen' | 'ended'; events: BattleEvent[]; view: BattleView }
  | { kind: 'not-asked' | 'rejected'; message: string; events: BattleEvent[]; view: BattleView }
  | { kind: 'invalid-body'; events: BattleEvent[] }
  | { kind: 'not-found' }
  | { kind: 'no-battle' }
  | { kind: 'busy' };

/**
 * A move or switch for `step`. The first choice of a step is saved and told to no
 * one; the one that completes the step resolves it.
 */
export async function submitChoice(
  db: Db,
  code: string,
  secret: string | null,
  step: number,
  choice: BattleChoice,
  now: number,
): Promise<SubmitChoiceResult> {
  const result = await withBattle<ChoiceOutcome>(db, code, secret, now, ({ engine, saved, slot, size }) => {
    const { battle } = engine;
    const reject = (outcome: ChoiceOutcome): Mutation<ChoiceOutcome> => ({ outcome, save: false, reject: true });
    if (step !== saved.step) return reject({ kind: 'stale-step' });
    if (saved.stage === 'ended') return reject({ kind: 'ended' });
    const want = asked(battle, slot);
    if (want === null || want === 'team') return reject({ kind: 'not-asked', message: 'Not your turn.' });
    if (hasChosen(battle, slot)) return reject({ kind: 'already-chosen' });
    const request = playerRequest(battle, slot);
    if (choice.kind === 'move') {
      if (want === 'switch') return reject({ kind: 'not-asked', message: 'Must switch.' });
      if (request?.kind !== 'move' || choice.move > request.moves.length) return reject({ kind: 'invalid-body' });
    } else {
      if (choice.slot > size) return reject({ kind: 'invalid-body' });
      // Only an empty bench is checked here. A trapped switch goes to the engine, which says why.
      if (!request?.team.some((m) => !m.active && !m.fainted)) {
        return reject({ kind: 'not-asked', message: 'Not your turn.' });
      }
    }

    const start = battle.log.length;
    const wasAsked = askedBoth(engine);
    const chosen = choose(engine, slot, toChoiceString(choice));
    if (!chosen.ok) return reject({ kind: 'rejected', message: chosen.message });
    if (battle.log.length === start) return { outcome: { kind: 'chosen' }, save: true };
    const event = recordStep(engine, saved, start, now, wasAsked, [], 'normal');
    return { outcome: { kind: 'resolved' }, save: true, events: [event] };
  });
  if (result.kind !== 'done') return result;
  const { outcome, events } = result;
  if (outcome.kind === 'invalid-body') return { kind: 'invalid-body', events };
  return { ...outcome, events, view: result.view(step + 1) };
}
