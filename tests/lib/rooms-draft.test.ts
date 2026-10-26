// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Db } from '@/db/client';
import { POKEMON } from '@/data/pokemon';
import { createTestDb } from '@/tests/helpers/test-db';
import { chooseDraftOrder, createRoom, getRoomState, joinRoom, pickPokemon, pickType } from '@/lib/rooms';
import { readyAndStart } from '@/tests/helpers/lobby';
import { draftTurn, TOTAL_PICKS } from '@/lib/draft';
import type { DraftType, Slot } from '@/lib/types';

const T0 = 1_000_000;
const masters = POKEMON.filter((p) => p.isMaster).map((p) => p.id);
// Neither master nor ultra, and each holding a different item, so any of them can share a team.
const plain = POKEMON.filter((p) => !p.isMaster && !p.isUltra);
const others = [...new Map(plain.map((p) => [p.set.item, p.id])).values()];

// One per item, so any two of a tier can share a team.
const oneEach = (list: typeof POKEMON) => [...new Map(list.map((p) => [p.set.item, p.id])).values()];
const ultras = oneEach(POKEMON.filter((p) => p.isUltra && !p.isMaster));
const distinctMasters = oneEach(POKEMON.filter((p) => p.isMaster));
const greats = POKEMON.filter((p) => p.isGreat && !p.isUltra && !p.isMaster).map((p) => p.id);
const pokeBalls = POKEMON.filter((p) => !p.isGreat && !p.isUltra && !p.isMaster);

/** A room where the guest won the type battle and chose `order`. */
async function draftRoom(db: Db, order: 'first' | 'second', draftType: DraftType = 'standard') {
  const host = await createRoom(db, 'Ash', T0, 6, { draftType });
  const joined = await joinRoom(db, host.code, 'Misty', T0, null);
  if (joined.kind !== 'joined') throw new Error('join failed');
  const room = { code: host.code, 1: host.secret, 2: joined.secret } as const;
  await readyAndStart(db, room.code, room, T0);
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
      for (let i = 0; i < TOTAL_PICKS; i++) {
        const slot = draftTurn(first, i)!;
        const offTurn: Slot = slot === 1 ? 2 : 1;
        expect(await pickPokemon(db, room.code, room[offTurn], others[i], T0)).toEqual({ kind: 'not-your-turn' });
        expect(await pickPokemon(db, room.code, room[slot], others[i], T0)).toEqual({
          kind: 'picked',
          complete: i === TOTAL_PICKS - 1,
          pickIndex: i,
          slot,
        });
      }
      const { draft } = await state(db, room.code, room[1]);
      expect(draft!.picks.map((p) => p.slot)).toEqual(Array.from({ length: TOTAL_PICKS }, (_, i) => draftTurn(first, i)));
      expect(draft!.picks.filter((p) => p.slot === 1)).toHaveLength(6);
      expect(await pickPokemon(db, room.code, room[first], others[0], T0)).toEqual({ kind: 'draft-complete' });
    }
  });

  it('rejects a rented, unknown or second master pick', async () => {
    expect(masters.length).toBeGreaterThanOrEqual(2);
    const db = await createTestDb();
    const room = await draftRoom(db, 'first'); // guest, host, host, guest, ...
    await pickPokemon(db, room.code, room[2], masters[0], T0);
    expect(await pickPokemon(db, room.code, room[1], masters[0], T0)).toEqual({ kind: 'taken' });
    expect(await pickPokemon(db, room.code, room[1], 'missingno', T0)).toEqual({ kind: 'unknown-pokemon' });
    await pickPokemon(db, room.code, room[1], others[0], T0);
    await pickPokemon(db, room.code, room[1], others[1], T0);
    expect(await pickPokemon(db, room.code, room[2], masters[1], T0)).toEqual({ kind: 'master-limit' });
    expect((await state(db, room.code, room[2])).draft!.picks).toHaveLength(3);
  });

  it('a stranger cannot pick', async () => {
    const db = await createTestDb();
    const room = await draftRoom(db, 'first');
    const other = await createRoom(db, 'Gary', T0);
    expect(await pickPokemon(db, room.code, other.secret, others[0], T0)).toEqual({ kind: 'not-found' });
    expect(await pickPokemon(db, room.code, null, others[0], T0)).toEqual({ kind: 'not-found' });
  });

  /** The guest drafts first: guest, host, host, guest, guest, ... Returns after the guest's first pick. */
  async function twoUltrasFor(draftType: DraftType) {
    expect(ultras.length).toBeGreaterThanOrEqual(2);
    const db = await createTestDb();
    const room = await draftRoom(db, 'first', draftType);
    expect(await pickPokemon(db, room.code, room[2], ultras[0], T0)).toMatchObject({ kind: 'picked' });
    await pickPokemon(db, room.code, room[1], others[0], T0);
    await pickPokemon(db, room.code, room[1], others[1], T0);
    return pickPokemon(db, room.code, room[2], ultras[1], T0);
  }

  it('a standard draft allows one Ultra Ball Pokémon per team', async () => {
    expect(await twoUltrasFor('standard')).toEqual({ kind: 'ultra-limit' });
  });

  it('an unlimited draft allows two Ultra Ball Pokémon, and two masters, on one team', async () => {
    expect(await twoUltrasFor('unlimited')).toMatchObject({ kind: 'picked', slot: 2 });
    const db = await createTestDb();
    const room = await draftRoom(db, 'first', 'unlimited');
    expect(distinctMasters.length).toBeGreaterThanOrEqual(2);
    await pickPokemon(db, room.code, room[2], distinctMasters[0], T0);
    await pickPokemon(db, room.code, room[1], others[0], T0);
    await pickPokemon(db, room.code, room[1], others[1], T0);
    expect(await pickPokemon(db, room.code, room[2], distinctMasters[1], T0)).toMatchObject({ kind: 'picked' });
  });

  it('an unlimited draft still allows each Pokémon once', async () => {
    const db = await createTestDb();
    const room = await draftRoom(db, 'first', 'unlimited');
    await pickPokemon(db, room.code, room[2], ultras[0], T0);
    expect(await pickPokemon(db, room.code, room[1], ultras[0], T0)).toEqual({ kind: 'taken' });
  });

  it('a Poké Ball draft rejects any Pokémon outside its pool', async () => {
    const db = await createTestDb();
    const room = await draftRoom(db, 'first', 'pokeball');
    for (const id of [greats[0], ultras[0], masters[0]]) {
      expect(await pickPokemon(db, room.code, room[2], id, T0)).toEqual({ kind: 'not-in-pool' });
    }
    expect(await pickPokemon(db, room.code, room[2], pokeBalls[0].id, T0)).toMatchObject({ kind: 'picked' });
    expect((await state(db, room.code, room[1])).draftType).toBe('pokeball');
  });

  it('a Poké Ball draft still allows each item once per team', async () => {
    const db = await createTestDb();
    const room = await draftRoom(db, 'first', 'pokeball');
    const byItem = new Map<string, string[]>();
    for (const p of pokeBalls) byItem.set(p.set.item, [...(byItem.get(p.set.item) ?? []), p.id]);
    const [item, pair] = [...byItem.entries()].find(([, ids]) => ids.length >= 2)!;
    const filler = pokeBalls.filter((p) => p.set.item !== item);
    await pickPokemon(db, room.code, room[2], pair[0], T0);
    await pickPokemon(db, room.code, room[1], filler[0].id, T0);
    await pickPokemon(db, room.code, room[1], filler[1].id, T0);
    expect(await pickPokemon(db, room.code, room[2], pair[1], T0)).toEqual({ kind: 'item-limit' });
  });
});
