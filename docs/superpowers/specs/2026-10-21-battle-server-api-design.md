# Battle Server API — Design

*Date: 2026-10-21 · Status: draft for review · Covers the server side of battling: START BATTLE, the Battle order screen (team preview), turns, faint replacements, the timer and the end of the battle. No frontend.*

## 1. Intent

The draft ends with a host-only START BATTLE button that does nothing yet. This spec defines everything the server needs, from that button to the battle's end:

- a `battles` table holding the engine's snapshot;
- five routes under `/api/rooms/[code]/battle`;
- the engine wrapper around `@pkmn/sim`;
- each player's view, and what in it is private;
- the realtime events, in the style of `RoomEvent`;
- the 75-second timer, with no background jobs;
- the concurrency rule, the battle's end, errors, and the tests.

The rules come from §1 and §18 of the [Gen 6 research doc](../../research/2026-10-19-gen6-battle-mechanics.md) ("research §n" below) and from the [battle brainstorm answers](../../research/battle-brainstorm-open-questions.md). The realtime pattern comes from [Picks in the Realtime Messages](2026-10-21-realtime-pick-payloads-design.md) ("realtime spec §n").

The decided rules aren't reopened here:

- singles, the Gen 6 engine, no Megas, Primal Reversion or terrain (research §1, §5, §10.2);
- Lv 50, draft 6 and bring the room's `battleSize` (3, 4 or 6);
- Sleep Clause Mod and Endless Battle Clause;
- base PP;
- 75 s for every choice, the engine's `default` choice on a timeout, a forfeit after three timeouts in a row;
- the engine's faint replacements;
- one snapshot row per room, with no choice log.

## 2. Goals and non-goals

**Goals**

- The server is the only authority. Clients send a choice and nothing else, and every result comes from the engine.
- Hidden information never reaches the wrong client. That covers the opponent's team order, which Pokémon they brought, their pending choice, their exact HP, the PRNG state and the snapshot.
- After a turn resolves, both screens can start animating it from the Ably message, with no database read first (realtime spec §1).
- No choice is ever lost, even when both players submit at the same moment.
- The timer is enforced with no always-on process.

**Non-goals**

- Any screen, component or client sync code. §9.4 gives the rules a client applier must follow, but the applier itself belongs to the frontend spec.
- Spectators, replays, a choice log and rematches (research §16.2).
- A manual forfeit button. It would be a new feature, outside this spec.
- Telling a player that the opponent has already chosen this turn. This matches the type battle's non-goal (realtime spec §2).
- Fewer round trips per write. The [fewer-round-trips spec](2026-10-21-fewer-db-round-trips-design.md) is deferred. Nothing here depends on it or works against it.

## 3. Verified against the engine

These were run against `@pkmn/sim` 0.10.11 in this worktree on 2026-10-21, with throwaway scripts outside the repo.

| Check | Result |
|---|---|
| `${FORMAT_ID}@@@Picked Team Size = N` on our **registered** format | **Broken.** The battle comes back as `gen 9`, mod `base`, with no rules and no team preview. `Dex.formats.get` resolves a name containing `@@@` through `dex.data.Rulesets`. `Dex.formats.extend` never writes there, so the format "doesn't exist", and the engine quietly falls back to the default dex. Research §18.1's sample only worked on the built-in `gen6customgame`. **This changes §18.1's mechanism** (§6.1 below). |
| Three registered formats `[Gen 6] Picomon 3v3` / `4v4` / `6v6`, each with `Picked Team Size = N` in its own ruleset | `gen 6`, mod `picomon`, a `teampreview` request with `maxChosenTeamSize: N`, and each team trimmed to N in the chosen order. Confirmed for 3, 4 and 6. |
| `calculatePP(move) { return move.pp; }` in the mod's `Scripts` | Gengar's Sludge Bomb / Shadow Ball / Thunderbolt / Destiny Bond had max PP **10/15/15/5**, also after `toJSON` → `Battle.fromJSON`. The engine copies `Scripts` functions onto every `Battle`, restored ones included. |
| `team 25` when N = 4 | **Accepted.** The engine fills in the rest in team order. A `team` choice with repeated slots is rejected. So the server checks for a full permutation itself (§13). |
| `move shadowball` (a move id rather than a number) | Accepted. `move 1 mega`, `move 9`, `switch 1` (the active Pokémon) and `switch 5` in a 3v3 are all rejected. `undo` cancels a choice. The API builds the choice string from numbers (§6.4), so none of these strings can ever reach the engine. |
| First choice of a turn | `choose` returns true. `battle.log` doesn't grow, and the saved snapshot keeps the half-made turn. The second choice resolves the turn and appends the turn's lines. |
| U-turn | A **mid-turn step**. The log grows with no `\|turn\|` line. The U-turn user gets `forceSwitch`, and the other side gets `wait`. `default` for the waiting side returns false. |
| Faints | A single faint gives that side `forceSwitch` and the other side `wait`. A double faint gives both sides `forceSwitch` (research §18.5). |
| `\|split\|pN` blocks | Each one is a secret line (exact HP) followed by a public line (HP out of 100). `extractChannelMessages(text, [0, 1, 2])` returns the spectator view, p1's view and p2's view. p1's view has exact HP for p1's Pokémon only. Seen on `switch`, `-damage` and `-heal`. |
| Bad choice | `choose` returns false, and `send('sideupdate', 'p1\n\|error\|[Invalid choice] Can\'t move: Your Gengar doesn\'t have a move 3')`. |
| `forceWin('p2')` / `tie()` | `ended` is true, and the log gains `\|win\|P2` or `\|tie\|`. Both sides' `activeRequest` become null. |
| Determinism | The same seed and choices give a byte-identical log (ignoring `\|t:\|`), whether or not the battle round-trips through JSON before every choice. |
| Sizes | The snapshot is about 22 KB for 3v3 after turn 1, and about 50 KB for a whole 6v6 played on `default` (19 turns). That battle's full public log was about 9 KB (390 lines). The snapshot grows with every turn: the reviewer saw a 74-turn game reach 78 KB, so a long stall game can pass 100 KB. That's fine for a Turso text column. |
| Rejected choice | `choose` returning false still changes the engine: the reviewer saw `sides[n].choice.error` set in 923 of 923 rejections. So a rejected engine is thrown away (§11). |
| Silent fallback on restore | If the sized format isn't registered when `Battle.fromJSON` runs, the battle comes back as gen 9 / mod `base` with no error. So `restoreBattle` checks the generation and mod (§6.3). |
| Requests on a waiting side | On a side whose request is `wait`, `requestState` is `''` and `isChoiceDone()` returns true. `isChoiceDone()` calls `getChoiceIndex()`, which can auto-pass. So reads never call it (§6.2). |
| Endless Battle Clause | It can end the battle with `\|win\|` (berry cycling: `battle.win(foe)`) as well as with a tie. `tie()` writes `\|tie` with no trailing bar. |

## 4. Phases and flow

### 4.1 Room phase

`Phase` (`lib/types.ts`) gains one value:

```
lobby ──START──▶ type-battle ──FIRST/SECOND──▶ draft ──(12 picks) START BATTLE──▶ battle
```

- `battle` covers the Battle order screen, the battle itself and the result. Its sub-state is the **battle stage**, stored on the `battles` row.
- **Decision:** one new room phase plus a stage on the battle row, not three room phases, **because** every change after START BATTLE is a write to the `battles` row alone (§11). Keeping the stage on that row means one conditional `UPDATE` changes both the snapshot and the stage, and `rooms` is written only once, at START BATTLE.

### 4.2 Battle stage

