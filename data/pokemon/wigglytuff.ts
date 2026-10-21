import type { PokemonEntry } from "./types";

export default {
  id: "wigglytuff",
  sprite: "/sprites/pokemon-icons/wigglytuff.png",
  ability: "Competitive",
  baseStats: { hp: 148, atk: 70, def: 55, spa: 85, spd: 65, spe: 45 },
  set: {
    moves: ["Hyper Voice", "Dazzling Gleam", "Wish", "Protect"],
    item: "Leftovers",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
