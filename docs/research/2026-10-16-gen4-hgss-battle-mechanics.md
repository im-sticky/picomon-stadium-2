# Gen 4 (HeartGold / SoulSilver) Battle Mechanics: Research for Picomon Stadium

- **Date:** 2026-10-16
- **Status:** Research draft. To be reviewed, then turned into an implementation spec.
- **Scope:** Singles battles only (decided). Doubles mechanics are out of scope and are not documented here.
- **Rule for the whole project:** Gen 2 (Crystal) supplies the look. Gen 4 HGSS supplies every mechanic. Never mix in Gen 2 or Gen 5+ rules.

---

## Summary

- The most authoritative source for HGSS mechanics is the **pret/pokeheartgold decompilation**. It is the reconstructed C source of the game itself. Several facts below were read directly from it: the damage function, the crit function, the accuracy table, the turn-order function, the end-of-turn state machine, and the move table. The repository has **no license**, so treat it as reference only. Do not copy code or data from it into the product.
- **Pokémon Showdown's `gen4` mod** is the best reusable implementation. It is MIT-licensed, written in TypeScript, and published on npm as `@pkmn/sim`, `@pkmn/dex` and `@pkmn/data`. Its Gen 4 damage pipeline matches the decomp in structure. It has a few small known approximations, listed in §15.
- The Gen 4 damage formula is `floor(floor(A × BP × (floor(2L/5)+2)) / D) / 50`. After that come burn, screens and weather, then **+2**, then crit (×2), then Life Orb/Metronome, then the random roll (85–100%), then STAB, then type effectiveness (one type at a time), then Expert Belt/Filter/Tinted Lens/resist berries. Every step uses integer flooring. **Gen 4 does not use the 4096-based modifiers that Gen 5+ uses.**
- Several Gen 4 numbers differ from modern games and are easy to copy by mistake:
  - crits are ×2, with a 1/16 base chance;
  - paralysis quarters Speed and fully paralyzes 25% of the time;
  - burn deals 1/8 per turn;
  - sleep lasts 1–4 turns;
  - confusion self-hits 50% of the time;
  - Steel resists Ghost and Dark;
  - Protect is +3 priority, and Fake Out and ExtremeSpeed are +1;
  - weather set by an ability lasts indefinitely;
  - binding moves last 2–5 turns and deal 1/16 per turn;
  - many move powers differ (Thunderbolt/Flamethrower/Ice Beam/Surf are 95, Tackle is 35/95%);
  - Curse is `???`-typed.
- The recommended data path is the **Showdown/`@pkmn` Gen 4 dex**. It is MIT-licensed, and it already reverts later-generation changes to move power, typing and base stats through layered mods. Use **PokéAPI** with version group `heartgold-soulsilver` to cross-check learnsets. Spot-check against the decomp move table.
- **Proposed MVP:**
  - singles, Level 50, team of 6 (or bring 3);
  - a curated pool of about 30–40 Pokémon and about 60–80 moves;
  - all major statuses, confusion and flinch;
  - stat stages, crits and accuracy;
  - STAB, the type chart, and the physical/special split;
  - a small set of items and abilities;
  - no weather, hazards or two-turn moves in v1.

---

## Table of contents

