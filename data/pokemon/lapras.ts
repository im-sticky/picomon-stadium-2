import type { PokemonEntry } from "./types";

export default {
  id: "lapras",
  sprite: "/sprites/pokemon-icons/lapras.png",
  isGreat: true,
  ability: "Water Absorb",
  set: {
    moves: ["Ice Beam", "Surf", "Thunderbolt", "Shell Smash"],
    item: "Weakness Policy",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
