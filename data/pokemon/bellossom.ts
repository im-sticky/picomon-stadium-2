import type { PokemonEntry } from "./types";

export default {
  id: "bellossom",
  sprite: "/sprites/pokemon-icons/bellossom.png",
  isGreat: true,
  ability: "Own Tempo",
  types: ["Grass", "Fairy"],
  baseStats: { hp: 75, atk: 80, def: 95, spa: 100, spd: 110, spe: 50 },
  set: {
    moves: ["Sleep Powder", "Giga Drain", "Dazzling Gleam", "Moonlight"],
    item: "Leftovers",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
