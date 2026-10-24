// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { setDbForTests, type Db } from '@/db/client';
import { battles, rooms } from '@/db/schema';
import { createTestDb } from '@/tests/helpers/test-db';
import { draftedRoom, T0, type TestRoom } from '@/tests/helpers/battle-room';

// connection() only works inside a Next request scope.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ably-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ably-server')>()),
  notifyRoomEvent: vi.fn().mockResolvedValue(undefined),
}));

// Battles get a fixed seed, so the tests are repeatable. `huge` makes every public
// battle-step huge, to hit the publish size limit.
const huge = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/battle-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/battle-engine')>();
  const { SEED } = await import('@/tests/helpers/battle-room');
  return {
    ...actual,
    createBattle: (opts: Parameters<typeof actual.createBattle>[0]) => actual.createBattle({ ...opts, seed: SEED }),
    linesFor: (...args: Parameters<typeof actual.linesFor>) =>
      huge.on && args[3] === 0 ? Array.from({ length: 7000 }, () => '|-message|0123456789') : actual.linesFor(...args),
  };
});

import { notifyRoomEvent } from '@/lib/ably-server';
import { casHooks } from '@/lib/battle';
import { linesFor, restoreBattle } from '@/lib/battle-engine';
import type { BattleChoice, BattleEvent, BattleView } from '@/lib/battle-types';
import { GET as viewRoute, POST as startRoute } from '@/app/api/rooms/[code]/battle/route';
import { POST as orderRoute } from '@/app/api/rooms/[code]/battle/order/route';
import { POST as choiceRoute } from '@/app/api/rooms/[code]/battle/choice/route';
import { POST as timeoutRoute } from '@/app/api/rooms/[code]/battle/timeout/route';
import { createRoom } from '@/lib/rooms';
import { GRACE_MS, TIMER_MS } from '@/lib/battle-types';
import type { BattleSize, Slot } from '@/lib/types';

let db: Db;
let now = T0;

function req(path: string, method: string, body?: unknown, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: cookie ? { cookie } : {},
  });
}
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const cookie = (secret: string) => `picomon_player=${secret}`;

type Client = { code: string; slot: Slot; cookie: string };
const clients = (room: TestRoom): { 1: Client; 2: Client } => ({
  1: { code: room.code, slot: 1, cookie: cookie(room[1]) },
  2: { code: room.code, slot: 2, cookie: cookie(room[2]) },
});

const start = (c: Client) => startRoute(req(`/api/rooms/${c.code}/battle`, 'POST', undefined, c.cookie), ctx(c.code));
const getView = (c: Client, query = '') =>
  viewRoute(req(`/api/rooms/${c.code}/battle${query}`, 'GET', undefined, c.cookie), ctx(c.code));
const order = (c: Client, body: unknown) =>
  orderRoute(req(`/api/rooms/${c.code}/battle/order`, 'POST', body, c.cookie), ctx(c.code));
const choose = (c: Client, body: unknown) =>
  choiceRoute(req(`/api/rooms/${c.code}/battle/choice`, 'POST', body, c.cookie), ctx(c.code));
const timeout = (c: Client, body: unknown) =>
  timeoutRoute(req(`/api/rooms/${c.code}/battle/timeout`, 'POST', body, c.cookie), ctx(c.code));
const view = async (c: Client): Promise<BattleView> => (await getView(c)).json();

const published = () => vi.mocked(notifyRoomEvent).mock.calls.map(([, event]) => event);

async function battleRow(code: string) {
  const [row] = await db.select().from(battles).where(eq(battles.roomCode, code));
  return row;
}

/** A started battle, with the start event cleared. */
async function started(size: BattleSize = 3) {
  const room = await draftedRoom(db, { size });
  const c = clients(room);
  expect((await start(c[1])).status).toBe(200);
  vi.mocked(notifyRoomEvent).mockClear();
  return c;
}

async function inProgress(size: BattleSize = 3) {
  const c = await started(size);
  const positions = [1, 2, 3, 4, 5, 6].slice(0, size);
  await order(c[1], { order: positions });
  await order(c[2], { order: positions });
  vi.mocked(notifyRoomEvent).mockClear();
  return c;
}

