import { and, asc, eq, inArray, lte, gt } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { players, rooms } from '@/db/schema';
import { generateCode } from '@/lib/codes';
import type { PublicPlayer, RoomState, Slot } from '@/lib/types';

export const WAITING_TTL_MS = 30 * 60 * 1000;
export const FULL_TTL_MS = 24 * 60 * 60 * 1000;

export type JoinResult =
  | { kind: 'joined'; code: string; secret: string; players: PublicPlayer[] }
  | { kind: 'already-member'; code: string }
  | { kind: 'not-found' }
  | { kind: 'full' };

function errorCodes(err: unknown): string[] {
  const out: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur && typeof cur === 'object'; i++) {
    const e = cur as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof e.code === 'string') out.push(e.code);
    cur = e.cause;
  }
  return out;
}

function isConstraintError(err: unknown): boolean {
  return errorCodes(err).some((c) => c.startsWith('SQLITE_CONSTRAINT'));
}

function isBusyError(err: unknown): boolean {
  return errorCodes(err).some((c) => c === 'SQLITE_BUSY' || c === 'SQLITE_LOCKED');
}

async function deleteExpired(db: Db, now: number): Promise<void> {
  // Players first: foreign keys may not be enforced, so don't rely on cascade.
  const expired = db.select({ code: rooms.code }).from(rooms).where(lte(rooms.expiresAt, now));
  await db.delete(players).where(inArray(players.roomCode, expired));
  await db.delete(rooms).where(lte(rooms.expiresAt, now));
}

export async function createRoom(
  db: Db,
  name: string,
  now: number,
): Promise<{ code: string; secret: string; playerId: string }> {
  await deleteExpired(db, now);
  const secret = crypto.randomUUID();
  const playerId = crypto.randomUUID();
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateCode();
    try {
      await db.transaction(async (tx) => {
        await tx.insert(rooms).values({ code, createdAt: now, expiresAt: now + WAITING_TTL_MS });
        await tx.insert(players).values({
          id: playerId,
          secret,
          roomCode: code,
          name,
          slot: 1,
          joinedAt: now,
        });
      });
      return { code, secret, playerId };
    } catch (err) {
      // Code collision with a live room (primary key): try another code.
      if (!isConstraintError(err)) throw err;
    }
  }
  throw new Error('Could not allocate a unique room code');
}

async function listPlayers(db: Pick<Db, 'select'>, code: string): Promise<PublicPlayer[]> {
  const rows = await db
    .select({ id: players.id, name: players.name, slot: players.slot })
    .from(players)
    .where(eq(players.roomCode, code))
    .orderBy(asc(players.slot));
  return rows.map((r) => ({ id: r.id, name: r.name, slot: r.slot as Slot }));
}

async function joinOnce(
  db: Db,
  code: string,
  name: string,
  now: number,
  existingSecret: string | null,
): Promise<JoinResult> {
  try {
    return await db.transaction(
      async (tx): Promise<JoinResult> => {
        const [room] = await tx.select().from(rooms).where(eq(rooms.code, code));
        if (!room || room.expiresAt <= now) return { kind: 'not-found' };

        if (existingSecret) {
          const [member] = await tx
            .select({ id: players.id })
            .from(players)
            .where(and(eq(players.secret, existingSecret), eq(players.roomCode, code)));
          if (member) return { kind: 'already-member', code };
        }

        const secret = crypto.randomUUID();
        await tx.insert(players).values({
          id: crypto.randomUUID(),
          secret,
          roomCode: code,
          name,
          slot: 2,
          joinedAt: now,
        });
        await tx
          .update(rooms)
          .set({ expiresAt: room.createdAt + FULL_TTL_MS })
          .where(eq(rooms.code, code));
        return { kind: 'joined', code, secret, players: await listPlayers(tx, code) };
      },
      { behavior: 'immediate' },
    );
  } catch (err) {
    // Unique (roomCode, slot) violation: someone else took slot 2.
    if (isConstraintError(err)) return { kind: 'full' };
    throw err;
  }
}

export async function joinRoom(
  db: Db,
  code: string,
  name: string,
  now: number,
  existingSecret: string | null,
): Promise<JoinResult> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await joinOnce(db, code, name, now, existingSecret);
    } catch (err) {
      if (!isBusyError(err) || attempt >= MAX_ATTEMPTS) throw err;
      await new Promise((r) => setTimeout(r, 25 * attempt));
    }
  }
}

export async function getRoomState(
  db: Db,
  code: string,
  secret: string | null,
  now: number,
): Promise<RoomState | null> {
  if (!secret) return null;
  const [room] = await db
    .select({ code: rooms.code })
    .from(rooms)
    .where(and(eq(rooms.code, code), gt(rooms.expiresAt, now)));
  if (!room) return null;
  const list = await listPlayers(db, code);
  const me = await db
    .select({ id: players.id, slot: players.slot })
    .from(players)
    .where(and(eq(players.secret, secret), eq(players.roomCode, code)));
  if (!me[0]) return null;
  return { code, you: { id: me[0].id, slot: me[0].slot as Slot }, players: list };
}

export async function findActivePlayer(
  db: Db,
  secret: string | null,
  now: number,
): Promise<{ id: string; roomCode: string } | null> {
  if (!secret) return null;
  const [row] = await db
    .select({ id: players.id, roomCode: players.roomCode })
    .from(players)
    .innerJoin(rooms, eq(rooms.code, players.roomCode))
    .where(and(eq(players.secret, secret), gt(rooms.expiresAt, now)));
  return row ?? null;
}
