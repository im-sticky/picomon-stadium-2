import { Dex, toID, type Battle, type ModdedDex, type Move, type Pokemon, type PokemonSet } from "@pkmn/sim";
import { MOVE_CHANGES } from "@/data/moves";
import { POKEMON } from "@/data/pokemon";
import type { PokemonEntry } from "@/data/pokemon/types";
import { BATTLE_SIZES, type BattleSize } from "@/lib/types";

export const FORMAT_NAME = "[Gen 6] Picomon";
export const FORMAT_ID = toID(FORMAT_NAME);
export const LEVEL = 50;

/** One registered format per battle size: "[Gen 6] Picomon 3v3". A `@@@` rule suffix doesn't work on a custom mod. */
export const formatName = (size: BattleSize) => `${FORMAT_NAME} ${size}v${size}`;
/** The format a battle of this size runs on, e.g. "gen6picomon3v3". */
export const formatIdFor = (size: BattleSize) => toID(formatName(size));

export const MOD_ID = "picomon";
export const RULESET = ["Team Preview", "Cancel Mod", "Sleep Clause Mod", "Endless Battle Clause", "HP Percentage Mod"];
const STOCK = Dex.forGen(6);
/** Items from older generations that the gen6 data marks "Past", brought back for our mod. */
const PAST_ITEMS = ["berserkgene"];

/** Throws if a name in an entry isn't in the stock gen6 data, so typos fail at startup. */
function check(entry: PokemonEntry) {
  const where = `data/pokemon/${entry.id}.ts`;
  const species = STOCK.species.get(entry.id);
  if (!species.exists || species.id !== entry.id || species.isNonstandard) {
    throw new Error(`${where}: "${entry.id}" is not a gen6 species ID`);
  }
  const ability = STOCK.abilities.get(entry.ability);
  if (!ability.exists || ability.isNonstandard) throw new Error(`${where}: unknown ability "${entry.ability}"`);
  const item = STOCK.items.get(entry.set.item);
  if (!item.exists || (item.isNonstandard && !PAST_ITEMS.includes(item.id))) throw new Error(`${where}: unknown item "${entry.set.item}"`);
  for (const name of entry.set.moves) {
    if (name === undefined) continue;
    const move = STOCK.moves.get(name);
    if (!move.exists || move.isNonstandard) throw new Error(`${where}: unknown move "${name}"`);
  }
}

function buildDex(): ModdedDex {
  const pokedex: Record<string, object> = {};
  for (const entry of POKEMON) {
    check(entry);
    pokedex[entry.id] = {
      inherit: true,
      abilities: { 0: entry.ability },
      ...(entry.types && { types: entry.types }),
      ...(entry.baseStats && { baseStats: entry.baseStats }),
    };
  }

  const moves: Record<string, object> = {};
  for (const [id, change] of Object.entries(MOVE_CHANGES)) {
    if (!STOCK.moves.get(id).exists) throw new Error(`data/moves.ts: unknown move ID "${id}"`);
    moves[id] = { inherit: true, ...change };
  }

  const custom = Dex.mod(MOD_ID, {
    Scripts: {
      inherit: "gen6",
      // Base PP: the engine otherwise gives every move 3 PP Ups.
      calculatePP(this: Battle, move: Move) {
        return move.pp;
      },
    },
    Pokedex: pokedex,
    Moves: moves,
    Items: Object.fromEntries(PAST_ITEMS.map((id) => [id, { inherit: true, isNonstandard: null }])),
    Conditions: {
      // Hail gives Ice types 1.5× Def, like Sandstorm's SpD boost for Rock types (§17.5 of the gen6 research doc).
      hail: {
        inherit: true,
        onModifyDefPriority: 10,
        onModifyDef(this: Battle, def: number, pokemon: Pokemon) {
          if (pokemon.hasType("Ice") && pokemon.effectiveWeather() === "hail") return this.modify(def, 1.5);
        },
      },
    },
  } as Parameters<typeof Dex.mod>[1]);

  // Battles find their data through the format's mod in the engine's global
  // table, including `Battle.fromJSON`, which always starts from the default
  // Dex. So the format goes on the default Dex, and a rebuild (a dev hot
  // reload) must replace the table entry, which `Dex.mod` won't do itself.
  Dex.dexes[MOD_ID] = custom;
  // Registering a format twice throws, so a rebuild skips the ones already there.
  if (!Dex.formats.get(FORMAT_ID).exists) {
    Dex.formats.extend([{ name: FORMAT_NAME, mod: MOD_ID, ruleset: RULESET }]);
  }
  for (const size of BATTLE_SIZES) {
    if (!Dex.formats.get(formatIdFor(size)).exists) {
      Dex.formats.extend([
        { name: formatName(size), mod: MOD_ID, ruleset: [...RULESET, `Picked Team Size = ${size}`] },
      ]);
    }
  }
  return custom;
}

/** Gen6 data with our changes. Read UI data from it; battles pick it up from `formatIdFor(size)`. */
export const dex = buildDex();

const BY_ID = new Map(POKEMON.map((entry) => [entry.id, entry]));

export function getPokemon(id: string): PokemonEntry | undefined {
  return BY_ID.get(id);
}

/** The battle set for an entry, in the shape `Teams.pack` takes. */
export function toSet(entry: PokemonEntry): PokemonSet {
  const stat = (table: Partial<Record<string, number>> | undefined, fallback: number) => ({
    hp: table?.hp ?? fallback,
    atk: table?.atk ?? fallback,
    def: table?.def ?? fallback,
    spa: table?.spa ?? fallback,
    spd: table?.spd ?? fallback,
    spe: table?.spe ?? fallback,
  });
  return {
    name: dex.species.get(entry.id).name,
    species: dex.species.get(entry.id).name,
    item: entry.set.item,
    ability: entry.ability,
    moves: entry.set.moves.filter((move) => move !== undefined),
    nature: entry.set.nature,
    gender: "",
    evs: stat(entry.set.evs, 0),
    ivs: stat(entry.set.ivs, 31),
    level: LEVEL,
  };
}
