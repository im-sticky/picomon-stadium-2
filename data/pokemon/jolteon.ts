import type { PokemonEntry } from "./types";

export default {
  id: "jolteon",
  sprite: "/sprites/pokemon-icons/jolteon.png",
  isGreat: true,
  ability: "Volt Absorb",
  set: {
    moves: ["Thunderbolt", "Volt Switch", "Shadow Ball", "Signal Beam"],
    item: "Choice Specs",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
