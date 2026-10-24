// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { setDbForTests, type Db } from '@/db/client';
import { battles, draftPicks, rooms, typePicks } from '@/db/schema';
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

import { notifyRoomEvent } from '@/lib/ably-server';
import { startBattle, submitOrder, triggerTimeout } from '@/lib/battle';
import { GRACE_MS, TIMER_MS } from '@/lib/battle-types';
import { createRoom, getRoomState, joinRoom } from '@/lib/rooms';
import { POST as closeRoute } from '@/app/api/rooms/[code]/close/route';
import { POST as rematchRoute } from '@/app/api/rooms/[code]/rematch/route';
import { POST as timeoutRoute } from '@/app/api/rooms/[code]/battle/timeout/route';
import { GET as battleRoute } from '@/app/api/rooms/[code]/battle/route';
import { GET as roomRoute } from '@/app/api/rooms/[code]/route';
import { POST as joinRoute } from '@/app/api/rooms/[code]/join/route';

let db: Db;
let now = T0;

function req(path: string, method: string, body?: unknown, secret?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: secret ? { cookie: `picomon_player=${secret}` } : {},
  });
}
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const close = (code: string, secret?: string) => closeRoute(req(`/api/rooms/${code}/close`, 'POST', {}, secret), ctx(code));
const rematch = (code: string, secret?: string) =>
  rematchRoute(req(`/api/rooms/${code}/rematch`, 'POST', {}, secret), ctx(code));

/** A 3v3 battle that's in progress at step 1. */
async function inProgress(): Promise<TestRoom> {
  const room = await draftedRoom(db);
  expect(await startBattle(db, room.code, room[1], now)).toMatchObject({ kind: 'started' });
  await submitOrder(db, room.code, room[1], [1, 2, 3], now);
  await submitOrder(db, room.code, room[2], [1, 2, 3], now);
  return room;
}

/** A battle that ended for real: both players let the clock run out three times (abandoned). */
async function ended(): Promise<TestRoom> {
  const room = await inProgress();
  for (let i = 0; i < 3; i++) {
    now += TIMER_MS + GRACE_MS;
    await triggerTimeout(db, room.code, room[1], i + 1, now);
  }
  expect((await getRoomState(db, room.code, room[1], now))?.battle).toMatchObject({ stage: 'ended' });
  vi.mocked(notifyRoomEvent).mockClear();
  return room;
}

beforeEach(async () => {
  vi.clearAllMocks();
  now = T0;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  db = await createTestDb();
  setDbForTests(db);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST close (QUIT)', () => {
  it('closes an ended battle for the host and publishes room-closed once', async () => {
    const room = await ended();
    const res = await close(room.code, room[1]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, event: { kind: 'room-closed' } });
    expect(vi.mocked(notifyRoomEvent).mock.calls).toEqual([[room.code, { kind: 'room-closed' }]]);
    // Closed means expired now, so the room's rows go with the next cleanup.
    const [row] = await db.select({ expiresAt: rooms.expiresAt }).from(rooms).where(eq(rooms.code, room.code));
    expect(row.expiresAt).toBe(now);
  });

  it('publishes after the room is closed', async () => {
    const room = await ended();
    vi.mocked(notifyRoomEvent).mockImplementation(async () => {
      expect(await getRoomState(db, room.code, room[1], now)).toBeNull();
    });
    expect((await close(room.code, room[1])).status).toBe(200);
    expect(notifyRoomEvent).toHaveBeenCalledTimes(1);
  });

  it('lets the guest quit too', async () => {
    const room = await ended();
    const res = await close(room.code, room[2]);
    expect(res.status).toBe(200);
    expect(vi.mocked(notifyRoomEvent).mock.calls).toEqual([[room.code, { kind: 'room-closed' }]]);
    expect(await getRoomState(db, room.code, room[1], now)).toBeNull();
  });

  it('still works after a rematch request', async () => {
    const room = await ended();
    expect((await rematch(room.code, room[1])).status).toBe(200);
    expect((await close(room.code, room[2])).status).toBe(200);
    expect(await getRoomState(db, room.code, room[1], now)).toBeNull();
  });

  it('needs the battle to have ended', async () => {
    const lobby = await createRoom(db, 'Ash', now, 3);
    expect((await close(lobby.code, lobby.secret)).status).toBe(409);

    const drafted = await draftedRoom(db);
    expect((await close(drafted.code, drafted[1])).status).toBe(409);

    const room = await inProgress();
    const res = await close(room.code, room[1]);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'The battle is not over.' });
    expect(notifyRoomEvent).not.toHaveBeenCalled();
    expect(await getRoomState(db, room.code, room[1], now)).not.toBeNull();
  });

  it('is 404 without a cookie, for a non-member, and once closed', async () => {
    const room = await ended();
    expect((await close(room.code)).status).toBe(404);
    expect((await close(room.code, 'not-a-member')).status).toBe(404);
    expect((await close('ZZZZ', room[1])).status).toBe(404);
    expect((await close(room.code, room[1])).status).toBe(200);
    expect((await close(room.code, room[1])).status).toBe(404);
    expect(notifyRoomEvent).toHaveBeenCalledTimes(1);
  });

  it('leaves a closed room unloadable and unjoinable', async () => {
    const room = await ended();
    expect((await close(room.code, room[1])).status).toBe(200);

    for (const secret of [room[1], room[2]]) {
      expect((await roomRoute(req(`/api/rooms/${room.code}`, 'GET', undefined, secret), ctx(room.code))).status).toBe(404);
    }
    expect(await joinRoom(db, room.code, 'Brock', now, null)).toEqual({ kind: 'not-found' });
    const join = await joinRoute(req(`/api/rooms/${room.code}/join`, 'POST', { trainer: 'brock' }), ctx(room.code));
    expect(join.status).toBe(404);
  });
});

