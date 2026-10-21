# Fewer Database Round Trips per Request — Design

*Date: 2026-10-21 · Status: draft for review · Follows [Picks in the Realtime Messages](2026-10-21-realtime-pick-payloads-design.md)*

## 1. Intent

Every room action in [lib/rooms.ts](../../../lib/rooms.ts) runs as an interactive transaction: `BEGIN`, a few `SELECT`s, a write, `COMMIT`. Over the network, each of those statements waits for the one before it, so a draft pick makes about 6 round trips to Turso before the server can reply.

This change gets every action down to **at most two round trips**: one to read, one to write. Reads that are needed together go in one `batch`. Writes carry their own guards in the `WHERE` clause, so they stay correct without holding a transaction open between the read and the write. The read endpoint (`GET /api/rooms/[code]`) drops to **one** round trip.

Return values and Ably messages don't change, so this spec is independent of the realtime spec. The two can ship in either order.

## 2. Goals and non-goals

**Goals**
- Every write action costs at most 2 database round trips. `getRoomState` and `createRoom` cost 1.
- No interactive transactions (`db.transaction`) remain in `lib/rooms.ts`.
- The current guarantees still hold under races: one pick per turn, no Pokémon rented twice, one type pick per player per round, a round resolved exactly once, a room joined by at most one guest.
- The game rules stay in TypeScript (`lib/draft.ts`, `lib/type-battle.ts`) and are not copied into SQL.
- Measure before and after so the gain is a number, not a guess.

**Non-goals**
- Changing the database, the ORM or the hosting.
- Caching room state in memory or in the browser beyond what the realtime spec already does.
- Changing the API routes' responses or the Ably events.

## 3. What a round trip costs here

| Fact | Source |
|---|---|
| The Turso database is in **AWS us-east-1**. | Host name in `TURSO_DATABASE_URL` |
| The Vercel functions run in **iad1 (Washington, D.C.)**, which is in the same AWS region. | Confirmed by the user, 2026-10-21 |
| A `libsql://` URL uses **WebSockets** (`wss`). Each statement in an interactive transaction is one request and response on that socket. | `@libsql/core` config, `@libsql/client` 0.18 `ws.js` |
| `client.batch(stmts)` sends `BEGIN`, every statement, `COMMIT`/`ROLLBACK` **pipelined in one round trip**. It is atomic: if any statement fails, the whole batch rolls back and the call throws. | `@libsql/client` `executeHranaBatch` |
| Drizzle 0.45 exposes this as `db.batch([...])` with typed results. | `drizzle-orm/libsql` |

The server and the database are in the same region, so a warm round trip is a few milliseconds, and saving five per pick might save tens of milliseconds, not hundreds. That's why §8 measures before and after, and why the WebSocket question in §8.3 matters: on a cold instance, opening the connection can cost more than the statements themselves.

## 4. Before and after

| Function | Called by | Round trips now (about) | After |
|---|---|---|---|
| `createRoom` | `POST /api/rooms` | 8 (4 cleanup deletes, then `BEGIN`, 2 inserts, `COMMIT`) | **1** |
| `joinRoom` | `POST join` | 6–7 | **2** |
| `getRoomState` | `GET /api/rooms/[code]` | 4 | **1** |
| `startTypeBattle` | `POST start` | 6 | **2** |
| `pickType` | `POST type-pick` | 6–7 | **2** |
| `playTypeBattleAgain` | `POST again` | 6 | **2** |
| `chooseDraftOrder` | `POST order` | 5 | **2** |
| `pickPokemon` | `POST draft-pick` | 6 | **2** |
| `findActivePlayer` | `GET ably-token` | 1 | 1 (unchanged) |

## 5. The pattern: read batch, then a guarded write

Every write action follows the same two steps.

**1. One read batch.** Every `SELECT` the action needs goes into one `db.batch`: the live room, the member for this secret, and the picks or players. The batch runs inside `BEGIN … COMMIT` on the server, so the reads come from one consistent snapshot. The TypeScript checks then run on that snapshot exactly as they do today: `draftPickError`, `typeBattleWinner`, the phase and host checks.

