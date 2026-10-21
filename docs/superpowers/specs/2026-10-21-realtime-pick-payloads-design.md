# Picks in the Realtime Messages — Design

*Date: 2026-10-21 · Status: draft for review · Covers the type battle and the Pokémon draft*

## 1. Intent

Today a pick reaches the other player in three hops, one after another:

1. The picker's `POST` writes the pick (about 6 sequential Turso round trips).
2. The server publishes an empty `room-updated` message on Ably.
3. Both browsers call `GET /api/rooms/[code]`, which reads the room from Turso again (3–4 more round trips), and only then redraw.

This change puts the result of each action **inside the Ably message**, so both clients can draw it as soon as the message arrives. Step 3 drops out of the critical path. The picker's own client takes the result straight from its `POST` response, without refetching.

The database stays the source of truth. Clients still check their local state against the server, but in the background, after the screen has updated (§7).

## 2. Goals and non-goals

**Goals**
- After a draft pick commits, the opponent's screen shows it with no database read in between.
- When a type battle round is decided, both players see the reveal with no database read in between.
- Phase changes in the type battle (start, next round after a draw, draft order chosen) arrive the same way.
- The opponent's secret type pick is still never sent to a client before both players have picked.
- If a client's state ever differs from the database, it corrects itself without a modal, a reload or a loading screen.

**Non-goals**
- Fewer database round trips inside each write. That's the follow-up spec ("option 2": batching and merged lookups). This design is written so it doesn't get in the way (§10).
- Optimistic UI, meaning drawing a pick before the server has accepted it. Clients still draw only committed results.
- Telling a player that their opponent has locked in a type before the reveal. That would be a new feature. The first pick of a round stays unannounced, as it is today.
- Moving state into server memory. Vercel functions don't share memory (see the realtime research doc).

## 3. How it works today (reference)

| Piece | File | Behaviour |
|---|---|---|
| Publishing | [lib/ably-server.ts](../../../lib/ably-server.ts) | `publishRoomUpdated` sends `room-updated` with `{}`. Only `player-joined` carries data. |
| Clients' capability | same | `subscribe` only. **Only the server can publish**, so every message on `room:<code>` comes from a committed write. |
| Client sync | [lib/room-sync.ts](../../../lib/room-sync.ts) | Every event, reconnect or tab-visible triggers `refetch()`. A newer refetch makes older in-flight ones stale (`latest` counter). |
| Own actions | [app/room/[code]/room-view.tsx](../../../app/room/[code]/room-view.tsx) | `onAction` POSTs, then always calls `refetch()` in `finally`. |
| Secrecy | [lib/rooms.ts](../../../lib/rooms.ts) `typeBattleView` | `opponentPick` is null until both players have picked the current round. |

## 4. Messages

Every message keeps its Ably event name and gets a data object of this shape:

```ts
type RoomEvent =
  | { kind: 'type-battle-started'; round: 1 }
  | { kind: 'type-round-resolved'; round: number; picks: { 1: TypeChoice; 2: TypeChoice }; winner: Slot | null }
  | { kind: 'type-round-started'; round: number }          // after a draw
  | { kind: 'draft-started'; firstDrafter: Slot }           // the winner chose the order
  | { kind: 'draft-picked'; pickIndex: number; slot: Slot; pokemonId: string };
```

- The Ably message `name` matches `kind`, and the data repeats it so the client can parse the payload on its own.
- These types live in a new `lib/room-events.ts`, shared by the server and the client.
- `room-updated` stays as a generic "something changed, refetch" message for anything not listed (for example a future rematch). `player-joined` doesn't change.
- Every payload is a few dozen bytes, far under Ably's 64 KB limit. The number of publishes per match stays the same, so Ably usage doesn't change.

### 4.1 Which route publishes what

| Route | Today | New |
|---|---|---|
| `POST start` | `room-updated` | `type-battle-started { round: 1 }` |
| `POST type-pick`, first pick of a round | nothing | nothing (still secret) |
| `POST type-pick`, second pick of a round | `room-updated` | `type-round-resolved { round, picks, winner }` |
| `POST again` | `room-updated` (only if it advanced) | `type-round-started { round }` (only if it advanced) |
| `POST order` | `room-updated` | `draft-started { firstDrafter }` |
| `POST draft-pick` | `room-updated` | `draft-picked { pickIndex, slot, pokemonId }` |

`type-round-resolved` is only sent once both picks are committed, so broadcasting both types to the shared channel reveals nothing early. This is the same moment `typeBattleView` starts showing `opponentPick`.

### 4.2 Server changes

The functions in `lib/rooms.ts` already know everything the message needs inside their transaction. They return it instead of only a status:

| Function | Return gains |
|---|---|
| `pickType` | `round` always; when `resolved`, also `picks` (both) and `winner` |
| `playTypeBattleAgain` | `round` (the new round) on `new-round` |
| `chooseDraftOrder` | already returns `firstDrafter` |
| `pickPokemon` | `pickIndex` and `slot` on `picked` |
| `startTypeBattle` | nothing new (round is always 1) |

Each route builds the event from that result and calls a new `notifyRoomEvent(code, event)` **after the transaction commits**. Like `notifyRoomUpdated`, it only logs a failure, because §7 recovers from lost messages.

No new database reads and no schema change.

### 4.3 The picker's own response

The `POST` response body includes the same event, plus the picker's own view where it differs:

- `draft-pick`: `{ ok: true, event: { kind: 'draft-picked', ... } }`
- `type-pick`, first pick: `{ ok: true, yourPick: 'fire', round }` (there is no event to share yet)
- `type-pick`, resolving pick: `{ ok: true, event: { kind: 'type-round-resolved', ... } }`
- `start`, `again`, `order`: `{ ok: true, event }`

The client applies this result locally and **drops the unconditional refetch** in `onAction`. It still refetches if the response has no usable result (an old server during a deploy, or an error).

## 5. Ordering and duplicates

Two facts shape the client logic:

- **The picker gets each result twice**, once from its `POST` response and once from Ably. So applying an event must be idempotent.
- **Ably doesn't promise order between separate REST publishes.** Each route publishes from whichever Vercel instance served it. In the snake draft a player makes two picks in a row (for example pick indexes 1 and 2), and those two publishes can arrive swapped.

So every event carries a position the client can check against its own state:

| Event | Position | Applies when |
|---|---|---|
| `type-battle-started` | phase | local phase is `lobby` |
| `type-round-resolved` | `round` | `round === local round` and the local round isn't resolved yet |
| `type-round-started` | `round` | `round === local round + 1` |
| `draft-started` | phase | local phase is `type-battle` |
| `draft-picked` | `pickIndex` | `pickIndex === local picks.length` |

For each incoming event, the client compares that position with its own state and does one of four things:

- **Next in line:** apply it.
- **Already applied** (a duplicate, or the picker's echo): check that it matches what's held. If it does, ignore it. If not, it's a discrepancy (§8).
- **Ahead** (an earlier event is missing): hold it for up to **500 ms** in case the missing one is just late. If the gap fills, apply both in order. If not, run a catch-up fetch (§7.1).
- **Doesn't fit** (an event for a phase the client isn't in): run a catch-up fetch.

The phase-change events also reset the parts of state they replace. For example, `draft-started` sets `typeBattle` to null and `draft` to `{ firstDrafter, picks: [] }`, matching what `getRoomState` returns for that phase.

## 6. Client structure

- **`lib/room-events.ts`** gets a pure function `applyEvent(state, event, mySlot)` that returns one of `{ next: RoomState }`, `{ same: true }`, `{ hold: true }` or `{ refetch: true }`. All the rules in §5 live here, so they can be unit tested without Ably or React.
- **`lib/room-sync.ts`** keeps its shape: `subscribe` passes the parsed event through instead of the `players?` argument. Valid events go through `applyEvent`. `refetch` stays and becomes the catch-up and verify path (§7). The reorder buffer and the verify scheduling live here too, behind the injected deps, so the existing `room-sync` tests' fake-timer approach still works.
- **`room-view.tsx`**: the Ably listener parses `msg.data`. A payload that doesn't match `RoomEvent` is treated like `room-updated` (refetch). `onAction` hands the response's result to sync (`sync.current.applyLocal(...)`) instead of always refetching.
- **Screens** don't change. They already render purely from `RoomState`. The local `pending`/`busy` flags in `TypeBattleScreen` and `DraftScreen` keep working, because the new state arrives sooner than it does today.

## 7. Background verification

Local state is now built from events, so the client checks it against the database regularly. The checks run **after** the screen has already updated, show no loading UI, and never block input.

### 7.1 When it fetches

| Trigger | Delay | Why |
|---|---|---|
| After applying any event | 1500 ms debounce, reset by each new event | Confirms a burst of events once they settle (for example a double pick) instead of after each one |
| Gap or mismatch detected (§5) | immediately (catch-up) | State is known to be incomplete |
| Reconnect, tab visible again | immediately (as today) | Messages may have been missed while away |
| Waiting on the opponent, no event for 15 s | every 15 s, while the tab is visible | Covers a publish that failed on the server (`notifyRoomEvent` only logs) |
| Phase change | at the 1500 ms debounce | Phase changes reset the most state, so they're always confirmed |

"Waiting on the opponent" means it's the other player's draft turn, or this player has picked a type and the round isn't resolved. The 15 s timer stops when the screen isn't waiting, and when the tab is hidden.

