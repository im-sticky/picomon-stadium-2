// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { setDbForTests, type Db } from '@/db/client';
import { rooms } from '@/db/schema';
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

  it('is host only', async () => {
    const room = await ended();
    const res = await close(room.code, room[2]);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Only the host can quit.' });
    expect(notifyRoomEvent).not.toHaveBeenCalled();
    expect(await getRoomState(db, room.code, room[2], now)).not.toBeNull();
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
