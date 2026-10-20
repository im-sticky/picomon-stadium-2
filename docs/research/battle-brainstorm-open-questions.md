# Battle Brainstorm — Starting Point

*Created 2026-10-16. Updated 2026-10-19: the battle engine moved from Gen 4 to Gen 6. Start here when brainstorming the battle spec.*

Background research: [Gen 6 battle mechanics](2026-10-19-gen6-battle-mechanics.md). The earlier [Gen 4 HGSS research](2026-10-16-gen4-hgss-battle-mechanics.md) is superseded and kept for reference only.

## Decided

- **Singles only.** No doubles mechanics.
- **Mechanics and data are Gen 6** (X/Y and Omega Ruby/Alpha Sapphire, as Showdown's gen6 engine implements them). **The visuals come from the older games** (Pokémon Crystal / Gen 2 look). *Changed from Gen 4 HGSS on 2026-10-19.*
- **No Mega Evolution** (and no Primal Reversion) and **no terrain** (Electric/Grassy/Misty). *Decided 2026-10-19.*
- **Engine:** use Pokémon Showdown's ready-made engine from npm (`@pkmn/sim`, with `@pkmn/dex` / `@pkmn/data` for data; all MIT) in its **gen6** mode. Don't write a custom engine.
- **Fidelity:** where Showdown and the original cartridge differ, match Showdown. The npm package data is trusted as-is, with no extra cross-checking against Bulbapedia.
- **Authority model (from the room-join PoC):** the server resolves turns with server-side randomness, stores state in Turso and publishes results over Ably. Clients only send their chosen action.

## Open questions

1. **Level:** 50 or 100?
2. **Team size:** full 6v6, or bring 6 / pick 3, or something else? Is there a team preview?
3. **Team source:** rental or preset teams, custom team building, random battles, or the draft from the design canvas? If custom, do players get full EV/IV/nature control?
4. **Species pool:** Gen 1–2 species only (to match the Crystal visuals), everything up to Gen 6 (721), or a hand-picked list? Are legendaries allowed? Note that Gen 6 retypes some Gen 1–2 Pokémon to Fairy (e.g. Clefable, Togekiss line, Azumarill, Granbull, Mr. Mime).
5. **Clauses:** which of Species, Item, Sleep, Freeze, OHKO, Evasion, Self-KO and Endless Battle?
6. **Learnset legality:** any Gen 6 game's moves (XY + ORAS, including tutors), or a narrower set?
7. **IP posture:** real Pokémon names and Gen 2-style sprites (private/hobby use), or original creatures and art on Gen 6 mechanics? Is a public or commercial launch planned?
8. **Turn timer and disconnects:** how long is each turn, and what happens on a timeout (a random move, Struggle, or forfeit) or a disconnect?
9. **Faint replacements:** do both players choose at the same time (the Gen 5+ rule too), with a timer?

10. **Game content:** X/Y only, or include ORAS content and learnsets? Can Gen 1–2 species use Gen 6-only moves?
11. **Saving battles:** store the full engine state after every turn (`toJSON`, about 20 KB for 3v3), or store the seed plus the list of choices and replay it?

See §16.3 of the [Gen 6 research](2026-10-19-gen6-battle-mechanics.md) for detail on each question.
