import { POKEMON } from "@/data/pokemon";
import { dex } from "@/lib/pokemon-dex";

export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

export type PoolMove = {
  name: string;
  type: string;
  category: "Physical" | "Special" | "Status";
  /** Null for status moves and moves without a fixed power. */
  power: number | null;
  /** Null for moves that never miss. */
  accuracy: number | null;
  /** Max PP in battle (the engine gives every move 3 PP Ups). */
  pp: number;
  effect: string;
};

/** What the draft and detail screens show for one Pokémon: plain data, safe for the client. */
export type PoolPokemon = {
  id: string;
  name: string;
  sprite: string;
  isUber: boolean;
  types: string[];
  ability: { name: string; description: string };
  item: string;
  baseStats: Record<StatKey, number>;
  moves: PoolMove[];
};

/** Max PP as the engine sets it up for a battle: 3 PP Ups, except where they don't apply. */
function battlePP(move: { id: string; pp: number; noPPBoosts?: boolean }): number {
  return move.noPPBoosts || move.id === "trumpcard" ? move.pp : Math.floor((move.pp * 8) / 5);
}

/**
 * Every Pokémon in `POKEMON`, read from the patched dex so the screens show what the
 * battle uses. Server only (the dex pulls in `@pkmn/sim`).
 */
export function draftPool(): PoolPokemon[] {
  return POKEMON.map((entry) => {
    const species = dex.species.get(entry.id);
    const ability = dex.abilities.get(entry.ability);
    return {
      id: entry.id,
      name: species.name,
      sprite: entry.sprite,
      isUber: entry.isUber ?? false,
      types: [...species.types],
      ability: { name: ability.name, description: ability.shortDesc },
      item: dex.items.get(entry.set.item).name,
      baseStats: { ...species.baseStats },
      moves: entry.set.moves.flatMap((name) => {
        if (name === undefined) return [];
        const move = dex.moves.get(name);
        return [
          {
            name: move.name,
            type: move.type,
            category: move.category,
            power: move.category === "Status" || !move.basePower ? null : move.basePower,
            accuracy: move.accuracy === true ? null : move.accuracy,
            pp: battlePP(move),
            effect: move.shortDesc,
          },
        ];
      }),
    };
  });
}
