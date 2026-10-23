// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { battles, rooms } from '@/db/schema';
import { createTestDb } from '@/tests/helpers/test-db';
import { draftedRoom, SEED, T0, TEAM1, type TestRoom } from '@/tests/helpers/battle-room';
import {
  casHooks,
  getBattleView,
  startBattle,
  submitChoice,
  submitOrder,
  triggerTimeout,
} from '@/lib/battle';
import { GRACE_MS, TIMER_MS, type BattleChoice, type BattleEvent, type BattleView } from '@/lib/battle-types';
import { createRoom, FULL_TTL_MS, getRoomState } from '@/lib/rooms';
import type { Slot } from '@/lib/types';

const DUE = T0 + TIMER_MS + GRACE_MS;

// Lets a test make the timeout path crash, as a bug in it would.
const broken = vi.hoisted(() => ({ defaults: false }));
vi.mock('@/lib/battle-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/battle-engine')>();
  return {
    ...actual,
    applyDefault: (...args: Parameters<typeof actual.applyDefault>) => {
      if (broken.defaults) throw new Error('applyDefault exploded');
      return actual.applyDefault(...args);
    },
  };
});

afterEach(() => {
  casHooks.beforeWrite = undefined;
  broken.defaults = false;
  vi.restoreAllMocks();
});

async function started(db: Db, size: 3 | 4 | 6 = 3): Promise<TestRoom> {
  const room = await draftedRoom(db, { size });
  const result = await startBattle(db, room.code, room[1], T0, { seed: SEED });
  if (result.kind !== 'started') throw new Error(result.kind);
  return room;
}

/** Both players locked in at T0 (draft order unless given): step 1, deadline T0 + 80 s. */
async function inProgress(db: Db, orders: { 1: number[]; 2: number[] } = { 1: [1, 2, 3], 2: [1, 2, 3] }) {
  const room = await started(db);
  await submitOrder(db, room.code, room[1], orders[1], T0);
  const second = await submitOrder(db, room.code, room[2], orders[2], T0);
  if (second.kind !== 'progressed') throw new Error(second.kind);
  return room;
}

async function view(db: Db, room: TestRoom, slot: Slot, now: number, from = 0): Promise<BattleView> {
  const result = await getBattleView(db, room.code, room[slot], from, now);
  if (result.kind !== 'view') throw new Error(result.kind);
  return result.view;
}

async function row(db: Db, code: string) {
  const [r] = await db.select().from(battles).where(eq(battles.roomCode, code));
  return r;
}

const choice = (db: Db, room: TestRoom, slot: Slot, step: number, c: BattleChoice, now: number) =>
  submitChoice(db, room.code, room[slot], step, c, now);

/** A sensible choice from the player's view: the first usable move, or the first healthy bench Pokémon. */
function pick(v: BattleView): BattleChoice {
  const request = v.request!;
  if (request.kind === 'move') return { kind: 'move', move: request.moves.find((m) => !m.disabled)!.move as 1 };
  const bench = request.team.find((m) => !m.active && !m.fainted)!;
  return { kind: 'switch', slot: bench.position as 2 };
}

const steps = (events: BattleEvent[]) => events.filter((e) => e.kind === 'battle-step');

