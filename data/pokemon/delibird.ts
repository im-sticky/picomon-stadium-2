import type { PokemonEntry } from "./types";

export default {
  id: "delibird",
  sprite: "/sprites/pokemon-icons/delibird.png",
  ability: "Insomnia",
  baseStats: { hp: 55, atk: 85, def: 55, spa: 95, spd: 55, spe: 105 },
  set: {
    moves: ["Freeze-Dry", "Fly", "Ice Shard", "Rapid Spin"],
    item: "Life Orb",
    nature: "Hasty",
    evs: { atk: 128, spa: 128, spe: 252 },
  },
} satisfies PokemonEntry;
