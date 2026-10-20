import type { NatureName, StatsTable, TypeName } from "@pkmn/types";

/**
 * One Pokémon in the game: its battle set, our changes on top of stock gen6,
 * and what the front end needs to show it. One file per Pokémon in this folder.
 *
 * Names (species, moves, ability, item) are Showdown names. The loader in
 * `lib/pokemon-dex.ts` checks every one against the gen6 data at startup.
 */
export interface PokemonEntry {
  /** Showdown species ID, e.g. "lugia", "mrmime", "hooh". Also the file name. */
  id: string;
  /** Public path of the sprite to show on the front end, e.g. "/sprites/pokemon-icons/lugia.png". */
  sprite: `/sprites/${string}.png`;
  /** The one ability this Pokémon has. Replaces all of its gen6 abilities. */
  ability: string;
  /** New types (§17.1 of the gen6 research doc). Leave out to keep the gen6 types. */
  types?: [TypeName] | [TypeName, TypeName];
  /** New base stats, all six (§17.2). Leave out to keep the gen6 stats. */
  baseStats?: StatsTable;
  /** The set this Pokémon battles with. Level is set by the server. */
  set: {
    moves: [string, string?, string?, string?];
    item: string;
    nature: NatureName;
    evs: Partial<StatsTable>;
    /** Defaults to 31 in every stat. */
    ivs?: Partial<StatsTable>;
  };
}

/** A change to one move (§17.4). Nested objects such as `secondary` must be written out in full. */
export interface MoveChange {
  type?: TypeName;
  basePower?: number;
  accuracy?: number | true;
  pp?: number;
  secondary?: { chance: number; boosts?: Partial<Record<"atk" | "def" | "spa" | "spd" | "spe" | "accuracy" | "evasion", number>>; status?: string };
}