/** The first usable move, or the first healthy bench Pokémon: the engine's own default. */
function pick(v: BattleView): BattleChoice {
  const request = v.request!;
  if (request.kind === 'move') return { kind: 'move', move: request.moves.find((m) => !m.disabled)!.move as 1 };
  return { kind: 'switch', slot: request.team.find((m) => !m.active && !m.fainted)!.position as 2 };
}

/** Exact HP is anything over a total other than 100. */
const exactHp = (text: string) => [...text.matchAll(/\b(\d+)\/(\d+)\b/g)].filter(([, , total]) => total !== '100');

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(notifyRoomEvent).mockResolvedValue(undefined);
  now = T0;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  db = await createTestDb();
  setDbForTests(db);
});

afterEach(() => {
  huge.on = false;
  casHooks.beforeWrite = undefined;
  vi.restoreAllMocks();
});

describe('POST battle (START BATTLE)', () => {
  it('answers every case, and publishes battle-started once', async () => {
    const lobby = await createRoom(db, 'Ash', T0, 3);
    const host = { code: lobby.code, slot: 1 as const, cookie: cookie(lobby.secret) };
    expect(await (await start(host)).json()).toEqual({ error: 'Not drafting.' });
    expect((await start(host)).status).toBe(409);

    const partial = clients(await draftedRoom(db, { picks: 11 }));
    const incomplete = await start(partial[1]);
    expect(incomplete.status).toBe(409);
    expect(await incomplete.json()).toEqual({ error: 'The draft is not complete.' });

    const c = clients(await draftedRoom(db));
    const noCookie = await startRoute(req(`/api/rooms/${c[1].code}/battle`, 'POST'), ctx(c[1].code));
    expect(noCookie.status).toBe(404);
    expect(await noCookie.json()).toEqual({ error: 'Room not found.' });
    expect((await start({ ...c[1], code: 'ZZZZ' })).status).toBe(404);
    const guest = await start(c[2]);
    expect(guest.status).toBe(403);
    expect(await guest.json()).toEqual({ error: 'Only the host can start.' });
    expect(notifyRoomEvent).not.toHaveBeenCalled();

    const res = await start(c[1]);
    expect(res.status).toBe(200);
    const event = { kind: 'battle-started', battleSize: 3, deadline: T0 + TIMER_MS, at: T0 };
    expect(await res.json()).toEqual({ ok: true, event });
    expect(published()).toEqual([event]);

    const again = await start(c[1]);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true });
    expect(notifyRoomEvent).toHaveBeenCalledTimes(1);
  });
});

describe('GET battle', () => {
  it('404 without a cookie, 409 before the battle, 400 for a bad from', async () => {
    const c = clients(await draftedRoom(db));
    const anon = await viewRoute(req(`/api/rooms/${c[1].code}/battle`, 'GET'), ctx(c[1].code));
    expect(anon.status).toBe(404);
    const early = await getView(c[1]);
    expect(early.status).toBe(409);
    expect(await early.json()).toEqual({ error: 'No battle yet.' });
    await start(c[1]);
    for (const query of ['?from=x', '?from=-1', '?from=1.5', '?from=']) {
      expect((await getView(c[1], query)).status).toBe(400);
    }
  });

  it("returns the player's view, clamping from to the current step", async () => {
    const c = await inProgress();
    const res = await getView(c[2], '?from=99');
    expect(res.status).toBe(200);
    const v: BattleView = await res.json();
    expect(v).toMatchObject({ code: c[2].code, you: { slot: 2 }, stage: 'in-progress', step: 1, log: { from: 1 } });
    expect(v.log.steps).toHaveLength(1);
    const text = JSON.stringify(v);
    expect(text).not.toMatch(/"state"|"version"|sodium|inputLog/);
    expect(notifyRoomEvent).not.toHaveBeenCalled();
  });

  it('applies due timeouts and publishes their step', async () => {
    const c = await inProgress();
    now = T0 + TIMER_MS + GRACE_MS;
    const v = await view(c[1]);
    expect(v).toMatchObject({ step: 2, timeouts: { 1: 1, 2: 1 } });
    expect(published()).toEqual([expect.objectContaining({ kind: 'battle-step', step: 2, timedOut: [1, 2] })]);
  });
});

