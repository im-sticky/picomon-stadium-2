# Battle Brainstorm — Starting Point

*Created 2026-10-16. Updated 2026-10-21: all open questions answered. Start here when brainstorming the battle spec.*

Background research: [Gen 6 battle mechanics](2026-10-19-gen6-battle-mechanics.md).

## Decided

- **Singles only.** No doubles mechanics.
- **Mechanics and data are Gen 6** (X/Y and Omega Ruby/Alpha Sapphire, as Showdown's gen6 engine implements them). **The visuals come from the older games** (Pokémon Crystal / Gen 2 look).
- **No Mega Evolution** (and no Primal Reversion) and **no terrain** (Electric/Grassy/Misty). *Decided 2026-10-19.*
- **Engine:** use Pokémon Showdown's ready-made engine from npm (`@pkmn/sim`, with `@pkmn/dex` / `@pkmn/data` for data; all MIT) in its **gen6** mode. Don't write a custom engine.
- **Fidelity:** where Showdown and the original cartridge differ, match Showdown. The npm package data is trusted as-is, with no extra cross-checking against Bulbapedia.
- **Authority model (from the room-join PoC):** the server resolves turns with server-side randomness, stores state in Turso and publishes results over Ably. Clients only send their chosen action.
- **Base PP, no PP Ups (must do when building the battle).** The draft and Detail screens show each move's **base** PP (e.g. Sludge Bomb 10/10). Showdown's engine gives every move **3 PP Ups by default** (Sludge Bomb would have 16 PP). When the server builds each team for the engine, it must set PP Ups to 0 for every move, so the battle matches what players saw. *Decided 2026-10-20.*

### Answered 2026-10-21

- **Level 50.** Already set by the data loader (`LEVEL` in `lib/pokemon-dex.ts`) and shown as LV.50 on Detail.
- **Team size: draft 6, bring 3, 4 or 6.** The host picks the battle size on Home. Each player drafts 6, then chooses which to bring, and in what order, on the Battle order screen. Both teams are visible there, so that screen is the team preview.
- **Team source: the draft.** Players rent Pokémon from a hand-picked pool with fixed sets (moves, item, nature, EVs from `data/pokemon/`). Players can't edit sets.
- **Species pool: hand-picked**, from whatever is in `data/pokemon/`. Legendaries allowed, with at most one uber and one strong Pokémon (base stat total 580–600) per player (enforced in the draft).
- **Learnsets and X/Y vs ORAS: no longer an issue.** Sets are written by hand and not checked against learnsets, so the data files are the only control over which moves a Pokémon gets.
- **Clauses:**
  - Turn on **Sleep Clause** and **Endless Battle Clause** in the engine.
  - No **Item Clause**.
  - **No OHKO, Evasion or Self-KO clauses.** Those moves are allowed if a Pokémon's set has them, with no data check. *Changed 2026-10-21.*
  - **Species Clause** is already guaranteed by the draft (each Pokémon can be rented once).
- **IP posture: real Pokémon names, data and sprites.** Free, never charged for, credited as an unofficial fan project (as on Home today).
- **Turn timer: 75 seconds for every choice**: team order on the Battle order screen, moves and switches, and faint replacements, with a visible countdown.
  - On timeout, the server submits the engine's own `default` choice: the first usable move, the first healthy bench Pokémon for a replacement, or the team in draft order on the Battle order screen. *Changed 2026-10-21 from a random choice.*
  - **Three timeouts in a row and that player forfeits.**
  - Disconnects need no separate handling: a disconnected player just doesn't choose, so the timer covers it. Refreshing puts them back in the battle.
- **Faint replacements** follow the engine (Gen 5+ rules):
  - Only the player who lost a Pokémon chooses; the other sees a waiting message.
  - If both fainted, both choose at once, and neither sees the other's choice until both have picked.
  - Same 75-second timer.
- **Saving battles: one row per battle with the engine's latest snapshot.**
  - A new `battles` table, keyed by room code. After each turn the server saves `battle.toJSON()` into that row, overwriting it.
  - The next request restores it with `Battle.fromJSON(...)`.
  - The snapshot holds both teams' hidden information, so it never leaves the server. Each player gets their own view.
  - The row is deleted with the room when it expires.
  - **No choice log for now** (it could be added later for debugging or replays).

## Open questions

None. Everything above is decided. §18 of the [Gen 6 research](2026-10-19-gen6-battle-mechanics.md) turns these answers into spec (format and team size, base PP, clauses, the timer, faint replacements and saving). The next step is the battle spec.
