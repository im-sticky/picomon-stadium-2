import type { Db } from '@/db/client';
import { setReady, startTypeBattle, type StartResult } from '@/lib/rooms';
import { START_COUNTDOWN_MS } from '@/lib/types';

/**
 * Both players press READY at `now`, then the host's client starts the type battle
 * when the countdown ends (`now + START_COUNTDOWN_MS`).
 */
export async function readyAndStart(
  db: Db,
  code: string,
  secrets: { 1: string; 2: string },
  now: number,
): Promise<StartResult> {
  await setReady(db, code, secrets[1], true, now);
  await setReady(db, code, secrets[2], true, now);
  return startTypeBattle(db, code, secrets[1], now + START_COUNTDOWN_MS);
}