describe('START BATTLE', () => {
  it('only the host, only in a complete draft; a second call is already-started', async () => {
    const db = await createTestDb();
    const lobby = await createRoom(db, 'Ash', T0, 3);
    expect(await startBattle(db, lobby.code, lobby.secret, T0)).toEqual({ kind: 'not-drafting' });
    const partial = await draftedRoom(db, { picks: 11 });
    expect(await startBattle(db, partial.code, partial[1], T0)).toEqual({ kind: 'draft-incomplete' });
    expect(await startBattle(db, partial.code, null, T0)).toEqual({ kind: 'not-found' });

    const room = await draftedRoom(db);
    expect(await startBattle(db, room.code, room[2], T0)).toEqual({ kind: 'not-host' });
    expect(await startBattle(db, room.code, room[1], T0, { seed: SEED })).toEqual({
      kind: 'started',
      event: { kind: 'battle-started', battleSize: 3, deadline: T0 + TIMER_MS, at: T0 },
    });
    expect(await startBattle(db, room.code, room[1], T0)).toEqual({ kind: 'already-started' });

    expect(await row(db, room.code)).toMatchObject({
      stage: 'team-order',
      step: 0,
      stepStarts: '[0]',
      deadline: T0 + TIMER_MS,
      version: 1,
    });
    const [r] = await db.select({ phase: rooms.phase }).from(rooms).where(eq(rooms.code, room.code));
    expect(r.phase).toBe('battle');
    const state = (await getRoomState(db, room.code, room[2], T0))!;
    expect(state.phase).toBe('battle');
    expect(state.draft?.picks).toHaveLength(12);
    expect(state.battle).toEqual({ stage: 'team-order', result: null });
  });

  it('views say No battle before it starts', async () => {
    const db = await createTestDb();
    const room = await draftedRoom(db);
    expect(await getBattleView(db, room.code, room[1], 0, T0)).toEqual({ kind: 'no-battle' });
    expect(await getBattleView(db, room.code, 'stranger', 0, T0)).toEqual({ kind: 'not-found' });
  });
});

describe('Battle order', () => {
  it('takes a growing prefix; the opponent sees only the count', async () => {
    const db = await createTestDb();
    const room = await started(db);
    const first = await submitOrder(db, room.code, room[1], [3], T0);
    expect(first).toMatchObject({ kind: 'progressed', events: [{ kind: 'battle-order-progress', slot: 1, count: 1 }] });
    expect(await submitOrder(db, room.code, room[1], [3], T0)).toMatchObject({ kind: 'unchanged', events: [] });
    expect(await submitOrder(db, room.code, room[1], [2], T0)).toMatchObject({ kind: 'order-conflict', events: [] });
    expect(await submitOrder(db, room.code, room[1], [3, 1], T0)).toMatchObject({ kind: 'progressed' });
    expect(await submitOrder(db, room.code, room[1], [1, 2, 3, 4], T0)).toEqual({ kind: 'invalid-order', events: [] });

    const mine = await view(db, room, 1, T0);
    expect(mine).toMatchObject({ stage: 'team-order', step: 0, order: { yours: [3, 1], opponentCount: 0 } });
    expect(mine.request).toMatchObject({ kind: 'team', size: 3 });
    const theirs = await view(db, room, 2, T0);
    expect(theirs.order).toEqual({ yours: [], opponentCount: 2 });
    expect(theirs.asked).toEqual({ 1: 'team', 2: 'team' });
  });

  it('the second lock-in starts step 1; each view shows only its own exact HP', async () => {
    const db = await createTestDb();
    const room = await started(db);
    const lock1 = await submitOrder(db, room.code, room[1], [2, 1, 3], T0);
    expect(lock1).toMatchObject({ kind: 'progressed', view: { stage: 'team-order', chosen: true, log: { from: 0 } } });
    expect(steps(lock1.kind === 'progressed' ? lock1.events : [])).toEqual([]);
    expect((await view(db, room, 2, T0)).chosen).toBe(false);

    const lock2 = await submitOrder(db, room.code, room[2], [1, 2, 3], T0 + 10);
    if (lock2.kind !== 'progressed') throw new Error(lock2.kind);
    expect(lock2.events.map((e) => e.kind)).toEqual(['battle-order-progress', 'battle-step']);
    expect(lock2.events[1]).toMatchObject({
      step: 1,
      asked: { 1: 'move', 2: 'move' },
      deadline: T0 + 10 + TIMER_MS,
      timeouts: { 1: 0, 2: 0 },
      timedOut: [],
      result: null,
    });
    expect(lock2.view).toMatchObject({ stage: 'in-progress', step: 1, order: null, log: { from: 1 } });
    expect(await row(db, room.code)).toMatchObject({ stage: 'in-progress', step: 1 });

    const hp = (v: BattleView, side: Slot) =>
      v.log.steps.flat().filter((l) => l.startsWith(`|switch|p${side}a:`)).map((l) => l.split('|')[4]);
    const v1 = await view(db, room, 1, T0 + 10);
    const v2 = await view(db, room, 2, T0 + 10);
    expect(hp(v1, 1)[0]).toMatch(/^\d+\/(?!100$)\d+$/);
    expect(hp(v1, 2)[0]).toMatch(/\/100$/);
    expect(hp(v2, 2)[0]).toMatch(/^\d+\/(?!100$)\d+$/);
    expect(hp(v2, 1)[0]).toMatch(/\/100$/);
    expect(v1.request?.team.map((m) => m.pokemonId)).toEqual(['furret', 'tauros', 'gengar']);
    expect((await getRoomState(db, room.code, room[1], T0))!.battle).toEqual({ stage: 'in-progress', result: null });
    expect(await submitOrder(db, room.code, room[1], [2, 1], T0)).toMatchObject({ kind: 'not-ordering' });
  });

  it('a resent lock-in after the battle has started is unchanged, not a conflict', async () => {
    const db = await createTestDb();
    const room = await started(db);
    await submitOrder(db, room.code, room[1], [2, 1, 3], T0);
    await submitOrder(db, room.code, room[2], [1, 2, 3], T0);
    const { version } = await row(db, room.code);
    for (const slot of [1, 2] as const) {
      const again = await submitOrder(db, room.code, room[slot], slot === 1 ? [2, 1, 3] : [1, 2, 3], T0);
      expect(again).toMatchObject({ kind: 'unchanged', events: [], view: { stage: 'in-progress', step: 1 } });
    }
    expect((await row(db, room.code)).version).toBe(version);
    expect(await submitOrder(db, room.code, room[2], [3, 2, 1], T0)).toMatchObject({ kind: 'not-ordering' });
  });
});