| Stage | Screen | Engine request state | Leaves when |
|---|---|---|---|
| `team-order` | Battle order (team preview) | `teampreview` | both players have locked in, or the deadline passes |
| `in-progress` | Battle | `move` or `switch` | the engine ends the battle (a win, or a tie from Endless Battle Clause or the turn limit), or someone forfeits on timeouts |
| `ended` | Result | none | never (the room expires) |

### 4.3 Steps

A **step** is one round of requests from the engine. Step 0 is the battle's intro plus the team preview request. After that, a new step starts each time the engine resolves the choices it asked for and issues new requests:

- the team preview resolves (step 1, turn 1);
- each turn resolves;
- a U-turn or Volt Switch asks for a mid-turn switch;
- faint replacements are made;
- the battle ends.

**Step number = event position.** Every step has a number (0, 1, 2, …), its own protocol lines and one deadline. A step begins exactly when an engine call makes `battle.log` grow (§3, "First choice of a turn"), so the server detects a new step by comparing the log length before and after.

### 4.4 Flow

1. **START BATTLE** (host, draft complete). This creates the battle in one transaction: the engine battle, the `battles` row at stage `team-order` and step 0 with a deadline of now + 75 s, and the room phase `battle`. It then publishes `battle-started`.
2. **Battle order.** Each click sends the player's order so far. Every extension publishes `battle-order-progress { slot, count }`, with no Pokémon in it. When a player's order reaches N, the server submits `team …` to the engine. When both have, the engine starts the battle and step 1 begins.
3. **Battle.** Each player submits a choice for the current step. The first choice is saved and published to nobody. The choice that completes the step resolves it and publishes `battle-step`.
4. **Timeouts** run at the deadline (§10).
5. **End.** The step that ends the battle publishes `battle-step` with `result` set. The stage becomes `ended`.

## 5. Schema

### 5.1 `battles` table (`db/schema.ts`)

```ts
// One battle per room: the engine's latest snapshot plus what the routes need without
// deserialising it. `state` and the orders are secret and never leave the server.
export const battles = sqliteTable('battles', {
  roomCode: text('room_code').primaryKey().references(() => rooms.code),
  // JSON.stringify(battle.toJSON()). Holds both teams, every choice and the PRNG state.
  state: text('state').notNull(),
  // Bumped by every save: the compare-and-swap guard (§11). Not sent to clients.
  version: integer('version').notNull().default(1),
  // 'team-order' | 'in-progress' | 'ended'
  stage: text('stage').notNull(),
  // The current step (§4.3). 0 is the intro and team preview.
  step: integer('step').notNull().default(0),
  // JSON number[]: the battle.log index where each step's lines begin; [0] is 0.
  stepStarts: text('step_starts').notNull(),
  // Unix ms when the current step's choices time out; null once ended.
  deadline: integer('deadline'),
  p1Timeouts: integer('p1_timeouts').notNull().default(0),
  p2Timeouts: integer('p2_timeouts').notNull().default(0),
  // JSON number[]: the Battle order so far, as 1-based positions in the player's draft
  // order. Secret: the opponent only sees its length.
  p1Order: text('p1_order').notNull().default('[]'),
  p2Order: text('p2_order').notNull().default('[]'),
  // Set when the stage is 'ended'. winner null with an end reason is a tie.
  winner: integer('winner'),
  endReason: text('end_reason'), // 'normal' | 'forfeit' | 'abandoned'
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
```

This follows research §18.6's design, with these changes:

- `stage`, `step` and `stepStarts` are added (§4);
- the orders are added (§8.2);
- `winner` and `endReason` are added (§12).

`room_code` as the primary key makes a second START BATTLE fail on the key, the same way `draft_picks` guards a turn.

**No new `rooms` columns.** `phase` is already text, so `'battle'` needs no migration. Everything else lives on the battle row.

### 5.2 Migration

Run `npm run db:generate` after editing `db/schema.ts`. It produces `drizzle/0004_<name>.sql` (a single `CREATE TABLE battles …`) and the matching `meta` snapshot. `tests/helpers/test-db.ts` already applies every migration.

### 5.3 Cleanup

In `deleteExpired` (`lib/rooms.ts`), delete `battles` rows for expired rooms **first**, before `type_picks`, `draft_picks` and `players`. This follows the existing "don't rely on cascade" comment. A battle still running when its room reaches the 24 h `FULL_TTL_MS` is deleted with the room. That's acceptable, because a battle lasts minutes.

### 5.4 `RoomState` in the `battle` phase

`getRoomState` (`GET /api/rooms/[code]`) changes in two ways:

- **`draft` stays set in the `battle` phase.** The Battle order screen shows both drafted teams, and the draft is public. The `draft: phase === 'draft' ? …` condition becomes `phase === 'draft' || phase === 'battle'`.
- **New field `battle: { stage: BattleStage; result: BattleResult | null } | null`.** It's read from the `battles` row's plain columns, without deserialising the snapshot, and is set only in the `battle` phase. It tells the client which screen to show. Everything else comes from `GET …/battle`.

`GET /api/rooms/[code]` stays read-only and doesn't apply timeouts. **Decision:** it's the exception to "every battle request checks the deadline" (research §18.4), **because** it never loads the snapshot. The battle client polls `GET …/battle`, which does check.

## 6. Engine integration

### 6.1 Formats and base PP (`lib/pokemon-dex.ts`)

- **Remove `"Picked Team Size = 3"` from `RULESET`** (research §18.1). `RULESET` stays `Team Preview, Cancel Mod, Sleep Clause Mod, Endless Battle Clause, HP Percentage Mod`.
- **Register one format per battle size**, not a `@@@` suffix (§3, first row):

  ```ts
  export const formatName = (size: BattleSize) => `${FORMAT_NAME} ${size}v${size}`; // "[Gen 6] Picomon 3v3"
  export const formatIdFor = (size: BattleSize) => toID(formatName(size));       // "gen6picomon3v3"
  // in buildDex(), for each of BATTLE_SIZES, once (registering twice throws):
  if (!Dex.formats.get(formatIdFor(size)).exists) {
    Dex.formats.extend([{ name: formatName(size), mod: MOD_ID, ruleset: [...RULESET, `Picked Team Size = ${size}`] }]);
  }
  ```

  Keep registering the base `[Gen 6] Picomon` too, so `FORMAT_ID` stays valid. Battles use only the sized ids. The format id is stored inside the snapshot (`state.formatid`), so `Battle.fromJSON` finds the right one again.

  **Decision:** three registered formats, **because** they're the only way tested so far that gives a per-battle team size on our mod and survives `fromJSON`.
- **Base PP in the mod's `Scripts`:** `Scripts: { inherit: "gen6", calculatePP(move) { return move.pp; } }`. Type it as `(this: Battle, move: Move) => number`.

  **Decision:** use the mod, not a per-battle patch (research §18.2 left the choice to this spec), **because** every battle in the format gets it with no per-battle step to forget, and it was verified to survive restore (§3).

### 6.2 `lib/battle-engine.ts` (new, server-only, no database)

This is a pure wrapper around `@pkmn/sim`, so the rules can be unit tested without Turso. It imports `@pkmn/sim` and `lib/pokemon-dex.ts`, so it's server-only, like `lib/pokemon-dex.ts` (data spec §5).

