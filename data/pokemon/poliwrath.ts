import type { PokemonEntry } from "./types";

export default {
  id: "poliwrath",
  sprite: "/sprites/pokemon-icons/poliwrath.png",
  isGreat: true,
  ability: "Water Absorb",
  baseStats: { hp: 90, atk: 95, def: 100, spa: 70, spd: 90, spe: 70 },
  set: {
    moves: ["Bulk Up", "Waterfall", "Brick Break", "Ice Punch"],
    item: "Leftovers",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
