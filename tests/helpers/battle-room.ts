import type { Db } from '@/db/client';
import { draftTurn, TOTAL_PICKS } from '@/lib/draft';
import { chooseDraftOrder, createRoom, joinRoom, pickPokemon, pickType, startTypeBattle } from '@/lib/rooms';
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
  await startTypeBattle(db, room.code, room[1], T0);
  await pickType(db, room.code, room[1], 'fire', T0);
  await pickType(db, room.code, room[2], 'grass', T0);
  await chooseDraftOrder(db, room.code, room[1], 'first', T0);
  const queues = { 1: [...teams[1]], 2: [...teams[2]] };
  for (let i = 0; i < picks; i++) {
    const slot = draftTurn(1, i)!;
    const result = await pickPokemon(db, room.code, room[slot], queues[slot].shift()!, T0);
    if (result.kind !== 'picked') throw new Error(result.kind);
  }
  return room;
}