describe('POST battle/order', () => {
  it('validates the body and answers every case', async () => {
    const c = await started();
    const bad = [[], [1, 1], [0], [7], [1.5], '123', [1, 2, 3, 4, 5, 6, 1]].map((value) => ({ order: value }));
    for (const body of [{}, ...bad]) {
      const res = await order(c[1], body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid-order' });
    }
    expect((await order(c[1], { order: [1, 2, 3, 4] })).status).toBe(400); // longer than the battle size
    expect(notifyRoomEvent).not.toHaveBeenCalled();
    const anon = await orderRoute(req(`/api/rooms/${c[1].code}/battle/order`, 'POST', { order: [1] }), ctx(c[1].code));
    expect(anon.status).toBe(404);

    const first = await order(c[1], { order: [2] });
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body).toMatchObject({ ok: true, events: [{ kind: 'battle-order-progress', slot: 1, count: 1 }] });
    expect(body.view).toMatchObject({ order: { yours: [2], opponentCount: 0 }, log: { from: 0 } });
    expect(published()).toEqual(body.events);

    vi.mocked(notifyRoomEvent).mockClear();
    const same = await order(c[1], { order: [2] });
    expect(await same.json()).toMatchObject({ ok: true, events: [] });
    const conflict = await order(c[1], { order: [3] });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ error: 'Order already chosen.', view: { order: { yours: [2] } } });
    expect(notifyRoomEvent).not.toHaveBeenCalled();

    await order(c[1], { order: [2, 1, 3] });
    vi.mocked(notifyRoomEvent).mockClear();
    const last = await order(c[2], { order: [3, 2, 1] });
    const lastBody = await last.json();
    expect(lastBody.events.map((e: BattleEvent) => e.kind)).toEqual(['battle-order-progress', 'battle-step']);
    expect(lastBody.view).toMatchObject({ stage: 'in-progress', step: 1, log: { from: 1 } });
    expect(published()).toEqual(lastBody.events);

    // A resend of the lock-in (its response lost) is a success; a different order is too late.
    const resent = await order(c[2], { order: [3, 2, 1] });
    expect(resent.status).toBe(200);
    expect(await resent.json()).toMatchObject({ ok: true, events: [], view: { stage: 'in-progress' } });
    const late = await order(c[2], { order: [1, 2, 3] });
    expect(late.status).toBe(409);
    expect(await late.json()).toMatchObject({ error: 'Not choosing an order.', view: { stage: 'in-progress' } });
  });
});