**2. One guarded write.** The write is a single statement, or a batch when it has to change more than one table or return rows. It re-checks in its own `WHERE` clause anything another request could have changed since step 1. Then:
- **One row changed:** success.
- **No rows changed:** a guard failed, so another request got there first. The step 1 snapshot says which result to return, as the table in §6 shows.
- **Constraint error:** a primary or unique key rejected the row, the same as today (`isConstraintError`).

This is safe without a transaction around both steps because of how the data changes. Each value read in step 1 is either guarded in step 2, or can't change once it's set:

| Value read in step 1 | Can it change before step 2? | Why the write stays correct |
|---|---|---|
| Member for this secret (id, slot) | No. Players never change slot and are only deleted when the room expires. | Room expiry is guarded (below). |
| Room is live (`expires_at > now`) | Yes, it can expire. | Guarded: `expires_at > :now` in the write. |
| `phase` | Yes, but only forward (lobby, then type-battle, then draft). | Guarded: `phase = :expected`. |
| `type_round` | Yes, `again` advances it. | Guarded: `type_round = :round`. |
| `first_drafter` | No. It's set once, by the same write that moves the room into the draft. | Guarded by `first_drafter IS NULL` where it's set. |
| Draft picks `0 … N-1` | No. Picks are never edited or removed while the room is live. | Inserting at `pick_index = N` relies on the primary key: if anyone else inserted index N first, the insert fails, so the picks validated in step 1 are exactly the picks before N. |
| Type picks this round | Yes, the opponent can add theirs. | The insert relies on the primary key. The resolution check reads the picks again **inside the write batch** (§6.2). |
| Players in the room | Yes, a guest can join. | `unique(room_code, slot)` rejects a second guest, the same as today. |

**Guarded inserts.** SQLite has no `INSERT … WHERE`, so a guarded insert is written as `INSERT INTO t (…) SELECT :a, :b, … WHERE EXISTS (SELECT 1 FROM rooms WHERE code = :code AND expires_at > :now AND phase = :phase …)`. `rowsAffected` is 0 when the guard fails. In Drizzle this is `db.insert(t).select(...)`, or `sql` for the `EXISTS` condition.

**Busy retries.** `withBusyRetry` stays and wraps each step. Busy errors should get much rarer, because no lock is held while the server waits on the network between statements.

## 6. Each function

### 6.1 `pickPokemon` (the one that matters most)

1. **Read batch:** room (`phase`, `first_drafter`), member, every draft pick in order.
2. In TypeScript: `not-found` / `not-drafting` checks, then `draftPickError(...)` as today.
3. **Write:** one guarded insert at `pick_index = picks.length`, with the guard `room live AND phase = 'draft'`.
   - Constraint error on `(room_code, pick_index)`: someone else took this turn. Return `taken`, as today.
   - Constraint error on `(room_code, pokemon_id)`: already rented. Return `taken`.
   - 0 rows: the room expired. Return `not-found`.

The result keeps `pickIndex` and `slot` for the realtime event.

### 6.2 `pickType`

1. **Read batch:** room (`phase`, `type_round`), member, and this round's picks (needed for the "already resolved" check, §6.8).
2. In TypeScript: `not-found`, then `not-picking` if the phase is wrong or the round's picks already give a winner. This is today's `type_winner !== null` check, worked out from the picks. After a draw it falls through to the insert, which the primary key rejects with `already-picked`, as today.
3. **Write batch:**
   1. A guarded insert of the pick: `room live AND phase = 'type-battle' AND type_round = :round`.
   2. `SELECT` this round's picks.

   The batch is atomic and serialised with other writes, so the `SELECT` sees every pick committed before it. When both players pick at once, exactly one batch sees two picks and reports `resolved: true`, the same guarantee as today's transaction.
   - Constraint error on `(room_code, round, slot)`: return `already-picked`.
   - The insert changed 0 rows: the round moved on or the room expired. Return `not-picking` (or `not-found` if the room is gone).