describe('choices', () => {
  it("a first choice is saved and told to no one; the opponent's view doesn't change", async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    const before = await view(db, room, 2, T0 + 100);
    const first = await choice(db, room, 1, 1, { kind: 'move', move: 1 }, T0 + 100);
    expect(first).toMatchObject({ kind: 'chosen', events: [], view: { chosen: true, step: 1 } });
    const after = await view(db, room, 2, T0 + 200);
    const strip = (v: BattleView) => JSON.stringify({ ...v, serverNow: 0 });
    expect(strip(after)).toBe(strip(before));

    expect(await choice(db, room, 1, 1, { kind: 'move', move: 2 }, T0 + 300)).toMatchObject({ kind: 'already-chosen' });
    const second = await choice(db, room, 2, 1, { kind: 'move', move: 2 }, T0 + 300);
    if (second.kind !== 'resolved') throw new Error(second.kind);
    expect(second.events).toEqual([expect.objectContaining({ kind: 'battle-step', step: 2, at: T0 + 300 })]);
    expect(second.view).toMatchObject({ step: 2, chosen: false, deadline: T0 + 300 + TIMER_MS, log: { from: 2 } });
    expect(second.view.log.steps).toHaveLength(1);
    const lines = second.view.log.steps[0];
    expect(lines.some((l) => l.startsWith('|move|p1a: Tauros|Double-Edge'))).toBe(true);
    expect(lines.some((l) => l.startsWith('|move|p2a: Blissey|Seismic Toss'))).toBe(true);
  });

  it('a stale step, a waiting player and a disabled move are refused; the disabled move saves nothing', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    expect(await choice(db, room, 1, 0, { kind: 'move', move: 1 }, T0)).toMatchObject({ kind: 'stale-step', events: [] });
    await choice(db, room, 1, 1, { kind: 'move', move: 1 }, T0);
    await choice(db, room, 2, 1, { kind: 'move', move: 1 }, T0);
    // Tauros is locked into Double-Edge by its Choice Band.
    const { version } = await row(db, room.code);
    const rejected = await choice(db, room, 1, 2, { kind: 'move', move: 2 }, T0);
    expect(rejected).toMatchObject({ kind: 'rejected', message: expect.stringContaining('disabled'), view: { chosen: false } });
    expect((await row(db, room.code)).version).toBe(version);
    expect(await choice(db, room, 1, 2, { kind: 'move', move: 1 }, T0)).toMatchObject({ kind: 'chosen' });
  });

  it('after a U-turn only the user is asked; a move then is Must switch', async () => {
    const db = await createTestDb();
    const room = await inProgress(db, { 1: [2, 1, 3], 2: [1, 2, 3] });
    await choice(db, room, 1, 1, { kind: 'move', move: 2 }, T0);
    const resolved = await choice(db, room, 2, 1, { kind: 'move', move: 4 }, T0);
    if (resolved.kind !== 'resolved') throw new Error(resolved.kind);
    expect(resolved.events[0]).toMatchObject({ step: 2, asked: { 1: 'switch', 2: null } });
    expect(await choice(db, room, 2, 2, { kind: 'move', move: 1 }, T0)).toMatchObject({
      kind: 'not-asked',
      message: 'Not your turn.',
    });
    expect(await choice(db, room, 1, 2, { kind: 'move', move: 1 }, T0)).toMatchObject({
      kind: 'not-asked',
      message: 'Must switch.',
    });
    expect(await choice(db, room, 1, 2, { kind: 'switch', slot: 4 }, T0)).toEqual({ kind: 'invalid-body', events: [] });
    expect(await choice(db, room, 1, 2, { kind: 'switch', slot: 2 }, T0)).toMatchObject({ kind: 'resolved' });
  });

  it('a switch while trapped goes to the engine and is rejected', async () => {
    const db = await createTestDb();
    const room = await inProgress(db, { 1: [1, 2, 3], 2: [6, 1, 2] });
    // Shadow Tag is hidden until P1 tries to switch.
    expect((await view(db, room, 1, T0)).request).toMatchObject({ kind: 'move', canSwitch: true, trapped: false });
    const { version } = await row(db, room.code);
    const result = await choice(db, room, 1, 1, { kind: 'switch', slot: 2 }, T0);
    expect(result).toMatchObject({
      kind: 'rejected',
      message: expect.stringContaining('trapped'),
      view: { request: { kind: 'move', canSwitch: false, trapped: true } },
    });
    expect((await row(db, room.code)).version).toBe(version);
    expect(await choice(db, room, 1, 1, { kind: 'move', move: 1 }, T0)).toMatchObject({ kind: 'chosen' });
  });

  it('the team order stage takes no moves', async () => {
    const db = await createTestDb();
    const room = await started(db);
    expect(await choice(db, room, 1, 0, { kind: 'move', move: 1 }, T0)).toMatchObject({
      kind: 'not-asked',
      message: 'Not your turn.',
    });
  });
});

