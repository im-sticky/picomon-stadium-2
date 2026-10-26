import type { Db } from '@/db/client';
import { draftPicks } from '@/db/schema';
import { draftTurn, TOTAL_PICKS } from '@/lib/draft';
import { chooseDraftOrder, createRoom, joinRoom, pickType } from '@/lib/rooms';
import { readyAndStart } from '@/tests/helpers/lobby';
import type { BattleSize } from '@/lib/types';

export const T0 = 1_000_000;
export const SEED = 'sodium,00112233445566778899aabbccddeeff';
/** Tauros (Choice Band) leads for the host; Furret (Choice Scarf) has U-turn as move 2. */
export const TEAM1 = ['tauros', 'furret', 'gengar', 'alakazam', 'aerodactyl', 'ampharos'];
/** Blissey leads for the guest; Wobbuffet (Shadow Tag) is 6th. */
export const TEAM2 = ['blissey', 'snorlax', 'skarmory', 'slowbro', 'umbreon', 'wobbuffet'];

export type TestRoom = { code: string; 1: string; 2: string };

/**
 * A room of `size` whose draft has `picks` picks made (all 12 by default): the host
 * wins the type battle and drafts first, each side taking its team in order.
 */
export async function draftedRoom(
  db: Db,
  {
    size = 3,
    picks = TOTAL_PICKS,
    teams = { 1: TEAM1, 2: TEAM2 },
  }: { size?: BattleSize; picks?: number; teams?: { 1: string[]; 2: string[] } } = {},
): Promise<TestRoom> {
  const host = await createRoom(db, 'Ash', T0, size);
  const joined = await joinRoom(db, host.code, 'Misty', T0, null);
  if (joined.kind !== 'joined') throw new Error(joined.kind);
  const room: TestRoom = { code: host.code, 1: host.secret, 2: joined.secret };
  await readyAndStart(db, room.code, room, T0);
  await pickType(db, room.code, room[1], 'fire', T0);
  await pickType(db, room.code, room[2], 'grass', T0);
  await chooseDraftOrder(db, room.code, room[1], 'first', T0);
  // The picks are written directly, in snake order, instead of through pickPokemon.
  // These battle tests need fixed teams (a Choice Band lead, a U-turn user, Wobbuffet),
  // and the draft's own limits (one master, one ultra, each item once per team) would
  // reject some of them. Those limits have their own tests in rooms-draft.test.ts.
  const queues = { 1: [...teams[1]], 2: [...teams[2]] };
  for (let i = 0; i < picks; i++) {
    const slot = draftTurn(1, i)!;
    await db.insert(draftPicks).values({
      roomCode: room.code,
      pickIndex: i,
      slot,
      pokemonId: queues[slot].shift()!,
      pickedAt: T0,
    });
  }
  return room;
}