describe('POST battle/choice', () => {
  it('validates the body; extra fields are ignored', async () => {
    const c = await inProgress();
    const bad = [
      {},
      { step: 1 },
      { step: -1, choice: { kind: 'move', move: 1 } },
      { step: 1, choice: { kind: 'move', move: 5 } },
      { step: 1, choice: { kind: 'move', move: 0 } },
      { step: 1, choice: { kind: 'switch', slot: 1 } },
      { step: 1, choice: { kind: 'switch', slot: 7 } },
      { step: 1, choice: { kind: 'mega', move: 1 } },
      { step: 1, choice: 'move 1 mega' },
    ];
    for (const body of bad) {
      const res = await choose(c[1], body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid-choice' });
    }
    const extra = await choose(c[1], { step: 1, choice: { kind: 'move', move: 1, mega: true, choice: 'move 1 mega' }, mega: true });
    expect(extra.status).toBe(200);
    const { choice } = JSON.parse((await battleRow(c[1].code)).state).sides[0];
    expect(choice.actions).toEqual([expect.objectContaining({ choice: 'move', moveSlot: 0, mega: false })]);
    expect(choice.mega).toBe(false);
  });

  it('a first choice publishes nothing; the second publishes the public step', async () => {
    const c = await inProgress();
    const first = await choose(c[1], { step: 1, choice: { kind: 'move', move: 1 } });
    expect(first.status).toBe(200);
    // Still step 1, so the view can't start any later than it.
    expect(await first.json()).toMatchObject({ ok: true, events: [], view: { chosen: true, log: { from: 1 } } });
    expect(notifyRoomEvent).not.toHaveBeenCalled();

    const again = await choose(c[1], { step: 1, choice: { kind: 'move', move: 1 } });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: 'Already chosen.', view: { step: 1 } });

    const second = await choose(c[2], { step: 1, choice: { kind: 'move', move: 2 } });
    const body = await second.json();
    expect(body).toMatchObject({ ok: true, view: { step: 2, log: { from: 2 } } });
    expect(published()).toEqual(body.events);
    expect(body.events).toHaveLength(1);

    const event = body.events[0];
    const row = await battleRow(c[1].code);
    const { battle } = restoreBattle(row.state);
    const starts: number[] = JSON.parse(row.stepStarts);
    expect(event.lines).toEqual(linesFor(battle, starts[2], battle.log.length, 0));
    const text = JSON.stringify(event);
    expect(exactHp(text)).toEqual([]);
    expect(text).not.toMatch(/request|order|sodium|"state"|"version"/);
    // The player's own view has their exact HP, from the same step.
    expect(exactHp(JSON.stringify(body.view.log))).not.toEqual([]);
  });

  it('answers stale, not asked, rejected and ended with the view', async () => {
    const c = await inProgress();
    const stale = await choose(c[1], { step: 0, choice: { kind: 'move', move: 1 } });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: 'stale-step', events: [], view: { step: 1, log: { from: 1 } } });

    await choose(c[1], { step: 1, choice: { kind: 'move', move: 1 } });
    await choose(c[2], { step: 1, choice: { kind: 'move', move: 1 } });
    // Tauros is now locked into Double-Edge by its Choice Band.
    const rejected = await choose(c[1], { step: 2, choice: { kind: 'move', move: 2 } });
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toMatchObject({
      error: 'invalid-choice',
      message: expect.stringContaining('disabled'),
      view: { step: 2, chosen: false },
    });

    const room = await started();
    const notAsked = await choose(room[1], { step: 0, choice: { kind: 'move', move: 1 } });
    expect(notAsked.status).toBe(409);
    expect(await notAsked.json()).toMatchObject({ error: 'Not your turn.', view: { stage: 'team-order' } });

    const draft = clients(await draftedRoom(db));
    const none = await choose(draft[1], { step: 0, choice: { kind: 'move', move: 1 } });
    expect(none.status).toBe(409);
    expect(await none.json()).toEqual({ error: 'No battle yet.' });

    // Three timeouts for both: abandoned.
    for (let i = 0; i < 3; i++) {
      const v = await view(room[1]);
      now = v.deadline! + GRACE_MS;
      await timeout(room[1], { step: v.step });
    }
    const end = await view(room[1]);
    expect(end.result).toEqual({ winner: null, reason: 'abandoned' });
    const over = await choose(room[1], { step: end.step, choice: { kind: 'move', move: 1 } });
    expect(over.status).toBe(409);
    expect(await over.json()).toMatchObject({ error: 'The battle is over.', view: { stage: 'ended' } });
  });

  it('a payload over 60 000 bytes is published with lines: null', async () => {
    const c = await inProgress();
    huge.on = true;
    await choose(c[1], { step: 1, choice: { kind: 'move', move: 1 } });
    const body = await (await choose(c[2], { step: 1, choice: { kind: 'move', move: 1 } })).json();
    expect(published()).toEqual([expect.objectContaining({ kind: 'battle-step', step: 2, lines: null })]);
    expect(body.events).toEqual(published());
  });
});

describe('busy', () => {
  it('a compare-and-swap that keeps losing is 503', async () => {
    const c = await inProgress();
    casHooks.beforeWrite = async () => {
      await db
        .update(battles)
        .set({ version: sql`${battles.version} + 1` })
        .where(eq(battles.roomCode, c[1].code));
    };
    const res = await choose(c[1], { step: 1, choice: { kind: 'move', move: 1 } });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Busy, try again.' });
    expect(notifyRoomEvent).not.toHaveBeenCalled();
  });
});

