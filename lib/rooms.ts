import { and, asc, eq, inArray, isNull, lte, gt } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { players, rooms, typePicks } from '@/db/schema';
import { generateCode } from '@/lib/codes';
import { typeBattleWinner } from '@/lib/type-battle';
import type { Phase, PublicPlayer, RoomState, Slot, TypeBattleView, TypeChoice } from '@/lib/types';

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
  await db.delete(typePicks).where(inArray(typePicks.roomCode, expired));
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
    // libsql's default write transaction is BEGIN IMMEDIATE, so no behavior option is needed.
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
    );
  } catch (err) {
    // Unique (roomCode, slot) violation: someone else took slot 2.
    if (isConstraintError(err)) return { kind: 'full' };
    throw err;
  }
}

/** Runs a write transaction, retrying a few times if the database is busy. */
async function withBusyRetry<T>(run: () => Promise<T>): Promise<T> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (!isBusyError(err) || attempt >= MAX_ATTEMPTS) throw err;
      await new Promise((r) => setTimeout(r, 25 * attempt));
    }
  }
}

export async function joinRoom(
  db: Db,
  code: string,
  name: string,
  now: number,
  existingSecret: string | null,
): Promise<JoinResult> {
  return withBusyRetry(() => joinOnce(db, code, name, now, existingSecret));
}

export async function getRoomState(
  db: Db,
  code: string,
  secret: string | null,
  now: number,
): Promise<RoomState | null> {
  if (!secret) return null;
  const room = await findLiveRoom(db, code, now);
  if (!room) return null;
  const me = await findMember(db, code, secret);
  if (!me) return null;
  const list = await listPlayers(db, code);
  const phase = room.phase as Phase;
  return {
    code,
    you: me,
    players: list,
    phase,
    typeBattle: phase === 'type-battle' ? await typeBattleView(db, room, me.slot) : null,
  };
}

type LiveRoom = {
  code: string;
  phase: string;
  typeRound: number;
  typeWinner: number | null;
  firstDrafter: number | null;
};

async function findLiveRoom(db: Pick<Db, 'select'>, code: string, now: number): Promise<LiveRoom | null> {
  const [room] = await db
    .select({
      code: rooms.code,
      phase: rooms.phase,
      typeRound: rooms.typeRound,
      typeWinner: rooms.typeWinner,
      firstDrafter: rooms.firstDrafter,
    })
    .from(rooms)
    .where(and(eq(rooms.code, code), gt(rooms.expiresAt, now)));
  return room ?? null;
}

async function findMember(
  db: Pick<Db, 'select'>,
  code: string,
  secret: string,
): Promise<{ id: string; slot: Slot } | null> {
  const [me] = await db
    .select({ id: players.id, slot: players.slot })
    .from(players)
    .where(and(eq(players.secret, secret), eq(players.roomCode, code)));
  return me ? { id: me.id, slot: me.slot as Slot } : null;
}

async function roundPicks(db: Pick<Db, 'select'>, code: string, round: number) {
  const rows = await db
    .select({ slot: typePicks.slot, type: typePicks.type })
    .from(typePicks)
    .where(and(eq(typePicks.roomCode, code), eq(typePicks.round, round)));
  return {
    1: (rows.find((r) => r.slot === 1)?.type ?? null) as TypeChoice | null,
    2: (rows.find((r) => r.slot === 2)?.type ?? null) as TypeChoice | null,
  };
}