Cost: a 12-pick draft adds about one verify per turn, plus one every 15 s while waiting. That's roughly 10–30 small reads per match, well within the Turso free tier.

### 7.2 Comparing without false alarms

A verify fetch is a snapshot from whenever the server read it. Events can arrive while it's in flight, so the snapshot can look "behind" when nothing is wrong. Rules:

1. **Stale snapshot.** If any event was applied after the fetch started, drop the result (the existing `latest` counter already does this) and let the debounce schedule a new verify.
2. **Order by progress.** Compute a comparable progress value for both states: phase (lobby < type-battle < draft), then type round and whether it's resolved, then draft pick count.
   - **Server behind local:** this can only be replica lag or a stale read, because local state only ever comes from committed writes. Keep local state and verify again in 1500 ms. Three in a row counts as a discrepancy.
   - **Server ahead of local:** events were missed. Take the server state. This is a normal catch-up, not an error.
   - **Same progress:** compare the content (below).
3. **Content compared:** `phase`, `battleSize`, `players`, and, when present, `typeBattle` (`round`, `yourPick`, `opponentPick`, `winner`, `firstDrafter`) and `draft` (`firstDrafter`, every pick's `slot` and `pokemonId` in order). Anything else is ignored.

## 8. When state doesn't match

**The database always wins.** The client never pushes its version back, and it never "repairs" anything on the server.

### 8.1 What the player sees

| Case | Example | Handling |
|---|---|---|
| Catch-up (server only adds) | A missed `draft-picked` | Replace state silently. The new pick appears as if its message had just arrived. |
| Correction (server changes or removes something already drawn) | Local shows Lugia at pick 4, server has Gengar | Replace state with no modal, no reload and no loading screen. Close any screen that depends on the corrected data: a Detail screen for a Pokémon that's now rented, or the FIRST/SECOND buttons if the winner changed. This uses the same path as today's `failed` handling. |
| Room gone | Expired | Unchanged: `onGone` redirects home. |

The screens already handle a state that jumps forward (that's what every refetch does today), so no new UI is needed. A correction should be close to impossible, because events are only published after a commit. If one happens, it points to a bug, so the client logs it rather than explaining it to the player.

### 8.2 Logging

Every correction logs `console.error('room-sync: discrepancy', { local, server, lastEvents })`, with the last ~10 events received, so a report can be reproduced. A catch-up after a missed message logs at `warn` level. No telemetry endpoint for now.

### 8.3 Safety valve

If one session hits **3 corrections within 60 s**, events can't be trusted for that session. Sync falls back to today's behaviour for the rest of the page's life: every message is treated as "refetch", and event payloads are ignored. The game keeps working at the old speed, and the log says the fallback was triggered.

## 9. Testing

Following the existing tests:

- **`tests/lib/room-events.test.ts`** (new): `applyEvent` for each event kind covering next, duplicate, echo, ahead, wrong phase and conflicting duplicate, plus the type battle secrecy case (no client-side path fills `opponentPick` before `type-round-resolved`).
- **`tests/lib/room-sync.test.ts`**: with fake timers, test that the debounced verify fires once per burst, a swapped double pick is reordered within 500 ms, an unfilled gap triggers a catch-up, a stale snapshot is dropped, "server behind" three times counts as a discrepancy, and the safety valve trips after 3 corrections.
- **`tests/lib/rooms-type-battle.test.ts` / `rooms-draft.test.ts`**: the new return fields (`picks`/`winner`/`round`, `pickIndex`/`slot`).
- **`tests/api/rooms.test.ts`**: each route publishes the right event once, after the commit, and the first type pick publishes nothing.
- **Manual, on two devices against the deployed preview**: a full type battle including a draw, then a full draft. Check that picks appear without the `GET /api/rooms/...` request in the network tab, and that killing the network briefly mid-draft recovers on reconnect.

## 10. Rollout and the follow-up spec

- **No migration.** Old clients still work during a deploy, because they treat every message as "refetch". New clients still refetch on `room-updated`. Ship the server and client in one deploy.
- **Option 2 (fewer round trips per write)** comes next. It changes what happens *inside* each `lib/rooms.ts` function: batching statements, merging the room and player lookups, and relying on the constraints in place of read-before-write checks. It doesn't change the return values or messages defined here, so the two specs are independent. Together, a pick will cost one or two round trips plus one Ably publish before the opponent sees it.
- **Rejected alternative, a `rooms.version` counter:** a counter bumped on every write would give a single sequence number for gap detection. But it adds a write to every transaction (working against option 2) and needs a migration. The natural positions in §5 (phase, round, pick index) already give the same ordering for free.

## 11. Open questions

1. **"Opponent has locked in" indicator:** worth a later spec? It would need a `type-picked { round, slot }` event with no type in it.
