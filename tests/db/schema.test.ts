// @vitest-environment node
import { test, expect } from 'vitest';
import { createTestDb } from '../helpers/test-db';
import { rooms, players } from '@/db/schema';

test('rejects a second player in the same slot', async () => {
  const db = await createTestDb();
  await db.insert(rooms).values({ code: 'K7PQ', createdAt: 0, expiresAt: 1 });
  await db.insert(players).values({ id: 'a', secret: 'sa', roomCode: 'K7PQ', name: 'A', slot: 2, joinedAt: 0 });
  await expect(
    db.insert(players).values({ id: 'b', secret: 'sb', roomCode: 'K7PQ', name: 'B', slot: 2, joinedAt: 0 }),
  ).rejects.toThrow();
});