describe('POST battle/timeout', () => {
  it('validates, then applies due timeouts once', async () => {
    const c = await inProgress();
    expect((await timeout(c[1], {})).status).toBe(400);
    expect((await timeout(c[1], { step: 'x' })).status).toBe(400);
    const draft = clients(await draftedRoom(db));
    const none = await timeout(draft[1], { step: 0 });
    expect(none.status).toBe(409);
    expect(await none.json()).toEqual({ error: 'No battle yet.' });

    const early = await timeout(c[1], { step: 1 });
    expect(await early.json()).toMatchObject({ ok: true, events: [], view: { step: 1 } });

    now = T0 + TIMER_MS + GRACE_MS;
    const due = await timeout(c[2], { step: 1 });
    const body = await due.json();
    expect(body).toMatchObject({ ok: true, view: { step: 2, log: { from: 2 }, deadline: now + TIMER_MS } });
    expect(body.events).toEqual([expect.objectContaining({ kind: 'battle-step', step: 2, timedOut: [1, 2] })]);
    expect(published()).toEqual(body.events);

    vi.mocked(notifyRoomEvent).mockClear();
    expect(await (await timeout(c[1], { step: 1 })).json()).toMatchObject({ events: [], view: { step: 2 } });
    expect(notifyRoomEvent).not.toHaveBeenCalled();
  });
});

describe('publishing', () => {
  it('publishes each event once, after its state is saved', async () => {
    vi.mocked(notifyRoomEvent).mockImplementation(async (code, event) => {
      const [room] = await db.select({ phase: rooms.phase }).from(rooms).where(eq(rooms.code, code));
      const row = await battleRow(code);
      if (event.kind === 'battle-started') expect(room.phase).toBe('battle');
      if (event.kind === 'battle-order-progress') {
        expect(JSON.parse(event.slot === 1 ? row.p1Order : row.p2Order)).toHaveLength(event.count);
      }
      if (event.kind === 'battle-step') expect(row.step).toBeGreaterThanOrEqual(event.step);
    });
    const c = clients(await draftedRoom(db));
    await start(c[1]);
    await order(c[1], { order: [1, 2, 3] });
    await order(c[2], { order: [1, 2, 3] });
    await choose(c[1], { step: 1, choice: { kind: 'move', move: 1 } });
    await choose(c[2], { step: 1, choice: { kind: 'move', move: 1 } });
    now = T0 + TIMER_MS + GRACE_MS;
    await view(c[1]);
    const kinds = published().map((e) => [e.kind, 'step' in e ? e.step : null]);
    expect(kinds).toEqual([
      ['battle-started', null],
      ['battle-order-progress', null],
      ['battle-order-progress', null],
      ['battle-step', 1],
      ['battle-step', 2],
      ['battle-step', 3],
    ]);
  });

  it('a whole 6v6 keeps every event under 64 KB, and the snapshot grows under 2 KB a turn', async () => {
    const c = await inProgress(6);
    const firstState = (await battleRow(c[1].code)).state.length;
    for (let i = 0; i < 2000; i++) {
      const v = await view(c[1]);
      if (v.stage === 'ended') break;
      for (const slot of [1, 2] as const) {
        const mine = slot === 1 ? v : await view(c[2]);
        if (mine.asked[slot] && !mine.chosen) await choose(c[slot], { step: v.step, choice: pick(mine) });
      }
    }
    const row = await battleRow(c[1].code);
    // An all-fainted win: the result is saved with the last step, and published with it.
    const { battle } = restoreBattle(row.state);
    const winner = battle.winner === 'P1' ? 1 : 2;
    expect(['P1', 'P2']).toContain(battle.winner);
    // The end screen gets its own deadline, from the step that ended the battle.
    expect(row).toMatchObject({ stage: 'ended', winner, endReason: 'normal', deadline: row.updatedAt + TIMER_MS });
    const last = published().at(-1) as BattleEvent;
    expect(last).toMatchObject({ kind: 'battle-step', step: row.step, deadline: row.deadline, result: { winner, reason: 'normal' } });
    expect((last as { lines: string[] }).lines).toContain(`|win|P${winner}`);
    for (const event of published()) {
      expect(Buffer.byteLength(JSON.stringify(event), 'utf8')).toBeLessThan(64 * 1024);
    }
    const turns = battle.turn;
    expect((row.state.length - firstState) / turns).toBeLessThan(2048);
  });
});
