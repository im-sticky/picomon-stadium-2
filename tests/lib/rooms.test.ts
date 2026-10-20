// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as schema from '@/db/schema';
import type { Db } from '@/db/client';
import { createTestDb } from '@/tests/helpers/test-db';
import { rooms, players } from '@/db/schema';
import {
  createRoom,
  joinRoom,
  getRoomState,
  findActivePlayer,
  WAITING_TTL_MS,
  FULL_TTL_MS,
} from '@/lib/rooms';

const T0 = 1_000_000;

describe('rooms', () => {
  it('createRoom returns a valid code and the host can read the room', async () => {
    const db = await createTestDb();
    const { code, secret, playerId } = await createRoom(db, 'Ash', T0);
    expect(code).toMatch(/^[A-Z0-9]{4}$/);
    expect(await getRoomState(db, code, secret, T0)).toEqual({
      code,
      you: { id: playerId, slot: 1 },
      players: [{ id: playerId, name: 'Ash', slot: 1 }],
      phase: 'lobby',
      typeBattle: null,
    });
    expect(await findActivePlayer(db, secret, T0)).toEqual({ id: playerId, roomCode: code });
    expect(await findActivePlayer(db, null, T0)).toBeNull();
  });

  it('joinRoom adds player 2 and returns both players', async () => {
    const db = await createTestDb();
    const { code } = await createRoom(db, 'Ash', T0);
    const r = await joinRoom(db, code, 'Misty', T0 + 1, null);
    expect(r.kind).toBe('joined');
    if (r.kind !== 'joined') return;
    expect(r.players.map((p) => p.name)).toEqual(['Ash', 'Misty']);
    expect(r.players.map((p) => p.slot)).toEqual([1, 2]);
    expect(r.code).toBe(code);
    expect(r.secret).toBeTruthy();
  });

  it('joinRoom on a full room returns full', async () => {
    const db = await createTestDb();
    const { code } = await createRoom(db, 'A', T0);
    await joinRoom(db, code, 'B', T0, null);
    expect((await joinRoom(db, code, 'C', T0, null)).kind).toBe('full');
  });

  it('two simultaneous joins: exactly one joins', async () => {
    // A single in-memory libsql client holds one connection, so it cannot run
    // two transactions at once. Use a file-backed DB with two clients instead.
    const dir = mkdtempSync(path.join(tmpdir(), 'rooms-test-'));
    const url = `file:${path.join(dir, 'test.db')}`;
    const open = (): Db => drizzle(createClient({ url }), { schema });
    try {
      const dbA = open();
      const dbB = open();
      await migrate(dbA, { migrationsFolder: 'drizzle' });
      const { code } = await createRoom(dbA, 'A', T0);
      const results = await Promise.all([
        joinRoom(dbA, code, 'B', T0, null),
        joinRoom(dbB, code, 'C', T0, null),
      ]);
      expect(results.map((r) => r.kind).sort()).toEqual(['full', 'joined']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('joinRoom with unknown code returns not-found', async () => {
    const db = await createTestDb();
    expect(await joinRoom(db, 'ZZZZ', 'B', T0, null)).toEqual({ kind: 'not-found' });
  });

  it('waiting room expires after 30 min', async () => {
    const db = await createTestDb();
    const { code, secret } = await createRoom(db, 'A', T0);
    expect(await joinRoom(db, code, 'B', T0 + WAITING_TTL_MS, null)).toEqual({ kind: 'not-found' });
    expect(await getRoomState(db, code, secret, T0 + WAITING_TTL_MS)).toBeNull();
  });

  it('full room lives 24 h from creation', async () => {
    const db = await createTestDb();
    const { code, secret } = await createRoom(db, 'A', T0);
    await joinRoom(db, code, 'B', T0 + 1000, null);
    expect(await getRoomState(db, code, secret, T0 + WAITING_TTL_MS + 1)).not.toBeNull();
    expect(await getRoomState(db, code, secret, T0 + FULL_TTL_MS)).toBeNull();
  });

  it('existing member re-entering the code is already-member', async () => {
    const db = await createTestDb();
    const { code, secret } = await createRoom(db, 'A', T0);
    expect(await joinRoom(db, code, 'A2', T0, secret)).toEqual({ kind: 'already-member', code });
    expect(await db.select().from(players).where(eq(players.roomCode, code))).toHaveLength(1);
  });

  it('getRoomState returns null for a secret from another room', async () => {
    const db = await createTestDb();
    const a = await createRoom(db, 'A', T0);
    const b = await createRoom(db, 'B', T0);
    expect(await getRoomState(db, a.code, b.secret, T0)).toBeNull();
    expect(await getRoomState(db, a.code, null, T0)).toBeNull();
  });

  it('expired rooms are cleaned up on createRoom', async () => {
    const db = await createTestDb();
    const old = await createRoom(db, 'A', T0);
    await createRoom(db, 'B', T0 + FULL_TTL_MS);
    expect(await db.select().from(rooms)).toHaveLength(1);
    expect(await db.select().from(players).where(eq(players.roomCode, old.code))).toHaveLength(0);
  });
});
