import type { PokemonEntry } from "./types";

export default {
  id: "lapras",
  sprite: "/sprites/pokemon-icons/lapras.png",
  ability: "Water Absorb",
  set: {
    moves: ["Freeze-Dry", "Surf", "Thunderbolt", "Ice Shard"],
    item: "Leftovers",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
