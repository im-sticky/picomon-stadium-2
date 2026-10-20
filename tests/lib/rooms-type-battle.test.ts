// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as schema from '@/db/schema';
import type { Db } from '@/db/client';
import { createTestDb } from '@/tests/helpers/test-db';
import {
  chooseDraftOrder,
  createRoom,
  getRoomState,
  joinRoom,
  pickType,
  playTypeBattleAgain,
  startTypeBattle,
} from '@/lib/rooms';

const T0 = 1_000_000;

async function fullRoom(db: Db) {
  const host = await createRoom(db, 'Ash', T0);
  const joined = await joinRoom(db, host.code, 'Misty', T0, null);
  if (joined.kind !== 'joined') throw new Error('join failed');
  return { code: host.code, host: host.secret, guest: joined.secret };
}

async function startedRoom(db: Db) {
  const room = await fullRoom(db);
  expect(await startTypeBattle(db, room.code, room.host, T0)).toEqual({ kind: 'started' });
  return room;
}

const view = async (db: Db, code: string, secret: string) =>
  (await getRoomState(db, code, secret, T0))!.typeBattle;

describe('type battle', () => {
  it('only the host can start, and only with both players in', async () => {
    const db = await createTestDb();
    const alone = await createRoom(db, 'Ash', T0);
    expect(await startTypeBattle(db, alone.code, alone.secret, T0)).toEqual({ kind: 'not-full' });

    const room = await fullRoom(db);
    expect(await startTypeBattle(db, room.code, room.guest, T0)).toEqual({ kind: 'not-host' });
    expect((await getRoomState(db, room.code, room.host, T0))!.phase).toBe('lobby');

    expect(await startTypeBattle(db, room.code, room.host, T0)).toEqual({ kind: 'started' });
    expect(await startTypeBattle(db, room.code, room.host, T0)).toEqual({ kind: 'already-started' });
    const state = (await getRoomState(db, room.code, room.guest, T0))!;
    expect(state.phase).toBe('type-battle');
    expect(state.typeBattle).toEqual({
      round: 1,
      yourPick: null,
      opponentPick: null,
      winner: null,
      firstDrafter: null,
    });
  });

  it('no picks before the battle starts', async () => {
    const db = await createTestDb();
    const room = await fullRoom(db);
    expect(await pickType(db, room.code, room.host, 'fire', T0)).toEqual({ kind: 'not-picking' });
  });

  it("hides the opponent's pick until both have picked", async () => {
    const db = await createTestDb();
    const room = await startedRoom(db);
    expect(await pickType(db, room.code, room.host, 'fire', T0)).toEqual({ kind: 'picked', resolved: false });

    expect(await view(db, room.code, room.host)).toMatchObject({ yourPick: 'fire', opponentPick: null });
    expect(await view(db, room.code, room.guest)).toMatchObject({ yourPick: null, opponentPick: null });

    expect(await pickType(db, room.code, room.guest, 'grass', T0)).toEqual({ kind: 'picked', resolved: true });
    expect(await view(db, room.code, room.host)).toMatchObject({ yourPick: 'fire', opponentPick: 'grass', winner: 1 });
    expect(await view(db, room.code, room.guest)).toMatchObject({ yourPick: 'grass', opponentPick: 'fire', winner: 1 });
  });

  it('rejects a second pick in the same round', async () => {
    const db = await createTestDb();
    const room = await startedRoom(db);
    await pickType(db, room.code, room.guest, 'water', T0);
    expect(await pickType(db, room.code, room.guest, 'fire', T0)).toEqual({ kind: 'already-picked' });
    expect(await view(db, room.code, room.guest)).toMatchObject({ yourPick: 'water' });
  });

  it('no more picks once the battle is decided', async () => {
    const db = await createTestDb();
    const room = await startedRoom(db);
    await pickType(db, room.code, room.host, 'water', T0);
    await pickType(db, room.code, room.guest, 'grass', T0);
    expect(await view(db, room.code, room.host)).toMatchObject({ winner: 2 });
    expect(await pickType(db, room.code, room.host, 'fire', T0)).toEqual({ kind: 'not-picking' });
  });

  it('a draw starts a new round once, whichever player asks', async () => {
    const db = await createTestDb();
    const room = await startedRoom(db);
    await pickType(db, room.code, room.host, 'grass', T0);
    expect(await playTypeBattleAgain(db, room.code, room.host, 1, T0)).toEqual({ kind: 'not-draw' });
    await pickType(db, room.code, room.guest, 'grass', T0);
    expect(await view(db, room.code, room.host)).toMatchObject({
      round: 1,
      yourPick: 'grass',
      opponentPick: 'grass',
      winner: null,
    });

    expect(await playTypeBattleAgain(db, room.code, room.guest, 1, T0)).toEqual({ kind: 'new-round' });
    // Both clients ask for the next round; the second request doesn't skip another round.
    expect(await playTypeBattleAgain(db, room.code, room.host, 1, T0)).toEqual({ kind: 'already-new-round' });
    expect(await view(db, room.code, room.host)).toMatchObject({ round: 2, yourPick: null, opponentPick: null });
    // A stale request for round 1 arriving later is ignored too.
    expect(await playTypeBattleAgain(db, room.code, room.guest, 1, T0)).toEqual({ kind: 'already-new-round' });
    expect(await view(db, room.code, room.host)).toMatchObject({ round: 2 });

    expect(await pickType(db, room.code, room.host, 'fire', T0)).toEqual({ kind: 'picked', resolved: false });
    expect(await pickType(db, room.code, room.guest, 'water', T0)).toEqual({ kind: 'picked', resolved: true });
    expect(await view(db, room.code, room.host)).toMatchObject({ round: 2, winner: 2 });
  });

  it('a new round is rejected after a decided round', async () => {
    const db = await createTestDb();
    const room = await startedRoom(db);
    await pickType(db, room.code, room.host, 'grass', T0);
    await pickType(db, room.code, room.guest, 'water', T0);
    expect(await playTypeBattleAgain(db, room.code, room.guest, 1, T0)).toEqual({ kind: 'not-draw' });
  });

  it('only the winner chooses the order, once', async () => {
    const db = await createTestDb();
    const room = await startedRoom(db);
    expect(await chooseDraftOrder(db, room.code, room.host, 'first', T0)).toEqual({ kind: 'not-decided' });
    await pickType(db, room.code, room.host, 'fire', T0);
    await pickType(db, room.code, room.guest, 'water', T0);

    expect(await chooseDraftOrder(db, room.code, room.host, 'first', T0)).toEqual({ kind: 'not-winner' });
    expect(await chooseDraftOrder(db, room.code, room.guest, 'second', T0)).toEqual({
      kind: 'chosen',
      firstDrafter: 1,
    });
    expect(await chooseDraftOrder(db, room.code, room.guest, 'first', T0)).toEqual({ kind: 'already-chosen' });
    expect(await view(db, room.code, room.host)).toMatchObject({ winner: 2, firstDrafter: 1 });
    expect(await view(db, room.code, room.guest)).toMatchObject({ winner: 2, firstDrafter: 1 });
  });

  it('a stranger cannot act on the room', async () => {
    const db = await createTestDb();
    const room = await startedRoom(db);
    const other = await createRoom(db, 'Gary', T0);
    expect(await pickType(db, room.code, other.secret, 'fire', T0)).toEqual({ kind: 'not-found' });
    expect(await pickType(db, room.code, null, 'fire', T0)).toEqual({ kind: 'not-found' });
    expect(await startTypeBattle(db, room.code, other.secret, T0)).toEqual({ kind: 'not-found' });
  });

  describe('concurrency', () => {
    // A single in-memory libsql client holds one connection, so it cannot run two
    // transactions at once. Use a file-backed DB with two clients instead.
    //
    // Locally, the loser of the BEGIN IMMEDIATE race gets SQLITE_BUSY, and libsql
    // leaves that connection unable to commit, so its retries can fail too (Turso's
    // remote client doesn't have this problem). The tests therefore check the
    // invariants that matter whichever request loses: the round is never resolved
    // twice, and a round with both picks stored is always resolved.
    async function withTwoClients(fn: (a: Db, b: Db) => Promise<void>) {
      const dir = mkdtempSync(path.join(tmpdir(), 'type-battle-test-'));
      const url = `file:${path.join(dir, 'test.db')}`;
      const open = (): Db => drizzle(createClient({ url }), { schema });
      try {
        const a = open();
        await migrate(a, { migrationsFolder: 'drizzle' });
        await fn(a, open());
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    it('simultaneous picks by both players resolve exactly once', async () => {
      await withTwoClients(async (a, b) => {
        const room = await startedRoom(a);
        const settled = await Promise.allSettled([
          pickType(a, room.code, room.host, 'grass', T0),
          pickType(b, room.code, room.guest, 'water', T0),
        ]);
        const picked = settled.flatMap((r) => (r.status === 'fulfilled' && r.value.kind === 'picked' ? [r.value] : []));
        const resolutions = picked.filter((r) => r.resolved).length;
        const state = await view(a, room.code, room.guest);
        if (picked.length === 2) {
          expect(resolutions).toBe(1);
          expect(state).toMatchObject({ yourPick: 'water', opponentPick: 'grass', winner: 1 });
        } else {
          // One request lost the lock race (and its pick was not stored).
          expect(picked).toHaveLength(1);
          expect(resolutions).toBe(0);
          expect(state).toMatchObject({ opponentPick: null, winner: null });
        }
      });
    });

    it('a simultaneous double pick by one player stores only one pick', async () => {
      await withTwoClients(async (a, b) => {
        const room = await startedRoom(a);
        const settled = await Promise.allSettled([
          pickType(a, room.code, room.host, 'grass', T0),
          pickType(b, room.code, room.host, 'fire', T0),
        ]);
        const kinds = settled.map((r) => (r.status === 'fulfilled' ? r.value.kind : 'busy'));
        expect(kinds.filter((k) => k === 'picked')).toHaveLength(1);
        const stored = (await view(a, room.code, room.host))!.yourPick;
        expect(stored).toBe(kinds[0] === 'picked' ? 'grass' : 'fire');
      });
    });
  });
});