```ts
export type Engine = { battle: Battle; errors: string[] }; // errors: |error| lines from send()

createBattle(opts: { size: BattleSize; seed?: string; teams: { 1: string[]; 2: string[] } }): Engine
restoreBattle(state: string): Engine                     // throws unless gen 6 / mod picomon (§6.3)
serialize(engine: Engine): string                       // JSON.stringify(battle.toJSON())
asked(battle: Battle, slot: Slot): Asked                 // from activeRequest only (below)
hasChosen(battle: Battle, slot: Slot): boolean           // only meaningful while asked (below)
toChoiceString(choice: BattleChoice): string             // §6.4
choose(engine, slot, choice: string): { ok: true } | { ok: false; message: string }
applyDefault(engine, slot): void                         // battle.choose(side, 'default')
forfeit(engine, loser: Slot): void                       // battle.forceWin(other side)
abandon(engine): void                                    // battle.tie()
endResult(battle: Battle, reason: EndReason): BattleResult // winner from battle.winner ('P1' → 1, 'P2' → 2, '' → null)
linesFor(battle: Battle, from: number, to: number, channel: 0 | Slot): string[]   // §7.3
playerRequest(battle: Battle, slot: Slot): PlayerRequest | null                   // §7.2
```

**Where `asked` and `hasChosen` come from (§3, "Requests on a waiting side"):**

- `asked` reads only `side.activeRequest`:
  - null, or `battle.ended`: null;
  - `wait`: null;
  - `teamPreview`: `'team'`;
  - `forceSwitch`: `'switch'`;
  - `active`: `'move'`.

  It never reads `battle.requestState` or `side.requestState`, which are `''` on a waiting side.
- `hasChosen` is defined only when `asked(slot) !== null`. It checks whether the side's choice is complete without side effects: `side.choice.actions.length` against what the request needs (1 for singles), or `side.choice.forcedSwitchesLeft === 0` for a forced switch.
- **Never call `side.isChoiceDone()` on a read path.** It calls `getChoiceIndex()`, which can auto-pass. Write paths can call it after `choose`, because that engine is either saved or thrown away.

### 6.3 Creating the battle

- **Format:** `formatIdFor(room.battleSize)`.
- **Seed:** `'sodium,' + 32 hex chars` from `crypto.getRandomValues` (research §14.3). Tests pass a fixed `seed`. The seed lives only in the snapshot (`prngSeed`).
- **`send` callback:** collects every `|error|` text from `sideupdate` into `engine.errors`, so `choose` can return the message. Nothing else is read from `send`. Requests come from `side.activeRequest` and lines from `battle.log`, both of which `toJSON` keeps.
- **Players:** `battle.setPlayer('p1', { name: 'P1', team })`, and the same for `'p2'`.

  **Decision:** the engine names are `P1` and `P2`, not the players' Home names, **because** names may contain `|` or other protocol characters (`normalizeName` only trims and checks length), and the log carries them (`|player|`, `|win|`). Clients map slots to names from `RoomState.players`.
- **Teams:** `Teams.pack(ids.map((id) => toSet(getPokemon(id)!)))`. `ids` is that slot's draft picks in `pickIndex` order ("draft order", research §18.1). If an id is missing from the pool, throw an error (the draft already rejects unknown ids).
- **Restoring:** `Battle.fromJSON(state)`, then `battle.restart(send)` to reattach the error collector (research §18.6).
  - Then assert `battle.gen === 6 && battle.dex.currentMod === 'picomon'`. If either fails, throw `Error('battle restored without the picomon format')`, which gives a 500.
  - `fromJSON` falls back silently when the sized format isn't registered (§3), and a gen 9 battle saved over the row would quietly corrupt it.
  - `lib/battle-engine.ts` imports `lib/pokemon-dex.ts`, so registration normally runs first. The assertion catches the case where it didn't.

### 6.4 Choices

The API never takes a raw choice string. Bodies are structured, and `toChoiceString` builds the string:

| Body | Engine string | Valid when (checked by the server before `choose`) |
|---|---|---|
| `{ kind: 'move', move: 1–4 }` | `move N` | `asked === 'move'`, and `move <= request.moves.length` |
| `{ kind: 'switch', slot: 2–6 }` | `switch N` | `asked` is `'move'` or `'switch'`, and `slot <= battleSize` |
| team order of length N (§8.2) | `team abcd…` (digits 1–6) | `asked === 'team'`, a permutation of N distinct values in 1–6 |

- **There's no way to send `mega`, `undo`, `default`, `pass`, `shift` or a move given by id.** That covers research §5's "reject `mega`" by construction. The test plan checks it anyway (§15.1).
- `switch N` refers to the position in **this step's** `request.team`. The engine reorders `side.pokemon` as Pokémon switch, which is why every choice names its step (§8.3).
- **Mismatched kinds** are checked by the server and never reach the engine:
  - a `move` when `asked === 'switch'` is 409 `not-asked` with `{ error: 'Must switch.' }`;
  - a `switch` when the bench has no healthy Pokémon is 409 `not-asked` too. This checks the bench only, not `canSwitch`, which is also false when trapped;
  - a switch while trapped (or `maybeTrapped`) reaches the engine, which returns 422 (§7.2).
- The engine has the last word. If `choose` returns false (disabled move, trapped, fainted or active target, a locked move), the server **throws away that engine object** (a rejected `choose` still changes `side.choice.error`, §3) and returns 422 with the engine's message. Nothing is saved for the action. Any due timeouts were already applied in a separate step, and §11 says what happens to them. A Struggle-only or locked request has one move, and `move 1` picks it.
- `default` is used only by the timeout path (§10).

## 7. Per-player views

### 7.1 Public and private

| Information | Owner | Opponent | Ably (shared channel) |
|---|---|---|---|
| Both drafted teams (species, sets) | yes | yes | — (already public through the draft) |
| Battle order, the order so far | yes | **count only** | count only (`battle-order-progress`) |
| Which N were brought, and the lead | yes | revealed by the log as each one switches in | the same |
| Pending choice this step | own `chosen: true` | **nothing** | nothing |
| Request (moves, PP, disabled flags, switch options, exact HP, stats, item) | yes | **no** | no |
| Protocol lines with exact HP (`\|split\|` secret half) | own side's | **no** | no |
| Protocol lines, public half (HP out of 100) | yes | yes | yes |
| Who is being asked (`asked`), deadline, timeout counts, result | yes | yes | yes |
| Snapshot, seed, PRNG state, `inputLog`, `version`, stored orders | **never** | **never** | **never** |

The sets are public through the draft's view-only Detail screen. So the opponent's moves, items and abilities aren't secret, but the engine-level secrets above still are.

### 7.2 `BattleView` (`lib/battle-types.ts`, new)

This file has no `@pkmn/sim` import, so client code can use it.