/** The viewer's view of the type battle: the opponent's pick stays hidden until both have picked. */
async function typeBattleView(db: Db, room: LiveRoom, slot: Slot): Promise<TypeBattleView> {
  const picks = await roundPicks(db, room.code, room.typeRound);
  const opponent: Slot = slot === 1 ? 2 : 1;
  const bothPicked = picks[1] !== null && picks[2] !== null;
  return {
    round: room.typeRound,
    yourPick: picks[slot],
    opponentPick: bothPicked ? picks[opponent] : null,
    winner: room.typeWinner as Slot | null,
    firstDrafter: room.firstDrafter as Slot | null,
  };
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

export type StartResult =
  | { kind: 'started' }
  | { kind: 'already-started' }
  | { kind: 'not-found' }
  | { kind: 'not-host' }
  | { kind: 'not-full' };

/** The host moves a full room from the lobby into the type battle (round 1). */
export async function startTypeBattle(
  db: Db,
  code: string,
  secret: string | null,
  now: number,
): Promise<StartResult> {
  if (!secret) return { kind: 'not-found' };
  return withBusyRetry(() =>
    db.transaction(async (tx): Promise<StartResult> => {
      const room = await findLiveRoom(tx, code, now);
      const me = room && (await findMember(tx, code, secret));
      if (!room || !me) return { kind: 'not-found' };
      if (me.slot !== 1) return { kind: 'not-host' };
      if (room.phase !== 'lobby') return { kind: 'already-started' };
      if ((await listPlayers(tx, code)).length < 2) return { kind: 'not-full' };
      await tx.update(rooms).set({ phase: 'type-battle', typeRound: 1 }).where(eq(rooms.code, code));
      return { kind: 'started' };
    }),
  );
}

export type PickResult =
  | { kind: 'picked'; resolved: boolean }
  | { kind: 'already-picked' }
  | { kind: 'not-picking' }
  | { kind: 'not-found' };

/**
 * Records the player's pick for the current round. The pick that completes the
 * round also decides it, in the same transaction, so only one resolution happens.
 * `resolved` is true when this pick completed the round (a win or a draw).
 */
export async function pickType(
  db: Db,
  code: string,
  secret: string | null,
  type: TypeChoice,
  now: number,
): Promise<PickResult> {
  if (!secret) return { kind: 'not-found' };
  try {
    return await withBusyRetry(() =>
      db.transaction(async (tx): Promise<PickResult> => {
        const room = await findLiveRoom(tx, code, now);
        const me = room && (await findMember(tx, code, secret));
        if (!room || !me) return { kind: 'not-found' };
        if (room.phase !== 'type-battle' || room.typeWinner !== null) return { kind: 'not-picking' };

        // Primary key (room, round, slot): a second pick this round throws a constraint error.
        await tx
          .insert(typePicks)
          .values({ roomCode: code, round: room.typeRound, slot: me.slot, type, pickedAt: now });

        const picks = await roundPicks(tx, code, room.typeRound);
        if (picks[1] === null || picks[2] === null) return { kind: 'picked', resolved: false };
        const winner = typeBattleWinner(picks[1], picks[2]);
        if (winner !== null) {
          await tx
            .update(rooms)
            .set({ typeWinner: winner })
            .where(and(eq(rooms.code, code), isNull(rooms.typeWinner)));
        }
        return { kind: 'picked', resolved: true };
      }),
    );
  } catch (err) {
    if (isConstraintError(err)) return { kind: 'already-picked' };
    throw err;
  }
}

export type AgainResult =
  | { kind: 'new-round' }
  | { kind: 'already-new-round' }
  | { kind: 'not-draw' }
  | { kind: 'not-found' };

/**
 * After a draw in `round`, starts the next round for both players. Either player
 * can call it; if both do, only the first advances the round.
 */
export async function playTypeBattleAgain(
  db: Db,
  code: string,
  secret: string | null,
  round: number,
  now: number,
): Promise<AgainResult> {
  if (!secret) return { kind: 'not-found' };
  return withBusyRetry(() =>
    db.transaction(async (tx): Promise<AgainResult> => {
      const room = await findLiveRoom(tx, code, now);
      const me = room && (await findMember(tx, code, secret));
      if (!room || !me) return { kind: 'not-found' };
      if (room.phase !== 'type-battle' || room.typeWinner !== null) return { kind: 'not-draw' };
      if (room.typeRound > round) return { kind: 'already-new-round' };
      if (room.typeRound !== round) return { kind: 'not-draw' };
      const picks = await roundPicks(tx, code, round);
      if (picks[1] === null || picks[2] === null) return { kind: 'not-draw' };
      await tx
        .update(rooms)
        .set({ typeRound: round + 1 })
        .where(and(eq(rooms.code, code), eq(rooms.typeRound, round)));
      return { kind: 'new-round' };
    }),
  );
}

export type OrderResult =
  | { kind: 'chosen'; firstDrafter: Slot }
  | { kind: 'already-chosen' }
  | { kind: 'not-winner' }
  | { kind: 'not-decided' }
  | { kind: 'not-found' };

/** The type battle winner chooses to draft first or second. */
export async function chooseDraftOrder(
  db: Db,
  code: string,
  secret: string | null,
  order: 'first' | 'second',
  now: number,
): Promise<OrderResult> {
  if (!secret) return { kind: 'not-found' };
  return withBusyRetry(() =>
    db.transaction(async (tx): Promise<OrderResult> => {
      const room = await findLiveRoom(tx, code, now);
      const me = room && (await findMember(tx, code, secret));
      if (!room || !me) return { kind: 'not-found' };
      if (room.phase !== 'type-battle' || room.typeWinner === null) return { kind: 'not-decided' };
      if (room.typeWinner !== me.slot) return { kind: 'not-winner' };
      if (room.firstDrafter !== null) return { kind: 'already-chosen' };
      const firstDrafter: Slot = order === 'first' ? me.slot : me.slot === 1 ? 2 : 1;
      await tx
        .update(rooms)
        .set({ firstDrafter })
        .where(and(eq(rooms.code, code), isNull(rooms.firstDrafter)));
      return { kind: 'chosen', firstDrafter };
    }),
  );
}
