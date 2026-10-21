# Gen 6 (X/Y and Omega Ruby/Alpha Sapphire) Battle Mechanics: Research for Picomon Stadium

- **Date:** 2026-10-19
- **Status:** Research, updated **2026-10-21** with the user's answers to every open question. The decisions are in §1 (format and rules) and the new **§18 (battle server design)**, which is written as spec. §16.3 has no open questions left.
- **Scope:** Singles battles only (decided). Doubles and triples are out of scope. Showdown supports them, but nothing below covers them.
- **Also decided out of scope:** **Mega Evolution**, **Primal Reversion** and **terrain** (Electric, Grassy and Misty Terrain). §5 and §10.2 only record how to keep them switched off.
- **Rule for the whole project:** Gen 2 (Crystal) supplies the look. **Pokémon Showdown's `gen6` engine** supplies every mechanic. Where Showdown and the cartridge differ, Showdown wins (decided). The npm package data is trusted as-is (decided), **except for the project's own custom changes to species types, base stats, abilities and moves, listed in §17**. Those override the engine data.

---

## Summary

- **Engine.** The `gen6` mod in Pokémon Showdown is a thin layer. `data/mods/gen6/scripts.ts` is just `{inherit: 'gen7', gen: 6}`. Gen 6 behaviour comes from three places:
  - gen-gated branches in the shared simulator (`if (this.battle.gen === 6)`, `gen <= 6`);
  - the small `gen6` override files (abilities, conditions, items, moves, pokedex, typechart);
  - everything `gen7` and `gen8` override, because gen6 inherits from them.

  All of this ships in the MIT npm packages `pokemon-showdown@0.11.11` (full TypeScript source) and `@pkmn/sim` / `@pkmn/dex` / `@pkmn/data@0.10.11`. I installed all four in a scratch directory and ran test battles. Every number below was read from that code or produced by running it.
- **Damage.** Base damage is `floor(floor(floor(2L/5+2) × BP × A / D) / 50) + 2`. Then come, in order:
  - weather;
  - crit (**×1.5**, plain truncation);
  - the random roll (85–100);
  - STAB (pokeRound);
  - type effectiveness (integer doubling and halving);
  - burn (pokeRound; Facade is exempt in Gen 6);
  - a final chained 4096-based modifier (screens, Life Orb 5324/4096, Expert Belt 4915/4096, Multiscale, resist berries and so on);
  - a minimum of 1, then 16-bit truncation.

  Base power and the Attack/Defense stats each get their own 4096-chained modifier first. Two worked Lv 50 examples were checked against the engine roll for roll (§3.6).
- **The Gen 6 numbers that are easy to get wrong:**
  - crit chance by stage is 1/16, 1/8, 1/2, always;
  - paralysis quarters Speed and fully paralyzes 25% of the time; Electric types are immune;
  - burn deals **1/8** per turn;
  - sleep lasts 1–3 turns, and the counter is **not** reset on switch (BW reset it);
  - confusion self-hits **50%** of the time and lasts 1–4 turns;
  - binding lasts 4–5 turns at **1/8** per turn;
  - Protect and Detect are +4, Fake Out +3, ExtremeSpeed +2, and Gale Wings is +1 for every Flying move with no HP condition;
  - Aerilate, Pixilate and Refrigerate boost **×1.3** (5325/4096);
  - Parental Bond's second hit deals 50%;
  - ability-set weather lasts 5 turns (8 with the matching rock);
  - Prankster does not fail against Dark types;
  - Thunder Wave has 100% accuracy;
  - sound moves bypass Substitute;
  - Ghost types cannot be trapped;
  - Grass types, Overcoat and Safety Goggles block powder moves;
  - a Poison-type user's Toxic never misses.
- **Fairy and the type chart.** The 18-type chart adds Fairy, and Steel no longer resists Ghost or Dark (verified by diffing the type charts [run]). Thirteen **Gen 1–2 species** were retyped:
  - Clefairy, Clefable, Cleffa;
  - Jigglypuff, Wigglytuff, Igglybuff;
  - Mr. Mime;
  - Togepi, Togetic;
  - Marill, Azumarill;
  - Snubbull, Granbull.

  Eighteen Gen 1–2 species also had their base stats raised in Gen 6 (§4.3). Those are stock Gen 6 values; §17 patches the types and stats of many species further.
- **Mega Evolution, Primal Reversion and terrain are out of scope (decided).** The gen6 engine has **no in-battle rule that turns Mega Evolution off**. Mega Rayquaza Clause only affects Rayquaza, and a `-Mega` ban only works in the team validator; I checked both by running them. Mega Evolution is possible only when a Pokémon holds its Mega Stone. So the off switch is:
  - never give a Mega Stone, Blue Orb or Red Orb in any set;
  - add `-Mega` (plus `-Blue Orb, -Red Orb`) to any validator format;
  - have the server reject any choice ending in ` mega`.

  Terrain only comes from the moves Electric Terrain, Grassy Terrain and Misty Terrain. No legal Gen 6 ability sets terrain. Leaving those three moves out of every set keeps terrain off (§10.2).
- **Engine integration works server-side as planned.** In scratch tests (§14):
  - `new Battle({formatid, seed})` plus `battle.choose('p1', …)` resolves turns;
  - `battle.toJSON()` is about 20 KB for a 3v3 battle;
  - `Battle.fromJSON()` takes about 0.6 ms;
  - a half-submitted turn (one player has chosen, the other has not) survives the round trip;
  - replaying after deserialization is byte-identical, apart from the wall-clock `|t:|` lines.