```ts
export type BattleStage = 'team-order' | 'in-progress' | 'ended';
export type Asked = 'team' | 'move' | 'switch' | null; // null: not being asked (waiting)
export type EndReason = 'normal' | 'forfeit' | 'abandoned';
export type BattleResult = { winner: Slot | null; reason: EndReason }; // winner null: a tie
export type BattleChoice = { kind: 'move'; move: 1 | 2 | 3 | 4 } | { kind: 'switch'; slot: 2 | 3 | 4 | 5 | 6 };

export type TeamMember = {
  position: number;            // 1-based index in this request's team (switch N uses it)
  pokemonId: string;           // data/pokemon id (toID of the species)
  details: string;             // "Gengar, L50, F"
  hp: number; maxhp: number;   // exact, from the request's condition
  status: string | null;       // 'par' | 'brn' | 'slp' | 'frz' | 'psn' | 'tox' | null
  fainted: boolean;
  active: boolean;
  stats: { atk: number; def: number; spa: number; spd: number; spe: number };
  item: string; ability: string; moves: string[];
};

export type MoveOption = {
  move: number;                // 1-based; the body's `move`
  id: string; name: string;
  pp: number; maxpp: number;   // base PP (§6.1)
  disabled: boolean; target: string;
};

export type PlayerRequest =
  | { kind: 'team'; size: BattleSize; team: TeamMember[] }  // all 6, in draft order
  | { kind: 'move'; moves: MoveOption[]; canSwitch: boolean; trapped: boolean; team: TeamMember[] }
  | { kind: 'switch'; team: TeamMember[] }                  // faint replacement or U-turn
  | { kind: 'wait'; team: TeamMember[] };                   // the opponent is choosing

export type BattleView = {
  code: string;
  you: { slot: Slot };
  battleSize: BattleSize;
  stage: BattleStage;
  step: number;
  asked: { 1: Asked; 2: Asked };
  chosen: boolean;                         // you've answered this step (locked in, for team)
  request: PlayerRequest | null;           // null once ended
  order: { yours: number[]; opponentCount: number } | null; // only at 'team-order'
  deadline: number | null;                 // unix ms, server clock
  serverNow: number;                       // for the client's clock offset (§10.3)
  timeouts: { 1: number; 2: number };      // consecutive timeouts, as settled when this step began (§10.2)
  log: { from: number; steps: string[][] }; // this player's lines for steps from..step
  result: BattleResult | null;
};
```

`playerRequest` maps the engine's `side.activeRequest` (research §14.4) into this shape:

- `active[0].moves` becomes `moves`;
- `forceSwitch` becomes `switch`;
- `wait` becomes `wait`;
- `teamPreview` becomes `team`;
- `side.pokemon` becomes `team`, with `condition` split into `hp`, `maxhp`, `status` and `fainted`;
- `pokemonId` is `toID(pokemon.set.species)` from the engine's `Pokemon` object, not from `details`, so it stays the drafted id through forme changes and Transform;
- `canSwitch` is true when `trapped` isn't set and the bench has a healthy Pokémon;
- `maybeTrapped` counts as switchable. The engine rejects the switch if the Pokémon really is trapped, which gives a 422 whose message says so.

**Decision:** send a curated shape, not the raw request, **because** it keeps the client free of engine types, keeps the API stable across engine upgrades, and states plainly what the move and switch numbers in a choice refer to.

### 7.3 Splitting the protocol

The engine writes one omniscient log, `battle.log`. A `|split|pN` line is followed by the secret line for side N, then the public line (§3). The server never forwards `send('sideupdate')`. It derives every view from the log, so a snapshot loaded later gives the same answer:

- **Step k's lines** are `battle.log.slice(stepStarts[k], stepStarts[k + 1] ?? battle.log.length)`.
- **Player s** (`slot` 1 or 2) gets `extractChannelMessages(lines.join('\n'), [s])[s]`, the same split Showdown's `BattleStream` uses for player streams. That's their own secret lines, the opponent's public lines, and every unsplit line.
- **Ably and the public view** use channel `0`, the spectator channel: public lines only.
- **`|t:|` lines are dropped** from every view. They carry the wall clock and are the only lines that differ between replays (research §14.3).
- `|request|` never appears in `battle.log`, so no request can leak through the lines.

`GET …/battle?from=k` returns `log.steps` for steps `k`..`step`. The default is `from=0`, the whole battle, so a refreshed client can rebuild the scene by replaying the lines without animation. A full 6v6 is about 10–20 KB per player (§3). **Decision:** the server sends lines and no server-computed field summary (active Pokémon, HP bars, boosts), **because** the lines already contain all of it, and a summary would be a second source of truth that could leak. The frontend can rebuild state with `@pkmn/protocol` / `@pkmn/client` (MIT), or its own reducer.

## 8. Routes

All routes:

- read the `picomon_player` cookie with `readSessionSecret`;
- normalise the code with `normalizeCode`;
- call one `lib/battle.ts` function and switch on its `kind`, as the room routes do;
- use the existing error strings where they apply.

Every route returns 404 `{ error: 'Room not found.' }` for an unknown or expired room, a missing cookie, or a non-member.

### 8.1 `POST /api/rooms/[code]/battle` — START BATTLE

- **Request:** no body. Host only.
- **`startBattle(db, code, secret, now, opts?: { seed })`:** one write transaction with `withBusyRetry`, like `startTypeBattle`:
  - checks the live room, membership, `slot === 1`, `phase === 'draft'` and 12 picks;
  - builds the battle (§6.3);
  - inserts the `battles` row: `stage 'team-order'`, `step 0`, `stepStarts [0]`, `deadline now + 75_000`, `version 1`;
  - sets `rooms.phase = 'battle'`.

  Building the battle inside the transaction is CPU work only (a few ms).