describe('timeouts', () => {
  it('nothing applies inside the grace window, and a choice then counts as in time', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    const late = DUE - 1;
    expect((await getBattleView(db, room.code, room[2], 0, late)) as { events: unknown }).toMatchObject({ events: [] });
    expect(await choice(db, room, 1, 1, { kind: 'move', move: 1 }, late)).toMatchObject({ kind: 'chosen' });
    const resolved = await choice(db, room, 2, 1, { kind: 'move', move: 1 }, late);
    expect(resolved).toMatchObject({ kind: 'resolved', events: [{ timedOut: [], timeouts: { 1: 0, 2: 0 } }] });
  });

  it('the GET plays the default for whoever has not chosen, once, with a fresh deadline', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    await choice(db, room, 1, 1, { kind: 'move', move: 1 }, T0);
    const result = await getBattleView(db, room.code, room[1], 0, DUE);
    if (result.kind !== 'view') throw new Error(result.kind);
    expect(result.events).toEqual([
      expect.objectContaining({ kind: 'battle-step', step: 2, timedOut: [2], timeouts: { 1: 0, 2: 1 }, deadline: DUE + TIMER_MS }),
    ]);
    expect(result.view).toMatchObject({ step: 2, deadline: DUE + TIMER_MS, timeouts: { 1: 0, 2: 1 } });
    // Blissey's default is its first move.
    expect(result.view.log.steps[2].some((l) => l.startsWith('|move|p2a: Blissey|Soft-Boiled'))).toBe(true);

    const again = await triggerTimeout(db, room.code, room[2], 1, DUE);
    expect(again).toMatchObject({ kind: 'checked', events: [], view: { step: 2, log: { from: 2 } } });
    expect(await triggerTimeout(db, room.code, room[2], 2, DUE)).toMatchObject({ events: [] });
    expect((await row(db, room.code)).step).toBe(2);
  });

  it('counts settle when the step resolves, not when a choice arrives', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    const r1 = await triggerTimeout(db, room.code, room[1], 1, DUE);
    expect(r1).toMatchObject({ events: [{ timedOut: [1, 2], timeouts: { 1: 1, 2: 1 } }] });
    await choice(db, room, 1, 2, { kind: 'move', move: 1 }, DUE + 10);
    expect(await row(db, room.code)).toMatchObject({ p1Timeouts: 1, p2Timeouts: 1 });
    expect((await view(db, room, 2, DUE + 10)).timeouts).toEqual({ 1: 1, 2: 1 });
    const r2 = await triggerTimeout(db, room.code, room[2], 2, DUE + TIMER_MS + GRACE_MS);
    expect(r2).toMatchObject({ events: [{ step: 3, timedOut: [2], timeouts: { 1: 0, 2: 2 } }] });
  });

  it('during a U-turn step only the switching side is defaulted and struck', async () => {
    const db = await createTestDb();
    const room = await inProgress(db, { 1: [2, 1, 3], 2: [1, 2, 3] });
    // Furret U-turns in time; Blissey times out, so the U-turn step starts with counts 0 and 1.
    await choice(db, room, 1, 1, { kind: 'move', move: 2 }, T0);
    await triggerTimeout(db, room.code, room[1], 1, DUE);
    const uturn = await view(db, room, 1, DUE);
    expect(uturn).toMatchObject({ step: 2, asked: { 1: 'switch', 2: null }, timeouts: { 1: 0, 2: 1 } });

    const result = await triggerTimeout(db, room.code, room[2], 2, DUE + TIMER_MS + GRACE_MS);
    expect(result).toMatchObject({ events: [{ step: 3, timedOut: [1], timeouts: { 1: 1, 2: 1 } }] });
  });

  it('three in a row forfeits; the result is saved with the last step', async () => {
    const db = await createTestDb();
    // Gengar leads against Blissey: nothing faints, so both are asked every step.
    const room = await inProgress(db, { 1: [3, 1, 2], 2: [1, 2, 3] });
    let now = T0;
    let last: BattleEvent[] = [];
    for (let i = 0; i < 3; i++) {
      const v1 = await view(db, room, 1, now);
      expect(v1.asked).toEqual({ 1: 'move', 2: 'move' });
      await choice(db, room, 1, v1.step, pick(v1), now);
      now = v1.deadline! + GRACE_MS;
      const result = await triggerTimeout(db, room.code, room[1], v1.step, now);
      if (result.kind !== 'checked') throw new Error(result.kind);
      last = result.events;
    }
    expect(last).toEqual([expect.objectContaining({ result: { winner: 1, reason: 'forfeit' }, deadline: null, timedOut: [2] })]);
    expect((last[0] as { lines: string[] }).lines).toContain('|win|P1');
    expect(await row(db, room.code)).toMatchObject({ stage: 'ended', winner: 1, endReason: 'forfeit', deadline: null, p2Timeouts: 3 });
    const end = await view(db, room, 2, now);
    expect(end).toMatchObject({ stage: 'ended', request: null, result: { winner: 1, reason: 'forfeit' } });
    expect(await choice(db, room, 1, end.step, { kind: 'move', move: 1 }, now)).toMatchObject({ kind: 'ended' });
    expect((await getRoomState(db, room.code, room[1], now))!.battle).toEqual({
      stage: 'ended',
      result: { winner: 1, reason: 'forfeit' },
    });
  });

  it('an in-time choice between timeouts resets the count', async () => {
    const db = await createTestDb();
    const room = await inProgress(db, { 1: [3, 1, 2], 2: [1, 2, 3] });
    let now = DUE;
    await triggerTimeout(db, room.code, room[1], 1, now); // strike 1 each
    let v = await view(db, room, 1, now);
    await choice(db, room, 1, v.step, pick(v), now);
    await choice(db, room, 2, v.step, pick(await view(db, room, 2, now)), now); // both in time: 0
    for (let i = 0; i < 2; i++) {
      v = await view(db, room, 1, now);
      now = v.deadline! + GRACE_MS;
      await triggerTimeout(db, room.code, room[1], v.step, now);
    }
    expect(await row(db, room.code)).toMatchObject({ stage: 'in-progress', p1Timeouts: 2, p2Timeouts: 2 });
  });

  it('both reaching three in the same step is a tie: abandoned', async () => {
    const db = await createTestDb();
    const room = await started(db);
    let now = T0;
    for (let i = 0; i < 3; i++) {
      const v = await view(db, room, 1, now);
      now = v.deadline! + GRACE_MS;
      await triggerTimeout(db, room.code, room[2], v.step, now);
    }
    expect(await row(db, room.code)).toMatchObject({ stage: 'ended', winner: null, endReason: 'abandoned' });
    expect((await view(db, room, 1, now)).result).toEqual({ winner: null, reason: 'abandoned' });
  });

  it('a team order timeout plays the draft order and is a strike; a partial order is ignored', async () => {
    const db = await createTestDb();
    const room = await started(db);
    await submitOrder(db, room.code, room[1], [3], T0);
    await submitOrder(db, room.code, room[2], [3, 2, 1], T0);
    const result = await getBattleView(db, room.code, room[1], 0, DUE);
    if (result.kind !== 'view') throw new Error(result.kind);
    expect(result.events).toEqual([expect.objectContaining({ step: 1, timedOut: [1], timeouts: { 1: 1, 2: 0 } })]);
    expect(result.view.stage).toBe('in-progress');
    expect(result.view.request?.team.map((m) => m.pokemonId)).toEqual(TEAM1.slice(0, 3));
  });

  it('a double faint asks both; each side is struck only if it misses the replacement', async () => {
    // With this seed, Gengar's Shadow Ball and Arcanine's Flare Blitz recoil faint both on turn 1.
    const teams = {
      1: ['gengar', 'aerodactyl', 'alakazam', 'ampharos', 'arbok', 'azumarill'],
      2: ['arcanine', 'ariados', 'beedrill', 'blissey', 'ambipom', 'crobat'],
    };
    const db = await createTestDb();
    const room = await draftedRoom(db, { teams });
    await startBattle(db, room.code, room[1], T0, { seed: SEED });
    await submitOrder(db, room.code, room[1], [1, 2, 3], T0);
    await submitOrder(db, room.code, room[2], [1, 2, 3], T0);
    // Both time out on turn 1; the defaults (move 1 each) cause the double faint.
    const faint = await triggerTimeout(db, room.code, room[1], 1, DUE);
    expect(faint).toMatchObject({ events: [{ step: 2, asked: { 1: 'switch', 2: 'switch' }, timeouts: { 1: 1, 2: 1 } }] });

    expect(await choice(db, room, 1, 2, { kind: 'switch', slot: 2 }, DUE)).toMatchObject({ kind: 'chosen', events: [] });
    const result = await triggerTimeout(db, room.code, room[2], 2, DUE + TIMER_MS + GRACE_MS);
    expect(result).toMatchObject({ events: [{ step: 3, timedOut: [2], timeouts: { 1: 0, 2: 2 } }] });
    expect(await row(db, room.code)).toMatchObject({ p1Timeouts: 0, p2Timeouts: 2 });
  });

  it('a GET with nothing due writes nothing', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    const { version } = await row(db, room.code);
    expect(await getBattleView(db, room.code, room[1], 0, DUE - 1)).toMatchObject({ kind: 'view', events: [] });
    expect((await row(db, room.code)).version).toBe(version);
  });

  it('a choice after the deadline is stale; the timeout it triggered is saved', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    const late = await choice(db, room, 1, 1, { kind: 'move', move: 1 }, DUE);
    expect(late).toMatchObject({ kind: 'stale-step', events: [{ kind: 'battle-step', step: 2, timedOut: [1, 2] }] });
    expect(late).toMatchObject({ view: { step: 2, log: { from: 2 } } });
    expect(await row(db, room.code)).toMatchObject({ step: 2, p1Timeouts: 1, p2Timeouts: 1 });
  });
});

