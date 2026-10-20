// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Db } from '@/db/client';
import { POKEMON } from '@/data/pokemon';
import { createTestDb } from '@/tests/helpers/test-db';
import { chooseDraftOrder, createRoom, getRoomState, joinRoom, pickPokemon, pickType, startTypeBattle } from '@/lib/rooms';
import { draftTurn, TOTAL_PICKS } from '@/lib/draft';
import type { Slot } from '@/lib/types';

const T0 = 1_000_000;
const ubers = POKEMON.filter((p) => p.isUber).map((p) => p.id);
const others = POKEMON.filter((p) => !p.isUber).map((p) => p.id);

/** A room where the guest won the type battle and chose `order`. */
async function draftRoom(db: Db, order: 'first' | 'second') {
  const host = await createRoom(db, 'Ash', T0);
  const joined = await joinRoom(db, host.code, 'Misty', T0, null);
  if (joined.kind !== 'joined') throw new Error('join failed');
  const room = { code: host.code, 1: host.secret, 2: joined.secret } as const;
  await startTypeBattle(db, room.code, room[1], T0);
  await pickType(db, room.code, room[1], 'fire', T0);
  await pickType(db, room.code, room[2], 'water', T0);
  await chooseDraftOrder(db, room.code, room[2], order, T0);
  return room;
}

const state = async (db: Db, code: string, secret: string) => (await getRoomState(db, code, secret, T0))!;

describe('draft', () => {
  it('starts once the winner chooses the order, the same for both players', async () => {
    const db = await createTestDb();
    const room = await draftRoom(db, 'second');
    const host = await state(db, room.code, room[1]);
    expect(host.phase).toBe('draft');
    expect(host.typeBattle).toBeNull();
    expect(host.draft).toEqual({ firstDrafter: 1, picks: [] });
    expect((await state(db, room.code, room[2])).draft).toEqual(host.draft);
  });

  it('rejects picks before the draft', async () => {
    const db = await createTestDb();
    const host = await createRoom(db, 'Ash', T0);
    expect(await pickPokemon(db, host.code, host.secret, others[0], T0)).toEqual({ kind: 'not-drafting' });
  });

  it('takes picks in snake order from either first drafter until all 12 are made', async () => {
    for (const order of ['first', 'second'] as const) {
      const db = await createTestDb();
      const room = await draftRoom(db, order);
      const first: Slot = order === 'first' ? 2 : 1;
      const ids = [...others, ...ubers];
      for (let i = 0; i < TOTAL_PICKS; i++) {
        const slot = draftTurn(first, i)!;
        const offTurn: Slot = slot === 1 ? 2 : 1;
        expect(await pickPokemon(db, room.code, room[offTurn], ids[i], T0)).toEqual({ kind: 'not-your-turn' });
        expect(await pickPokemon(db, room.code, room[slot], ids[i], T0)).toEqual({
          kind: 'picked',
          complete: i === TOTAL_PICKS - 1,
        });
      }
      const { draft } = await state(db, room.code, room[1]);
      expect(draft!.picks.map((p) => p.slot)).toEqual(Array.from({ length: TOTAL_PICKS }, (_, i) => draftTurn(first, i)));
      expect(draft!.picks.filter((p) => p.slot === 1)).toHaveLength(6);
      expect(await pickPokemon(db, room.code, room[first], others[0], T0)).toEqual({ kind: 'draft-complete' });
    }
  });

  it('rejects a rented, unknown or second uber pick', async () => {
    expect(ubers.length).toBeGreaterThanOrEqual(2);
    const db = await createTestDb();
    const room = await draftRoom(db, 'first'); // guest, host, host, guest, ...
    await pickPokemon(db, room.code, room[2], ubers[0], T0);
    expect(await pickPokemon(db, room.code, room[1], ubers[0], T0)).toEqual({ kind: 'taken' });
    expect(await pickPokemon(db, room.code, room[1], 'missingno', T0)).toEqual({ kind: 'unknown-pokemon' });
    await pickPokemon(db, room.code, room[1], others[0], T0);
    await pickPokemon(db, room.code, room[1], others[1], T0);
    expect(await pickPokemon(db, room.code, room[2], ubers[1], T0)).toEqual({ kind: 'uber-limit' });
    expect((await state(db, room.code, room[2])).draft!.picks).toHaveLength(3);
  });

  it('a stranger cannot pick', async () => {
    const db = await createTestDb();
    const room = await draftRoom(db, 'first');
    const other = await createRoom(db, 'Gary', T0);
    expect(await pickPokemon(db, room.code, other.secret, others[0], T0)).toEqual({ kind: 'not-found' });
    expect(await pickPokemon(db, room.code, null, others[0], T0)).toEqual({ kind: 'not-found' });
  });
});