4. If both picks are present, the winner is `typeBattleWinner(picks[1], picks[2])`, computed in TypeScript. There's **no third write to store it** (§6.8).

### 6.3 `playTypeBattleAgain`

1. **Read batch:** room, member, this round's picks.
2. In TypeScript: the existing checks. A draw means both picks are present and `typeBattleWinner` returns null.
3. **Write:** `UPDATE rooms SET type_round = :round + 1 WHERE code = :code AND phase = 'type-battle' AND type_round = :round AND expires_at > :now`. If it changes 0 rows, another request already advanced the round, so return `already-new-round`.

### 6.4 `chooseDraftOrder`

1. **Read batch:** room, member, this round's picks (to work out the winner).
2. In TypeScript: the `already-chosen` / `not-decided` / `not-winner` checks.
3. **Write:** `UPDATE rooms SET first_drafter = :fd, phase = 'draft' WHERE code = :code AND phase = 'type-battle' AND first_drafter IS NULL AND type_round = :round`. If it changes 0 rows, return `already-chosen`. Today the function returns `chosen` even when its update lost a race; this fixes that.

### 6.5 `startTypeBattle`

1. **Read batch:** room, member, players.
2. In TypeScript: host, phase and full-room checks.
3. **Write:** `UPDATE rooms SET phase = 'type-battle', type_round = 1 WHERE code = :code AND phase = 'lobby' AND expires_at > :now`. If it changes 0 rows, return `already-started`.

### 6.6 `joinRoom`

1. **Read batch:** room; the member for `existingSecret`, if there is one.
2. In TypeScript: `not-found`, `already-member`.
3. **Write batch:**
   1. A guarded insert of the guest at `slot = 2` (`room live`).
   2. `UPDATE rooms SET expires_at = created_at + :fullTtl WHERE code = :code`. This uses the column directly, so it doesn't depend on a value read earlier.
   3. `SELECT` the players.
   - Constraint error on `(room_code, slot)`: return `full`, as today.
   - The insert changed 0 rows: return `not-found`. The `UPDATE` is guarded the same way, so it changes nothing either.

### 6.7 `createRoom` and `getRoomState`

- **`createRoom`:** one batch with the 4 expired-room deletes, the room insert and the host insert. A room code collision fails the batch, which also rolls back the cleanup. The retry loop runs the whole batch again with a new code, which is harmless.
- **`getRoomState`:** one read batch with the room, the member, the players, this round's type picks (`round = (SELECT type_round FROM rooms WHERE code = :code)`) and the draft picks. Both pick lists are read whatever the phase, because they're small. The views are then built in TypeScript as today. This is the request the realtime spec's background check uses, so making it one round trip makes those checks cheaper too.

### 6.8 Working out the type battle winner instead of storing it

`rooms.type_winner` is only ever `typeBattleWinner` applied to the current round's two picks, and those picks never change once they're both in. Storing the winner costs the deciding pick (the moment both players are waiting for the reveal) a third write. So:

- Stop writing `type_winner`. Every reader (`typeBattleView`, `chooseDraftOrder`, `playTypeBattleAgain`, `pickType`'s "already resolved" check) works it out from the round's picks, which it already reads in the same batch.
- Drop the column in a **later** migration, once no deployed code reads it (§9).

The alternative is to keep the column and pay a third round trip only on the deciding pick. That's simpler to migrate, but slower exactly where players notice it.

## 7. Code structure

- The read helpers (`findLiveRoom`, `findMember`, `listPlayers`, `roundPicks`, `listDraftPicks`) become functions that return a **query builder**, not a promise, so they can be put into `db.batch([...])`. Small mappers turn the batch's raw rows into the existing shapes (`LiveRoom`, `DraftPick[]`, and so on).
- The `Pick<Db, 'select'>` parameters that let the helpers run inside a transaction are no longer needed. Everything runs on `Db`.
- A small helper for guarded inserts keeps the `INSERT … SELECT … WHERE EXISTS` wording in one place.
- `isConstraintError` must also recognise errors thrown from a batch. libsql wraps those in `LibsqlBatchError`, which still carries the `SQLITE_CONSTRAINT…` code, and Drizzle may wrap that again in an error whose `cause` is the original. `errorCodes` already walks the `cause` chain. A test confirms it (§10). `statementIndex` on the error says which statement failed, if that's ever needed.
- The route files don't change.

## 8. Measuring

### 8.1 Before starting

- **Add a `Server-Timing` header** to the room routes, with the time spent in `lib/rooms.ts` (`Server-Timing: db;dur=12.3`). It shows in the browser's network panel for each request, costs nothing, and stays after this work as a way to spot regressions.
- **Record a baseline** on the deployed preview: the median and worst `db` time for `draft-pick`, `type-pick` and `GET /api/rooms/[code]` over one full match.

### 8.2 After

Repeat the same match and compare. Expected result: the `db` time drops roughly in proportion to the round trip counts in §4. If it doesn't, the cost is somewhere else, such as connection setup on a cold start. That leads to the transport question below.

### 8.3 WebSocket or HTTP

Batching takes away most of the difference between the two transports, but a cold Vercel instance still has to open a WebSocket (TLS plus an upgrade) before its first statement. Using an `https://` URL for `TURSO_DATABASE_URL` switches libsql to plain HTTP requests, which keep nothing open between calls. Measure both with the `Server-Timing` header and keep whichever has the better worst case. Switching is an environment variable change, not a code change.

## 9. Rollout

1. **Deploy the code change**, with no migration. The new code ignores `type_winner`, and the old code keeps writing it until its instances drain. Either way the stored value is the same.
2. **After the deploy has fully rolled out,** generate a migration that drops `rooms.type_winner` (`drizzle-kit generate`, then `db:migrate`). Dropping it first would break any old instance still reading it.
3. A room in progress during the deploy isn't affected: every value the new code reads already exists in the old schema.

## 10. Testing

The existing tests in `tests/lib/rooms*.test.ts` and `tests/api/rooms.test.ts` already pin down the return values for every function. They should pass unchanged. None of them read `type_winner` directly.

New tests, focused on the gap between the read and the write that this design opens up:

- **Interleaving hook:** a test helper wraps `db.batch` so a chosen competing write runs right after the action's read batch, before its write. No production code changes. Cases:
  - Draft: the opponent inserts pick N in the gap → `taken`. The same Pokémon is rented in the gap → `taken`. The room expires in the gap → `not-found`.
  - Type battle: the opponent picks in the gap → the second pick returns `resolved: true`, and exactly one of the two does. `again` advances the round in the gap → `not-picking`.
  - `chooseDraftOrder` and `startTypeBattle` lose their guard in the gap → `already-chosen` / `already-started`.
  - Join: another guest joins in the gap → `full`.
- **Constraint errors from a batch** are still recognised by `isConstraintError` (§7).
- **The winner is worked out, not stored:** the views and `chooseDraftOrder` give the same results as today for win, loss and draw.
- **Round trip count:** a test wraps the libsql client, counts `execute`/`batch` calls per function, and asserts the numbers in §4. This keeps them from creeping back up.
- The two-client file-database concurrency tests in `rooms-type-battle.test.ts` stay. Their comment about `BEGIN IMMEDIATE` and `SQLITE_BUSY` needs updating, since there's no longer an interactive transaction to lose.

## 11. Open questions

1. **Work out the winner or store it (§6.8)?** This spec recommends working it out and dropping the column later. The alternative keeps the schema as is and adds one round trip to the deciding type pick.
2. **WebSocket or HTTP (§8.3)?** Decide from the measurements.
3. **Keep the `Server-Timing` header for good?** This spec says yes, because it's free and useful. It's easy to remove once the numbers are in, if you'd rather not.