describe('concurrency', () => {
  it('a choice that loses its compare-and-swap is redone on top of the winner', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    let other: Awaited<ReturnType<typeof submitChoice>> | undefined;
    casHooks.beforeWrite = async () => {
      casHooks.beforeWrite = undefined;
      other = await choice(db, room, 2, 1, { kind: 'move', move: 2 }, T0);
    };
    const mine = await choice(db, room, 1, 1, { kind: 'move', move: 1 }, T0);
    expect(other).toMatchObject({ kind: 'chosen', events: [] });
    expect(mine).toMatchObject({ kind: 'resolved', events: [{ step: 2 }] });
    const lines = (await view(db, room, 1, T0, 2)).log.steps.flat();
    expect(lines.some((l) => l.startsWith('|move|p1a: Tauros|Double-Edge'))).toBe(true);
    expect(lines.some((l) => l.startsWith('|move|p2a: Blissey|Seismic Toss'))).toBe(true);
  });

  it('two simultaneous choices: both land, and exactly one step is published', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    const results = await Promise.all([
      choice(db, room, 1, 1, { kind: 'move', move: 1 }, T0),
      choice(db, room, 2, 1, { kind: 'move', move: 2 }, T0),
    ]);
    const events = results.flatMap((r) => ('events' in r ? r.events : []));
    expect(steps(events)).toHaveLength(1);
    expect(results.map((r) => r.kind).sort()).toEqual(['chosen', 'resolved']);
    const lines = (await view(db, room, 2, T0, 2)).log.steps.flat();
    expect(lines.some((l) => l.startsWith('|move|p1a: Tauros|Double-Edge'))).toBe(true);
    expect(lines.some((l) => l.startsWith('|move|p2a: Blissey|Seismic Toss'))).toBe(true);
  });

  it('a busy database during the save is retried like a lost race', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    let attempts = 0;
    casHooks.beforeWrite = async () => {
      attempts++;
      if (attempts === 1) throw Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY' });
    };
    expect(await choice(db, room, 1, 1, { kind: 'move', move: 1 }, T0)).toMatchObject({ kind: 'chosen' });
    expect(attempts).toBe(2);
    expect((await view(db, room, 1, T0)).chosen).toBe(true);

    casHooks.beforeWrite = async () => {
      throw Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY' });
    };
    expect(await choice(db, room, 2, 1, { kind: 'move', move: 1 }, T0)).toEqual({ kind: 'busy' });
  });

  it('a compare-and-swap that keeps losing is busy after 5 attempts', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    let attempts = 0;
    casHooks.beforeWrite = async () => {
      attempts++;
      await db
        .update(battles)
        .set({ version: sql`${battles.version} + 1` })
        .where(eq(battles.roomCode, room.code));
    };
    expect(await choice(db, room, 1, 1, { kind: 'move', move: 1 }, T0)).toEqual({ kind: 'busy' });
    expect(attempts).toBe(5);
    expect((await view(db, room, 1, T0)).chosen).toBe(false);
  });
});

describe('a crash in the timeout path', () => {
  it('still lets the GET show the saved state; writes keep failing', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    const { version } = await row(db, room.code);
    broken.defaults = true;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await getBattleView(db, room.code, room[1], 0, DUE);
    expect(result).toMatchObject({ kind: 'view', events: [], view: { step: 1, stage: 'in-progress' } });
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('serving the saved state'), expect.any(Error));
    expect((await row(db, room.code)).version).toBe(version);
    await expect(triggerTimeout(db, room.code, room[1], 1, DUE)).rejects.toThrow('applyDefault exploded');
  });
});

describe('cleanup', () => {
  it('an expired room loses its battle row', async () => {
    const db = await createTestDb();
    const room = await inProgress(db);
    await createRoom(db, 'Gary', T0 + FULL_TTL_MS);
    expect(await row(db, room.code)).toBeUndefined();
  });
});