- **Custom modifications (§17).** On top of stock gen6, the project patches species types (27 Pokémon), base stats (56), ability options (59; one is picked per Pokémon) and 15 moves, all from Polished Crystal's Regular version. Species and abilities not in Gen 6 are left out. These patched values win over the stock values elsewhere in this document.
- **Decided battle setup (§1, §18), 2026-10-21:**
  - singles at **Lv 50**; each player drafts 6 and brings **3, 4 or 6** (the host's battle size from Home), chosen on the Battle order screen, which is the engine's team preview;
  - fixed rental sets from the hand-picked pool in `data/pokemon/`, at most one uber and one strong Pokémon (base stat total 580–600) per player, and no two on a team holding the same item;
  - the project's own format `[Gen 6] Picomon` (`lib/pokemon-dex.ts`) with **Sleep Clause Mod** and **Endless Battle Clause** as the only clauses; `Picked Team Size` is set per battle (§18.1);
  - **base PP, no PP Ups** (the engine hard-codes 3 PP Ups; §18.2 shows the tested fix);
  - **75 seconds per choice**, the engine's own `default` choice on timeout, and a forfeit after three timeouts in a row (§18.4);
  - the engine's `toJSON()` snapshot saved in **one `battles` row per room**, overwritten every turn, with no choice log (§18.6);
  - real Pokémon names, data and sprites in a free, non-commercial fan project (§14.5);
  - no Mega Stones, Primal orbs or terrain moves in any set;
  - all mechanics handled by the engine. The app's job is the data whitelist, the choice API, the timer, state storage and the Crystal-style rendering of the protocol.

---

## Table of contents

1. [Format](#1-format)
2. [Stats](#2-stats)
3. [Damage calculation](#3-damage-calculation)
4. [Type chart and species changes](#4-type-chart-and-species-changes)
5. [Mega Evolution and Primal Reversion (out of scope)](#5-mega-evolution-and-primal-reversion-out-of-scope)
6. [Turn order](#6-turn-order)
7. [Accuracy, evasion and stat stages](#7-accuracy-evasion-and-stat-stages)
8. [Major status conditions](#8-major-status-conditions)
9. [Volatile statuses](#9-volatile-statuses)
10. [Weather, terrain, hazards and field effects](#10-weather-terrain-hazards-and-field-effects)
11. [End-of-turn order](#11-end-of-turn-order)
12. [Abilities and held items](#12-abilities-and-held-items)
13. [Moves](#13-moves)
14. [Data access and running the engine](#14-data-access-and-running-the-engine)
15. [Key Gen 6 mechanics](#15-key-gen-6-mechanics)
16. [Recommendations and open questions](#16-recommendations-and-open-questions)
17. [Custom modifications](#17-custom-modifications)
18. [Battle server design (decided)](#18-battle-server-design-decided)
19. [Appendix: Sources and verification notes](#appendix-sources-and-verification-notes)

### Source abbreviations

| Abbrev. | Source |
|---|---|
| **[PS]** | `pokemon-showdown@0.11.11` from npm. The package ships the TypeScript source. Paths are relative to the package root, e.g. `sim/battle-actions.ts`, `data/mods/gen6/conditions.ts`. Upstream: https://github.com/smogon/pokemon-showdown |
| **[pkmn]** | `@pkmn/sim`, `@pkmn/dex`, `@pkmn/data` 0.10.11 from npm (https://github.com/pkmn/ps). These are automatic extractions of the Showdown simulator and data. |
| **[run]** | Scripts I ran against the installed packages in the scratch directory. Their output is quoted in the text. |

"Gen 6 resolved data" means `Dex.mod('gen6')`, which applies gen6 → gen7 → gen8 → base inheritance. Where a value is a property of the resolved data rather than a line of source, I say so.

---

## 1. Format

### Decided

- **Singles.** Doubles, triples and rotation (spread-move ×0.75, ally targeting, Wide Guard and so on) are not covered.
- **Engine:** Showdown's gen6 mod, used through npm.
- **No Mega Evolution, no Primal Reversion, no terrain.** §5 and §10.2 explain how to enforce this.

Answered on 2026-10-21 (details and implementation in §18):

| Decision | Answer |
|---|---|
| Level | **50.** Written into every set by the server (`LEVEL` and `toSet` in `lib/pokemon-dex.ts`); the validator's `Adjust Level Down` is not used. |
| Team size | **Draft 6, bring 3, 4 or 6.** The host picks the battle size on Home (`rooms.battle_size`). `Picked Team Size` is set per battle, not in the shared ruleset (§18.1). |
| Team preview | **On.** The Battle order screen is the team preview: both teams are visible there, and the player's chosen order becomes the engine's `team …` choice. |
| Team source | **The draft.** Players rent from a hand-picked pool with fixed sets (moves, item, nature, EVs) from `data/pokemon/`. Sets can't be edited, so no team validator runs. |
| Species pool | **Hand-picked** (`data/pokemon/`). Legendaries allowed, at most one uber and one strong Pokémon per player, and no two on a team holding the same item (enforced by the draft). The Fairy retypes and §17's patches stand. |
| Learnsets / XY vs ORAS | **Not checked.** The data files are the only control over which moves a Pokémon gets. |
| Clauses | **Sleep Clause Mod** and **Endless Battle Clause** in the engine. **No Item Clause.** **No OHKO, Evasion or Self-KO clauses:** those moves are allowed whenever a set has them. Species Clause is guaranteed by the draft (each Pokémon can be rented once). |
| Base PP | **No PP Ups** (decided 2026-10-20). See §18.2. |
| Turn timer | **75 seconds for every choice**, the engine's `default` choice on timeout, forfeit after 3 timeouts in a row (§18.4). |
| Faint replacements | As the engine does them (§18.5), on the same timer. |
| Saving battles | **One `battles` row per room** holding the latest `toJSON()` snapshot; **no choice log** for now (§18.6). |
| IP posture | Real names, data and sprites; free and non-commercial, credited as an unofficial fan project (§14.5). |

### How Showdown's gen6 formats are configured

Format definitions live in [PS] `config/formats.ts`. Rule bundles live in `data/rulesets.ts`, with `data/mods/gen7/rulesets.ts` and `gen8/rulesets.ts` overrides inherited by gen6. Every format below uses `mod: 'gen6'`, except VGC 2014, which uses `gen6xy`.

| Format id | Ruleset (as written) | Effective meaning | Level | Preview / team size |
|---|---|---|---|---|
| `gen6customgame` | `Team Preview, Cancel Mod, Max Team Size = 24, Max Move Count = 24, Max Level = 9999, Default Level = 100`. Also sets `battle: { trunc: Math.trunc }` and `debug: true`. | No clauses, no validator bans. Sets are taken as given. Debug lines (`|debug|…`) appear in the log. | Whatever the set says; default 100 | Team preview on; brings the whole team |
| `gen6ou` | `Standard, Evasion Abilities Clause` + bans `Uber, Arena Trap, Shadow Tag, King's Rock, Quick Claw, Razor Fang, Soul Dew, Baton Pass, Swagger` | `Standard` (gen7 override) = `Standard AG` (`Obtainable, Team Preview, HP Percentage Mod, Cancel Mod, Endless Battle Clause`) + `Sleep Clause Mod, Species Clause, Nickname Clause, OHKO Clause, Evasion Items Clause, Evasion Moves Clause` + ban `Moody` | 100 (the validator rejects Lv 50: "this format allows level 100 Pokémon") [run] | Preview; 6v6 |
| `gen6battlespotsingles` | `Flat Rules, Min Source Gen = 6` + ban `Soul Dew` | `Flat Rules` = `Obtainable, Team Preview, Species Clause, Nickname Clause, Item Clause = 1, Adjust Level Down = 50, Picked Team Size = Auto, Cancel Mod` + bans `Mythical, Restricted Legendary, Greninja-Bond` | **Adjusted down to 50** | Preview; **bring 6, pick 3** (`Picked Team Size = Auto` resolves to 3 for singles, `sim/dex-formats.ts`) |
| `gen61v1` | `Max Team Size = 3, Picked Team Size = 1, Obtainable, Nickname Clause, OHKO Clause, Evasion Moves Clause, Accuracy Moves Clause, Endless Battle Clause, HP Percentage Mod, Cancel Mod, Team Preview` + a long ban list including Charizard-Mega-X/Y, Kangaskhan-Mega, Snorlax, Focus Sash and sleep moves | Bring 3, pick 1 | 100 | Preview |
| `gen6ubers`, `gen6uu` … `gen6zu`, `gen6lc`, `gen6monotype`, `gen6anythinggoes`, `gen6cap`, `gen6purehackmons` | Tier variants of `Standard` (Ubers adds `Mega Rayquaza Clause`) | — | 100 (LC: 5) | Preview |
| `gen6randombattle`, `gen6battlefactory` | Generated teams | — | Generated | Random Battle has no preview |

**Rule types matter.** Only rules with `effectType: 'Rule'` act inside a battle. Rules with `effectType: 'ValidatorRule'` only run in `TeamValidator`. Checked via `Dex.formats.get(name).effectType` [run]:

| In-battle rules (`Rule`) | Validator-only rules (`ValidatorRule`) |
|---|---|
| Team Preview, Picked Team Size, Sleep Clause Mod, Freeze Clause Mod, Endless Battle Clause, HP Percentage Mod, Cancel Mod, Mega Rayquaza Clause, Stadium Sleep Clause | Species Clause, Item Clause, Nickname Clause, OHKO Clause, Evasion Moves/Items/Abilities Clause, Accuracy Moves Clause, Obtainable, Adjust Level Down, Max Team Size, Min Source Gen |

Consequences for this project:

- **Level adjustment is validator-only.** `Adjust Level Down = 50` is applied in `sim/team-validator.ts` (`ruleTable.adjustLevelDown`). The battle itself just reads `set.adjustLevel || set.level` (`sim/pokemon.ts`). If teams skip the validator, which is reasonable for server-side rentals, the server must write `level: 50` into each set itself.
- **Species, Item and OHKO clauses are also validator-only.** For rentals they become data-curation rules. For a custom team builder, run `new TeamValidator(format).validateTeam(team)` on the server.
- **Custom rule strings work.** A format id can carry extra rules after `@@@`. `gen6customgame@@@Sleep Clause Mod,Species Clause,Picked Team Size = 3,Endless Battle Clause,HP Percentage Mod` produced a battle whose `ruleTable` contained exactly those rules plus the Custom Game defaults, with `pickedTeamSize = 3`. Team preview then trimmed each side to 3 [run].
- **Sleep Clause Mod** also bans `Hypnosis + Gengarite` (validator part) (`data/rulesets.ts`).
- **Turn limit.** At turn 1000 the battle is forced to a tie. Endless Battle Clause has its own extra checks after turn 100 (`sim/battle.ts`, `maybeTriggerEndlessBattleClause`).

### Options that were considered

The table below is kept for reference. Every row has been decided; see the table under **Decided** above.


| Decision | Options | Notes |
|---|---|---|
| Level | **Lv 50** / Lv 100 | Lv 50 is the Battle Spot / VGC convention (`Flat Rules`). Lv 100 is the Smogon convention. Lv 50 numbers are smaller and suit the Gen 2 look. |
| Team size | 6v6 / **bring 6, pick 3** (Battle Spot, Stadium-like) / bring 3, pick 1 (`gen61v1`) | Pick 3 uses `Picked Team Size = 3` plus Team Preview. |
| Team preview | On / off | On is standard in every Gen 6 format except Random Battle. Showdown's gen7 `teampreview` override hides some formes as `-*` and shows an item flag. |
| Team source | Rentals / custom builder / random | Rentals avoid validator work in the MVP. |
| Base format | `gen6customgame` + chosen rules (recommended) / `gen6battlespotsingles` (closest official ruleset) / `gen6ou` | Custom Game uses `Math.trunc` instead of Showdown's default 32-bit `>>> 0` truncation (`sim/dex.ts`, `trunc`). The two only differ on overflowing or negative intermediate values, which normal play does not produce. I did not test the edge cases. |
| Clauses | Species, Item, Sleep (Mod), Freeze (Mod), OHKO, Evasion Moves/Items, Endless Battle | See the rule-type table above for which ones the battle engine enforces. Mega-related bans are covered in §5. |
| ORAS-only content | Allow / XY-only | §13. The `gen6xy` mod exists and marks ORAS additions as unavailable. |

---

## 2. Stats

### Formulas (unchanged since Gen 3; confirmed)

From [PS] `sim/battle.ts` `statModify`. `tr` is truncation.

```
HP    = tr( tr(2*Base + IV + tr(EV/4) + 100) * Level / 100 + 10 )
Other = tr( tr(2*Base + IV + tr(EV/4)) * Level / 100 + 5 )
Nature (boosted)  = tr( tr(stat * 110, 16 bits) / 100 )
Nature (hindered) = tr( tr(stat *  90, 16 bits) / 100 )
```

These are algebraically the same as the formulas used since Gen 3. Shedinja's 1 HP is a special case in the simulator.

| Input | Range in Gen 6 |
|---|---|
| Base stats | Gen 6 values (§4.3). The gen6 `pokedex.ts` reverts the Gen 7 stat changes. |
| IVs | 0–31 |
| EVs | Total limit 510 (`EV Limit = Auto` resolves to 510 for gen > 2, `sim/dex-formats.ts`). Every 4 EVs add 1 point at Lv 100. 252 is the useful maximum per stat. |
| Nature | 25 natures, ±10%, never HP |
| Level | 1–100 (Custom Game allows up to 9999) |

- **Hidden Power** is fixed at **60 BP** in Gen 6. Its type still comes from IVs. Resolved gen6 data has `basePower: 60` and `onModifyType: move.type = pokemon.hpType || 'Dark'`. Gen 5 had variable power.
- Worked check at Lv 50, 31 IV [run]:
  - Scizor (Atk 130, Adamant, 252 EV) has Atk = `tr((260+31+63)·50/100)+5` = 182 → ×1.1 → **200**.
  - Clefable (HP 95, 252 EV) has HP = `tr((190+31+63+100)·50/100)+10` = **202**.

  The engine reported the same values (`storedStats`).
- **Rental MVP:** fix IVs at 31 and use preset EVs and natures.

---

## 3. Damage calculation

### 3.1 Rounding helpers ([PS] `sim/battle.ts`)

```ts
trunc(n, bits=0)  // n >>> 0, optionally mod 2^bits (sim/dex.ts)
modify(value, m)  // "pokeRound": M = trunc(m*4096); return trunc((trunc(value*M) + 2048 - 1) / 4096)
                  // i.e. multiply by M/4096 and round half DOWN
chainModify(m)    // event.modifier = ((trunc(prev*4096) * trunc(m*4096) + 2048) >> 12) / 4096
                  // chains several modifiers in 4096ths, rounding half UP at each step,
                  // then the event applies modify(value, chainedModifier) once at the end
randomizer(d)     // trunc(trunc(d * (100 - random(16))) / 100)   -> 85..100 %
```

Common 4096 constants in Gen 6:

| Value | Meaning | Used by |
|---|---|---|
| 5325 | ×1.3 | Aerilate/Pixilate/Refrigerate (gen6 override), Tough Claws, Sheer Force, Sand Force, Normal Gem (`gem` condition) |
| 5324 | ×1.3 | Life Orb |
| 5448 | ×1.33 | Fairy Aura / Dark Aura (3072 = ×0.75 with Aura Break) |
| 4915 | ×1.2 | Expert Belt, type-boost items and Plates, Iron Fist, Reckless |
| 4505 | ×1.1 | Muscle Band, Wise Glasses, Wide Lens (accuracy) |
| 3686 | ×0.9 | BrightPowder (accuracy) |
| 2732 | ×2/3 | Screens in doubles only |
| 6144 | ×1.5 | Choice items, STAB, Technician, crit-adjacent boosts |

### 3.2 The Gen 6 pipeline, in exact order

From [PS] `sim/battle-actions.ts`: `getDamage()` (lines ~1585–1722) then `modifyDamage()` (~1724–1838). Gen-specific branches are noted.

```
getDamage(source, target, move):
 1. Type immunity (runImmunity)        -> no damage ("doesn't affect")
 2. OHKO                               -> target.maxhp (Gen 3 only: target.hp)
    damageCallback / fixed damage      -> returned directly (Seismic Toss, Super Fang, ...)
 3. basePower = move.basePower or basePowerCallback(); clamp >= 1
 4. Crit roll:
      critRatio = runEvent('ModifyCritRatio', move.critRatio || 0) ; move.critRatio defaults to 1
      Gen 6: clamp 0..4, critMult = [0, 16, 8, 2, 1]  -> crit if randomChance(1, critMult[critRatio])
      then runEvent('CriticalHit')  (Battle Armor / Shell Armor / Lucky Chant return false)
 5. basePower = runEvent('BasePower', ...)  -> chain of 4096 modifiers, then modify(BP, chain); clamp >= 1
 6. Stats: atkBoosts / defBoosts from the stat stages.
      If crit: ignore a NEGATIVE attacker stage and a POSITIVE defender stage.
      attack  = calculateStat(atk|spa, boosts)   then runEvent('ModifyAtk'|'ModifySpA')  (chained)
      defense = calculateStat(def|spd, boosts)   then runEvent('ModifyDef'|'ModifySpD')  (chained)
      (no Explosion/Self-Destruct Def halving in Gen 6)
 7. base = trunc( trunc( trunc( trunc(2*L/5 + 2) * BP * A ) / D ) / 50 )

modifyDamage(base):
 8. base += 2
 9. Spread x0.75 (doubles only)  |  Parental Bond 2nd hit: modify(x, 0.5)  (gen > 6 uses 0.25)
10. Weather: priorityEvent('WeatherModifyDamage')   rain/sun x1.5 or x0.5
11. Crit: base = trunc(base * 1.5)          (Gen 6+: 1.5; Gen <= 5: 2) -- plain truncation, not pokeRound
12. Random: base = randomizer(base)          (85..100 %)
13. STAB: modify(base, 1.5); ModifySTAB event (Adaptability returns 2)
14. Type effectiveness: typeMod in -6..6; for each +1: base *= 2; for each -1: base = trunc(base / 2)
15. Burn: if physical, attacker burned, no Guts: modify(base, 0.5)
          (gen < 6 || move !== Facade) -> in Gen 6 Facade ignores the burn halving
16. (Gen 5 only: if 0 then 1)
17. Final modifier: runEvent('ModifyDamage')  -> chained 4096 modifiers, applied once with modify()
18. Gen 6: if base == 0 then 1
19. return trunc(base, 16)                   (16-bit truncation)
```

The **final modifier (step 17)** collects every `onModifyDamage`, `onSourceModifyDamage` and `onAnyModifyDamage` handler that applies. In Gen 6 these include:

- Reflect and Light Screen: ×0.5 in singles. They are skipped on a crit or when the attacker has Infiltrator (`data/moves.ts` `reflect.condition.onAnyModifyDamage`).
- Multiscale ×0.5 at full HP.
- Filter and Solid Rock ×0.75 on super-effective hits.
- Tinted Lens ×2 on resisted hits.
- Sniper ×1.5 on crits.
- Life Orb ×5324/4096.
- Expert Belt ×4915/4096 on super-effective hits.
- Resist berries such as Roseli ×0.5 (`onSourceModifyDamage`).
- The Metronome item's growing boost.

Each handler calls `chainModify`, so the order they run in can change the last bit of the chained modifier. Showdown orders them by its usual event priority and speed rules.

**Important stat modifiers (steps 5 and 6)**, from the resolved gen6 data:

- Base power: Technician ×1.5 if BP ≤ 60 after earlier modifiers, Tough Claws ×1.3 on contact moves, Strong Jaw and Mega Launcher ×1.5, Iron Fist and Reckless ×1.2, Sheer Force ×1.3, Sand Force ×1.3, Knock Off ×1.5 if the target has a removable item, Facade ×2 when statused, terrain ×1.5, Muscle Band, Plates and type items, and the Normal Gem ×1.3.
- Attack: Huge Power and Pure Power ×2, Choice Band and Specs ×1.5, Guts ×1.5, Thick Fat ×0.5 (applied to the *attacker's* stat), Solar Power ×1.5, and Blaze, Torrent and Overgrow at 1/3 HP.
- Defense: Assault Vest SpD ×1.5, Eviolite ×1.5 Def and SpD, Fur Coat Def ×2, Marvel Scale ×1.5, and Rock-type SpD ×1.5 in sand.

### 3.3 Critical hits

| `critRatio` after ModifyCritRatio | Stage | Gen 6 chance |
|---|---|---|
| 1 (default for every move) | +0 | 1/16 |
| 2 | +1 | 1/8 |
| 3 | +2 | 1/2 |
| 4 (clamped max) | +3 or more | always |

Source: [PS] `sim/battle-actions.ts` (`if (this.battle.gen === 6) critMult = [0, 16, 8, 2, 1]`). Gen 7+ uses 1/24 at +0.

- **Stage sources:**
  - +1: high-crit moves (`critRatio: 2`). In the gen6 data these are Karate Chop, Razor Wind, Aeroblast, Air Cutter, Attack Order, Blaze Kick, Crabhammer, Cross Chop, Cross Poison, Drill Run, Leaf Blade, Night Slash, Poison Tail, Psycho Cut, Razor Leaf, Shadow Claw, Sky Attack, Slash, Spacial Rend and Stone Edge.
  - +1: Scope Lens, Razor Claw and Super Luck.
  - +2: Focus Energy (`critRatio + 2`).
  - Always crit: Storm Throw and Frost Breath (`willCrit`).
- **Crit damage:** `trunc(base × 1.5)` at step 11. Sniper adds ×1.5 in the final modifier, for ×2.25 overall.
- **What crits ignore:** the attacker's negative Atk/SpA stage, the defender's positive Def/SpD stage, and Reflect/Light Screen. The attacker's positive stages and the defender's negative stages still count.
- **What blocks crits:** Battle Armor, Shell Armor (`onCriticalHit: false`) and Lucky Chant.

### 3.4 STAB, Adaptability, effectiveness, the random roll, burn and weather

| Factor | Gen 6 value | Notes |
|---|---|---|
| STAB | ×1.5 (pokeRound) | The `???` type never gets STAB. Protean changes the user's type before the hit (`onPrepareHit`), so every move gets STAB. |
| Adaptability | STAB becomes ×2 | `onModifySTAB` |
| Type effectiveness | ×2 or ×0.5 per type, applied one step at a time | Immunity is handled before any of this (step 1). Delta Stream removes Flying's weaknesses. |
| Random roll | 16 values, 85–100% | `randomizer` |
| Burn | ×0.5 to physical damage | Guts ignores it. **Facade ignores it in Gen 6+.** Residual damage is 1/8 (§8). |
| Rain | Water ×1.5, Fire ×0.5 | `WeatherModifyDamage`. Primordial Sea makes Fire moves fail outright (`onTryMove`). |
| Sun | Fire ×1.5, Water ×0.5 | Desolate Land makes Water moves fail outright. |
| Sand | Rock-type SpD ×1.5 (stat modifier, not a damage modifier) | |
| Screens | ×0.5 final modifier in singles | |

### 3.5 Key items and abilities in the damage formula

| Effect | Where | Value |
|---|---|---|
| Life Orb | final | ×5324/4096; recoil 1/10 max HP (gen6 `items.ts` override) |
| Expert Belt | final, super-effective only | ×4915/4096 |
| Choice Band / Specs | Atk / SpA | ×1.5 |
| Type items / Plates / Muscle Band / Wise Glasses | base power | ×4915 / ×4505 |
| Normal Gem (the only gem obtainable in gen6) | base power | ×5325/4096 (1.3; Gen 5 was 1.5) |
| Huge Power / Pure Power | Atk | ×2 |
| Technician | base power | ×1.5 if BP ≤ 60 |
| Aerilate / Pixilate / Refrigerate | type change + base power | Normal → Flying/Fairy/Ice, ×5325/4096 (gen6 override; Gen 7 is 4915) |
| Tough Claws | base power, contact | ×5325/4096 |
| Parental Bond | second hit | ×0.5 of base (Gen 7: 0.25) |
| Multiscale | final | ×0.5 at full HP |
| Filter / Solid Rock | final | ×0.75 on super-effective hits |
| Thick Fat | attacker's Atk/SpA vs Fire/Ice | ×0.5 |
| Assault Vest | SpD | ×1.5; disables Status moves |
| Roseli and other resist berries | final | ×0.5 on a super-effective hit of that type, consumed |

### 3.6 Worked examples at Lv 50 (checked against the engine)

**Example 1: Technician Scizor Bullet Punch vs Clefable.**

- Attacker: Scizor, Adamant, 252 Atk, 31 IVs, Lv 50 → Atk **200**.
- Defender: Clefable, Calm, 252 HP / 4 Def → HP **202**, Def **94**. Fairy type, so Steel is ×2.

```
BP:        40, Technician (40 <= 60) -> modify(40, 1.5) = trunc((40*6144 + 2047)/4096) = 60
base:      trunc(2*50/5 + 2) = 22
           trunc(22 * 60 * 200) = 264000 ; /94 -> 2808 ; /50 -> 56
+2:        58
weather:   none
crit:      no
random:    trunc(58 * r / 100), r = 85..100
           -> 49,49,50,51,51,52,52,53,53,54,55,55,56,56,57,58
STAB 1.5:  modify(x, 1.5): 49->73 (73.5 rounds DOWN), 50->75, 51->76, 52->78, 53->79,
           54->81, 55->82, 56->84, 57->85, 58->87
type x2:   146,146,150,152,152,156,156,158,158,162,164,164,168,168,170,174
final:     no modifiers; nonzero; 16-bit ok
=> 146-174 damage = 72.3%-86.1% of 202 HP
```

The engine produced exactly the distinct values `146,150,152,156,158,162,164,168,170,174`, from 4,000 `getDamage` calls with `willCrit = false` [run].

With a crit, the base is `trunc(58 × 1.5) = 87`, giving 218–260. The engine produced `218 … 260` [run].

**Example 2: Huge Power Azumarill with a Choice Band uses Play Rough on Multiscale Dragonite at full HP.** This example shows a chained stat modifier and a final modifier.

- Azumarill: Adamant, 252 Atk → Atk 112. Chain: Huge Power ×2 then Choice Band ×1.5 = ×3.0, so the effective Atk is `modify(112, 3) = 336`.
- Dragonite: Impish, 252 HP / 252 Def → Def 161, HP 198. Fairy vs Dragon/Flying is ×2.

```
base:   trunc(trunc(22 * 90 * 336) / 161) = 4132 ; /50 -> 82 ; +2 -> 84
random: 71..84 ; STAB (Azumarill is Water/Fairy in Gen 6): 71 -> 106 ...
type:   x2
final:  Multiscale x0.5 via modify()
=> 106,108,109,109,111,112,114,115,117,117,118,120,121,123,124,126  (53.5%-63.6%)
```

The engine's distinct values were `106,108,109,111,112,114,115,117,118,120,121,123,124,126`. My hand calculation in the scratch script matched all 16 [run].

---

## 4. Type chart and species changes

### 4.1 The full Gen 6 chart

Generated from `Dex.mod('gen6').types` [run]. Rows are the attacking type and columns the defending type. `2` means super effective, `½` resisted, `0` no effect and `·` neutral.

| Atk \ Def | Nor | Fir | Wat | Ele | Gra | Ice | Fig | Poi | Gro | Fly | Psy | Bug | Roc | Gho | Dra | Dar | Ste | Fai |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Normal** | · | · | · | · | · | · | · | · | · | · | · | · | ½ | 0 | · | · | ½ | · |
| **Fire** | · | ½ | ½ | · | 2 | 2 | · | · | · | · | · | 2 | ½ | · | ½ | · | 2 | · |
| **Water** | · | 2 | ½ | · | ½ | · | · | · | 2 | · | · | · | 2 | · | ½ | · | · | · |
| **Electric** | · | · | 2 | ½ | ½ | · | · | · | 0 | 2 | · | · | · | · | ½ | · | · | · |
| **Grass** | · | ½ | 2 | · | ½ | · | · | ½ | 2 | ½ | · | ½ | 2 | · | ½ | · | ½ | · |
| **Ice** | · | ½ | ½ | · | 2 | ½ | · | · | 2 | 2 | · | · | · | · | 2 | · | ½ | · |
| **Fighting** | 2 | · | · | · | · | 2 | · | ½ | · | ½ | ½ | ½ | 2 | 0 | · | 2 | 2 | ½ |
| **Poison** | · | · | · | · | 2 | · | · | ½ | ½ | · | · | · | ½ | ½ | · | · | 0 | 2 |
| **Ground** | · | 2 | · | 2 | ½ | · | · | 2 | · | 0 | · | ½ | 2 | · | · | · | 2 | · |
| **Flying** | · | · | · | ½ | 2 | · | 2 | · | · | · | · | 2 | ½ | · | · | · | ½ | · |
| **Psychic** | · | · | · | · | · | · | 2 | 2 | · | · | ½ | · | · | · | · | 0 | ½ | · |
| **Bug** | · | ½ | · | · | 2 | · | ½ | ½ | · | ½ | 2 | · | · | ½ | · | 2 | ½ | ½ |
| **Rock** | · | 2 | · | · | · | 2 | ½ | · | ½ | 2 | · | 2 | · | · | · | · | ½ | · |
| **Ghost** | 0 | · | · | · | · | · | · | · | · | · | 2 | · | · | 2 | · | ½ | · | · |
| **Dragon** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 2 | · | ½ | 0 |
| **Dark** | · | · | · | · | · | · | ½ | · | · | · | 2 | · | · | 2 | · | ½ | · | ½ |
| **Steel** | · | ½ | ½ | ½ | · | 2 | · | · | · | · | · | · | 2 | · | · | · | ½ | 2 |
| **Fairy** | · | ½ | · | · | · | · | 2 | ½ | · | · | · | · | · | · | 2 | 2 | ½ | · |

**Non-damage type immunities** in the gen6 data. These are lowercase keys in `damageTaken` [run]:

| Type | Gen 6 immunities | New in Gen 6? |
|---|---|---|
| Electric | paralysis | **new (Gen 6)** |
| Ghost | trapping (`trapped`: Mean Look, Shadow Tag, Arena Trap, binding's trap) | **new (Gen 6)** |
| Grass | `powder` (Spore, Sleep Powder, Stun Spore, Poison Powder, Cotton Spore, Rage Powder, Powder) | **new (Gen 6)** |
| Fire | burn | — |
| Ice | freeze, hail damage | — |
| Poison, Steel | poison and toxic | — |
| Ground, Rock, Steel | sandstorm damage | — |

Prankster: the gen6 `typechart.ts` override for Dark has no `prankster` immunity key. In Gen 6, Prankster-boosted moves **work on Dark types**; Gen 7 added the block.

### 4.2 Type chart changes in Gen 6

Diffing every attacker/defender pair of the 17 older types against the previous chart [run] found exactly two changes:

1. **Ghost → Steel:** ½ → neutral.
2. **Dark → Steel:** ½ → neutral.

On top of that, **Fairy** is added:

- Fairy attacking: ×2 vs Fighting, Dragon and Dark; ×½ vs Fire, Poison and Steel.
- Fairy defending: weak to Poison and Steel; resists Fighting, Bug and Dark; immune to Dragon.

### 4.3 Gen 1–2 species changed in Gen 6

> **Stock values.** This section lists stock Gen 6 typings, base stats and abilities. §17 patches some of these (types, base stats, abilities and moves). Use §17's value wherever it lists one.

**Typing.** This is the complete list of every species whose typing differs between `Dex.mod('gen5')` and `Dex.mod('gen6')` [run]. Gen 1–2 species are in bold.

| # | Species | Gen 5 | Gen 6 |
|---|---|---|---|
| 35 | **Clefairy** | Normal | Fairy |
| 36 | **Clefable** | Normal | Fairy |
| 39 | **Jigglypuff** | Normal | Normal/Fairy |
| 40 | **Wigglytuff** | Normal | Normal/Fairy |
| 122 | **Mr. Mime** | Psychic | Psychic/Fairy |
| 173 | **Cleffa** | Normal | Fairy |
| 174 | **Igglybuff** | Normal | Normal/Fairy |
| 175 | **Togepi** | Normal | Fairy |
| 176 | **Togetic** | Normal/Flying | Fairy/Flying |
| 183 | **Marill** | Water | Water/Fairy |
| 184 | **Azumarill** | Water | Water/Fairy |
| 209 | **Snubbull** | Normal | Fairy |
| 210 | **Granbull** | Normal | Fairy |
| 280–282 | Ralts, Kirlia, Gardevoir | Psychic | Psychic/Fairy |
| 298 | Azurill | Normal | Normal/Fairy |
| 303 | Mawile | Steel | Steel/Fairy |
| 439 | Mime Jr. | Psychic | Psychic/Fairy |
| 468 | Togekiss | Normal/Flying | Fairy/Flying |
| 546–547 | Cottonee, Whimsicott | Grass | Grass/Fairy |

So 13 Gen 1–2 species changed type.

**Base stats.** This is every Gen 1–2 species (#1–251) whose base stats were raised in Gen 6 [run]. The `data/mods/gen6/pokedex.ts` override reverts the later Gen 7 changes (Arbok, Dugtrio, Farfetch'd, Dodrio, Electrode, Exeggutor, Noctowl, Ariados, Qwilfish, Magcargo, Corsola and others), so those species keep their Gen 6 stats.

| Species | Change (Gen 5 → Gen 6) |
|---|---|
| Pikachu | Def 30→40, SpD 40→50 |
| Butterfree | SpA 80→90 |
| Beedrill | Atk 80→90 |
| Pidgeot | Spe 91→101 |
| Raichu | Spe 100→110 |
| Nidoqueen | Atk 82→92 |
| Nidoking | Atk 92→102 |
| Clefable | SpA 85→95 |
| Wigglytuff | SpA 75→85 |
| Vileplume | SpA 100→110 |
| Poliwrath | Atk 85→95 |
| Alakazam | SpD 85→95 |
| Victreebel | SpD 60→70 |
| Golem | Atk 110→120 |
| Ampharos | Def 75→85 |
| Bellossom | Def 85→95 |
| Azumarill | SpA 50→60 |
| Jumpluff | SpD 85→95 |

**Abilities.**

- Gen 6 has Hidden Abilities (the `H` slot in a species' `abilities`).
- Non-hidden changes: Jigglypuff, Wigglytuff and Igglybuff gained **Competitive** in slot 1.
- Gengar keeps **Levitate** in Gen 6. The gen6 override sets `abilities: {0: 'Levitate'}`; Gen 7 changed it to Cursed Body.

---

## 5. Mega Evolution and Primal Reversion (out of scope)

**Decided: the game has no Mega Evolution and no Primal Reversion.** This section only records how to keep them off in the gen6 engine.

**How the engine decides.**

- Mega Evolution is possible only when a Pokémon holds its matching Mega Stone. `canMegaEvo` reads `item.megaStone[baseSpecies]` ([PS] `sim/battle-actions.ts`).
- The one exception is Mega Rayquaza, which needs Dragon Ascent instead of a stone. Rayquaza is not in a Gen 1–2 pool.
- Primal Reversion happens automatically on switch-in when Kyogre holds the Blue Orb or Groudon holds the Red Orb (the orb's `onSwitchIn`).

**Rules and formats that turn Megas off.** I ran each of these [run].

| Mechanism | Where it acts | Effect |
|---|---|---|
| `-Mega` (ban the `Mega` tag; `data/tags.ts` `speciesFilter: species => !!species.isMega`) | **Validator only** | `TeamValidator('gen6ou@@@-Mega')` rejects a Gengarite set with "Mega evolutions are banned." In a *battle* created as `gen6customgame@@@-Mega`, a Gengar holding Gengarite still had `canMegaEvo = 'Gengar-Mega'`, and `move 1 mega` was accepted. |
| Ban the stones by name (`-Gengarite`, …) or the formes (`-Gengar-Mega`) | Validator only | Rejected by the validator ("item Gengarite is banned", "Gengar-Mega is banned"). |
| **Mega Rayquaza Clause** | In battle (`effectType: 'Rule'`) | Only sets `canMegaEvo = null` for Rayquaza. It does **not** disable other Megas. |
| Format choice | — | No standard gen6 singles format bans all Megas. `gen61v1` bans only Charizard-Mega-X/Y and Kangaskhan-Mega. Ubers adds Mega Rayquaza Clause. |

**Recommended enforcement for Picomon Stadium:**

1. **Data:** no set may hold a Mega Stone (`item.megaStone`), the Blue Orb or the Red Orb. Check this when the rental data is built.
2. **Validator** (if a team builder is ever added): include `-Mega`, `-Blue Orb` and `-Red Orb` in the format's rules.
3. **Choice API:** accept only `move N` and `switch N` (and `team …`). Reject any choice with a `mega`, `megax` or `megay` suffix before calling `battle.choose`.

With no stones held, the request JSON never contains `canMegaEvo`, and the `megaEvo` queue action (order 104, §6.1) never occurs.

## 6. Turn order

### 6.1 Action order

Every queued action has an `order`, a `priority` and a `speed`. They are sorted by order ascending, then priority descending, then speed descending, then sub-order and effect order. Remaining ties are **shuffled with the battle PRNG** (`speedSort`). Sources: [PS] `sim/battle-queue.ts` and `sim/battle.ts` `comparePriority` / `speedSort`.

| Order | Action |
|---|---|
| 1–3 | team (preview pick), start, instaswitch |
| 4–5 | beforeTurn, beforeTurnMove (Pursuit and Focus Punch set-up) |
| 103 | **switch** (in speed order) |
| 104 | Mega Evolution (never occurs here: no Mega Stones, §5) |
| 200 | **moves** (by priority, then speed) |
| 300 | residual (end of turn) |

**Speed used for ordering:** `getStat('spe')`, which includes stages and every Speed modifier. Paralysis is applied last, via `finalModify`. Then:

- Under Trick Room, the value is `10000 − speed`.
- It is truncated to 13 bits.
- It is fixed when the action is queued at the start of the turn. Mid-turn Speed changes (Dragon Dance, paralysis, Sticky Web on a switch-in) only matter from the next turn. Showdown's dynamic re-sort is `gen >= 8` only.

**Quick Claw and friends** set a fractional priority inside the bracket:

- Quick Claw: 20% chance of +0.1, only if the move's priority ≤ 0.
- Lagging Tail, Full Incense and the Stall ability: −0.1.

### 6.2 Priority brackets in Gen 6

Every non-zero priority in the gen6 resolved move data (non-standard moves excluded) [run]:

| Priority | Moves |
|---|---|
| +5 | Helping Hand (doubles) |
| **+4** | **Protect, Detect, Endure**, King's Shield, Spiky Shield, Magic Coat, Snatch |
| **+3** | **Fake Out**, Quick Guard, Wide Guard, Crafty Shield |
| **+2** | **Extreme Speed**, Feint, Follow Me, Rage Powder |
| +1 | Quick Attack, Mach Punch, Bullet Punch, Aqua Jet, Ice Shard, Shadow Sneak, Vacuum Wave, **Sucker Punch**, Water Shuriken, Baby-Doll Eyes, Powder, Ion Deluge, Bide, Ally Switch |
| −1 | Vital Throw |
| −3 | Focus Punch |
| −4 | Revenge, Avalanche |
| −5 | Counter, Mirror Coat |
| −6 | Roar, Whirlwind, Dragon Tail, Circle Throw |
| −7 | Trick Room |

Ability modifiers (`onModifyPriority`):

- **Gale Wings:** +1 to any Flying-type move. The gen6 override has no HP condition; Gen 7 requires full HP.
- **Prankster:** +1 to Status moves. It works on Dark targets in Gen 6.

### 6.3 Switching and Pursuit

- **Switches go first** (order 103) in speed order, before every move, whatever the move's priority. Entry hazards and switch-in abilities resolve as each Pokémon enters.
- **Pursuit** (40 BP, Dark, still standard in Gen 6):
  - `beforeTurnCallback` adds a `pursuit` volatile to the user.
  - When the foe is about to switch out (`onFoeBeforeSwitchOut`), Pursuit runs immediately, with doubled base power (`basePowerCallback`) and perfect accuracy (`onModifyMove`).
  - **If the target faints from it, the switch is cancelled.** This is the Gen 6 rule (the `pursuitfaint` branch in the engine).
- **U-turn and Volt Switch** switch the user out after hitting, through a mid-turn `switch` request to that player only.
- **Faint replacements** happen at the end of the turn. If several sides have fainted actives, all of them get a `forceSwitch` request at the same time. (`sim/battle.ts` `runAction`).

---

## 7. Accuracy, evasion and stat stages

### 7.1 Hit checks

The move hit steps in Gen 6 are reordered from the Gen 7+ default (`gen <= 6` swaps steps 1 and 2, `sim/battle-actions.ts`):

1. Semi-invulnerability (Fly, Dig, Phantom Force and so on).
2. **Type immunity.**
3. **TryHit**: Protect, Magic Bounce, Volt Absorb, powder immunity, Soundproof and others.
4. Move-specific immunity.
5. **Accuracy.**
6. Breaking protection (Feint and others).
7. Stealing boosts (not used in Gen 6).
8. The hit loop.

### 7.2 Accuracy formula ([PS] `hitStepAccuracy`)

```
if OHKO move:  acc = 30 + (attacker.level - target.level); fails if target.level > attacker.level
               (Gen 6 Sheer Cold has no Ice-type exemption or 20% rule; those are gen >= 7)
else:
  acc = runEvent('ModifyAccuracy', move.accuracy)   // BrightPowder x0.9, Wide Lens x1.1, Compound Eyes x1.3, Hustle x0.8 ...
  stage = clamp(attacker.accuracy - target.evasion, -6, 6)   // Unaware / Keen Eye / Foresight adjust via ModifyBoost
  if stage > 0: acc = trunc(acc * (3 + stage) / 3)
  if stage < 0: acc = trunc(acc * 3 / (3 - stage))
if alwaysHit, or a Status move targeting self: acc = true
acc = runEvent('Accuracy', acc)   // No Guard -> true; Toxic used by a Poison type -> true (Gen 6+)
hit if randomChance(acc, 100)
```

Accuracy and evasion are combined into a single clamped stage, so +1 accuracy against +1 evasion cancels out.

| Combined stage | −6 | −5 | −4 | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +4 | +5 | +6 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Multiplier | 3/9 | 3/8 | 3/7 | 3/6 | 3/5 | 3/4 | 1 | 4/3 | 5/3 | 6/3 | 7/3 | 8/3 | 9/3 |

**Weather accuracy:**

- Thunder and Hurricane always hit in rain and have 50% accuracy in sun.
- Blizzard always hits in hail.

These are move data handlers inherited unchanged. I read the base `data/moves.ts` handlers but did not run them.

### 7.3 Stat stages

From [PS] `sim/pokemon.ts` `calculateStat` / `getStat`:

```
boostTable = [1, 1.5, 2, 2.5, 3, 3.5, 4]
stage >= 0: stat = floor(stat * boostTable[stage])
stage <  0: stat = floor(stat / boostTable[-stage])
```

- Stages range from −6 to +6 for Atk, Def, SpA, SpD, Spe, accuracy and evasion.
- Stages are applied *before* the stat-modifier events.
- Simple doubles stage changes. Contrary inverts them. Unaware ignores the opponent's stages.
- Competitive (new in Gen 6) and Defiant give +2 SpA or +2 Atk when an opponent lowers a stat.
- Crits ignore stages in the attacker's favour only (§3.3).

---

## 8. Major status conditions

Sources: base `data/conditions.ts` with the overrides in `data/mods/gen6/conditions.ts`. All checks run before a move (`onBeforeMove`) unless noted.

| Status | Gen 6 behaviour | Source detail |
|---|---|---|
| **Sleep** | Lasts **1–3** turns of not moving. `startTime = random(2, 5)`, so 2–4. The counter goes down each time the Pokémon tries to move, and it acts on the turn it wakes. Early Bird decrements twice. **The counter is not reset on switch-in.** Only the gen5 mod has `onSwitchIn` resetting `time = startTime`. Rest sets the time to 3, so 2 turns asleep. Sleep Talk and Snore work while asleep. | 300 Spore trials gave 105 / 91 / 104 battles with 1 / 2 / 3 turns unable to move [run] |
| **Paralysis** | Speed ×**0.25**, applied after all other Speed modifiers (gen6 override: `spe * 25 / 100` after `finalModify`; Quick Feet ignores it). **25%** chance to be fully paralyzed. **Electric types are immune** (`par` in the Electric type's `damageTaken`). Gen 7 changed this to ½ Speed. | `gen6/conditions.ts` |
| **Burn** | **1/8** max HP at end of turn (gen6 override; base is 1/16). Physical damage ×0.5 (Guts and Facade exempt). Fire types are immune. | `gen6/conditions.ts` |
| **Freeze** | 20% chance to thaw each time the Pokémon tries to move. Thawed at once by its own `defrost`-flag moves (Flame Wheel, Sacred Fire, Flare Blitz, Scald, Fusion Flare, Steam Eruption) or by being hit by a damaging Fire move. Ice types are immune. Sun prevents freezing. | base `frz` |
| **Poison** | 1/8 max HP per turn. Poison and Steel types are immune. Poison Heal heals 1/8 instead. | base `psn` |
| **Toxic** | `stage/16` max HP, with stage +1 each turn up to 15. **The stage resets to 0 on switch-in** (`onSwitchIn`). A Poison-type user's Toxic never misses (the `toxic` move's `onPrepareHit` adds a volatile that returns `true` from `onSourceAccuracy`). | base `tox`, resolved `toxic` move |

**Powder immunity:** a move with the `powder` flag fails against Grass types, Overcoat (which also blocks sand and hail damage) and Safety Goggles. Powder moves in gen6: Spore, Sleep Powder, Stun Spore, Poison Powder, Cotton Spore, Rage Powder and Powder.

**Before-move check order** in Gen 6 (`onBeforeMovePriority`, high runs first) [run]:

1. Recharge (11).
2. Sleep and freeze (10).
3. Truant (9).
4. Flinch (8).
5. Disable (7).
6. Heal Block and Gravity (6).
7. Taunt (5).
8. **Confusion (3).**
9. Attract (2).
10. **Paralysis (1).**

**Status clauses** (in-battle `Rule`s):

- Sleep Clause Mod: a move cannot put a second opposing Pokémon to sleep while one of that side's Pokémon is still asleep from an opponent's move.
- Freeze Clause Mod works the same way for freeze.

---

## 9. Volatile statuses

Durations in Showdown count the turn of application. A `duration: N` effect is decremented in the residual phase and ends when it reaches 0 (`sim/battle.ts` `fieldEvent`).

| Volatile | Gen 6 behaviour (resolved gen6 data) |
|---|---|
| **Confusion** | `time = random(2, 6)` (2–5), decremented before each move. Ends on reaching 0, then the move goes ahead normally. So 1–4 turns. **Self-hit chance 50%** (gen6 override `randomChance(1, 2)`; base Gen 7+ is 33%). Self-hit is a 40 BP typeless physical hit using the Pokémon's own Atk and Def, with no crit and no STAB (`getConfusionDamage`). |
| **Flinch** | Lasts 1 turn and only matters if the flinched Pokémon moves after the source. Inner Focus blocks it. Steadfast gives +1 Spe. King's Rock and Razor Fang add a 10% flinch to damaging moves that lack one. |
| **Binding** (Wrap, Bind, Fire Spin, Clamp, Whirlpool, Sand Tomb, Magma Storm, Infestation) | `duration = random(5, 7)` (5 or 6), so **4–5 turns of damage**. Grip Claw gives 8, so 7 turns. Damage **1/8** max HP per turn; Binding Band makes it 1/6. Traps the target (Ghosts are immune). Ends if the user leaves the field. |
| **Taunt** | 3 turns, +1 if the target has not moved yet this turn. Blocks Status moves. Oblivious blocks Taunt in gen6, via the gen7 `oblivious` override. |
| **Encore** | 3 turns. Locks the target into its last move. Ends early if that move runs out of PP. |
| **Disable** | Duration 5 in data. |
| **Substitute** | Costs `floor(maxHP/4)` HP and fails at or below 1/4 HP. The substitute has `floor(maxHP/4)` HP. Absorbs damage and most status. **Moves with the `bypasssub` flag go through it, and every sound move has that flag in Gen 6.** Infiltrator also bypasses it. Setting it up frees the user from binding. |
| **Protect family** | +4 priority. Success chance `1/counter`, where the counter starts at 1, becomes 3 after a success and is ×3 per consecutive success up to a 729 cap (`stall` condition). King's Shield (Aegislash) gives −2 Atk on contact. Spiky Shield deals 1/8 on contact. |
| **Leech Seed** | 1/8 per turn, drained to the seeder's slot. Grass types are immune. |
| **Curse (Ghost user)** | 1/4 per turn |
| **Nightmare** | 1/4 per turn while asleep |
| **Yawn** | Sleep at the end of the next turn (duration 2) |
| **Perish Song** | Faint after 3 more end-of-turn counts (duration 4) |
| **Outrage / Thrash / Petal Dance** | Locked for 2–3 turns (`trueDuration = random(2, 4)`), then confusion |
| **Choice lock** | Locked to the first move used while holding the Choice item. The gen6 override removes the `onBeforeMove` check, so lock is enforced through move disabling. |
| **Destiny Bond** | gen6 override: removed when the user next uses any move (`onPrepareHit`) |
| **Magnet Rise, Embargo, Heal Block** | 5 turns |
| **Attract, Torment** | Until the Pokémon switches out |

---

## 10. Weather, terrain, hazards and field effects

### 10.1 Weather (base `data/conditions.ts`)

| Weather | Duration | Effects |
|---|---|---|
| Rain (Rain Dance, Drizzle) | **5 turns**, 8 with Damp Rock. Abilities included: the `effect.effectType === 'Ability'` code only sets `duration = 0` (infinite) when `gen <= 5`. | Water ×1.5, Fire ×0.5. Thunder and Hurricane never miss. Swift Swim ×2 Spe. Rain Dish and Dry Skin heal. |
| Sun (Sunny Day, Drought) | 5, or 8 with Heat Rock | Fire ×1.5, Water ×0.5. No freezing. Chlorophyll ×2 Spe. Solar Power ×1.5 SpA and −1/8 HP. Solar Beam needs no charge. |
| Sandstorm (Sand Stream) | 5, or 8 with Smooth Rock | 1/16 per turn to non-Rock/Ground/Steel Pokémon (Overcoat, Safety Goggles, Sand Veil/Force/Rush, Magic Guard exempt). Rock-type SpD ×1.5. |
| Hail (Snow Warning) | 5, or 8 with Icy Rock | 1/16 per turn to non-Ice Pokémon. Blizzard never misses. Ice Body heals. Custom: Ice-type Def ×1.5 (§17.5). |
| Primordial Sea / Desolate Land / Delta Stream | Indefinite while the source is active | Out of scope: these only come from Primal Kyogre, Primal Groudon and Mega Rayquaza (§5). |

When a new weather is set, it replaces the current one. The exception is that only another strong weather can replace a strong (Primal) weather.

### 10.2 Terrain (out of scope)

**Decided: no terrain.**

- **What creates terrain in gen6:** only the three moves **Electric Terrain**, **Grassy Terrain** and **Misty Terrain**. I checked every legal move's `terrain` field and every legal ability's `onStart` for `setTerrain` [run].
- No legal Gen 6 ability sets terrain. The Surge abilities (Electric, Grassy, Misty, Psychic Surge) and Hadron Engine exist in the dex only as `isNonstandard: "Future"`.
- No Gen 6 item interacts with terrain.
- Leave those three moves out of every set. With no terrain on the field, these become fixed or inert:
  - **Nature Power** always calls Tri Attack.
  - **Secret Power** keeps its default effect.
  - **Camouflage** makes the user Normal.
  - **Grass Pelt** (its Def boost needs Grassy Terrain) does nothing.
- These are safe to keep or to leave out as content.

### 10.3 Entry hazards (resolved gen6 data)

| Hazard | Effect on switch-in | Layers |
|---|---|---|
| **Stealth Rock** | `maxHP × 2^typeMod / 8`, using Rock effectiveness (1/32 … 1/2). Affects every Pokémon, grounded or not. | 1 |
| **Spikes** | `[0, 3, 4, 6][layers] × maxHP / 24`, i.e. 1/8, 1/6, 1/4, grounded only | up to 3 |
| **Toxic Spikes** | 1 layer: poison. 2 layers: toxic. Grounded only. A grounded Poison type absorbs and removes them. Steel types are unaffected. | up to 2 |
| **Sticky Web** (new in Gen 6) | −1 Spe to a grounded Pokémon. Counts as a foe's stat drop, so it triggers Defiant and Competitive. | 1 |

**Removal:**

- Rapid Spin removes hazards, Leech Seed and binding from the *user's* side.
- **Defog in Gen 6** clears the target side's screens, Safeguard, Mist and hazards, and **also the user's own side's hazards**. It also lowers the target's evasion by 1.
- Magic Bounce reflects hazard moves.
- Heavy-Duty Boots do not exist in Gen 6.

### 10.4 Screens and other side and field conditions

| Effect | Duration | Effect |
|---|---|---|
| Reflect / Light Screen | 5, or 8 with Light Clay | ×0.5 physical / special damage in singles (final modifier). Ignored by crits and Infiltrator. Brick Break and Defog remove them. |
| Safeguard / Mist | 5 | Block status / stat drops from foes |
| Tailwind | **4** (includes the turn used) | Speed ×2 for that side |
| Trick Room | 5 | −7 priority. Order uses `10000 − speed`. Using it again while active ends it. |
| Gravity, Magic Room, Wonder Room | 5 | Phase 3+ |

---

## 11. End-of-turn order

Gen 6 groups end-of-turn effects **per effect**: each effect runs for every active Pokémon in speed order before the next effect starts.

The table below was generated from every `onResidualOrder` / `onResidualSubOrder`, `onSideResidualOrder` and `onFieldResidualOrder` value in the gen6 resolved data [run]. It is executed by `fieldEvent('Residual')`, which `speedSort`s all handlers by order, then speed, then sub-order. Each effect's duration countdown runs when its handler is reached. If the countdown hits 0, the effect ends *instead of* applying that turn.

| Order.sub | Effect | Amount (Gen 6) |
|---|---|---|
| 1 | **Weather**: countdown/end, then per Pokémon (speed order): sandstorm and hail damage, Dry Skin, Solar Power, Rain Dish, Ice Body | 1/16 chip; Solar Power −1/8; Dry Skin +1/8 in rain, −1/8 in sun; Rain Dish and Ice Body +1/16 |
| 3 | Future Sight / Doom Desire hit | — |
| 4 | Wish heals | 1/2 of the Wish user's max HP |
| 5.1 | Fire Pledge "sea of fire" (combo only) | 1/8 |
| 5.2 | Grassy Terrain heal (out of scope) | +1/16 |
| 5.3 | Healer, Hydration, Shed Skin (30% cure) | — |
| 5.4 | **Leftovers / Black Sludge** | +1/16 (Black Sludge −1/8 to non-Poison) |
| 6 | Aqua Ring | +1/16 |
| 7 | Ingrain | +1/16 |
| 8 | **Leech Seed** | −1/8 to the seeded Pokémon, healing the seeder |
| 9 | **Poison / Toxic** | −1/8 / −n/16 |
| 10 | **Burn** | −1/8 |
| 11 | Nightmare | −1/4 |
| 12 | Curse | −1/4 |
| 13 | **Binding** | −1/8 (1/6 with Binding Band), or freed |
| 15 | Taunt countdown | — |
| 16 | Encore countdown / PP check | — |
| 17 | Disable countdown | — |
| 18–21 | Magnet Rise, Telekinesis, Heal Block, Embargo | — |
| 23 | **Yawn** → sleep | — |
| 24 | Perish Song count | — |
| 25 | Roost ends (Flying type restored) | — |
| 26.1–26.9 | Side conditions: Reflect, Light Screen, Safeguard, Mist, **Tailwind**, Lucky Chant, Water/Fire/Grass Pledge | — |
| 27.1–27.7 | Field: **Trick Room**, Gravity, Water Sport, Mud Sport, Wonder Room, Magic Room, terrains (out of scope) | — |
| 28.1 | Uproar | — |
| 28.2 | **Speed Boost**, Moody, Bad Dreams (−1/8 to sleeping foes), Harvest, Pickup, Slow Start | — |
| 28.3 | Flame Orb, Toxic Orb, Sticky Barb (−1/8) | — |
| 29 | Zen Mode, White Herb | — |
| — (no order) | Outrage-lock counter, Rollout/Ice Ball, Micle Berry | — |
| then | **Faint check.** Every side with a fainted active gets a `forceSwitch` request simultaneously. Replacements enter, hazards and switch-in abilities apply, and the next turn starts. | — |

Magic Guard blocks every damage entry except direct move damage (gen6 override: `onDamage` returns false unless `effect.effectType === 'Move'`). Heal Block blocks the heal entries.

---

## 12. Abilities and held items

### 12.1 How they hook in

Each ability or item is a set of event handlers. The engine handles all of this; the categories matter for choosing a subset and for what the UI needs to show.

| Hook (event) | Gen 6 abilities | Gen 6 items |
|---|---|---|
| Switch-in (`onStart`, `onSwitchIn`) | Intimidate, Drizzle, Drought, Sand Stream, Snow Warning, Trace, Download, Mold Breaker (announce), Pressure, Frisk, Anticipation, Fairy/Dark Aura | Air Balloon (announce) |
| Priority (`onModifyPriority`) | **Gale Wings** (+1 Flying, gen6 override), Prankster (+1 Status) | Quick Claw, Lagging Tail, Full Incense (fractional) |
| Type change (`onModifyType`) | **Aerilate, Pixilate, Refrigerate** (Normal → type, ×1.3), Normalize (gen6: no power boost) | — |
| Self type change (`onPrepareHit`) | **Protean** (user becomes the move's type before every move; no once-per-entry limit in Gen 6) | — |
| Base power (`onBasePower`) | **Tough Claws** (contact ×1.3), Strong Jaw (bite ×1.5), Mega Launcher (pulse ×1.5), Technician, Iron Fist, Reckless, Sheer Force, Sand Force, Analytic, Rivalry, Fairy/Dark Aura | Plates, type items, Muscle Band, Wise Glasses, Normal Gem |
| Stat (`onModifyAtk/SpA/Def/SpD/Spe`) | Huge Power, Guts, Thick Fat (attacker side), Solar Power, Swift Swim, Chlorophyll, Sand Rush, **Fur Coat** (Def ×2), Blaze-family | Choice Band/Specs/Scarf, **Assault Vest** (SpD ×1.5), Eviolite |
| STAB (`onModifySTAB`) | Adaptability | — |
| Final damage (`onModifyDamage` / `onSourceModifyDamage`) | Multiscale, Filter, Solid Rock, Sniper, Tinted Lens | Life Orb, Expert Belt, **Roseli Berry** and the other resist berries, Metronome |
| Immunity / absorb (`onTryHit`) | Levitate (via `isGrounded`), Flash Fire, Volt/Water Absorb, Motor Drive, Lightning Rod, Storm Drain, Sap Sipper, Dry Skin, Wonder Guard, Soundproof, **Bulletproof**, **Overcoat** (powder, weather), Magic Bounce | **Safety Goggles** (powder, weather) |
| On being hit (`onDamagingHit`) | Static, Flame Body, Poison Point, Effect Spore, Cute Charm, Rough Skin and Iron Barbs (1/8 in gen6), Gooey, Weak Armor (gen6: −1 Def / +1 Spe), Justified, Cursed Body, Aftermath | Rocky Helmet (1/6), **Weakness Policy** (+2 Atk/SpA on a super-effective hit), Air Balloon pop, Kee/Maranga Berry, Jaboca/Rowap, Luminous Moss, Snowball |
| Stat-drop reactions | **Competitive**, Defiant | White Herb |
| Survival (`onDamage`) | Sturdy (OHKO immunity, and survives with 1 HP from full) | Focus Sash, Focus Band |
| HP threshold (`onUpdate`) | — | Sitrus (+1/4 at ≤ 1/2), pinch berries (gen6: +1/8 at ≤ 1/2, may confuse), Lum, Chesto and the other cure berries |
| Residual | §11 | §11 |
| Move disabling | — | Choice lock, **Assault Vest** (no Status moves) |
| Crit / accuracy | Super Luck, Battle/Shell Armor, Sniper, Compound Eyes, Hustle, No Guard, Keen Eye, Sand Veil, Snow Cloak | Scope Lens, Razor Claw, Wide Lens, Zoom Lens, BrightPowder, Lax Incense |
| Trapping | Shadow Tag, Arena Trap, Magnet Pull | Shed Shell (escape) |
| Forme change | Stance Change (gen6 override), Zen Mode | (Mega Stones: out of scope) |

**The new Gen 6 abilities** in the data are:

- Aerilate, Pixilate, Refrigerate;
- Gale Wings, Parental Bond, Protean, Tough Claws, Strong Jaw, Mega Launcher;
- Stance Change, Symbiosis;
- Fairy Aura, Dark Aura, Aura Break;
- Aroma Veil, Sweet Veil, Flower Veil;
- Bulletproof, Cheek Pouch, Competitive, Fur Coat, Gooey, Grass Pelt, Magician;
- Primordial Sea, Desolate Land, Delta Stream (ORAS).

### 12.2 Gen 6 items

| Item | Gen 6 effect (resolved data) |
|---|---|
| **Assault Vest** | SpD ×1.5; Status moves disabled (except Me First) |
| **Weakness Policy** | On a super-effective hit that is not fixed damage: +2 Atk and +2 SpA, consumed |
| **Safety Goggles** | Immune to powder moves and to sandstorm/hail damage |
| **Roseli Berry** | Halves one super-effective Fairy hit (not through a substitute) |
| Kee / Maranga Berry | +1 Def / +1 SpD after being hit by a physical / special move |
| Luminous Moss / Snowball | +1 SpD / +1 Atk when hit by Water / Ice |
| Pixie Plate | Fairy ×1.2 |
| Mega Stones, Blue / Red Orb | 47 Mega Stones are legal in gen6. **Never give them out (§5).** |
| **Gems** | Only **Normal Gem** is obtainable (×1.3). The other 17 gems, including the Fairy Gem, are `isNonstandard: "Unobtainable"` in gen6. |

### 12.3 Coverage check

- The gen6 resolved data has **284 legal items** (`isNonstandard` null) and **191 legal abilities** [run]. `@pkmn/data` Gen 6 agrees: 284 items, 191 abilities, 634 moves, 834 species and formes [run].
- I listed every legal item with **no** event handler and no Mega/Plate/ball/boost property [run]. That list contains only:
  - (a) items with no battle effect: evolution items, fossils, EV-reducing and flavour berries, Pretty Feather, Big Nugget, Ring Target as data;
  - (b) items implemented *elsewhere* by an id check: Damp/Heat/Smooth/Icy Rock in the weather `durationCallback`s, Light Clay in the screens, Grip Claw and Binding Band in `partiallytrapped`;
  - (c) items whose effect is a plain data constant: Lagging Tail and Full Incense have `onFractionalPriority: -0.1`.
- The same check on abilities left Battle Armor and Shell Armor (`onCriticalHit: false`), Levitate (`isGrounded`), Early Bird (`slp` condition), Stall (fractional priority constant), and Honey Gather, Illuminate, Run Away and Multitype, which have no singles battle effect here.
- So, as far as a static scan can show, **every battle-relevant Gen 6 item and ability is implemented**. I did not run a behavioural test for each one.

### 12.4 Recommended first-version subset

Pick species whose abilities are all on this list. Mega Stones and Primal orbs are excluded (decided).

| Abilities (~22) | Items (~16) |
|---|---|
| Blaze, Torrent, Overgrow, Swarm | Leftovers, Black Sludge |
| Intimidate, Levitate | Choice Band, Choice Specs, Choice Scarf |
| Static, Flame Body, Poison Point, Rough Skin | Life Orb, Expert Belt |
| Thick Fat, Water Absorb, Volt Absorb, Flash Fire | Focus Sash |
| Natural Cure, Insomnia, Inner Focus, Own Tempo | Sitrus Berry, Lum Berry |
| Sturdy, Technician, Huge Power (Azumarill) | **Assault Vest**, **Weakness Policy** |
| Magic Guard, Multiscale (Clefable, Dragonite) | Eviolite (NFE rentals), Rocky Helmet |
| Serene Grace, Shell Armor / Battle Armor | Roseli Berry (Fairy flavour) |

Because the engine implements every ability and item, this subset is a *content* choice (fewer things to explain and render), not an engineering limit.

---

## 13. Moves

### 13.1 Move data schema (Showdown `MoveData`, resolved gen6)

| Field | Example (gen6) | Notes |
|---|---|---|
| `id`, `name`, `num`, `gen` | `moonblast`, Moonblast, 585, 6 | |
| `type` | `Fairy` | 18 types. Struggle becomes `???` at use. |
| `category` | `Physical` / `Special` / `Status` | |
| `basePower` | 95 | 0 for status moves and callback-driven moves (`basePowerCallback`) |
| `accuracy` | 100, or `true` (never misses) | |
| `pp` | 15 | Max PP with 3 PP Ups = `pp × 8/5` (`calculatePP`) |
| `priority` | 0 | §6.2 |
| `target` | `normal`, `self`, `allAdjacentFoes`, `allySide`, `foeSide`, `all` … | In singles only "the foe", "self" and side/field matter. |
| `flags` | `{protect, mirror, contact, sound, bypasssub, powder, punch, bite, pulse, bullet, defrost, charge, recharge, heal, reflectable, snatch, …}` | Drives Protect, Magic Bounce, Soundproof, Bulletproof, Iron Fist, Strong Jaw, Mega Launcher, Tough Claws, Substitute bypass and others. |
| `secondary` / `secondaries` | `{chance: 30, boosts: {spa: -1}}` | Status, volatile, boosts, or `self` boosts. Serene Grace doubles the chance. Sheer Force removes the effect and adds ×1.3 power. |
| `self` | `{boosts: {def: -1, spd: -1}}` (Close Combat) | |
| `recoil` / `drain` | `[33, 100]` / `[1, 2]` | Recoil = `round(damage × num/den)`, minimum 1 (`calcRecoilDamage`) |
| `critRatio`, `willCrit` | 2 / true | §3.3 |
| `multihit` | `[2, 5]` or 2 | Gen 5+ odds 35/35/15/15 (`gen >= 5` branch). Skill Link gives 5. |
| `ohko` | `true` | Gen 6 Sheer Cold is `ohko: true`, with no Ice-type immunity. |
| `damage` / `damageCallback` | `'level'` (Seismic Toss, Night Shade), Super Fang | |
| Handlers | `onHit`, `onTry`, `onModifyMove`, `basePowerCallback`, `beforeTurnCallback`, `condition` … | The engine code for special moves |
| `isNonstandard` | null / `Past` / `Unobtainable` / `Future` / `CAP` | Filter on null for "legal in gen6". 634 moves are null. |

### 13.2 Gen 6 move changes

> **Stock values.** This section lists stock Gen 6 move values. §17 patches some of these (types, base stats, abilities and moves). Use §17's value wherever it lists one.

**From Gen 5 to Gen 6**, generated by diffing `basePower`, `accuracy`, `pp`, `type`, `category`, `priority` and secondaries [run]:

- **Power nerfs:**
  - Thunderbolt, Flamethrower, Ice Beam, Surf and Muddy Water: 95→90.
  - Fire Blast, Hydro Pump, Thunder, Blizzard and Hurricane: 120→110.
  - Heat Wave 100→95; Dragon Pulse 90→85; Draco Meteor, Leaf Storm and Overheat 140→130; Aura Sphere 90→80; Magma Storm 120→100; Meteor Mash 100→90 (accuracy 85→90).
- **Power buffs:**
  - **Knock Off 20→65**, plus ×1.5 when the target holds a removable item.
  - Energy Ball 80→90; Power Gem 70→80; Crabhammer 90→100; Air Cutter 55→60; Assurance 50→60; Thief 40→60 (PP 10→25); Incinerate 30→60; Frost Breath and Storm Throw 40→60.
  - Rock Tomb 50/80/10 → 60/95/15; Pin Missile 14/85 → 25/95; Vine Whip 35→45 (PP 15→25).
  - Smog and Lick 20→30; Snore 40→50; Struggle Bug 30→50; Bubble 20→40; Fury Cutter 20→40; Hex 50→65; Low Sweep 60→65; Smelling Salts and Wake-Up Slap 60→70; Skull Bash 100→130; Synchronoise 70→120; Future Sight 100→120; Techno Blast 85→120; Chatter 60→65; Pledges 50→80.
  - Hidden Power is fixed at 60.
- **Accuracy changes:** Will-O-Wisp 75→85; Gunk Shot 70→80; Glare 90→100; Poison Gas 80→90; Psycho Shift 90→100; Psywave 80→100; Roar and Whirlwind 100→never miss.
- **PP changes:** Swords Dance and Growth 30/40→20; Acid Armor 40→20; Barrier 30→20; Minimize 20→10; Tailwind 30→15; Air Slash 20→15; Extrasensory 30→20; Covet 40→25; Submission 25→20; Sacred Sword 20→15.
- **Type changes:** Charm, Sweet Kiss and Moonlight Normal→**Fairy**.
- **Priority changes:** Follow Me and Rage Powder +3→+2; Magic Room and Wonder Room −7→0.

**Gen 6 overrides that undo Gen 7 changes** (`data/mods/gen6/moves.ts`):

- Tackle 50 (Gen 7: 40);
- Sucker Punch 80 (Gen 7: 70);
- Thunder Wave 100% accuracy (Gen 7: 90);
- Swagger 90% accuracy (Gen 7: 85);
- Leech Life 20 BP / 15 PP;
- Mystical Fire 65; Fell Stinger 30 (+2 Atk on KO); Flying Press 80; Parabolic Charge 50;
- Water Shuriken Physical;
- Dark Void 80% accuracy;
- Parting Shot always lowers stats; Diamond Storm 50% +1 Def;
- Thousand Arrows/Waves are Unobtainable.

**Other Gen 6 mechanical changes:**

- Sound moves bypass Substitute (`bypasssub` flag).
- Powder moves fail against Grass types.
- A Poison-type user's Toxic never misses.
- Defog clears hazards on both sides.
- Fake Out only works on the first turn out.
- Pursuit cancels the switch if it KOs.
- Curse is Ghost-type (since Gen 5).

**New Fairy moves** (gen6 data):

| Move | Category | BP / Acc / PP | Notes |
|---|---|---|---|
| Moonblast | Special | 95 / 100 / 15 | 30% −1 SpA |
| Play Rough | Physical | 90 / 90 / 10 | 10% −1 Atk |
| Dazzling Gleam | Special | 80 / 100 / 10 | Hits both foes in doubles |
| Draining Kiss | Special | 50 / 100 / 10 | Heals 3/4 of the damage dealt |
| Disarming Voice | Special | 40 / — / 15 | Sound; never misses |
| Fairy Wind | Special | 40 / 100 / 30 | |
| Misty Terrain | Status | | Out of scope (§10.2); exclude it |
| Baby-Doll Eyes | Status | — / 100 | +1 priority, −1 Atk |
| Moonlight (retyped), Charm (retyped), Sweet Kiss (retyped), Crafty Shield, Flower Shield, Aromatic Mist, Fairy Lock, Geomancy | Status | | |

**No moves were removed in Gen 6.** All Gen 1–5 moves remain usable; removals started in Gen 8. Moves new in Gen 6 that matter for Gen 1–2 learnsets include Play Rough, Moonblast, Dazzling Gleam, Draining Kiss, Sticky Web, Parting Shot, King's Shield and Spiky Shield (signature), Infestation, Power-Up Punch, Disarming Voice and Fell Stinger. There are 59 legal Gen 6-introduced moves in total.

**XY vs ORAS:** the `gen6xy` mod marks only Hyperspace Fury, Precipice Blades, Dragon Ascent and Origin Pulse as ORAS-only *moves*. The ORAS move tutors only affect *learnsets*, which are covered by `data/mods/gen6xy/learnsets.ts`; I did not diff them.

### 13.3 Special mechanics (Gen 6 as the engine implements them)

- **Multi-hit:** `[2, 5]` moves use 2/3/4/5 hits at 35/35/15/15%. Each hit rolls separately. Skill Link gives 5.
- **Recoil:** `round(damage × fraction)`, minimum 1.
  - 33/100: Double-Edge, Brave Bird, Flare Blitz, Wood Hammer.
  - 1/4: Take Down.
  - 1/2: Head Smash.
  - Struggle recoil is `round(maxHP/4)`.
- **Crash:** Jump Kick and High Jump Kick deal 1/2 of the user's max HP to the user on a miss (`onMoveFail`).
- **Drain:** Giga Drain and Drain Punch heal 1/2 of the damage (both 75 BP). Draining Kiss heals 3/4.
- **Explosion / Self-Destruct:** the user faints. The target's Defense is no longer halved (that was Gen ≤ 4).
- **Struggle:** 50 BP, typeless at use, ¼ max HP recoil.
- **Rest:** sleep for 2 turns, full heal.
- **Fixed damage:**
  - Seismic Toss and Night Shade deal damage equal to the user's level.
  - Super Fang halves the target's current HP.
  - Dragon Rage 40 and Sonic Boom 20 are still standard in Gen 6.
- **Two-turn, recharge and lock moves:** handled by the `twoturnmove`, `mustrecharge` and `lockedmove` conditions.

### 13.4 Suggested first-version move subset (~100 moves, Gen 6 values)

> **Stock values.** This table uses stock Gen 6 move values. §17 patches some of these (types, base stats, abilities and moves). Use §17's value wherever it lists one.

Values are BP / accuracy / PP from the resolved gen6 data [run]. "—" means the move never misses.

| Type | Moves |
|---|---|
| Normal | Tackle 50/100/35, Body Slam 85/100/15 (30% par), Headbutt 70/100/15 (30% flinch), Double-Edge 120/100/15 (33% recoil), Quick Attack 40 (+1), Extreme Speed 80/100/5 (+2), Fake Out 40 (+3, flinch, first turn only), Hyper Voice 90 (sound, special), Facade 70, Return (friendship-based: fix at max), Hyper Beam 150/90/5 |
| Fire | Ember 40, Flamethrower 90/100/15, Fire Blast 110/85/5, Flare Blitz 120 (recoil), Will-O-Wisp 85% |
| Water | Water Gun 40, Surf 90, Hydro Pump 110/80/5, Waterfall 80 (20% flinch), Aqua Jet 40 (+1), Scald 80 (30% brn, thaws), Crabhammer 100/90 (high crit) |
| Electric | Thunder Shock 40, Thunderbolt 90, Thunder 110/70, Thunder Wave (100%), Volt Switch 70 |
| Grass | Vine Whip 45, Razor Leaf 55/95, Energy Ball 90, Giga Drain 75, Leaf Blade 90, Leech Seed 90%, Sleep Powder 75%, Spore 100% |
| Ice | Ice Beam 90/100/10, Blizzard 110/70/5, Ice Shard 40 (+1), Ice Punch 75 |
| Fighting | Brick Break 75, Close Combat 120, Cross Chop 100/80, Mach Punch 40 (+1), Focus Blast 120/70, Drain Punch 75, Seismic Toss |
| Poison | Sludge Bomb 90, Poison Jab 80, Toxic 90% |
| Ground | Earthquake 100, Earth Power 90, Spikes |
| Flying | Brave Bird 120, Air Slash 75/95, Aerial Ace 60/—, Roost |
| Psychic | Psychic 90, Psyshock 80 (hits Def), Zen Headbutt 80/90, Calm Mind, Reflect, Light Screen, Rest, Hypnosis 60% |
| Bug | X-Scissor 80, Bug Buzz 90, U-turn 70 |
| Rock | Stone Edge 100/80, Rock Slide 75/90, Stealth Rock |
| Ghost | Shadow Ball 80, Shadow Claw 70, Shadow Sneak 40 (+1), Confuse Ray, Night Shade |
| Dragon | Dragon Claw 80, Dragon Pulse 85, Outrage 120/100/10, Dragon Dance |
| Dark | Crunch 80, Dark Pulse 80, Sucker Punch 80 (+1), Pursuit 40, **Knock Off 65**, Nasty Plot |
| Steel | Iron Head 80, Flash Cannon 80, Bullet Punch 40 (+1) |
| **Fairy** | **Moonblast 95, Play Rough 90/90, Dazzling Gleam 80, Draining Kiss 50** |
| Status / utility | Swords Dance, Protect (+4), Substitute, Recover, Soft-Boiled, Sleep Talk, Roar (−6), Rapid Spin 20, Defog, Baton Pass, Super Fang |

Because the engine implements all of these, the subset only limits UI text and data curation, not engineering effort.

In this table, Scald, Crabhammer and Rapid Spin are changed by §17.4.

---

## 14. Data access and running the engine

### 14.1 Packages

| Package | Version (installed) | License | What it is | Unpacked size |
|---|---|---|---|---|
| `@pkmn/sim` | 0.10.11 | MIT | Showdown's `sim/` plus data and all mods, as CJS + ESM. Deps: `@pkmn/sets`, `@pkmn/streams`, `ts-chacha20`. | ~46 MB |
| `@pkmn/dex` | 0.10.11 | MIT | Data layer (species, moves, items, abilities, learnsets) per generation | ~51 MB |
| `@pkmn/data` | 0.10.11 | MIT | Typed per-generation wrapper over `@pkmn/dex`; hides non-standard entries by default | ~172 KB |
| `pokemon-showdown` | 0.11.11 | MIT | The whole Showdown server, with **TypeScript source included** (useful for reading) | ~144 MB |

The license text is MIT, "Copyright (c) 2011-2026 Guangcong Luo and other contributors" (`LICENSE` in both `pokemon-showdown` and `@pkmn/sim`). Keep the notice in any distributed copy.

### 14.2 Loading gen6 data

```ts
// Typed, filtered (recommended for building rental sets / UI data)
import {Dex} from '@pkmn/dex';
import {Generations} from '@pkmn/data';

const gens = new Generations(Dex);
const gen6 = gens.get(6);
gen6.species.get('Clefable');            // types ['Fairy'], baseStats {hp:95, atk:70, def:73, spa:95, spd:90, spe:60}
gen6.types.get('Fairy').effectiveness;   // {Dragon: 2, Fighting: 2, Dark: 2, Fire: 0.5, Poison: 0.5, Steel: 0.5, ...}
gen6.moves.get('Moonblast');             // 95 BP, Fairy, Special, 30% -1 SpA
gen6.species.get('Raichu-Mega-X');       // undefined (Future Mega filtered out)
await gen6.learnsets.canLearn('Azumarill', 'Play Rough');   // true

// Raw simulator dex (includes non-standard entries; filter on isNonstandard yourself)
import {Dex as SimDex} from '@pkmn/sim';
const d6 = SimDex.mod('gen6');           // same as SimDex.forGen(6)
d6.moves.get('Thunder Wave').accuracy;   // 100
```

All of these calls were run [run]. Two caveats about learnsets:

- `gen6.learnsets.get(species)` returns that species' own entries, with source codes from every generation (e.g. `['9M','9L25','8M','8L25','7L25','6L25']` for Azumarill's Play Rough). Filter to codes starting with `6` or lower.
- Moves inherited from a pre-evolution, such as egg moves learned as Marill, are not in the species' own entry. Use `canLearn` or the `TeamValidator`.

Gen 6 learnsets in Showdown combine XY and ORAS. Codes are `6L` (level-up), `6M` (TM), `6T` (tutor), `6E` (egg), `6S` (event).

### 14.3 Running a battle server-side

**Option A: the `Battle` object directly.** This is the simplest fit for "load state, apply a choice, save state".

```ts
import {Battle, Teams} from '@pkmn/sim';

const FORMAT = 'gen6customgame@@@Sleep Clause Mod,Species Clause,Picked Team Size = 3,Endless Battle Clause,HP Percentage Mod';

// New battle
const battle = new Battle({
  formatid: FORMAT,
  seed: 'sodium,' + crypto.randomBytes(16).toString('hex'),   // server-side seed; store it
  send: (type, data) => {/* 'update' | 'sideupdate' | 'end' messages; see 14.4 */},
});
battle.setPlayer('p1', {name: 'Alice', team: Teams.pack(p1Sets)});   // sets with level: 50 set by the server
battle.setPlayer('p2', {name: 'Bob',   team: Teams.pack(p2Sets)});
// battle.requestState === 'teampreview'; battle.p1.activeRequest has the request JSON

battle.choose('p1', 'team 351');   // pick order from preview
battle.choose('p2', 'team 123');   // the turn starts when both are in

// Each turn
const ok = battle.choose('p1', 'move 1');        // false + '|error|[Invalid choice] ...' on bad input
// (the server rejects any 'mega' suffix before this call; §5)
// ... p2 later ...
battle.choose('p2', 'switch 2');                  // resolves the turn when both choices are done

// Persist between HTTP requests
const json = JSON.stringify(battle.toJSON());     // ~20 KB for 3v3 in my test
// ... later ...
const restored = Battle.fromJSON(json);
restored.restart((type, data) => {/* reattach the send callback */});
```

Results of running this [run]:

- The seed format is `sodium,<32 hex chars>` (ChaCha20) or `gen5,<hex>`. See `sim/prng.ts`.
- `toJSON()` produced 20,259 bytes for 3v3 at the first turn.
- `fromJSON` averaged about 0.6 ms.
- **A half-submitted turn survives serialization.** I saved after only p1 had chosen, restored, and submitted p2's choice. The turn resolved correctly. The test happened to use a Mega choice; plain `move N` uses the same code path.
- **Determinism:** two copies of the same battle, one of them round-tripped through JSON, produced identical logs for the same choices. The exception is the `|t:|<unix time>` lines, which `turnLoop` writes from `Date.now()`; ignore them or strip them before comparing.
- **Alternative persistence:** store the seed and the input log (`battle.inputLog`: `>start …`, `>player …`, `>p1 move 1`, …). Rebuild the battle by replaying it, which is the Showdown replay model. That costs more CPU per turn but stores much less. **Not chosen:** the project saves the `toJSON()` snapshot (§18.6).

**Option B: `BattleStream`**, the text protocol Showdown uses between processes:

```ts
import {BattleStreams} from '@pkmn/sim';
const stream = new BattleStreams.BattleStream();
const {omniscient, spectator, p1, p2} = BattleStreams.getPlayerStreams(stream);
omniscient.write(`>start {"formatid":"gen6customgame","seed":"sodium,00112233445566778899aabbccddeeff"}`);
omniscient.write(`>player p1 {"name":"Alice","team":"<packed>"}`);
omniscient.write(`>player p2 {"name":"Bob","team":"<packed>"}`);
omniscient.write(`>p1 team 21\n>p2 team 12`);
omniscient.write(`>p1 move 4\n>p2 switch 2`);
// p1/p2 streams yield '|request|{json}' and that player's private log; spectator yields the public log
```

I ran this [run], with a Mega choice in the test. The p2 switch was intercepted by Pursuit (move 4). Streams are asynchronous and keep the battle in memory, so Option A suits a stateless Vercel function better.

### 14.4 The request/choice protocol (summary of `sim/SIM-PROTOCOL.md`)

| Request JSON (`activeRequest`) | Meaning | Valid choices |
|---|---|---|
| `{teamPreview: true, side: {...}}` | Team preview | `team 123` (the order of the first N picks, N = Picked Team Size) |
| `{active: [{moves: [...], trapped?, maybeTrapped?}], side}` | Normal turn | `move 1`–`move 4`, `switch 2`–`switch 6`; `default`; `undo` (Cancel Mod). The engine also accepts `move N mega` when `canMegaEvo` is present; with no stones it never is, and the server should reject the suffix anyway. |
| `{forceSwitch: [true], side}` | Must replace a fainted Pokémon, or U-turn/Baton Pass mid-turn | `switch n` |
| `{wait: true, side}` | The other player must act (e.g. their forced switch) | none |

- Each move entry has `move`, `id`, `pp`, `maxpp`, `target` and `disabled`.
- `side.pokemon[]` has `ident`, `details` (e.g. `Gengar, L50, M`), `condition` (`136/136`), `stats`, `moves`, `baseAbility`, `item` and `active` [run].
- The output log uses Showdown's battle protocol (`|switch|`, `|move|`, `|-damage|`, `|-supereffective|`, `|turn|`, `|win|`, …). With `HP Percentage Mod`, the public log shows HP as a percentage, and private `|split|` blocks give each player exact HP for their own side.
- The Crystal-style client renders these lines as Gen 2 text boxes and animations.

### 14.5 Licenses and IP

- **Code and data:** MIT for all four packages. This permits use, modification and commercial distribution if the notice is kept.
- **Nintendo IP:** MIT covers Showdown's *code and its compilation*. It grants **no rights** to Pokémon names, species designs, sprites or other Nintendo / Creatures / Game Freak / The Pokémon Company IP.
- **IP note.** These are factual considerations. **This is not legal advice.** Consult a lawyer before any public or commercial release.
  - **Trademarks.** "Pokémon" and the species names are trademarks of Nintendo, Creatures and Game Freak, managed by The Pokémon Company. "Picomon" is a different word, but closeness to a famous mark can still raise trademark questions.
  - **Copyright.** Sprites, artwork, music, sound effects and in-game text are copyrighted. Gen 2 sprites ripped from Crystal are Nintendo and Game Freak assets. Fan-made sprites of existing Pokémon "in the style of" Gen 2 are generally still derivative works.
  - **Mechanics and numbers.** Abstract game rules and formulas are generally treated as unprotectable ideas or methods in many jurisdictions (e.g. US copyright law). Code, expressive text and some compilations can be protected, so copying game binaries or decompiled code is riskier than using public data.
  - **Enforcement.** Nintendo and The Pokémon Company have sent takedown notices (e.g. DMCA) to several fan games and projects. Showdown has run for years without takedowns of its names and sprites; draw no conclusions from that.
  - **Lower-risk options:** original creatures, names and art; private or invite-only play; non-commercial use; no official logos or ripped assets.
- **Decided (2026-10-21):** the project keeps **real Pokémon names, data and sprites** (sprites from Polished Crystal). It is **free and will never be charged for**, and Home credits it as an unofficial fan project not affiliated with Nintendo, Creatures or GAME FREAK. No change to the code or assets is needed.

---

## 15. Key Gen 6 mechanics

> **Stock values.** These are stock Gen 6 values. §17 patches some of them (types, base stats, abilities and moves). Use §17's value wherever it lists one.

A quick reference to the Gen 6 behaviour from the gen6 engine, as cited in the sections above.

| Mechanic | Gen 6 |
|---|---|
| Modifier math | 4096-based `chainModify`/`modify` (pokeRound, half down) |
| Damage order | +2 → weather → crit → random → STAB → type → burn → final chain (screens, Life Orb, Expert Belt, berries…) → min 1 → 16-bit |
| Crit multiplier | ×1.5 (Sniper ×2.25) |
| Crit stages | 1/16, 1/8, 1/2, always |
| Crits vs screens and stages | Ignore screens and unfavourable stages |
| Type chart | 18 types including Fairy; Steel does not resist Ghost or Dark |
| Species typing | Gen 6 types, including the Fairy retypings (§4.3) |
| Base stats | Gen 6 values (§4.3) |
| Abilities | Hidden Abilities exist; the Jigglypuff line has Competitive |
| Mega Evolution | Exists in Gen 6; **out of scope (decided)** |
| Paralysis | ¼ Speed, 25% full paralysis; Electric types immune |
| Burn | 1/8 per turn; physical damage ×0.5, Facade exempt |
| Sleep | 1–3 turns; not reset on switch |
| Freeze | 20% thaw; Scald and other `defrost` moves thaw the user |
| Toxic | n/16; always hits when the user is Poison-type |
| Confusion | 50% self-hit, 1–4 turns |
| Binding | 4–5 turns, 1/8 (Binding Band 1/6, Grip Claw 7 turns) |
| Ability weather | 5 turns (8 with a rock) |
| Terrains | Exist in Gen 6 (moves only); **out of scope (decided)** |
| Hazards | Stealth Rock, Spikes, Toxic Spikes, Sticky Web; Defog clears both sides |
| Protect / Detect | +4; each consecutive use has 1/3 the chance (1/3, 1/9, …) |
| Fake Out | +3, first turn out only |
| Extreme Speed | +2 |
| Follow Me / Feint | +2 / +2 |
| Gale Wings, Prankster vs Dark | Gale Wings gives Flying moves +1 (no HP condition); Prankster works on Dark |
| Pursuit KO on a switching target | Switch cancelled |
| End-of-turn grouping | Per effect (§11) |
| Turn order recompute | Fixed at turn start |
| Explosion | Does not halve target Def |
| Sturdy | Blocks OHKO moves; survives at 1 HP from full |
| Sound vs Substitute | Bypasses |
| Ghost vs trapping | Immune |
| Powder moves vs Grass, Overcoat | Immune |
| Multi-hit odds | 35/35/15/15 (2/3/4/5 hits) |
| Tailwind | 4 turns |
| Taunt / Encore | 3 (+1) / 3 turns |
| Hidden Power | 60 BP fixed |
| Curse | Ghost type |
| Knock Off | 65 BP, ×1.5 vs an item holder |
| Main special moves | 90 BP (Thunderbolt, Flamethrower, Ice Beam, Surf) / 110 BP (Fire Blast, Hydro Pump, Thunder, Blizzard) |
| Tackle | 50 BP / 100% |
| Life Orb | ×5324/4096 final; recoil 1/10 |
| Gems | Only Normal Gem obtainable (×1.3) |
| Notable items | Assault Vest, Weakness Policy, Safety Goggles, Roseli/Kee/Maranga, Luminous Moss, Snowball, Pixie Plate, Rocky Helmet, Eviolite, Air Balloon |
| Pinch berries | Heal 1/8 at ≤ 1/2 HP (may confuse) |
| Faint replacement | End of turn; only the side(s) that lost a Pokémon choose, both at once if both fainted (§18.5) |
| Level-50 rule | `Adjust Level Down = 50` (validator only). This project writes `level: 50` into each set instead (§18.1) |

---

## 16. Recommendations and open questions

### 16.1 Minimal faithful MVP slice

Updated 2026-10-21 to match the answered questions. §18 is the spec for each item.

**Engine:**

- Use `@pkmn/sim` `Battle` in a Node (not Edge) Vercel function.
- Pin the exact version (`0.10.11`). Upgrades can change behaviour.
- One battle per room. Save `toJSON()` in the room's `battles` row after every accepted choice (§18.6), and broadcast a "something changed" event over Ably so each player refetches their own view.

**Format:**

- The project's format `[Gen 6] Picomon` (`lib/pokemon-dex.ts`): `Team Preview`, `Cancel Mod`, `Sleep Clause Mod`, `Endless Battle Clause`, `HP Percentage Mod`, plus `Picked Team Size = N` added per battle from the room's battle size (§18.1).
- Lv 50, written into each set by the server.
- Draft 6, bring 3, 4 or 6, with the Battle order screen as team preview.

**Teams:**

- The two drafted teams of 6, built from the fixed sets in `data/pokemon/` (`toSet`).
- 31 IVs unless a set says otherwise; preset natures and EVs.
- Base PP: no PP Ups (§18.2).
- Data rules, checked by hand when writing sets:
  - no `isNonstandard` species, items or moves (the loader already checks names);
  - no Mega Stones, Blue Orb or Red Orb (§5);
  - no Electric/Grassy/Misty Terrain moves (§10.2).
- OHKO, evasion-raising and self-KO moves are allowed if a set has them (§18.3).

**Mechanics:** everything the engine does, with no feature flags. The pool's content decides which abilities, items and moves appear (§12.4 and §13.4 remain useful guides).

**Server responsibilities:**

- authenticate the player (the existing room cookie);
- reject any choice with a `mega` suffix;
- call `battle.choose(side, choice)` and reject a `false` result;
- the 75-second timer, the `default` choice on timeout and the three-timeout forfeit (§18.4);
- turning the protocol into Crystal-style UI events;
- giving each player only their own view (`sideupdate` / `|split|`), never the saved snapshot.

### 16.2 Phased additions

1. **Phase 2:** more rentals (weather and hazard setters, Trick Room users), more items and abilities.
2. **Later, if wanted:** a per-turn choice log for debugging and replays (§18.6), spectators (the `spectator` stream / public log).
3. **Only if sets ever become editable:** a custom team builder with server-side `TeamValidator` and Gen 6 learnsets. Not planned: sets are fixed.
4. **Ongoing:** golden tests. Fixed seed plus fixed choices gives an expected log, using the scratch scripts' approach. Re-run them on every package upgrade.

### 16.3 Open questions (only the user can answer)

**None.** Every question was answered on 2026-10-21. The answers are in the table under §1 → Decided, and §18 turns them into spec. The project-level record is `docs/research/battle-brainstorm-open-questions.md`.

---

## 17. Custom modifications

The project changes some species (types, base stats, abilities), moves and one weather effect on top of the stock gen6 data, taken from Polished Crystal's Regular version. Only the final values are recorded. These changes win over the engine data (they are the one exception to "the npm package data is trusted as-is"). Every other value stays as Showdown has it.

How they get in: a custom Showdown mod (or `Dex.mod`-style data overrides) that inherits from `gen6` and patches only the entries below. The patch list is the single source of truth, so the Crystal UI text (move info, Pokédex screens) reads from the same patched data. See §17.6 for how to build it.

Left out (decided): every Pokémon on the wiki tables that isn't in the Gen 6 data, since we won't add species ourselves. These are Typhlosion (Hisuian), Annihilape, Sneasler, Dudunsparce, Farigiraf, Clodsire, Corsola (Galarian), Cursola, Raticate (Alolan), Raichu (Alolan), Marowak (Alolan), Slowbro (Galarian), Slowking (Galarian) and Mewtwo (Armored). The Gen 8 ability Gorilla Tactics (a Primeape option on the wiki) is left out for the same reason. Every species and ability below exists in Gen 6.

### 17.1 Types

From the "Polished" column of the type table on the Polished Crystal wiki (https://github.com/Rangi42/polishedcrystal/wiki/Pokemon-Type%2C-Evolution%2C-Ability%2C-and-Stat-Changes#polished-type-changes). These are the final types.

| Pokémon | Type |
|---|---|
| Meganium | Grass / Fairy |
| Typhlosion | Fire / Ground |
| Feraligatr | Water / Dark |
| Noctowl | Ghost / Flying |
| Butterfree | Bug / Psychic |
| Ledian | Bug / Fighting |
| Ariados | Bug / Dark |
| Dunsparce | Normal / Ground |
| Ampharos | Electric / Dragon |
| Politoed | Water / Grass |
| Bellossom | Grass / Fairy |
| Yanmega | Bug / Dragon |
| Sunflora | Grass / Fire |
| Ninetales | Fire / Ghost |
| Stantler | Normal / Psychic |
| Golduck | Water / Psychic |
| Girafarig | Psychic / Dark |
| Magmortar | Fire / Fighting |
| Electivire | Electric / Fighting |
| Octillery | Water / Fire |
| Rapidash | Fire / Fairy |
| Rhyperior | Steel / Rock |
| Mismagius | Ghost / Fairy |
| Charizard | Fire / Dragon |
| Blastoise | Water / Steel |
| Lugia | Water / Flying |
| Celebi | Grass / Fairy |

### 17.2 Base stats

From the "Polished" rows of the base stat tables on the Polished Crystal wiki (https://github.com/Rangi42/polishedcrystal/wiki/Pokemon-Type%2C-Evolution%2C-Ability%2C-and-Stat-Changes#polished-base-stat-changes). These are the final stats. Where the wiki has a dash (unchanged), the value is the stock Gen 6 one [run, `@pkmn/dex@0.10.11`]. **Bold** marks a value that differs from stock Gen 6.

| Pokémon | HP | Atk | Def | SpA | SpD | Spe | Total |
|---|---|---|---|---|---|---|---|
| Pidgeot | **93** | 80 | 75 | **90** | 70 | **102** | 510 |
| Fearow | **75** | **99** | 65 | **66** | **66** | **101** | 472 |
| Noctowl | 100 | 50 | 50 | **96** | 96 | 70 | 462 |
| Raticate | **65** | **91** | 60 | 50 | 70 | **107** | 443 |
| Furret | 85 | **86** | 64 | 45 | 55 | **108** | 443 |
| Pikachu | 35 | **65** | 40 | **60** | 50 | **95** | 345 |
| Raichu | 60 | **100** | 55 | **100** | 80 | **121** | 516 |
| Butterfree | 60 | 45 | 50 | **110** | **110** | **80** | 455 |
| Beedrill | 65 | **100** | 40 | 45 | **90** | **115** | 455 |
| Ledyba | 40 | **40** | 30 | **20** | 80 | 55 | 265 |
| Ledian | 55 | **95** | 50 | **35** | 110 | 85 | 430 |
| Ariados | 70 | 90 | 70 | 60 | **70** | **80** | 440 |
| Wigglytuff | **148** | 70 | **55** | 85 | **65** | 45 | 468 |
| Flaaffy | 70 | **60** | **60** | **85** | **65** | **50** | 390 |
| Ampharos | **95** | 75 | **90** | **125** | **95** | **65** | 545 |
| Quagsire | 95 | **95** | **95** | 65 | 65 | 35 | 450 |
| Onix | 35 | **80** | 160 | 30 | 45 | 70 | 420 |
| Steelix | 75 | **90** | 200 | 55 | 65 | 30 | 515 |
| Victreebel | 80 | **115** | 65 | **110** | 70 | 70 | 510 |
| Skiploom | **65** | 45 | 50 | 45 | 65 | 80 | 350 |
| Jumpluff | **95** | 55 | 70 | 55 | 95 | 110 | 480 |
| Parasect | 60 | **115** | **100** | 60 | 80 | 30 | 445 |
| Poliwrath | 90 | 95 | **100** | 70 | 90 | 70 | 515 |
| Politoed | 90 | 75 | **80** | 90 | 100 | **80** | 515 |
| Seaking | 80 | **102** | 65 | 65 | 80 | **88** | 480 |
| Slowbro | 95 | 75 | **120** | 100 | 80 | 30 | 500 |
| Slowking | 95 | 75 | 80 | 100 | **120** | 30 | 500 |
| Vileplume | 75 | 80 | 85 | **120** | **100** | 50 | 510 |
| Bellossom | 75 | 80 | 95 | **100** | **110** | 50 | 510 |
| Ditto | **78** | **28** | 48 | **28** | 48 | **108** | 338 |
| Sunflora | 75 | **55** | **75** | 105 | 85 | **85** | 480 |
| Sudowoodo | **75** | **115** | **130** | 30 | **80** | 30 | 460 |
| Venomoth | 70 | 65 | 60 | **115** | 75 | 90 | 475 |
| Stantler | 73 | **100** | 62 | 85 | 65 | 85 | 470 |
| Azumarill | 100 | 50 | 80 | **90** | 80 | 50 | 450 |
| Girafarig | 70 | 80 | 65 | **100** | 65 | **95** | 475 |
| Magby | **50** | 75 | 37 | 70 | 55 | 83 | 370 |
| Magmortar | 75 | 95 | 67 | 125 | 95 | **93** | 550 |
| Jynx | **70** | **60** | **40** | **120** | **100** | 95 | 485 |
| Elekid | **50** | 63 | 37 | 65 | 55 | **100** | 370 |
| Electabuzz | 65 | **88** | 57 | 95 | 85 | 105 | 495 |
| Electivire | 75 | 123 | 67 | 95 | 85 | **105** | 550 |
| Mr. Mime | **50** | 45 | 65 | 100 | **125** | **100** | 485 |
| Smeargle | 55 | 20 | 35 | 20 | 45 | **100** | 275 |
| Xatu | 65 | 75 | 70 | **100** | 70 | **100** | 480 |
| Lanturn | 125 | 58 | 58 | **86** | **86** | 67 | 480 |
| Dewgong | 90 | 70 | 80 | **80** | 95 | 70 | 485 |
| Delibird | **55** | **85** | **55** | **95** | **55** | **105** | 450 |
| Skarmory | **85** | 80 | 140 | 40 | 70 | 70 | 485 |
| Marowak | 60 | 80 | 110 | 50 | 80 | **70** | 450 |
| Rhydon | **110** | 130 | 120 | 45 | **50** | 40 | 495 |
| Rhyperior | **120** | 140 | 130 | 55 | **60** | 40 | 545 |
| Honchkrow | **105** | 125 | 52 | 105 | 52 | 71 | 510 |
| Magcargo | **60** | 50 | **135** | **115** | **115** | 30 | 505 |
| Mismagius | 60 | 60 | 60 | **110** | **110** | **110** | 510 |
| Charizard | 78 | **94** | 78 | **99** | 85 | 100 | 534 |

The Polished Crystal wiki's starting values come from later games, so for three species they differ from Gen 6. For Ariados and Magcargo the wiki has a dash on that stat, and the higher wiki value is used (decided):

- **Ariados:** SpD is a dash. Gen 6 has 60; the wiki's starting value is 70 (the Gen 7 buff). This table uses 70.
- **Magcargo:** HP is a dash. Gen 6 has 50; the wiki's starting value is 60 (the Gen 7 buff). This table uses 60.
- Noctowl's SpA also differs (Gen 6 76, wiki 86), but the wiki sets it to 96, so it doesn't matter.

### 17.3 Abilities

From the "Polished" rows of the ability tables on the Polished Crystal wiki (https://github.com/Rangi42/polishedcrystal/wiki/Pokemon-Type%2C-Evolution%2C-Ability%2C-and-Stat-Changes#polished-ability-changes). Each Pokémon used in the game gets **only one** of these abilities (decided). Which one is still to be picked per Pokémon.

| Pokémon | Ability options |
|---|---|
| Chikorita | Overgrow, Natural Cure, Leaf Guard |
| Bayleef | Overgrow, Natural Cure, Leaf Guard |
| Meganium | Overgrow, Natural Cure, Leaf Guard |
| Cyndaquil | Blaze, Flame Body, Flash Fire |
| Quilava | Blaze, Flame Body, Flash Fire |
| Typhlosion | Blaze, Flame Body, Flash Fire |
| Totodile | Torrent, Guts, Sheer Force |
| Croconaw | Torrent, Guts, Sheer Force |
| Feraligatr | Torrent, Intimidate, Sheer Force |
| Butterfree | Compound Eyes, Levitate, Tinted Lens |
| Zubat | Inner Focus, Anticipation, Infiltrator |
| Golbat | Inner Focus, Anticipation, Infiltrator |
| Crobat | Inner Focus, Anticipation, Infiltrator |
| Igglybuff | Cute Charm, Competitive, Soundproof |
| Jigglypuff | Cute Charm, Competitive, Soundproof |
| Wigglytuff | Cute Charm, Competitive, Soundproof |
| Dunsparce | Serene Grace, Run Away, Sand Stream |
| Mareep | Static, Motor Drive |
| Flaaffy | Static, Motor Drive |
| Gengar | Cursed Body, Levitate, Shadow Tag |
| Bellossom | Chlorophyll, Own Tempo |
| Yanmega | Speed Boost, Tinted Lens, Levitate |
| Magnemite | Magnet Pull, Levitate, Analytic |
| Magneton | Magnet Pull, Levitate, Analytic |
| Magnezone | Magnet Pull, Levitate, Analytic |
| Vulpix | Flash Fire, Forewarn, Drought |
| Ninetales | Flash Fire, Forewarn, Drought |
| Primeape | Anger Point, Defiant |
| Smoochum | Oblivious, Filter, Hydration |
| Jynx | Oblivious, Filter, Dry Skin |
| Shuckle | Solid Rock, Gluttony, Contrary |
| Vaporeon | Water Absorb, Drizzle, Hydration |
| Jolteon | Volt Absorb, Static, Quick Feet |
| Flareon | Flash Fire, Drought, Guts |
| Espeon | Synchronize, Magic Guard, Magic Bounce |
| Umbreon | Synchronize, Magic Guard, Inner Focus |
| Leafeon | Leaf Guard, Natural Cure, Chlorophyll |
| Glaceon | Snow Cloak, Snow Warning, Ice Body |
| Sylveon | Cute Charm, Serene Grace, Pixilate |
| Cubone | Rock Head, Cursed Body, Battle Armor |
| Kangaskhan | Early Bird, Scrappy, Parental Bond |
| Rhyhorn | Rock Head, Solid Rock, Reckless |
| Rhydon | Rock Head, Solid Rock, Reckless |
| Weavile | Pressure, Technician, Pickpocket |
| Charizard | Blaze, Solar Power, Tough Claws |
| Articuno | Pressure, Snow Warning, Snow Cloak |
| Zapdos | Pressure, Drizzle, Static |
| Moltres | Pressure, Drought, Flame Body |
| Raikou | Pressure, Inner Focus, Volt Absorb |
| Entei | Pressure, Inner Focus, Flash Fire |
| Suicune | Pressure, Inner Focus, Water Absorb |
| Dragonite | Inner Focus, Marvel Scale, Multiscale |
| Larvitar | Guts, Battle Armor, Sand Veil |
| Pupitar | Shed Skin, Battle Armor |
| Tyranitar | Sand Stream, Battle Armor, Unnerve |
| Lugia | Pressure, Drizzle, Multiscale |
| Ho-Oh | Pressure, Drought, Regenerator |
| Mew | Synchronize, Magic Guard |
| Celebi | Natural Cure, Magic Guard |

### 17.4 Moves

Taken from the **Regular** table under "Move Stat Changes" on the Polished Crystal wiki (https://github.com/Rangi42/polishedcrystal/wiki/Moves#regular). The "All Versions" table on that page is not included.

Polished Crystal's "before" values are not always the same as Gen 6. So the **Gen 6** column below is the stock gen6 value from Showdown [run, `@pkmn/dex@0.10.11`, `Dex.forGen(6)`], and the **Custom** column is what we change it to. Fields not mentioned keep their Gen 6 value.

| Move | Gen 6 (type, BP / acc / PP) | Custom change | Notes |
|---|---|---|---|
| Cut | Normal, 50 / 95 / 30 | **Steel**, BP **60**, acc **100** | |
| Fly | Flying, 90 / 95 / 15 | Acc **100** | |
| Take Down | Normal, 90 / 85 / 20 | Acc **100**, PP **15** | Keeps 1/4 recoil |
| Sing | Normal, — / 55 / 15 | Acc **75** | |
| Supersonic | Normal, — / 55 / 20 | Acc **65** | |
| Strength | Normal, 80 / 100 / 15 | **Fighting** | |
| Fire Spin | Fire, 35 / 85 / 15 | BP **40**, acc **90** | |
| Dig | Ground, 80 / 100 / 10 | BP **90** | |
| Metronome | Normal, — / never misses / 10 | Shown as **???**, PP **20** | Display only. It's a status move, so the engine type stays Normal (decided). |
| Scald | Water, 80 / 100 / 15 | BP **70** | Keeps 30% burn |
| Crabhammer | Water, 100 / 90 / 10 | Acc **95** | Polished Crystal lists only the accuracy change; BP stays at Gen 6's 100 |
| Octazooka | Water, 65 / 85 / 10 | BP **75**, acc **95**, effect chance **30%** (was 50%) | Effect is the −1 accuracy drop |
| Pain Split | Normal, — / never misses / 20 | **Ghost** | |
| Rapid Spin | Normal, 20 / 100 / 40 | PP **20** | |
| Whirlpool | Water, 35 / 85 / 15 | BP **40**, acc **90** | |

Fury Strikes (Polished Crystal's merged Fury Swipes / Fury Attack) and Hidden Power are on the Regular table but left out here: the project won't use those moves (decided).

### 17.5 Weather

Hail gives Ice-type Pokémon **1.5× Defence** while it is active, in the same way Sandstorm gives Rock types 1.5× Special Defence (§10.1). Everything else about Hail stays as Gen 6 has it: 1/16 damage per turn to non-Ice Pokémon, 5 turns (8 with Icy Rock), Blizzard never misses, Ice Body heals.

This is a custom change, not from Polished Crystal. It copies Gen 9 Snow's Defence boost onto Gen 6 Hail. The engine's `snowscape` condition already has this exact handler (`onModifyDef` at priority 10, checking `pokemon.hasType('Ice')` and `effectiveWeather()`), and it matches Sandstorm's `onModifySpD` [read, `@pkmn/sim@0.10.11` `data/conditions.ts`].

| Weather | Gen 6 | Custom change |
|---|---|---|
| Hail | 1/16 chip to non-Ice; Blizzard never misses | Also Ice-type Def ×1.5 |

As with Sandstorm, the boost is applied to the stat before other modifiers are chained. Cloud Nine and Air Lock remove it, because the engine skips every weather handler while weather is suppressed.

Verified 2026-10-21 [run]: in a Gen 6 battle on the patched mod, Mamoswine set Hail against Glaceon. Glaceon's Defence went from 130 to 195. The same battle on stock gen6 stayed at 130.

### 17.6 Implementing the overrides

We can change any Pokémon's type, base stats, ability or moves, and any weather's effect, without editing Showdown's files. We put our changes in a **custom mod**, which is a set of data in our own code layered on top of the gen6 data. Anything the mod doesn't mention keeps its gen6 value. The tables in §17.1–17.5 are the content of this mod.

#### Use `@pkmn/sim`

`@pkmn/sim`'s `Dex.mod(name, data)` takes the mod's data as a plain object, so our overrides can live in our own source files.

#### Example

```ts
import { Dex, Battle } from '@pkmn/sim';

const picomon = Dex.mod('picomon', {
  Scripts: { inherit: 'gen6' },          // start from gen6 rules and data
  Pokedex: {
    pikachu: {
      inherit: true,                      // keep every field not listed here
      types: ['Electric', 'Steel'],
      baseStats: { hp: 60, atk: 70, def: 50, spa: 70, spd: 60, spe: 110 },
      abilities: { 0: 'Lightning Rod' },
    },
  },
  Learnsets: {
    pikachu: {
      inherit: true,
      learnset: {
        ...gen6PikachuLearnset,           // the full list must be supplied, see below
        flamethrower: ['6M'],
      },
    },
  },
  Moves: {
    thunderbolt: { inherit: true, basePower: 95 },
  },
  Formats: [{ name: '[Gen 6] Picomon', mod: 'picomon', ruleset: [] }],
});

const battle = new Battle({ formatid: 'gen6picomon' }, picomon);
```

The values above are illustrations, not our changes. The real ones are in §17.1–17.4.

#### What each table changes

| Change | Table | Fields | Our data |
|---|---|---|---|
| Type, base stats, abilities | `Pokedex` | `types`, `baseStats`, `abilities` | §17.1, §17.2, §17.3 |
| Moves a Pokémon can learn | `Learnsets` | `learnset`: a map of move ID → learn sources such as `'6M'` or `'6L20'` | none yet |
| A move's power, accuracy, type, PP | `Moves` | `basePower`, `accuracy`, `type`, `pp`, `secondary`, and others | §17.4 |
| A held item's effect | `Items` | its fields and `on*` handlers | none yet |
| An ability's effect | `Abilities` | its fields and `on*` handlers | none yet |
| A weather's or status's effect | `Conditions` | `on*` handlers, with `inherit: true` to keep the rest | §17.5 |

For §17.3, `abilities` is set to just the one ability picked for that Pokémon, e.g. `{ 0: 'Natural Cure' }`. Metronome's "???" type (§17.4) is display-only, so it goes in the UI text, not the `Moves` table.

#### Gotchas

1. **A learnset is replaced, not merged.** `inherit: true` merges only the top-level fields. When Flamethrower alone was added in a test, Pikachu lost Thunderbolt and every other move. To add or remove one move, copy the existing list first. For example, read `await Dex.forGen(6).learnsets.get('pikachu')` and spread its `learnset`, as the example above does.
2. **The same applies to every nested object.** This follows from gotcha 1 but was not tested separately. `baseStats` needs all six stats even when only one changes (§17.2 lists all six for this reason). Octazooka's `secondary` must be written out in full, `{ chance: 30, boosts: { accuracy: -1 } }`, not just the new chance.
3. **Pass the custom dex to the battle.** Pass it as the second argument: `new Battle(options, picomon)`. If you leave it out, the battle quietly uses the default dex, which is the latest generation. In the test, that dex couldn't see our format, so the battle ran on Gen 9 rules with unchanged data.
4. **Keep `Scripts: { inherit: 'gen6' }`.** Without it, the mod builds on the latest-generation data instead of gen6.

#### Verification

> **Update 2026-10-20:** verified on gen6 by the prototype in [the Pokémon data design](../superpowers/specs/2026-10-20-pokemon-data-design.md) (§2). It also corrects gotcha 3: `new Battle` reads the mod from the engine's global table, and `Battle.fromJSON` ignores any dex you pass, so the format must be registered on the default Dex instead (§4.3 there).
>
> **To do: verify this against the gen6 ruleset before relying on it.** The test below ran against an older generation's data; nothing here has been run on gen6 yet. The project does not install `@pkmn/sim` yet.

What that test showed: with Pikachu set to Electric/Steel, the edited type, base stats and ability all showed in the dex. In a battle with the dex passed in, the battle reported the generation the mod inherited from, and Thunderbolt was "resisted" against the Steel-type Pikachu.

For gen6, check at least:

- `battle.gen` is 6, and the format's ruleset is the gen6 one we want (§1). The example's `ruleset: []` has no clauses; fill it in from §1.
- One patched species from each of §17.1–17.3 shows its new type, stats and ability in the dex and in battle. A Fairy type (e.g. Meganium) is a good test, since Fairy is new in Gen 6.
- One patched move from §17.4 uses its new values in battle, including Octazooka's 30% chance (gotcha 2).
- An unpatched species and move still match stock gen6 (§14.2).

---

## 18. Battle server design (decided)

This section turns the 2026-10-21 answers into spec for the battle feature. Items marked **[tested]** were run against `@pkmn/sim` 0.10.11 in the repo on 2026-10-21. Items marked **design** are proposals for the implementation spec to confirm.

### 18.1 Format, level and team size

- **Format.** Battles use the project's format `[Gen 6] Picomon` (`FORMAT_NAME` / `FORMAT_ID` in `lib/pokemon-dex.ts`). It runs on the `picomon` mod (stock gen6 plus the §17 patches) and no team validator.
- **Rules in the format:** `Team Preview`, `Cancel Mod`, `Sleep Clause Mod`, `Endless Battle Clause`, `HP Percentage Mod`.
- **Team size per battle.** The battle size lives on the room (`rooms.battle_size`: 3, 4 or 6). Add it to the format id when creating the battle:

  ```ts
  new Battle({ formatid: `${FORMAT_ID}@@@Picked Team Size = ${room.battleSize}`, seed, send });
  ```

  **[tested]** `gen6customgame@@@Picked Team Size = N` brought exactly 3, 4 and 6 Pokémon after team preview. But if the base ruleset already contains `Picked Team Size = 3`, adding a different value throws (`Rule "pickedteamsize=4" conflicts with "pickedteamsize=3"`), and adding the same value throws as "redundant".

  **Change needed:** `RULESET` in `lib/pokemon-dex.ts` currently includes `"Picked Team Size = 3"`. Remove it, so the per-battle rule is the only one.
- **Level 50.** `toSet()` already writes `level: 50` into every set. The battle reads `set.level` directly, so no validator rule is needed.
- **Teams.** Each side's team is its 6 drafted Pokémon, in draft order, as `Teams.pack(picks.map((id) => toSet(getPokemon(id))))`.
- **Team preview = Battle order screen.** When both players have set their order, the server sends `team 425…` (the first N slots in the chosen order) for each side. The engine trims each team to N, and the first one leads. The opponent's choice stays hidden until both have chosen, the same pattern as the type battle.

### 18.2 Base PP (no PP Ups)

The engine gives every move 3 PP Ups when it builds a Pokémon, and **there is no field on the set to change that**. `sim/pokemon.ts` hard-codes `const ppUps = move.noPPBoosts || move.id === 'trumpcard' ? 0 : 3`, then calls `battle.calculatePP(move, ppUps)`.

Override `calculatePP` so it returns the move's base PP. **[tested]** Patching the battle before `setPlayer`:

```ts
const battle = new Battle({ formatid, seed, send });
battle.calculatePP = (move) => move.pp;   // base PP: no PP Ups
battle.setPlayer('p1', { name, team });
battle.setPlayer('p2', { name, team });
```

- **Result:** Gengar's Sludge Bomb / Shadow Ball / Thunderbolt / Destiny Bond had max PP 16/24/24/8 stock, and **10/15/15/5** patched. The patched values survived `toJSON()` → `Battle.fromJSON()` unchanged, because PP is stored in the snapshot, so the patch is only needed when a battle is **created**.
- **Cleaner alternative (design):** put the same `calculatePP` override in the `picomon` mod's scripts. Then every battle in the format gets it with no per-battle patch. This is not tested yet; the spec should pick one and add a test asserting Sludge Bomb has 10 max PP.
- This matches what the draft and Detail screens show (`lib/draft-pool.ts` uses `move.pp`).

### 18.3 Clauses

- **In the engine:** `Sleep Clause Mod` and `Endless Battle Clause`, both in the format's ruleset (both are `Rule`s, so they act in battle; §1).
- **Not used:** Item Clause (two Pokémon on a team may hold the same item), Freeze Clause.
- **Allowed, with no clause and no check:** OHKO moves (Fissure, Guillotine, Horn Drill, Sheer Cold), evasion-raising moves (Double Team, Minimize) and self-KO moves (Explosion, Self-Destruct, Memento, Healing Wish, Lunar Dance, Final Gambit). If a Pokémon's set in `data/pokemon/` has one, it can use it (decided 2026-10-21). Don't add a loader check or validator rule for them.
- **Species Clause** is guaranteed by the draft: each Pokémon can be rented once per room.

### 18.4 Turn timer, timeouts and forfeits

**Rules (decided):**

- **75 seconds** for every choice the battle asks for: team order on the Battle order screen (confirmed 2026-10-21), each turn's move or switch, and faint replacements. The countdown is visible to both players.
- **On timeout,** the server submits the engine's own **`default`** choice for that player (decided 2026-10-21; not a random choice).
- **Three timeouts in a row** and that player **forfeits**. Choosing in time resets their count to 0.
- **Disconnects** are not handled separately. A disconnected player simply doesn't choose, so the timer covers them; refreshing restores the battle from the server.

**The timeout choice.** The server calls `battle.choose(side, 'default')`. The engine handles it in `side.choose()` (`case 'default'` → `side.autoChoose()`) and makes a fixed, predictable choice from the player's current request (§14.4):

| Request | What `default` does |
|---|---|
| `teamPreview` | `chooseTeam()` with no order: the first N Pokémon in team order (draft order), the first one leading |
| `active` (a normal turn) | `chooseMove()` with no move: the **first move that isn't disabled**. If every move is out of PP, the request only offers Struggle, so Struggle is used. It never switches. |
| `forceSwitch` | `chooseSwitch()` with no slot: the **first healthy bench Pokémon** |
| `wait` | Nothing: this player isn't being asked |

No server-side choice logic is needed. The same input always produces the same choice, which also makes timeouts easy to test.

**Forfeit.** **[tested]** `battle.forceWin('p2')` ends the battle immediately with `|win|<p2 name>` in the log and `battle.ended === true`. To forfeit p1, call `forceWin('p2')`, and vice versa.

**Enforcing the deadline (design).** Vercel functions only run while handling a request; there's no always-on process to fire a timer. So:

- When the engine issues a new request (battle start, each new turn, a forced switch), the server stores a `deadline` (now + 75 s) on the battle row.
- Every battle request (both players' GETs and choices) first checks the deadline. If it has passed, the server applies the timeout choices for whoever hasn't chosen, bumps their consecutive-timeout counts, and resolves the turn before handling the request.
- Each client's countdown reaches zero at about the same time. The client then calls the battle state route (or a small `POST …/battle/timeout`) so a request arrives promptly even if only one player is still connected.
- If neither player is connected, nothing happens until one returns. The room's normal expiry cleans the battle up.

### 18.5 Faint replacements

The engine already follows the Gen 5+ rule:

- At the end of a turn, only a side that lost its active Pokémon gets a `forceSwitch` request. The other side gets `wait`, and its screen shows "Waiting for <NAME> to choose a POKéMON...".
- If both active Pokémon fainted, both sides get `forceSwitch` and choose at the same time. Neither player sees the other's choice until both are in.
- Same 75-second timer. On timeout, `default` sends in the first healthy bench Pokémon (§18.4), and it counts toward the three-timeout forfeit.

### 18.6 Saving battles

**Decided:** one database row per battle holding the engine's latest snapshot, overwritten after every turn. No choice log for now.

- **The snapshot** is `JSON.stringify(battle.toJSON())`, about 20 KB for 3v3 (§14.3). It contains **everything**, including both teams' hidden information and the PRNG state. It never leaves the server: each player gets their own view from the engine's per-player output (`sideupdate` / `|split|`), the same way the type battle hides the opponent's pick.
- **Loading** is `Battle.fromJSON(json)`, about 0.6 ms, followed by `battle.restart(send)` to reattach the output callback. A half-submitted turn (one player has chosen) survives the round trip (§14.3).
- **Table (design):** `battles`, one row per room:

  | Column | Type | Meaning |
  |---|---|---|
  | `room_code` | text, primary key, references `rooms.code` | One battle per room |
  | `state` | text | The latest `toJSON()` snapshot |
  | `version` | integer | Bumped on every save, for the concurrency check below |
  | `deadline` | integer (unix ms), nullable | When the current choices time out (§18.4) |
  | `p1_timeouts`, `p2_timeouts` | integer, default 0 | Consecutive timeouts per player |
  | `updated_at` | integer (unix ms) | Last save |

- **Concurrent choices (design).** Both players can submit at almost the same moment. Two requests could each load version *v*, apply their own choice and save, and the second save would overwrite the first player's choice. Guard the save with the version:

  ```sql
  UPDATE battles SET state = ?, version = version + 1, … WHERE room_code = ? AND version = ?
  ```

  If no row was updated, reload and apply the choice again. Alternatively, do the load, choose and save inside one write transaction, as `joinRoom` does today. Either way, never two writers on one snapshot.
- **Cleanup.** When a room expires, delete its `battles` row along with its players, type picks and draft picks.
- **No choice log for now.** `battle.inputLog` is inside the snapshot anyway. A separate per-turn log table can be added later for debugging or replays (§16.2).

---

## Appendix: Sources and verification notes

### Verified directly this session (read from source or run)

- **2026-10-21, against `@pkmn/sim` 0.10.11 in the repo (§18):**
  - `sim/pokemon.ts` hard-codes 3 PP Ups per move. Overriding `battle.calculatePP` before `setPlayer` gives base PP (Sludge Bomb 10, not 16), and it survives `toJSON` / `fromJSON`.
  - `@@@Picked Team Size = N` brings exactly 3, 4 or 6 after team preview. It conflicts with a `Picked Team Size` already in the base ruleset.
  - `battle.forceWin(side)` ends the battle with a `|win|` line.
  - `side.autoChoose()` (the `default` choice) picks the first usable move, the first healthy bench Pokémon, or the team in its listed order. The project uses it as the timeout choice.

- **`pokemon-showdown@0.11.11`** (npm, TypeScript source included):
  - `sim/battle-actions.ts`: `getDamage`, `modifyDamage`, `getConfusionDamage`, `canMegaEvo`, `runMegaEvo`, `hitStepAccuracy`, the Gen ≤ 6 hit-step swap, multi-hit odds, `calcRecoilDamage`.
  - `sim/battle.ts`: `modify`, `chainModify`, `chain`, `finalModify`, `randomizer`, `statModify`, `comparePriority`, `speedSort`, `fieldEvent`, `getActionSpeed`, `runAction` (Pursuit faint, the Gen 7-only Mega re-sort, faint switching), `turnLoop`, `choose`, `toJSON` / `fromJSON`, the turn limit.
  - `sim/battle-queue.ts`: action `order` table, Mega action insertion.
  - `sim/pokemon.ts`: `getStat`, `calculateStat`, `getActionSpeed`, `isGrounded`.
  - `sim/side.ts`: Mega choice validation, `emitChoiceError`.
  - `sim/prng.ts`: seed formats.
  - `sim/state.ts`: serialization.
  - `sim/dex.ts`: `trunc`.
  - `sim/dex-formats.ts`: `Picked Team Size = Auto`, `EV Limit = Auto`.
  - `sim/team-validator.ts`: level adjust.
  - `data/conditions.ts`, `data/rulesets.ts`, `config/formats.ts`.
  - `data/mods/gen6/*` (all files read in full except `formats-data` and `pokedex`, which were spot-read).
  - `data/mods/gen7/rulesets.ts`, the gen7/gen8 override key lists, and `data/mods/gen5/conditions.ts` (sleep reset).
  - `LICENSE`.
- **`@pkmn/sim`, `@pkmn/dex`, `@pkmn/data` 0.10.11**: package metadata (MIT), exports, `Generations(Dex).get(6)` queries, `Battle` / `BattleStreams` / `TeamValidator` runs.
- **Runs [run]:**
  - type chart generation and diff;
  - species retype, base-stat and ability diffs;
  - the Mega list and Future/CAP flags; Mega-disabling rules (`-Mega` validator-only, Mega Rayquaza Clause Rayquaza-only);
  - terrain sources (moves and abilities);
  - the priority list;
  - the residual order;
  - the before-move order;
  - item and ability coverage scans;
  - move diffs (gen5→6);
  - ORAS-only content via `gen6xy`;
  - two damage examples (engine vs hand calculation);
  - the Mega Speed-order quirk;
  - Pursuit + Mega;
  - the sleep duration distribution;
  - custom `@@@` rules with pick 3;
  - `toJSON` / `fromJSON` size, time and determinism, including a half-submitted turn;
  - `TeamValidator` behaviour for Lv 50 and Future Megas.

### Not verified, or only partly verified

- **Behaviour versus the actual cartridge** was not checked, by decision: Showdown is the source of truth. Where this document says "Gen 7 changed X", that comes from the code's own gen branches and override comments, not from game testing.
- **Per-item and per-ability behaviour** was checked by reading handlers and by a static coverage scan. Only the mechanics listed under [run] were exercised in a battle.
- **ORAS learnset differences** (`data/mods/gen6xy/learnsets.ts`) were not diffed.
- **`gen6customgame`'s `Math.trunc`** versus the default `>>> 0` truncation: no edge-case tests were run.
- **Weather accuracy rules** (Thunder, Hurricane, Blizzard) and some long-tail move handlers were read in the base data but not executed.
- **The Gen 6 per-stat EV cap of 252** (an in-game rule from Gen 6) is not enforced in the battle engine. I did not check whether the validator enforces it; only the 510 total was confirmed (`EV Limit = Auto`).
