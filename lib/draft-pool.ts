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
  /** Base PP (no PP Ups). */
  pp: number;
  effect: string;
};

/** What the draft and detail screens show for one Pokémon: plain data, safe for the client. */
export type PoolPokemon = {
  id: string;
  name: string;
  sprite: string;
  isMaster: boolean;
  isUltra: boolean;
  isGreat: boolean;
  types: string[];
  ability: { name: string; description: string };
  item: string;
  baseStats: Record<StatKey, number>;
  moves: PoolMove[];
};

/** The last Pokédex number of Gen 2 (Celebi). */
const LAST_GEN2 = 251;

/**
 * Where a Pokémon sorts in the draft: by Pokédex number, with a later-gen evolution
 * just after its Gen 1–2 pre-evolution (Magnezone after Magneton), or after that
 * pre-evolution's last Gen 1–2 evolution when it has some (Leafeon after Umbreon).
 */
export function dexOrder(id: string): [number, number] {
  const species = dex.species.get(id);
  let base = species;
  while (base.num > LAST_GEN2 && base.prevo) base = dex.species.get(base.prevo);
  if (base === species) return [species.num, species.num];
  const siblings = base.evos.map((evo) => dex.species.get(evo).num).filter((num) => num <= LAST_GEN2);
  return [Math.max(base.num, ...siblings), species.num];
}

const byDexOrder = (a: string, b: string) => {
  const [x, y] = [dexOrder(a), dexOrder(b)];
  return x[0] - y[0] || x[1] - y[1];
};

/**
 * Every Pokémon in `POKEMON` in Pokédex order (see `dexOrder`), read from the patched
 * dex so the screens show what the battle uses. Server only (the dex pulls in `@pkmn/sim`).
 */
export function draftPool(): PoolPokemon[] {
  return [...POKEMON].sort((a, b) => byDexOrder(a.id, b.id)).map((entry) => {
    const species = dex.species.get(entry.id);
    const ability = dex.abilities.get(entry.ability);
    return {
      id: entry.id,
      name: species.name,
      sprite: entry.sprite,
      isMaster: entry.isMaster ?? false,
      isUltra: entry.isUltra ?? false,
      isGreat: entry.isGreat ?? false,
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
            pp: move.pp,
            effect: move.shortDesc,
          },
        ];
      }),
    };
  });
}
