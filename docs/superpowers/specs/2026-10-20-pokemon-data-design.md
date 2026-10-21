# Pokémon Data Files and Custom Gen 6 Mod — Design

*Date: 2026-10-20 · Status: prototype built and verified on branch `pokemon-data`; implementation not started*

## 1. Intent

Every Pokémon that can be drafted and battled gets one TypeScript file holding everything the app needs for it: its battle set, the project's changes to it on top of stock Gen 6, and the sprite the front end shows. A loader turns those files into a custom `@pkmn/sim` mod, so the battle engine and the UI read the same patched data.

This document records what the prototype proved and lists what's left to implement. The mechanics and the full list of custom changes are in [the Gen 6 research doc](../../research/2026-10-19-gen6-battle-mechanics.md) (§14 engine, §17 custom changes).

## 2. What the prototype proved

Files on the branch: `data/pokemon/` (four sample Pokémon), `data/moves.ts`, `lib/pokemon-dex.ts`. Packages added: `@pkmn/sim@0.10.11` and `@pkmn/types@4.0.0`, both pinned to exact versions.

The checks were run in a throwaway Vitest file and a temporary API route, and both were deleted afterwards:

| Check | Result |
|---|---|
| Type change (Lugia → Water/Flying, Meganium → Grass/Fairy, Ampharos → Electric/Dragon) | Shows in the dex and on the battle's `Pokemon` objects |
| Base-stat change (Ampharos 95/75/90/125/95/65) | Shows in the dex; in-battle stats are calculated from it (Lv 50: 202 HP, 194 SpA) |
| One ability per Pokémon | The dex lists only that ability; the battle uses it (Lugia's Multiscale halved the hit) |
| Move change (Cut → Steel 60/100; Octazooka 75/95, 30% −1 accuracy) | Shows in the dex and in battle, including the nested `secondary` |
| Unpatched data (Tyranitar, Thunderbolt, Moonblast) | Matches stock gen6 |
| Effect in battle | Ampharos's Thunderbolt was super effective on the retyped Lugia |
| Format | `battle.gen` is 6, mod `picomon`, the ruleset in §4.3, team preview, pick 3 |
| Save and restore (`toJSON` → `Battle.fromJSON`) | Restored battle is still gen 6 with our mod, and the next turn plays out the same as in the original battle |
| Rebuild (dev hot reload) | New battles use the rebuilt data |
| Typo in a data file | Fails at startup: `data/pokemon/lugia.ts: unknown move "Surff"` |
| `next build` + `next start` | `@pkmn/sim` bundles with Turbopack with no `next.config` changes; a route returned the patched data |

## 3. Data files

### 3.1 Layout

```
data/
  pokemon/
    types.ts       PokemonEntry and MoveChange types
    index.ts       POKEMON: the list of every entry (static imports)
    lugia.ts       one file per Pokémon, named by Showdown species ID
    ...
  moves.ts         MOVE_CHANGES: move changes keyed by move ID
lib/
  pokemon-dex.ts   validation, the custom mod, the format, set building
```

The files are named by Showdown ID (`mrmime`, `nidoranf`, `hooh`), so a file name maps straight to the engine's species ID.

### 3.2 One Pokémon

```ts
import type { PokemonEntry } from "./types";

export default {
  id: "lugia",
  sprite: "/sprites/pokemon-icons/lugia.png",
  isUber: true,
  ability: "Multiscale",
  types: ["Water", "Flying"],
  // baseStats: { hp, atk, def, spa, spd, spe },   // only if changed, all six
  set: {
    moves: ["Aeroblast", "Surf", "Calm Mind", "Roost"],
    item: "Leftovers",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
    // ivs: { ... },   // defaults to 31 everywhere
  },
} satisfies PokemonEntry;
```

| Field | Meaning |
|---|---|
| `id` | Showdown species ID. Must match the file name. |
| `sprite` | Public path of the image the front end shows. Typed as `` `/sprites/${string}.png` ``. |
| `isUber` | Draft only. Optional, defaults to `false`. `true` shows a Master Ball (`icon-masterball.png`) on the draft screen instead of a Poké Ball (`icon-pokeballball.png`), and each player may draft at most one uber. It has no effect on battles. |
| `ability` | The one ability this Pokémon has (§17.3). Always set. It replaces all of the species' gen6 abilities, in battle and in the dex. |
| `types` | §17.1 types. Leave it out to keep the gen6 types. |
| `baseStats` | §17.2 stats, all six. Leave it out to keep the gen6 stats. |
| `set` | The battle set: up to 4 moves, item, nature, EVs, optional IVs. The server sets the level (50). |

`satisfies` keeps the literal types, so typos in nature or type names fail at compile time. Species, move, ability and item names are plain strings. The loader checks them against gen6 data when the server starts (§4.1).

### 3.3 Move changes

Move changes apply to every Pokémon, so they live in `data/moves.ts`, not in the Pokémon files:

```ts
export const MOVE_CHANGES: Record<string, MoveChange> = {
  cut: { type: "Steel", basePower: 60, accuracy: 100 },
  octazooka: { basePower: 75, accuracy: 95, secondary: { chance: 30, boosts: { accuracy: -1 } } },
};
```

Nested objects replace the stock value rather than merging with it, so `secondary` must be written out in full (research doc §17.6, gotcha 2).

## 4. The loader (`lib/pokemon-dex.ts`)

It runs once when the module is imported, and exports `dex`, `FORMAT_ID`, `LEVEL`, `getPokemon(id)` and `toSet(entry)`.

### 4.1 Validation

For every entry, it checks against stock `Dex.forGen(6)`: the species exists, `id` equals the species' own ID, and the species and its ability, item and moves are all standard gen6 data (not `isNonstandard`). The same goes for every key in `MOVE_CHANGES`. Any failure throws an error that names the file. The server won't start with bad data.

### 4.2 The mod

```ts
Dex.mod("picomon", {
  Scripts: { inherit: "gen6" },
  Pokedex: { lugia: { inherit: true, abilities: { 0: "Multiscale" }, types: [...] }, ... },
  Moves:   { cut:   { inherit: true, type: "Steel", ... }, ... },
});
```

### 4.3 The format and the engine's global table

This is the part that isn't obvious. It's why the loader doesn't just pass the format in `Dex.mod`'s `Formats` or the dex to `new Battle(options, dex)`.

- `new Battle` loads its data with `dex.forFormat(format)`, which reads the engine's **global** table `Dex.dexes[format.mod]`. The dex object you pass is used only to look up the format.
- `Battle.fromJSON` always builds the battle from the **default** Dex. In the prototype, with the format only on the mod, a restored battle came back as gen 9 with stock moves.
- `Dex.mod` only adds to the global table the first time. When it's called again (a dev hot reload), it returns a new dex, but battles keep using the old one.

So the loader:

1. sets `Dex.dexes.picomon` to the dex it just built (a rebuild replaces it);
2. registers `[Gen 6] Picomon` (`gen6picomon`) on the **default** Dex with `mod: "picomon"`, once (registering twice throws a duplicate-ID error).

New and restored battles then both resolve `gen6picomon` → `picomon` → our data. Create battles with `new Battle({ formatid: FORMAT_ID, seed })`, with no second argument.

The prototype ruleset is `Team Preview, Cancel Mod, Sleep Clause Mod, Endless Battle Clause, HP Percentage Mod, Picked Team Size = 3`. This is the research doc's recommendation (§1), not a final decision.

### 4.4 Sets

`toSet(entry)` returns a full `PokemonSet` (species name, level 50, EVs filled with 0, IVs filled with 31) for `Teams.pack`. The format runs no team validator, so the sets aren't checked against learnsets. The data files are the only control over which moves a Pokémon gets.

## 5. Using the data

- **Battle server:** `toSet(getPokemon(id))` for each picked Pokémon → `battle.setPlayer(side, { name, team: Teams.pack(sets) })`.
- **Draft and battle UI:** read display data (types, stats, move type/power/accuracy/PP, ability text) from the exported `dex`, never from stock gen6. The UI then shows exactly what the battle uses.
- **Server only:** `lib/pokemon-dex.ts` imports `@pkmn/sim`, which is a large package. Only import it from server code (route handlers, server components). Send the client plain objects with just the fields a screen needs, such as `{ id, name, sprite, types, stats, moves }`. The files in `data/pokemon/` don't import the engine, so a client component can import them for the sprite path.
- **Ubers in the draft:** show `icon-masterball.png` when `entry.isUber` is true, otherwise `icon-pokeballball.png` (draft info box, design README "Draft"). The one-uber limit is a draft rule. The server's pick handler must reject a second uber from the same player, because the client can't be trusted. The draft screen can also disable the remaining ubers once a player has one.
- **Sprites:** `sprite` points into `public/sprites/`, e.g. `/sprites/pokemon-icons/lugia.png`. Use it as an `<img src>` or `next/image`.

## 6. What's left for implementation

1. **Decide the draft pool**, then add one file per Pokémon and list each in `data/pokemon/index.ts`. The four prototype files (Ampharos, Lugia, Meganium, Snorlax) are examples. Their sets and ability picks are placeholders.
2. **Mark the ubers** with `isUber: true`. The design canvas uses Dragonite, Tyranitar and Zapdos as samples. Lugia is marked in the prototype as an example. Enforce the one-uber limit on the server when the draft pick API is built.
3. **Pick one ability per Pokémon** from §17.3 (or its gen6 options if it isn't listed there).
4. **Write each set:** moves, item, nature, EVs.
5. **Fill in `types` / `baseStats`** for every pool Pokémon that appears in §17.1 / §17.2.
6. **Add the remaining §17.4 move changes to `data/moves.ts`:** Fly, Take Down, Sing, Supersonic, Strength, Fire Spin, Dig, Metronome (PP only, since "???" is display-only), Scald, Crabhammer, Pain Split, Rapid Spin, Whirlpool. Cut and Octazooka are already in.
7. **Metronome's "???" type:** a display-only override in the UI layer, not the mod.
8. **Settle the ruleset and level** (§4.3, §4.4). Change `RULESET` / `LEVEL` in `lib/pokemon-dex.ts`.
9. **Sprite choice:** the prototype points at the draft-pool icons. If battle front/back sprites are added later, change `sprite` to an object (`{ icon, front, back }`) or add fields.
10. **Optional:** a guard that fails the build if a `sprite` path doesn't exist in `public/`, and a test that keeps §2's checks (patched type/stat/ability/move in battle, restore round trip). Neither is in the prototype; add them if wanted.
11. **Server-only guard (optional):** add the `server-only` package and import it in `lib/pokemon-dex.ts`, so a client import fails the build.

## 7. Open questions

- The draft pool and each Pokémon's set (items 1–4 above).
- Final ruleset, level and team size (item 8).
- Whether players can change sets (custom EVs/moves) or the sets are fixed. If players can, `TeamValidator` and learnsets come back into scope (research doc §1, §14.2).
