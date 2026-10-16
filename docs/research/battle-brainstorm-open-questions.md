# Battle Brainstorm — Starting Point

*Created 2026-10-16. Start here when brainstorming the battle spec.*

Background research: [Gen 4 HGSS battle mechanics](2026-10-16-gen4-hgss-battle-mechanics.md).

## Decided

- **Singles only.** No doubles mechanics.
- **Mechanics and data are Gen 4 HeartGold/SoulSilver; the visuals come from the older games** (Pokémon Crystal / Gen 2 look).
- **Engine:** use the ready-made Pokémon Showdown Gen 4 engine from npm (`@pkmn/sim`, with `@pkmn/dex` / `@pkmn/data` for data; all MIT). Don't write a custom engine.
- **Fidelity:** where Showdown and the original cartridge differ, match Showdown. The npm package data is trusted as-is, with no extra cross-checking against Bulbapedia.
- **Authority model (from the room-join PoC):** the server resolves turns with server-side randomness, stores state in Turso and publishes results over Ably. Clients only send their chosen action.

## Open questions

1. **Level:** 50 or 100?
2. **Team size:** full 6v6, or bring 6 / pick 3, or something else? Is there a team preview?
3. **Team source:** rental or preset teams, custom team building, or random battles? If custom, do players get full EV/IV/nature control?
4. **Species pool:** Gen 1–2 species only (to match the Crystal visuals), all 493, or a hand-picked list? Are legendaries allowed, or does the Battle Frontier ban list apply?
5. **Clauses:** which of Species, Item, Sleep, Freeze, OHKO, Evasion, Self-KO and Endless Battle?
6. **Learnset legality:** HGSS-only move availability (including HGSS tutors), or any Gen 4 game (DPPt + HGSS)?
7. **IP posture:** real Pokémon names and Gen 2-style sprites (private/hobby use), or original creatures and art on Gen 4 mechanics? Is a public or commercial launch planned?
8. **Turn timer and disconnects:** how long is each turn, and what happens on a timeout (a random move, Struggle, or forfeit) or a disconnect?
9. **Faint replacements:** do both players choose at the same time (the Gen 4 rule), with a timer?