describe('the end screen countdown', () => {
  it('gives the end screen its own deadline', async () => {
    const room = await ended();
    const res = await battleRoute(req(`/api/rooms/${room.code}/battle`, 'GET', undefined, room[1]), ctx(room.code));
    expect(await res.json()).toMatchObject({ stage: 'ended', deadline: now + TIMER_MS, rematch: null });
  });

  it('closes the room once it runs out, and publishes room-closed', async () => {
    const room = await ended();
    const [{ step }] = await db.select({ step: battles.step }).from(battles).where(eq(battles.roomCode, room.code));
    const timeout = () =>
      timeoutRoute(req(`/api/rooms/${room.code}/battle/timeout`, 'POST', { step }, room[2]), ctx(room.code));

    now += TIMER_MS + GRACE_MS - 1;
    expect((await timeout()).status).toBe(200);
    expect(notifyRoomEvent).not.toHaveBeenCalled();

    now += 1;
    expect((await timeout()).status).toBe(404);
    expect(vi.mocked(notifyRoomEvent).mock.calls).toEqual([[room.code, { kind: 'room-closed' }]]);
    expect(await getRoomState(db, room.code, room[1], now)).toBeNull();
  });

  it('closes the room when its view is read after the time is up', async () => {
    const room = await ended();
    now += TIMER_MS + GRACE_MS;
    const res = await battleRoute(req(`/api/rooms/${room.code}/battle`, 'GET', undefined, room[1]), ctx(room.code));
    expect(res.status).toBe(404);
    expect(vi.mocked(notifyRoomEvent).mock.calls).toEqual([[room.code, { kind: 'room-closed' }]]);
  });
});

describe('POST rematch', () => {
  it('records the first ask and tells the other player', async () => {
    const room = await ended();
    const res = await rematch(room.code, room[2]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, event: { kind: 'rematch-requested', slot: 2 } });
    expect(vi.mocked(notifyRoomEvent).mock.calls).toEqual([[room.code, { kind: 'rematch-requested', slot: 2 }]]);
    const view = await battleRoute(req(`/api/rooms/${room.code}/battle`, 'GET', undefined, room[1]), ctx(room.code));
    expect(await view.json()).toMatchObject({ rematch: 2 });

    // Asking again changes nothing.
    vi.mocked(notifyRoomEvent).mockClear();
    expect(await (await rematch(room.code, room[2])).json()).toEqual({ ok: true });
    expect(notifyRoomEvent).not.toHaveBeenCalled();
  });

  it('starts a new game at the type battle when both ask, keeping the settings', async () => {
    const room = await ended();
    const before = await getRoomState(db, room.code, room[1], now);
    await rematch(room.code, room[1]);
    vi.mocked(notifyRoomEvent).mockClear();

    const res = await rematch(room.code, room[2]);
    expect(await res.json()).toEqual({ ok: true, event: { kind: 'rematch-started', game: 2 } });
    expect(vi.mocked(notifyRoomEvent).mock.calls).toEqual([[room.code, { kind: 'rematch-started', game: 2 }]]);

    const after = await getRoomState(db, room.code, room[2], now);
    expect(after).toMatchObject({
      game: 2,
      phase: 'type-battle',
      battleSize: before!.battleSize,
      draftType: before!.draftType,
      players: before!.players,
      typeBattle: { round: 1, yourPick: null, opponentPick: null, winner: null, firstDrafter: null },
      draft: null,
      battle: null,
    });
    for (const table of [battles, draftPicks, typePicks]) {
      expect(await db.select().from(table).where(eq(table.roomCode, room.code))).toEqual([]);
    }
    // The battle is gone, so a late battle read says so.
    const late = await battleRoute(req(`/api/rooms/${room.code}/battle`, 'GET', undefined, room[1]), ctx(room.code));
    expect(late.status).toBe(409);
  });

  it('needs the battle to have ended', async () => {
    const room = await inProgress();
    expect((await rematch(room.code, room[1])).status).toBe(409);
    expect(notifyRoomEvent).not.toHaveBeenCalled();
  });

  it('closes the room instead once the end screen time is up', async () => {
    const room = await ended();
    await rematch(room.code, room[1]);
    vi.mocked(notifyRoomEvent).mockClear();
    now += TIMER_MS + GRACE_MS;
    expect((await rematch(room.code, room[2])).status).toBe(404);
    expect(vi.mocked(notifyRoomEvent).mock.calls).toEqual([[room.code, { kind: 'room-closed' }]]);
    expect(await getRoomState(db, room.code, room[1], now)).toBeNull();
  });

  it('is 404 without a cookie or for a non-member', async () => {
    const room = await ended();
    expect((await rematch(room.code)).status).toBe(404);
    expect((await rematch(room.code, 'not-a-member')).status).toBe(404);
  });
});
