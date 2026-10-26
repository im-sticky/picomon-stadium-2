// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Db } from '@/db/client';
import { createTestDb } from '@/tests/helpers/test-db';
import { readyAndStart } from '@/tests/helpers/lobby';
import { createRoom, getRoomState, joinRoom, setReady, setRoomOptions } from '@/lib/rooms';
import { START_COUNTDOWN_MS } from '@/lib/types';

const T0 = 1_000_000;

async function fullRoom(db: Db) {
  const host = await createRoom(db, 'Ash', T0);
  const joined = await joinRoom(db, host.code, 'Misty', T0, null);
  if (joined.kind !== 'joined') throw new Error('join failed');
  return { code: host.code, 1: host.secret, 2: joined.secret } as const;
}

const lobby = async (db: Db, code: string, secret: string, now = T0) =>
  (await getRoomState(db, code, secret, now))!.lobby;

describe('lobby: room options', () => {
  it('only the host changes them; the guest reads them', async () => {
    const db = await createTestDb();
    const room = await fullRoom(db);
    expect(await setRoomOptions(db, room.code, room[2], { battleSize: 3, draftType: 'pokeball' }, T0)).toEqual({
      kind: 'not-host',
    });
    expect(await setRoomOptions(db, room.code, room[1], { battleSize: 3, draftType: 'pokeball' }, T0 + 5)).toEqual({
      kind: 'updated',
      battleSize: 3,
      draftType: 'pokeball',
      lobby: { version: 1, ready: { 1: false, 2: false }, startAt: null, optionsChanged: false, serverNow: T0 + 5 },
    });
    const guest = (await getRoomState(db, room.code, room[2], T0))!;
    expect([guest.battleSize, guest.draftType]).toEqual([3, 'pokeball']);
  });

  it('works before the guest joins', async () => {
    const db = await createTestDb();
    const host = await createRoom(db, 'Ash', T0);
    expect(
      (await setRoomOptions(db, host.code, host.secret, { battleSize: 4, draftType: 'unlimited' }, T0)).kind,
    ).toBe('updated');
    const joined = await joinRoom(db, host.code, 'Misty', T0, null);
    if (joined.kind !== 'joined') throw new Error('join failed');
    const guest = (await getRoomState(db, host.code, joined.secret, T0))!;
    expect([guest.battleSize, guest.draftType]).toEqual([4, 'unlimited']);
  });

  it('picking the current options changes nothing and keeps READY', async () => {
    const db = await createTestDb();
    const room = await fullRoom(db);
    await setReady(db, room.code, room[2], true, T0);
    expect(await setRoomOptions(db, room.code, room[1], { battleSize: 6, draftType: 'standard' }, T0)).toEqual({
      kind: 'unchanged',
    });
    expect(await lobby(db, room.code, room[1])).toMatchObject({ version: 1, ready: { 1: false, 2: true } });
  });

  it('a change clears both READYs and the countdown, and says so if anyone was ready', async () => {
    const db = await createTestDb();
    const room = await fullRoom(db);
    await setReady(db, room.code, room[1], true, T0);
    await setReady(db, room.code, room[2], true, T0);
    expect(await lobby(db, room.code, room[1])).toMatchObject({ startAt: T0 + START_COUNTDOWN_MS, version: 2 });

    await setRoomOptions(db, room.code, room[1], { battleSize: 4, draftType: 'standard' }, T0 + 500);
    expect(await lobby(db, room.code, room[2])).toMatchObject({
      version: 3,
      ready: { 1: false, 2: false },
      startAt: null,
      optionsChanged: true,
    });

    // Nobody was ready this time: the message goes.
    await setRoomOptions(db, room.code, room[1], { battleSize: 4, draftType: 'pokeball' }, T0 + 600);
    expect(await lobby(db, room.code, room[2])).toMatchObject({ version: 4, optionsChanged: false });
  });

  it('a stranger or a missing room is not-found', async () => {
    const db = await createTestDb();
    const room = await fullRoom(db);
    const other = await createRoom(db, 'Gary', T0);
    const options = { battleSize: 3, draftType: 'standard' } as const;
    expect(await setRoomOptions(db, room.code, other.secret, options, T0)).toEqual({ kind: 'not-found' });
    expect(await setRoomOptions(db, room.code, null, options, T0)).toEqual({ kind: 'not-found' });
    expect(await setReady(db, 'ZZZZ', room[1], true, T0)).toEqual({ kind: 'not-found' });
  });
});

describe('lobby: READY', () => {
  it('needs an opponent', async () => {
    const db = await createTestDb();
    const host = await createRoom(db, 'Ash', T0);
    expect(await setReady(db, host.code, host.secret, true, T0)).toEqual({ kind: 'not-full' });
  });

  it('is idempotent; the second READY sets the countdown and CANCEL READY clears it', async () => {
    const db = await createTestDb();
    const room = await fullRoom(db);
    expect(await setReady(db, room.code, room[1], true, T0)).toMatchObject({
      kind: 'updated',
      lobby: { version: 1, ready: { 1: true, 2: false }, startAt: null },
    });
    expect(await setReady(db, room.code, room[1], true, T0)).toEqual({ kind: 'unchanged' });
    expect(await setReady(db, room.code, room[2], true, T0 + 300)).toMatchObject({
      kind: 'updated',
      lobby: { version: 2, ready: { 1: true, 2: true }, startAt: T0 + 300 + START_COUNTDOWN_MS },
    });
    expect(await setReady(db, room.code, room[1], false, T0 + 400)).toMatchObject({
      kind: 'updated',
      lobby: { version: 3, ready: { 1: false, 2: true }, startAt: null },
    });
    expect(await setReady(db, room.code, room[1], false, T0 + 400)).toEqual({ kind: 'unchanged' });
  });

  it('READY clears "Battle options changed."', async () => {
    const db = await createTestDb();
    const room = await fullRoom(db);
    await setReady(db, room.code, room[2], true, T0);
    await setRoomOptions(db, room.code, room[1], { battleSize: 3, draftType: 'standard' }, T0);
    expect((await lobby(db, room.code, room[1]))!.optionsChanged).toBe(true);
    await setReady(db, room.code, room[2], true, T0);
    expect((await lobby(db, room.code, room[1]))!.optionsChanged).toBe(false);
  });

  it('getRoomState has the lobby only in the lobby', async () => {
    const db = await createTestDb();
    const room = await fullRoom(db);
    expect(await lobby(db, room.code, room[1], T0 + 7)).toEqual({
      version: 0,
      ready: { 1: false, 2: false },
      startAt: null,
      optionsChanged: false,
      serverNow: T0 + 7,
    });
    await readyAndStart(db, room.code, room, T0);
    expect(await lobby(db, room.code, room[1])).toBeNull();
  });
});
