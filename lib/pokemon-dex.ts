import { Dex, toID, type ModdedDex, type PokemonSet } from "@pkmn/sim";
import { MOVE_CHANGES } from "@/data/moves";
import { POKEMON } from "@/data/pokemon";
import type { PokemonEntry } from "@/data/pokemon/types";

export const FORMAT_NAME = "[Gen 6] Picomon";
export const FORMAT_ID = toID(FORMAT_NAME);
export const LEVEL = 50;

const MOD_ID = "picomon";
const RULESET = [
  "Team Preview",
  "Cancel Mod",
  "Sleep Clause Mod",
  "Endless Battle Clause",
  "HP Percentage Mod",
  "Picked Team Size = 3",
];
const STOCK = Dex.forGen(6);

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
  if (!item.exists || item.isNonstandard) throw new Error(`${where}: unknown item "${entry.set.item}"`);
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
    Scripts: { inherit: "gen6" },
    Pokedex: pokedex,
    Moves: moves,
  } as Parameters<typeof Dex.mod>[1]);

  // Battles find their data through the format's mod in the engine's global
  // table, including `Battle.fromJSON`, which always starts from the default
  // Dex. So the format goes on the default Dex, and a rebuild (a dev hot
  // reload) must replace the table entry, which `Dex.mod` won't do itself.
  Dex.dexes[MOD_ID] = custom;
  if (!Dex.formats.get(FORMAT_ID).exists) {
    Dex.formats.extend([{ name: FORMAT_NAME, mod: MOD_ID, ruleset: RULESET }]);
  }
  return custom;
}

/** Gen6 data with our changes. Read UI data from it; battles pick it up from `FORMAT_ID`. */
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