| Result | Status | Body |
|---|---|---|
| `started` | 200 | `{ ok: true, event: { kind: 'battle-started', battleSize, deadline, at } }`, published |
| `already-started` (phase `battle`, or a key clash on `battles`) | 200 | `{ ok: true }`, not published |
| `not-host` | 403 | `{ error: 'Only the host can start.' }` |
| `not-drafting` (phase isn't `draft`) | 409 | `{ error: 'Not drafting.' }` |
| `draft-incomplete` (< 12 picks) | 409 | `{ error: 'The draft is not complete.' }` |

### 8.2 `POST /api/rooms/[code]/battle/order` — Battle order

- **Request:** `{ order: number[] }`, the player's whole order so far, as 1-based positions in their draft order. Length 1–N, distinct, each 1–6.
- **Meaning:** the stored order must be a prefix of the new one. Sending the same order again is a no-op.

  **Decision:** accept the growing prefix, not one Pokémon per call or only the full order, **because** it fits the screen exactly: each click fills the next slot and can't be undone (design README, Battle order). It also lets the opponent's balls fill in one by one, while retries and out-of-order duplicates stay harmless.
- **Function:** `submitOrder(db, code, secret, order, now)`. It runs in the CAS loop (§11), and `view.log.from` in its response is 0 at stage `team-order`, or 1 if this lock-in started the battle.
- **When the length reaches N:**
  - it calls `choose(slot, 'team ' + order.join(''))`;
  - if the opponent has already locked in, the engine starts the battle, and the same save moves to `stage 'in-progress'`, step 1, settling the timeout counts (§10.2).
  - The count isn't touched at lock-in itself, because that would show the opponent that you'd locked in (§10.2). The `battle-order-progress` count already shows it, by design.

| Result | Status | Body |
|---|---|---|
| `progressed` | 200 | `{ ok: true, events, view }`, where `events` is `[battle-order-progress]`, plus `battle-step` (step 1) if this lock-in started the battle |
| `unchanged` (same order as stored, checked before the stage, so a resent lock-in after the battle has started is a success) | 200 | `{ ok: true, events: [], view }` |
| `invalid-order` | 400 | `{ error: 'invalid-order' }` |
| `order-conflict` (doesn't extend the stored order) | 409 | `{ error: 'Order already chosen.', view }` |
| `not-ordering` (stage isn't `team-order`, including after a timeout) | 409 | `{ error: 'Not choosing an order.', view }` |
| `busy` | 503 | `{ error: 'Busy, try again.' }` |

### 8.3 `POST /api/rooms/[code]/battle/choice` — move or switch

- **Request:** `{ step: number, choice: { kind: 'move', move: 1–4 } | { kind: 'switch', slot: 2–6 } }`. `step` is the step this choice answers.
- **`submitChoice(db, code, secret, step, choice, now)`** runs inside the CAS loop (§11):
  1. apply any due timeouts (§10);
  2. check `step` against the current step;
  3. check `asked` and `hasChosen`;
  4. build the choice string and call `choose`;
  5. if the log grew, record the new step (§4.3) and settle both timeout counts (§10.2);
  6. save.

  A first choice changes nothing an opponent can see. `timeouts`, `deadline`, `step` and `asked` all stay the same until the step resolves (finding: an early count reset would leak the choice).

| Result | Status | Body |
|---|---|---|
| `chosen` (the step is still open) | 200 | `{ ok: true, events: [], view }`, not published |
| `resolved` (this choice completed the step) | 200 | `{ ok: true, events: [battle-step], view }`, published |
| `invalid-body` | 400 | `{ error: 'invalid-choice' }` |
| `stale-step` (`step` ≠ current, e.g. a timeout got there first) | 409 | `{ error: 'stale-step', events, view }`. `events` are the timeout's events, which are also published. |
| `not-asked` (your request is `wait`, the stage is `team-order`, or the kind doesn't match, §6.4) | 409 | `{ error: 'Not your turn.', view }`, or `{ error: 'Must switch.', view }` for a `move` sent when a switch is due |
| `already-chosen` | 409 | `{ error: 'Already chosen.', view }` |
| `ended` | 409 | `{ error: 'The battle is over.', view }` |
| `rejected` (the engine returned false) | 422 | `{ error: 'invalid-choice', message: '<engine text>', view }`. For a switch the engine refused because of a hidden trap (Shadow Tag, Arena Trap), the view's request says `trapped: true, canSwitch: false`. That's private to the player, and nothing is saved: the rejected engine is still thrown away, so a later view can offer the switch again, and the engine refuses it again. |
| `busy` | 503 | `{ error: 'Busy, try again.' }` |

Each 409 or 422 response carries the current `view`, so the client can correct itself without another request. `view.log.from` is the request's `step + 1` (or the current step if that's lower), so the response only carries steps the client doesn't have.

### 8.4 `GET /api/rooms/[code]/battle?from=k` — the player's view

- Calls `await connection()` first, like the room GET.
- Runs `getBattleView(db, code, secret, from, now)`. **If the deadline has passed, it applies the timeouts first** (§10) through the CAS loop and publishes their events. Otherwise it's a plain read.
- **200:** `BattleView`.
- **400:** `from` isn't a non-negative integer. A `from` beyond the current step is clamped.
- **409:** `{ error: 'No battle yet.' }` when the room isn't in the `battle` phase.
- **503:** `{ error: 'Busy, try again.' }` when applying a timeout uses up the CAS retries.
- If applying the timeouts throws (a bug), the GET logs it and returns the saved state read-only, so neither player is locked out. The POST routes still fail with the error.

### 8.5 `POST /api/rooms/[code]/battle/timeout` — the countdown trigger

- **Request:** `{ step: number }`, the step the client's countdown is for.
- **`triggerTimeout(db, code, secret, step, now)`:** the same due-timeout path as the GET, run explicitly.
  - If `step` is lower than the current step, the countdown it's for is already over. The call returns at once, with no write and `events: []`, and the client catches up from `view`.
  - The response's `view.log.from` is `step + 1`.
- **200:**
  - `{ ok: true, events, view }`;
  - `events` is empty when nothing was due: clock skew, the step already moved on, or the other player's trigger won;
  - the client re-arms from `view.deadline` and `view.serverNow`.
- **409:** `{ error: 'No battle yet.' }`. **400:** a bad body. **503:** `busy`.

**Decision:** both the GET and an explicit POST check the deadline, **because** research §18.4 asks every battle request to check it, and a POST is the natural trigger when a countdown reaches zero (it changes state). The GET path covers a client that only polls. Both paths share one function, so they can't drift apart.

## 9. Realtime events

### 9.1 Types (`lib/battle-types.ts`, `lib/room-events.ts`)

```ts
// RoomEvent (lib/room-events.ts) gains:
| { kind: 'battle-started'; battleSize: BattleSize; deadline: number; at: number }

// lib/battle-types.ts
export type BattleEvent =
  | { kind: 'battle-order-progress'; slot: Slot; count: number }
  | {
      kind: 'battle-step';
      step: number;                    // position (§9.4)
      lines: string[] | null;          // public (channel 0) lines of this step; null = too big, fetch
      asked: { 1: Asked; 2: Asked };
      deadline: number | null;
      at: number;                      // server time at commit, for the clock offset
      timeouts: { 1: number; 2: number };
      timedOut: Slot[];                // whose default (or forfeit) produced this step
      result: BattleResult | null;     // set on the step that ends the battle
    };
```

There are no "own" event kinds, unlike `own-type-pick`. The player's private result (their order so far, `chosen`, their new request) comes back as the `view` in their POST response (§9.3).

- Events go on the existing `room:<code>` channel. The Ably message name is `kind`, as in realtime spec §4.
- `notifyRoomEvent`'s parameter widens to `RoomEvent | BattleEvent`. It still only logs a failure.
- **Decision:** until the frontend routes battle events, `battle-order-progress` and `battle-step` stay out of `parseRoomEvent`. It returns null for them, so the room client treats them as a generic "something changed" and refetches, which is harmless. The frontend spec routes them to a battle sync.

**`lib/room-events.ts` in the `battle` phase.** Today's `applyEvent` misbehaves once a room is in the battle phase:

- `draft-started` falls through to `next` and resets the draft to empty;
- `draft-picked` holds and then refetches;
- `stateKey` ignores `battle`.

So:

| Event, when local phase is `battle` | Result |
|---|---|
| `type-battle-started`, `type-round-resolved`, `type-round-started`, `own-type-pick` | `SAME` (stale) |
| `draft-started` | `SAME` if `firstDrafter` matches the held `draft`, else `CONFLICT` |
| `draft-picked` | `SAME` if it matches the held pick at `pickIndex`, else `CONFLICT` |
| `battle-started` | `SAME` |

| `battle-started`, when local phase is… | Result |
|---|---|
| `draft` with 12 picks | `next`: phase `battle`, `battle: { stage: 'team-order', result: null }`, `draft` kept |
| `draft` with fewer than 12 picks | `HOLD` (a pick is late) |
| `lobby` or `type-battle` | `HOLD` |

- `progress()`: phase `battle` gives `3e6`, plus 1 for stage `in-progress` and 2 for `ended`.
- `stateKey` adds `battle && [battle.stage, battle.result?.winner, battle.result?.reason]`.
- Tests go in `tests/lib/room-events.test.ts` (§15.4).

### 9.2 Which route publishes what

All events are published **after the commit**, in order, from the request that committed them.

| Trigger | Published |
|---|---|
| START BATTLE | `battle-started` |
| Order prefix grows | `battle-order-progress { slot, count }` |
| The second lock-in | `battle-order-progress { slot, count: N }`, then `battle-step { step: 1 }` |
| The first choice of a step | **nothing** (the opponent mustn't learn that it was made) |
| The choice that completes a step | `battle-step` |
| Due timeouts (GET, timeout or choice route) | `battle-step` with `timedOut`, plus `result` if it was a forfeit |

### 9.3 The player's own response

The POST bodies above already carry `events` (exactly what was published) and the player's `view` (private, including the new request and their own lines with exact HP). The client applies both and skips the refetch, as in realtime spec §4.3.

The **opponent** of the resolving player gets the public `battle-step` and starts animating its public lines straight away. It then fetches `GET …/battle?from=<step>` at once for its new request and its own exact-HP lines. The animation takes seconds and the fetch takes well under one, so the player never waits on it.

**Decision:** one shared channel plus a fetch for the private half. **Rejected for now:** a per-player private channel (`room:<code>:p<slot>`, with the token granting only your own). That would save the fetch, but it means a second capability, a second subscription and two more publishes per step for no visible gain (settled, §16).

### 9.4 Positions, for ordering and gap detection

| Event | Position | Applies when |
|---|---|---|
| `battle-started` | phase | local phase is `draft` |
| `battle-order-progress` | `count` per `slot` | local stage is `team-order` and `count` > the held count for that slot. A lower or equal count is a duplicate. |
| `battle-step` | `step` | `step === local step + 1`. Equal: a duplicate (or the echo of your own POST). Greater: hold for 500 ms, then fetch `?from=local step + 1`. |

These are the realtime spec's rules (§5): next, already applied, ahead (hold), doesn't fit (fetch). The step number is a natural position, like `pickIndex`, so no extra counter is needed. `version` stays private, because first choices bump it without an event, and a client would see false gaps.

### 9.5 The 64 KB limit

A step's public lines are normally under 5 KB. A whole 6v6 was about 9 KB (§3). Still, `notifyRoomEvent` callers check `Buffer.byteLength(JSON.stringify(event), 'utf8')`, which counts bytes, not UTF-16 units, so "Pokémon" text is measured correctly. Above **60 000** bytes, they publish the event with `lines: null`, and a client fetches `?from=step` instead. All other events are a few hundred bytes.

## 10. Timer enforcement

### 10.1 The deadline

- Every save that starts a step sets `deadline = now + 75_000`. That includes START BATTLE, the team preview resolving, each turn, a mid-turn switch and faint replacements.
- A first choice doesn't change it. Ending sets it to null.
- **Decision:** one deadline per step, shared by every player being asked, **because** the engine asks them at the same moment (research §18.5).
- The deadline is measured from the commit. Animation time on the client counts toward the 75 s (§16, question 1 for the user).
- **Latency grace.** **Decision:** the server applies timeouts only when `now >= deadline + GRACE_MS`, with `GRACE_MS = 1000` (in `lib/battle-types.ts`), **because** a click a moment before the deadline can reach the server a few hundred ms late, and it mustn't earn a strike. The client counts down to `deadline`, so the visible clock still shows 75 s. It only fires the trigger after the grace (§10.3).

### 10.2 Applying due timeouts (`applyDueTimeouts` in `lib/battle.ts`)

This runs at the start of every CAS attempt on the GET, choice, order and timeout routes, when `stage !== 'ended'` and `now >= deadline + GRACE_MS`. It returns `{ save: boolean; events: BattleEvent[] }`, where `save` is true when it changed the engine. For each slot that is asked and hasn't chosen (§6.2):

1. Its count for this step would be `stored count + 1`.
2. If that makes 3, the slot forfeits:
   - if only one slot reaches 3: `forfeit(slot)`, which is `forceWin(other)`, with reason `'forfeit'`;
   - if both reach 3 in the same step: `abandon()`, which is `tie()`, with reason `'abandoned'`.
3. Otherwise, `applyDefault(slot)`. The engine picks (research §18.4):
   - for team order: the first N in draft order;
   - for a move: the first move that isn't disabled, or Struggle;
   - for a forced switch: the first healthy bench Pokémon.

   Any partial Battle order is ignored (settled, §16).

After this, the engine has every choice it asked for, so it resolves the step. Exactly one new step is recorded, with `timedOut` listing the slots, and its deadline is now + 75 s. **Decision:** at most one timeout round per request, with the new deadline counted from processing time, not from the old deadline, **because** a player returning after a long absence then gets a fresh 75 s, rather than a cascade of missed deadlines all at once.

**Settling the counts. Decision:** the counts change **only when a step resolves**, never when a choice arrives. **Because** a count that dropped to 0 on a first choice would show the opponent, mid-step, that you'd chosen (review finding 1). When step k resolves, whether by the last choice or by timeouts:

- for each slot that was asked in step k:
  - 0 if it chose in time (including a full lock-in);
  - the stored count + 1 if the server played its default (or forfeited it);
- a slot that wasn't asked (`wait`) keeps its count.

Views and events always show the counts as stored, which means as settled when the current step began. A first choice writes the snapshot only. Its `timeouts`, `deadline` and `step` columns don't change, so the opponent's view before and after it is byte-identical (ignoring `serverNow`; tested, §15.2). Progress on a partial order never resets a count. The third timeout forfeits **instead of** playing the default.

**Both reach 3 in the same step.** **Decision:** a tie with reason `'abandoned'`, **because** neither player is still playing, and naming a winner would reward whoever happened to be slot 1.

**The choice route after a timeout.** A choice that arrives after the timeouts have been applied is always `stale-step` before it reaches the engine: applying timeouts always resolves the step (every asked slot now has a choice), so `step` moves on and the body's `step` no longer matches.

### 10.3 Triggering

- Each client keeps a clock offset: `serverNow` (from views) or `at` (from events), minus the local `Date.now()` when it arrived.
- The visible countdown reaches 0 at `deadline`. At `deadline + GRACE_MS + 250 ms` server time, the client calls `POST …/battle/timeout { step }`, at most once every 2 s.
- Both players' clients may fire. The CAS loop makes the loser a no-op (§11).
- If neither player is connected, nothing happens until one returns. The room's expiry cleans up after that (research §18.4).

## 11. Concurrency

**Decision: compare-and-swap on `battles.version`, not a write transaction.**

Each mutating call runs `withBattle(db, code, secret, now, mutate)`:

```
for attempt in 1..5:
  row ← SELECT * FROM battles WHERE room_code = ?        (room and membership checked first)
  engine ← restoreBattle(row.state)
  t ← applyDueTimeouts(engine, row, now)                  → { save, events, fields }
  if t.save: base ← serialize(engine)                     (the state with the timeouts applied)
  m ← mutate(engine, row with t.fields)                   → { save, outcome, events, fields }
  if m is a rejection (422, 409):
      the engine is discarded; if t.save, write base and t.fields alone; else no write
  else if m.save: write serialize(engine) with t.fields + m.fields
  else if t.save: write base with t.fields
  else: return outcome                                    (no write, nothing published)
  write = UPDATE battles SET state, version = version + 1, stage, step, step_starts, deadline,
          p1_timeouts, p2_timeouts, p1_order, p2_order, winner, end_reason, updated_at
           WHERE room_code = ? AND version = row.version
  if rowsAffected = 1: publish the written events (t.events, then m.events if written); return outcome
  (lost the race: the other player saved first)
  sleep 10–50 ms (random jitter), then reload and redo the whole attempt
after 5 attempts: return busy (503)
```

- **A busy database** (`SQLITE_BUSY` / `SQLITE_LOCKED`) on the CAS `UPDATE` counts as a lost race: reload and retry, within the same 5 attempts.
- **"Changed" is explicit.** Both steps return `save: boolean`. Nothing infers it from comparing engines.
- **A rejected `mutate` never saves its engine,** because a rejected `choose` still mutates it (§3). When timeouts were also applied, the attempt writes the serialised state taken *before* `mutate` ran.
- In practice, a choice after due timeouts is always `stale-step` (§10.2), so the rejection never reaches the engine anyway. The `base` snapshot covers the general rule.

**Client retries.** **Decision:**

- on a 503, or when the response is lost, the client resends the **same** body once, after 300–600 ms;
- a retried choice that comes back `already-chosen` (409) for the same step counts as success, and the client takes its state from that response's `view`;
- a retried order that comes back `unchanged` is success too;
- a `stale-step` means the step moved on, so the client applies `events` and `view` instead.

Every POST is safe to repeat, because each names its step or carries its whole order.

- **No choice is lost.** If players A and B both load version *v*, only one `UPDATE … AND version = v` matches. The other gets `rowsAffected = 0`, reloads version *v + 1* (which holds the first choice) and applies its own choice on top.
- **Retries are safe.** The engine is deterministic, so the retry re-validates against the new state. If the step moved on in the meantime, the result is `stale-step`.
- **A rejected action still saves due timeouts.** If timeouts changed the engine but the action was rejected (e.g. `stale-step`), the snapshot is still saved and the timeout's events published.

**Why CAS:**

1. **Lock time.** Turso is SQLite, so a write transaction (`BEGIN IMMEDIATE`, as `joinRoom` does) locks the **whole database**, every room, for its network round trips. It would be held while about 50 KB is read, parsed, run and written back. CAS holds no lock between the read and the write. The single `UPDATE` is atomic on its own.
2. **Conflicts are rare and cheap.** They only happen when both players submit within one round trip of each other. The retry costs one more read.
3. **The guard was already planned.** Research §18.6 has the `version` column, and it costs nothing extra, because every save writes the row anyway. That's unlike the `rooms.version` counter rejected in realtime spec §10.

START BATTLE is the exception. It writes two tables once, so it uses the existing transaction pattern (§8.1).

## 12. Battle end

| How it ends | Engine | `winner` | `endReason` | Last line |
|---|---|---|---|---|
| All of one side's Pokémon fainted | `battle.ended`, `battle.winner = 'P1'`/`'P2'` | that slot | `normal` | `\|win\|P1` |
| Endless Battle Clause (berry cycling, where the engine calls `battle.win(foe)`) | `battle.winner` set | that slot | `normal` | `\|win\|…` |
| Endless Battle Clause (other cases), or the turn-1000 limit | engine `tie()` | null | `normal` | `\|tie` |
| Three timeouts in a row | `forceWin(other)` | the other slot | `forfeit` | `\|win\|…` |
| Both reach three in the same step | `tie()` | null | `abandoned` | `\|tie` |

Any end the engine reaches by itself is `normal`. Its `winner` comes from `battle.winner` (`'P1'`, `'P2'` or `''` for a tie). Only the server's own forfeit paths set `forfeit` or `abandoned`.

- **Stored:** `stage = 'ended'`, `winner`, `endReason`, `deadline = null` and the final snapshot. These are all saved by the same CAS update as the step that ended the battle.
- **Clients receive:**
  - the final `battle-step` with `result`;
  - `BattleView.result`;
  - `RoomState.battle.result`.
- After the end, choices return 409 `ended`, and the GET keeps working until the room expires.
- What happens next (a rematch, or back to Home) is a product question for the user (§16, question 2). The room keeps its TTL.

## 13. Errors and validation

| Check | Where | Response |
|---|---|---|
| Cookie, room, membership | every route (`findLiveRoom`, `findMember`) | 404 |
| Body shape: `order` is an int array of length 1–6, distinct values 1–6; `step` is a non-negative int; `choice.kind` is `move` (1–4) or `switch` (2–6) | route, before the database | 400 |
| `order.length` ≤ N (the room's `battleSize`) | lib (`submitOrder`) | 400 `invalid-order` |
| Phase is `battle` (or `draft` for START) | lib | 409 |
| Stage matches the route | lib | 409 with `view` |
| `step` equals the current step | lib | 409 `stale-step` with `view` |
| Asked and not yet chosen | lib (`asked`, `hasChosen`) | 409 with `view` |
| The engine accepts the string | `choose` | 422 with the engine message and `view`. Not saved. |
| CAS retries used up (any of the five routes), or `SQLITE_BUSY` on START | lib | 503 |
| Snapshot fails to parse or restore, or restores with the wrong generation or mod (§6.3) | lib | throws, giving a 500 (a bug: the row is only ever written by `serialize`, and the format is registered on import) |

The server never returns `state`, `version`, the stored orders or the seed. Every response body is built from `BattleView`, `RoomState` or an event, never by spreading a database row.

## 14. Files

| File | Change |
|---|---|
| `lib/pokemon-dex.ts` | Drop `Picked Team Size = 3` from `RULESET`. Register the 3v3/4v4/6v6 formats, plus `formatName` and `formatIdFor`. Add `calculatePP` to `Scripts`. |
| `lib/battle-engine.ts` (new) | §6.2–6.4, §7.2 mapping, §7.3 splitting |
| `lib/battle.ts` (new) | `startBattle`, `getBattleView`, `submitOrder`, `submitChoice`, `triggerTimeout`, `withBattle` (§11), `applyDueTimeouts` (§10), and building views and events |
| `lib/battle-types.ts` (new) | `BattleStage`, `Asked`, `BattleResult`, `TeamMember`, `MoveOption`, `PlayerRequest`, `BattleView`, `BattleChoice`, `BattleEvent`, `TIMER_MS = 75_000`, `GRACE_MS = 1000`, `MAX_TIMEOUTS = 3` |
| `lib/types.ts` | `Phase` adds `'battle'`. `RoomState` adds `battle`. |
| `lib/room-events.ts` | `RoomEvent` adds `battle-started`. `parseRoomEvent`, `applyEvent`, `progress` and `stateKey` change as in §9.1. |
| `lib/rooms.ts` | `deleteExpired` deletes `battles` first. `getRoomState` keeps `draft` in `battle` and reads `battle` (§5.4). |
| `lib/ably-server.ts` | `notifyRoomEvent(code, event: RoomEvent \| BattleEvent)` |
| `db/schema.ts`, `drizzle/0004_*.sql` | the `battles` table (§5) |
| `app/api/rooms/[code]/battle/route.ts` (new) | `POST` (START BATTLE), `GET` (view) |
| `app/api/rooms/[code]/battle/order/route.ts` (new) | `POST` |
| `app/api/rooms/[code]/battle/choice/route.ts` (new) | `POST` |
| `app/api/rooms/[code]/battle/timeout/route.ts` (new) | `POST` |
| `docs/research/2026-10-19-gen6-battle-mechanics.md` | A one-line note under §18.1 pointing to this spec's §3 (the `@@@` finding) |

## 15. Test plan

These follow the existing style: Vitest with `// @vitest-environment node`, an in-memory database from `createTestDb()`, injected `now` (`T0`), and the Ably mocks from `tests/api/rooms.test.ts`. Engine tests use hand-written sets where a specific move is needed (e.g. Sludge Bomb), and pool entries otherwise.

### 15.1 `tests/lib/battle-engine.test.ts` (no database)

- **Formats:**
  - for N in 3, 4 and 6, `createBattle` gives `gen === 6`, `dex.currentMod === 'picomon'`, `ruleTable.pickedTeamSize === N` and a `team` request with `size` N;
  - after both lock in, each side has exactly N Pokémon in the chosen order;
  - `RULESET` doesn't contain `Picked Team Size`;
  - a sized format id survives `serialize` → `restoreBattle`, with the mod and the rules intact.
- **Base PP:** Sludge Bomb has `maxpp` 10 in the request, both straight after creation and after a restore.
- **Cold restore:**
  - `restoreBattle` of a saved snapshot gives `gen === 6` and mod `picomon`;
  - with `formatid` in a saved snapshot edited to an unregistered id, `restoreBattle` throws instead of returning a gen 9 battle.
- **`asked` and `hasChosen`:**
  - a waiting side is `null`;
  - reading `asked` and `hasChosen` doesn't change the serialised engine (compare `serialize` before and after).
- **A valid choice after a rejected one:** restore, `choose` a disabled move (rejected), then restore again from the same state and make a valid choice. It succeeds, and the saved state has no `choice.error`.
- **Endless Battle Clause win:** a berry-cycling set-up (e.g. Recycle + Leppa Berry on both sides, past turn 100) ends with `|win|`, and `endResult(…, 'normal')` names the right slot. If that set-up proves hard to build, assert the mapping from a forced `battle.win(side)` instead.
- **Determinism:** a fixed seed and a fixed list of choices give the same `linesFor(…, 0)` with and without a restore before every choice. Keep a short golden log (stripped of `|t:|`) as a regression check for package upgrades (research §16.2).
- **Choice strings:** `toChoiceString` only ever produces `move [1-4]`, `switch [2-6]` or `team [1-6]{N}`. The route test shows that extra body fields (`mega: true`, `choice: 'move 1 mega'`) are ignored and can't change the string.
- **Step detection:** a first choice leaves `battle.log.length` unchanged. The second resolves the step. A U-turn gives a step with no `|turn|`, where the user is asked `switch` and the other side `null`.
- **Defaults:**
  - for team: the first N in draft order;
  - for a move: the first move that isn't disabled. With the first move disabled (Disable, or a Choice lock on another move), it's the next one. With 0 PP, it's Struggle;
  - for a forced switch: the first healthy bench Pokémon;
  - `applyDefault` on a slot that isn't asked does nothing.
- **Faint replacements:** a single faint asks only that side `switch`, and the other gets `wait`. A double faint asks both, neither view shows the other's switch until both are in, and a timeout on one side defaults that side only.
- **Secrecy of views:**
  - p2's lines never contain p1's exact-HP form (e.g. `|switch|p1a: …|235/235`). p1's lines do;
  - the channel-0 lines contain no exact HP for either side;
  - `playerRequest(…, 2)` contains only p2's team;
  - `JSON.stringify` of either view contains neither the seed nor `inputLog`.

### 15.2 `tests/lib/battle.test.ts` (database)

- **START:**
  - only the host can start, only in `draft` with 12 picks, and a second call is `already-started`;
  - the row has stage `team-order`, step 0 and deadline `T0 + 75_000`;
  - the room phase is `battle`;
  - `getRoomState` still has `draft` and gains `battle.stage`.
- **Order:**
  - the prefix rules: extending works, the same order again is `unchanged`, a different prefix is `order-conflict`, and duplicates or values out of range are rejected;
  - the opponent's view shows `opponentCount` only;
  - the second lock-in moves to `in-progress` at step 1;
  - after both lock in, each view's step-1 lines show only that player's own exact HP.
- **Choices:**
  - the first choice saves `chosen: true` and returns no events;
  - **the opponent can't see it:** the opponent's `getBattleView`, serialised with `serverNow` removed, is byte-identical before and after the first choice. That covers `timeouts`, `deadline`, `step`, `asked` and `log`;
  - the second resolves the turn;
  - a `step` mismatch is `stale-step`;
  - a disabled move is 422 and the row's `version` is unchanged.
- **Timeouts** (with `now = T0 + 75_000 + GRACE_MS`):
  - **grace window:** at `T0 + 75_000 + GRACE_MS − 1`, nothing is applied, and a choice made then is accepted with no strike;
  - the GET applies the default to the player who didn't choose, bumps their count when the step resolves, publishes one `battle-step` with `timedOut`, and sets the new deadline to `now + 75_000`;
  - **counts settle at resolution:** a player who chose in time goes to 0 at that resolution, not when they chose;
  - **a timeout during a U-turn step:** only the switching side is asked, so only it gets the default and the strike. The other side's count is unchanged;
  - calling the trigger again at the same `now` changes nothing;
  - three in a row ends with `forfeit` and the right winner;
  - an in-time choice between timeouts resets the count, so a timeout, a choice and two more timeouts don't forfeit;
  - both players timing out three times gives `abandoned` with winner null;
  - a team-order timeout gives the draft-order default and counts as a strike;
  - a choice posted after the deadline gets `stale-step`, and the timeout's step is saved.
- **Concurrency:**
  - make `withBattle`'s first attempt lose its CAS: a test hook writes the opponent's choice between the load and the update. The retry must see both choices, and the step must resolve with both choices in the log;
  - also run `Promise.all` of both players' `submitChoice` calls. Exactly one `battle-step` comes out of it, and both choices appear in the log;
  - a CAS that keeps failing returns `busy` after 5 attempts.
- **End:** the result fields are set in the same save as the last step. Later choices get `ended`.
- **Cleanup:** after expiry, `createRoom`'s `deleteExpired` removes the `battles` row.

### 15.3 `tests/api/battle.test.ts` (routes)

- Every status code in §8, including 404 without a cookie and 400 for bad bodies.
- **Events after commit:** the `notifyRoomEvent` mock reads the database when it's called, and asserts that the state it describes is already saved.
- Each event is published once. A first choice and an unchanged order publish nothing.
- **Event payloads:**
  - the lines in `battle-step` equal the spectator split;
  - neither the lines nor any other field carries a request, exact HP, an order or the seed;
  - a payload forced over 60 000 bytes (by stubbing `linesFor`) is published with `lines: null`.
- **Responses:** POST responses carry `events` equal to what was published, plus a `view` whose `log.from` is the answered step + 1.
- **Size check:** a full 6v6 played on `default` from the pool keeps every published event under 64 KB. Snapshots grow with the turn count, so instead of a fixed cap, assert that the growth per turn is under 2 KB. A 74-turn game reached 78 KB, which is fine for Turso.

### 15.4 `tests/lib/room-events.test.ts` (additions)

- In phase `battle`:
  - every type battle event is `SAME`;
  - `draft-started` and `draft-picked` are `SAME` when they match the held draft, and `CONFLICT` when they don't;
  - a duplicate `battle-started` is `SAME`.
- `battle-started` is `HOLD` while local picks are fewer than 12 (or the phase is `lobby` or `type-battle`). With 12 picks, it gives `next`: phase `battle`, `draft` kept.
- `progress` orders `draft` < `battle`/`team-order` < `in-progress` < `ended`. `stateKey` differs when `battle.stage` or `battle.result` differs.
- `parseRoomEvent` returns null for `battle-step` and `battle-order-progress` (a generic refetch).

## 16. Open questions

These were settled in review and are recorded here so they aren't reopened:

- **A partial Battle order at the timeout:** keep the decided `default`, the first N in draft order. Slots already filled are ignored, even though the engine would accept a partial `team 25` (§3).
- **Private per-player Ably channel:** rejected (§9.3). Revisit only if the fetch after a `battle-step` ever shows on screen.
- **After the battle, on the server:** the room keeps its TTL. The battle stays at `ended` until the room expires.
- **Manual forfeit:** a new feature, already a non-goal (§2). It's not an open question for this spec.

For the user. Neither blocks the server work. **Answered 2026-10-21:**

- **(1) Animation time: deferred to the frontend spec.** The server keeps a deadline of 75 s + 1 s grace from step resolution (§10.1).
- **(2) After the battle: decided later.** For now the room keeps its normal TTL and the result stays readable (§12).

The questions as asked:

1. **Animation time and the 75 s.** The server ships with a deadline of commit + 75 s and a 1 s latency grace (§10.1), so the time a client spends animating the turn counts toward the 75 s. Should the countdown pause during animations? That would need a longer server deadline, for example commit + 75 s + the animation's length. The question belongs in the frontend spec, which knows how long animations take.
2. **After the battle, in the product.** Is a rematch (same teams, or a new draft) or a "back to Home" flow wanted? It would be its own spec.