1. [Format](#1-format)
2. [Stats](#2-stats)
3. [Damage calculation](#3-damage-calculation)
4. [Type chart](#4-type-chart)
5. [Turn order](#5-turn-order)
6. [Accuracy and evasion](#6-accuracy-and-evasion)
7. [Stat stages](#7-stat-stages)
8. [Major status conditions](#8-major-status-conditions)
9. [Volatile statuses](#9-volatile-statuses)
10. [Weather and field effects](#10-weather-and-field-effects)
11. [End-of-turn order](#11-end-of-turn-order)
12. [Abilities and held items](#12-abilities-and-held-items)
13. [Moves](#13-moves)
14. [Data sources](#14-data-sources)
15. [Reference implementations](#15-reference-implementations)
16. [IP and legal note](#16-ip-and-legal-note)
17. [Recommendations](#17-recommendations)
18. [Appendix: Gen 4 vs Gen 5+ change list](#appendix-a-gen-4-vs-gen-5-change-list)
19. [Appendix: Source list and verification notes](#appendix-b-source-list-and-verification-notes)

### Source abbreviations

| Abbrev. | Source |
|---|---|
| **[decomp]** | pret/pokeheartgold, https://github.com/pret/pokeheartgold. Main files: `src/battle/overlay_12_0224E4FC.c` (damage, crit, type, turn order), `src/battle/battle_controller_player.c` (before-move checks, accuracy, end-of-turn), `src/battle/battle_command.c` (damage command, multi-hit, protect, weather residuals), `files/poketool/waza/waza_tbl.narc` (move table), `src/pokemon.c` (stats, Frontier ban list). |
| **[PS]** | Pokémon Showdown, https://github.com/smogon/pokemon-showdown. Main files: `data/mods/gen4/{scripts,conditions,moves,items,abilities}.ts`, `sim/battle-actions.ts`, `sim/battle.ts`. |
| **[Smogon-DPP]** | Smogon DPP damage formula article, https://www.smogon.com/dp/articles/damage_formula |
| **[Bulba]** | Bulbapedia, https://bulbapedia.bulbagarden.net. Cloudflare blocked automated access during this research, so Bulbapedia claims are cited from prior knowledge and marked "not re-verified". |
| **[PokéAPI]** | https://pokeapi.co. Repo: https://github.com/PokeAPI/pokeapi |

---

## 1. Format

### Decided

- **Singles (1 vs 1 active Pokémon).** The user has decided this. Doubles mechanics are out of scope: spread-move reduction, ally targeting, Helping Hand, Follow Me, doubles-only abilities, and screens at 2/3 strength in doubles.

### Options for the user to decide

| Decision | Options | Notes |
|---|---|---|
| Level | **Lv 50** / **Lv 100** / Stadium-style ranges | Lv 50 is the HGSS Battle Tower/Frontier standard and the Gen 4 official-tournament convention. Lv 100 is the Smogon "DPP OU" standard. At Lv 50, IV and EV differences matter less in absolute terms, and the numbers feel smaller, which suits the Gen 2 look. Showdown's `Flat Rules` adjust Pokémon above Lv 50 down to 50 ([PS] `data/mods/gen4/rulesets.ts`). |
| Team size | 6v6 full / **bring 6, pick 3** (Battle Tower, Stadium) / bring 6, pick 4 | Pick-3 makes battles shorter and makes team preview more meaningful. |
| Team source | Rental/preset teams / custom team builder / random battles | Rentals are the Pokémon Stadium tradition and remove the need for EV/IV tooling in the MVP. |
| Species pool | Curated pool / all 493 / Gen 1–2 species only | Gen 1–2 species fit the Gen 2 visuals (sprites). Gen 4 mechanics still apply, with Gen 4 base stats, Gen 4 movepools and Gen 4 abilities. |
| Clauses | Species Clause, Item Clause, Sleep Clause, Freeze Clause, OHKO Clause, Evasion Clause, Self-KO/Explosion rules | Pokémon Stadium used Sleep and Freeze clauses. Showdown's gen4 `Standard` ruleset is Sleep Clause Mod, Species Clause, Nickname Clause, OHKO Clause, Evasion Items Clause, Evasion Moves Clause, plus Endless Battle Clause ([PS] rulesets). The HGSS Battle Tower uses no-duplicate-species and no-duplicate-items rules. |
| Legendaries | Ban list / allow | The HGSS Frontier ban list ([decomp] `src/pokemon.c` `sBattleFrontierBanlist`) is Mewtwo, Mew, Lugia, Ho-Oh, Celebi, Kyogre, Groudon, Rayquaza, Jirachi, Deoxys, Dialga, Palkia, Giratina, Phione, Manaphy, Darkrai, Shaymin and Arceus. |
| Turn timer | none / per-turn timer | Needed for online play. This is not a game mechanic. |

### What HGSS itself uses

- **Link battles (Colosseum / Wi-Fi Club).** HGSS link rulesets are made of these fields: party count, max level, max total level, height limit, weight limit, evolved-only, ubers clause, species-duplicate clause, item-duplicate clause, and a Soul Dew/legendary clause ([decomp] `src/battle_regulation.c`, `src/overlay_03/battle_regulation_menu.c`). Specific "cups" are data-driven regulations. I did not extract the exact preset cups.
- **Battle Tower / Battle Frontier (HGSS).**
  - Singles uses 3 Pokémon. There are no duplicate species and no duplicate items.
  - The banned species are the list above.
  - Pokémon above Lv 50 are battled at Lv 50 (Bulbapedia, not re-verified).
  - Confirmed in [decomp]: **Soul Dew has no effect in Frontier battles.** The Latios/Latias SpA/SpD boost is skipped when `BATTLE_TYPE_FRONTIER` is set (in `CalcMoveDamage`).
- **Pokémon Stadium (N64), for inspiration only.** Its cups mix Lv 50–55 ranges (Poké Cup), Lv 100 (Prime Cup) and low-level cups, with bring-6-pick-3 and Sleep/Freeze clauses. Its *mechanics* are Gen 1/2 and must **not** be used.

---

## 2. Stats

### Formulas (Gen 3+ formulas, used unchanged in Gen 4)

These were confirmed in [decomp] `src/pokemon.c` (`CalcMonStats`, `ModifyStatByNature`). All division is integer division, which floors.

```
HP    = floor( (2*Base + IV + floor(EV/4)) * Level / 100 ) + Level + 10
Other = floor( ( floor( (2*Base + IV + floor(EV/4)) * Level / 100 ) + 5 ) * NatureMod )

NatureMod: boosted stat  -> floor(x * 110 / 100)
           hindered stat -> floor(x * 90 / 100)
           otherwise     -> x
Special case: Shedinja always has 1 max HP.
```

### Inputs

| Input | Meaning | Range |
|---|---|---|
| Base | Species base stat (Gen 4 values; some changed in Gen 5–7, see §14) | 1–255 |
| IV | Individual value: per-Pokémon genetic value, fixed at generation | 0–31 per stat |
| EV | Effort value: trained points. Every 4 EVs add 1 stat point at Lv 100. | 0–255 per stat, 510 total. 252 is the useful maximum per stat. |
| Level | 1–100 | Format decides (§1) |
| Nature | 25 natures. 20 raise one stat by 10% and lower another by 10%; 5 are neutral. Natures never affect HP. | — |

**Gen 4 notes:**

- The formulas are the same as Gen 3 and later generations. The *base stats* are what differ (see §14).
- Hidden Power's type and power come from IVs in Gen 4. Power is 30–70 in Gen 4, versus a fixed 60 in Gen 6+.

**MVP suggestion:** if rental teams are used, you can fix IVs at 31 and use preset EV spreads and natures. That keeps the formula without needing a team builder.

---

## 3. Damage calculation

### 3.1 The physical/special split

Gen 4 introduced the per-move split. Each move has its own category: Physical (uses Atk vs Def), Special (uses SpA vs SpD) or Status. The category comes from the move's data, not from its type.

- Examples: Fire Punch is Physical. Shadow Ball is Special. Ice Shard is Physical.
- **Gen 2/3 categorized by type. Never use type-based categories.** [decomp] move table byte `category`.

### 3.2 Exact order, from the HGSS decompilation

This is `CalcMoveDamage` → `DamageCalcDefault` → `ApplyDamageRange` → `ov12_02251D28` in [decomp]. Every `*` and `/` is integer arithmetic: multiply first, then floor-divide (written as `x*15/10`). A "×1.5" therefore means `x*15/10` or `x*150/100`, floored at that step.

```
// ---------- Step A: modified base power (each line floored) ----------
power = move.basePower                       // or variable-power callback
if Charge active && type==Electric:          power *= 2
if user ability Technician && power <= 60:   power = power*15/10   (not Struggle)
if user item = type plate/boost item matching type: power = power*(100+20)/100
                                             // Charcoal, Mystic Water, plates, incenses: 20 in Gen 4
if Choice Band:   Atk = Atk*150/100;   if Choice Specs: SpA = SpA*150/100
if Light Ball && Pikachu:                    power *= 2   (Gen 4 doubles POWER, phys+spec)
if Thick Club && Cubone/Marowak:             Atk *= 2
if Huge Power / Pure Power:                  Atk *= 2
if Muscle Band && physical:                  power = power*110/100
if Wise Glasses && special:                  power = power*110/100
if target Thick Fat && type in {Fire, Ice}:  power /= 2
if user Hustle:                              Atk = Atk*150/100
if user Guts && user has any status:         Atk = Atk*150/100
if target Marvel Scale && target statused:   Def = Def*150/100
if Mud Sport && Electric / Water Sport && Fire: power /= 2
if Overgrow/Blaze/Torrent/Swarm, matching type, HP <= maxHP/3: power = power*150/100
if target Heatproof && Fire:                 power /= 2
if target Dry Skin && Fire:                  power = power*125/100
if Rivalry: same gender power*125/100, opposite gender power*75/100
if Iron Fist && punching move:               power = power*12/10
if weather active (no Cloud Nine/Air Lock):
    sun && Solar Power:                      SpA = SpA*15/10
    sandstorm && target is Rock:             SpD = SpD*15/10
    sun && Flower Gift (attacker side):      Atk = Atk*15/10
    sun && Flower Gift (target side):        SpD = SpD*15/10
if move is Explosion/Selfdestruct:           Def /= 2         // Gen 5+ removed this

// ---------- Step B: stat stages ----------
A = floor(stat * stageNum / stageDen)        // table in §7
D = floor(stat * stageNum / stageDen)
On a CRIT: ignore the attacker's NEGATIVE offensive stage and the
           defender's POSITIVE defensive stage.
Simple doubles stages (clamped to ±6). Unaware zeroes the opponent's stages.

// ---------- Step C: base damage ----------
dmg = A * power * (floor(2*Level/5) + 2)
dmg = floor(dmg / D)
dmg = floor(dmg / 50)

// ---------- Step D: "Mod1" (before +2) ----------
if burned && physical && !Guts:               dmg /= 2
if Reflect (physical) / Light Screen (special) on target side
     && !crit && move is not Brick Break:     dmg /= 2        // singles
if weather (no Cloud Nine/Air Lock):
    rain: Fire dmg/2, Water dmg*15/10
    rain/sand/hail && Solar Beam:             dmg /= 2
    sun:  Fire dmg*15/10, Water dmg/2
if Flash Fire activated && Fire:              dmg = dmg*15/10
dmg = dmg + 2

// ---------- Step E: crit and "Mod2" ----------
dmg = dmg * critMult                          // 1, 2, or 3 (Sniper)
if Life Orb:      dmg = dmg*130/100
if Metronome (item): dmg = dmg*(10 + consecutiveUses)/10     // up to x2
if Me First:      dmg = dmg*15/10

// ---------- Step F: random roll ----------
if dmg > 0:
    dmg = dmg * (100 - (rand() % 16)) / 100   // 85..100 inclusive, uniform 16 values
    if dmg == 0: dmg = 1

// ---------- Step G: STAB, type, "Mod3" ----------
(Struggle skips this whole step: no STAB, no type effectiveness.)
if move type matches either user type:
    dmg = Adaptability ? dmg*2 : dmg*15/10
for each matching entry in the type table (target type1, then type2 if different):
    super effective: dmg = dmg*20/10 ; not very effective: dmg = dmg*5/10 (min 1)
    immune: move has no effect
if super effective:
    if target Filter/Solid Rock:  dmg = dmg*3/4  (min 1)
    if Expert Belt:               dmg = dmg*120/100
if not very effective && Tinted Lens: dmg *= 2
resist berries (Occa etc.): x0.5 on super-effective hits (Chilan: Normal)   // see note
final: if dmg == 0 and not immune -> 1
```

**Notes:**

- **Order of ÷D and ÷50.** The [decomp] divides by Defense first, then by 50. [Smogon-DPP] writes ÷50 before ÷Def. **The decomp is authoritative.** [PS] `sim/battle-actions.ts#getDamage` also divides by Defense first. The two orders can differ by 1 point in rare cases.
- **Resist berries.** I did not find the resist-berry application point in the decomp files I read. [Smogon-DPP] lists them in Mod3. [PS] applies them in the final `ModifyDamage` stage (`data/mods/gen4/items.ts`, e.g. `chopleberry`). Both put them after type effectiveness.
- **Metal Powder (Ditto).** The [decomp] doubles Defense, but [Smogon-DPP] says ×1.5. Unresolved. This is irrelevant unless Ditto is in the pool.
- **Minimum damage.**
  - The random step sets 0 to 1.
  - Each type-effectiveness halving uses `DamageDivide`, which floors but never goes below 1 ([decomp]).
  - A non-immune hit always deals at least 1.
- **Random factor confirmed.** The roll is `100 - (rand % 16)`, giving 85–100 inclusive. That is 16 equally likely integer values, divided by 100 ([decomp] `ApplyDamageRange`). Showdown matches: `tr(tr(baseDamage * (100 - this.random(16))) / 100)` ([PS] `sim/battle.ts#randomizer`).

### 3.3 Critical hits

From [decomp] `TryCriticalHit`:

```
critStage = (FocusEnergy ? 2 : 0)
          + (Scope Lens or Razor Claw ? 1 : 0)
          + (move has high-crit flag ? 1 : 0)       // Slash, Stone Edge, Cross Chop...
          + (Super Luck ? 1 : 0)
          + (Lucky Punch && Chansey ? 2 : 0)
          + (Stick && Farfetch'd ? 2 : 0)
critStage = min(critStage, 4)
crit if rand() % [16, 8, 4, 3, 2][critStage] == 0
blocked by Battle Armor, Shell Armor, Lucky Chant
multiplier: x2 (Sniper: x3)
```

| Stage | 0 | +1 | +2 | +3 | +4 |
|---|---|---|---|---|---|
| Gen 4 chance | 1/16 | 1/8 | 1/4 | 1/3 | 1/2 |
| Gen 6 (do not use) | 1/16 | 1/8 | 1/2 | 1 | 1 |
| Gen 7+ (do not use) | 1/24 | 1/8 | 1/2 | 1 | 1 |

Crits:

- ignore the attacker's negative Atk/SpA stages;
- ignore the defender's positive Def/SpD stages;
- ignore Reflect and Light Screen.

The multiplier is **×2 in Gen 4**, and ×1.5 from Gen 6 onward.

### 3.4 Worked example (HGSS formula, Lv 50)

Garchomp (Lv 50, Adamant, 31 IV / 252 EV Atk) uses **Earthquake** on Tyranitar (Lv 50, neutral nature, 31 IV / 0 EV Def, 31 IV / 252 EV HP). There is no weather, no items and no stat stages.

1. **Stats.**
   - Garchomp's base Atk is 130, so Atk = floor((floor((260+31+63)×50/100)+5) × 110/100) = floor((177+5)×1.1) = **200**.
   - Tyranitar's base Def is 110, so Def = floor((220+31+0)×50/100)+5 = 125+5 = **130**.
   - Tyranitar's base HP is 100, so HP = floor((200+31+63)×50/100)+50+10 = **207**.
2. **Base damage.**
   - floor(2×50/5)+2 = **22**.
   - 200 × 100 × 22 = 440,000. ÷ 130 = **3,384**. ÷ 50 = **67**.
3. **Mod1:** none. Then +2 = **69**.
4. **Crit:** no (×1). **Mod2:** none.
5. **Random roll.** The minimum is 69 × 85 / 100 = **58**. The maximum is 69 × 100 / 100 = **69**.
6. **STAB** (Garchomp is Dragon/Ground):
   - minimum: 58 × 15 / 10 = **87**;
   - maximum: 69 × 15 / 10 = **103**.
7. **Type.** Ground is ×2 vs Rock and ×1 vs Dark, so the minimum is **174** and the maximum is **206**.
8. **All 16 rolls:** 174, 176, 180, 180, 182, 186, 186, 188, 192, 192, 194, 198, 198, 200, 204, 206.
   - Tyranitar has 207 HP, so the best roll leaves it at 1 HP. This is a guaranteed 2HKO.
   - On a **crit** (×2 after the +2), the range is **350–414**, which is a guaranteed OHKO.

All numbers above were computed with a script that follows the decomp's integer steps.

---

## 4. Type chart

There are 17 types and no Fairy. The table below was generated from the [decomp] `sTypeEffectiveness` table in `overlay_12_0224E4FC.c`. Rows are the attacking type and columns the defending type. A blank cell means ×1.

| Atk \ Def | Nor | Fir | Wat | Ele | Gra | Ice | Fig | Poi | Gro | Fly | Psy | Bug | Roc | Gho | Dra | Dar | Ste |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Normal** |  |  |  |  |  |  |  |  |  |  |  |  | ½ | 0 |  |  | ½ |
| **Fire** |  | ½ | ½ |  | 2 | 2 |  |  |  |  |  | 2 | ½ |  | ½ |  | 2 |
| **Water** |  | 2 | ½ |  | ½ |  |  |  | 2 |  |  |  | 2 |  | ½ |  |  |
| **Electric** |  |  | 2 | ½ | ½ |  |  |  | 0 | 2 |  |  |  |  | ½ |  |  |
| **Grass** |  | ½ | 2 |  | ½ |  |  | ½ | 2 | ½ |  | ½ | 2 |  | ½ |  | ½ |
| **Ice** |  | ½ | ½ |  | 2 | ½ |  |  | 2 | 2 |  |  |  |  | 2 |  | ½ |
| **Fighting** | 2 |  |  |  |  | 2 |  | ½ |  | ½ | ½ | ½ | 2 | 0 |  | 2 | 2 |
| **Poison** |  |  |  |  | 2 |  |  | ½ | ½ |  |  |  | ½ | ½ |  |  | 0 |
| **Ground** |  | 2 |  | 2 | ½ |  |  | 2 |  | 0 |  | ½ | 2 |  |  |  | 2 |
| **Flying** |  |  |  | ½ | 2 |  | 2 |  |  |  |  | 2 | ½ |  |  |  | ½ |
| **Psychic** |  |  |  |  |  |  | 2 | 2 |  |  | ½ |  |  |  |  | 0 | ½ |
| **Bug** |  | ½ |  |  | 2 |  | ½ | ½ |  | ½ | 2 |  |  | ½ |  | 2 | ½ |
| **Rock** |  | 2 |  |  |  | 2 | ½ |  | ½ | 2 |  | 2 |  |  |  |  | ½ |
| **Ghost** | 0 |  |  |  |  |  |  |  |  |  | 2 |  |  | 2 |  | ½ | ½ |
| **Dragon** |  |  |  |  |  |  |  |  |  |  |  |  |  |  | 2 |  | ½ |
| **Dark** |  |  |  |  |  |  | ½ |  |  |  | 2 |  |  | 2 |  | ½ | ½ |
| **Steel** |  | ½ | ½ | ½ |  | 2 |  |  |  |  |  |  | 2 |  |  |  | ½ |

### Differences from Gen 6+ (do not copy modern charts)

- **Steel resists Ghost (½) and Dark (½)** in Gen 2–5. Gen 6 made both neutral.
- **There is no Fairy type.** Species that became Fairy in Gen 6 have their old typings: Clefable is pure Normal; Togekiss is Normal/Flying; Gardevoir is pure Psychic; Mr. Mime is pure Psychic; Azumarill is pure Water; Granbull is pure Normal; Mawile is pure Steel; Snubbull, Jigglypuff and Wigglytuff are Normal. PokéAPI exposes these as `past_types`, as shown for Clefable in §14.
- Moves that became Fairy-type later are Normal-type in Gen 4: Charm, Sweet Kiss and Moonlight.

### Gen 4 specifics, from [decomp]

- **Foresight, Odor Sleuth and Scrappy.** The Normal→Ghost and Fighting→Ghost immunities sit after a `TYPE_FORESIGHT` sentinel in the table. These effects skip those entries, so the moves hit Ghosts at ×1.
- **Miracle Eye** removes Dark's immunity to Psychic.
- **Grounded Flying types lose their Ground immunity.** This happens under Iron Ball, Ingrain or Gravity. Roost removes the Flying type for the turn.
- **Levitate and Magnet Rise** give Ground immunity, except when Iron Ball is held.
- Effectiveness is applied as **separate ×2/×½ steps per defending type**, each one floored. There is no single combined ×4 or ×¼ multiplier.
- **Gen 4 has no Electric immunity to paralysis**. Electric types gained that immunity in Gen 6. Thunder Wave *does* respect Ground's type immunity: the decomp runs type checks for `MOVE_THUNDER_WAVE`.
- **Sheer Cold hits Ice types in Gen 4.** Ice-type immunity to it arrived in Gen 7.

---

## 5. Turn order

Each turn proceeds in this order:

1. **Choose actions.** Each player picks a move or a switch. Actions are locked once both are in.
2. **Switches, then moves.** Switches (and item use and running, which are not relevant here) resolve before any move. If both players switch, the faster Pokémon switches first.
   - **Pursuit exception.** If one player switches out and the other chose Pursuit, Pursuit hits the outgoing Pokémon *before* the switch, at doubled power (40 → 80).
3. **Moves** are ordered as described below.
4. **End-of-turn residuals** run (§11).
5. **Fainted Pokémon are replaced.** In Gen 4 singles, replacements come in at end of turn, after residuals, and both players choose at the same time. U-turn switches happen mid-turn, immediately after the hit.

### Move ordering, from [decomp] (the speed comparison function around lines 1000–1230)

These rules are checked in sequence:

1. **Higher move priority goes first.**
2. Within the same priority:
   1. **Quick Claw / Custap Berry** activations go first. If both activate, the faster goes first.
   2. **Lagging Tail / Full Incense** holders go last. If both hold one, the slower goes first.
   3. **Stall** (ability) users go last.
   4. Under **Trick Room**, the slower goes first. Otherwise the faster goes first.
   5. **Exact speed ties are a 50/50 coin flip.**
   - Note: the decomp applies the Trick Room reversal only in the plain-speed branch, not to the Quick Claw, Lagging Tail or Stall tie-breaks.
3. **Turn order is fixed at the start of the turn.** Speed changes during a turn do not reorder that turn. Gen 8 introduced dynamic reordering; do not use it.

### Priority brackets in HGSS

Values come from the [decomp] move table (`waza_tbl.narc`, parsed for this research). Doubles-only moves are omitted.

| Priority | Moves (singles-relevant) | Gen 5+ change to watch |
|---|---|---|
| +4 | Magic Coat, Snatch | — |
| +3 | **Protect, Detect, Endure** | These became +4 in Gen 5. |
| +2 | Feint | — |
| +1 | Quick Attack, Mach Punch, **ExtremeSpeed**, **Fake Out**, Bullet Punch, Aqua Jet, Ice Shard, Shadow Sneak, Vacuum Wave, Sucker Punch, Bide | ExtremeSpeed became +2 in Gen 5. Fake Out became +3 in Gen 5. |
| 0 | Almost everything else | — |
| −1 | Vital Throw | — |
| −3 | Focus Punch | — |
| −4 | Revenge, Avalanche | — |
| −5 | Counter, Mirror Coat | — |
| −6 | Roar, Whirlwind | — |
| −7 | Trick Room | — |

### Effective speed (Gen 4 order of modifiers, from [decomp])

```
speed = floor(Speed * stageNum / stageDen)          // stage table §7 (Simple doubles the stage)
if Swift Swim && rain  or  Chlorophyll && sun:   speed *= 2
if Iron Ball / Macho Brace / Power items:        speed /= 2
if Choice Scarf:                                  speed = speed*15/10
if Quick Powder && Ditto:                         speed *= 2
if Quick Feet && statused:                        speed = speed*15/10
else if paralyzed:                                speed /= 4        // Gen 7+: /2
if Slow Start (first 5 turns):                    speed /= 2
if Unburden && item consumed:                     speed *= 2
if Tailwind on side:                              speed *= 2
```

- **Quick Claw** activates 20% of the time: `rand % (100/20) == 0`, with one roll per battler per turn.
- **Custap Berry** activates at ≤ 1/4 HP, or ≤ 1/2 HP with Gluttony.

---

## 6. Accuracy and evasion

The Gen 4 formula comes from [decomp] `BattleSystem_CheckMoveHit`. Gen 4 **combines** the accuracy and evasion stages into one value and looks up a single table.

```
if move.accuracy == 0 (data "--"): never misses (Swift, Aerial Ace, self-target moves)
stage = clamp(userAccStage - targetEvaStage, -6, +6)
   (Simple doubles each; Unaware ignores the other's; Foresight/Miracle Eye ignore positive target evasion)
p = move.accuracy
if sun && Thunder: p = 50
p = floor(p * tableNum / tableDen)
p = floor(p * 130/100)   if Compound Eyes
p = floor(p * 80/100)    if target Sand Veil in sand / Snow Cloak in hail
p = floor(p * 80/100)    if user Hustle and move is physical
p = floor(p * 50/100)    if target Tangled Feet and confused
p = floor(p * (100-10)/100) if target holds BrightPowder / Lax Incense
p = floor(p * 110/100)   if user holds Wide Lens
p = floor(p * 120/100)   if user's Zoom Lens condition holds (moving after target)
p = floor(p * 120/100)   if user's Micle Berry activated
p = floor(p * 10/6)      if Gravity
miss if (rand() % 100) + 1 > p
```

Other accuracy rules:

- **Rain makes Thunder never miss.** This is a separate always-hit check.
- **No Guard** and **Lock-On / Mind Reader** make moves always hit.
- **Semi-invulnerable** targets (Fly, Dig, Dive, Bounce, Shadow Force) are missed by most moves.

| Combined stage | −6 | −5 | −4 | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +4 | +5 | +6 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HGSS multiplier | 33/100 | 36/100 | 43/100 | 50/100 | 60/100 | 75/100 | 1 | 133/100 | 166/100 | 2 | 233/100 | 266/100 | 3 |

**Caveat: Showdown approximates this.** [PS] `data/mods/gen4/scripts.ts#hitStepAccuracy` applies the accuracy and evasion stages *separately*, using `[1, 4/3, 5/3, 2, 7/3, 8/3, 3]`. The two approaches differ in three ways:

- Showdown does not clamp the combined stage.
- It uses exact thirds rather than the game's rounded percentages. For example, at −5 it uses 0.375 where HGSS uses 0.36.
- It compares against a float random number rather than `rand%100 + 1`.

If exact fidelity matters, implement the decomp table.

**OHKO moves** (Fissure, Guillotine, Horn Drill, Sheer Cold) work differently:

- accuracy = `30 + (userLevel − targetLevel)`;
- they fail if the target is a higher level;
- they ignore accuracy and evasion stages;
- Sturdy makes the target immune.

Sources: [PS] gen4 `hitStepAccuracy`; [decomp] `battle_command.c` ~2631.

---

## 7. Stat stages

Stat stages apply to Atk, Def, SpA, SpD and Spe ([decomp] `sStatChangeTable`):

| Stage | −6 | −5 | −4 | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +4 | +5 | +6 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Multiplier | 2/8 | 2/7 | 2/6 | 2/5 | 2/4 | 2/3 | 2/2 | 3/2 | 4/2 | 5/2 | 6/2 | 7/2 | 8/2 |
| Decimal | 0.25 | 0.286 | 0.333 | 0.40 | 0.50 | 0.667 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 |

- The decomp stores these as `{10,40}…{40,10}`, which give the same values.
- Accuracy and evasion use the table in §6.
- Stages reset when the Pokémon switches out, unless Baton Pass is used.
- Simple doubles stage changes (Gen 4: doubles the *effective* stage at use, clamped to ±6).
- Crits ignore the unfavourable stages (§3.3).

---

## 8. Major status conditions

A Pokémon can have only one major status at a time. Values below are from [decomp] (`battle_controller_player.c` before-move checks and end-of-turn checks), and from [PS] `data/mods/gen4/conditions.ts` where noted.

| Status | Gen 4 behaviour | Immunities | Changed later (do not use) |
|---|---|---|---|
| **Sleep** | Lasts **1–4 turns**. The decomp sets a counter of `rand%4 + 2` (2–5). Each attempt to move lowers it by 1 (by 2 with Early Bird). The Pokémon wakes when it reaches 0, and **acts on the waking turn**. **Switching does not reset the counter in Gen 4.** **Rest** sleeps the user for exactly 2 turns. Sleep Talk and Snore work while asleep. | Insomnia, Vital Spirit, Leaf Guard in sun, Uproar on field, Safeguard | Gen 5: 1–3 turns. Gen 5 (BW only) reset the counter on switch-in (Bulba, not re-verified). |
| **Poison** | Deals **1/8 max HP** at end of turn. Poison Heal instead heals 1/8. | Poison and Steel types, Immunity, Safeguard | — |
| **Bad poison (Toxic)** | Deals **N/16 max HP** at end of turn, where N goes 1, 2, 3… and is capped at 15. **The counter resets to 1 when the Pokémon switches out**, but it stays badly poisoned. | As poison | — |
| **Burn** | Deals **1/8 max HP** at end of turn (1/16 with Heatproof). **Halves physical damage** (§3.2 Mod1) unless the Pokémon has Guts. | Fire types, Water Veil, Safeguard | Gen 7: 1/16 per turn. |
| **Paralysis** | **25% chance to be fully paralyzed** each turn (`rand%4 == 0`). **Speed is quartered** (Quick Feet instead gives ×1.5). | Limber, Safeguard. Ground types are immune to Thunder Wave only (type immunity). **Electric types are not immune in Gen 4.** | Gen 7: Speed is halved instead. Gen 6: Electric types became immune. |
| **Freeze** | At each move attempt there is a **20% thaw chance** (`rand%5 == 0`); otherwise the Pokémon can't move. The user thaws itself with **Flame Wheel, Sacred Fire or Flare Blitz**. Being hit by a **damaging Fire-type move** also thaws it. A Pokémon cannot be frozen in sun. | Ice types, Magma Armor, Safeguard | Scald and similar moves are Gen 5+ (they don't exist yet). |

### Before-move check order (HGSS)

From [decomp] `battle_controller_player.c` ~2110–2320, the checks run in this order:

1. sleep (and Uproar wake-up)
2. freeze
3. Truant
4. recharge (Hyper Beam)
5. flinch
6. Disable
7. Taunt
8. Imprison
9. Gravity
10. Heal Block
11. **confusion**
12. **paralysis**
13. **attraction**
14. Bide

---

## 9. Volatile statuses

Volatile statuses are cleared when the Pokémon switches out, unless Baton Pass passes them.

| Volatile | Gen 4 behaviour | Source and notes |
|---|---|---|
| **Confusion** | Lasts **1–4 turns**: the decomp sets a counter of `rand%4 + 2` and decrements it before each move. Each turn there is a **50% chance** (`rand & 1`) to hit itself instead of moving. The self-hit is a **40 BP typeless physical** hit using the Pokémon's own Atk and Def, with no crit, no STAB, and the random roll applied. Own Tempo prevents it. | [decomp]. Gen 7 changed the self-hit chance to 33%. |
| **Flinch** | Only works if the attacker moves first. The flinched target skips its move this turn. Inner Focus prevents it. Steadfast gives +1 Spe on flinch. King's Rock and Razor Fang add a 10% flinch chance. | — |
| **Attraction (Attract, Cute Charm)** | Only works between opposite genders. While attracted, **50%** chance (`rand & 1`) to be immobilized. Ends when either Pokémon leaves the field. Oblivious prevents it. Mental Herb cures it. | [decomp] |
| **Leech Seed** | Drains **1/8 max HP** at end of turn to the Pokémon in the seeder's slot. Grass types are immune. Rapid Spin removes it. Magic Guard blocks the damage. | — |
| **Binding (Wrap, Bind, Fire Spin, Whirlpool, Sand Tomb, Clamp, Magma Storm)** | The counter is `rand%4 + 3` (3–6), decremented at end of turn, so it deals **2–5 turns of 1/16 max HP**. With **Grip Claw** it lasts the maximum, 5 turns. It prevents switching (Shed Shell escapes) and ends if the user leaves. Rapid Spin frees the target. **Ghost types are not immune to trapping in Gen 4.** | [decomp]. Gen 5 changed the duration to 4–5 turns, and Gen 6 the damage to 1/8. |
| **Taunt** | Status moves fail for **3–5 turns**. | [PS] gen4 `random(3,6)`. Gen 5: 3 turns. |
| **Encore** | Locks the target into its last move for **4–8 turns**. | [PS] gen4 `random(4,9)`. The decomp counter is `rand%5+3`, which is the same range under a different counting convention. Gen 5: 3 turns. |
| **Disable** | Disables the target's last move for **4–7 turns**. | [PS] gen4 `random(4,8)`. The decomp counter is `rand%4+3`. Gen 5: 4 turns. |
| **Substitute** | Costs `floor(maxHP/4)` HP and fails if the user's HP ≤ that cost. The substitute takes damage and blocks most status moves and stat drops. **Sound moves do not bypass it in Gen 4.** Multi-hit moves stop when it breaks. | Gen 6: sound moves bypass. |
| **Protect / Detect** | Success chance on consecutive uses: 1, then 1/2, 1/4, 1/8, staying at 1/8 (table `{65535, 32767, 16383, 8191}`). Endure shares the counter. | [decomp] `sProtectSuccessChance`; [PS] gen4 `stall.counterMax: 8`. Gen 5+ is ×1/3 per use. |
| **Yawn** | The target falls asleep at the end of the *next* turn. | — |
| **Perish Song** | Every Pokémon on the field faints after 3 turns unless it switches out. | — |
| **Curse (Ghost user)** | The user loses 1/2 max HP. The target loses **1/4 max HP** each turn. | Curse is `???`-typed in Gen 4 and Ghost-typed in Gen 5+. |
| **Nightmare** | A sleeping target loses 1/4 max HP each turn. | — |
| **Ingrain / Aqua Ring** | Heals 1/16 max HP each turn. Ingrain also traps the user and grounds it. | — |
| **Focus Energy** | +2 crit stage. | [decomp] |
| **Recharge** | After Hyper Beam, Giga Impact, Blast Burn and similar moves, the user must skip its next turn (unless the move missed). | — |
| **Choice lock** | Locked to the first move used. The lock clears on switch-out. | [PS] gen4 `choicelock` |
| Magnet Rise / Embargo / Heal Block | 5 turns each. | — |
| Mean Look / Block / Spider Web | Trap until the user leaves. | — |

---

## 10. Weather and field effects

### Weather

Values are from [decomp] `BtlCmd_EndOfTurnWeatherEffect`, `CalcMoveDamage` and `BattleSystem_CheckMoveHit`.

| | Rain | Sun | Sandstorm | Hail |
|---|---|---|---|---|
| Set by move | Rain Dance | Sunny Day | Sandstorm | Hail |
| Duration (move) | 5 turns; 8 with Damp Rock | 5; 8 with Heat Rock | 5; 8 with Smooth Rock | 5; 8 with Icy Rock |
| Set by ability | Drizzle (**indefinite in Gen 4**) | Drought (indefinite) | Sand Stream (indefinite) | Snow Warning (indefinite) |
| Damage effect | Water ×1.5, Fire ×0.5 | Fire ×1.5, Water ×0.5 | — | — |
| End-of-turn | Rain Dish +1/16; Dry Skin +1/8; Hydration cures status | Dry Skin and Solar Power −1/8 | **−1/16** to all except Rock/Ground/Steel types and Sand Veil | **−1/16** to all except Ice types and Snow Cloak; Ice Body +1/16 |
| Other | Thunder never misses; Solar Beam power halved; Swift Swim ×2 Speed | Thunder accuracy 50; Solar Beam needs no charge turn; no freezing; Chlorophyll ×2 Speed; Solar Power ×1.5 SpA; Flower Gift ×1.5 Atk/SpD | **Rock types get ×1.5 SpD** (new in Gen 4); Sand Veil ×0.8 to opponents' accuracy; Solar Beam halved | Blizzard does **not** auto-hit in Gen 4 (that was added in Gen 5); Snow Cloak ×0.8 accuracy; Solar Beam halved |

- Cloud Nine and Air Lock suppress weather effects while on the field.
- Gen 6 limited ability-set weather to 5 turns. In Gen 4 it lasts until replaced.

### Entry hazards (Gen 4)

| Hazard | Effect | Notes |
|---|---|---|
| Spikes | On switch-in, grounded Pokémon lose 1/8, 1/6 or 1/4 max HP for 1, 2 or 3 layers. | Flying types and Levitate users are immune. |
| Toxic Spikes | On switch-in, grounded Pokémon are poisoned (1 layer) or badly poisoned (2 layers). | A grounded Poison type that switches in absorbs (removes) them. Steel, Flying and Levitate are immune. |
| Stealth Rock | On switch-in, damage = max HP × (1/8 × Rock-type effectiveness vs the target). That is 1/32, 1/16, 1/8, 1/4 or 1/2. | Hits Flying types too. |

- Rapid Spin removes hazards from the user's side, along with Leech Seed and binding.
- Defog in Gen 4 lowers the target's evasion and clears the *target's* side of hazards, Reflect, Light Screen, Safeguard and Mist.
- Magic Guard ignores hazard damage.

### Side and field conditions

| Condition | Duration | Effect (singles) |
|---|---|---|
| Reflect | 5 turns (8 with Light Clay) | Halves physical damage. Crits ignore it. Brick Break removes it. |
| Light Screen | 5 turns (8 with Light Clay) | Halves special damage. Crits ignore it. |
| Safeguard | 5 turns | Prevents major status and confusion on that side. |
| Mist | 5 turns | Prevents stat drops caused by the opponent. |
| Tailwind | **3 turns, counting the turn used** | Doubles the side's Speed. [PS] gen4 `duration: 3`. Gen 5 made it 4. |
| Lucky Chant | 5 turns | Prevents crits against that side. |
| Gravity | 5 turns | Accuracy ×10/6. Grounds everything. Some moves (e.g. Fly) can't be used. |
| Trick Room | 5 turns | Slower Pokémon move first within a priority bracket. |
| Wish | Heals at the end of the next turn | Restores 1/2 of the *user's* max HP to whoever is in the slot. |
| Future Sight / Doom Desire | Hits 2 turns later | Typeless in Gen 4: the damage is computed at use and has no type effectiveness. |

---

## 11. End-of-turn order

Authoritative source: [decomp] `battle_controller_player.c`. That file defines `UpdateFieldCondition`, then `UpdateMonCondition` (run once per active Pokémon, in turn order), then `UpdateFieldConditionExtra`.

**Key Gen 4 property:** the per-Pokémon block runs **all** effects for the first Pokémon (in turn order) before **any** effect for the second. Gen 5+ instead runs each effect across all Pokémon before moving to the next effect. [PS] reproduces the Gen 4 grouping by giving these effects the same `onResidualOrder: 10` with different sub-orders, and sorting by speed before sub-order.

| # | Phase | Effect | Amount |
|---|---|---|---|
| 1 | Field | Reflect countdown / end | — |
| 2 | Field | Light Screen countdown / end | — |
| 3 | Field | Mist countdown / end | — |
| 4 | Field | Safeguard countdown / end | — |
| 5 | Field | Tailwind countdown / end | — |
| 6 | Field | Lucky Chant countdown / end | — |
| 7 | Field | Wish heals | 1/2 of the Wish user's max HP |
| 8 | Field | **Weather** continues or ends. Per Pokémon: sandstorm/hail damage, Dry Skin/Solar Power sun damage, Rain Dish, Dry Skin rain heal, Ice Body, Hydration | 1/16, 1/8, 1/16, 1/8, 1/16 |
| 9 | Field | Gravity countdown / end | — |
| 10 | Per Pokémon | Ingrain | +1/16 |
| 11 | Per Pokémon | Aqua Ring | +1/16 |
| 12 | Per Pokémon | Ability residuals: Speed Boost (+1 Spe), Shed Skin (30% cure, `rand%10 < 3`) | — |
| 13 | Per Pokémon | Held item residual (e.g. status-cure berries) | — |
| 14 | Per Pokémon | Leftovers / Black Sludge | +1/16 (Black Sludge damages non-Poison types 1/8) |
| 15 | Per Pokémon | Leech Seed | −1/8 to the seeded Pokémon, +same to the seeder |
| 16 | Per Pokémon | Poison (or Poison Heal) | −1/8 (or +1/8) |
| 17 | Per Pokémon | Bad poison | −N/16 |
| 18 | Per Pokémon | Burn | −1/8 (Heatproof: −1/16) |
| 19 | Per Pokémon | Nightmare | −1/4 |
| 20 | Per Pokémon | Curse (Ghost) | −1/4 |
| 21 | Per Pokémon | Binding moves | −1/16, or "freed" when the counter ends |
| 22 | Per Pokémon | Bad Dreams (opponent's ability, if this Pokémon is asleep) | −1/8 |
| 23 | Per Pokémon | Uproar continues / ends | — |
| 24 | Per Pokémon | Thrash / Outrage / Petal Dance lock ends, then the user becomes confused | — |
| 25 | Per Pokémon | Disable countdown | — |
| 26 | Per Pokémon | Encore countdown | — |
| 27 | Per Pokémon | Lock-On / Mind Reader expiry | — |
| 28 | Per Pokémon | Charge expiry | — |
| 29 | Per Pokémon | Taunt countdown | — |
| 30 | Per Pokémon | Magnet Rise countdown | — |
| 31 | Per Pokémon | Heal Block countdown | — |
| 32 | Per Pokémon | Embargo countdown | — |
| 33 | Per Pokémon | Yawn: falls asleep | — |
| 34 | Per Pokémon | Held-item status: Toxic Orb / Flame Orb activate | — |
| 35 | Per Pokémon | Held-item damage: Sticky Barb | −1/8 |
| 36 | Field (extra) | Future Sight / Doom Desire hits | — |
| 37 | Field (extra) | Perish Song counts | — |
| 38 | Field (extra) | Trick Room countdown / end | — |
| 39 | — | Faint checks. Both players choose replacements. Hazards apply on entry. | — |

**Notes:**

- All fractions use `DamageDivide`, which floors with a minimum of 1.
- Magic Guard skips the damage entries.
- Heal Block blocks the heal entries.
- A Pokémon that switched in this turn because of a faint is skipped by the per-Pokémon block (`switchInFlag` in the decomp).

---

## 12. Abilities and held items

### How they hook in

Each ability or item is a handler on one or more battle events. This is the model Showdown uses and is the recommended architecture. Gen 4 hook points:

| Hook | Ability examples | Item examples |
|---|---|---|
| On switch-in | Intimidate, Drizzle, Drought, Sand Stream, Snow Warning, Download, Trace, Pressure, Mold Breaker (announce), Anticipation, Forewarn, Frisk | — |
| Base power (§3.2 step A) | Technician, Iron Fist, Reckless, Rivalry, Blaze, Torrent, Overgrow, Swarm; target Thick Fat, Heatproof, Dry Skin | Type plates and type items (×1.2), Muscle Band, Wise Glasses, Light Ball, Adamant/Lustrous/Griseous Orb |
| Stat modifiers | Huge Power, Pure Power, Hustle, Guts, Marvel Scale, Solar Power, Flower Gift, Slow Start, Plus/Minus | Choice Band, Choice Specs, Choice Scarf, Thick Club, Soul Dew, DeepSea Tooth/Scale, Metal Powder |
| Mod2 / Mod3 | Sniper, Adaptability, Filter, Solid Rock, Tinted Lens | Life Orb, Metronome, Expert Belt, resist berries |
| Type immunity / absorb | Levitate, Flash Fire, Volt Absorb, Water Absorb, Motor Drive, Dry Skin, Wonder Guard | Iron Ball (removes Levitate and Flying immunity) |
| Contact punishment | Static (30% paralysis), Flame Body (30% burn), Poison Point (30% poison), Effect Spore (30%, split across statuses), Cute Charm (30%), Rough Skin (1/8) | Sticky Barb transfer |
| Status immunity | Insomnia, Vital Spirit, Limber, Immunity, Water Veil, Magma Armor, Own Tempo, Oblivious, Inner Focus, Leaf Guard | Lum Berry, Chesto Berry and other cure berries |
| Residual | Speed Boost, Shed Skin, Rain Dish, Ice Body, Dry Skin, Poison Heal, Hydration, Bad Dreams | Leftovers, Black Sludge, Toxic Orb, Flame Orb, Sticky Barb |
| Crit / accuracy | Super Luck, Battle Armor, Shell Armor, Compound Eyes, Hustle, Sand Veil, Snow Cloak, Tangled Feet, No Guard, Keen Eye | Scope Lens, Razor Claw, Wide Lens, Zoom Lens, BrightPowder |
| Speed / order | Swift Swim, Chlorophyll, Quick Feet, Unburden, Stall | Quick Claw, Lagging Tail, Choice Scarf, Iron Ball, Custap Berry |
| Survival | **Sturdy (Gen 4: only OHKO-move immunity)** | **Focus Sash** (at full HP, survives a one-hit KO with 1 HP); Focus Band (10%) |
| HP-threshold | — | Sitrus Berry (**+1/4 max HP at ≤ 1/2 HP in Gen 4**), Oran Berry (+10 HP), pinch berries (Liechi etc.) |
| Switch-out | Natural Cure | Shed Shell |
| Trapping | Shadow Tag, Arena Trap, Magnet Pull | — |
| Move effects | Serene Grace (×2 secondary chance), Shield Dust, Rock Head, Skill Link, Simple, Unaware, Normalize, Scrappy, Klutz, Magic Guard, Truant, Synchronize | King's Rock / Razor Fang (10% flinch), Big Root (drain ×1.3), Power Herb |

### Gen 4 vs later

- **Sturdy** gained Focus Sash-like behaviour in Gen 5.
- **Hidden Abilities** don't exist in Gen 4.
- These items don't exist in Gen 4: gems, Eviolite, Assault Vest, Rocky Helmet, Weakness Policy, Air Balloon.
- **Life Orb:** recoil is 1/10 max HP, and its boost is ×1.3 applied in Mod2. Gen 5 changed it to 5324/4096 in the final modifier.
- **Type-boosting items** are ×1.2 to base power in both Gen 4 and Gen 5+, but applied differently.
- **Intimidate** is not blocked by Inner Focus, Oblivious or similar abilities in Gen 4. That blocking arrived in Gen 8.

### Recommended v1 subset

| Abilities (about 15) | Items (about 12) |
|---|---|
| Blaze, Torrent, Overgrow, Swarm (starter flavour; simple power hook) | Leftovers |
| Intimidate (switch-in) | Choice Band / Choice Specs / Choice Scarf |
| Levitate (Gengar and others rely on it) | Life Orb |
| Static, Flame Body, Poison Point (contact) | Focus Sash |
| Thick Fat, Water Absorb, Volt Absorb, Flash Fire | Sitrus Berry, Lum Berry |
| Natural Cure, Insomnia / Vital Spirit, Inner Focus | Expert Belt |
| Sturdy (Gen 4 version), Technician | Black Sludge; one type-boosting item category |

Every other ability should be a no-op in v1, with a clear flag in the data so the gap is visible. Better still, restrict the Pokémon pool to Pokémon whose abilities are all implemented.

---

## 13. Moves

### 13.1 Move data schema (per move)

| Field | Type | Notes |
|---|---|---|
| `id`, `name` | string | — |
| `type` | one of 17 types, or `???` | Curse is `???` in Gen 4. |
| `category` | Physical / Special / Status | Per move (§3.1). |
| `power` | int | 0 for status moves. The value "1" in game data means variable or fixed damage, handled by a callback. |
| `accuracy` | int, or "never misses" | The game uses 0 for "never misses". |
| `pp` | int | Base PP. |
| `priority` | −7…+5 | §5 |
| `target` | self / opponent / all-opponents / field / side… | Singles needs only a few kinds. |
| `flags` | contact, protect-able, mirror-move-able, sound, punch, snatch, magic-coat… | In the decomp move table, bit 0 of `flags` is contact. Verified on Bite (contact) vs Surf and Flamethrower (non-contact). |
| `effect` | effect id plus parameters | e.g. "burn target", "raise user Atk +2", "recoil 1/3". |
| `effectChance` | 0–100 | Secondary effect chance. Rolled as `rand%100 < chance`. Serene Grace doubles it. |
| `critStage` | 0 / 1 | High-crit flag. |
| Special fields | multihit, drain, recoil, two-turn, recharge, OHKO, fixed damage | See below. |

Sample HGSS values, read from the [decomp] move table:

- Flamethrower, Thunderbolt, Ice Beam and Surf: 95 power / 100% / 15 PP (Ice Beam 10 PP). These became 90 in Gen 6.
- Fire Blast and Hydro Pump: 120 power. Thunder and Blizzard: 120 power / 70% accuracy.
- Tackle: 35 power / 95%.
- Sucker Punch: 80. Draco Meteor: 140.
- Explosion: 250.
- Hidden Power and variable-power moves are listed as "1".

### 13.2 Special mechanics (Gen 4)

- **Multi-hit (2–5).** From [decomp]: 2 hits 3/8, 3 hits 3/8, 4 hits 1/8, 5 hits 1/8. Skill Link always gives 5.
  - Each hit rolls its own damage and crit.
  - The move stops if the target faints or its substitute breaks.
  - Fixed two-hit moves are Double Kick, Bonemerang and Twineedle.
  - Gen 5 changed the distribution to 35/35/15/15.
- **Two-turn moves.**
  - Solar Beam needs no charge in sun, and its power is halved in rain, sand or hail.
  - Skull Bash raises Def by 1 on the charge turn.
  - Razor Wind and Sky Attack charge for a turn.
  - Fly, Dig, Dive, Bounce and Shadow Force make the user semi-invulnerable during the charge turn.
  - Power Herb skips the charge.
  - These are recommended for phase 2.
- **Recharge.** Hyper Beam, Giga Impact and the Blast Burn family make the user skip its next turn.
- **Recoil.**
  - **1/3** of the damage dealt: Double-Edge, Brave Bird, Flare Blitz, Volt Tackle, Wood Hammer.
  - **1/4**: Take Down, Submission.
  - **1/2**: Head Smash.
  - Recoil = `floor(damageDealt × fraction)`, minimum 1 ([PS] gen4 `applyRecoilDamage`).
  - Rock Head and Magic Guard prevent it.
- **Crash damage** (Jump Kick / High Jump Kick on a miss). In Gen 4 the user takes damage based on the damage it would have dealt. **The exact Gen 4 cap was not verified.** Leave these moves out of v1.
- **Drain.** Absorb, Mega Drain, Giga Drain (60 BP in Gen 4), Drain Punch (60 BP / 5 PP in Gen 4), Leech Life and Dream Eater heal `floor(damage/2)`, minimum 1. Big Root multiplies the heal by 1.3. Liquid Ooze makes the drainer take damage instead.
- **OHKO.** Covered in §6. On a hit, the target's remaining HP is removed.
- **Fixed damage.** Type immunity still applies to all of these.
  - Seismic Toss and Night Shade deal damage equal to the user's level. Seismic Toss fails on Ghosts; Night Shade fails on Normal types.
  - Dragon Rage deals 40. Sonic Boom deals 20.
  - Super Fang deals half the target's current HP, minimum 1.
  - Psywave deals a random amount based on the user's level. The exact Gen 4 formula was not verified; leave it out of v1.
  - Endeavor, Counter (2× physical damage taken) and Mirror Coat (2× special) are also fixed damage.
- **Struggle.** Used when no move has PP or all moves are unusable.
  - 50 BP and physical.
  - Typeless in Gen 4: the decomp skips STAB and type effectiveness for it, so it hits Ghost types.
  - **Recoil is 1/4 of the user's max HP** (Gen 4+).
  - Uses no PP.
- **PP and PP Ups.**
  - Max PP = `base + floor(base/5) × ppUps`, with ppUps from 0 to 3. Base 5 gives 8 max; base 35 gives 56.
  - Each use costs 1 PP. **Pressure** adds 1 to the cost of moves that target the Pressure user.
  - Gen 4 tracks PP per move per Pokémon.
- **Secondary effects** do not apply if the target faints or is behind a substitute.
  - Shield Dust blocks them.
  - Sheer Force is Gen 5 and does not exist.
- **Variable power.**
  - Return/Frustration: Return power = `friendship × 10 / 25`, which is 102 at 255 friendship.
  - Low Kick and Grass Knot depend on weight.
  - Gyro Ball, Eruption, Water Spout, Flail, Reversal, Hidden Power and similar moves also vary.
  - Phase 2 candidates. Return could have friendship fixed at 255 in v1.
- **Pursuit:** doubled power against a switching target (§5).
- **U-turn:** the user switches out after hitting.
- **Explosion / Selfdestruct:** the user faints, and the target's Defense is halved in the calculation (Gen 4 only).

### 13.3 Suggested first-version move subset

The subset is about 70 moves. Values are HGSS values from the [decomp] move table, in the form power / accuracy / PP. The list deliberately has no two-turn moves, no weather, no hazards and no variable-power moves.

| Category | Moves |
|---|---|
| Normal | Tackle (35/95/35), Body Slam (85/100/15, 30% par), Headbutt (70/100/15, 30% flinch), Double-Edge (120/100/15, 1/3 recoil), Quick Attack (40, +1), Extreme Speed (80, +1), Hyper Beam (150/90/5, recharge) |
| Fire | Ember (40), Flamethrower (95/100/15, 10% burn), Fire Blast (120/85/5, 10% burn), Flare Blitz (120, recoil, thaw) |
| Water | Water Gun (40), Surf (95), Hydro Pump (120/80/5), Waterfall (80, 20% flinch), Aqua Jet (40, +1), Crabhammer (90/85, high crit) |
| Electric | Thunder Shock (40), Thunderbolt (95, 10% par), Thunder (120/70, 30% par), Thunder Wave |
| Grass | Vine Whip (35), Razor Leaf (55/95, high crit), Energy Ball (80), Giga Drain (60, drain), Leech Seed, Sleep Powder (75%) |
| Ice | Ice Beam (95/100/10, 10% freeze), Blizzard (120/70/5), Ice Shard (40, +1) |
| Fighting | Brick Break (75, breaks screens), Close Combat (120, −1 Def/SpD), Cross Chop (100/80, high crit), Mach Punch (40, +1), Focus Blast (120/70) |
| Poison | Sludge Bomb (90, 30% psn), Poison Jab (80, 30% psn), Toxic (85%) |
| Ground | Earthquake (100), Earth Power (90, 10% −SpD) |
| Flying | Brave Bird (120, recoil), Air Slash (75/95, 30% flinch), Aerial Ace (60, never misses) |
| Psychic | Psychic (90, 10% −SpD), Zen Headbutt (80/90), Calm Mind |
| Bug | X-Scissor (80), Bug Buzz (90), U-turn (70, switch) |
| Rock | Stone Edge (100/80, high crit), Rock Slide (75/90, 30% flinch) |
| Ghost | Shadow Ball (80, 20% −SpD), Shadow Claw (70, high crit), Confuse Ray |
| Dragon | Dragon Claw (80), Dragon Pulse (90), Outrage (120, 2–3 turn lock then confusion) |
| Dark | Crunch (80, 20% −Def), Dark Pulse (80, 20% flinch), Sucker Punch (80, +1, fails if the target isn't attacking), Pursuit (40) |
| Steel | Iron Head (80, 30% flinch), Flash Cannon (80), Bullet Punch (40, +1) |
| Fixed damage | Seismic Toss, Night Shade, Dragon Rage, Super Fang |
| Status / boost | Swords Dance, Dragon Dance, Nasty Plot, Calm Mind, Rest, Sleep Talk, Protect, Substitute, Will-O-Wisp (75%), Hypnosis (60%), Recover, Roost, Reflect, Light Screen, Roar (−6, phazing) |

Rest, Sleep Talk, Roar and U-turn need switch and sleep plumbing, but that plumbing is needed anyway. Outrage needs a lock state. Both are fine for v1.

---

## 14. Data sources

| Source | Format | Gen 4 accuracy | License | Notes |
|---|---|---|---|---|
| **Pokémon Showdown data** (`data/pokedex.ts`, `moves.ts`, `learnsets.ts`, `abilities.ts`, `items.ts`, `typechart.ts`, plus `data/mods/gen{8..1}`) | TypeScript objects. Also on npm as `@pkmn/dex`, `@pkmn/data`, `@pkmn/sim` (all v0.10.x, MIT) | **High.** Mods inherit downward (gen4 inherits from gen5, which inherits from gen6, and so on). Each mod overrides the values that changed: move power/accuracy/PP, types (Fairy reversion), base stats, abilities, items. `Dex.mod('gen4')` or `new Generations(Dex).get(4)` returns Gen 4 values. Learnsets carry per-generation source codes (e.g. `4L1` = Gen 4 level-up at Lv 1, `4M` = TM, `4T` = tutor). | **MIT** (https://github.com/smogon/pokemon-showdown/blob/master/LICENSE) | **Recommended.** Same codebase as the reference simulator, so data and mechanics stay consistent. Caveat: learnsets are Gen 4 as a whole (DPPt + HGSS), not HGSS-only; filter by source tags if HGSS-only availability matters. |
| **PokéAPI** | REST/GraphQL JSON; CSVs in repo `data/v2/csv` | **Good for learnsets per version group.** `version_group=heartgold-soulsilver` gives HGSS-specific level-up, TM/HM, tutor and egg moves. Move, Pokémon and type records hold *current* values, with `past_values` (moves), `past_types` and `past_stats` (Pokémon). | Repo code: **BSD-3-Clause** (copyright notice). It states that Pokémon names are Nintendo trademarks. It grants no rights to the underlying game data. | **Watch the semantics.** In `move.past_values` the `version_group` is the group in which the value *changed*, so the listed value applied *before* it. Example checked live: Thunderbolt's `past_values` = power 95 @ `x-y`, so it was 95 before XY. In `past_types` and `past_stats` the `generation` field is the *last* generation that used the old value. Example checked live: Clefable `past_types` = Normal @ `generation-v`, and `past_stats` sp-atk 85 @ `generation-v`. The fair-use policy asks you to cache locally; do not hit the API at runtime. |
| **Bulbapedia** | Wiki HTML/wikitext | High, with citations, and good HGSS-vs-DPPt notes | Text is **CC BY-NC-SA 2.5** (per the site footer; not re-verified this session). Images are Nintendo/TPC IP. | Human reference only. Cloudflare blocks scripted access, and the content is not machine-readable. NC-SA clauses are incompatible with commercial use and copying. |
| **Smogon research** (DP research threads, the DPP damage formula article) | Forum posts and articles | High for mechanics, and community-verified | No explicit license | Reference only. https://www.smogon.com/dp/articles/damage_formula; DP Research threads e.g. https://www.smogon.com/forums/goto/post?id=1731063 |
| **pret/pokeheartgold decomp** | C source, assembly scripts, NARC binaries | **Authoritative**: it is the game's logic | **No license** (GitHub reports none). The repo contains reverse-engineered game code. | Reference only. **Do not copy code or ship data extracted from it.** In this research I parsed `waza_tbl.narc` only to *verify* values. |

### Recommendation

1. Build a one-time **extract script**. It runs at build time and outputs JSON committed to the repo.
   - Use `@pkmn/dex` / `@pkmn/data` with `Generations.get(4)`.
   - Output the species pool (base stats, types, Gen 4 abilities), moves (type, category, power, accuracy, PP, priority, flags, secondary effects) and learnsets restricted to Gen 4 sources.
2. **Cross-check** the extracted values:
   - against PokéAPI for HGSS learnsets (`version_groups: heartgold-soulsilver`);
   - with spot checks against the decomp values in this document (e.g. Thunderbolt 95, Tackle 35/95, Protect +3, Fake Out +1, Curse `???`).
3. **Fields that changed after Gen 4** and must be confirmed in the extract:

   | Field | Changes to check |
   |---|---|
   | Move power / accuracy / PP | Gen 5/6/7 rebalances. Examples: Thunderbolt and Flamethrower 95→90; Fire Blast, Hydro Pump, Thunder and Blizzard 120→110; Tackle 35/95→50/100→40/100; Sucker Punch 80→70; Giga Drain 60→75; Drain Punch 60/5→75/10; Outrage 120/15 PP (PS gen4 sets 15). |
   | Move type | Curse `???`→Ghost; Charm, Sweet Kiss and Moonlight Normal→Fairy. |
   | Move priority | Protect/Detect/Endure +3→+4; Fake Out +1→+3; ExtremeSpeed +1→+2. |
   | Move category | Unchanged since Gen 4 for existing moves. Confirm anyway. |
   | Species types | Fairy retypings (Gen 6). |
   | Base stats | Gen 6 and Gen 7 buffs. Examples: Pikachu, Butterfree, Beedrill, Pidgeot, Clefable, Wigglytuff, Alakazam, Victreebel, Golem, Arbok, Dugtrio, Farfetch'd, Corsola, Noctowl, Ariados, Togekiss; see PS `data/mods/gen5/pokedex.ts` and `gen6`. |
   | Abilities | No Hidden Abilities. Several Gen 4 Pokémon got different or new abilities later. Gen 4 ability *effects* also differ: Sturdy, Shed Skin 30%, and Drizzle/Drought indefinite. |
   | Items | Gen 4 item effects. Sitrus 1/4; Gen 3 Sitrus was 30 HP. |

---

## 15. Reference implementations

### Pokémon Showdown `gen4`

- **What it is.** The full simulator (`sim/`) with a mod layer (`data/mods/gen4`). Gen 4 inherits from gen5 and overrides as needed.
  - `data/mods/gen4/scripts.ts` implements the DPP damage stages: `ModifyDamagePhase1` (screens, Flash Fire), weather, +2, crit, `ModifyDamagePhase2` (Life Orb ×1.3, Metronome, Me First), random roll, STAB, type, then final modifiers.
  - It also provides Gen 4 accuracy, OHKO, recoil and switch-in ordering.
  - `conditions.ts` covers par ¼ Speed and 25% full paralysis, sleep `random(2,6)` (1–4 turns), freeze 20%, confusion 50% self-hit, binding `random(3,7)`, the Protect counter max of 8, and the Gen 4 residual ordering.
- **Fidelity.** Very high, and widely used for competitive DPP play. Known approximations against the decomp:
  1. Accuracy and evasion are applied separately, not as a combined clamped stage with the rounded table (§6).
  2. Some modifiers go through Showdown's 4096-based `modify()` and `chainModify()` helpers instead of plain `x*N/100` flooring. For ×0.5 and ×1.5 the results match floor. For other multipliers, off-by-one differences are possible.
  3. Because gen4 inherits from gen5, a few Gen 5 behaviours may leak through where no override exists. Spot-test.
  4. It does not separate DPPt from HGSS behaviour. The one confirmed difference that matters here (Soul Dew in Frontier) is irrelevant for link-style battles.
- **License: MIT.** You may use, copy, modify, distribute and sublicense, including commercially, provided the copyright and permission notice is kept in copies or substantial portions. The underlying Pokémon IP is not licensed by MIT (§16).
- **Reuse options:**
  - **(A) Use `@pkmn/sim` as the battle engine, server-side.**
    - It is pure TypeScript with no native dependencies, so it runs in a Vercel Node function.
    - It has a seedable PRNG, which suits server-authoritative resolution and replays.
    - Its `BattleStream` choice protocol (`>p1 move 1`, `>p2 switch 3`) maps directly onto "both POST actions → resolve turn".
    - It can serialize battle state (`sim/state.ts`, `Battle.toJSON` / `Battle.fromJSON`) to store in Turso between turns.
    - Pros: fastest path to full Gen 4 fidelity.
    - Cons: large dependency; Showdown's protocol has to be translated into Gen 2-style UI messages; fidelity is bound to Showdown's approximations.
  - **(B) Write a small custom engine, using Showdown (and this document's decomp notes) as the reference and test oracle.**
    - Pros: small and fully understood; exact HGSS formulas; data model shaped for this project.
    - Cons: more work, and long-tail mechanics will take time.
    - Showdown can generate test cases: run the same seed and actions through both engines and compare.
  - **(C) Hybrid.** Use `@pkmn/dex` for data only and a custom engine (B) for mechanics. Use `@smogon/calc` (MIT) as a damage-calc test oracle; it supports gen 4.
- **Other references.**
  - `@smogon/calc` (damage calculator, MIT, has Gen 4 mechanics).
  - pret/pokeheartgold (authoritative, reference-only, no license).
  - pret/pokeplatinum and pokediamond (DPPt decomps; useful for checking DPPt-vs-HGSS differences; also reference-only).

---

## 16. IP and legal note

This section lists factual considerations. **It is not legal advice.** Consult a lawyer before any public or commercial release.

- **Trademarks.** "Pokémon" and the species names (Pikachu and so on) are trademarks of Nintendo, Creatures and Game Freak. The Pokémon Company manages them. PokéAPI's own license notes that names are Nintendo trademarks. "Picomon" is a different word, but closeness to a famous mark can still raise trademark questions.
- **Copyright.** Sprites, artwork, music, sound effects and in-game text are copyrighted. Gen 2 sprites ripped from Crystal are Nintendo and Game Freak assets. Fan-made sprites "in the style of" Gen 2 that depict existing Pokémon are generally still derivative works of the character designs.
- **Game mechanics and numbers.** Abstract game rules and formulas are generally treated as unprotectable ideas or methods in many jurisdictions, for example under US copyright law. Specific *compilations*, *code* and *expressive text* can be protected. Copying the game's binary data (such as the decomp's NARC files) or decompiled code is riskier than re-deriving numbers from public documentation.
- **Licenses of tools do not cover the IP.** MIT (Showdown) and BSD (PokéAPI) license *their code*. They grant no rights to Pokémon names, art or data owned by Nintendo and partners. Bulbapedia text is non-commercial share-alike.
- **Enforcement history.** Nintendo and The Pokémon Company have sent takedown notices (for example DMCA notices) to several fan games and fan projects over the years. Pokémon Showdown has operated for many years without its sprites and names being taken down; draw no conclusions from that.
- **Lower-risk options to discuss:**
  - original creatures, names and art that run on Gen 4-*style* mechanics;
  - keep the project private or invite-only;
  - non-commercial use;
  - avoid official logos and ripped assets.

---

## 17. Recommendations

### 17.1 Proposed MVP battle scope (smallest faithful Gen 4 slice)

The MVP covers the following.

**Format**
- Singles.
- Level 50 recommended (pending the user's decision).
- Bring 6 / pick 3, or 6v6 (pending the user's decision).
- Rental teams with fixed sets: 31 IVs, preset EVs and natures.
- Species Clause, Sleep Clause and OHKO Clause.

**Battle flow**
- Choose move or switch.
- Switches resolve first, then the priority/speed order with a random tie-break.
- Faint replacement at end of turn.
- A win when the opponent has no usable Pokémon.
- A turn limit or an Endless Battle Clause.

**Stats and damage**
- Full HGSS stat and damage formula (§2, §3) with integer flooring, using the physical/special split.
- STAB, the full type chart, crits (×2; stages from high-crit moves and Focus Energy), and the 16-value random roll.
- Burn halving.

**Accuracy and stat stages**
- Combined-stage accuracy table.
- Stat stages −6 to +6, with boosting and dropping moves.

**Statuses and volatiles**
- All five major statuses, with exact Gen 4 numbers.
- Confusion, flinch, substitute, Protect (with the consecutive-use counter), Leech Seed, the Outrage lock, recharge and choice lock.

**Moves**
- About 70 moves from §13.3, including multi-hit (Double Kick plus one 2–5 hit move), recoil, drain, fixed damage, priority moves, Struggle and PP tracking.

**Abilities and items**
- The subset from §12.

**End of turn**
- §11, restricted to the effects present in the MVP.

**Determinism**
- A single server-side seeded PRNG per battle. Store the seed and the full action log, so any turn can be replayed and audited.

### 17.2 Phased additions

1. **Phase 2:** weather (moves and abilities); Stealth Rock, Spikes and Toxic Spikes; Reflect, Light Screen, Safeguard and Tailwind; Rapid Spin and Defog; two-turn and semi-invulnerable moves; binding moves; Taunt, Encore, Disable and Yawn; U-turn and Baton Pass; Pursuit.
2. **Phase 3:** wider ability coverage (contact, absorb, weather abilities, Technician, Adaptability, Mold Breaker, Trace, Download and so on); more items (berries, Orbs, Expert Belt, Scope Lens); variable-power moves (Return, Low Kick, Gyro Ball, Hidden Power); OHKO moves; Counter and Mirror Coat; Trick Room.
3. **Phase 4:** a custom team builder with EV/IV/nature validation and Gen 4 learnset legality (HGSS-only or all of Gen 4); the full species pool; the remaining moves; spectator mode and replays.
4. **Ongoing:** a differential test suite against `@pkmn/sim` gen4 and `@smogon/calc`, using the same seeds and actions, plus tests that encode the decomp-derived numbers in this document.

### 17.3 Open questions (only the user can answer)

> **Update 2026-10-16:** the user decided Q6, using `@pkmn/sim` gen4, and Q7, matching Showdown and trusting the npm data without Bulbapedia verification. The remaining questions are tracked in [battle-brainstorm-open-questions.md](battle-brainstorm-open-questions.md).

1. **Level:** 50, or 100?
2. **Team size:** 6v6 full, or bring 6 / pick 3, or something else? Is there a team preview?
3. **Team source:** rental or preset teams only, custom building, or random battles? If custom, do you want full EV/IV/nature control?
4. **Species pool:** Gen 1–2 species only (to match the Crystal visuals), all 493, or a hand-curated list? Legendaries allowed, or the Frontier ban list?
5. **Which clauses?** Species, Item, Sleep, Freeze, OHKO, Evasion, Self-KO, Endless Battle.
6. **Engine strategy:** use `@pkmn/sim` gen4 directly (fast, Showdown-level fidelity), or write a custom engine that follows the decomp exactly (more work, exact HGSS behaviour)?
7. **Fidelity bar:** where Showdown and the cartridge differ (§6 accuracy table, §15), should the game follow the cartridge exactly or match Showdown?
8. **Learnset legality:** HGSS-only availability (including HGSS move tutors), or any Gen 4 game (DPPt + HGSS)?
9. **IP posture:** real Pokémon names and Gen 2 sprites (private or hobby use), or original creatures and art on Gen 4 mechanics? Is a commercial or public launch planned?
10. **Turn timer and disconnects:** how long per turn, and what happens on a timeout (a random move, Struggle, or forfeit)?
11. **Mid-battle switching UI:** for faint replacements, do both players choose at the same time (the Gen 4 rule), with a timer?

---

## Appendix A: Gen 4 vs Gen 5+ change list

Use these Gen 4 values; the "later" column lists the modern values to avoid.

| Mechanic | Gen 4 (use this) | Later (do not use) |
|---|---|---|
| Modifier math | Integer `x*N/D` per step, floored | Gen 5+: 4096-based fixed-point, pokeRound |
| Crit multiplier | ×2 (Sniper ×3) | Gen 6+: ×1.5 (Sniper ×2.25) |
| Crit stages | 1/16, 1/8, 1/4, 1/3, 1/2 | Gen 6: 1/16, 1/8, 1/2, 1; Gen 7+: 1/24… |
| Paralysis | ¼ Speed; Electric not immune | Gen 7: ½ Speed; Gen 6: Electric immune |
| Burn damage | 1/8 | Gen 7: 1/16 |
| Sleep | 1–4 turns; counter kept on switch | Gen 5: 1–3 turns (BW reset on switch) |
| Confusion self-hit | 50% | Gen 7: 33% |
| Type chart | Steel resists Ghost and Dark; no Fairy | Gen 6: changed |
| Ability-set weather | Indefinite | Gen 6: 5 turns (8 with a rock) |
| Binding | 2–5 turns, 1/16 | Gen 5: 4–5 turns; Gen 6: 1/8 |
| Multi-hit odds | 3/8, 3/8, 1/8, 1/8 | Gen 5: 35/35/15/15 |
| Protect priority / chain | +3; 1/2 per use, floor 1/8 | Gen 5: +4; 1/3 per use |
| Fake Out / ExtremeSpeed | +1 / +1 | +3 / +2 |
| Explosion | Halves target Def | Gen 5: no halving |
| Sound vs Substitute | Blocked | Gen 6: bypasses |
| Ghost vs trapping | Can be trapped | Gen 6: immune |
| Sturdy | OHKO-move immunity only | Gen 5: survives at 1 HP from full |
| Tailwind | 3 turns | Gen 5: 4 turns |
| Taunt / Encore / Disable | 3–5 / 4–8 / 4–7 turns | 3 / 3 / 4 |
| Curse type | `???` | Gen 5: Ghost |
| Struggle | Typeless, recoil ¼ max HP | Same |
| Turn order | Fixed at turn start | Gen 8: dynamic |
| End-of-turn grouping | Per Pokémon (all effects for one Pokémon, then the next) | Gen 5+: per effect |

**DPPt vs HGSS differences.**

- **Confirmed in the HGSS decomp:** Soul Dew does nothing in the Frontier.
- **From search results / Bulbapedia, not re-verified:**
  - The DP-only quirk where "perfect-accuracy" moves could hit through Protect was fixed in Platinum and HGSS.
  - The "acid rain" weather glitch exists in Platinum and HGSS.
- **Data differences:**
  - HGSS has different move tutors and TM availability from DPPt, which matters for learnsets.
  - Platinum-introduced forms (Giratina-Origin, Shaymin-Sky, Rotom forms) exist in HGSS.
- I found no source listing other core-formula differences between Platinum and HGSS. Showdown models a single "gen4".

---

## Appendix B: Source list and verification notes

### Verified directly this session (read from source)

- **pret/pokeheartgold** (https://github.com/pret/pokeheartgold):
  - `src/battle/overlay_12_0224E4FC.c`: `CalcMoveDamage`, `ApplyDamageRange`, `TryCriticalHit`, `sCritChance`, `sStatChangeTable`, `sTypeEffectiveness`, the STAB/type function `ov12_02251D28`, the speed/turn-order comparison, Shed Skin.
  - `src/battle/battle_command.c`: `DamageCalcDefault` (crit, Life Orb, Metronome, Me First order), multi-hit distribution, `BtlCmd_Random`, Protect table use, Disable/Encore counters, `BtlCmd_EndOfTurnWeatherEffect`.
  - `src/battle/battle_controller_player.c`: before-move check order (sleep, freeze, confusion, paralysis, attraction), `sHitChanceTable` and the accuracy function, end-of-turn state enums (field, per-Pokémon, extra), poison/toxic/bind residuals.
  - `files/battledata/script/subscript/*.s`: sleep (`Random 3,2`), confusion (`Random 3,2`), binding (`Random 3,3`, Grip Claw 6), burn and poison damage scripts.
  - `files/poketool/waza/waza_tbl.narc`: move table, parsed to check power, accuracy, PP, priority, category and contact flag.
  - `src/pokemon.c`: stat formulas, nature modifier, Frontier ban list.
  - `src/battle_regulation.c`: link-battle rule fields.
- **Pokémon Showdown** (https://github.com/smogon/pokemon-showdown): `data/mods/gen4/{scripts,conditions,moves,items,abilities,rulesets}.ts`, `sim/battle-actions.ts` (`getDamage`, crit tables), `sim/battle.ts` (`randomizer`, `modify`), `LICENSE` (MIT).
- **PokéAPI**: `LICENSE.md` (BSD-3-Clause text with the Nintendo trademark note). Live API checks of `move/thunderbolt` `past_values` and `pokemon/clefable` `past_types` and `past_stats`.
- **npm** registry metadata: `@pkmn/dex`, `@pkmn/data`, `@pkmn/sim` 0.10.11 (MIT); `@smogon/calc` 0.12.0 (MIT).
- **Smogon DPP damage formula article** (https://www.smogon.com/dp/articles/damage_formula): summarized through a fetch tool.

### Not verified (flagged in the text)

- **Bulbapedia** pages could not be fetched (Cloudflare challenge). Claims attributed to it come from prior knowledge. These include:
  - its license (CC BY-NC-SA 2.5);
  - the Battle Tower "levels above 50 set to 50" rule;
  - the BW sleep-counter reset;
  - the DPPt-vs-HGSS quirks.
- **Jump Kick / High Jump Kick crash-damage cap** in Gen 4. Psywave's exact Gen 4 formula.
- **Resist-berry application point** in the decomp. Taken from Smogon and Showdown instead.
- **Metal Powder:** ×2 in the decomp vs ×1.5 in the Smogon article. Not resolved.
- **Exact preset HGSS link-battle cups.** Only the rule fields were confirmed.
- **Smogon DP research threads** found by search (e.g. https://www.smogon.com/forums/goto/post?id=1731063, https://www.smogon.com/forums/goto/post?id=2865877, https://www.smogon.com/forums/goto/post?id=905397) were not read in full. They suggest some end-of-turn edge cases, such as fainting during the residual phase and Truant timing, were still debated. The decomp state machine above is the stronger source.
