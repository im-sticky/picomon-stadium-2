import type { PokemonEntry } from "./types";

export default {
  id: "raikou",
  sprite: "/sprites/pokemon-icons/raikou.png",
  isStrong: true,
  ability: "Volt Absorb",
  set: {
    moves: ["Calm Mind", "Thunderbolt", "Shadow Ball", "Extrasensory"],
    item: "Leftovers",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
